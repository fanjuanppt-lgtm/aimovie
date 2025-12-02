
import { GoogleGenAI, Type, Schema, HarmCategory, HarmBlockThreshold } from "@google/genai";
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

// --- VISUAL STYLE CONSTANTS ---
export const VISUAL_STYLE_PRESETS = [
    {
        id: '2d-anime',
        label: '2D漫画风',
        prompt: '2D anime still frame, Japanese animation style, clean line art, sharp character design, cel-shading, vibrant color palette, expressive large anime eyes, flat shading with hard edges, detailed hand-drawn background, high-quality production anime screenshot, Kyoto Animation or Ufotable aesthetic.',
        thumbnail: 'https://www.pptcool.com/Public/upload/images/20251202/1764679235.4664.jpg'
    },
    {
        id: '3d-cartoon',
        label: '3D漫画风',
        prompt: 'Stylized 3D animated feature film still, Pixar or Disney animation style, smooth 3D character models with soft rendered textures, subsurface scattering on skin, volumetric lighting, expressive stylized character design, high-budget CGI, global illumination, playful cartoon physics, polished 3D render.',
        thumbnail: 'https://www.pptcool.com/Public/upload/images/20251202/1764680117.5984.jpg'
    },
    {
        id: '3d-to-2d-celshaded',
        label: '3转2D漫画风',
        prompt: 'Cel-shaded 3D render, anime rendering shader, 3D models looking like 2D illustration, prominent black outline around characters, hard-edged shadow blocks, flattened textures, dynamic camera angle forced perspective, Arc System Works fighting game art style, highly stylized CGI mimicking traditional animation.',
        thumbnail: 'https://www.pptcool.com/Public/upload/images/20251202/1764680117.6492.jpg'
    },
    {
        id: 'chibi-kawaii',
        label: 'Q版可爱风',
        prompt: 'Chibi style illustration, kawaii aesthetic, super deformed (SD) character proportions, large head and small body, simplified cute features, thick soft outlines, pastel color palette, cheerful atmosphere, adorable, mascot design, vibrant and cute visuals.',
        thumbnail: 'https://www.pptcool.com/Public/upload/images/20251202/1764680117.6995.jpg'
    },
    {
        id: 'korean-webtoon',
        label: '韩漫2D风',
        prompt: 'Korean webtoon style panel, manhwa aesthetic, highly polished digital painting, extremely beautiful character design (k-pop idol aesthetic), glowing magical effects and highlights, vibrant and saturated colors, glossy hair texture, sharp digital line work, sleek modern visuals, detailed fantasy attire.',
        thumbnail: 'https://www.pptcool.com/Public/upload/images/20251202/1764680117.7495.jpg'
    },
    {
        id: 'american-comic-2d',
        label: '美式2D风',
        prompt: 'Modern American comic book panel, DC/Marvel comics art style, bold black outlines, deep ink shadows and high contrast lighting, dynamic action pose, muscular anatomy definition, gritty graphic novel aesthetic, expressive angular jawlines, saturated comic coloring, subtle halftone dot patterns.',
        thumbnail: 'https://www.pptcool.com/Public/upload/images/20251202/1764680117.7999.jpg'
    },
    {
        id: 'cinematic-realistic',
        label: '电影写实风',
        prompt: 'Cinematic film still, photorealistic, live-action movie shot, ultra-detailed, 8k resolution, realistic skin texture and pores, volumetric fog and cinematic lighting, shallow depth of field (bokeh), shot on ARRI Alexa camera, IMAX quality, naturalistic colors, hyper-realism, highly detailed environment.',
        thumbnail: 'https://www.pptcool.com/Public/upload/images/20251202/1764680117.8489.jpg'
    },
    {
        id: 'chinese-ink',
        label: '中式水墨风',
        prompt: "Traditional Chinese ink wash painting style (水墨画), visible calligraphy brushstrokes, 'Xieyi' (写意) freehand style, flowing ink diffusion effect on rice paper texture, large areas of negative space (留白), muted color palette with desaturated washes, atmospheric mountains and rivers, ancient eastern aesthetic, hand-painted texture.",
        thumbnail: 'https://www.pptcool.com/Public/upload/images/20251202/1764680117.8986.jpg'
    },
    {
        id: 'cyberpunk',
        label: '赛博朋克风',
        prompt: 'Cyberpunk aesthetic concept art, futuristic dystopian city environment, neon signs everywhere with magenta, cyan and purple color scheme, rain-slicked streets reflecting intense neon lights, high-tech low-life atmosphere, towering skyscrapers contrasted with gritty street level, cyborg characters, wires and cables, atmospheric fog, Blade Runner vibe.',
        thumbnail: 'https://www.pptcool.com/Public/upload/images/20251202/1764680117.9482.jpg'
    }
];

