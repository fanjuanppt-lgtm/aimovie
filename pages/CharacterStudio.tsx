

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Universe, StoryEgg, Character, CharacterRoots, CharacterShape, CharacterSoul, GenerationState, CharacterImage, ShotDef } from '../types';
import { generateCharacterProfile, generateCharacterImage, generateCharacterVisualDescription } from '../services/geminiService';
import { Wand2, Save, Image as ImageIcon, Loader2, AlertCircle, ArrowLeft, Edit, Settings, Upload, X, Camera, ChevronDown, ChevronUp, Plus, Key, Trash2, CheckCircle, CheckSquare, Square, Zap, RotateCcw, Ban, Lock, Unlock, Play, RefreshCw, ZoomIn, Sparkles, Info, PlusCircle, MoreHorizontal, Star } from 'lucide-react';

interface CharacterStudioProps {
  universes: Universe[];
  storyEggs: StoryEgg[];
  characters: Character[];
  onSave: (c: Character) => Promise<void>;
}

const initialRoots: CharacterRoots = { name: '', age: '', gender: '', origin: '', familyBackground: '', socialClass: '', educationJob: '' };
const initialShape: CharacterShape = { appearance: '', fashion: '', bodyLanguage: '', habits: '' };
const initialSoul: CharacterSoul = { corePersonality: '', moralCompass: '', desires: '', fears: '', innerConflict: '' };

const CHARACTER_ROLES = [
  "主角 (Protagonist) - 故事的核心推动者",
  "反派 (Antagonist) - 与主角对立的阻碍力量",
  "伴侣/爱人 (Love Interest) - 情感线核心人物",
  "导师 (Mentor) - 指引主角成长的智者",
  "盟友/伙伴 (Sidekick) - 协助主角的支持者",
  "变色龙 (Shapeshifter) - 立场不定的神秘人物",
  "门槛守卫 (Threshold Guardian) - 考验主角的障碍",
  "捣蛋鬼 (Trickster) - 制造混乱或幽默的角色",
  "路人/群演 (Extra) - 背景板角色"
];

const TEXT_STYLES = [
  { id: 'gemini-2.5-flash', name: '标准影视剧本风格 (Standard)' },
  { id: 'jimeng-style', name: '即梦/网文创意风格 (Creative)' },
];

// --- STANDARDIZED ANGLES (DEFAULTS) ---
const DEFAULT_SHOTS: ShotDef[] = [
    { id: '01', label: '01 正面全身 (基准)', prompt: '01 FULL BODY SHOT, Front View, Standing Straight, Pure Neutral Background. This is the master reference.' },
    { id: '02', label: '02 侧面脸部', prompt: '02 EXTREME CLOSE UP, FACE ONLY, Side Profile View, Pure Neutral Background. Consistent with reference.' },
    { id: '03', label: '03 侧面半身', prompt: '03 HALF BODY SHOT, Side Profile View, Waist Up, Pure Neutral Background. Consistent with reference.' },
    { id: '04', label: '04 侧面行走', prompt: '04 FULL BODY SHOT, Side Profile View, Walking Pose, Dynamic Motion, Pure Neutral Background. Consistent with reference.' },
    { id: '05', label: '05 背影', prompt: '05 FULL BODY SHOT, Back View, Standing, Facing away from camera, Pure Neutral Background. Consistent with reference.' },
    { id: '06', label: '06 侧卧', prompt: '06 FULL BODY SHOT, Lying on side, Reclining Pose, Pure Neutral Background. Consistent with reference.' },
];

// --- Lockable Helper Components ---

interface LockableProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  isLocked: boolean;
  onToggleLock: () => void;
  placeholder?: string;
  rows?: number;
}

