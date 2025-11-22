import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Universe, StoryEgg, UniverseType } from '../types';
import { ArrowLeft, Egg, Plus, ArrowRight, Calendar, Edit, Save, X } from 'lucide-react';

interface UniverseDetailProps {
  universes: Universe[];
  storyEggs: StoryEgg[];
  onSaveEgg: (egg: StoryEgg) => Promise<void>;
  onUpdateUniverse: (u: Universe) => Promise<void>;
}

export const UniverseDetail: React.FC<UniverseDetailProps> = ({ universes, storyEggs, onSaveEgg, onUpdateUniverse }) => {
  const { universeId } = useParams<{ universeId: string }>();
  const universe = universes.find(u => u.id === universeId);
  const myEggs = storyEggs.filter(e => e.universeId === universeId);

  const [isCreating, setIsCreating] = useState(false);
  const [newEggTitle, setNewEggTitle] = useState('');
  const [newEggPremise, setNewEggPremise] = useState('');

  // Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editRules, setEditRules] = useState('');
  const [editType, setEditType] = useState<UniverseType>(UniverseType.ADAPTED);

  const handleCreateEgg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEggTitle || !universeId) return;

    const newEgg: StoryEgg = {
      id: Date.now().toString(),
      universeId: universeId,
      title: newEggTitle,
      premise: newEggPremise,
      createdAt: new Date()
    };

    await onSaveEgg(newEgg);
    setIsCreating(false);
    setNewEggTitle('');
    setNewEggPremise('');
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

  if (!universe) return <div className="p-8 text-slate-400">宇宙未找到</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <Link to="/" className="inline-flex items-center text-slate-400 hover:text-white mb-6 transition-colors">
        <ArrowLeft size={16} className="mr-2" /> 返回多元宇宙视图
      </Link>

      <div className="mb-10 border-b border-cinematic-700 pb-8 relative">
        {/* Header Actions */}
        <div className="absolute top-0 right-0">
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
            <h1 className="text-4xl font-bold text-white mb-4">{universe.name}</h1>
            <p className="text-lg text-slate-400 max-w-3xl">{universe.description}</p>
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
              <span className="px-3 py-1 bg-cinematic-800 rounded border border-cinematic-700">{universe.type}</span>
              <span className="px-3 py-1 bg-cinematic-800 rounded border border-cinematic-700">规则：{universe.rules}</span>
            </div>
          </>
        ) : (
          <div className="space-y-4 bg-cinematic-800/50 p-6 rounded-xl border border-cinematic-700 border-dashed">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1 uppercase">宇宙名称</label>
                <input 
                  value={editName} 
                  onChange={e => setEditName(e.target.value)}
                  className="w-full bg-cinematic-900 border border-cinematic-700 rounded px-3 py-2 text-white focus:border-cinematic-accent outline-none"
                />
              </div>
              <div>
                 <label className="block text-xs text-slate-500 mb-1 uppercase">类型</label>
                 <select 
                    value={editType}
                    onChange={e => setEditType(e.target.value as UniverseType)}
                    className="w-full bg-cinematic-900 border border-cinematic-700 rounded px-3 py-2 text-white focus:border-cinematic-accent outline-none"
                 >
                    {Object.values(UniverseType).map(t => <option key={t} value={t}>{t}</option>)}
                 </select>
              </div>
            </div>
            <div>
               <label className="block text-xs text-slate-500 mb-1 uppercase">背景设定</label>
               <textarea 
                 value={editDesc} 
                 onChange={e => setEditDesc(e.target.value)}
                 rows={3}
                 className="w-full bg-cinematic-900 border border-cinematic-700 rounded px-3 py-2 text-white focus:border-cinematic-accent outline-none resize-none"
               />
            </div>
            <div>
               <label className="block text-xs text-slate-500 mb-1 uppercase">核心规则</label>
               <textarea 
                 value={editRules} 
                 onChange={e => setEditRules(e.target.value)}
                 rows={3}
                 className="w-full bg-cinematic-900 border border-cinematic-700 rounded px-3 py-2 text-white focus:border-cinematic-accent outline-none resize-none"
               />
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Egg className="text-cinematic-gold" /> 故事孵化器 (Story Eggs)
        </h2>
        <button 
          onClick={() => setIsCreating(!isCreating)}
          className="bg-cinematic-accent hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus size={18} /> 孵化新故事
        </button>
      </div>

      {isCreating && (
        <div className="mb-8 bg-cinematic-800 p-6 rounded-xl border border-cinematic-700 animate-in slide-in-from-top-4 duration-300">
          <h3 className="text-lg font-semibold text-white mb-4">设定新故事雏形</h3>
          <form onSubmit={handleCreateEgg} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">故事标题 (Project Name)</label>
              <input 
                type="text" 
                required
                value={newEggTitle}
                onChange={e => setNewEggTitle(e.target.value)}
                className="w-full bg-cinematic-900 border border-cinematic-700 rounded p-3 text-white focus:border-cinematic-accent outline-none"
                placeholder="例如：暗夜行动 / 寻找阿瓦隆"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">故事梗概 (Premise)</label>
              <textarea 
                required
                rows={3}
                value={newEggPremise}
                onChange={e => setNewEggPremise(e.target.value)}
                className="w-full bg-cinematic-900 border border-cinematic-700 rounded p-3 text-white focus:border-cinematic-accent outline-none resize-none"
                placeholder="一句话描述这个故事的核心冲突或主题..."
              />
            </div>
            <div className="flex justify-end gap-3">
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
            <p>该宇宙下暂无故事蛋，请点击“孵化新故事”开始创作。</p>
          </div>
        )}

        {myEggs.map(egg => (
          <Link 
            key={egg.id} 
            to={`/universe/${universeId}/egg/${egg.id}`}
            className="block group bg-cinematic-800 rounded-xl border border-cinematic-700 overflow-hidden hover:border-cinematic-gold transition-all hover:shadow-lg hover:shadow-amber-900/10"
          >
             <div className="p-6">
               <div className="flex justify-between items-start mb-4">
                 <div className="w-10 h-10 rounded-full bg-cinematic-900 flex items-center justify-center text-cinematic-gold group-hover:scale-110 transition-transform">
                   <Egg size={20} />
                 </div>
                 <span className="text-xs text-slate-500 flex items-center gap-1">
                   <Calendar size={12} /> {new Date(egg.createdAt).toLocaleDateString()}
                 </span>
               </div>
               <h3 className="text-xl font-bold text-white mb-2 group-hover:text-cinematic-gold transition-colors">{egg.title}</h3>
               <p className="text-slate-400 text-sm line-clamp-3 mb-6 h-10">{egg.premise}</p>
               
               <div className="flex items-center text-sm text-cinematic-accent font-medium">
                 进入故事空间 <ArrowRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
               </div>
             </div>
          </Link>
        ))}
      </div>
    </div>
  );
};