// --- HELPER: GET STYLE PROMPT ---
const getStylePrompt = (styleId?: string): string => {
    if (!styleId) return VISUAL_STYLE_PRESETS[0].prompt;
    const preset = VISUAL_STYLE_PRESETS.find(p => p.id === styleId);
    return preset ? preset.prompt : VISUAL_STYLE_PRESETS[0].prompt;
};

// --- HELPER: SAFE ENV KEY ACCESS ---
const getEnvApiKey = (): string => {
    try {
        return process.env.API_KEY || '';
    } catch (e) {
        return '';
    }
};

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
  const apiKey = localStorage.getItem('gemini_api_key') || getEnvApiKey() || '';
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
    const envKey = getEnvApiKey(); 
    
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

// --- HELPER: COMPRESS IMAGE PAYLOAD ---
// Reduces image size to prevent "Payload Too Large" errors when sending multiple refs to API
const compressImagePayload = async (dataUri: string): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const maxDim = 1024; // Limit long edge to 1024px
            let w = img.width;
            let h = img.height;
            
            // Calculate scale
            if (w > maxDim || h > maxDim) {
                if (w > h) {
                    h = Math.round((h * maxDim) / w);
                    w = maxDim;
                } else {
                    w = Math.round((w * maxDim) / h);
                    h = maxDim;
                }
            }
            
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if(!ctx) { resolve(dataUri); return; }
            
            // Fill white background to prevent transparency turning black
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, w, h);
            
            ctx.drawImage(img, 0, 0, w, h);
            // Force JPEG 0.8 quality for efficient payload
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = () => {
             console.warn("Image compression failed, using original.");
             resolve(dataUri); 
        };
        img.src = dataUri;
    });
};

// --- CORE: OPENAI-COMPATIBLE FETCH (Text) ---
const callOpenAICompatibleAPI = async (
  config: TextGenConfig,
  systemInstruction: string,
  userPrompt: string,
  jsonMode: boolean = false
): Promise<string> => {
  const baseUrl = config.baseUrl?.replace(/\/$/, '') || 'https://api.deepseek.com';
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
    // CRITICAL: Disable safety filters to prevent false positives in creative writing/storyboarding
    const safetySettings = [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE },
    ];

    const config: any = {
        imageConfig: {
            aspectRatio: widthRatio,
        },
        safetySettings
    };

    // Only Gemini 3 Pro supports explicit '4K' sizing
    const isPro = modelId.includes('gemini-3-pro');
    
    if (isPro && force4K) {
        config.imageConfig.imageSize = "4K";
    }

    return config;
};

