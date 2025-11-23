import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Character, CharacterRoots, CharacterShape, CharacterSoul, StoryboardFrame } from "../types";

// Helper to get a fresh instance of the AI client.
// UPDATED: Now checks LocalStorage first for deployed environments (Vercel),
// then falls back to process.env (Dev environment).
const getAI = () => {
  const localKey = localStorage.getItem('gemini_api_key');
  const envKey = process.env.API_KEY;
  
  const apiKey = localKey || envKey || '';
  
  if (!apiKey) {
    throw new Error("未检测到 API Key。请前往“全局设置”页面配置您的 Gemini API Key。");
  }

  return new GoogleGenAI({ apiKey });
};

/**
 * Generates a full character profile based on a short description and universe context.
 */
export const generateCharacterProfile = async (
  universeContext: string,
  briefDescription: string,
  role: string, // New parameter for Character Role/Archetype
  textModel: string = 'gemini-2.5-flash' // 'gemini-2.5-flash' | 'jimeng-style'
): Promise<{ roots: CharacterRoots; shape: CharacterShape; soul: CharacterSoul }> => {
  
  // Note: For 'jimeng-style', we still use Gemini as the backend engine but with a specific
  // persona and style instruction to mimic the creative writing style of Jimeng/Doubao.
  const model = 'gemini-2.5-flash'; 
  
  let ai;
  try {
    ai = getAI();
  } catch (e) {
    console.error(e);
    throw e;
  }

  let styleInstruction = "";
  if (textModel === 'jimeng-style') {
    styleInstruction = `
      【风格要求 - 重要】：
      请模仿“即梦(Jimeng)”或“豆包”等中文创意写作AI的风格。
      1. 用词要更具“网感”和文学性，避免过于生硬的翻译腔。
      2. 在描写外貌和性格时，使用更细腻、更有画面感的词汇（例如使用比喻、强调氛围）。
      3. 情感描写要更深刻，强调角色的内心戏和矛盾感。
      4. 即使是简单的设定，也要写得像小说人物小传一样吸引人。
    `;
  } else {
    styleInstruction = "保持专业、客观、逻辑严密的影视剧本设定风格。";
  }

  const prompt = `
    作为一个专业的影视编剧AI助手，请根据以下背景和简要描述，为一个角色创建深度的人物小传。
    
    ${styleInstruction}

    宇宙背景: ${universeContext}
    角色剧作定位: ${role} (这一点非常重要，请确保人物设定符合其在故事中的功能)
    角色简述: ${briefDescription}

    请严格按照JSON格式返回，不要包含Markdown格式标记。
    JSON结构必须包含以下三个主要对象：'roots' (核心身份), 'shape' (外在形象), 'soul' (内在性格)。
  `;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      roots: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          age: { type: Type.STRING },
          gender: { type: Type.STRING },
          origin: { type: Type.STRING, description: "国籍、民族、出生地、现居地" },
          familyBackground: { type: Type.STRING, description: "家庭背景，父母关系等" },
          socialClass: { type: Type.STRING, description: "社会阶层与经济状况" },
          educationJob: { type: Type.STRING, description: "教育经历与职业" },
        },
        required: ["name", "age", "gender", "origin", "familyBackground", "socialClass", "educationJob"]
      },
      shape: {
        type: Type.OBJECT,
        properties: {
          appearance: { type: Type.STRING, description: "身高、体型、长相、特征" },
          fashion: { type: Type.STRING, description: "着装风格" },
          bodyLanguage: { type: Type.STRING, description: "肢体语言与口头禅" },
          habits: { type: Type.STRING, description: "日常生活习惯与癖好" },
        },
        required: ["appearance", "fashion", "bodyLanguage", "habits"]
      },
      soul: {
        type: Type.OBJECT,
        properties: {
          corePersonality: { type: Type.STRING, description: "核心性格关键词" },
          moralCompass: { type: Type.STRING, description: "道德观与价值观" },
          desires: { type: Type.STRING, description: "外在目标与内在情感需求" },
          fears: { type: Type.STRING, description: "深层恐惧与致命弱点" },
          innerConflict: { type: Type.STRING, description: "内在矛盾" },
        },
        required: ["corePersonality", "moralCompass", "desires", "fears", "innerConflict"]
      }
    },
    required: ["roots", "shape", "soul"]
  };

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        systemInstruction: "You are an expert scriptwriter assistant specialized in character development."
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    throw new Error("No text returned from model");
  } catch (error) {
    console.error("Error generating character profile:", error);
    throw error;
  }
};

/**
 * Generates a single image for a character based on their profile and a specific angle/action.
 * Now supports custom model selection and reference images.
 */
