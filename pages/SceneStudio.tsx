

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Universe, StoryEgg, Scene, SceneImage, ShotDef } from '../types';
import { generateSceneDescription, generateSceneImage } from '../services/geminiService';
import { ArrowLeft, Map, Save, Loader2, Sparkles, Image as ImageIcon, Upload, Trash2, ZoomIn, X, RefreshCw, PlusCircle, Edit, Info, Check, Link as LinkIcon } from 'lucide-react';

interface SceneStudioProps {
  universes: Universe[];
  storyEggs: StoryEgg[];
  scenes: Scene[];
  onSave: (s: Scene) => Promise<void>;
}

// Default shots for a new scene
const DEFAULT_SCENE_SHOTS: ShotDef[] = [
    { id: 'main', label: '1. 场景主视图 (Master View)', prompt: 'Cinematic Master Shot, Wide Angle, establishing shot.' },
    { id: 'overhead', label: '2. 俯瞰图 (Overhead Map)', prompt: 'Top-down Aerial View, Drone shot, 90 degree angle looking straight down. Map-like visibility.' },
    { id: 'reverse', label: '3. 全景反打镜头 (Reverse Shot)', prompt: '180-degree Reverse Angle Shot. Panoramic view looking at the opposite side of the room/location from the main shot. Wide angle coverage.' }
];