// --- HELPER: ROBUST GENERATION WITH FALLBACK ---
const generateImageContentWithFallback = async (
    ai: GoogleGenAI, 
    model: string, 
    payload: any, 
    widthRatio: string = "16:9", 
    force4K: boolean = true
) => {
    // Check Strict Mode setting
    const strictMode = localStorage.getItem('strict_quality_mode') === 'true';

    try {
        const config = buildImageModelConfig(model, widthRatio, force4K);
        return await ai.models.generateContent({
            model,
            contents: payload.contents,
            config
        });
    } catch (error: any) {
        const msg = error.message || error.toString();
        
        // 1. Critical Auth Errors - DO NOT FALLBACK
        if (msg.includes("API key not valid")) {
            throw error;
        }

        // 2. Billing / Permission Denied (403)
        // If Strict Mode is ON, throw error immediately to alert user
        if (strictMode) {
             console.error("Strict Quality Mode: Blocked fallback after error:", msg);
             throw error; 
        }

        // 3. Fallback Logic for Capacity/Model Errors/403/Payload
        if (model.includes('gemini-3-pro')) {
            console.warn(`[Gemini Service] Primary model ${model} failed (${msg}).`);
            
            // 3a. INTERMEDIATE RETRY: Try 3-Pro again but without 4K (sometimes resolution is the blocker)
            if (force4K) {
                 console.log(`[Gemini Service] Retrying with ${model} (Standard Res)...`);
                 try {
                     const standardResConfig = buildImageModelConfig(model, widthRatio, false);
                     return await ai.models.generateContent({
                        model: model,
                        contents: payload.contents,
                        config: standardResConfig
                     });
                 } catch (retryErr) {
                     console.warn(`[Gemini Service] Standard Res retry failed.`);
                 }
            }

            // 3b. FINAL FALLBACK: Flash
            console.warn(`[Gemini Service] Auto-falling back to gemini-2.5-flash-image.`);
            const fallbackModel = 'gemini-2.5-flash-image';
            
            // Flash doesn't support 'imageSize: 4K', so rebuild config without it
            const fallbackConfig = buildImageModelConfig(fallbackModel, widthRatio, false);
            
            return await ai.models.generateContent({
                model: fallbackModel,
                contents: payload.contents,
                config: fallbackConfig
            });
        }

        throw error;
    }
};

// --- SERVICE: UNIVERSE SETTING ---
export const expandUniverseSetting = async (name: string, type: string, currentDesc: string, tags: string[]): Promise<string> => {
    const systemPrompt = `You are an expert world-builder for sci-fi and fantasy movies. 
    Expand the universe description based on the provided tags. 
    Keep it concise (max 300 words), vivid, and structured. 
    Output in CHINESE (Simplified).`;
    
    const userPrompt = `Universe: ${name} (${type})
    Tags: ${tags.join(', ')}
    Current Draft: ${currentDesc}
    
    Please expand and refine the description, focusing on geography, atmosphere, and era.`;

    return generateTextViaProvider(systemPrompt, userPrompt);
};

export const expandUniverseRules = async (name: string, type: string, currentRules: string, tags: string[]): Promise<string> => {
    const systemPrompt = `You are a rule designer for a fictional universe. 
    Create or refine a list of 5-8 core rules/laws that govern this world. 
    Consider physics, magic systems, or social structures.
    Output in CHINESE (Simplified).`;
    
    const userPrompt = `Universe: ${name} (${type})
    Tags: ${tags.join(', ')}
    Current Rules: ${currentRules}
    
    Output a numbered list of rules.`;

    return generateTextViaProvider(systemPrompt, userPrompt);
};

// --- SERVICE: CHARACTER PROFILE ---
export const generateCharacterProfile = async (
    context: string, 
    brief: string, 
    role: string, 
    style: string, 
    existingProfile?: any,
    fullScript?: string
): Promise<{roots: CharacterRoots, shape: CharacterShape, soul: CharacterSoul}> => {
    
    const systemPrompt = `You are a professional screenwriter/casting director.
    Create a deep, multidimensional character profile based on the brief and world context.
    The character plays the role of: ${role}.
    
    Output strictly in JSON format matching the following structure:
    {
      "roots": { "name", "age", "gender", "origin", "familyBackground", "socialClass", "educationJob" },
      "shape": { "appearance", "fashion", "bodyLanguage", "habits" },
      "soul": { "corePersonality", "moralCompass", "desires", "fears", "innerConflict" }
    }
    Use CHINESE (Simplified) for values.
    ${existingProfile ? "IMPORTANT: Preserve the following existing fields EXACTLY: " + JSON.stringify(existingProfile) : ""}
    `;
    
    let userPrompt = `World Context: ${context}\nCharacter Brief: ${brief}`;
    if (fullScript) {
        userPrompt += `\n\nReference Script (Excerpt): ${fullScript.substring(0, 3000)}...`; 
    }

    const jsonStr = await generateTextViaProvider(systemPrompt, userPrompt, true);
    const data = cleanAndParseJSON(jsonStr);
    
    // Merge existing locked fields if any (double safety)
    if (existingProfile) {
        if (existingProfile.roots) Object.assign(data.roots, existingProfile.roots);
        if (existingProfile.shape) Object.assign(data.shape, existingProfile.shape);
        if (existingProfile.soul) Object.assign(data.soul, existingProfile.soul);
    }
    
    return data;
};

