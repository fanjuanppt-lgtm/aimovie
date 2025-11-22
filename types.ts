
// Universe Types
export enum UniverseType {
  REAL = '真实宇宙',
  ADAPTED = '改编宇宙',
  FICTIONAL = '架空宇宙',
  VIRTUAL = '虚构宇宙'
}

export interface Universe {
  id: string;
  name: string;
  type: UniverseType;
  description: string;
  rules: string;
  createdAt: Date;
}

// New Hierarchy Level: Story Egg
export interface StoryEgg {
  id: string;
  universeId: string;
  title: string;
  premise: string; // 一句话故事梗概
  createdAt: Date;
}

// Character Types based on the user's detailed request
export interface CharacterRoots {
  name: string;
  age: string;
  gender: string;
  origin: string; // 国籍/出身
  familyBackground: string;
  socialClass: string;
  educationJob: string;
}

export interface CharacterShape {
  appearance: string; // 外貌特征
  fashion: string; // 着装风格
  bodyLanguage: string; // 肢体语言
  habits: string; // 习惯与癖好
}

export interface CharacterSoul {
  corePersonality: string; // 核心性格
  moralCompass: string; // 道德罗盘
  desires: string; // 欲望与目标
  fears: string; // 恐惧与弱点
  innerConflict: string; // 内在矛盾
}

export interface CharacterImage {
  id: string;
  url: string;
  prompt: string;
  angle: string; // e.g., "Front View", "Side View", "Close up"
}

export interface Character {
  id: string;
  universeId: string;
  storyEggId: string; // Linked to a specific story egg
  roots: CharacterRoots;
  shape: CharacterShape;
  soul: CharacterSoul;
  summary: string; // Short description for prompts
  images: CharacterImage[];
}

// Storyboard Types
export interface StoryboardFrame {
  id: string;
  shotType: string; // e.g., "Close-up", "Wide Shot"
  cameraMovement: string; // e.g., "Pan Left", "Static"
  description: string; // Visual description of the frame
  imageUrl?: string; // Generated image
}

export interface Storyboard {
  id: string;
  universeId: string;
  storyEggId: string;
  title: string; // Scene title
  plotSummary: string; // The input plot
  frames: StoryboardFrame[];
  createdAt: Date;
}

export interface GenerationState {
  isLoading: boolean;
  status: string; // e.g., "Thinking...", "Generating Image 1/4..."
  error?: string;
}