
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Character, CharacterRoots, CharacterShape, CharacterSoul, StoryboardFrame, Scene } from "../types";

// --- CONFIGURATION TYPES ---
type AIProvider = 'gemini' | 'deepseek' | 'openai';
type ImageProvider = 'gemini' | 'openai' | 'jimeng';

interface TextGenConfig {
  provider: AIProvider;
  apiKey: string;
  baseUrl?: string;
  modelId?: string;
}

interface ImageGenConfig {
  provider: ImageProvider;
  apiKey: string;
  baseUrl?: string;
  modelId?: string;
}

// --- HELPER: GET CONFIG ---
const getTextConfig = (): TextGenConfig => {
  const provider = (localStorage.getItem('text_provider') as AIProvider) || 'gemini';
  
  if (provider === 'deepseek') {
      const apiKey = localStorage.getItem('deepseek_api_key') || '';
      const baseUrl = localStorage.getItem('deepseek_base_url') || 'https://api.deepseek.com';
      const modelId = localStorage.getItem('deepseek_model_id') || 'deepseek-chat';
      
      if (!apiKey) {
          throw new Error("DeepSeek 模式已开启，但未检测到 DeepSeek API Key。请前往“全局设置”配置。");
      }
      return { provider, apiKey, baseUrl, modelId };
  }
  
  // DEFAULT: GEMINI
  // PRIORITY: Local Storage (User Input) > Environment Variable
  const apiKey = localStorage.getItem('gemini_api_key') || process.env.API_KEY || '';
  const baseUrl = localStorage.getItem('text_base_url') || '';
  const modelId = localStorage.getItem('text_model_id') || '';

  if (!apiKey) {
    throw new Error("未检测到 Gemini API Key。请前往“全局设置”进行配置。");
  }

  return { provider, apiKey, baseUrl, modelId };
};

const getImageConfig = (customKey?: string): ImageGenConfig => {
    const provider = 'gemini'; 
    // PRIORITY: Custom param > Local Image Key > Local Text Key > Environment Variable
    const localImageKey = localStorage.getItem('gemini_api_key_image');
    const localTextKey = localStorage.getItem('gemini_api_key');
    const envKey = process.env.API_KEY; 
    
    // Note: If using DeepSeek for text, localTextKey (Gemini) might be empty or invalid for drawing if users cleared it.
    // So if image key is missing, and we are in DeepSeek mode, we might fail unless user set a specific image key.
    
    let apiKey = (customKey || localImageKey || localTextKey || envKey || '').trim();
    
    // Default to 3-Pro, but allow user override via Settings
    const storedModel = localStorage.getItem('image_model_id');
    const modelId = storedModel || 'gemini-3-pro-image-preview'; 
    
    const baseUrl = localStorage.getItem('image_base_url') || '';
    
    if (!apiKey) {
        throw new Error("未检测到绘图专用 Key (Gemini)。如使用 DeepSeek 作为文本引擎，必须单独配置 Gemini Key 用于绘图，或关联 Google Cloud 项目。");
    }
    return { provider, apiKey, baseUrl, modelId };
};

// --- HELPER: DATA URI PARSER ---
const extractDataUri = (dataUri: string): { mimeType: string, data: string } => {
    // Standard Regex for Data URI
    const match = dataUri.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (match && match.length === 3) {
        return { mimeType: match[1], data: match[2] };
    }
    // Fallback: simple split if standard regex fails but comma exists
    if (dataUri.includes(',')) {
        // Guess mime type or default to png if unknown
        let mimeType = 'image/png';
        if (dataUri.startsWith('data:image/jpeg')) mimeType = 'image/jpeg';
        if (dataUri.startsWith('data:image/webp')) mimeType = 'image/webp';
        return { mimeType, data: dataUri.split(',')[1] };
    }
    // Last resort: assume it is raw base64 data without prefix (unlikely in this app but safe)
    return { mimeType: 'image/png', data: dataUri };
};

// --- CORE: OPENAI-COMPATIBLE FETCH (Text) ---
const callOpenAICompatibleAPI = async (
  config: TextGenConfig,
  systemInstruction: string,
  userPrompt: string,
  jsonMode: boolean = false
): Promise<string> => {
  const baseUrl = config.baseUrl?.replace(/\/$/, '') || 'https://api.deepseek.com';
  // If baseUrl ends with /v1, don't append /chat/completions if it's already full path (unlikely for user input usually)
  // Standardizing: User inputs host (e.g. https://api.deepseek.com), we append /chat/completions
  const url = `${baseUrl}/chat/completions`;
  const model = config.modelId || 'deepseek-chat';

  const messages = [
    { role: 'system', content: systemInstruction },
    { role: 'user', content: userPrompt }
  ];

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.7,
        stream: false,
        response_format: jsonMode ? { type: "json_object" } : undefined 
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(`DeepSeek API Error (${response.status}): ${errData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) throw new Error("API returned empty content");
    return content;

  } catch (error: any) {
    console.error("OpenAI/DeepSeek API Call Failed:", error);
    throw error;
  }
};

// --- CORE: UNIFIED TEXT GENERATOR ---
const generateTextViaProvider = async (
  systemInstruction: string,
  userPrompt: string,
  forceJson: boolean = false,
  schema?: Schema
): Promise<string> => {
  const config = getTextConfig();

  // 1. GEMINI PATH
  if (config.provider === 'gemini') {
      const geminiOptions: any = { apiKey: config.apiKey };
      if (config.baseUrl) {
          geminiOptions.baseUrl = config.baseUrl;
      }
      
      const ai = new GoogleGenAI(geminiOptions);
      const model = 'gemini-2.5-flash';
      
      const geminiConfig: any = {
        systemInstruction: systemInstruction,
      };
      
      if (forceJson) {
          geminiConfig.responseMimeType = "application/json";
          if (schema) geminiConfig.responseSchema = schema;
      }

      const response = await ai.models.generateContent({
        model,
        contents: userPrompt,
        config: geminiConfig
      });
      
      return response.text || "";
  } 
  
  // 2. DEEPSEEK / OPENAI PATH
  else {
      let finalSystemPrompt = systemInstruction;
      if (forceJson) {
          finalSystemPrompt += "\n\nIMPORTANT: You MUST return a valid JSON object. Do not include Markdown formatting (```json ... ```). Just the raw JSON string.";
      }
      return await callOpenAICompatibleAPI(config, finalSystemPrompt, userPrompt, forceJson);
  }
};

// --- HELPER: CLEAN JSON ---
const cleanAndParseJSON = (text: string) => {
    let cleanText = text.trim();
    if (cleanText.startsWith("```")) {
        cleanText = cleanText.replace(/^```(json)?/, "").replace(/```$/, "");
    }
    // Remove any trailing/leading whitespace or weird chars
    cleanText = cleanText.trim();
    try {
        return JSON.parse(cleanText);
    } catch (e) {
        console.error("JSON Parse Error. Raw Text:", cleanText);
        throw new Error("AI 返回的 JSON 格式有误，无法解析。");
    }
};

