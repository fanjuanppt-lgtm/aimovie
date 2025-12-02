

import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Universe, StoryEgg, UniverseType, Storyboard } from '../types';
import { ArrowLeft, Egg, Plus, ArrowRight, Calendar, Edit, Save, X, Sparkles, Loader2, Tag, ChevronDown, ChevronUp, Palette, CheckCircle } from 'lucide-react';
import { expandUniverseSetting, expandUniverseRules, VISUAL_STYLE_PRESETS } from '../services/geminiService';

interface UniverseDetailProps {
  universes: Universe[];
  storyEggs: StoryEgg[];
  storyboards: Storyboard[]; // Added storyboards prop
  onSaveEgg: (egg: StoryEgg) => Promise<void>;
  onUpdateUniverse: (u: Universe) => Promise<void>;
}

const TONE_TAGS = [
    "搞笑 (Funny/Comedy)", 
    "日常 (Slice of Life)", 
    "严肃 (Serious)", 
    "写实 (Realistic)",
    "黑暗 (Dark)", 
    "史诗 (Epic)", 
    "悬疑 (Mystery)", 
    "荒诞 (Absurd)", 
    "治愈 (Wholesome)", 
    "硬核 (Gritty)", 
    "浪漫 (Romantic)"
];

const CIV_TAGS = [
    "原始/部落", 
    "古代中国", 
    "中古/魔法", 
    "近代世界", 
    "蒸汽朋克", 
    "现代都市", 
    "赛博朋克", 
    "末日废土", 
    "星际文明"
];