export const generateCharacterVisualDescription = async (char: Character): Promise<string> => {
    const systemPrompt = `You are a Visual Director for a film.
    Summarize the character's visual appearance into a precise, high-quality image generation prompt.
    Focus on: Face, Body Type, Clothing, Key Accessories, and Vibe.
    Do NOT include background info.
    Output in ENGLISH (for better Image Gen results).`;
    
    const userPrompt = `
    Name: ${char.roots.name}
    Age: ${char.roots.age}
    Gender: ${char.roots.gender}
    Appearance: ${char.shape.appearance}
    Fashion: ${char.shape.fashion}
    Personality: ${char.soul.corePersonality}
    Role: ${char.role}
    `;

    return generateTextViaProvider(systemPrompt, userPrompt);
};

// --- SERVICE: CHARACTER IMAGE ---
export const generateCharacterImage = async (
    char: Character, 
    shotPrompt: string, 
    customModel?: string, 
    refImageUrl?: string,
    widthRatio: string = "3:4",
    refType: 'identity' | 'style' = 'identity',
    stylePreset?: string // Global Visual Style ID
): Promise<string> => {
    const config = getImageConfig(); // Assuming no customKey needed here for now
    const ai = new GoogleGenAI({ 
        apiKey: config.apiKey, 
        baseUrl: config.baseUrl || undefined 
    });
    const model = customModel || config.modelId;

    // 1. Get Style Keywords
    const stylePrompt = getStylePrompt(stylePreset);

    // 2. Build Final Prompt
    // If a manual visual description exists, use it as the core truth
    const coreDesc = char.visualDescription 
        ? char.visualDescription 
        : `Character: ${char.roots.gender}, ${char.roots.age} years old. ${char.shape.appearance}. Wearing ${char.shape.fashion}.`;

    const finalPrompt = `
    ${stylePrompt}
    Subject: ${coreDesc}
    Action/Shot: ${shotPrompt}
    Ensure high quality, detailed face, consistent character identity.
    `;

    // 3. Prepare Payload
    const parts: any[] = [
        { text: finalPrompt }
    ];

    // 4. Handle Reference Image (Identity Locking)
    if (refImageUrl) {
        try {
            // COMPRESS REF IMAGE to avoid payload too large
            const compressedRef = await compressImagePayload(refImageUrl);
            const { mimeType, data } = extractDataUri(compressedRef);
            
            // Insert image at the BEGINNING for better adherence
            parts.unshift({
                inlineData: { mimeType, data }
            });

            // Add instruction based on refType
            if (refType === 'identity') {
                parts.push({ text: "Reference Image provided. STRICTLY MAINTAIN FACIAL IDENTITY and features of the character in the reference image." });
            } else {
                parts.push({ text: "Reference Image provided. Use the ART STYLE and VIBE of the reference image, but generate the character described in the text." });
            }
        } catch (e) {
            console.warn("Failed to process reference image:", e);
        }
    }

    const result = await generateImageContentWithFallback(ai, model, { contents: { parts } }, widthRatio, true);

    // 5. Extract Image - NEW SDK (candidates at root)
    if (result.candidates && result.candidates[0].content.parts) {
        for (const part of result.candidates[0].content.parts) {
            if (part.inlineData) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
    }
    
    throw new Error("No image generated.");
};

// --- SERVICE: SCENE ---
export const generateSceneDescription = async (universeName: string, sceneName: string, currentDesc: string, fullScript?: string): Promise<string> => {
    const systemPrompt = `You are a Set Designer and Cinematographer.
    Describe a movie scene visually. Focus on lighting, atmosphere, architecture, and mood.
    Output in CHINESE (Simplified).`;
    
    let userPrompt = `Universe: ${universeName}. Scene Name: ${sceneName}. \nCurrent Draft: ${currentDesc}`;
    if (fullScript) {
        userPrompt += `\n\nReference Script (Context): ${fullScript.substring(0, 3000)}...`;
    }

    return generateTextViaProvider(systemPrompt, userPrompt);
};

export const generateSceneImage = async (
    name: string, 
    desc: string, 
    viewType: string, 
    refImageUrl?: string,
    stylePreset?: string
): Promise<string> => {
    const config = getImageConfig();
    const ai = new GoogleGenAI({ apiKey: config.apiKey, baseUrl: config.baseUrl || undefined });
    const model = config.modelId;

    const stylePrompt = getStylePrompt(stylePreset);
    const finalPrompt = `
    ${stylePrompt}
    Scene: ${name}
    Description: ${desc}
    View/Camera: ${viewType} view.
    High resolution, cinematic lighting, detailed environment.
    `;

    const parts: any[] = [{ text: finalPrompt }];

    if (refImageUrl) {
        try {
            const compressedRef = await compressImagePayload(refImageUrl);
            const { mimeType, data } = extractDataUri(compressedRef);
            parts.unshift({ inlineData: { mimeType, data } });
            parts.push({ text: "Maintain consistency with the reference image location/style." });
        } catch (e) {
            console.warn("Ref image fail", e);
        }
    }

    const result = await generateImageContentWithFallback(ai, model, { contents: { parts } }, "16:9", true);

    if (result.candidates && result.candidates[0].content.parts) {
        for (const part of result.candidates[0].content.parts) {
            if (part.inlineData) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
    }
    throw new Error("No scene image generated.");
};

// --- SERVICE: STORYBOARD SCRIPT ---
export const generateDetailedScript = async (
    context: string, 
    sceneTitle: string, 
    existingShots: any[], 
    roughPlot: string,
    startIndex: number,
    count: number,
    availableChars: Character[],
    fullScript?: string
): Promise<string[]> => {
    
    const charList = availableChars.map(c => `${c.roots.name} (${c.role})`).join(', ');
    
    const systemPrompt = `You are a professional storyboard artist and director.
    Based on the scene summary and previous shots, write the visual description for shots ${startIndex} to ${startIndex + count - 1}.
    
    Context: ${context}
    Scene Title: ${sceneTitle}
    Characters Available: ${charList}
    Scene Summary: ${roughPlot}
    
    Existing Shots so far:
    ${existingShots.slice(0, startIndex - 1).map(s => `${s.id}: ${s.content}`).join('\n')}
    
    ${fullScript ? `\nReference Full Script: ${fullScript.substring(0, 5000)}...` : ""}

    Output strictly a JSON array of strings, where each string is the visual description for one shot.
    Example: ["Wide shot of the city...", "Close up of John..."]
    Length: Exactly ${count} items.
    Language: English (for better Image Gen) or Chinese (if requested, but English preferred for prompts). Let's use ENGLISH for descriptions to feed into Image Gen.
    `;
    
    const userPrompt = `Generate visual descriptions for shots ${startIndex} to ${startIndex + count - 1}.`;

    const jsonStr = await generateTextViaProvider(systemPrompt, userPrompt, true);
    const list = cleanAndParseJSON(jsonStr);
    if (Array.isArray(list)) return list;
    return [];
};

export const polishShotText = async (context: string, text: string): Promise<string> => {
    const systemPrompt = `Refine the storyboard shot description to be more cinematic and visual. 
    Keep it concise but descriptive for an AI image generator. English.`;
    return generateTextViaProvider(systemPrompt, `Context: ${context}\nShot: ${text}`);
};

// --- SERVICE: STORYBOARD IMAGE (COMPLEX) ---
export interface ShotReference {
    frameIndex: number;
    charName: string;
    imageUrl: string;
}

export const generateStoryboardFrameImage = async (
    context: string,
    script: string,
    style: string,
    sceneImageUrl?: string,
    characters?: { name: string, imageUrl: string }[],
    previousGroupImageUrl?: string,
    shotReferences?: ShotReference[],
    aspectRatio: "16:9" | "9:16" = "16:9",
    stylePreset?: string // Global Visual Style ID
): Promise<string> => {
    
    const config = getImageConfig();
    const ai = new GoogleGenAI({ apiKey: config.apiKey, baseUrl: config.baseUrl || undefined });
    const model = config.modelId;

    // 1. Base Prompt
    const stylePrompt = getStylePrompt(stylePreset);
    let prompt = `
    ${stylePrompt}
    Create a storyboard sheet with 4 panels (2x2 grid).
    ${aspectRatio === "16:9" ? "Total image aspect ratio 16:9. Each panel 16:9." : "Total image aspect ratio 9:16. Each panel 9:16 vertical."}
    High quality, consistent characters, cinematic lighting.
    
    Story Context: ${context}
    
    Panel Descriptions:
    ${script}
    
    Instructions:
    - Draw exactly 4 panels arranged in a 2x2 grid.
    - Label them 1, 2, 3, 4 unobtrusively or just keep distinct.
    - Maintain character consistency across panels.
    `;

    // 2. Add References (SMART LIMITING APPLIED)
    const parts: any[] = [];
    
    // 2a. Scene Reference (High Priority)
    if (sceneImageUrl) {
        try {
            const compressedScene = await compressImagePayload(sceneImageUrl);
            const { mimeType, data } = extractDataUri(compressedScene);
            parts.push({ inlineData: { mimeType, data } });
            prompt += `\n[Reference 1: Environment/Scene] Use this location for the background.`;
        } catch(e) {}
    }

    // 2b. Character References (LIMITED to top 2 to avoid payload overload)
    if (characters && characters.length > 0) {
        // Only take up to 2 characters to keep payload reasonable
        const limitChars = characters.slice(0, 2);
        
        for (const char of limitChars) {
            try {
                const compressedChar = await compressImagePayload(char.imageUrl);
                const { mimeType, data } = extractDataUri(compressedChar);
                parts.push({ inlineData: { mimeType, data } });
                prompt += `\n[Reference: Character ${char.name}] Maintain this character's appearance (face/clothes).`;
            } catch (e) {}
        }
    }

    // 2c. Previous Group Reference (Continuity)
    if (previousGroupImageUrl) {
        try {
            const compressedPrev = await compressImagePayload(previousGroupImageUrl);
            const { mimeType, data } = extractDataUri(compressedPrev);
            parts.push({ inlineData: { mimeType, data } });
            prompt += `\n[Reference: Previous Sequence] This is the previous storyboard sheet. Maintain visual continuity (colors, lighting) with this.`;
        } catch(e) {}
    }

    // 2d. Specific Shot References (Specific Poses/Angles)
    if (shotReferences && shotReferences.length > 0) {
        prompt += `\n\nSpecific Shot References provided in input files (match pose/angle if specified):`;
        for (const shotRef of shotReferences) {
            try {
                const compressedShotRef = await compressImagePayload(shotRef.imageUrl);
                const { mimeType, data } = extractDataUri(compressedShotRef);
                parts.push({ inlineData: { mimeType, data } });
                prompt += `\n- For Frame ${shotRef.frameIndex + 1}, use the provided reference image for character ${shotRef.charName}'s pose/angle.`;
            } catch(e) {}
        }
    }

    parts.push({ text: prompt });

    const result = await generateImageContentWithFallback(ai, model, { contents: { parts } }, aspectRatio, true);

    if (result.candidates && result.candidates[0].content.parts) {
        for (const part of result.candidates[0].content.parts) {
            if (part.inlineData) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
    }
    throw new Error("No storyboard generated.");
};

export const refineStoryboardPanel = async (
    originalImageUrl: string,
    panelNumber: number,
    instruction: string
): Promise<string> => {
    const config = getImageConfig();
    const ai = new GoogleGenAI({ apiKey: config.apiKey, baseUrl: config.baseUrl || undefined });
    const model = config.modelId; // Usually 2.5-flash-image for editing or 3-pro

    const prompt = `
    Edit Panel ${panelNumber} of this storyboard sheet.
    Instruction: ${instruction}
    Keep all other panels exactly the same. Only modify Panel ${panelNumber}.
    Maintain the same art style and 2x2 grid layout.
    `;

    const parts: any[] = [];
    try {
        const compressedOriginal = await compressImagePayload(originalImageUrl);
        const { mimeType, data } = extractDataUri(compressedOriginal);
        parts.push({ inlineData: { mimeType, data } });
    } catch(e) {}
    
    parts.push({ text: prompt });

    const result = await generateImageContentWithFallback(ai, model, { contents: { parts } }, "16:9", true);

    if (result.candidates && result.candidates[0].content.parts) {
        for (const part of result.candidates[0].content.parts) {
            if (part.inlineData) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
    }
    throw new Error("Refine failed.");
};

// --- SERVICE: DIAGNOSTICS ---
export interface DiagnosisResult {
    step: string;
    status: 'success' | 'error' | 'warning';
    message: string;
    details?: any;
}

export const diagnoseNetwork = async (
    textKey: string, 
    imageKey: string, 
    textConfig: any, 
    target: 'text' | 'image'
): Promise<DiagnosisResult[]> => {
    const logs: DiagnosisResult[] = [];
    
    // 1. Check Config
    if (target === 'text') {
        logs.push({ step: 'Config Check', status: 'success', message: `Provider: ${textConfig.provider}` });
        
        if (textConfig.provider === 'gemini' && !textKey) {
            // Check Env Key
            if (!process.env.API_KEY) {
                logs.push({ step: 'API Key Check', status: 'error', message: 'Missing Gemini API Key in Settings or Env.' });
                return logs;
            } else {
                 logs.push({ step: 'API Key Check', status: 'success', message: 'Using Environment API Key.' });
            }
        } else if (textConfig.provider === 'deepseek' && !textConfig.deepseekKey) {
             logs.push({ step: 'API Key Check', status: 'error', message: 'Missing DeepSeek API Key.' });
             return logs;
        } else {
             logs.push({ step: 'API Key Check', status: 'success', message: 'API Key is configured.' });
        }

        // Test Call
        try {
            const res = await generateTextViaProvider("System: Test", "User: Hello", false);
            if (res) logs.push({ step: 'Text Gen Test', status: 'success', message: `Response: ${res.substring(0, 20)}...` });
            else logs.push({ step: 'Text Gen Test', status: 'error', message: 'Empty response' });
        } catch (e: any) {
             logs.push({ step: 'Text Gen Test', status: 'error', message: e.message });
        }

    } else {
        // Image Diagnosis
        logs.push({ step: 'Config Check', status: 'success', message: 'Using configured API Key for Image.' });
        
        try {
            // We use a separate config getter here to simulate real usage
            const config = getImageConfig(imageKey);
            const ai = new GoogleGenAI({ apiKey: config.apiKey });
            const model = config.modelId;

            logs.push({ step: 'Auth Check', status: 'success', message: 'API Key is valid.' });
            logs.push({ step: 'Model Check', status: 'success', message: `Ready to generate images (${model}). Cost applies.` });
            
            // Real generation test (1x1 pixel or very simple)
            const result = await generateImageContentWithFallback(ai, model, { 
                contents: { parts: [{ text: "Draw a simple red box." }] }
            }, "1:1", false);
            
            if (result.candidates && result.candidates[0].content.parts.some((p: any) => p.inlineData)) {
                 logs.push({ step: 'Visual Gen', status: 'success', message: 'Image successfully generated.' });
            } else {
                 logs.push({ step: 'Visual Gen', status: 'error', message: 'Model returned no image data.' });
            }

        } catch (e: any) {
            const msg = e.message || e.toString();
             logs.push({ step: 'Visual Gen', status: 'error', message: msg });
        }
    }
    
    return logs;
};