export const generateCharacterImage = async (
  character: Character,
  angleDescription: string,
  modelName: string = 'gemini-2.5-flash-image',
  referenceImageBase64?: string | null
): Promise<string> => {
  
  let ai;
  try {
    ai = getAI();
  } catch (e) {
    throw e;
  }

  const physicalDescription = `
    Character Name: ${character.roots.name}
    Age: ${character.roots.age}
    Gender: ${character.roots.gender}
    Ethnicity/Origin: ${character.roots.origin}
    
    VISUAL APPEARANCE (CRITICAL - KEEP CONSISTENT):
    ${character.shape.appearance}
    
    OUTFIT / FASHION:
    ${character.shape.fashion}
    
    DISTINGUISHING FEATURES:
    ${character.shape.bodyLanguage}
  `;

  const textPrompt = `
    Cinematic character concept art, high fidelity, 8k resolution.
    
    STRICT CHARACTER CONSISTENCY REQUIRED.
    ${referenceImageBase64 ? 'IMPORTANT: Use the provided reference image as a strong visual guide for the character\'s facial features and style, but adapt it to the description below.' : ''}

    SUBJECT:
    ${physicalDescription}

    SPECIFIC SHOT / ANGLE:
    ${angleDescription}

    ART STYLE:
    Movie still quality, professional lighting, detailed texture, realistic proportions.
  `;

  // Construct parts
  const parts: any[] = [];
  
  // If reference image exists, add it first (multimodal)
  if (referenceImageBase64) {
    // Extract base64 data (remove "data:image/png;base64," prefix if present)
    const base64Data = referenceImageBase64.split(',')[1];
    parts.push({
      inlineData: {
        mimeType: 'image/png', // We'll assume generic png/jpeg compability
        data: base64Data
      }
    });
    parts.push({ text: "Reference Image (above) for character look." });
  }

  parts.push({ text: textPrompt });

  try {
    const config: any = {};
    
    // Nano Banana Pro (Gemini 3 Pro Image) supports imageSize
    if (modelName === 'gemini-3-pro-image-preview') {
        config.imageConfig = {
            imageSize: "1K" // Can be 1K, 2K, 4K
        };
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
      config: config
    });

    const respParts = response.candidates?.[0]?.content?.parts;
    if (respParts) {
      for (const part of respParts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    
    throw new Error("No image data found in response");
  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
};

/**
 * Breaks down a plot scene into a list of storyboard shots.
 */
export const generateStoryboardPlan = async (
  universeContext: string,
  plot: string,
  characterNames: string[]
): Promise<Omit<StoryboardFrame, 'id' | 'imageUrl'>[]> => {
  const model = 'gemini-2.5-flash';
  let ai;
  try {
    ai = getAI();
  } catch (e) {
    throw e;
  }
  
  const prompt = `
    Act as a professional Film Director and Cinematographer.
    
    Universe Context: ${universeContext}
    Characters Involved: ${characterNames.join(', ')}
    Scene Plot: ${plot}

    Break this scene down into 4 to 8 key cinematic storyboard shots. 
    For each shot, specify the Shot Type, Camera Movement, and a detailed Visual Description.
  `;

  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        shotType: { type: Type.STRING, description: "e.g. Close-up, Wide Shot, Over the Shoulder" },
        cameraMovement: { type: Type.STRING, description: "e.g. Static, Pan Left, Zoom In, Tracking" },
        description: { type: Type.STRING, description: "Detailed visual description of the action and composition" },
      },
      required: ["shotType", "cameraMovement", "description"]
    }
  };

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    throw new Error("No storyboard plan returned");
  } catch (error) {
    console.error("Error generating storyboard plan:", error);
    throw error;
  }
};

/**
 * Generates a storyboard frame image based on the shot description and character context.
 */
export const generateStoryboardFrameImage = async (
  frame: Omit<StoryboardFrame, 'imageUrl'>,
  involvedCharacters: Character[]
): Promise<string> => {
  const model = 'gemini-2.5-flash-image';
  let ai;
  try {
    ai = getAI();
  } catch (e) {
    throw e;
  }

  // Compile character visual guide to ensure consistency in the frame
  const characterVisualGuide = involvedCharacters.map(c => `
    [CHARACTER GUIDE for ${c.roots.name}]
    Appearance: ${c.shape.appearance}
    Fashion: ${c.shape.fashion}
  `).join('\n');

  const prompt = `
    Movie Storyboard Frame. High quality digital painting style. Cinematic lighting.
    
    SCENE DESCRIPTION:
    ${frame.description}
    
    SHOT SPECS:
    ${frame.shotType}, ${frame.cameraMovement}

    CHARACTERS IN SCENE (MAINTAIN CONSISTENCY):
    ${characterVisualGuide}

    ART STYLE:
    Professional film storyboard, atmospheric, cinematic composition, aspect ratio 16:9.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    
    throw new Error("No image data found in response");
  } catch (error) {
    console.error("Error generating storyboard frame:", error);
    throw error;
  }
};