export const UniverseDetail: React.FC<UniverseDetailProps> = ({ universes, storyEggs, storyboards, onSaveEgg, onUpdateUniverse }) => {
  const { universeId } = useParams<{ universeId: string }>();
  const universe = universes.find(u => u.id === universeId);
  const myEggs = storyEggs.filter(e => e.universeId === universeId);

  const [isCreating, setIsCreating] = useState(false);
  const [newEggTitle, setNewEggTitle] = useState('');
  const [newEggPremise, setNewEggPremise] = useState('');
  const [newEggStyle, setNewEggStyle] = useState<string>(VISUAL_STYLE_PRESETS[0].id);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editRules, setEditRules] = useState('');
  const [editType, setEditType] = useState<UniverseType>(UniverseType.ADAPTED);

  const [selectedTone, setSelectedTone] = useState(TONE_TAGS[3]);
  const [selectedCiv, setSelectedCiv] = useState(CIV_TAGS[5]);
  const [isExpandingDesc, setIsExpandingDesc] = useState(false);
  const [isExpandingRules, setIsExpandingRules] = useState(false);
  
  // Collapse State
  const [isExpanded, setIsExpanded] = useState(false);

  const handleCreateEgg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEggTitle || !universeId) return;

    const newEgg: StoryEgg = {
      id: Date.now().toString(),
      ownerId: '', // Placeholder, will be injected by App
      universeId: universeId,
      title: newEggTitle,
      premise: newEggPremise,
      visualStyle: newEggStyle,
      createdAt: new Date()
    };

    await onSaveEgg(newEgg);
    setIsCreating(false);
    setNewEggTitle('');
    setNewEggPremise('');
    setNewEggStyle(VISUAL_STYLE_PRESETS[0].id);
  };

  const startEditing = () => {
    if (!universe) return;
    setEditName(universe.name);
    setEditDesc(universe.description);
    setEditRules(universe.rules);
    setEditType(universe.type);
    setIsEditing(true);
  };

  const saveEditing = async () => {
    if (!universe) return;
    const updatedUniverse: Universe = {
      ...universe,
      name: editName,
      description: editDesc,
      rules: editRules,
      type: editType,
    };
    await onUpdateUniverse(updatedUniverse);
    setIsEditing(false);
  };

  const handleAIExpandDesc = async () => {
      if (!editName) return alert("请先输入宇宙名称");
      const hasTextKey = localStorage.getItem('gemini_api_key') || process.env.API_KEY;
      if (!hasTextKey) {
          alert("未检测到文本生成 API Key。");
          return;
      }

      setIsExpandingDesc(true);
      try {
          const tags = [selectedTone, selectedCiv];
          const result = await expandUniverseSetting(editName, editType, editDesc || "", tags);
          if (result) setEditDesc(result);
          else alert("AI 返回了空内容，请重试。");
      } catch (e: any) {
          console.error(e);
          alert(`AI 扩写失败：${e.message || "未知错误"}`);
      } finally {
          setIsExpandingDesc(false);
      }
  };

  const handleAIExpandRules = async () => {
      if (!editName) return alert("请先输入宇宙名称。");
      const hasTextKey = localStorage.getItem('gemini_api_key') || process.env.API_KEY;
      if (!hasTextKey) {
          alert("未检测到文本生成 API Key。");
          return;
      }

      setIsExpandingRules(true);
      try {
          const tags = [selectedTone, selectedCiv];
          const result = await expandUniverseRules(editName, editType, editRules || "", tags);
           if (result) setEditRules(result);
          else alert("AI 返回了空内容，请重试。");
      } catch (e: any) {
          console.error(e);
           alert(`AI 扩写失败：${e.message || "未知错误"}`);
      } finally {
          setIsExpandingRules(false);
      }
  };

  // Helper to get cover image for an egg from its storyboards
  const getEggCoverImage = (eggId: string) => {
      // Find latest storyboard for this egg that has a generated frame
      const sbs = storyboards.filter(s => s.storyEggId === eggId);
      // Sort by creation date descending
      sbs.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      for (const sb of sbs) {
          if (sb.frames && sb.frames.length > 0) {
              const firstFrame = sb.frames[0];
              if (firstFrame && firstFrame.imageUrl) {
                  return firstFrame.imageUrl;
              }
          }
      }
      return null;
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-24">
      <Link to="/" className="inline-flex items-center text-slate-400 hover:text-white mb-6 transition-colors">
        <ArrowLeft size={16} className="mr-2" /> 返回多元宇宙视图
      </Link>

      <div className="mb-10 border-b border-cinematic-700 pb-8 relative">
        {/* Header Actions - Flex for mobile control */}
        <div className="flex justify-end mb-4 md:mb-0 md:absolute md:top-0 md:right-0">
          {!isEditing ? (
            <button 
              onClick={startEditing}
              className="p-2 text-slate-400 hover:text-cinematic-gold hover:bg-cinematic-800 rounded-lg transition-colors flex items-center gap-2"
            >
              <Edit size={18} /> <span className="text-sm">修改设定</span>
            </button>
          ) : (
            <div className="flex gap-2">
              <button 
                onClick={() => setIsEditing(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-red-900/30 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
              <button 
                onClick={saveEditing}
                className="p-2 text-cinematic-gold hover:bg-cinematic-800 rounded-lg transition-colors font-bold flex items-center gap-2"
              >
                <Save size={18} /> 保存
              </button>
            </div>
          )}
        </div>

        {/* Display vs Edit Mode */}
        {!isEditing ? (
          <>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 pr-0 md:pr-24">{universe.name}</h1>
            
            <div className="relative">
                <div className={`transition-all duration-300 overflow-hidden ${isExpanded ? 'max-h-[2000px]' : 'max-h-24 md:max-h-20'}`}>
                    <p className={`text-base md:text-lg text-slate-400 max-w-3xl whitespace-pre-line ${!isExpanded ? 'line-clamp-2 md:line-clamp-2' : ''}`}>
                        {universe.description}
                    </p>
                    <div className="mt-4 flex flex-col md:flex-row gap-4 text-sm text-slate-500">
                        <span className="px-3 py-1 bg-cinematic-800 rounded border border-cinematic-700 w-fit h-fit">{universe.type}</span>
                        <div className={`px-3 py-1 bg-cinematic-800 rounded border border-cinematic-700 max-w-3xl whitespace-pre-line ${!isExpanded ? 'line-clamp-1' : ''}`}>
                             <span className="font-bold mr-1">规则：</span>{universe.rules}
                        </div>
                    </div>
                </div>

                {/* Gradient Mask for Collapsed State */}
                {!isExpanded && (
                     <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-cinematic-900 to-transparent pointer-events-none"></div>
                )}
            </div>

            <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="mt-2 text-cinematic-gold text-xs font-bold hover:underline flex items-center gap-1"
            >
                {isExpanded ? (
                    <><ChevronUp size={12}/> 收起详情</>
                ) : (
                    <><ChevronDown size={12}/> 展开详情 (背景与规则)</>
                )}
            </button>
          </>
        ) : (
          <div className="space-y-6 bg-cinematic-800/50 p-4 md:p-6 rounded-xl border border-cinematic-700 border-dashed">
            
            {/* Top Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs text-slate-500 mb-2 uppercase font-bold">宇宙名称</label>
                <input 
                  value={editName} 
                  onChange={e => setEditName(e.target.value)}
                  className="w-full bg-cinematic-900 border border-cinematic-700 rounded px-3 py-2 text-white focus:border-cinematic-accent outline-none"
                />
              </div>
              <div>
                 <label className="block text-xs text-slate-500 mb-2 uppercase font-bold">类型</label>
                 <select 
                    value={editType}
                    onChange={e => setEditType(e.target.value as UniverseType)}
                    className="w-full bg-cinematic-900 border border-cinematic-700 rounded px-3 py-2 text-white focus:border-cinematic-accent outline-none"
                 >
                    {Object.values(UniverseType).map(t => <option key={t} value={t}>{t}</option>)}
                 </select>
              </div>
            </div>

            {/* Tags for AI */}
            <div className="bg-cinematic-900/50 p-4 rounded-xl border border-cinematic-700">
                <label className="block text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                    <Tag size={14}/> 核心世界参数 (辅助 AI 修改)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <span className="text-xs text-slate-500 mb-1 block">基调风格</span>
                        <select 
                            value={selectedTone} 
                            onChange={e => setSelectedTone(e.target.value)}
                            className="w-full bg-cinematic-800 border border-cinematic-700 rounded px-3 py-2 text-white text-sm focus:border-cinematic-gold outline-none"
                        >
                            {TONE_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div>
                        <span className="text-xs text-slate-500 mb-1 block">文明/科技等级</span>
                        <select 
                            value={selectedCiv} 
                            onChange={e => setSelectedCiv(e.target.value)}
                            className="w-full bg-cinematic-800 border border-cinematic-700 rounded px-3 py-2 text-white text-sm focus:border-cinematic-gold outline-none"
                        >
                            {CIV_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Description AI Edit */}
            <div>
               <div className="flex justify-between items-end mb-2">
                   <label className="block text-xs text-slate-500 uppercase font-bold">背景设定</label>
                   <button
                        type="button" 
                        onClick={handleAIExpandDesc}
                        disabled={isExpandingDesc || !editName}
                        className="text-xs flex items-center gap-1 text-cinematic-gold hover:text-amber-300 bg-cinematic-900 px-2 py-1 rounded transition-colors disabled:opacity-50 border border-cinematic-700 hover:border-cinematic-gold/30"
                    >
                        {isExpandingDesc ? <Loader2 className="animate-spin" size={12}/> : <Sparkles size={12}/>}
                        AI 重写背景
                    </button>
               </div>
               <textarea 
                 value={editDesc} 
                 onChange={e => setEditDesc(e.target.value)}
                 rows={5}
                 placeholder="【地理】... (每段不超过20字)"
                 className="w-full bg-cinematic-900 border border-cinematic-700 rounded px-3 py-2 text-white focus:border-cinematic-accent outline-none resize-none"
               />
            </div>

            {/* Rules AI Edit */}
            <div>
               <div className="flex justify-between items-end mb-2">
                   <label className="block text-xs text-slate-500 uppercase font-bold">核心规则</label>
                    <button 
                        type="button"
                        onClick={handleAIExpandRules}
                        disabled={isExpandingRules || !editName}
                        className="text-xs flex items-center gap-1 text-cinematic-gold hover:text-amber-300 bg-cinematic-900 px-2 py-1 rounded transition-colors disabled:opacity-50 border border-cinematic-700 hover:border-cinematic-gold/30"
                    >
                        {isExpandingRules ? <Loader2 className="animate-spin" size={12}/> : <Sparkles size={12}/>}
                        AI 重写规则
                    </button>
               </div>
               <textarea 
                 value={editRules} 
                 onChange={e => setEditRules(e.target.value)}
                 rows={5}
                 placeholder="1. 法则一... (每条不超过50字)"
                 className="w-full bg-cinematic-900 border border-cinematic-700 rounded px-3 py-2 text-white focus:border-cinematic-accent outline-none resize-none"
               />
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mb-8">
        <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
          <Egg className="text-cinematic-gold" /> 故事孵化器
        </h2>
        <button 
          onClick={() => setIsCreating(!isCreating)}
          className="bg-cinematic-accent hover:bg-blue-600 text-white px-3 md:px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm md:text-base"
        >
          <Plus size={18} /> <span className="hidden md:inline">孵化新故事</span><span className="md:hidden">新建</span>
        </button>
      </div>

      {isCreating && (
        <div className="mb-8 bg-cinematic-800 p-6 rounded-xl border border-cinematic-700 animate-in slide-in-from-top-4 duration-300 shadow-2xl">
          <h3 className="text-lg font-semibold text-white mb-4">设定新故事雏形</h3>
          <form onSubmit={handleCreateEgg} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">故事标题</label>
                        <input 
                            type="text" 
                            required
                            value={newEggTitle}
                            onChange={e => setNewEggTitle(e.target.value)}
                            className="w-full bg-cinematic-900 border border-cinematic-700 rounded p-3 text-white focus:border-cinematic-accent outline-none"
                            placeholder="例如：暗夜行动"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">故事梗概</label>
                        <textarea 
                            required
                            rows={6}
                            value={newEggPremise}
                            onChange={e => setNewEggPremise(e.target.value)}
                            className="w-full bg-cinematic-900 border border-cinematic-700 rounded p-3 text-white focus:border-cinematic-accent outline-none resize-none"
                            placeholder="一句话描述这个故事的核心冲突..."
                        />
                    </div>
                </div>

                {/* Visual Style Selector */}
                <div className="bg-cinematic-900/50 p-4 rounded-xl border border-cinematic-700">
                     <label className="block text-sm text-slate-400 mb-3 flex items-center gap-2">
                        <Palette size={16} className="text-cinematic-gold"/>
                        设定美术基调 (Visual Art Direction)
                     </label>
                     <p className="text-xs text-slate-500 mb-4">此设定将决定该故事下所有角色、场景和分镜的生成画风。</p>
                     
                     <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                         {VISUAL_STYLE_PRESETS.map(style => (
                             <div 
                                key={style.id}
                                onClick={() => setNewEggStyle(style.id)}
                                className={`flex flex-col items-center gap-2 p-2 rounded-lg cursor-pointer border transition-all ${
                                    newEggStyle === style.id 
                                    ? 'bg-cinematic-gold/10 border-cinematic-gold ring-1 ring-cinematic-gold/50' 
                                    : 'bg-cinematic-800 border-transparent hover:border-cinematic-700 hover:bg-cinematic-700'
                                }`}
                             >
                                 <img src={style.thumbnail} alt={style.label} className="w-[65px] h-[65px] rounded object-cover flex-shrink-0 bg-slate-700" />
                                 <div className="min-w-0 text-center">
                                     <div className={`text-xs font-bold truncate ${newEggStyle === style.id ? 'text-cinematic-gold' : 'text-slate-300'}`}>{style.label}</div>
                                 </div>
                                 {newEggStyle === style.id && <CheckCircle size={14} className="text-cinematic-gold flex-shrink-0" />}
                             </div>
                         ))}
                     </div>
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-cinematic-700">
              <button 
                type="button" 
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 text-slate-400 hover:text-white"
              >
                取消
              </button>
              <button 
                type="submit" 
                className="px-6 py-2 bg-cinematic-gold text-black font-bold rounded hover:bg-amber-400"
              >
                确认孵化
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {myEggs.length === 0 && !isCreating && (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-cinematic-700 rounded-xl text-slate-500">
            <Egg size={48} className="mx-auto mb-3 opacity-20" />
            <p>暂无故事蛋，请点击“孵化新故事”开始创作。</p>
          </div>
        )}

        {myEggs.map(egg => {
            const coverImage = getEggCoverImage(egg.id);
            // Resolve style label for display
            const styleLabel = VISUAL_STYLE_PRESETS.find(s => s.id === egg.visualStyle)?.label || '默认风格';

            return (
              <Link 
                key={egg.id} 
                to={`/universe/${universeId}/egg/${egg.id}`}
                className="block group bg-cinematic-800 rounded-xl border border-cinematic-700 overflow-hidden hover:border-cinematic-gold transition-all hover:shadow-lg hover:shadow-amber-900/10 relative"
              >
                 {/* Background Image Overlay */}
                 {coverImage && (
                    <div className="absolute inset-0 z-0">
                         <img src={coverImage} alt="Cover" className="w-full h-full object-cover opacity-30 group-hover:opacity-50 transition-opacity duration-500 grayscale group-hover:grayscale-0" />
                         <div className="absolute inset-0 bg-gradient-to-t from-cinematic-900 via-cinematic-900/80 to-transparent"></div>
                    </div>
                 )}
                 
                 <div className="p-5 md:p-6 relative z-10">
                   <div className="flex justify-between items-start mb-4">
                     <div className="w-10 h-10 rounded-full bg-cinematic-900/80 backdrop-blur flex items-center justify-center text-cinematic-gold group-hover:scale-110 transition-transform">
                       <Egg size={20} />
                     </div>
                     <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] md:text-xs text-slate-400 flex items-center gap-1 bg-black/50 px-2 py-1 rounded">
                            <Calendar size={12} /> {new Date(egg.createdAt).toLocaleDateString()}
                        </span>
                        <span className="text-[10px] text-cinematic-gold bg-black/50 px-2 py-0.5 rounded border border-cinematic-gold/20">
                           {styleLabel}
                        </span>
                     </div>
                   </div>
                   <h3 className="text-xl font-bold text-white mb-2 group-hover:text-cinematic-gold transition-colors">{egg.title}</h3>
                   <p className="text-slate-300 text-sm line-clamp-3 mb-6 h-10">{egg.premise}</p>
                   
                   <div className="flex items-center text-sm text-cinematic-accent font-medium">
                     进入故事空间 <ArrowRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                   </div>
                 </div>
              </Link>
            );
        })}
      </div>
    </div>
  );
};