// --- HELPER: CONSTRUCT IMAGE CONFIG ---
const buildImageModelConfig = (modelId: string, widthRatio: string = "16:9", force4K: boolean = true) => {
    // Basic config structure
    const config: any = {
        imageConfig: {
            aspectRatio: widthRatio,
        }
    };

    // 'imageSize' is ONLY supported by Pro models (gemini-3-pro-image-preview)
    // 2.5 Flash Image (Nano Banana) or Flash Lite DOES NOT support imageSize parameter and will error 400 if sent.
    const isPro = modelId.includes('pro');
    
    if (isPro && force4K) {
        config.imageConfig.imageSize = "4K";
    }

    return config;
};

// --- DIAGNOSTIC TOOLS ---

export interface DiagnosisResult {
  step: string;
  status: 'success' | 'error' | 'warning';
  message: string;
}

// Updated to accept params from Settings UI for live testing
export const diagnoseNetwork = async (
    geminiKey?: string,
    imageKey?: string,
    deepseekConfig?: { provider: 'gemini' | 'deepseek', deepseekKey: string, deepseekBaseUrl: string, deepseekModel: string },
    target: 'all' | 'text' | 'image' = 'all'
): Promise<DiagnosisResult[]> => {
    const results: DiagnosisResult[] = [];
    
    // 1. Determine active provider context
    const provider = deepseekConfig?.provider || 'gemini';
    const envKey = process.env.API_KEY;

    // --- STEP 1: TEXT ENGINE CHECK ---
    if (target === 'all' || target === 'text') {
        const effectiveTextKey = provider === 'gemini' ? (geminiKey || envKey) : deepseekConfig?.deepseekKey;
        const getKeySource = (key?: string) => {
             if (!key) return "None";
             if (key === envKey) return "Environment (Project)";
             if (key.length > 5) return "Manual Input";
             return "Unknown";
        };

        if (provider === 'gemini') {
            if (!effectiveTextKey) {
                results.push({ step: "Gemini Key Check", status: 'error', message: "未检测到 Gemini Key。" });
            } else {
                const source = getKeySource(effectiveTextKey);
                results.push({ step: "Text Key Source", status: 'success', message: `Using: ${source}` });
                
                try {
                    const ai = new GoogleGenAI({ apiKey: effectiveTextKey });
                    const start = performance.now();
                    await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: 'ping' });
                    results.push({
                        step: "Gemini 文本连接",
                        status: 'success',
                        message: `连接成功 (${Math.round(performance.now() - start)}ms)。`
                    });
                } catch (e: any) {
                    results.push({ step: "Gemini 文本连接", status: 'error', message: `连接失败: ${e.message}` });
                }
            }
        } else {
            // DeepSeek Check
            if (!effectiveTextKey) {
                 results.push({ step: "DeepSeek Key Check", status: 'error', message: "未输入 DeepSeek Key。" });
            } else {
                 try {
                    const start = performance.now();
                    const config: TextGenConfig = {
                        provider: 'deepseek',
                        apiKey: effectiveTextKey,
                        baseUrl: deepseekConfig?.deepseekBaseUrl,
                        modelId: deepseekConfig?.deepseekModel
                    };
                    await callOpenAICompatibleAPI(config, "You are a test bot.", "ping");
                    results.push({
                        step: "DeepSeek API 连接",
                        status: 'success',
                        message: `连接成功 (${Math.round(performance.now() - start)}ms)。Model: ${config.modelId}`
                    });
                 } catch (e: any) {
                     results.push({ step: "DeepSeek API 连接", status: 'error', message: `连接失败: ${e.message}` });
                 }
            }
        }
    }

    // --- STEP 2: IMAGE ENGINE CHECK (ALWAYS GEMINI) ---
    if (target === 'all' || target === 'image') {
        // Calculate Effective Image Key with correct Fallback
        // Priority: Manual Image Key -> Manual Gemini Key (only if using Gemini for text) -> Environment Key
        let effectiveImageKey = imageKey;
        if (!effectiveImageKey) {
             if (provider === 'gemini' && geminiKey) {
                 effectiveImageKey = geminiKey;
             } else {
                 effectiveImageKey = envKey;
             }
        }

        const getImageKeySource = (key?: string) => {
            if (!key) return "None";
            if (key === envKey) return "Environment (Paid Project)";
            if (key === imageKey) return "Manual Image Key";
            if (key === geminiKey) return "Manual Text Key (Shared)";
            return "Unknown Source";
        };

        if (!effectiveImageKey) {
            results.push({ 
                step: "绘图引擎配置", 
                status: 'error', 
                message: "未检测到可用的画图 Key。请配置“手动 Visual API Key”或关联 Google Cloud 项目。" 
            });
        } else {
            const config = getImageConfig(effectiveImageKey); 
            const targetModel = config.modelId || 'gemini-3-pro-image-preview';
            
            const source = getImageKeySource(effectiveImageKey);
            results.push({ step: "Image Key Source", status: 'success', message: `Using: ${source}` });

            try {
                const ai = new GoogleGenAI({ apiKey: effectiveImageKey });
                 // Lightweight request
                 const response = await ai.models.generateContent({
                     model: targetModel,
                     contents: { parts: [{ text: "dot" }] },
                     config: buildImageModelConfig(targetModel, "1:1", false) // Small test, force4K=false
                 });
                 
                 // Explicit Safety/Failure check for diagnosis
                 const candidate = response.candidates?.[0];
                 if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
                     throw new Error(`FinishReason: ${candidate.finishReason} (可能被拦截)`);
                 }

                 results.push({
                    step: `图像/视觉引擎 (${targetModel})`,
                    status: 'success',
                    message: "连接成功！Billing 权限正常。"
                });
            } catch (e: any) {
                 let msg = e.message || "Unknown error";
                 let status: 'error' | 'warning' = 'error';
                 
                 if (msg.includes("403") || msg.includes("PERMISSION_DENIED")) {
                     msg = "【403 权限拒绝】需要 Billing 权限。请确保 AI Studio 项目已关联结算账户，或者切换到 Flash Image 模型。";
                 } else if (msg.includes("404")) {
                     msg = `【404 未找到】模型 ${targetModel} 不可用。`;
                 } else if (msg.includes("Requested entity was not found")) {
                     msg = "【关联失效】Project Key 无效。请重新关联项目。";
                 } else if (msg.includes("400")) {
                     msg = `【400 参数错误】模型不支持当前 Config (Size/Ratio)。Model: ${targetModel}`;
                 }
        
                 results.push({ step: `图像/视觉引擎 (${targetModel})`, status: status, message: msg });
            }
        }
    }

    return results;
}

