import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Universe, UniverseType } from '../types';
import { Sparkles, ArrowLeft, Upload, RefreshCw, Loader2, Tag } from 'lucide-react';
import { expandUniverseSetting, expandUniverseRules } from '../services/geminiService';

interface UniverseCreatorProps {
  onSave: (u: Universe) => void;
}

const UNIVERSE_TYPES_CONFIG = [
    {
        type: UniverseType.REAL,
        defaultImage: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80",
        desc: "基于现实世界的法则。无魔法，无超光速，强调真实感与逻辑。"
    },
    {
        type: UniverseType.ADAPTED,
        defaultImage: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&q=80",
        desc: "基于现有IP或历史改编。允许适度的戏剧夸张和法则微调。"
    },
    {
        type: UniverseType.FICTIONAL,
        defaultImage: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=800&q=80",
        desc: "完全架空的世界。如奇幻大陆、太空歌剧，拥有独立的物理或魔法法则。"
    },
    {
        type: UniverseType.VIRTUAL,
        defaultImage: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=800&q=80",
        desc: "数字空间或梦境。规则由程序或潜意识定义，可无限反转。"
    }
];

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

export const UniverseCreator: React.FC<UniverseCreatorProps> = ({ onSave }) => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [type, setType] = useState<UniverseType>(UniverseType.REAL);
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState('');
  
  const [selectedTone, setSelectedTone] = useState(TONE_TAGS[3]); 
  const [selectedCiv, setSelectedCiv] = useState(CIV_TAGS[5]); 

  const [isExpandingDesc, setIsExpandingDesc] = useState(false);
  const [isExpandingRules, setIsExpandingRules] = useState(false);
  
  const [coverImage, setCoverImage] = useState<string>(UNIVERSE_TYPES_CONFIG[0].defaultImage);
  const [isCustomCover, setIsCustomCover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isCustomCover) {
      const config = UNIVERSE_TYPES_CONFIG.find(c => c.type === type);
      if (config) {
        setCoverImage(config.defaultImage);
      }
    }
  }, [type, isCustomCover]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverImage(reader.result as string);
        setIsCustomCover(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResetImage = () => {
    setIsCustomCover(false);
    const config = UNIVERSE_TYPES_CONFIG.find(c => c.type === type);
    if (config) {
      setCoverImage(config.defaultImage);
    }
  };

  const handleAIExpandDesc = async () => {
      if (!name) return alert("请先输入宇宙名称，AI 需要它来构思上下文。");
      const hasTextKey = localStorage.getItem('gemini_api_key') || process.env.API_KEY;
      if (!hasTextKey) {
          if(window.confirm("未检测到文本生成 API Key，是否前往设置页面配置？")) {
              navigate('/settings');
              return;
          }
      }

      setIsExpandingDesc(true);
      try {
          const tags = [selectedTone, selectedCiv];
          const result = await expandUniverseSetting(name, type, description || "", tags);
          if (result) setDescription(result);
          else alert("AI 返回了空内容，请重试。");
      } catch (e: any) {
          console.error(e);
          alert(`AI 扩写失败：${e.message || "未知错误"}\n请检查全局设置中的 API Key 是否正确配置。`);
      } finally {
          setIsExpandingDesc(false);
      }
  };

  const handleAIExpandRules = async () => {
      if (!name) return alert("请先输入宇宙名称。");
      const hasTextKey = localStorage.getItem('gemini_api_key') || process.env.API_KEY;
      if (!hasTextKey) {
           if(window.confirm("未检测到文本生成 API Key，是否前往设置页面配置？")) {
              navigate('/settings');
              return;
          }
      }

      setIsExpandingRules(true);
      try {
          const tags = [selectedTone, selectedCiv];
          const result = await expandUniverseRules(name, type, rules || "", tags);
           if (result) setRules(result);
           else alert("AI 返回了空内容，请重试。");
      } catch (e: any) {
          console.error(e);
           alert(`AI 扩写失败：${e.message || "未知错误"}\n请检查全局设置中的 API Key 是否正确配置。`);
      } finally {
          setIsExpandingRules(false);
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newUniverse: Universe = {
      id: Date.now().toString(),
      ownerId: '', // Placeholder, will be injected by App
      name,
      type,
      description,
      rules,
      coverImage,
      createdAt: new Date(),
    };
    onSave(newUniverse);
    navigate(`/universe/${newUniverse.id}`);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 pb-24">
      <button onClick={() => navigate('/')} className="flex items-center text-slate-400 hover:text-white mb-4 md:mb-6">
        <ArrowLeft size={16} className="mr-1" /> 返回
      </button>

      <div className="bg-cinematic-800 rounded-2xl border border-cinematic-700 p-4 md:p-8 shadow-xl">
        <div className="flex items-center gap-3 mb-6 md:mb-8 border-b border-cinematic-700 pb-6">
          <div className="p-3 bg-cinematic-gold/10 rounded-lg text-cinematic-gold">
            <Sparkles size={24} />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-white">构建新宇宙</h2>
            <p className="text-slate-400 text-xs md:text-sm">定义你的世界观基础</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
          <div className="flex flex-col lg:flex-row gap-6 md:gap-8">
            {/* LEFT COLUMN: Inputs */}
            <div className="flex-1 space-y-6 md:space-y-8">
              {/* Name */}
              <div>
                <label className="block text-sm font-bold text-slate-300 uppercase mb-2">宇宙名称</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：赛博朋克2077-Neo Tokyo"
                  className="w-full bg-cinematic-900 border border-cinematic-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-cinematic-accent focus:border-transparent outline-none transition-all text-base md:text-lg"
                />
              </div>

              {/* Type Selection - Visual Cards */}
              <div>
                <label className="block text-sm font-bold text-slate-300 uppercase mb-4">选择宇宙类型</label>
                <div className="grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-4">
                  {UNIVERSE_TYPES_CONFIG.map((cfg) => {
                    const isSelected = type === cfg.type;
                    return (
                      <div
                        key={cfg.type}
                        onClick={() => setType(cfg.type)}
                        className={`cursor-pointer relative rounded-xl overflow-hidden h-24 md:h-32 transition-all duration-300 group ${
                          isSelected 
                            ? 'ring-2 ring-cinematic-gold scale-[1.02] shadow-xl' 
                            : 'opacity-70 hover:opacity-100 hover:scale-105'
                        }`}
                      >
                        {/* Background Image */}
                        <img 
                           src={cfg.defaultImage} 
                           alt={cfg.type} 
                           className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className={`absolute inset-0 bg-black/60 group-hover:bg-black/40 transition-colors ${isSelected ? 'bg-black/50' : ''}`}></div>
                        
                        <div className="absolute inset-0 p-3 md:p-4 flex flex-col justify-end">
                            <div className="flex items-center justify-between">
                                <h3 className={`font-bold text-sm md:text-lg ${isSelected ? 'text-cinematic-gold' : 'text-white'}`}>{cfg.type}</h3>
                                {isSelected && <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-cinematic-gold rounded-full shadow-[0_0_8px_#f59e0b]"></div>}
                            </div>
                            <p className="text-[10px] md:text-xs text-slate-300 mt-1 line-clamp-2 hidden md:block">{cfg.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Setting Parameters */}
              <div className="bg-cinematic-900/50 p-4 rounded-xl border border-cinematic-700">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                     <Tag size={14}/> 核心世界参数 (辅助 AI 生成)
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <span className="text-xs text-slate-500 mb-1 block">基调风格 (Tone)</span>
                          <select 
                            value={selectedTone} 
                            onChange={e => setSelectedTone(e.target.value)}
                            className="w-full bg-cinematic-800 border border-cinematic-700 rounded px-3 py-2 text-white text-sm focus:border-cinematic-gold outline-none"
                          >
                             {TONE_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                      </div>
                      <div>
                          <span className="text-xs text-slate-500 mb-1 block">文明/科技等级 (Civilization)</span>
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

              {/* Details Grid */}
              <div className="space-y-6">
                <div>
                    <div className="flex justify-between items-end mb-2">
                        <label className="block text-sm font-bold text-slate-300 uppercase">位置与背景设定</label>
                        <button
                          type="button" 
                          onClick={handleAIExpandDesc}
                          disabled={isExpandingDesc || !name}
                          className="text-xs flex items-center gap-1 text-cinematic-gold hover:text-amber-300 hover:bg-cinematic-900 px-2 py-1 rounded transition-colors disabled:opacity-50 border border-transparent hover:border-cinematic-gold/30"
                        >
                            {isExpandingDesc ? <Loader2 className="animate-spin" size={12}/> : <Sparkles size={12}/>}
                            AI 智能扩写
                        </button>
                    </div>
                    <textarea
                    required
                    rows={5}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="【地理】... 【时代】... (请分段呈现，每段不超过20字)"
                    className="w-full bg-cinematic-900 border border-cinematic-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-cinematic-accent focus:border-transparent outline-none transition-all resize-none text-sm md:text-base"
                    />
                </div>

                <div>
                    <div className="flex justify-between items-end mb-2">
                         <label className="block text-sm font-bold text-slate-300 uppercase">核心规则与法则</label>
                         <button 
                          type="button"
                          onClick={handleAIExpandRules}
                          disabled={isExpandingRules || !name}
                          className="text-xs flex items-center gap-1 text-cinematic-gold hover:text-amber-300 hover:bg-cinematic-900 px-2 py-1 rounded transition-colors disabled:opacity-50 border border-transparent hover:border-cinematic-gold/30"
                        >
                            {isExpandingRules ? <Loader2 className="animate-spin" size={12}/> : <Sparkles size={12}/>}
                            AI 细化规则
                        </button>
                    </div>
                    <textarea
                    required
                    rows={5}
                    value={rules}
                    onChange={(e) => setRules(e.target.value)}
                    placeholder="1. 法则一... 2. 法则二... (请列出不超过10条，每条50字以内)"
                    className="w-full bg-cinematic-900 border border-cinematic-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-cinematic-accent focus:border-transparent outline-none transition-all resize-none text-sm md:text-base"
                    />
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Cover Image Preview */}
            <div className="lg:w-80 flex flex-col gap-4">
               <label className="block text-sm font-bold text-slate-300 uppercase">宇宙封面图</label>
               
               <div className="relative aspect-video lg:aspect-[3/4] w-full rounded-xl overflow-hidden border-2 border-cinematic-700 shadow-2xl bg-black group">
                 <img src={coverImage} alt="Universe Cover" className="w-full h-full object-cover" />
                 <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-80"></div>
                 
                 <div className="absolute bottom-0 left-0 w-full p-4 md:p-6">
                    <h1 className="text-xl md:text-2xl font-bold text-white leading-tight mb-1">{name || "未命名宇宙"}</h1>
                    <div className="flex flex-wrap gap-2 mt-2">
                         <span className="inline-block px-2 py-0.5 bg-cinematic-gold text-black text-[10px] font-bold rounded uppercase">
                            {type}
                        </span>
                    </div>
                 </div>

                 {/* Edit Overlay */}
                 <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-white text-black font-bold rounded-full flex items-center gap-2 text-sm hover:scale-105 transition-transform"
                    >
                       <Upload size={16} /> 更换封面
                    </button>
                    {isCustomCover && (
                        <button 
                        type="button"
                        onClick={handleResetImage}
                        className="px-4 py-2 bg-black/50 text-white font-bold rounded-full flex items-center gap-2 text-sm hover:bg-black/70"
                        >
                        <RefreshCw size={16} /> 重置为默认
                        </button>
                    )}
                 </div>
               </div>
               
                <div className="text-xs text-slate-500 text-center">
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleImageUpload} 
                  />
               </div>
            </div>
          </div>

          <div className="pt-6 border-t border-cinematic-700 flex justify-end">
            <button
              type="submit"
              className="w-full md:w-auto px-8 py-4 bg-gradient-to-r from-cinematic-accent to-blue-600 hover:from-blue-500 hover:to-blue-600 text-white font-bold rounded-lg shadow-lg shadow-blue-900/20 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2"
            >
              <Sparkles size={20} /> 完成设定并进入
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};