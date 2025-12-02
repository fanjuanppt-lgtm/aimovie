
// User Authentication Types
export interface UserProfile {
  id: string;
  username: string;
  password?: string; // In a real app, never store plain text passwords. This is for local simulation only.
  avatar?: string;
  createdAt: Date;
}

// Universe Types
export enum UniverseType {
  REAL = '真实宇宙',
  ADAPTED = '改编宇宙',
  FICTIONAL = '架空宇宙',
  VIRTUAL = '虚构宇宙'
}

export interface Universe {
  id: string;
  ownerId: string; // New: Data Isolation
  name: string;
  type: UniverseType;
  description: string;
  rules: string;
  coverImage?: string; 
  orderIndex?: number;
  createdAt: Date;
}

// New Hierarchy Level: Story Egg
export interface StoryEgg {
  id: string;
  ownerId: string; // New: Data Isolation
  universeId: string;
  title: string;
  premise: string; 
  fullScript?: string; // New: Full TXT script content
  createdAt: Date;
}

// Character Types
export interface CharacterRoots {
  name: string;
  age: string;
  gender: string;
  origin: string; 
  familyBackground: string;
  socialClass: string;
  educationJob: string;
}

export interface CharacterShape {
  appearance: string; 
  fashion: string; 
  bodyLanguage: string; 
  habits: string; 
}

export interface CharacterSoul {
  corePersonality: string; 
  moralCompass: string; 
  desires: string; 
  fears: string; 
  innerConflict: string; 
}

export interface CharacterImage {
  id: string;
  url: string;
  prompt: string;
  angle: string; 
  deletedAt?: string; 
}

export interface ShotDef {
    id: string; 
    label: string; 
    prompt: string; 
}

export interface Character {
  id: string;
  ownerId: string; // New: Data Isolation
  universeId: string;
  storyEggId: string; 
  role?: string; // New: Persist the character's dramatic role (Protagonist, Antagonist, etc.)
  roots: CharacterRoots;
  shape: CharacterShape;
  soul: CharacterSoul;
  summary: string; 
  visualDescription?: string; 
  images: CharacterImage[];
  coverImageId?: string; // New: User selected cover image ID
  customShots?: ShotDef[]; 
  shotDefs?: ShotDef[]; 
  deletedAt?: string; 
  orderIndex?: number; 
}

// Scene Types
export interface SceneImage {
  id?: string; 
  type: string; 
  url: string;
}

export interface Scene {
  id: string;
  ownerId: string; // New: Data Isolation
  universeId: string;
  storyEggId: string;
  name: string;
  description: string;
  images: SceneImage[];
  shotDefs?: ShotDef[]; 
  createdAt: Date;
}

// Storyboard Types

export interface FrameCharacter {
  characterId: string;
  priority: number; 
}

export interface StoryboardFrame {
  id: string;
  groupIndex: number; 
  shotType: string; 
  cameraMovement: string; 
  description: string; 
  facialExpression?: string; 
  characters?: FrameCharacter[]; 
  
  sketchUrl?: string; 
  imageUrl?: string; 
  imageState?: 'preview' | 'final'; 
  imageHistory?: string[]; 
  
  deletedImageUrl?: string; 
  masterSliceUrl?: string; 
}

export interface ScriptShot {
  id: number;
  theme: string; 
  content: string;
  isLocked: boolean;
  characterIds?: string[];
  selectedImageIds?: Record<string, string>; 
  isPolishing?: boolean; 
}

export interface Storyboard {
  id: string;
  ownerId: string; // New: Data Isolation
  universeId: string;
  storyEggId: string;
  sceneId?: string; 
  title: string; 
  sceneSummary?: string; 
  participatingCharacterIds?: string[]; 
  plotSummary: string; 
  shots?: ScriptShot[]; 
  frames: StoryboardFrame[];
  
  masterSheetUrl?: string; 
  orderIndex?: number; 
  createdAt: Date;
}

export interface GenerationState {
  isLoading: boolean;
  status: string; 
  error?: string;
}