// --- PUBLIC SERVICES ---

export const generateCharacterProfile = async (
  universeContext: string,
  briefDescription: string,
  role: string,
  textModelStyle: string = 'gemini-2.5-flash',
  existingProfile?: any
): Promise<{ roots: CharacterRoots; shape: CharacterShape; soul: CharacterSoul }> => {
  // ... (No change logic)
  let styleInstruction = "";
  if (textModelStyle === 'jimeng-style') {
    styleInstruction = `
      【风格要求 - 重要】：
      请模仿“即梦(Jimeng)”或“豆包”等中文创意写作AI的风格。
      1. 必须全程使用简体中文（Simplified Chinese）。
      2. 用词要更具“网感”和文学性，避免过于生硬的翻译腔。
      3. 在描写外貌和性格时，使用更细腻、更有画面感的词汇。
      4. 情感描写要更深刻，强调角色的内心戏和矛盾感。
    `;
  } else {
    styleInstruction = "保持专业、客观、逻辑严密的影视剧本设定风格。所有输出必须为简体中文。";
  }

  let lockingInstruction = "";
  if (existingProfile) {
      lockingInstruction = `
      【LOCKING INSTRUCTION / 锁定指令 - CRITICAL】
      The user has provided some EXISTING DATA for this character.
      The following JSON contains fields that are LOCKED/FIXED by the user:
      ${JSON.stringify(existingProfile)}
      You MUST:
      1. KEEP these values EXACTLY as they are.
      2. Generate the missing/empty fields to be consistent with these locked values.
      3. Return the FULL JSON profile.
      `;
  }

  const systemPrompt = `You are an expert scriptwriter assistant. You MUST output in Simplified Chinese. ${styleInstruction}`;

  const userPrompt = `
    请根据以下背景和简要描述，为一个角色创建深度的人物小传。

    宇宙背景: ${universeContext}
    角色剧作定位: ${role}
    角色简述: ${briefDescription}

    ${lockingInstruction}

    【重要指令】：
    请严格按照JSON格式返回。不要包含任何Markdown标记。
    JSON结构必须包含：
    {
      "roots": { "name", "age", "gender", "origin", "familyBackground", "socialClass", "educationJob" },
      "shape": { "appearance", "fashion", "bodyLanguage", "habits" },
      "soul": { "corePersonality", "moralCompass", "desires", "fears", "innerConflict" }
    }
  `;
  
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      roots: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, age: { type: Type.STRING }, gender: { type: Type.STRING }, origin: { type: Type.STRING }, familyBackground: { type: Type.STRING }, socialClass: { type: Type.STRING }, educationJob: { type: Type.STRING } } },
      shape: { type: Type.OBJECT, properties: { appearance: { type: Type.STRING }, fashion: { type: Type.STRING }, bodyLanguage: { type: Type.STRING }, habits: { type: Type.STRING } } },
      soul: { type: Type.OBJECT, properties: { corePersonality: { type: Type.STRING }, moralCompass: { type: Type.STRING }, desires: { type: Type.STRING }, fears: { type: Type.STRING }, innerConflict: { type: Type.STRING } } }
    }
  };

  try {
    const rawText = await generateTextViaProvider(systemPrompt, userPrompt, true, schema);
    return cleanAndParseJSON(rawText);
  } catch (error) {
    console.error("Error generating character profile:", error);
    throw error;
  }
};