export const SceneStudio: React.FC<SceneStudioProps> = ({ universes, storyEggs, scenes, onSave }) => {
  const navigate = useNavigate();
  const { universeId, eggId, sceneId } = useParams<{ universeId: string; eggId: string; sceneId?: string }>();

  const universe = universes.find(u => u.id === universeId);
  const egg = storyEggs.find(e => e.id === eggId);
  const existingScene = scenes.find(s => s.id === sceneId);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<SceneImage[]>([]);
  
  // Dynamic Shot Definitions
  const [shotDefs, setShotDefs] = useState<ShotDef[]>(DEFAULT_SCENE_SHOTS);
  
  // Reference Image State (Per shot ID)
  const [referenceImages, setReferenceImages] = useState<Record<string, string>>({});

  const [isExpanding, setIsExpanding] = useState(false);
  const [loadingSlot, setLoadingSlot] = useState<string | null>(null); 
  const [isSaving, setIsSaving] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  // Edit Shot State
  const [editingShotId, setEditingShotId] = useState<string | null>(null);
  const [editShotLabel, setEditShotLabel] = useState('');
  const [editShotPrompt, setEditShotPrompt] = useState('');

  // Add New Shot State
  const [isAddingShot, setIsAddingShot] = useState(false);
  const [newShotLabel, setNewShotLabel] = useState('');
  const [newShotPrompt, setNewShotPrompt] = useState('');

  const uploadRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const refUploadRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (existingScene) {
      setName(existingScene.name);
      setDescription(existingScene.description);
      
      // Migrate old images to include shotId if missing (using type as fallback)
      const migratedImages = existingScene.images.map(img => ({
          ...img,
          id: img.id || Date.now().toString() + Math.random(),
          // Use 'type' as the link to shotDef ID for backward compatibility
          type: img.type 
      }));
      setImages(migratedImages);

      // Load Shot Defs or Default
      if (existingScene.shotDefs && existingScene.shotDefs.length > 0) {
          setShotDefs(existingScene.shotDefs);
      } else {
          setShotDefs(DEFAULT_SCENE_SHOTS);
      }
    }
  }, [existingScene]);

  const handleAIExpand = async () => {
    if (!name) return alert("请先输入场景名称");
    if (!universe) return;

    setIsExpanding(true);
    try {
      const result = await generateSceneDescription(universe.name, name, description);
      setDescription(result);
    } catch (e) {
      alert("AI 描述生成失败");
    } finally {
      setIsExpanding(false);
    }
  };

  const handleGenerateImage = async (shot: ShotDef) => {
    if (!name) return alert("请先完善场景名称");
    
    setLoadingSlot(shot.id);
    try {
        // Priority 1: Specific Manual Reference for this shot
        let effectiveRefImage = referenceImages[shot.id];
        
        // Priority 2: Auto Consistency - Use Main View if available and we are NOT generating the Main View
        if (!effectiveRefImage && shot.id !== 'main') {
            const mainImg = images.find(i => i.type === 'main');
            if (mainImg) {
                console.log("Using Main Shot as consistency reference for:", shot.label);
                effectiveRefImage = mainImg.url;
            }
        }

        const combinedDesc = `${description || name}\n\n[SPECIFIC SHOT INSTRUCTION]: ${shot.prompt}`;
        
        // For custom shots, use 'custom' view type to avoid forcing "Wide Angle" prompts
        const effectiveViewType = (['main', 'overhead', 'isometric', 'reverse'].includes(shot.id)) 
            ? shot.id 
            : 'custom'; 

        const url = await generateSceneImage(name, combinedDesc, effectiveViewType, effectiveRefImage);
        
        const newImg: SceneImage = { 
            id: Date.now().toString(),
            type: shot.id, 
            url 
        };
        
        setImages(prev => {
            const others = prev.filter(i => i.type !== shot.id);
            return [...others, newImg];
        });

    } catch (e: any) {
        console.error(e);
        alert(`生成失败: ${e.message}`);
    } finally {
        setLoadingSlot(null);
    }
  };

  const handleManualUpload = (e: React.ChangeEvent<HTMLInputElement>, shotId: string) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              const newImg: SceneImage = { 
                  id: Date.now().toString(),
                  type: shotId, 
                  url: reader.result as string 
              };
              setImages(prev => {
                  const others = prev.filter(i => i.type !== shotId);
                  return [...others, newImg];
              });
          };
          reader.readAsDataURL(file);
      }
      if (uploadRefs.current[shotId]) uploadRefs.current[shotId]!.value = '';
  };

  const handleRefUpload = (e: React.ChangeEvent<HTMLInputElement>, shotId: string) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setReferenceImages(prev => ({ ...prev, [shotId]: reader.result as string }));
          };
          reader.readAsDataURL(file);
      }
      if (refUploadRefs.current[shotId]) refUploadRefs.current[shotId]!.value = '';
  };

  const handleDeleteImage = (shotId: string) => {
      if (window.confirm("确定删除这张图片吗？")) {
          setImages(prev => prev.filter(i => i.type !== shotId));
      }
  };

  const handleAddShot = () => {
      if (!newShotLabel) return alert("请输入视图名称");
      const newId = Date.now().toString();
      const newShot: ShotDef = {
          id: newId,
          label: newShotLabel,
          prompt: newShotPrompt || newShotLabel
      };
      setShotDefs([...shotDefs, newShot]);
      setIsAddingShot(false);
      setNewShotLabel('');
      setNewShotPrompt('');
  };

  const handleDeleteShotDef = (id: string) => {
      if (window.confirm("删除此卡片？")) {
          setShotDefs(prev => prev.filter(s => s.id !== id));
      }
  };

  const startEditingShot = (shot: ShotDef) => {
      setEditingShotId(shot.id);
      setEditShotLabel(shot.label);
      setEditShotPrompt(shot.prompt);
  };

  const saveEditingShot = () => {
      if (!editingShotId) return;
      setShotDefs(prev => prev.map(s => 
          s.id === editingShotId 
          ? { ...s, label: editShotLabel, prompt: editShotPrompt } 
          : s
      ));
      setEditingShotId(null);
  };

  const handleSaveScene = async () => {
      if (!name) return alert("请输入场景名称");
      setIsSaving(true);
      const newScene: Scene = {
          id: sceneId || Date.now().toString(),
          ownerId: '', // Placeholder, will be injected by App
          universeId: universeId!,
          storyEggId: eggId!,
          name,
          description,
          images,
          shotDefs, 
          createdAt: existingScene ? existingScene.createdAt : new Date()
      };
      try {
          await onSave(newScene);
          navigate(`/universe/${universeId}/egg/${eggId}`);
      } catch (e) {
          alert("保存失败");
      } finally {
          setIsSaving(false);
      }
  };

  if (!universe || !egg) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-32 relative">
      <button onClick={() => navigate(`/universe/${universeId}/egg/${eggId}`)} className="flex items-center text-slate-400 hover:text-white mb-4">
        <ArrowLeft size={16} className="mr-1" /> 返回故事蛋
      </button>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
            <ImageIcon className="text-cinematic-gold" /> 
            {existingScene ? '编辑场景' : '构建新场景'}
        </h1>
        <button 
            onClick={handleSaveScene}
            disabled={isSaving}
            className="px-6 py-2 bg-cinematic-accent hover:bg-blue-600 text-white font-bold rounded-lg shadow-lg flex items-center gap-2 disabled:opacity-50"
        >
            {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            保存场景
        </button>
      </div>

      {/* TOP SECTION: INPUTS */}
      <div className="bg-cinematic-800 p-6 rounded-xl border border-cinematic-700 shadow-xl mb-8">
           <div className="flex flex-col gap-6">
               <div>
                   <label className="block text-xs font-bold text-slate-400 uppercase mb-2">场景名称</label>
                   <input 
                       type="text"
                       value={name}
                       onChange={e => setName(e.target.value)}
                       className="w-full bg-cinematic-900 border border-cinematic-700 rounded p-3 text-white focus:border-cinematic-accent outline-none text-lg font-bold"
                       placeholder="例如：赛博朋克夜市..."
                   />
               </div>
               
               <div>
                   <div className="flex justify-between items-end mb-2">
                       <label className="block text-xs font-bold text-slate-400 uppercase">
                          场景详细视觉描述 <span className="text-slate-500 font-normal">(AI 生成的图片将基于此描述)</span>
                       </label>
                       <button
                           onClick={handleAIExpand}
                           disabled={isExpanding || !name}
                           className="text-xs flex items-center gap-1 text-cinematic-gold hover:text-amber-300 bg-cinematic-900 px-3 py-1.5 rounded transition-colors disabled:opacity-50 border border-cinematic-700 hover:border-cinematic-gold/30"
                       >
                           {isExpanding ? <Loader2 className="animate-spin" size={12}/> : <Sparkles size={12}/>}
                           AI 智能扩写
                       </button>
                   </div>
                   <textarea 
                       rows={4}
                       value={description}
                       onChange={e => setDescription(e.target.value)}
                       className="w-full bg-cinematic-900 border border-cinematic-700 rounded-lg p-3 text-white focus:border-cinematic-accent outline-none resize-none leading-relaxed"
                       placeholder="描述场景的光照、氛围、关键物体、色彩基调..."
                   />
               </div>
           </div>
      </div>

      {/* BOTTOM SECTION: SHOTS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {shotDefs.map((shot) => {
               const existingImg = images.find(i => i.type === shot.id);
               const isGenerating = loadingSlot === shot.id;
               const refImg = referenceImages[shot.id];
               const isEditing = editingShotId === shot.id;
               
               // Check if auto-consistency will trigger (Not main shot, no specific ref, but main exists)
               const willUseAutoRef = !refImg && shot.id !== 'main' && images.some(i => i.type === 'main');

               return (
                   <div 
                     key={shot.id} 
                     className="group relative bg-cinematic-800 rounded-xl border border-cinematic-700 hover:border-cinematic-gold transition-all hover:shadow-lg flex flex-col"
                   >
                        {/* Image Area - Rounded Top Only */}
                        <div className="aspect-video bg-black relative rounded-t-xl overflow-hidden border-b border-cinematic-700">
                             {existingImg ? (
                                 <>
                                     <img 
                                        src={existingImg.url} 
                                        className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity" 
                                        onClick={() => setViewingImage(existingImg.url)}
                                     />
                                     <div className="absolute bottom-2 right-2 flex gap-1">
                                         <button 
                                            onClick={() => handleDeleteImage(shot.id)}
                                            className="p-1.5 bg-black/60 hover:bg-red-600 text-white rounded-full backdrop-blur"
                                            title="删除图片"
                                         >
                                             <Trash2 size={14} />
                                         </button>
                                     </div>
                                 </>
                             ) : isGenerating ? (
                                 <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                                     <Loader2 className="animate-spin text-cinematic-gold" size={32} />
                                     <span className="text-xs text-slate-500">AI 绘制中...</span>
                                     {willUseAutoRef && <span className="text-[10px] text-cinematic-gold">基于主视图生成...</span>}
                                 </div>
                             ) : (
                                 <div className="w-full h-full flex flex-col items-center justify-center bg-cinematic-900/50">
                                     <Map size={32} className="text-slate-700 mb-2" />
                                     <p className="text-xs text-slate-500">暂无图像</p>
                                 </div>
                             )}

                             {/* Reference Image Badge (Manual) */}
                             {refImg && !existingImg && (
                                 <div className="absolute top-2 left-2 z-20 pointer-events-none">
                                     <div className="flex items-center gap-1 bg-cinematic-800/90 text-cinematic-gold px-2 py-1 rounded text-[10px] font-bold border border-cinematic-gold/30">
                                         <Upload size={10} /> 参考图 ON
                                     </div>
                                 </div>
                             )}

                             {/* Auto Consistency Badge */}
                             {!refImg && !existingImg && willUseAutoRef && !isGenerating && (
                                 <div className="absolute top-2 left-2 z-20 pointer-events-none">
                                     <div className="flex items-center gap-1 bg-cinematic-900/80 text-blue-400 px-2 py-1 rounded text-[10px] font-bold border border-blue-500/30">
                                         <LinkIcon size={10} /> 关联主视图
                                     </div>
                                 </div>
                             )}
                        </div>

                        {/* Footer Content */}
                        <div className="p-4 flex flex-col flex-1 rounded-b-xl bg-cinematic-800">
                            {isEditing ? (
                                <div className="flex flex-col gap-2">
                                     <input 
                                        value={editShotLabel} 
                                        onChange={e => setEditShotLabel(e.target.value)}
                                        className="bg-cinematic-900 border border-cinematic-600 rounded px-2 py-1 text-xs text-white"
                                        placeholder="标题"
                                        autoFocus
                                     />
                                     <textarea 
                                        value={editShotPrompt} 
                                        onChange={e => setEditShotPrompt(e.target.value)}
                                        rows={3}
                                        className="bg-cinematic-900 border border-cinematic-600 rounded px-2 py-1 text-[10px] text-white resize-none"
                                        placeholder="Prompt"
                                     />
                                     <div className="flex justify-end gap-2">
                                         <button onClick={() => setEditingShotId(null)} className="text-[10px] text-slate-400">取消</button>
                                         <button onClick={saveEditingShot} className="text-[10px] bg-cinematic-gold text-black px-2 py-1 rounded">保存</button>
                                     </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex justify-between items-start gap-2 mb-2">
                                        <h3 className="font-bold text-white text-sm truncate flex-1" title={shot.label}>
                                            {shot.label}
                                        </h3>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button 
                                                onClick={() => startEditingShot(shot)}
                                                className="p-1.5 text-slate-400 hover:text-white hover:bg-cinematic-700 rounded transition-colors"
                                                title="编辑卡片信息"
                                            >
                                                <Edit size={14} />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteShotDef(shot.id)}
                                                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-cinematic-700 rounded transition-colors"
                                                title="删除卡片"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <p className="text-[10px] text-slate-400 line-clamp-2 mb-4 min-h-[2.5em]" title={shot.prompt}>
                                        {shot.prompt}
                                    </p>
                                    
                                    <div className="mt-auto flex gap-2 pt-2 border-t border-cinematic-700/50">
                                        <button 
                                            onClick={() => handleGenerateImage(shot)}
                                            disabled={isGenerating}
                                            className="flex-1 py-1.5 bg-cinematic-700 hover:bg-cinematic-600 text-white text-xs font-bold rounded border border-cinematic-600 flex items-center justify-center gap-1 disabled:opacity-50"
                                            title={willUseAutoRef ? "将基于主视图生成一致的场景图" : "生成场景图"}
                                        >
                                            {isGenerating ? <Loader2 size={12} className="animate-spin"/> : <RefreshCw size={12}/>}
                                            {existingImg ? '重绘' : '生成'}
                                        </button>
                                        
                                        {/* Manual Upload Button */}
                                        <div className="relative">
                                            <button 
                                                onClick={() => uploadRefs.current[shot.id]?.click()}
                                                className="h-full px-2.5 rounded border border-cinematic-600 bg-cinematic-800 text-slate-400 hover:text-white hover:border-cinematic-gold flex items-center justify-center transition-colors"
                                                title="手动上传图片"
                                            >
                                                <Upload size={14} />
                                            </button>
                                            <input 
                                                type="file" 
                                                className="hidden" 
                                                accept="image/*"
                                                ref={el => uploadRefs.current[shot.id] = el}
                                                onChange={(e) => handleManualUpload(e, shot.id)}
                                            />
                                        </div>
                                        
                                        {/* Ref Image Button */}
                                        <div className="relative">
                                            <button 
                                                onClick={() => refUploadRefs.current[shot.id]?.click()}
                                                className={`h-full px-2 rounded border flex items-center justify-center transition-colors gap-1 ${
                                                    refImg 
                                                    ? 'bg-cinematic-gold/10 border-cinematic-gold text-cinematic-gold' 
                                                    : 'bg-cinematic-900 border-cinematic-700 text-slate-500 hover:text-white'
                                                }`}
                                                title="上传参考图 (控制构图/风格)"
                                            >
                                                <span className="text-[10px] font-bold">Ref</span>
                                            </button>
                                            <input 
                                                type="file" 
                                                className="hidden" 
                                                accept="image/*"
                                                ref={el => refUploadRefs.current[shot.id] = el}
                                                onChange={(e) => handleRefUpload(e, shot.id)}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                   </div>
               )
           })}

           {/* ADD NEW CARD */}
           {isAddingShot ? (
               <div className="bg-cinematic-800 rounded-xl border border-cinematic-gold p-6 flex flex-col gap-3 animate-in fade-in">
                    <h3 className="text-sm font-bold text-white mb-2">添加新角度</h3>
                    <input 
                       autoFocus
                       value={newShotLabel}
                       onChange={e => setNewShotLabel(e.target.value)}
                       placeholder="视图名称 (如: 04 局部特写)"
                       className="bg-cinematic-900 border border-cinematic-700 rounded px-3 py-2 text-xs text-white outline-none focus:border-cinematic-gold"
                    />
                    <textarea 
                       value={newShotPrompt}
                       onChange={e => setNewShotPrompt(e.target.value)}
                       placeholder="画面描述 (Prompt)"
                       rows={3}
                       className="bg-cinematic-900 border border-cinematic-700 rounded px-3 py-2 text-xs text-white outline-none focus:border-cinematic-gold resize-none"
                    />
                    <div className="flex justify-end gap-2 mt-auto">
                        <button onClick={() => setIsAddingShot(false)} className="text-xs text-slate-400 hover:text-white px-3 py-2">取消</button>
                        <button onClick={handleAddShot} className="text-xs bg-cinematic-gold text-black font-bold px-4 py-2 rounded hover:bg-amber-400">确认添加</button>
                    </div>
               </div>
           ) : (
               <button 
                   onClick={() => setIsAddingShot(true)}
                   className="bg-cinematic-800/30 rounded-xl border-2 border-dashed border-cinematic-700 hover:border-cinematic-gold hover:text-cinematic-gold text-slate-500 flex flex-col items-center justify-center gap-2 min-h-[250px] transition-all"
               >
                   <PlusCircle size={32} />
                   <span className="text-sm font-bold">添加新角度视图</span>
               </button>
           )}
      </div>

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
    </div>
  );
};