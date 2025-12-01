import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Universe, StoryEgg, Character, Storyboard, Scene } from '../types';
import { ArrowLeft, UserPlus, Users, ArrowRight, Clapperboard, Film, Edit, Save, X, Image as ImageIcon, Map, Trash2, RotateCcw, Ban, GripVertical } from 'lucide-react';

interface StoryEggDetailProps {
  universes: Universe[];
  storyEggs: StoryEgg[];
  characters: Character[];
  storyboards: Storyboard[];
  scenes: Scene[];
  onUpdateEgg: (e: StoryEgg) => Promise<void>;
  onUpdateCharacter: (c: Character) => Promise<void>;
  onDeleteCharacter: (id: string) => Promise<void>;
  onRestoreCharacter: (id: string) => Promise<void>;
  onHardDeleteCharacter: (id: string) => Promise<void>;
  onUpdateStoryboard: (s: Storyboard) => Promise<void>;
}

export const StoryEggDetail: React.FC<StoryEggDetailProps> = ({ 
    universes, storyEggs, characters, storyboards, scenes, 
    onUpdateEgg, onUpdateCharacter, onDeleteCharacter, onRestoreCharacter, onHardDeleteCharacter, onUpdateStoryboard
}) => {
  const navigate = useNavigate();
  const { universeId, eggId } = useParams<{ universeId: string; eggId: string }>();
  const [activeTab, setActiveTab] = useState<'characters' | 'scenes' | 'storyboards'>('characters');
  
  const universe = universes.find(u => u.id === universeId);
  const egg = storyEggs.find(e => e.id === eggId);
  
  // Filter by Egg ID
  const allEggCharacters = characters.filter(c => c.storyEggId === eggId);
  
  // Separate Active and Deleted characters
  // Sort Active Characters by orderIndex
  const activeCharacters = allEggCharacters
    .filter(c => !c.deletedAt)
    .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

  const deletedCharacters = allEggCharacters.filter(c => !!c.deletedAt);

  // Filter and Sort Storyboards
  const eggStoryboards = storyboards
    .filter(s => s.storyEggId === eggId)
    .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    
  const eggScenes = scenes.filter(s => s.storyEggId === eggId);

  // Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editPremise, setEditPremise] = useState('');

  // Trash UI State
  const [showCharTrash, setShowCharTrash] = useState(false);
  
  // Drag State (Shared for both characters and storyboards since they are in different tabs)
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const startEditing = () => {
    if (!egg) return;
    setEditTitle(egg.title);
    setEditPremise(egg.premise);
    setIsEditing(true);
  };

  const saveEditing = async () => {
    if (!egg) return;
    const updatedEgg: StoryEgg = {
      ...egg,
      title: editTitle,
      premise: editPremise
    };
    await onUpdateEgg(updatedEgg);
    setIsEditing(false);
  };

  const handleDeleteChar = async (id: string) => {
      // 使用 window.confirm 确保用户意图，且阻止任何默认行为
      if(window.confirm("确定要将此角色移入回收站吗？\n（可在回收站中恢复）")) {
          await onDeleteCharacter(id);
      }
  };
  
  const handleHardDeleteChar = async (id: string) => {
      if(window.confirm("【警告】确定要永久粉碎此角色档案吗？此操作不可撤销！")) {
          await onHardDeleteCharacter(id);
      }
  };

  // --- GENERIC DRAG HANDLERS ---
  const handleDragStart = (e: React.DragEvent, id: string) => {
      setDraggedId(id);
      e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault(); // Necessary to allow dropping
      e.dataTransfer.dropEffect = "move";
  };

  // --- CHARACTER DROP HANDLER ---
  const handleCharDrop = async (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      if (!draggedId || draggedId === targetId) return;

      const sourceIndex = activeCharacters.findIndex(c => c.id === draggedId);
      const targetIndex = activeCharacters.findIndex(c => c.id === targetId);

      if (sourceIndex === -1 || targetIndex === -1) return;

      const newOrder = [...activeCharacters];
      const [movedChar] = newOrder.splice(sourceIndex, 1);
      newOrder.splice(targetIndex, 0, movedChar);

      // Update DB
      for (let i = 0; i < newOrder.length; i++) {
          const char = newOrder[i];
          if (char.orderIndex !== i) {
             const updated = { ...char, orderIndex: i };
             await onUpdateCharacter(updated);
          }
      }
      setDraggedId(null);
  };

  // --- STORYBOARD DROP HANDLER ---
  const handleStoryboardDrop = async (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      if (!draggedId || draggedId === targetId) return;

      const sourceIndex = eggStoryboards.findIndex(s => s.id === draggedId);
      const targetIndex = eggStoryboards.findIndex(s => s.id === targetId);

      if (sourceIndex === -1 || targetIndex === -1) return;

      const newOrder = [...eggStoryboards];
      const [movedSb] = newOrder.splice(sourceIndex, 1);
      newOrder.splice(targetIndex, 0, movedSb);

      // Update DB
      for (let i = 0; i < newOrder.length; i++) {
          const sb = newOrder[i];
          if (sb.orderIndex !== i) {
              const updated = { ...sb, orderIndex: i };
              await onUpdateStoryboard(updated);
          }
      }
      setDraggedId(null);
  };

  if (!universe || !egg) return <div className="p-8 text-slate-400">故事档案未找到</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto pb-32">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <Link to="/" className="hover:text-white transition-colors">首页</Link>
        <span>/</span>
        <Link to={`/universe/${universeId}`} className="hover:text-white transition-colors">{universe.name}</Link>
        <span>/</span>
        <span className="text-cinematic-gold">{egg.title}</span>
      </div>

      <div className="bg-cinematic-800/50 rounded-2xl border border-cinematic-700 p-8 mb-8 relative">
         {/* Header Actions */}
         <div className="absolute top-6 right-6">
          {!isEditing ? (
            <button 
              onClick={startEditing}
              className="p-2 text-slate-400 hover:text-cinematic-gold hover:bg-cinematic-800 rounded-lg transition-colors flex items-center gap-2"
            >
              <Edit size={18} /> <span className="text-sm">修改故事</span>
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

        {!isEditing ? (
          <div className="flex flex-col md:flex-row justify-between items-start gap-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{egg.title}</h1>
              <p className="text-slate-300 text-lg">{egg.premise}</p>
              <p className="text-sm text-slate-500 mt-4">所属宇宙：{universe.name} | 类型：{universe.type}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-2xl">
            <div>
               <label className="block text-xs text-slate-500 mb-1 uppercase">故事标题</label>
               <input 
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="w-full bg-cinematic-900 border border-cinematic-700 rounded px-3 py-2 text-white focus:border-cinematic-accent outline-none"
               />
            </div>
            <div>
               <label className="block text-xs text-slate-500 mb-1 uppercase">故事梗概</label>
               <textarea 
                  value={editPremise}
                  onChange={e => setEditPremise(e.target.value)}
                  rows={3}
                  className="w-full bg-cinematic-900 border border-cinematic-700 rounded px-3 py-2 text-white focus:border-cinematic-accent outline-none resize-none"
               />
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-cinematic-700 mb-6 overflow-x-auto whitespace-nowrap">
        <button
          onClick={() => setActiveTab('characters')}
          className={`px-6 py-3 font-medium flex items-center gap-2 transition-colors border-b-2 ${
            activeTab === 'characters' 
            ? 'text-white border-cinematic-gold' 
            : 'text-slate-500 border-transparent hover:text-slate-300'
          }`}
        >
          <Users size={18} /> 角色卡司 ({activeCharacters.length})
        </button>
        <button
          onClick={() => setActiveTab('scenes')}
          className={`px-6 py-3 font-medium flex items-center gap-2 transition-colors border-b-2 ${
            activeTab === 'scenes' 
            ? 'text-white border-cinematic-gold' 
            : 'text-slate-500 border-transparent hover:text-slate-300'
          }`}
        >
          <Map size={18} /> 场景概览 ({eggScenes.length})
        </button>
        <button
          onClick={() => setActiveTab('storyboards')}
          className={`px-6 py-3 font-medium flex items-center gap-2 transition-colors border-b-2 ${
            activeTab === 'storyboards' 
            ? 'text-white border-cinematic-gold' 
            : 'text-slate-500 border-transparent hover:text-slate-300'
          }`}
        >
          <Clapperboard size={18} /> 分镜故事板 ({eggStoryboards.length})
        </button>
      </div>

      {/* Characters Tab */}
      {activeTab === 'characters' && (
        <>
          <div className="flex justify-between items-center mb-6">
             {/* Left: Trash Bin Button */}
             <button
               onClick={() => setShowCharTrash(true)}
               className="text-slate-500 hover:text-slate-300 flex items-center gap-2 text-sm px-3 py-2 rounded hover:bg-cinematic-800 transition-colors"
             >
                 <Trash2 size={16} /> 
                 <span>回收站</span>
                 {deletedCharacters.length > 0 && (
                     <span className="bg-red-900 text-red-100 text-[10px] px-1.5 rounded-full">{deletedCharacters.length}</span>
                 )}
             </button>

             {/* Right: Create Button */}
             <Link 
              to={`/universe/${universeId}/egg/${eggId}/character-studio`}
              className="bg-cinematic-accent hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-transform hover:scale-105"
            >
              <UserPlus size={18} /> 创建新角色
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in duration-300">
            {activeCharacters.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-500">
                <p>该故事暂无角色。</p>
              </div>
            )}
            {activeCharacters.map(char => (
              <div 
                key={char.id} 
                draggable
                onDragStart={(e) => handleDragStart(e, char.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleCharDrop(e, char.id)}
                className={`group relative bg-cinematic-800 rounded-xl overflow-hidden border border-cinematic-700 hover:border-cinematic-accent transition-all hover:shadow-xl ${draggedId === char.id ? 'opacity-50' : 'opacity-100'}`}
              >
                
                {/* 1. ACTIONS OVERLAY (Highest Z-Index) - Absolutely Positioned */}
                <div className="absolute top-3 right-3 z-50 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button 
                        type="button"
                        onClick={(e) => {
                             e.preventDefault();
                             e.nativeEvent.stopImmediatePropagation();
                             handleDeleteChar(char.id);
                        }}
                        className="p-2.5 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-500 hover:scale-110 transition-all cursor-pointer"
                        title="移入回收站"
                    >
                         <Trash2 size={16} />
                    </button>
                    <button 
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation(); // Prevent Link click
                            navigate(`/universe/${universeId}/egg/${eggId}/character-studio/${char.id}`);
                        }}
                        className="p-2.5 bg-cinematic-gold text-black rounded-full shadow-lg hover:bg-amber-400 hover:scale-110 transition-all cursor-pointer"
                        title="编辑角色档案"
                    >
                        <Edit size={16} />
                    </button>
                </div>

                {/* 2. DRAG HANDLE (Top Left) */}
                <div 
                    className="absolute top-3 left-3 z-50 p-1.5 bg-black/50 text-slate-300 rounded cursor-move opacity-0 group-hover:opacity-100 transition-opacity hover:bg-cinematic-gold hover:text-black"
                    title="按住拖动排序"
                >
                     <GripVertical size={16} />
                </div>

                {/* 3. CLICKABLE CONTENT */}
                <div 
                    onClick={() => navigate(`/universe/${universeId}/egg/${eggId}/character-studio/${char.id}`)}
                    className="block h-full w-full cursor-pointer"
                >
                    <div className="aspect-[3/4] bg-black relative">
                        {char.images && char.images.filter(img => !img.deletedAt).length > 0 ? (
                            <img src={char.images.filter(img => !img.deletedAt)[0].url} alt={char.roots.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-cinematic-900 text-slate-600">无影像</div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-60" />
                        <div className="absolute bottom-0 left-0 w-full p-4">
                            <h3 className="text-xl font-bold text-white">{char.roots.name}</h3>
                            <p className="text-xs text-cinematic-gold">{char.roots.educationJob}</p>
                        </div>
                    </div>
                    <div className="p-4">
                        <p className="text-sm text-slate-400 line-clamp-2 mb-3">{char.summary || "暂无描述"}</p>
                    </div>
                </div>

              </div>
            ))}
          </div>

          {/* Character Trash Modal */}
          {showCharTrash && (
               <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in p-4">
                 <div className="bg-cinematic-900 border border-cinematic-700 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
                    <div className="p-4 border-b border-cinematic-700 flex justify-between items-center bg-cinematic-800/50 rounded-t-xl">
                       <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                         <Trash2 className="text-red-400" /> 角色回收站 ({deletedCharacters.length})
                       </h3>
                       <button onClick={() => setShowCharTrash(false)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white"><X size={20} /></button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-cinematic-900">
                      {deletedCharacters.length === 0 ? (
                        <div className="h-48 flex flex-col items-center justify-center text-slate-600">
                           <Trash2 size={48} className="mb-4 opacity-20" />
                           <p>回收站是空的。</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                           {deletedCharacters.map(char => (
                             <div key={char.id} className="relative aspect-[3/4] bg-black rounded-lg overflow-hidden border border-red-900/30 group">
                                {char.images && char.images.length > 0 ? (
                                     <img src={char.images[0].url} className="w-full h-full object-cover opacity-50 grayscale" alt="Deleted" />
                                ) : (
                                     <div className="w-full h-full bg-cinematic-800 flex items-center justify-center text-slate-600">无图</div>
                                )}
                                
                                <div className="absolute top-0 left-0 p-2 w-full bg-gradient-to-b from-black/80 to-transparent">
                                     <span className="text-white font-bold text-sm">{char.roots.name}</span>
                                </div>

                                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity p-4">
                                   <button 
                                     onClick={() => onRestoreCharacter(char.id)}
                                     className="w-full py-2 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded flex items-center justify-center gap-1"
                                   >
                                     <RotateCcw size={14} /> 恢复档案
                                   </button>
                                   <button 
                                     onClick={() => handleHardDeleteChar(char.id)}
                                     className="w-full py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded flex items-center justify-center gap-1"
                                   >
                                     <Ban size={14} /> 彻底粉碎
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
        </>
      )}

      {/* Scenes Tab */}
      {activeTab === 'scenes' && (
        <>
            <div className="flex justify-end mb-6">
            <Link 
              to={`/universe/${universeId}/egg/${eggId}/scene-studio`}
              className="bg-cinematic-accent hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-transform hover:scale-105"
            >
              <ImageIcon size={18} /> 构建新场景
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
             {eggScenes.length === 0 && (
               <div className="col-span-full py-12 text-center text-slate-500 border-2 border-dashed border-cinematic-700 rounded-xl">
                 <Map size={48} className="mx-auto mb-3 opacity-20" />
                 <p>暂无场景，请点击“构建新场景”开始创作。</p>
               </div>
             )}
             {eggScenes.map(scene => {
                 const mainImg = scene.images.find(i => i.type === 'main');
                 return (
                     <Link 
                        key={scene.id}
                        to={`/universe/${universeId}/egg/${eggId}/scene-studio/${scene.id}`}
                        className="block group bg-cinematic-800 rounded-xl border border-cinematic-700 overflow-hidden hover:border-cinematic-gold transition-all hover:shadow-lg"
                     >
                         <div className="aspect-video bg-black relative">
                             {mainImg ? (
                                 <img src={mainImg.url} alt={scene.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                             ) : (
                                 <div className="w-full h-full flex items-center justify-center text-slate-600">无场景图</div>
                             )}
                             <div className="absolute inset-0 bg-gradient-to-t from-cinematic-900 to-transparent opacity-80" />
                             <div className="absolute bottom-0 left-0 p-4 w-full">
                                 <h3 className="text-xl font-bold text-white mb-1">{scene.name}</h3>
                                 <div className="flex gap-2 text-xs text-slate-400">
                                     <span>{scene.images.length} 张视图</span>
                                 </div>
                             </div>
                         </div>
                         <div className="p-4">
                             <p className="text-sm text-slate-400 line-clamp-2">{scene.description}</p>
                         </div>
                     </Link>
                 )
             })}
          </div>
        </>
      )}

      {/* Storyboards Tab */}
      {activeTab === 'storyboards' && (
        <>
          <div className="flex justify-end mb-6">
             <Link 
               to={`/universe/${universeId}/egg/${eggId}/storyboard-creator`}
               className="bg-cinematic-gold hover:bg-amber-400 text-black font-bold px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-amber-900/20 transition-transform hover:scale-105"
             >
               <Film size={18} /> 新建分镜场景
             </Link>
          </div>
          <div className="grid grid-cols-1 gap-6 animate-in fade-in duration-300">
             {eggStoryboards.length === 0 && (
               <div className="py-12 text-center text-slate-500 border-2 border-dashed border-cinematic-700 rounded-xl">
                 <Clapperboard size={48} className="mx-auto mb-3 opacity-20" />
                 <p>暂无分镜故事板。</p>
                 <p className="text-sm">输入剧情，AI 帮您自动生成导演级分镜。</p>
               </div>
             )}
             {eggStoryboards.map(sb => (
               <div 
                  key={sb.id} 
                  draggable
                  onDragStart={(e) => handleDragStart(e, sb.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleStoryboardDrop(e, sb.id)}
                  className={`bg-cinematic-800 rounded-xl border border-cinematic-700 overflow-hidden group transition-all relative ${draggedId === sb.id ? 'opacity-50 border-cinematic-gold' : 'opacity-100 hover:border-cinematic-gold'}`}
               >
                 {/* DRAG HANDLE */}
                 <div 
                    className="absolute top-2 left-2 z-20 p-1.5 bg-black/50 text-slate-300 rounded cursor-move opacity-0 group-hover:opacity-100 transition-opacity hover:bg-cinematic-gold hover:text-black"
                    title="按住拖动排序"
                 >
                     <GripVertical size={16} />
                 </div>

                 <div className="p-4 border-b border-cinematic-700 bg-cinematic-900/50 flex justify-between items-center pl-10">
                    <div className="flex items-center gap-3">
                        <h3 className="text-lg font-bold text-white">{sb.title}</h3>
                        <Link 
                          to={`/universe/${universeId}/egg/${eggId}/storyboard-creator/${sb.id}`}
                          className="p-1.5 text-slate-500 hover:text-cinematic-gold hover:bg-cinematic-800 rounded transition-colors"
                          title="编辑分镜"
                        >
                           <Edit size={14} />
                        </Link>
                    </div>
                    <span className="text-xs text-slate-500">{new Date(sb.createdAt).toLocaleDateString()}</span>
                 </div>
                 <div className="p-4">
                    <p className="text-sm text-slate-400 mb-4 line-clamp-2">{sb.plotSummary}</p>
                    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
                       {sb.frames.slice(0, 6).map((frame, i) => (
                         <div key={i} className="flex-shrink-0 w-48 aspect-video bg-black rounded overflow-hidden border border-slate-700 relative group/frame">
                            {frame.imageUrl && <img src={frame.imageUrl} className="w-full h-full object-cover opacity-80 group-hover/frame:opacity-100 transition-opacity" />}
                            <span className="absolute bottom-1 left-1 text-[10px] bg-black/50 text-white px-1 rounded">{i+1}</span>
                         </div>
                       ))}
                    </div>
                 </div>
               </div>
             ))}
          </div>
        </>
      )}
    </div>
  );
};