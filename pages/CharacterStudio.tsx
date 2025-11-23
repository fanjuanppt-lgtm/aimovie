import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Universe, StoryEgg, Character, CharacterRoots, CharacterShape, CharacterSoul, GenerationState, CharacterImage } from '../types';
import { generateCharacterProfile, generateCharacterImage } from '../services/geminiService';
import { Wand2, Save, Image as ImageIcon, Loader2, AlertCircle, ArrowLeft, Edit, Settings, Upload, X, Camera, ChevronDown, ChevronUp, Plus, Key } from 'lucide-react';

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

// Available Image Models
const IMAGE_MODELS = [
  { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image (快速/标准)' },
  { id: 'gemini-3-pro-image-preview', name: 'Nano Banana Pro (Gemini 3.0 Pro/高画质)' },
];

// Available Text Models
const TEXT_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Google Gemini 2.5 (默认/通用)' },
  { id: 'jimeng-style', name: '即梦 Jimeng (创意写作/网文风)' },
];

export const CharacterStudio: React.FC<CharacterStudioProps> = ({ universes, storyEggs, characters, onSave }) => {
  const navigate = useNavigate();
  const { universeId, eggId, characterId } = useParams<{ universeId: string; eggId: string; characterId?: string }>();
  
  const universe = universes.find(u => u.id === universeId);
  const egg = storyEggs.find(e => e.id === eggId);
  
  // Editing Mode Check
  const isEditing = !!characterId;
  
  const [brief, setBrief] = useState('');
  const [role, setRole] = useState(CHARACTER_ROLES[0]); // New State for Role
  const [roots, setRoots] = useState<CharacterRoots>(initialRoots);
  const [shape, setShape] = useState<CharacterShape>(initialShape);
  const [soul, setSoul] = useState<CharacterSoul>(initialSoul);
  const [generatedImages, setGeneratedImages] = useState<CharacterImage[]>([]);
  
  const [activeTab, setActiveTab] = useState<'roots' | 'shape' | 'soul' | 'visuals'>('roots');
  const [genState, setGenState] = useState<GenerationState>({ isLoading: false, status: '' });
  const [isSaving, setIsSaving] = useState(false);

  // --- Visual Generation Settings ---
  const [showGenSettings, setShowGenSettings] = useState(false);
  const [selectedModel, setSelectedModel] = useState(IMAGE_MODELS[0].id);
  const [refImage, setRefImage] = useState<string | null>(null);
  const directUploadInputRef = useRef<HTMLInputElement>(null);

  // --- Text Generation Settings ---
  const [showTextSettings, setShowTextSettings] = useState(false);
  const [selectedTextModel, setSelectedTextModel] = useState(TEXT_MODELS[0].id);


  // Load Existing Character Data if Editing
  useEffect(() => {
    if (isEditing && characters.length > 0) {
      const existingChar = characters.find(c => c.id === characterId);
      if (existingChar) {
        setRoots(existingChar.roots);
        setShape(existingChar.shape);
        setSoul(existingChar.soul);
        setBrief(existingChar.summary || '');
        setGeneratedImages(existingChar.images || []);
      }
    } else if (egg && !brief && !isEditing) {
       // Only pre-fill if creating new
       setBrief(`故事背景：${egg.premise}。`);
    }
  }, [isEditing, characterId, characters, egg]);

  const handleAIGenerateProfile = async () => {
    if (!brief.trim()) return alert("请输入简要描述");
    if (!universe || !egg) return;

    // Check if key exists (Basic check)
    const localKey = localStorage.getItem('gemini_api_key');
    if (!localKey && !process.env.API_KEY) {
        if (window.confirm("未检测到 API Key，是否前往“全局设置”进行配置？")) {
            navigate('/settings');
        }
        return;
    }

    setGenState({ isLoading: true, status: `正在使用 ${TEXT_MODELS.find(m => m.id === selectedTextModel)?.name?.split('(')[0]} 构思人物...` });
    try {
      // Include Egg Premise in context
      const context = `
        宇宙类型: ${universe.type}
        宇宙描述: ${universe.description}
        宇宙规则: ${universe.rules}
        当前故事(Story Egg): ${egg.title} - ${egg.premise}
      `;
      
      // Pass role and textModel to service
      const profile = await generateCharacterProfile(context, brief, role, selectedTextModel);
      setRoots(profile.roots);
      setShape(profile.shape);
      setSoul(profile.soul);
      setGenState({ isLoading: false, status: '' });
      setShowTextSettings(false); // Collapse after success
    } catch (e) {
      console.error(e);
      setGenState({ isLoading: false, status: '', error: '生成失败。请检查“全局设置”中的 API Key 是否正确。' });
    }
  };

  // Handle AI Gen Reference Image Upload
  const handleRefImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit hint
        alert("建议参考图小于2MB以加快处理速度");
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setRefImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Direct Image Upload to Gallery
  const handleDirectImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
       // Check file size if needed, larger images might lag IndexDB initially but should be fine async
       const reader = new FileReader();
       reader.onloadend = () => {
         const newImg: CharacterImage = {
           id: Date.now().toString(),
           url: reader.result as string,
           prompt: '用户手动上传',
           angle: 'Manual Upload'
         };
         setGeneratedImages(prev => [...prev, newImg]);
       };
       reader.readAsDataURL(file);
    }
    // Reset input
    if (directUploadInputRef.current) {
      directUploadInputRef.current.value = '';
    }
  };

  const handleOpenKeySelector = async () => {
    try {
      // @ts-ignore
      if (window.aistudio && window.aistudio.openSelectKey) {
         // @ts-ignore
         await window.aistudio.openSelectKey();
         console.log("Key selector opened");
      } else {
         navigate('/settings');
      }
    } catch (e) {
      console.error("Failed to open key selector", e);
      navigate('/settings');
    }
  };

  const handleGenerateImages = async () => {
    if (!roots.name || !shape.appearance) {
      alert("请先完善“核心身份”和“外在形象”部分");
      setActiveTab('roots');
      return;
    }

    // --- Check for API Key ---
    const localKey = localStorage.getItem('gemini_api_key');
    const envKey = process.env.API_KEY;
    const hasKey = !!localKey || !!envKey;

    if (!hasKey) {
        if(window.confirm("生成图片需要配置 API Key。是否前往设置页面？")) {
            navigate('/settings');
        }
        return;
    }

    // --- Nano Banana Pro Logic ---
    // If user selected Pro model, we warn about paid key requirements, but we trust the user provided a valid one in settings
    // or via the window.aistudio environment.
    if (selectedModel === 'gemini-3-pro-image-preview') {
      // @ts-ignore
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
         // This is AI Studio / IDX environment logic
         // @ts-ignore
         const studioKey = await window.aistudio.hasSelectedApiKey();
         if (!studioKey && !localKey) {
             // Try to force open selector if no local key either
             await handleOpenKeySelector();
         }
      } 
      // In Vercel environment, we just assume the LocalStorage key is the Paid key user provided.
    }
    
    // Construct a temp character object
    const tempChar: Character = {
        id: 'temp', universeId: universeId!, storyEggId: eggId!, roots, shape, soul, summary: brief, images: []
    };

    setGenState({ isLoading: true, status: '正在初始化影像生成引擎...' });
    setActiveTab('visuals');
    setShowGenSettings(false); // Auto collapse settings on generate
    
    const angles = [
      "正脸特写 (Front Close-up): 标准证件照式构图，平视镜头，表情自然",
      "侧面特写 (Side Profile): 90度侧脸，展示轮廓线条",
      "七分身侧角 (3/4 View): 微微侧身，眼神看向镜头外",
      "全身立绘 (Full Body Standing): 正面站立，展示完整服装搭配",
      "背影展示 (Back View): 展示发型背部细节与服装背部设计",
      "动态抓拍 (Action Shot): 行走或奔跑中，衣摆飘动",
      "情绪特写 (Emotional Close-up): 展现人物核心性格（如愤怒、忧郁或大笑）",
      "职业互动 (Occupation Pose): 手持关键道具或处于工作状态",
      "低角度仰视 (Low Angle): 展现气势或压迫感",
      "环境氛围 (Environmental): 处于典型场景中的中远景"
    ];

    try {
      let successCount = 0;
      // Generate all 10 images
      for (let i = 0; i < angles.length; i++) {
         setGenState({ isLoading: true, status: `正在生成图像 ${i + 1} / ${angles.length} ... [Model: ${selectedModel}]` });
         try {
           const base64 = await generateCharacterImage(tempChar, angles[i], selectedModel, refImage);
           const newImg: CharacterImage = {
              id: Date.now() + i + '',
              url: base64,
              prompt: angles[i],
              angle: angles[i].split(':')[0] 
           };
           setGeneratedImages(prev => [...prev, newImg]);
           successCount++;
         } catch (err) {
           console.error(`Failed to generate image index ${i}`, err);
         }
      }

      if (successCount === 0) {
        setGenState({ isLoading: false, status: '', error: '所有图片生成均失败。请检查全局设置中的 API Key 是否有效，以及该 Key 是否支持选定的模型。' });
      } else {
        setGenState({ isLoading: false, status: '' });
      }
    } catch (e) {
      setGenState({ isLoading: false, status: '', error: '图片生成过程中遇到严重问题' });
    }
  };

  const handleSaveCharacter = async () => {
    if (!roots.name) return alert("至少需要角色姓名");
    if (isSaving) return;

    setIsSaving(true);
    try {
      const idToUse = isEditing && characterId ? characterId : Date.now().toString();
      
      const newChar: Character = {
        id: idToUse,
        universeId: universeId!,
        storyEggId: eggId!, 
        roots,
        shape,
        soul,
        summary: brief,
        images: generatedImages
      };
      await onSave(newChar);
      alert(isEditing ? "角色资料更新成功！" : "角色档案已成功归档至故事蛋！");
      navigate(`/universe/${universeId}/egg/${eggId}`); 
    } catch (error) {
      alert("保存失败，请重试。");
    } finally {
      setIsSaving(false);
    }
  };

  const clearImages = () => {
    if (window.confirm("确定要清空当前所有图片吗？")) {
      setGeneratedImages([]);
    }
  }

  if (!universe || !egg) return <div>Loading context...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto pb-24">
      <button onClick={() => navigate(`/universe/${universeId}/egg/${eggId}`)} className="flex items-center text-slate-400 hover:text-white mb-4 transition-colors">
        <ArrowLeft size={16} className="mr-1" /> 返回故事蛋
      </button>

      <header className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
             {isEditing ? <Edit className="text-cinematic-gold" /> : <Wand2 className="text-cinematic-gold" />}
             {isEditing ? '编辑角色档案' : '角色工坊 (新建)'}
          </h1>
          <p className="text-slate-400">
            宇宙：<span className="text-cinematic-gold">{universe.name}</span> | 
            故事：<span className="text-cinematic-accent">{egg.title}</span>
          </p>
        </div>
        <button 
          onClick={handleSaveCharacter}
          disabled={isSaving}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold shadow-lg transition-all ${
            isSaving 
            ? 'bg-slate-600 cursor-wait' 
            : 'bg-cinematic-accent hover:bg-blue-600 text-white'
          }`}
        >
          {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} 
          {isSaving ? '正在归档...' : (isEditing ? '更新档案' : '保存角色档案')}
        </button>
      </header>

      {/* AI Quick Start */}
      <div className="bg-cinematic-800 p-6 rounded-xl border border-cinematic-700 mb-8 shadow-lg">
        <div className="flex justify-between items-center mb-4">
           <label className="text-sm font-medium text-cinematic-gold flex items-center gap-2">
             <Wand2 size={16} /> AI 灵感速写
           </label>
           
           {/* Text Engine Toggle */}
           <button 
             onClick={() => setShowTextSettings(!showTextSettings)}
             className={`text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors ${showTextSettings ? 'bg-cinematic-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
           >
             <Settings size={12} /> {showTextSettings ? '收起配置' : '文本引擎配置'}
           </button>
        </div>

        {/* Text Engine Settings Panel */}
        {showTextSettings && (
           <div className="mb-4 p-4 bg-cinematic-900/50 rounded-lg border border-cinematic-700 animate-in slide-in-from-top-2">
              <label className="block text-xs text-slate-500 mb-2 uppercase font-semibold">选择文本生成引擎 (Text Model)</label>
              <select 
                value={selectedTextModel} 
                onChange={(e) => setSelectedTextModel(e.target.value)}
                className="w-full bg-cinematic-800 border border-cinematic-700 rounded px-3 py-2 text-white focus:border-cinematic-accent outline-none text-sm"
              >
                {TEXT_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <p className="mt-2 text-xs text-slate-500">
                * 提示：选择“即梦 Jimeng”将模拟网文/创意写作风格，生成更具情感张力的人物小传。
              </p>
           </div>
        )}

        <div className="flex gap-4 flex-col lg:flex-row">
          {/* Role Selector */}
          <div className="lg:w-1/4">
            <select 
              value={role} 
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-cinematic-900 border border-cinematic-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-cinematic-accent outline-none appearance-none"
            >
               {CHARACTER_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <input
            type="text"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="输入简短概念 (例如：一个眼神忧郁的退役杀手)..."
            className="flex-1 bg-cinematic-900 border border-cinematic-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-cinematic-accent outline-none"
          />
          <button 
            onClick={handleAIGenerateProfile}
            disabled={genState.isLoading}
            className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
          >
            {genState.isLoading && activeTab !== 'visuals' ? <Loader2 className="animate-spin" /> : 'AI 自动设定'}
          </button>
        </div>
        {genState.error && (
          <div className="mt-3 text-red-400 text-sm flex items-center gap-2 p-2 bg-red-900/20 rounded">
            <AlertCircle size={14} /> {genState.error}
          </div>
        )}
        {genState.isLoading && (
          <div className="mt-3 text-cinematic-accent text-sm animate-pulse flex items-center gap-2">
            <Loader2 className="animate-spin" size={14} /> {genState.status}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-cinematic-700 mb-6 overflow-x-auto">
        {[
          { id: 'roots', label: '1. 核心身份 (根)' },
          { id: 'shape', label: '2. 外在形象 (形)' },
          { id: 'soul', label: '3. 内在性格 (魂)' },
          { id: 'visuals', label: '4. 影像定妆 (图)' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-6 py-3 font-medium text-sm transition-colors relative whitespace-nowrap ${
              activeTab === tab.id ? 'text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-cinematic-gold shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
            )}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="bg-cinematic-800/50 rounded-xl p-6 border border-cinematic-700 min-h-[500px]">
        
        {/* ROOTS TAB */}
        {activeTab === 'roots' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-500">
            <FormInput label="姓名" value={roots.name} onChange={v => setRoots({...roots, name: v})} />
            <FormInput label="年龄" value={roots.age} onChange={v => setRoots({...roots, age: v})} />
            <FormInput label="性别" value={roots.gender} onChange={v => setRoots({...roots, gender: v})} />
            <FormInput label="国籍/出身" value={roots.origin} onChange={v => setRoots({...roots, origin: v})} />
            <FormTextArea label="家庭背景" value={roots.familyBackground} onChange={v => setRoots({...roots, familyBackground: v})} />
            <FormTextArea label="社会阶层" value={roots.socialClass} onChange={v => setRoots({...roots, socialClass: v})} />
            <FormTextArea label="教育与职业" value={roots.educationJob} onChange={v => setRoots({...roots, educationJob: v})} />
          </div>
        )}

        {/* SHAPE TAB */}
        {activeTab === 'shape' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <FormTextArea label="外貌特征 (身高、体型、长相、特征)" value={shape.appearance} onChange={v => setShape({...shape, appearance: v})} rows={3} />
            <FormTextArea label="着装风格" value={shape.fashion} onChange={v => setShape({...shape, fashion: v})} rows={3} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormTextArea label="肢体语言与口头禅" value={shape.bodyLanguage} onChange={v => setShape({...shape, bodyLanguage: v})} />
              <FormTextArea label="习惯与癖好" value={shape.habits} onChange={v => setShape({...shape, habits: v})} />
            </div>
          </div>
        )}

        {/* SOUL TAB */}
        {activeTab === 'soul' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <FormInput label="核心性格 (关键词)" value={soul.corePersonality} onChange={v => setSoul({...soul, corePersonality: v})} placeholder="例如：多疑、勇敢、强迫症" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormTextArea label="道德罗盘与价值观" value={soul.moralCompass} onChange={v => setSoul({...soul, moralCompass: v})} />
              <FormTextArea label="欲望与目标 (剧情驱动力)" value={soul.desires} onChange={v => setSoul({...soul, desires: v})} />
              <FormTextArea label="深层恐惧与弱点" value={soul.fears} onChange={v => setSoul({...soul, fears: v})} />
              <FormTextArea label="内在矛盾" value={soul.innerConflict} onChange={v => setSoul({...soul, innerConflict: v})} />
            </div>
          </div>
        )}

        {/* VISUALS TAB */}
        {activeTab === 'visuals' && (
          <div className="animate-in fade-in duration-500">
             
             {/* Visuals Header / Toolbar */}
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                   <h3 className="text-lg font-semibold text-white">角色定妆照列表 ({generatedImages.length})</h3>
                   <p className="text-xs text-slate-400">管理角色的视觉资产，支持 AI 生成或手动上传。</p>
                </div>
                
                <div className="flex flex-wrap gap-2">
                   <button 
                     onClick={() => setShowGenSettings(!showGenSettings)}
                     className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all flex items-center gap-2 ${
                       showGenSettings 
                       ? 'bg-cinematic-gold text-black border-cinematic-gold' 
                       : 'bg-cinematic-900 border-cinematic-700 text-slate-300 hover:border-slate-500'
                     }`}
                   >
                     <Settings size={16} /> 
                     AI 生成配置 
                     {showGenSettings ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                   </button>

                   {/* Hidden File Input */}
                   <input 
                     type="file"
                     accept="image/*"
                     className="hidden"
                     ref={directUploadInputRef}
                     onChange={handleDirectImageUpload}
                   />
                   <button 
                     onClick={() => directUploadInputRef.current?.click()}
                     className="px-3 py-2 bg-cinematic-700 hover:bg-cinematic-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                   >
                     <Upload size={16} /> 上传本地图片
                   </button>

                   {generatedImages.length > 0 && (
                      <button 
                        onClick={clearImages}
                        className="px-3 py-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors text-sm"
                      >
                        清空
                      </button>
                   )}
                </div>
             </div>

             {/* Collapsible Generation Settings Panel */}
             {showGenSettings && (
                <div className="mb-8 bg-cinematic-900/50 border border-cinematic-700 rounded-lg p-4 animate-in slide-in-from-top-2 duration-200">
                  <div className="flex justify-between items-center mb-4">
                     <h3 className="text-sm font-bold text-cinematic-gold flex items-center gap-2 uppercase tracking-wider">
                       <Settings size={14} /> AI 接口参数配置
                     </h3>
                     <button onClick={() => setShowGenSettings(false)} className="text-slate-500 hover:text-white"><X size={14}/></button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Model Selection */}
                    <div>
                      <label className="block text-xs text-slate-500 mb-2 uppercase font-semibold">选择生成模型</label>
                      <select 
                        value={selectedModel} 
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="w-full bg-cinematic-800 border border-cinematic-700 rounded px-3 py-2 text-white focus:border-cinematic-accent outline-none text-sm"
                      >
                        {IMAGE_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                      
                      {selectedModel === 'gemini-3-pro-image-preview' && (
                        <div className="mt-3 p-3 bg-cinematic-gold/10 border border-cinematic-gold/30 rounded-lg">
                           <div className="text-xs text-cinematic-gold font-bold flex items-center gap-2 mb-2">
                              <AlertCircle size={14} /> 需要付费 API Key
                           </div>
                           <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                             Nano Banana Pro (Gemini 3.0) 需要连接 Google Cloud 付费项目。请前往“全局设置”配置您的 API Key。
                           </p>
                           <button 
                             onClick={handleOpenKeySelector}
                             className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-cinematic-gold hover:bg-amber-400 text-black text-xs font-bold rounded transition-colors"
                           >
                             <Key size={14} /> 去配置 Key
                           </button>
                        </div>
                      )}
                    </div>

                    {/* Reference Image Upload (For AI Generation) */}
                    <div>
                       <label className="block text-xs text-slate-500 mb-2 uppercase font-semibold">AI 生成参考图 (Img2Img/ControlNet)</label>
                       {!refImage ? (
                         <div className="relative">
                           <input 
                             type="file" 
                             accept="image/*" 
                             onChange={handleRefImageUpload}
                             className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                           />
                           <div className="w-full border border-dashed border-cinematic-700 rounded px-3 py-2 flex items-center justify-center gap-2 text-slate-400 hover:text-white hover:border-cinematic-gold transition-colors bg-cinematic-800 cursor-pointer min-h-[80px]">
                              <Upload size={16} /> <span className="text-sm">上传图片作为生成底图</span>
                           </div>
                         </div>
                       ) : (
                         <div className="flex items-center gap-3">
                            <div className="relative h-20 w-20 rounded overflow-hidden border border-cinematic-gold">
                               <img src={refImage} className="h-full w-full object-cover" alt="Ref" />
                            </div>
                            <div className="flex-1">
                               <p className="text-xs text-cinematic-gold mb-1 font-bold">已启用参考图</p>
                               <p className="text-xs text-slate-500 mb-2">AI 将参考此图的构图或特征进行生成。</p>
                               <button 
                                 onClick={() => setRefImage(null)}
                                 className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                               >
                                 <X size={12} /> 清除参考
                               </button>
                            </div>
                         </div>
                       )}
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-cinematic-700 flex justify-end">
                     <button
                       onClick={handleGenerateImages}
                       disabled={genState.isLoading}
                       className="w-full md:w-auto flex items-center justify-center gap-2 bg-cinematic-gold text-black px-6 py-2 rounded-lg font-bold hover:bg-amber-400 transition-colors disabled:opacity-50 shadow-lg shadow-amber-900/20"
                     >
                       {genState.isLoading ? <Loader2 className="animate-spin" /> : <><Camera size={18} /> {generatedImages.length > 0 ? '追加生成 10 张' : '开始批量生成 (10张)'}</>}
                     </button>
                  </div>
                </div>
             )}

             {/* Images Grid */}
             {generatedImages.length === 0 && !genState.isLoading ? (
               <div className="text-center py-24 text-slate-500 border-2 border-dashed border-slate-700 rounded-xl bg-slate-800/30">
                 <ImageIcon size={48} className="mx-auto mb-4 opacity-30" />
                 <p>暂无图片。</p>
                 <p className="text-sm mt-2">您可以 <button onClick={() => setShowGenSettings(true)} className="text-cinematic-gold hover:underline">配置 AI 生成</button> 或 <button onClick={() => directUploadInputRef.current?.click()} className="text-cinematic-accent hover:underline">上传本地图片</button>。</p>
               </div>
             ) : (
               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                 {generatedImages.map((img, index) => (
                   <div key={img.id} className="group relative aspect-[3/4] bg-black rounded-lg overflow-hidden border border-slate-700 hover:border-cinematic-gold transition-all">
                     <img src={img.url} alt={img.prompt} className="w-full h-full object-cover" />
                     <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                       <p className="text-xs text-white font-bold">{img.angle}</p>
                       <button 
                         onClick={() => setGeneratedImages(prev => prev.filter(x => x.id !== img.id))}
                         className="mt-2 text-xs text-red-400 hover:text-red-300 text-left"
                        >
                         删除此图
                       </button>
                     </div>
                   </div>
                 ))}
                 {genState.isLoading && (
                    <div className="aspect-[3/4] bg-slate-800/50 animate-pulse rounded-lg flex flex-col items-center justify-center border border-slate-700/50">
                        <Loader2 className="animate-spin text-cinematic-gold mb-2" />
                        <span className="text-xs text-slate-500">{genState.status ? 'Generating...' : 'Processing...'}</span>
                    </div>
                 )}
               </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
};

// UI Helper Components
const FormInput: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder?: string }> = ({ label, value, onChange, placeholder }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1 tracking-wide">{label}</label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-cinematic-900/50 border border-cinematic-700 rounded px-3 py-2 text-slate-200 focus:border-cinematic-accent outline-none transition-colors"
    />
  </div>
);

const FormTextArea: React.FC<{ label: string; value: string; onChange: (v: string) => void; rows?: number }> = ({ label, value, onChange, rows = 4 }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1 tracking-wide">{label}</label>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className="w-full bg-cinematic-900/50 border border-cinematic-700 rounded px-3 py-2 text-slate-200 focus:border-cinematic-accent outline-none transition-colors resize-none"
    />
  </div>
);