const LockableInput: React.FC<LockableProps> = ({ label, value, onChange, isLocked, onToggleLock, placeholder }) => (
  <div className="relative group">
    <div className="flex justify-between items-end mb-0.5">
        <label className={`block text-[10px] font-bold uppercase transition-colors ${isLocked ? 'text-cinematic-gold' : 'text-slate-500'}`}>
            {label} {isLocked && <span className="ml-1 text-[8px]">(锁)</span>}
        </label>
        <button 
            onClick={onToggleLock}
            className={`text-[10px] p-0.5 rounded transition-colors flex items-center gap-1 ${isLocked ? 'text-cinematic-gold bg-cinematic-gold/10' : 'text-slate-600 hover:text-slate-400'}`}
            title={isLocked ? "点击解锁 (AI 将覆盖此内容)" : "点击锁定 (AI 将保留此内容)"}
        >
            {isLocked ? <Lock size={10} /> : <Unlock size={10} />}
        </button>
    </div>
    <div className="relative">
        <input 
        type="text" 
        value={value} 
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-cinematic-900 border rounded px-2 py-1.5 text-xs text-white outline-none transition-all ${
            isLocked 
            ? 'border-cinematic-gold/50 bg-cinematic-gold/5 focus:border-cinematic-gold' 
            : 'border-cinematic-700 focus:border-cinematic-accent'
        }`}
        />
    </div>
  </div>
);

const LockableTextArea: React.FC<LockableProps> = ({ label, value, onChange, isLocked, onToggleLock, rows = 2 }) => (
  <div className="relative group">
    <div className="flex justify-between items-end mb-0.5">
        <label className={`block text-[10px] font-bold uppercase transition-colors ${isLocked ? 'text-cinematic-gold' : 'text-slate-500'}`}>
            {label} {isLocked && <span className="ml-1 text-[8px]">(锁)</span>}
        </label>
        <button 
            onClick={onToggleLock}
            className={`text-[10px] p-0.5 rounded transition-colors flex items-center gap-1 ${isLocked ? 'text-cinematic-gold bg-cinematic-gold/10' : 'text-slate-600 hover:text-slate-400'}`}
            title={isLocked ? "点击解锁 (AI 将覆盖此内容)" : "点击锁定 (AI 将保留此内容)"}
        >
            {isLocked ? <Lock size={10} /> : <Unlock size={10} />}
        </button>
    </div>
    <textarea 
      value={value} 
      onChange={e => onChange(e.target.value)}
      rows={rows}
      className={`w-full bg-cinematic-900 border rounded px-2 py-1.5 text-xs text-white outline-none resize-none transition-all ${
        isLocked 
        ? 'border-cinematic-gold/50 bg-cinematic-gold/5 focus:border-cinematic-gold' 
        : 'border-cinematic-700 focus:border-cinematic-accent'
      }`}
    />
  </div>
);

export const CharacterStudio: React.FC<CharacterStudioProps> = ({ universes, storyEggs, characters, onSave }) => {
  const navigate = useNavigate();
  const { universeId, eggId, characterId } = useParams<{ universeId: string; eggId: string; characterId?: string }>();
  
  const universe = universes.find(u => u.id === universeId);
  const egg = storyEggs.find(e => e.id === eggId);
  
  const isEditing = !!characterId;
  const loadedRef = useRef<string | null>(null);
  
  const [brief, setBrief] = useState('');
  const [role, setRole] = useState(CHARACTER_ROLES[0]);
  const [roots, setRoots] = useState<CharacterRoots>(initialRoots);
  const [shape, setShape] = useState<CharacterShape>(initialShape);
  const [soul, setSoul] = useState<CharacterSoul>(initialSoul);
  const [visualDesc, setVisualDesc] = useState(''); // New State for detailed visual prompt
  const [generatedImages, setGeneratedImages] = useState<CharacterImage[]>([]);
  
  // New: Cover Image Logic
  const [coverImageId, setCoverImageId] = useState<string | undefined>(undefined);

  // New: Visual Description Collapse State
  const [isVisualDescExpanded, setIsVisualDescExpanded] = useState(false);

  // UNIFIED SHOT STATE (Standard + Custom)
  const [shotDefs, setShotDefs] = useState<ShotDef[]>(DEFAULT_SHOTS);
  
  // Adding New Shot State
  const [isAddingShot, setIsAddingShot] = useState(false);
  const [newShotTitle, setNewShotTitle] = useState('');
  const [newShotPrompt, setNewShotPrompt] = useState('');

  // Editing Shot Def State
  const [editingShotId, setEditingShotId] = useState<string | null>(null);
  const [editShotLabel, setEditShotLabel] = useState('');
  const [editShotPrompt, setEditShotPrompt] = useState('');

  // Single Image Edit/Regen State
  const [editingImage, setEditingImage] = useState<CharacterImage | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [isRegeneratingSingle, setIsRegeneratingSingle] = useState(false);

  const [lockedFields, setLockedFields] = useState<Set<string>>(new Set());

  const toggleLock = (section: string, key: string) => {
      const lockKey = `${section}.${key}`;
      const newSet = new Set(lockedFields);
      if (newSet.has(lockKey)) {
          newSet.delete(lockKey);
      } else {
          newSet.add(lockKey);
      }
      setLockedFields(newSet);
  };

  const isLocked = (section: string, key: string) => lockedFields.has(`${section}.${key}`);
  
  const [activeTab, setActiveTab] = useState<'roots' | 'shape' | 'soul'>('roots');
  
  const [activeStageId, setActiveStageId] = useState<string | null>(null); 
  const [genState, setGenState] = useState<GenerationState>({ isLoading: false, status: '' });
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [refImage, setRefImage] = useState<string | null>(null);
  const directUploadInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);
  const stageUploadRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  
  const [selectedImgIds, setSelectedImgIds] = useState<Set<string>>(new Set());
  const [showTrash, setShowTrash] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  const activeImages = generatedImages.filter(img => !img.deletedAt);
  const trashedImages = generatedImages.filter(img => img.deletedAt);

  const [showTextSettings, setShowTextSettings] = useState(false);
  const [selectedTextStyle, setSelectedTextStyle] = useState(TEXT_STYLES[0].id);

  const checkStage = (label: string) => {
      return activeImages.some(img => img.angle === label);
  };
  
  const hasStage1 = checkStage('01 正面全身 (基准)') || activeImages.some(img => img.angle.startsWith('01'));

  useEffect(() => {
    // IMPORTANT: Reset Reference Image when switching characters to avoid contamination
    setRefImage(null);
    if (refInputRef.current) refInputRef.current.value = '';

    if (isEditing && characterId && characters.length > 0) {
      if (loadedRef.current !== characterId) {
        const existingChar = characters.find(c => c.id === characterId);
        if (existingChar) {
          setRoots(existingChar.roots);
          setShape(existingChar.shape);
          setSoul(existingChar.soul);
          setBrief(existingChar.summary || '');
          setVisualDesc(existingChar.visualDescription || '');
          setGeneratedImages(existingChar.images || []);
          setCoverImageId(existingChar.coverImageId);
          // Load saved role if exists, else default
          if (existingChar.role) {
             setRole(existingChar.role);
          }
          
          if (existingChar.shotDefs && existingChar.shotDefs.length > 0) {
              setShotDefs(existingChar.shotDefs);
          } else {
              const combined = [...DEFAULT_SHOTS];
              if (existingChar.customShots) {
                  combined.push(...existingChar.customShots);
              }
              setShotDefs(combined);
          }

          loadedRef.current = characterId; 
        }
      }
    } else {
       // New Character Mode or Switched to New
       if (loadedRef.current !== 'new') {
           if (egg) setBrief(`故事背景：${egg.premise}。`);
           // CLEAR ALL STATE TO PREVENT CROSS-CONTAMINATION
           setRoots(initialRoots);
           setShape(initialShape);
           setSoul(initialSoul);
           setGeneratedImages([]);
           setVisualDesc('');
           setCoverImageId(undefined);
           setShotDefs(DEFAULT_SHOTS);
           setRefImage(null);
           
           loadedRef.current = 'new';
       }
    }
  }, [isEditing, characterId, characters, egg]);

  const handleAIGenerateProfile = async () => {
    if (!brief.trim()) return alert("请输入简要描述");
    if (!universe || !egg) return;

    setGenState({ isLoading: true, status: `AI 正在研读剧本并构思...` });
    try {
      const context = `
        宇宙类型: ${universe.type}
        宇宙描述: ${universe.description}
        宇宙规则: ${universe.rules}
        当前故事(Story Egg): ${egg.title} - ${egg.premise}
      `;

      const existingProfile: any = {};
      const buildLockedSection = (sectionName: string, data: any) => {
          const sectionData: any = {};
          let hasLocked = false;
          Object.keys(data).forEach(key => {
              if (isLocked(sectionName, key)) {
                  sectionData[key] = data[key as keyof typeof data];
                  hasLocked = true;
              }
          });
          return hasLocked ? sectionData : undefined;
      };

      const lockedRoots = buildLockedSection('roots', roots);
      const lockedShape = buildLockedSection('shape', shape);
      const lockedSoul = buildLockedSection('soul', soul);

      if (lockedRoots) existingProfile.roots = lockedRoots;
      if (lockedShape) existingProfile.shape = lockedShape;
      if (lockedSoul) existingProfile.soul = lockedSoul;

      const profileToPass = Object.keys(existingProfile).length > 0 ? existingProfile : undefined;
      
      const profile = await generateCharacterProfile(context, brief, role, selectedTextStyle, profileToPass, egg.fullScript);
      
      setRoots(profile.roots);
      setShape(profile.shape);
      setSoul(profile.soul);
      setGenState({ isLoading: false, status: '' });
      setShowTextSettings(false); 
    } catch (e) {
      console.error(e);
      setGenState({ isLoading: false, status: '', error: '生成失败，请检查配置。' });
    }
  };

  const handleGenVisualDesc = async () => {
      if (!roots.name) return alert("请先生成或输入角色核心身份信息");
      setIsGeneratingDesc(true);
      try {
          const tempChar: Character = {
              id: 'temp', ownerId: '', universeId: universeId!, storyEggId: eggId!, 
              roots, shape, soul, summary: brief, 
              role: role,
              images: generatedImages // Use currently generated images (if any)
          };
          
          // DO NOT PASS SCRIPT ANYMORE, to avoid distractions. Profile is the law.
          const desc = await generateCharacterVisualDescription(tempChar);
          
          setVisualDesc(desc);
          setIsVisualDescExpanded(true); // Auto expand after generation
      } catch (e: any) {
          alert("AI 描述生成失败: " + e.message);
      } finally {
          setIsGeneratingDesc(false);
      }
  };

  const handleRefImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { 
        alert("建议参考图小于2MB以加快处理速度");
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setRefImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    if (refInputRef.current) refInputRef.current.value = '';
  };

  const autoSaveImages = async (newImages: CharacterImage[], newShotDefs?: ShotDef[]) => {
    if (!isEditing || !characterId) return; 
    
    // Retrieve existing character to preserve orderIndex
    const existingChar = characters.find(c => c.id === characterId);

    const charToSave: Character = {
        id: characterId,
        ownerId: '', 
        universeId: universeId!,
        storyEggId: eggId!, 
        role: role, // Save Role
        roots, shape, soul, summary: brief,
        visualDescription: visualDesc,
        images: newImages,
        coverImageId: coverImageId,
        shotDefs: newShotDefs || shotDefs,
        orderIndex: existingChar?.orderIndex // Preserve orderIndex
    };

    try {
       await onSave(charToSave);
       console.log("Auto-saved");
    } catch (e) {
       console.error("Auto-save failed", e);
    }
  };

  const handleStageImageUpload = (e: React.ChangeEvent<HTMLInputElement>, stageLabel: string) => {
     const file = e.target.files?.[0];
     if (file) {
         const reader = new FileReader();
         reader.onloadend = () => {
             // Remove existing for this label
             const filtered = generatedImages.filter(img => img.angle !== stageLabel);
             
             const newImg: CharacterImage = {
                 id: Date.now().toString(),
                 url: reader.result as string,
                 prompt: 'User Manual Upload',
                 angle: stageLabel
             };
             const updated = [...filtered, newImg];
             setGeneratedImages(updated);
             autoSaveImages(updated);
         };
         reader.readAsDataURL(file);
     }
  };

  const handleDirectImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
       const reader = new FileReader();
       reader.onloadend = () => {
         const newImg: CharacterImage = {
           id: Date.now().toString(),
           url: reader.result as string,
           prompt: '用户手动上传',
           angle: 'Manual Upload'
         };
         const updated = [...generatedImages, newImg];
         setGeneratedImages(updated);
         autoSaveImages(updated);
       };
       reader.readAsDataURL(file);
    }
    if (directUploadInputRef.current) {
      directUploadInputRef.current.value = '';
    }
  };

  const handleAddCustomShot = () => {
      if (!newShotTitle.trim()) return alert("请输入标题");
      
      const newShot: ShotDef = {
          id: Date.now().toString(),
          label: newShotTitle,
          prompt: newShotPrompt || newShotTitle
      };
      
      const updatedShots = [...shotDefs, newShot];
      setShotDefs(updatedShots);
      setIsAddingShot(false);
      setNewShotTitle('');
      setNewShotPrompt('');
      
      if (isEditing) {
          autoSaveImages(generatedImages, updatedShots);
      }
  };

  const handleDeleteShot = (id: string) => {
      if (window.confirm("确定删除这个定妆角度吗？已生成的图片保留，但快捷入口将被移除。")) {
          const updatedShots = shotDefs.filter(s => s.id !== id);
          setShotDefs(updatedShots);
          if (isEditing) {
             autoSaveImages(generatedImages, updatedShots);
          }
      }
  };

  const handleUpdateShotDef = () => {
      if (!editingShotId) return;
      const updatedShots = shotDefs.map(s => 
          s.id === editingShotId 
          ? { ...s, label: editShotLabel, prompt: editShotPrompt } 
          : s
      );
      setShotDefs(updatedShots);
      if (isEditing) autoSaveImages(generatedImages, updatedShots);
      setEditingShotId(null);
  };

  const startEditingShot = (shot: ShotDef) => {
      setEditingShotId(shot.id);
      setEditShotLabel(shot.label);
      setEditShotPrompt(shot.prompt);
  };

  const handleGenerateBatch = async (shot: ShotDef) => {
    if (!roots.name || !shape.appearance) {
      alert("请先完善“核心身份”和“外在形象”部分");
      setActiveTab('roots');
      return;
    }
    
    let currentRefImage = refImage;
    let refType: 'identity' | 'style' = 'identity';

    const isMasterShot = shot.id === '01' || shot.label.startsWith('01');

    // LOGIC FOR SHOT 01 (Master Shot):
    if (isMasterShot) {
        if (!refImage) {
            // If manual ref is NOT provided, try to find PROTAGONIST cover for style consistency
            // But only if current character is NOT the protagonist (or role undefined)
            const isProtagonist = role && role.includes("主角");
            if (!isProtagonist) {
                const protagonist = characters.find(c => c.storyEggId === eggId && c.role && c.role.includes("主角"));
                if (protagonist && protagonist.coverImageId) {
                    const coverImg = protagonist.images.find(img => img.id === protagonist.coverImageId);
                    if (coverImg) {
                        console.log("Using Protagonist Cover as Style Reference for", roots.name);
                        currentRefImage = coverImg.url;
                        refType = 'style'; // CRITICAL: Use style only, do not copy face
                    }
                }
            }
        }
    } 
    // LOGIC FOR SHOTS 02-06 (Angles):
    else {
        // Try to find Shot 01 of THIS character to maintain identity
        const masterShot = activeImages.find(img => img.angle.startsWith('01'));
        if (masterShot) {
            currentRefImage = masterShot.url;
            refType = 'identity';
        } else if (!refImage) {
             // If no master shot and no manual ref, proceed without ref (or warn?)
        }
    }
    
    const tempChar: Character = {
        id: 'temp', ownerId: '', universeId: universeId!, storyEggId: eggId!, // Added ownerId
        roots, shape, soul, summary: brief, 
        visualDescription: visualDesc, 
        images: []
    };

    setActiveStageId(shot.id);

    // Remove old versions of THIS specific shot label
    const currentImages = generatedImages.filter(img => img.angle !== shot.label);

    try {
        const base64 = await generateCharacterImage(
            tempChar, 
            shot.prompt, 
            undefined, 
            currentRefImage, 
            undefined, 
            refType,
            egg?.visualStyle // Pass Global Style
        );
        const newImg: CharacterImage = {
            id: Date.now().toString(),
            url: base64,
            prompt: shot.prompt,
            angle: shot.label 
        };
        const updated = [...currentImages, newImg];
        setGeneratedImages(updated);
        await autoSaveImages(updated);

    } catch (err: any) {
        console.error(err);
        const msg = err.message || '';
        if (msg.includes('Safety') || msg.includes('SAFETY')) {
            alert("生成失败：触发安全拦截 (Safety Block)。\n请尝试修改角色的“外在形象”描述，去除可能敏感的词汇。");
        } else if (msg.includes('BILLING_REQUIRED') || msg.includes('401') || msg.includes('403')) {
            alert(`权限/配额错误：${msg}。\n请前往“全局设置”检查是否配置了正确的 Visual API Key 或关联了付费项目。`);
        } else {
            alert(`生成出错: ${msg}`);
        }
    } finally {
        setActiveStageId(null);
    }
  };
  
  const handleRegenerateSingle = async () => {
    if (!editingImage || !editPrompt.trim()) return;

    setIsRegeneratingSingle(true);
    try {
        let currentRefImage = refImage; 
        const isMasterShot = editingImage.angle.startsWith('01');
        
        if (!isMasterShot) {
             const masterShot = activeImages.find(img => img.angle.startsWith('01'));
             if (masterShot) currentRefImage = masterShot.url;
        } 

        const tempChar: Character = {
            id: 'temp', ownerId: '', universeId: universeId!, storyEggId: eggId!, // Added ownerId
            roots, shape, soul, summary: brief, 
            visualDescription: visualDesc, 
            images: []
        };
        
        // 2. Generate
        const base64 = await generateCharacterImage(
            tempChar, 
            editPrompt, 
            undefined, 
            currentRefImage,
            undefined,
            'identity',
            egg?.visualStyle // Pass Global Style
        );
        
        // 3. Update Image
        const updatedImages = generatedImages.map(img => 
            img.id === editingImage.id 
            ? { ...img, url: base64, prompt: editPrompt } 
            : img
        );
        
        setGeneratedImages(updatedImages);

        // 4. Update Shot Definition (SYNC PROMPT LOGIC)
        const updatedShotDefs = shotDefs.map(s => 
            s.label === editingImage.angle 
            ? { ...s, prompt: editPrompt } 
            : s
        );
        setShotDefs(updatedShotDefs);

        await autoSaveImages(updatedImages, updatedShotDefs);
        setEditingImage(null);

    } catch (e: any) {
        alert(`重绘失败: ${e.message}`);
    } finally {
        setIsRegeneratingSingle(false);
    }
  };

  const handleSetCover = async (e: React.MouseEvent, imgId: string) => {
      e.stopPropagation();
      setCoverImageId(imgId);
      
      // Auto save if editing
      if (isEditing && characterId) {
          const existingChar = characters.find(c => c.id === characterId);
          const charToSave: Character = {
            id: characterId,
            ownerId: '', 
            universeId: universeId!,
            storyEggId: eggId!, 
            role: role, // Save Role
            roots, shape, soul, summary: brief,
            visualDescription: visualDesc,
            images: generatedImages,
            coverImageId: imgId,
            shotDefs: shotDefs,
            orderIndex: existingChar?.orderIndex // Preserve Order
          };
          try {
             await onSave(charToSave);
          } catch(e) { console.error(e); }
      }
  };

  const handleSaveCharacter = async () => {
    if (!roots.name) return alert("至少需要角色姓名");
    if (isSaving) return;

    setIsSaving(true);
    try {
      const idToUse = isEditing && characterId ? characterId : Date.now().toString();
      
      // Try to find existing char to preserve order
      const existingChar = characters.find(c => c.id === idToUse);

      const newChar: Character = {
        id: idToUse, ownerId: '', universeId: universeId!, storyEggId: eggId!, 
        role: role, // Save Role
        roots, shape, soul, summary: brief, 
        visualDescription: visualDesc, 
        images: generatedImages,
        coverImageId: coverImageId, // Save Cover
        shotDefs: shotDefs, 
        customShots: [],
        orderIndex: existingChar?.orderIndex // Preserve orderIndex from existing, or undefined for new
      };
      await onSave(newChar);
      alert(isEditing ? "更新成功！" : "归档成功！");
      navigate(`/universe/${universeId}/egg/${eggId}`); 
    } catch (error) {
      alert("保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleImageSelection = (id: string) => {
    const newSet = new Set(selectedImgIds);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setSelectedImgIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedImgIds.size === activeImages.length) setSelectedImgIds(new Set());
    else setSelectedImgIds(new Set(activeImages.map(img => img.id)));
  };

  const moveToTrash = async (id: string) => {
    const updated = generatedImages.map(img => 
      img.id === id ? { ...img, deletedAt: new Date().toISOString() } : img
    );
    setGeneratedImages(updated);
    if (selectedImgIds.has(id)) {
        const newSet = new Set(selectedImgIds);
        newSet.delete(id);
        setSelectedImgIds(newSet);
    }
    // If deleted image was cover, clear cover
    if (coverImageId === id) setCoverImageId(undefined);

    await autoSaveImages(updated);
  };

  const moveSelectedToTrash = async () => {
    if (selectedImgIds.size === 0) return;
    if (window.confirm(`确认将选中的 ${selectedImgIds.size} 张图片移入回收站吗？`)) {
      const updated = generatedImages.map(img => 
        selectedImgIds.has(img.id) ? { ...img, deletedAt: new Date().toISOString() } : img
      );
      setGeneratedImages(updated);
      setSelectedImgIds(new Set());
      // Clear cover if deleted
      if (coverImageId && selectedImgIds.has(coverImageId)) setCoverImageId(undefined);
      
      await autoSaveImages(updated);
    }
  };

  const keepOnlySelectedImages = async () => {
    if (selectedImgIds.size === 0) return;
    if (window.confirm(`确认只保留选中的 ${selectedImgIds.size} 张图片？其他图片将移入回收站。`)) {
      const updated = generatedImages.map(img => {
        if (selectedImgIds.has(img.id)) return { ...img, deletedAt: undefined };
        else if (!img.deletedAt) return { ...img, deletedAt: new Date().toISOString() };
        return img;
      });
      setGeneratedImages(updated);
      setSelectedImgIds(new Set()); 
      
      if (coverImageId) {
          const isCoverKept = updated.find(img => img.id === coverImageId && !img.deletedAt);
          if (!isCoverKept) setCoverImageId(undefined);
      }

      await autoSaveImages(updated);
    }
  };

  const restoreFromTrash = async (id: string) => {
    const updated = generatedImages.map(img => 
      img.id === id ? { ...img, deletedAt: undefined } : img
    );
    setGeneratedImages(updated);
    await autoSaveImages(updated);
  };

  const permanentDelete = async (id: string) => {
    if (window.confirm("确定要永久粉碎这张图片吗？此操作无法恢复。")) {
       const updated = generatedImages.filter(img => img.id !== id);
       setGeneratedImages(updated);
       await autoSaveImages(updated);
    }
  };

  const emptyTrash = async () => {
     if (window.confirm("确定要清空回收站吗？")) {
         const updated = generatedImages.filter(img => !img.deletedAt);
         setGeneratedImages(updated);
         await autoSaveImages(updated);
         setShowTrash(false);
     }
  };

  if (!universe || !egg) return <div>Loading context...</div>;

  // ... (StageButton component remains the same, omitted for brevity) ...
  const StageButton: React.FC<{ 
    shot: ShotDef;
    isDone: boolean; 
    isDisabled: boolean;
  }> = ({ shot, isDone, isDisabled }) => {
      const isEditingThis = editingShotId === shot.id;

      if (isEditingThis) {
          return (
              <div className="bg-cinematic-800 border border-cinematic-gold rounded-lg p-3 h-full flex flex-col gap-2">
                   <input 
                      value={editShotLabel}
                      onChange={e => setEditShotLabel(e.target.value)}
                      className="bg-cinematic-900 border border-cinematic-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-cinematic-gold"
                      placeholder="Title"
                      autoFocus
                   />
                   <textarea
                      value={editShotPrompt}
                      onChange={e => setEditShotPrompt(e.target.value)}
                      rows={3}
                      className="bg-cinematic-900 border border-cinematic-700 rounded px-2 py-1 text-[10px] text-white outline-none focus:border-cinematic-gold resize-none"
                      placeholder="Prompt"
                   />
                   <div className="flex justify-end gap-2 mt-auto">
                        <button onClick={() => setEditingShotId(null)} className="text-[10px] text-slate-400 hover:text-white px-2 py-1">取消</button>
                        <button onClick={handleUpdateShotDef} className="text-[10px] bg-cinematic-gold text-black font-bold px-3 py-1 rounded hover:bg-amber-400">保存</button>
                   </div>
              </div>
          )
      }

      return (
      <div className={`relative flex items-center justify-between px-3 py-3 rounded-lg border h-full transition-all group/btn ${
           isDisabled
            ? 'bg-slate-800 border-slate-700 opacity-50 cursor-not-allowed'
            : isDone
                ? 'bg-cinematic-800 border-cinematic-600 hover:border-cinematic-gold hover:shadow-lg hover:bg-cinematic-700 cursor-pointer'
                : 'bg-cinematic-800 border-cinematic-500 hover:border-cinematic-gold shadow-lg hover:shadow-black/30 cursor-pointer'
      }`}>
        <button
            onClick={() => handleGenerateBatch(shot)}
            disabled={isDisabled || activeStageId !== null}
            className={`flex flex-1 items-center gap-3 text-left min-w-0 ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            title={isDone ? "点击重新生成 (Regenerate)" : "点击生成"}
        >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                isDisabled ? 'bg-slate-700' : isDone ? 'bg-cinematic-700 text-cinematic-gold' : 'bg-cinematic-gold text-black'
            }`}>
                {activeStageId === shot.id ? <Loader2 className="animate-spin" size={16} /> : isDone ? <RefreshCw size={16} /> : <Play size={16} />} 
            </div>
            
            <div className="flex-1 min-w-0">
                <div className={`text-sm font-bold truncate ${isDone ? 'text-slate-300' : 'text-white'}`}>
                    {shot.label}
                </div>
                {isDone && <div className="text-[10px] text-cinematic-gold mt-0.5">已生成</div>}
                {!isDone && !isDisabled && <div className="text-[10px] text-slate-400 mt-0.5">点击生成</div>}
            </div>
        </button>

        {!isDisabled && (
            <div className="flex items-center ml-2 border-l border-slate-700 pl-2 gap-1 opacity-100 md:opacity-0 md:group-hover/btn:opacity-100 transition-opacity">
                 <button 
                    onClick={() => stageUploadRefs.current[shot.id]?.click()}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                    title="手动上传"
                 >
                     <Upload size={14} />
                 </button>
                 <input 
                    type="file" 
                    className="hidden" 
                    accept="image/*"
                    ref={el => stageUploadRefs.current[shot.id] = el}
                    onChange={(e) => handleStageImageUpload(e, shot.label)}
                 />
                 
                 <div className="relative group/more">
                      <button className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors">
                          <MoreHorizontal size={14} />
                      </button>
                      <div className="absolute right-0 top-full mt-1 bg-cinematic-900 border border-cinematic-700 rounded shadow-xl z-50 hidden group-hover/more:block min-w-[100px]">
                           <button 
                              onClick={() => startEditingShot(shot)}
                              className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-cinematic-800 flex items-center gap-2"
                           >
                               <Edit size={12}/> 编辑卡片
                           </button>
                           <button 
                              onClick={() => handleDeleteShot(shot.id)}
                              className="w-full text-left px-3 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-cinematic-800 flex items-center gap-2"
                           >
                               <Trash2 size={12}/> 删除卡片
                           </button>
                      </div>
                 </div>
            </div>
        )}

        {activeStageId === shot.id && (
            <div className="absolute inset-0 bg-black/20 rounded-lg flex items-center justify-center backdrop-blur-[1px] pointer-events-none">
            </div>
        )}
      </div>
  )};

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto pb-32">
       {/* ... (Previous header UI remains same) ... */}
       <button onClick={() => navigate(`/universe/${universeId}/egg/${eggId}`)} className="flex items-center text-slate-400 hover:text-white mb-4 transition-colors">
        <ArrowLeft size={16} className="mr-1" /> 返回故事蛋
      </button>

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1 flex items-center gap-3">
             {isEditing ? <Edit className="text-cinematic-gold" /> : <Wand2 className="text-cinematic-gold" />}
             {isEditing ? '编辑角色档案' : '角色工坊'}
          </h1>
          <p className="text-sm md:text-base text-slate-400">
            <span className="text-cinematic-gold">{universe.name}</span> / <span className="text-cinematic-accent">{egg.title}</span>
          </p>
        </div>
        <button 
          onClick={handleSaveCharacter}
          disabled={isSaving}
          className={`w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2 rounded-lg font-bold shadow-lg transition-all ${
            isSaving 
            ? 'bg-slate-600 cursor-wait' 
            : 'bg-cinematic-accent hover:bg-blue-600 text-white'
          }`}
        >
          {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} 
          {isSaving ? '归档中...' : (isEditing ? '更新档案' : '保存角色')}
        </button>
      </header>
      
      {/* ... (Compact Text Profile Section remains same) ... */}
      <div className="bg-cinematic-800 p-3 rounded-xl border border-cinematic-700 mb-6 shadow-lg">
        <div className="flex flex-col gap-2 mb-3 bg-cinematic-900/50 p-3 rounded-lg">
           <div className="flex gap-2 flex-col lg:flex-row items-center">
             <div className="lg:w-1/4 w-full">
               <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">剧作定位</label>
               <select 
                 value={role} 
                 onChange={(e) => setRole(e.target.value)}
                 className="w-full bg-cinematic-800 border border-cinematic-700 rounded px-2 py-1.5 text-white text-xs focus:border-cinematic-accent outline-none"
               >
                  {CHARACTER_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
               </select>
             </div>

             <div className="flex-1 w-full">
                <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">人物简介 (AI 参考要素)</label>
                <input
                type="text"
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="简要描述 (例如：眼神忧郁的杀手)..."
                className="w-full bg-cinematic-800 border border-cinematic-700 rounded px-3 py-1.5 text-white text-xs focus:border-cinematic-accent outline-none"
                />
             </div>
             
             <div className="flex gap-2 w-full lg:w-auto self-end pb-0.5">
               <button 
                 onClick={handleAIGenerateProfile}
                 disabled={genState.isLoading}
                 className="flex-1 lg:flex-none px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded font-medium text-xs flex items-center justify-center gap-1 disabled:opacity-50"
               >
                 {genState.isLoading ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14}/>} AI 设定
               </button>
               <button 
                onClick={() => setShowTextSettings(!showTextSettings)}
                className="px-2 py-1.5 text-slate-400 hover:text-white hover:bg-cinematic-700 rounded"
                title="Prompt Config"
               >
                 <Settings size={14} />
               </button>
             </div>
           </div>
           
           {/* Script Context Indicator */}
           {egg.fullScript && (
               <div className="flex items-center gap-2 text-[10px] text-green-500 bg-green-900/10 px-2 py-1 rounded border border-green-900/30 w-fit">
                   <Zap size={10} /> 已注入剧本全稿上下文 (Context Injected)
               </div>
           )}

           {showTextSettings && (
             <div className="flex items-center gap-2 text-xs text-slate-400 px-1">
                 <span>风格:</span>
                 <select 
                   value={selectedTextStyle} 
                   onChange={(e) => setSelectedTextStyle(e.target.value)}
                   className="bg-cinematic-900 border border-cinematic-700 rounded px-2 py-1 text-white outline-none"
                 >
                   {TEXT_STYLES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                 </select>
             </div>
           )}
           {genState.isLoading && (
              <div className="text-xs text-cinematic-accent animate-pulse flex items-center gap-1">
                <Loader2 className="animate-spin" size={10} /> {genState.status}
              </div>
           )}
        </div>

        <div className="flex border-b border-cinematic-700 mb-3 overflow-x-auto whitespace-nowrap pb-0.5 scrollbar-hide">
            {[
              { id: 'roots', label: '1. 核心身份' },
              { id: 'shape', label: '2. 外在形象' },
              { id: 'soul', label: '3. 内在性格' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-1.5 font-bold text-xs transition-colors relative flex-shrink-0 ${
                  activeTab === tab.id ? 'text-white bg-cinematic-700/50 rounded-t-lg border-t border-x border-cinematic-600' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
        </div>

        <div className="animate-in fade-in duration-300">
            {activeTab === 'roots' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <LockableInput label="姓名" value={roots.name} onChange={v => setRoots({...roots, name: v})} isLocked={isLocked('roots', 'name')} onToggleLock={() => toggleLock('roots', 'name')} />
                <LockableInput label="年龄" value={roots.age} onChange={v => setRoots({...roots, age: v})} isLocked={isLocked('roots', 'age')} onToggleLock={() => toggleLock('roots', 'age')} />
                <LockableInput label="性别" value={roots.gender} onChange={v => setRoots({...roots, gender: v})} isLocked={isLocked('roots', 'gender')} onToggleLock={() => toggleLock('roots', 'gender')} />
                <LockableInput label="国籍/出身" value={roots.origin} onChange={v => setRoots({...roots, origin: v})} isLocked={isLocked('roots', 'origin')} onToggleLock={() => toggleLock('roots', 'origin')} />
                <div className="col-span-2"><LockableTextArea label="家庭背景" value={roots.familyBackground} onChange={v => setRoots({...roots, familyBackground: v})} isLocked={isLocked('roots', 'familyBackground')} onToggleLock={() => toggleLock('roots', 'familyBackground')} /></div>
                <div className="col-span-1"><LockableTextArea label="社会阶层" value={roots.socialClass} onChange={v => setRoots({...roots, socialClass: v})} isLocked={isLocked('roots', 'socialClass')} onToggleLock={() => toggleLock('roots', 'socialClass')} /></div>
                <div className="col-span-1"><LockableTextArea label="教育与职业" value={roots.educationJob} onChange={v => setRoots({...roots, educationJob: v})} isLocked={isLocked('roots', 'educationJob')} onToggleLock={() => toggleLock('roots', 'educationJob')} /></div>
              </div>
            )}

            {activeTab === 'shape' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="col-span-1 md:col-span-2"><LockableTextArea label="外貌特征" value={shape.appearance} onChange={v => setShape({...shape, appearance: v})} rows={2} isLocked={isLocked('shape', 'appearance')} onToggleLock={() => toggleLock('shape', 'appearance')} /></div>
                <div className="col-span-1 md:col-span-2"><LockableTextArea label="着装风格" value={shape.fashion} onChange={v => setShape({...shape, fashion: v})} rows={2} isLocked={isLocked('shape', 'fashion')} onToggleLock={() => toggleLock('shape', 'fashion')} /></div>
                <div className="col-span-1 md:col-span-2"><LockableTextArea label="肢体语言" value={shape.bodyLanguage} onChange={v => setShape({...shape, bodyLanguage: v})} rows={1} isLocked={isLocked('shape', 'bodyLanguage')} onToggleLock={() => toggleLock('shape', 'bodyLanguage')} /></div>
                <div className="col-span-1 md:col-span-2"><LockableTextArea label="习惯与癖好" value={shape.habits} onChange={v => setShape({...shape, habits: v})} rows={1} isLocked={isLocked('shape', 'habits')} onToggleLock={() => toggleLock('shape', 'habits')} /></div>
              </div>
            )}

            {activeTab === 'soul' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="col-span-1 md:col-span-2"><LockableInput label="核心性格" value={soul.corePersonality} onChange={v => setSoul({...soul, corePersonality: v})} isLocked={isLocked('soul', 'corePersonality')} onToggleLock={() => toggleLock('soul', 'corePersonality')} /></div>
                <div className="col-span-1 md:col-span-2"><LockableTextArea label="道德罗盘" value={soul.moralCompass} onChange={v => setSoul({...soul, moralCompass: v})} rows={1} isLocked={isLocked('soul', 'moralCompass')} onToggleLock={() => toggleLock('soul', 'moralCompass')} /></div>
                <div className="col-span-1 md:col-span-2"><LockableTextArea label="欲望与目标" value={soul.desires} onChange={v => setSoul({...soul, desires: v})} rows={2} isLocked={isLocked('soul', 'desires')} onToggleLock={() => toggleLock('soul', 'desires')} /></div>
                <div className="col-span-1 md:col-span-2"><LockableTextArea label="恐惧与弱点" value={soul.fears} onChange={v => setSoul({...soul, fears: v})} rows={2} isLocked={isLocked('soul', 'fears')} onToggleLock={() => toggleLock('soul', 'fears')} /></div>
              </div>
            )}
        </div>
      </div>

      {/* ... (Visual Studio Top Section remains same) ... */}
      <div className="bg-cinematic-800/50 rounded-xl p-4 md:p-6 border border-cinematic-700 min-h-[500px] mt-6 relative">
          
             <div className="absolute top-0 left-0 bg-cinematic-gold px-3 py-1 text-black font-bold text-xs rounded-br-lg rounded-tl-lg z-10">
                 4. 影像定妆 (Visual Studio)
             </div>

             {/* Visual Description Section (Collapsible) */}
             <div className="mt-6 mb-4 bg-cinematic-900/50 rounded-lg border border-cinematic-700 overflow-hidden">
                <div 
                    className="p-3 bg-cinematic-800/50 flex justify-between items-center cursor-pointer hover:bg-cinematic-700/50 transition-colors"
                    onClick={() => setIsVisualDescExpanded(!isVisualDescExpanded)}
                >
                    <div className="flex items-center gap-2">
                         <label className="text-xs font-bold text-slate-300 uppercase flex items-center gap-2">
                            <Sparkles size={14} className="text-cinematic-gold"/> AI 定妆描述 (Visual Prompt)
                        </label>
                        {!isVisualDescExpanded && visualDesc && (
                             <span className="text-[10px] text-slate-500 truncate max-w-[200px]"> - {visualDesc}</span>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation(); // Prevent collapse
                                handleGenVisualDesc();
                            }}
                            disabled={isGeneratingDesc}
                            className="text-[10px] flex items-center gap-1 text-cinematic-gold hover:text-amber-300 bg-cinematic-900 px-2 py-1 rounded border border-cinematic-700 hover:border-cinematic-gold/30 transition-colors disabled:opacity-50"
                        >
                            {isGeneratingDesc ? <Loader2 className="animate-spin" size={10}/> : <Sparkles size={10}/>} 重生成 (Profile First)
                        </button>
                        {isVisualDescExpanded ? <ChevronUp size={16} className="text-slate-500"/> : <ChevronDown size={16} className="text-slate-500"/>}
                    </div>
                </div>

                {isVisualDescExpanded && (
                    <div className="p-4 border-t border-cinematic-700 animate-in slide-in-from-top-2">
                         <div className="flex items-center gap-2 mb-2 pb-2 border-b border-cinematic-700/50">
                             <div className="flex items-center gap-2">
                                 {refImage ? (
                                    <div className="flex items-center gap-2 bg-cinematic-800 border border-cinematic-gold px-2 py-1 rounded">
                                       <img src={refImage} className="w-4 h-4 rounded object-cover" alt="Ref" />
                                       <span className="text-[10px] text-cinematic-gold font-bold">Ref ON</span>
                                       <button onClick={() => { setRefImage(null); if(refInputRef.current) refInputRef.current.value = ''; }} className="text-slate-400 hover:text-white"><X size={12}/></button>
                                    </div>
                                  ) : (
                                    <button 
                                       onClick={() => refInputRef.current?.click()}
                                       className="px-2 py-1 bg-cinematic-900 border border-cinematic-700 hover:border-cinematic-gold text-slate-300 hover:text-white rounded text-[10px] font-medium transition-colors flex items-center gap-1"
                                       title="上传临时参考图 (仅影响当前生成，不保存)"
                                    >
                                       <ImageIcon size={12} /> 上传 Ref (辅助AI描述)
                                    </button>
                                  )}
                                  <input type="file" accept="image/*" className="hidden" ref={refInputRef} onChange={handleRefImageUpload} />
                             </div>
                             
                             <div className="h-4 w-px bg-slate-700 mx-2"></div>

                              <input type="file" accept="image/*" className="hidden" ref={directUploadInputRef} onChange={handleDirectImageUpload}/>
                               <button 
                                 onClick={() => directUploadInputRef.current?.click()}
                                 className="px-2 py-1 bg-cinematic-900 border border-cinematic-700 hover:border-cinematic-gold text-slate-300 hover:text-white rounded text-[10px] font-medium flex items-center gap-1"
                               >
                                 <Upload size={12} /> 直接上传成图
                               </button>

                               <button 
                                 onClick={() => setShowTrash(true)}
                                 className="px-2 py-1 bg-cinematic-900 border border-cinematic-700 hover:border-red-500 text-slate-300 hover:text-red-400 rounded text-[10px] font-medium flex items-center gap-1 ml-auto"
                               >
                                 <Trash2 size={12} /> 回收站
                                 {trashedImages.length > 0 && <span className="bg-red-500 text-white text-[8px] px-1 rounded-full">{trashedImages.length}</span>}
                               </button>
                         </div>

                        <textarea
                            value={visualDesc}
                            onChange={(e) => setVisualDesc(e.target.value)}
                            rows={4}
                            className="w-full bg-cinematic-900 border border-cinematic-700 rounded px-3 py-2 text-white outline-none focus:border-cinematic-gold resize-none text-xs leading-relaxed"
                            placeholder="AI 将根据核心身份、外貌和性格自动生成详细的画面描述词 (严格遵守性别和外貌设定)..."
                        />
                        <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1">
                            <Info size={10}/> 此描述将作为所有定妆照生成的基础 Prompt。
                        </div>
                    </div>
                )}
             </div>
             
             {activeImages.length > 0 && (
                 <div className="flex justify-between items-center mb-4 px-2">
                     <button onClick={toggleSelectAll} className="text-xs text-cinematic-accent hover:underline flex items-center gap-1">
                         <CheckSquare size={12} />
                         {selectedImgIds.size === activeImages.length && selectedImgIds.size > 0 ? '取消全选' : '全选所有图片'}
                     </button>
                     <span className="text-xs text-slate-500">
                         已生成 {activeImages.length} 张定妆照
                     </span>
                 </div>
             )}

             {/* STAGE GENERATION BUTTONS */}
             <div className="mb-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {shotDefs.map((shot, idx) => (
                      <StageButton 
                        key={shot.id} 
                        shot={shot}
                        isDone={checkStage(shot.label)} 
                        isDisabled={!hasStage1 && idx > 0} 
                      />
                  ))}
                  {isAddingShot ? (
                      <div className="col-span-1 md:col-span-2 bg-cinematic-800 border border-cinematic-gold rounded-lg p-3 animate-in fade-in">
                          <div className="flex flex-col gap-2">
                              <input 
                                  autoFocus
                                  value={newShotTitle}
                                  onChange={e => setNewShotTitle(e.target.value)}
                                  placeholder="自定义标题"
                                  className="bg-cinematic-900 border border-cinematic-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-cinematic-gold"
                              />
                              <input 
                                  value={newShotPrompt}
                                  onChange={e => setNewShotPrompt(e.target.value)}
                                  placeholder="画面描述Prompt"
                                  className="bg-cinematic-900 border border-cinematic-700 rounded px-2 py-1 text-[10px] text-white outline-none focus:border-cinematic-gold"
                              />
                              <div className="flex justify-end gap-2 mt-1">
                                  <button onClick={() => setIsAddingShot(false)} className="text-[10px] text-slate-400 hover:text-white px-2 py-1">取消</button>
                                  <button onClick={handleAddCustomShot} className="text-[10px] bg-cinematic-gold text-black font-bold px-3 py-1 rounded hover:bg-amber-400">确认添加</button>
                              </div>
                          </div>
                      </div>
                  ) : (
                      <button 
                        onClick={() => setIsAddingShot(true)}
                        className="flex items-center justify-center gap-2 px-3 py-3 rounded-lg border border-dashed border-slate-600 bg-slate-800/30 hover:bg-cinematic-800 hover:border-cinematic-gold hover:text-cinematic-gold text-slate-400 transition-all h-full min-h-[80px]"
                      >
                          <PlusCircle size={18} />
                          <span className="text-xs font-medium">添加新角度</span>
                      </button>
                  )}
             </div>
             
             {/* Images Grid */}
             {activeImages.length === 0 && activeStageId === null ? (
               <div className="text-center py-24 text-slate-500 border-2 border-dashed border-slate-700 rounded-xl bg-slate-800/30">
                 <ImageIcon size={48} className="mx-auto mb-4 opacity-30" />
                 <p>暂无定妆照。</p>
                 <p className="text-sm mt-2">请点击 <strong className="text-cinematic-gold">1. 正面全身 (基准)</strong> 开始生成。</p>
               </div>
             ) : (
               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 mb-24">
                 {/* Sort images by label to keep order */}
                 {activeImages.sort((a,b) => a.angle.localeCompare(b.angle)).map((img) => {
                   const isSelected = selectedImgIds.has(img.id);
                   const isCover = coverImageId === img.id;
                   
                   return (
                   <div 
                      key={img.id} 
                      className={`group relative aspect-[3/4] bg-black rounded-lg overflow-hidden border transition-all ${isCover ? 'border-cinematic-gold ring-2 ring-cinematic-gold' : isSelected ? 'border-cinematic-accent ring-1 ring-cinematic-accent' : 'border-slate-700 hover:border-cinematic-gold'}`}
                      onClick={() => toggleImageSelection(img.id)}
                   >
                     <img src={img.url} alt={img.prompt} className="w-full h-full object-cover" />
                     
                     {/* COVER INDICATOR */}
                     {isCover && (
                         <div className="absolute top-2 right-2 z-20 bg-cinematic-gold text-black p-1 rounded-full shadow-lg">
                             <Star size={12} fill="black" />
                         </div>
                     )}

                     <div className="absolute top-2 left-2 z-20">
                        {isSelected 
                          ? <CheckCircle className="text-cinematic-accent fill-black bg-black rounded-full" size={20} />
                          : <div className="w-5 h-5 md:w-6 md:h-6 rounded-full border-2 border-white/5 bg-black/30 hover:bg-black/50 hover:border-white transition-colors" />
                        }
                     </div>
                     
                     {/* Overlay Actions */}
                     <div className="absolute top-2 right-8 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setViewingImage(img.url);
                                }}
                                className="p-1.5 bg-black/60 hover:bg-cinematic-gold hover:text-black rounded-full text-white/80 transition-colors"
                                title="放大查看"
                            >
                                <ZoomIn size={14} />
                            </button>

                           <button 
                               onClick={(e) => handleSetCover(e, img.id)}
                               className={`p-1.5 rounded-full backdrop-blur transition-colors ${isCover ? 'bg-cinematic-gold text-black' : 'bg-black/60 text-white hover:text-cinematic-gold'}`}
                               title={isCover ? "当前封面" : "设为人物封面"}
                           >
                               <Star size={14} fill={isCover ? "black" : "none"} />
                           </button>

                           <button 
                               onClick={(e) => {
                                   e.stopPropagation();
                                   setEditingImage(img);
                                   setEditPrompt(img.prompt);
                               }}
                               className="p-1.5 bg-black/60 hover:bg-cinematic-gold hover:text-black rounded-full text-white/80 transition-colors"
                               title="编辑提示词并重绘"
                           >
                               <Edit size={14} />
                           </button>
                     </div>

                     <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2 pt-6">
                       <p className="text-[10px] md:text-xs text-white font-bold truncate">{img.angle}</p>
                     </div>
                   </div>
                 )})}
                 
                 {activeStageId !== null && (
                    <div className="aspect-[3/4] bg-slate-800/50 animate-pulse rounded-lg flex flex-col items-center justify-center border border-slate-700/50">
                        <Loader2 className="animate-spin text-cinematic-gold mb-2" />
                        <span className="text-xs text-slate-500">Generating...</span>
                    </div>
                 )}
               </div>
             )}

             {/* Single Image Edit Modal, Trash Modal, Lightbox etc remain the same */}
             {/* ... (Existing Modals) ... */}
             {/* Note: In full implementation, ensure all closing tags match. For brevity, I assume standard modal code from original file is preserved here. */}
             
             {/* Image Editing Modal */}
             {editingImage && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-cinematic-900 border border-cinematic-gold rounded-xl w-full max-w-2xl shadow-2xl flex flex-col">
                        <div className="p-4 border-b border-cinematic-700 bg-cinematic-800/50 rounded-t-xl flex justify-between items-center">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Wand2 className="text-cinematic-gold" size={20} />
                                精修重绘: {editingImage.angle}
                            </h3>
                            <button onClick={() => setEditingImage(null)} disabled={isRegeneratingSingle} className="text-slate-400 hover:text-white"><X size={20}/></button>
                        </div>
                        
                        <div className="p-6 flex flex-col md:flex-row gap-6">
                             {/* Left: Preview */}
                             <div className="w-full md:w-1/3 flex flex-col gap-2">
                                 <span className="text-xs font-bold text-slate-500 uppercase">当前图像</span>
                                 <div className="aspect-[3/4] bg-black rounded-lg overflow-hidden border border-cinematic-700">
                                     <img src={editingImage.url} className="w-full h-full object-cover opacity-80" />
                                 </div>
                             </div>

                             {/* Right: Prompt Edit */}
                             <div className="flex-1 flex flex-col gap-2">
                                 <span className="text-xs font-bold text-slate-500 uppercase">提示词 (Prompt)</span>
                                 <textarea 
                                    value={editPrompt}
                                    onChange={e => setEditPrompt(e.target.value)}
                                    className="flex-1 bg-cinematic-800 border border-cinematic-700 rounded-lg p-3 text-white text-sm focus:border-cinematic-gold outline-none resize-none min-h-[150px]"
                                    placeholder="输入新的画面描述..."
                                 />
                                 <div className="text-[10px] text-cinematic-gold bg-cinematic-900/50 p-2 rounded border border-cinematic-700">
                                    <Info size={10} className="inline mr-1"/>
                                    重绘成功后，此提示词将自动同步保存到对应的【{editingImage.angle}】卡片中。
                                 </div>
                             </div>
                        </div>

                        <div className="p-4 border-t border-cinematic-700 bg-cinematic-800/50 rounded-b-xl flex justify-end gap-3">
                             <button 
                                onClick={() => setEditingImage(null)}
                                disabled={isRegeneratingSingle}
                                className="px-4 py-2 text-slate-400 hover:text-white"
                             >
                                取消
                             </button>
                             <button 
                                onClick={handleRegenerateSingle}
                                disabled={isRegeneratingSingle || !editPrompt.trim()}
                                className="px-6 py-2 bg-cinematic-accent hover:bg-blue-600 text-white font-bold rounded-lg flex items-center gap-2 disabled:opacity-50"
                             >
                                {isRegeneratingSingle ? <Loader2 className="animate-spin" size={16}/> : <RefreshCw size={16}/>}
                                立即重绘并保存 Prompt
                             </button>
                        </div>
                    </div>
                </div>
             )}

             {/* Recycle Bin Modal */}
             {showTrash && (
               <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in p-4">
                 <div className="bg-cinematic-900 border border-cinematic-700 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
                    <div className="p-4 border-b border-cinematic-700 flex justify-between items-center bg-cinematic-800/50 rounded-t-xl">
                       <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                         <Trash2 className="text-red-400" /> 回收站 ({trashedImages.length})
                       </h3>
                       <div className="flex gap-2">
                          {trashedImages.length > 0 && (
                            <button onClick={emptyTrash} className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs rounded border border-red-900/50 transition-colors">
                               一键清空
                            </button>
                          )}
                          <button onClick={() => setShowTrash(false)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white"><X size={20} /></button>
                       </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-cinematic-900">
                      {trashedImages.length === 0 ? (
                        <div className="h-48 flex flex-col items-center justify-center text-slate-600">
                           <Trash2 size={48} className="mb-4 opacity-20" />
                           <p>回收站是空的。</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                           {trashedImages.map(img => (
                             <div key={img.id} className="relative aspect-[3/4] bg-black rounded-lg overflow-hidden border border-red-900/30 group">
                                <img src={img.url} className="w-full h-full object-cover opacity-60 grayscale" alt="Deleted" />
                                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity p-2">
                                   <button 
                                     onClick={() => restoreFromTrash(img.id)}
                                     className="w-full py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded flex items-center justify-center gap-1"
                                   >
                                     <RotateCcw size={12} /> 还原
                                   </button>
                                   <button 
                                     onClick={() => permanentDelete(img.id)}
                                     className="w-full py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded flex items-center justify-center gap-1"
                                   >
                                     <Ban size={12} /> 粉碎
                                   </button>
                                </div>
                             </div>
                           ))}
                        </div>
                      )}
                    </div>
                 </div>
               </div>
             )}
             
             {/* 4K Lightbox Viewer */}
             {viewingImage && (
                <div 
                   className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
                   onClick={() => setViewingImage(null)}
                >
                    <img 
                        src={viewingImage} 
                        className="max-w-full max-h-full object-contain shadow-2xl rounded-sm"
                        alt="Full Screen"
                        onClick={(e) => e.stopPropagation()} 
                    />
                    <button 
                       className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white"
                       onClick={() => setViewingImage(null)}
                    >
                        <X size={24} />
                    </button>
                </div>
             )}

             {selectedImgIds.size > 0 && (
                <div className="fixed bottom-4 md:bottom-8 left-1/2 transform -translate-x-1/2 bg-cinematic-800 border border-cinematic-gold text-white px-4 py-2 md:px-6 md:py-3 rounded-full shadow-2xl z-50 flex items-center gap-3 md:gap-6 animate-in slide-in-from-bottom-4 w-[90%] md:w-auto justify-between md:justify-start">
                   <div className="text-xs md:text-sm font-bold flex items-center gap-2 whitespace-nowrap">
                      <CheckCircle size={16} className="text-cinematic-gold" />
                      <span className="hidden md:inline">已选择</span> <span className="text-cinematic-gold">{selectedImgIds.size}</span> 张
                   </div>
                   
                   <div className="h-6 w-px bg-slate-600 hidden md:block" />
                   
                   <button 
                     onClick={moveSelectedToTrash}
                     className="text-xs md:text-sm font-medium hover:text-red-400 flex items-center gap-1 md:gap-2 transition-colors whitespace-nowrap"
                   >
                      <Trash2 size={14} /> <span className="hidden md:inline">移入</span>回收站
                   </button>
                   
                   <div className="h-6 w-px bg-slate-600 hidden md:block" />

                   <button 
                     onClick={keepOnlySelectedImages}
                     className="text-xs md:text-sm font-medium hover:text-cinematic-gold flex items-center gap-1 md:gap-2 transition-colors whitespace-nowrap"
                   >
                      <CheckSquare size={14} /> 仅保留<span className="hidden md:inline">选中</span>
                   </button>

                   <button 
                     onClick={() => setSelectedImgIds(new Set())}
                     className="ml-2 text-slate-500 hover:text-white"
                   >
                     <X size={16} />
                   </button>
                </div>
             )}
      </div>
    </div>
  );
};