export const generateCharacterVisualDescription = async (
  character: Character
): Promise<string> => {
  const refImage = character.images?.find(img => img.angle.startsWith('01'));

  const systemPrompt = "You are a Concept Artist and Character Designer (角色设计师). Your task is to synthesize a text profile into a vivid, detailed visual description optimized for image generation.";
  
  // Base Text Prompt
  let userPrompt = `
    Please generate a detailed "Visual Description" (定妆描述词) for the following character.
    This description will be used as a PROMPT for an AI Image Generator.
    
    [CHARACTER PROFILE]
    Name: ${character.roots.name}
    Age: ${character.roots.age}
    Gender: ${character.roots.gender}
    Origin: ${character.roots.origin}
    
    [APPEARANCE]
    ${character.shape.appearance}
    
    [FASHION]
    ${character.shape.fashion}
    
    [PERSONALITY / VIBE]
    ${character.soul.corePersonality}
    ${character.soul.moralCompass}
    
    [REQUIREMENTS]
    1. Provide detailed description of facial features (eyes, nose, skin texture, makeup).
    2. Provide detailed description of hairstyle and color.
    3. Provide detailed description of clothing, accessories, and fabric materials.
    4. Describe the overall "Vibe", "Aura" or "Lighting" visually.
    5. Output in Simplified Chinese.
    6. Keep it under 300 words. Focus on visual keywords.
  `;

  // If Reference Image exists, we use Gemini's Multimodal capability
  if (refImage) {
      console.log("Generating visual description using Reference Image...");
      
      const config = getTextConfig();
      if (config.provider !== 'gemini') {
         // Fallback if provider is DeepSeek (cannot see images)
         userPrompt += "\n[NOTE] Reference image available but current text provider does not support vision. Generating based on text profile only.";
         return await generateTextViaProvider(systemPrompt, userPrompt, false);
      }

      const geminiOptions: any = { apiKey: config.apiKey };
      if (config.baseUrl) geminiOptions.baseUrl = config.baseUrl;
      const ai = new GoogleGenAI(geminiOptions);

      const parts: any[] = [];
      const { mimeType, data } = extractDataUri(refImage.url);
      
      parts.push({ inlineData: { mimeType, data } });
      
      userPrompt += `
      \n\n[CRITICAL INSTRUCTION - REFERENCE IMAGE ATTACHED]
      I have attached the "Front View Benchmark" image of this character.
      You MUST base your visual description on this image to ensure consistency.
      1. Describe the EXACT hair color and style shown in the image.
      2. Describe the EXACT clothing details shown in the image.
      3. Describe the EXACT facial features shown in the image.
      4. Use the text profile only for context/vibe. The IMAGE is the truth for physical appearance.
      `;
      
      parts.push({ text: systemPrompt + "\n\n" + userPrompt });

      try {
          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: { parts },
          });
          return response.text || "";
      } catch (e) {
          console.error("Multimodal generation failed, falling back to text.", e);
          return await generateTextViaProvider(systemPrompt, userPrompt, false);
      }
  }

  // Fallback / Text Only
  return await generateTextViaProvider(systemPrompt, userPrompt, false);
};

