import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Universe, StoryEgg, Character, Storyboard, StoryboardFrame, GenerationState } from '../types';
import { generateStoryboardPlan, generateStoryboardFrameImage } from '../services/geminiService';
import { ArrowLeft, Clapperboard, Loader2, CheckSquare, Square, Save, RefreshCw } from 'lucide-react';

interface StoryboardCreatorProps {
  universes: Universe[];
  storyEggs: StoryEgg[];
  characters: Character[];
  storyboards: Storyboard[]; // Need existing storyboards to edit
  onSave: (s: Storyboard) => Promise<void>;
}

export const StoryboardCreator: React.FC<StoryboardCreatorProps> = ({ universes, storyEggs, characters, storyboards, onSave }) => {
  const navigate = useNavigate();
  const { universeId, eggId, storyboardId } = useParams<{ universeId: string; eggId: string; storyboardId?: string }>();
  
  const universe = universes.find(u => u.id === universeId);
  const egg = storyEggs.find(e => e.id === eggId);
  const availableCharacters = characters.filter(c => c.storyEggId === eggId);

  // Form State
  const [sceneTitle, setSceneTitle] = useState('');
  const [plotInput, setPlotInput] = useState('');
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);
  const [frames, setFrames] = useState<StoryboardFrame[]>([]);
  
  // UI State
  const [genState, setGenState] = useState<GenerationState>({ isLoading: false, status: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Load data if editing
  useEffect(() => {
    if (storyboardId && storyboards.length > 0) {
      const existingSb = storyboards.find(s => s.id === storyboardId);
      if (existingSb) {
        setSceneTitle(existingSb.title);
        setPlotInput(existingSb.plotSummary);
        setFrames(existingSb.frames);
        setIsEditing(true);
      }
    }
  }, [storyboardId, storyboards]);

  const toggleCharSelection = (id: string) => {
    setSelectedCharIds(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleGeneratePlan = async () => {
    if (!plotInput || !universe || !egg) return alert("请输入剧情内容");
    
    // Warn if overwriting in edit mode
    if (frames.length > 0) {
        if (!window.confirm("重新生成将会覆盖当前所有分镜画面，是否继续？")) return;
    }

    const selectedChars = availableCharacters.filter(c => selectedCharIds.includes(c.id));
    const charNames = selectedChars.map(c => c.roots.name);

    setGenState({ isLoading: true, status: 'AI 导演正在拆解剧本分镜...' });
    setFrames([]); // Reset

    try {
      const context = `Universe: ${universe.name}, ${universe.type}. Story: ${egg.title}`;
      const plan = await generateStoryboardPlan(context, plotInput, charNames);
      
      const initialFrames: StoryboardFrame[] = plan.map((p, idx) => ({
        id: Date.now() + idx + '',
        ...p
      }));
      
      setFrames(initialFrames);
      setGenState({ isLoading: false, status: '' });
    } catch (error) {
      setGenState({ isLoading: false, status: '', error: '剧本拆解失败' });
    }
  };

  const handleGenerateImages = async () => {
    if (frames.length === 0) return;
    
    const selectedChars = availableCharacters.filter(c => selectedCharIds.includes(c.id));
    setGenState({ isLoading: true, status: '美术部门正在绘制分镜...' });

    const newFrames = [...frames];
    
    for (let i = 0; i < newFrames.length; i++) {
      if (newFrames[i].imageUrl) continue; // Skip existing images to save time/tokens

      setGenState({ isLoading: true, status: `正在绘制镜头 ${i + 1} / ${newFrames.length}...` });
      try {
        const imgUrl = await generateStoryboardFrameImage(newFrames[i], selectedChars);
        newFrames[i] = { ...newFrames[i], imageUrl: imgUrl };
        setFrames([...newFrames]); // Trigger re-render to show progress
      } catch (e) {
        console.error(`Frame ${i} failed`, e);
      }
    }
    
    setGenState({ isLoading: false, status: '' });
  };

  const handleSave = async () => {
    if (!sceneTitle || frames.length === 0) return alert("请填写场景标题并生成分镜");
    
    setIsSaving(true);
    
    // Use existing ID if editing, otherwise create new
    const idToUse = storyboardId || Date.now().toString();
    const createdAtToUse = (storyboardId && storyboards.find(s => s.id === storyboardId)?.createdAt) || new Date();

    const storyboard: Storyboard = {
      id: idToUse,
      universeId: universeId!,
      storyEggId: eggId!,
      title: sceneTitle,
      plotSummary: plotInput,
      frames: frames,
      createdAt: createdAtToUse
    };

    try {
      await onSave(storyboard);
      navigate(`/universe/${universeId}/egg/${eggId}`);
    } catch (e) {
      alert("保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  if (!universe || !egg) return <div>Loading...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto pb-20">
      <button onClick={() => navigate(`/universe/${universeId}/egg/${eggId}`)} className="flex items-center text-slate-400 hover:text-white mb-4">
        <ArrowLeft size={16} className="mr-1" /> 返回故事蛋
      </button>

      <h1 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
        <Clapperboard className="text-cinematic-gold" /> 
        {isEditing ? '编辑分镜故事板' : '智能分镜工坊'}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Panel: Inputs */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-cinematic-800 p-6 rounded-xl border border-cinematic-700">
            <h3 className="text-lg font-bold text-white mb-4">1. 场景设定</h3>
            
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">场景标题</label>
              <input 
                type="text"
                value={sceneTitle}
                onChange={e => setSceneTitle(e.target.value)}
                className="w-full bg-cinematic-900 border border-cinematic-700 rounded p-3 text-white focus:border-cinematic-accent outline-none"
                placeholder="例如：雨夜追逐 / 咖啡馆谈判"
              />
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">剧情片段 (Script Beat)</label>
              <textarea 
                rows={5}
                value={plotInput}
                onChange={e => setPlotInput(e.target.value)}
                className="w-full bg-cinematic-900 border border-cinematic-700 rounded p-3 text-white focus:border-cinematic-accent outline-none resize-none"
                placeholder="描述这一场戏发生了什么。例如：男主角在雨中奔跑，回头看到反派正在逼近，他摔倒在水坑里，绝望地看着前方..."
              />
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">参演角色 (用于保持形象)</label>
              <div className="max-h-40 overflow-y-auto space-y-2 border border-cinematic-700 rounded p-2 bg-cinematic-900">
                {availableCharacters.length === 0 && <div className="text-slate-500 text-sm p-2">暂无角色，请先去角色工坊创建。</div>}
                {availableCharacters.map(char => (
                  <div 
                    key={char.id} 
                    onClick={() => toggleCharSelection(char.id)}
                    className="flex items-center gap-2 p-2 hover:bg-cinematic-800 rounded cursor-pointer"
                  >
                    {selectedCharIds.includes(char.id) 
                      ? <CheckSquare size={16} className="text-cinematic-accent" /> 
                      : <Square size={16} className="text-slate-500" />}
                    <span className="text-sm text-slate-200">{char.roots.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <button 
              onClick={handleGeneratePlan}
              disabled={genState.isLoading || !plotInput}
              className="w-full py-3 bg-cinematic-accent hover:bg-blue-600 text-white font-bold rounded-lg transition-all flex justify-center items-center gap-2 disabled:opacity-50"
            >
              {genState.isLoading && frames.length === 0 ? <Loader2 className="animate-spin" /> : (frames.length > 0 ? '重新生成分镜列表' : '2. AI 拆解分镜列表')}
            </button>
            {frames.length > 0 && <p className="text-xs text-amber-500 mt-2">* 重新生成将清空当前画面</p>}
          </div>

          {frames.length > 0 && (
             <button 
               onClick={handleSave}
               disabled={isSaving || genState.isLoading}
               className="w-full py-4 bg-cinematic-gold hover:bg-amber-400 text-black font-bold rounded-lg shadow-lg transition-all flex justify-center items-center gap-2"
             >
               {isSaving ? <Loader2 className="animate-spin" /> : <><Save size={20} /> {isEditing ? '保存修改' : '保存分镜故事板'}</>}
             </button>
          )}
        </div>

        {/* Right Panel: Storyboard Preview */}
        <div className="lg:col-span-2">
           {frames.length === 0 ? (
             <div className="h-full border-2 border-dashed border-cinematic-700 rounded-xl flex flex-col items-center justify-center text-slate-500 min-h-[400px]">
               <Clapperboard size={48} className="mb-4 opacity-20" />
               <p>输入剧情并点击生成，AI 将为您构建可视化分镜。</p>
             </div>
           ) : (
             <div className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                   <h3 className="text-white font-semibold">分镜预览 ({frames.length} shots)</h3>
                   <button 
                     onClick={handleGenerateImages}
                     disabled={genState.isLoading}
                     className="text-sm bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded text-white flex items-center gap-2"
                   >
                     <RefreshCw size={14} /> 补充/重绘缺失图片
                   </button>
                </div>

                {genState.isLoading && (
                  <div className="bg-cinematic-accent/10 text-cinematic-accent px-4 py-2 rounded border border-cinematic-accent/20 flex items-center gap-2 mb-4">
                     <Loader2 className="animate-spin" size={16} /> {genState.status}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {frames.map((frame, index) => (
                     <div key={frame.id} className="bg-white text-black rounded overflow-hidden shadow-xl flex flex-col">
                        <div className="aspect-video bg-slate-200 relative">
                          {frame.imageUrl ? (
                            <img src={frame.imageUrl} alt={frame.description} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-800">
                               <span className="text-xs">等待绘制...</span>
                            </div>
                          )}
                          <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
                            Shot {index + 1}
                          </div>
                        </div>
                        <div className="p-4 flex-1 flex flex-col">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider bg-slate-200 px-2 py-1 rounded">{frame.shotType}</span>
                            <span className="text-xs font-semibold text-slate-500">{frame.cameraMovement}</span>
                          </div>
                          <p className="text-sm text-slate-800 italic">{frame.description}</p>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};