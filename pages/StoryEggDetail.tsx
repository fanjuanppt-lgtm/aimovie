
import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Universe, StoryEgg, Character, Storyboard } from '../types';
import { ArrowLeft, UserPlus, Users, ArrowRight, Clapperboard, Film, Edit, Save, X } from 'lucide-react';

interface StoryEggDetailProps {
  universes: Universe[];
  storyEggs: StoryEgg[];
  characters: Character[];
  storyboards: Storyboard[];
  onUpdateEgg: (e: StoryEgg) => Promise<void>;
}

export const StoryEggDetail: React.FC<StoryEggDetailProps> = ({ universes, storyEggs, characters, storyboards, onUpdateEgg }) => {
  const { universeId, eggId } = useParams<{ universeId: string; eggId: string }>();
  const [activeTab, setActiveTab] = useState<'characters' | 'storyboards'>('characters');
  
  const universe = universes.find(u => u.id === universeId);
  const egg = storyEggs.find(e => e.id === eggId);
  
  const eggCharacters = characters.filter(c => c.storyEggId === eggId);
  const eggStoryboards = storyboards.filter(s => s.storyEggId === eggId);

  // Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editPremise, setEditPremise] = useState('');

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

  if (!universe || !egg) return <div className="p-8 text-slate-400">故事档案未找到</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
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
      <div className="flex border-b border-cinematic-700 mb-6">
        <button
          onClick={() => setActiveTab('characters')}
          className={`px-6 py-3 font-medium flex items-center gap-2 transition-colors border-b-2 ${
            activeTab === 'characters' 
            ? 'text-white border-cinematic-gold' 
            : 'text-slate-500 border-transparent hover:text-slate-300'
          }`}
        >
          <Users size={18} /> 角色卡司 ({eggCharacters.length})
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
          <div className="flex justify-end mb-6">
            <Link 
              to={`/universe/${universeId}/egg/${eggId}/character-studio`}
              className="bg-cinematic-accent hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-transform hover:scale-105"
            >
              <UserPlus size={18} /> 创建新角色
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in duration-300">
            {eggCharacters.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-500">
                <p>该故事暂无角色。</p>
              </div>
            )}
            {eggCharacters.map(char => (
              <div key={char.id} className="group bg-cinematic-800 rounded-xl overflow-hidden border border-cinematic-700 hover:border-cinematic-accent transition-all relative">
                
                {/* Edit Button Overlay */}
                <Link 
                  to={`/universe/${universeId}/egg/${eggId}/character-studio/${char.id}`}
                  className="absolute top-2 right-2 z-10 p-2 bg-black/50 hover:bg-cinematic-gold hover:text-black rounded-full text-white opacity-0 group-hover:opacity-100 transition-all"
                  title="编辑角色档案"
                >
                   <Edit size={14} />
                </Link>

                <div className="aspect-[3/4] bg-black relative">
                  {char.images && char.images.length > 0 ? (
                    <img src={char.images[0].url} alt={char.roots.name} className="w-full h-full object-cover" />
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
                   <p className="text-sm text-slate-400 line-clamp-2 mb-3">{char.summary}</p>
                </div>
              </div>
            ))}
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
               <div key={sb.id} className="bg-cinematic-800 rounded-xl border border-cinematic-700 overflow-hidden group">
                 <div className="p-4 border-b border-cinematic-700 bg-cinematic-900/50 flex justify-between items-center">
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
                       {sb.frames.slice(0, 5).map((frame, i) => (
                         <div key={i} className="flex-shrink-0 w-48 aspect-video bg-black rounded overflow-hidden border border-slate-700 relative group">
                            {frame.imageUrl && <img src={frame.imageUrl} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />}
                            <span className="absolute bottom-1 left-1 text-[10px] bg-black/50 text-white px-1 rounded">{i+1}</span>
                         </div>
                       ))}
                       {sb.frames.length > 5 && (
                         <div className="flex-shrink-0 w-24 flex items-center justify-center bg-cinematic-700 text-slate-400 text-xs rounded">
                           +{sb.frames.length - 5} frames
                         </div>
                       )}
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