export const generateCharacterImage = async (
  character: Character,
  angleDescription: string,
  modelName?: string, 
  referenceImageBase64?: string | null,
  customApiKey?: string
): Promise<string> => {
  let config: ImageGenConfig;
  try {
    config = getImageConfig(customApiKey);
  } catch (e) {
    throw e;
  }
  
  const effectiveModel = config.modelId || 'gemini-3-pro-image-preview';

  let physicalDescription = "";
  if (character.visualDescription && character.visualDescription.trim().length > 0) {
      physicalDescription = `
        Character Name: ${character.roots.name}
        Age: ${character.roots.age}
        Gender: ${character.roots.gender}
        
        [DETAILED VISUAL DESCRIPTION (PRIORITY)]
        ${character.visualDescription}
      `;
  } else {
      physicalDescription = `
        Character Name: ${character.roots.name}
        Age: ${character.roots.age}
        Gender: ${character.roots.gender}
        Ethnicity/Origin: ${character.roots.origin}
        
        [VISUAL FEATURES - STRICT]
        ${character.shape.appearance}
        
        [OUTFIT / FASHION - STRICT]
        ${character.shape.fashion}
      `;
  }

  let referenceInstruction = "";
  if (referenceImageBase64) {
      referenceInstruction = `
      【EXTREME CONSISTENCY REQUIRED】
      A reference image has been provided. You MUST generate the EXACT SAME CHARACTER.
      1. Same facial features (eyes, nose, mouth structure).
      2. Same hair style and color.
      3. Same clothing details and fabric.
      4. Only change the POSE and CAMERA ANGLE as requested below.
      `;
  }

  const textPrompt = `
    Professional Character Design Sheet, High Fidelity, 4K Resolution.
    
    【CRITICAL REQUIREMENT】:
    1. BACKGROUND: Pure SOLID Color Background (Studio White or Neutral Grey). NO Scenery, NO Environment, NO Texture.
    2. CONSISTENCY: This MUST be the EXACT SAME CHARACTER as described below.
    ${referenceInstruction}
    
    【SUBJECT DESCRIPTION】:
    ${physicalDescription}
    
    【CAMERA / ANGLE】:
    ${angleDescription}
    
    ART STYLE: Cinematic Movie Still, Realistic, Professional Lighting, High Detail.
  `;

  try {
    console.log(`Generating character image using ${effectiveModel}`);
    const geminiOptions: any = { apiKey: config.apiKey };
    if (config.baseUrl) geminiOptions.baseUrl = config.baseUrl;
    
    const ai = new GoogleGenAI(geminiOptions);
    
    // Config: 3:4 for portraits.
    const gemConfig = buildImageModelConfig(effectiveModel, "3:4", true);

    const parts: any[] = [];
  
    if (referenceImageBase64) {
      const { mimeType, data } = extractDataUri(referenceImageBase64);
      parts.push({ inlineData: { mimeType, data } });
      parts.push({ text: "Reference Image (above) for strict character look consistency." });
    }
    parts.push({ text: textPrompt });

    const response = await ai.models.generateContent({
      model: effectiveModel,
      contents: { parts },
      config: gemConfig
    });

    const candidate = response.candidates?.[0];
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
        throw new Error(`Generation blocked by Safety/Policy. Reason: ${candidate.finishReason}`);
    }

    const respParts = candidate?.content?.parts;
    if (respParts) {
      for (const part of respParts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("No image data found in response");

  } catch (error: any) {
    console.error("Error generating image:", error);
    const msg = error.message || error.toString();
    if (msg.includes('403') || msg.includes('billing') || msg.includes('PERMISSION_DENIED')) {
        throw new Error(`BILLING_REQUIRED: 模型 ${effectiveModel} 需要付费权限。请尝试切换到 Gemini 2.5 Flash Image 或检查 Billing。`);
    } else if (msg.includes("Requested entity was not found")) {
        throw new Error("BILLING_ERROR: 关联的 Google Cloud 项目失效 (Entity Not Found)。请在设置页重新关联项目。");
    } else if (msg.includes("400")) {
        throw new Error(`PARAM_ERROR: 参数错误 (400)。可能模型 ${effectiveModel} 不支持某些参数(如imageSize)或Prompt过长。`);
    }
    throw error;
  }
};

export const generateSceneDescription = async (
  universeContext: string,
  sceneName: string,
  brief: string
): Promise<string[]> => {
  const systemPrompt = "Expert Environment Artist. Return Simplified Chinese.";
  const userPrompt = `
    Universe: ${universeContext}
    Scene Name: ${sceneName}
    Draft Idea: ${brief}
    
    Please expand this into a rich, visual environment description suitable for a 3D artist or Filmmaker. 
    Focus on lighting, textures, atmosphere, and key landmarks.
    Keep it within 200 words.
  `;
  try {
    const result = await generateTextViaProvider(systemPrompt, userPrompt, false);
    return result as any;
  } catch (e) { throw e; }
};

export const generateSceneImage = async (
  sceneName: string,
  description: string,
  viewType: string,
  referenceImageBase64?: string
): Promise<string> => {
  let config: ImageGenConfig;
  try {
    config = getImageConfig();
  } catch (e) { throw e; }

  const effectiveModel = config.modelId || 'gemini-3-pro-image-preview';

  const viewPrompts: Record<string, string> = {
    main: "Cinematic Master Shot, Wide Angle, establishing shot.",
    overhead: "Top-down Aerial View, Drone shot, 90 degree angle looking straight down. Map-like visibility.",
    isometric: "Architectural Line Art / Sketch Style. Extreme Wide Shot. 3D Isometric Perspective. Cutaway drawing style. Detailed structural view.",
    reverse: "180-degree Reverse Angle Shot. Panoramic view looking at the opposite side of the room/location from the main shot. Wide angle coverage. Show the fourth wall."
  };

  let anglePrompt = viewPrompts[viewType];
  if (!anglePrompt) {
      // For 'custom' or any other type
      anglePrompt = "Cinematic Scene Shot. Focus on the details described. Maintain consistency with the scene.";
  }

  let refInstruction = "";
  if (referenceImageBase64) {
    refInstruction = `
    【STRICT CONSISTENCY REQUIRED】
    A reference image of the scene is provided. 
    You MUST Generate the SAME location, same architecture, same lighting and materials.
    1. Do NOT hallucinate new objects that contradict the reference.
    2. Maintain the exact color palette and atmosphere.
    3. Only change the CAMERA ANGLE/COMPOSITION according to the instruction: "${anglePrompt}".
    `;
  }

  const prompt = `
    Environment Concept Art. 4K Resolution. High Fidelity.
    SCENE NAME: ${sceneName}
    DESCRIPTION: ${description}
    
    CAMERA ANGLE / VIEW: ${anglePrompt}
    
    ${refInstruction}
    
    ART STYLE: ${viewType === 'isometric' ? 'Architectural Sketch, Line Art, Technical Drawing' : 'Photorealistic, Cinematic Lighting, Detailed Textures'}.
  `;

  const geminiOptions: any = { apiKey: config.apiKey };
  if (config.baseUrl) geminiOptions.baseUrl = config.baseUrl;
  const ai = new GoogleGenAI(geminiOptions);
  
  const parts: any[] = [];
  if (referenceImageBase64) {
      const { mimeType, data } = extractDataUri(referenceImageBase64);
      parts.push({ inlineData: { mimeType, data } });
      parts.push({ text: "Reference Scene Image (above) for strict layout consistency." });
  }
  parts.push({ text: prompt });

  try {
    console.log(`Generating scene image using ${effectiveModel}`);
    const response = await ai.models.generateContent({
      model: effectiveModel,
      contents: { parts },
      config: buildImageModelConfig(effectiveModel, "16:9", true)
    });
    
    const candidate = response.candidates?.[0];
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
        throw new Error(`Scene Generation blocked. Reason: ${candidate.finishReason}`);
    }

    const respParts = candidate?.content?.parts;
    if (respParts) {
      for (const part of respParts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("No image found");
  } catch (e: any) {
      const msg = e.message || "";
      console.error("Scene Generation Error:", e);
      if (msg.includes("Requested entity was not found")) {
          throw new Error("BILLING_ERROR: 关联的 Google Cloud 项目失效。请在设置页重新关联。");
      }
      throw e; 
  }
};

export const generateScenePlotIdeas = async (
  context: string,
  eggPremise: string,
  sceneTitle: string,
  sceneDescription?: string,
  characterContexts?: string,
  roughPlot?: string 
): Promise<string[]> => {
    // Legacy wrapper
    return await generateDetailedScript(context, sceneTitle, [], roughPlot || "", 1, 4, []);
};

// New Type for specific shot references
export interface ShotReference {
    frameIndex: number; // 0-3
    charName: string;
    imageUrl: string;
}

/**
 * 2. STORYBOARD FRAME DRAWER (4K Professional - Single Image 2x2 Grid)
 * Generates a single high-quality frame containing 4 sub-frames.
 */
export const generateStoryboardFrameImage = async (
    context: string,
    frameDescription: string,
    shotType: string,
    sceneImageUrl?: string,
    characters?: { name: string, imageUrl: string }[],
    previousSequenceImageUrl?: string, // New: for cross-group consistency
    shotReferences?: ShotReference[] // New: Specific references per frame
): Promise<string> => {
    
    let config: ImageGenConfig;
    try {
      config = getImageConfig();
    } catch (e) { throw e; }

    const effectiveModel = config.modelId || 'gemini-3-pro-image-preview';

    const parts: any[] = [];
    
    // 1. Construct Prompt Content (Text First for clear instruction)
    const prompt = `
      Role: Storyboard Drawing Master (分镜绘制大师).
      Task: Create a Single Image containing a 2x2 Grid of 4 Storyboard Frames.
      
      [LAYOUT STRICT RULES - MANDATORY]
      1.  **Grid**: Exactly 2 rows and 2 columns (Total 4 frames).
      2.  **Ratio**: Each individual frame inside the grid MUST be **16:9 aspect ratio**.
      3.  **Sizing**: All 4 frames must be of identical size and alignment.
      4.  **NO OVERLAYS**: **ABSOLUTELY NO FRAME NUMBERS (1, 2, 3, 4) OR META-LABELS.** Do not add UI overlays like "1", "2" in corners.
      5.  **DIEGETIC TEXT ALLOWED**: Text that naturally exists inside the scene (e.g., street signs, phone screens, newspapers) IS ALLOWED and should be rendered realistically if described.
      
      [VISUAL STYLE & CONSISTENCY]
      - **Photorealistic Cinematic Movie Stills**. High fidelity, 4K detail.
      - **Consistent Lighting**: Ensure the lighting matches the mood of the plot across all 4 frames.
      - **Film Grain**: Slight film grain for cinematic texture.
      ${previousSequenceImageUrl ? `- **CROSS-SEQUENCE CONTINUITY**: You MUST match the lighting, color temperature, brightness, contrast, and atmosphere of the [PREVIOUS SEQUENCE IMAGE]. The new shots must look like they belong to the EXACT same film scene.` : ''}
      
      [SPATIAL & LOGICAL CONTINUITY - CRITICAL]
      1. **180-DEGREE RULE (AXIS MATCHING)**: If Character A is on the LEFT and Character B is on the RIGHT, they MUST stay on those sides across all 4 frames unless a movement is explicitly described. Do not flip the camera axis randomly.
      2. **ENVIRONMENT PERMANENCE**: Background landmarks (doors, windows, light sources) must stay in fixed positions relative to the camera angle. Do not hallucinate different backgrounds for the same location.
      3. **Flow**: The action must flow logically from Frame 1 to Frame 4.

      [CONSISTENCY INSTRUCTIONS - HIGH PRIORITY]
      - **SCENE**: You MUST use the exact environment shown in [SCENE MASTER REFERENCE] if provided.
      - **CHARACTERS**: You MUST use the exact actors/characters shown in [CHARACTER REFERENCE] or [SPECIFIC REFERENCE]. 
      - **PIXEL-PERFECT CHARACTER MATCH**: The character reference images provided are the ABSOLUTE TRUTH. Do not "re-imagine" their face or clothes. Copy their exact facial features, hairstyle, and clothing details into the storyboard frames. 
      
      [PLOT / ACTION TO DEPICT]
      ${context}
      
      [SOURCE OF TRUTH - 4 SHOT DESCRIPTIONS]
      The following is the FINAL approved script for these 4 shots. 
      Strictly visualize ONLY these 4 specific frame descriptions in order.
      If a specific character name is mentioned in the [Characters: ...] tag, you MUST include them.
      If a shot is labeled [Environment Only], do NOT draw any characters.
      
      ${frameDescription}
      
      Output: A single image file.
    `;

    parts.push({ text: prompt });

    // 2. Attach Reference Images
    if (sceneImageUrl) {
        const { mimeType, data } = extractDataUri(sceneImageUrl);
        parts.push({ text: "[SCENE MASTER REFERENCE] Use this exact location/style." });
        parts.push({ inlineData: { mimeType, data } });
    }

    if (previousSequenceImageUrl) {
        const { mimeType, data } = extractDataUri(previousSequenceImageUrl);
        parts.push({ text: "[PREVIOUS SEQUENCE IMAGE] STRICTLY MATCH LIGHTING AND COLOR GRADING of this image." });
        parts.push({ inlineData: { mimeType, data } });
    }

    // 3. Attach Character References (General/Base)
    if (characters && characters.length > 0) {
        for (const char of characters) {
            const { mimeType, data } = extractDataUri(char.imageUrl);
            parts.push({ text: `[CHARACTER REFERENCE: ${char.name}] LOOK AT THIS IMAGE. Use this exact face, hair, and clothing.` });
            parts.push({ inlineData: { mimeType, data } });
        }
    }
    
    // 4. Attach Specific Shot References (NEW)
    if (shotReferences && shotReferences.length > 0) {
        for (const ref of shotReferences) {
            const { mimeType, data } = extractDataUri(ref.imageUrl);
            parts.push({ text: `[SPECIFIC REFERENCE FOR FRAME ${ref.frameIndex + 1} - Character: ${ref.charName}] Use this image as the reference for this specific shot.` });
            parts.push({ inlineData: { mimeType, data } });
        }
    }

    const geminiOptions: any = { apiKey: config.apiKey };
    if (config.baseUrl) geminiOptions.baseUrl = config.baseUrl;
    const ai = new GoogleGenAI(geminiOptions);
    
    // Use dynamic config based on model
    const gemConfig = buildImageModelConfig(effectiveModel, "16:9", true);

    try {
        console.log(`Generating Storyboard Grid using ${effectiveModel}`);
        const response = await ai.models.generateContent({
            model: effectiveModel,
            contents: { parts },
            config: gemConfig
        });

        const candidate = response.candidates?.[0];
        
        // --- SAFETY BLOCK CHECK ---
        if (candidate?.finishReason === 'SAFETY') {
             throw new Error("生成失败：由于安全策略拦截 (Safety Block)，模型拒绝生成该图像。请尝试修改 Prompt 或去除敏感词。");
        }
        if (candidate?.finishReason === 'RECITATION') {
             throw new Error("生成失败：模型检测到潜在的版权内容 (Recitation)。");
        }
        if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
             throw new Error(`生成中断：FinishReason: ${candidate.finishReason}`);
        }

        const respParts = candidate?.content?.parts;
        if (respParts) {
            for (const part of respParts) {
                if (part.inlineData && part.inlineData.data) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
        throw new Error("No image data found in response");
    } catch (e: any) {
        const msg = e.message || JSON.stringify(e);
        console.error("Storyboard Generation Error:", e);
        if (msg.includes("403") || msg.includes("PERMISSION_DENIED")) {
            throw new Error(`API 权限错误: 模型 ${effectiveModel} 需要 Billing 或 API 权限。尝试切换模型?`);
        }
        if (msg.includes("429")) {
            throw new Error("API 请求过多 (429): 请稍后再试。");
        }
        if (msg.includes("Requested entity was not found")) {
            throw new Error("BILLING_ERROR: 关联的 Google Cloud 项目失效。请在设置页重新关联。");
        }
        throw e;
    }
};

/**
 * Refines a specific panel in the 2x2 Storyboard Grid.
 * Keeps all other panels strictly identical.
 */
export const refineStoryboardPanel = async (
    originalImageUrl: string,
    panelNumber: number,
    refineInstruction: string
): Promise<string> => {
    let config: ImageGenConfig;
    try {
      config = getImageConfig();
    } catch (e) { throw e; }

    const effectiveModel = config.modelId || 'gemini-3-pro-image-preview';

    const parts: any[] = [];

    // Attach Original Image
    const { mimeType, data } = extractDataUri(originalImageUrl);
    parts.push({ inlineData: { mimeType, data } });
    parts.push({ text: "SOURCE IMAGE: Current 4-frame storyboard sheet." });

    const prompt = `
      Role: Professional Storyboard Editor.
      Task: EDIT the attached Storyboard Grid Image.
      
      [EDIT TARGET]
      Frame Number: ${panelNumber} (in the 2x2 grid, numbered 1-4 reading left-to-right).
      
      [MODIFICATION INSTRUCTION]
      ${refineInstruction}
      
      [STRICT CONSTRAINT - CRITICAL]
      1. **DO NOT CHANGE** any other frames (The other 3 frames MUST remain PIXEL-PERFECT IDENTICAL to the Source Image).
      2. **ONLY** redraw/modify the content of Frame #${panelNumber}.
      3. Maintain the exact same 2x2 grid layout, aspect ratios.
      4. **NO OVERLAYS**: Do not add frame numbers. Keep the image clean of UI elements.
      5. **SCENE TEXT**: In-world text is allowed if part of the scene.
      6. Ensure the art style of the modified frame matches the rest of the sheet perfectly.
      
      Output: The updated image file.
    `;

    parts.push({ text: prompt });

    const geminiOptions: any = { apiKey: config.apiKey };
    if (config.baseUrl) geminiOptions.baseUrl = config.baseUrl;
    const ai = new GoogleGenAI(geminiOptions);
    
    const gemConfig = buildImageModelConfig(effectiveModel, "16:9", true);

    try {
        console.log(`Refining panel ${panelNumber} using ${effectiveModel}`);
        const response = await ai.models.generateContent({
            model: effectiveModel,
            contents: { parts },
            config: gemConfig
        });

        const candidate = response.candidates?.[0];
        if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
             throw new Error(`Refinement Blocked: ${candidate.finishReason}`);
        }

        const respParts = candidate?.content?.parts;
        if (respParts) {
            for (const part of respParts) {
                if (part.inlineData && part.inlineData.data) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
        throw new Error("No refined image data found");
    } catch (e: any) {
        if (e.message && e.message.includes("Requested entity was not found")) {
            throw new Error("BILLING_ERROR: 关联的 Google Cloud 项目失效。请在设置页重新关联。");
        }
        throw e;
    }
};

export const expandUniverseSetting = async (name: string, type: string, currentDesc: string, tags: string[]) => {
    const prompt = `
      Universe: ${name} (${type})
      Tags: ${tags.join(', ')}
      Current Draft: ${currentDesc}
      
      Task: Expand this into a detailed world-building description (Geography, History, Atmosphere).
      Language: Simplified Chinese.
      Limit: 150 words.
    `;
    return await generateTextViaProvider("World Builder", prompt, false);
};

export const expandUniverseRules = async (name: string, type: string, currentRules: string, tags: string[]) => {
    const prompt = `
      Universe: ${name} (${type})
      Tags: ${tags.join(', ')}
      Current Rules: ${currentRules}
      
      Task: Refine and expand these into 3-5 concrete, interesting physical or magical laws.
      Language: Simplified Chinese.
    `;
    return await generateTextViaProvider("System Designer", prompt, false);
};

/**
 * New Service: Generate 4 distinct shot descriptions, respecting locked shots and themes.
 */
export const generateDetailedScript = async (
  context: string,
  sceneTitle: string,
  existingShots: { id: number; content: string; theme?: string; isLocked: boolean }[],
  roughPlot: string,
  startIndex: number = 1,
  count: number = 4,
  availableCharacters: Character[] = [] // New: Pass available characters for detailed prompt context
): Promise<string[]> => {
  const systemPrompt = "You are a World-Class Film Director and Cinematographer. Your task is to create a visually stunning, artistic, and character-driven 4-shot storyboard script.";
  
  // Build Character Bible with STRICT VISUAL DESCRIPTION PRIORITY
  const characterBible = availableCharacters.length > 0 ? availableCharacters.map(c => `
    [CHARACTER: ${c.roots.name}]
    - Gender/Age: ${c.roots.gender}, ${c.roots.age}
    - VISUAL DESCRIPTION (OFFICIAL LOOK): ${c.visualDescription || c.shape.appearance + ' ' + c.shape.fashion}
    - PERSONALITY/BEHAVIOR: ${c.soul.corePersonality}. Habits: ${c.shape.habits}. Body Language: ${c.shape.bodyLanguage}
  `).join('\n') : "No specific character profiles provided.";

  // Build formatted locked list
  const lockedList = existingShots
      .filter(s => s.isLocked)
      .map(s => `Shot ${s.id}: ${s.content}`)
      .join('\n');
      
  const previousShotsContext = existingShots.filter(s => s.id < startIndex && s.content).map(s => `Shot ${s.id}: ${s.content}`).join('\n');

  // Build current range themes
  const currentRange = existingShots.slice(startIndex - 1, startIndex + count - 1);
  const themeContext = currentRange.map(s => `Shot ${s.id} Theme: ${s.theme || 'Open/Auto'}`).join('\n');

  const userPrompt = `
    Context: ${context}
    Scene Title: ${sceneTitle}
    
    ${roughPlot ? `Rough Concept: ${roughPlot}` : ''}
    
    [CHARACTER BIBLE - STRICT VISUAL & BEHAVIORAL CONSISTENCY]
    ${characterBible}
    
    [PREVIOUS SHOTS CONTEXT]
    ${previousShotsContext || "None (Start of scene)"}
    
    [LOCKED SHOTS - DO NOT CHANGE THESE]
    ${lockedList || "None"}

    [SHOT THEMES / TITLES]
    The user has specified the following themes for the new shots. You MUST use them as the core subject of the shot.
    ${themeContext}
    
    [DIRECTOR'S INSTRUCTIONS - HIGH PRIORITY]
    1. **Cinematic Vision**: Use professional camera terminology (e.g., "Low Angle", "Dutch Tilt", "Rack Focus", "Silhouette", "Chiaroscuro lighting"). Create strong compositions.
    2. **Vivid Acting**: Describe micro-expressions and specific body language that reflects the character's internal state and PERSONALITY defined in the Bible. Avoid generic descriptions.
    3. **Artistic & Atmospheric**: Use sensory language to describe lighting, texture, and mood.
    4. **Logic**: Ensure logical flow from previous shots.
    
    [TASK]
    Generate or fill in the script for exactly ${count} shots, starting from Shot #${startIndex} to Shot #${startIndex + count - 1}.
    - If a shot is LOCKED, return it exactly as is (or with very minor polish if it improves flow).
    - If a shot is empty or unlocked, generate a new vivid visual description based on the THEME provided (if any).
    - [CRITICAL] You MUST explicitly describe the BODY POSE and ACTION of the main characters in every shot (e.g., "Sitting hunched", "Standing tall with crossed arms", "Running frantically").
    - [CRITICAL] If a character from the Bible is used, ensure their visual description (clothes, hair) matches the Bible.
    - [CRITICAL] Character behavior/expressions must align with their "Personality" in the Bible.
    - Language: Simplified Chinese.
    
    Return ONLY a JSON array of ${count} strings.
    Example: ["${startIndex}. [Extreme Close-up] [Tension] The detective's eyes narrow...", "${startIndex + 1}. [Wide Shot] [Isolation] A lone figure stands...", ...]
  `;

  const schema: Schema = {
    type: Type.ARRAY,
    items: { type: Type.STRING }
  };

  try {
    const rawText = await generateTextViaProvider(systemPrompt, userPrompt, true, schema);
    let arr = cleanAndParseJSON(rawText);
    
    // Safety check for object wrapper vs array
    if (!Array.isArray(arr) && typeof arr === 'object' && arr !== null) {
        if (Array.isArray(arr.shots)) arr = arr.shots;
        else if (Array.isArray(arr.frames)) arr = arr.frames;
        else arr = Object.values(arr);
    }

    if (!Array.isArray(arr)) {
        console.warn("API returned non-array JSON", arr);
        return Array(count).fill("AI 生成格式错误，请重试。");
    }

    // Pad or Slice
    while(arr.length < count) arr.push(`[Detail] Continue action...`);
    if (arr.length > count) arr = arr.slice(0, count);
    
    // Ensure strings
    return arr.map((item: any) => typeof item === 'string' ? item : JSON.stringify(item));

  } catch (e) {
    console.error("Script Gen Error", e);
    throw e;
  }
};

/**
 * New Service: Polish a single shot's text
 */
export const polishShotText = async (
    context: string,
    currentContent: string
): Promise<string> => {
    const systemPrompt = "You are an Award-Winning Screenwriter and Director. Polish this shot description to be a masterpiece of visual storytelling.";
    const userPrompt = `
      Context: ${context}
      
      Current Shot Description: "${currentContent}"
      
      Task: Rewrite this single shot description to be more cinematic, visual, and impactful. 
      - Use professional film terminology (Lighting, Camera Angle, Composition).
      - Enhance character acting (Micro-expressions, specific body language).
      - Ensure the description feels like a frame from a high-budget movie.
      - Keep it concise (under 60 words).
      - Language: Simplified Chinese.
      - Return ONLY the raw string of the new description.
    `;
    
    return await generateTextViaProvider(systemPrompt, userPrompt, false);
};
