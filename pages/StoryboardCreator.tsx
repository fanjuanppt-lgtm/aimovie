import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Universe, StoryEgg, Character, Storyboard, Scene, StoryboardFrame, ScriptShot } from '../types';
import { generateDetailedScript, generateStoryboardFrameImage, refineStoryboardPanel, polishShotText, ShotReference } from '../services/geminiService';
import { ArrowLeft, Clapperboard, Loader2, Save, Sparkles, Map, ZoomIn, X, Users, Wand2, PenTool, FileText, Settings2, Grid, Lock, Unlock, History, GitCompare, ArrowRightLeft, PlusCircle, Film, User, Check, Cloud, ChevronDown, ChevronUp, Eye, Layout, CheckCircle } from 'lucide-react';

interface StoryboardCreatorProps {
  universes: Universe[];
  storyEggs: StoryEgg[];
  characters: Character[];
  storyboards: Storyboard[];
  scenes: Scene[];
  onSave: (s: Storyboard) => Promise<void>;
}

const SHOTS_PER_GROUP = 4;

const SHOT_SCALES = [
    "大特写 (Extreme Close-up)",
    "特写 (Close-up)",
    "中景 (Medium Shot)",
    "中远景 (Medium Long Shot)",
    "全景/远景 (Wide Shot)",
    "过肩镜头 (Overhead/OTS)",
    "仰拍 (Low Angle)",
    "俯拍 (High Angle)",
    "上帝视角 (Bird's Eye)",
    "荷兰倾斜 (Dutch Angle)",
    "POV (主观视角)"
];

export const StoryboardCreator: React.FC<StoryboardCreatorProps> = ({ universes, storyEggs, characters, storyboards, scenes, onSave }) => {
  const navigate = useNavigate();
  const { universeId, eggId, storyboardId } = useParams<{ universeId: string; eggId: string; storyboardId?: string }>();
  
  const universe = universes.find(u => u.id === universeId);
  const egg = storyEggs.find(e => e.id === eggId);
  const availableCharacters = characters.filter(c => c.storyEggId === eggId);
  const availableScenes = scenes.filter(s => s.storyEggId === eggId);

  const [sceneTitle, setSceneTitle] = useState('');
  const [roughPlot, setRoughPlot] = useState(''); // Serves as "Scene Summary"
  const [selectedSceneId, setSelectedSceneId] = useState<string>('');
  
  // Cast Selection
  const [participatingCharIds, setParticipatingCharIds] = useState<string[]>([]);

  // Script State (Dynamic length, multiples of 4)
  const [scriptShots, setScriptShots] = useState<ScriptShot[]>(
      Array.from({ length: SHOTS_PER_GROUP }, (_, i) => ({ id: i + 1, theme: '', content: '', isLocked: false, characterIds: [] }))
  );
  
  // generatedFrames now maps to groups. Index 0 = Group 1 (Shots 1-4), Index 1 = Group 2 (Shots 5-8), etc.
  const [generatedFrames, setGeneratedFrames] = useState<StoryboardFrame[]>([]);
  
  // New: Group Specific Scene Overrides (Group Index -> Scene Image URL)
  // We store URL directly or ID. Storing URL is easier for generation.
  const [groupSceneOverrides, setGroupSceneOverrides] = useState<{[groupIndex: number]: string}>({});

  const [isBrainstorming, setIsBrainstorming] = useState(false);
  const [isGeneratingMap, setIsGeneratingMap] = useState<{[key:number]: boolean}>({}); // Generating state per group index
  const [isSaving, setIsSaving] = useState(false);
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<Date | null>(null);
  
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  // --- Refine Image Tool State ---
  const [refinePanelNum, setRefinePanelNum] = useState<number>(1);
  const [refineInstruction, setRefineInstruction] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [activeRefineGroupIndex, setActiveRefineGroupIndex] = useState<number | null>(null);

  // --- History & Compare State ---
  const [showHistoryForGroup, setShowHistoryForGroup] = useState<number | null>(null); // group index
  const [comparingImage, setComparingImage] = useState<string | null>(null);
  const [compareTargetGroup, setCompareTargetGroup] = useState<number | null>(null);

  // --- Character Image Selector Modal State ---
  const [activeImageSelector, setActiveImageSelector] = useState<{ shotIndex: number, charId: string } | null>(null);

  // --- Scene View Selector State ---
  const [activeSceneSelectorGroup, setActiveSceneSelectorGroup] = useState<number | null>(null);

  // --- Refs for Auto-Save Consistency ---
  const framesRef = useRef(generatedFrames);
  const shotsRef = useRef(scriptShots);
  const titleRef = useRef(sceneTitle);
  const plotRef = useRef(roughPlot);
  const sceneIdRef = useRef(selectedSceneId);
  const participatingCharIdsRef = useRef(participatingCharIds);
  const initializedRef = useRef<string | null>(null); 

  useEffect(() => { framesRef.current = generatedFrames; }, [generatedFrames]);
  useEffect(() => { shotsRef.current = scriptShots; }, [scriptShots]);
  useEffect(() => { titleRef.current = sceneTitle; }, [sceneTitle]);
  useEffect(() => { plotRef.current = roughPlot; }, [roughPlot]);
  useEffect(() => { sceneIdRef.current = selectedSceneId; }, [selectedSceneId]);
  useEffect(() => { participatingCharIdsRef.current = participatingCharIds; }, [participatingCharIds]);
  
  useEffect(() => {
    if (storyboardId && storyboards.length > 0) {
      if (initializedRef.current === storyboardId) return;

      const existingSb = storyboards.find(s => s.id === storyboardId);
      if (existingSb) {
        setSceneTitle(existingSb.title);
        
        if (existingSb.sceneSummary) {
            setRoughPlot(existingSb.sceneSummary);
        }
        
        if (existingSb.participatingCharacterIds && existingSb.participatingCharacterIds.length > 0) {
            setParticipatingCharIds(existingSb.participatingCharacterIds);
        } else {
            setParticipatingCharIds(availableCharacters.map(c => c.id));
        }

        if (existingSb.shots && existingSb.shots.length > 0) {
            setScriptShots(existingSb.shots);
        } 
        else if (existingSb.plotSummary) {
             const lines = existingSb.plotSummary.split('\n');
             const newShots: ScriptShot[] = [];
             
             lines.forEach(line => {
                 const match = line.match(/^(\d+)\.\s*(?:\[(.*?)\]\s*)?(.*)/); 
                 if (match) {
                     const id = parseInt(match[1]);
                     const theme = match[2] || '';
                     const content = match[3];
                     while(newShots.length < id - 1) {
                         newShots.push({ id: newShots.length + 1, theme: '', content: '', isLocked: false, characterIds: [] });
                     }
                     newShots.push({ id, theme, content, isLocked: false, characterIds: [] });
                 }
             });

             const totalNeeded = Math.ceil(Math.max(newShots.length, 4) / 4) * 4;
             while(newShots.length < totalNeeded) {
                  newShots.push({ id: newShots.length + 1, theme: '', content: '', isLocked: false, characterIds: [] });
             }

             if (newShots.length > 0) {
                 setScriptShots(newShots);
             } else {
                 if (!existingSb.sceneSummary && existingSb.plotSummary && !existingSb.plotSummary.match(/^\d+\./)) {
                     setRoughPlot(existingSb.plotSummary);
                 }
             }
        }

        if (existingSb.sceneId) setSelectedSceneId(existingSb.sceneId);
        
        if (existingSb.frames && existingSb.frames.length > 0) {
            setGeneratedFrames(existingSb.frames);
        }
        
        initializedRef.current = storyboardId;
      }
    } else if (!storyboardId && initializedRef.current !== 'new') {
        // New storyboard init
        setParticipatingCharIds(availableCharacters.map(c => c.id)); // Default select all
        initializedRef.current = 'new';
    }
  }, [storyboardId, storyboards, availableCharacters]);

  const toggleParticipatingChar = (charId: string) => {
      setParticipatingCharIds(prev => {
          if (prev.includes(charId)) return prev.filter(id => id !== charId);
          return [...prev, charId];
      });
  };

  const toggleCharForShot = (shotIndex: number, charId: string) => {
    const newShots = [...scriptShots];
    const currentIds = newShots[shotIndex].characterIds || [];
    
    if (currentIds.includes(charId)) {
        newShots[shotIndex].characterIds = currentIds.filter(id => id !== charId);
    } else {
        newShots[shotIndex].characterIds = [...currentIds, charId];
    }
    setScriptShots(newShots);
  };

  const selectImageForCharInShot = (shotIndex: number, charId: string, imgId: string) => {
      const newShots = [...scriptShots];
      const shot = newShots[shotIndex];
      const newSelected = { ...(shot.selectedImageIds || {}) };
      newSelected[charId] = imgId;
      newShots[shotIndex] = { ...shot, selectedImageIds: newSelected };
      setScriptShots(newShots);
      setActiveImageSelector(null);
  };

  const handleAddGroup = () => {
      setScriptShots(prev => {
          const startId = prev.length + 1;
          const newBlock = Array.from({ length: SHOTS_PER_GROUP }, (_, i) => ({ 
              id: startId + i,
              theme: '', 
              content: '', 
              isLocked: false,
              characterIds: []
          }));
          return [...prev, ...newBlock];
      });
  };

  // --- REORDER FUNCTION ---
  const handleMoveGroup = (index: number, direction: 'up' | 'down') => {
      const totalGroups = Math.ceil(scriptShots.length / SHOTS_PER_GROUP);
      if (direction === 'up' && index === 0) return;
      if (direction === 'down' && index === totalGroups - 1) return;
      
      const targetIndex = direction === 'up' ? index - 1 : index + 1;

      // 1. Swap Script Shots
      const newShots = [...scriptShots];
      const currentBlockStart = index * SHOTS_PER_GROUP;
      const targetBlockStart = targetIndex * SHOTS_PER_GROUP;
      
      // Extract blocks
      const currentBlock = newShots.slice(currentBlockStart, currentBlockStart + SHOTS_PER_GROUP);
      const targetBlock = newShots.slice(targetBlockStart, targetBlockStart + SHOTS_PER_GROUP);

      // Swap in array
      newShots.splice(currentBlockStart, SHOTS_PER_GROUP, ...targetBlock);
      newShots.splice(targetBlockStart, SHOTS_PER_GROUP, ...currentBlock);

      // Re-index IDs to keep them sequential 1..N
      const reIndexedShots = newShots.map((shot, idx) => ({
          ...shot,
          id: idx + 1
      }));
      setScriptShots(reIndexedShots);

      // 2. Swap Generated Frames
      const newFrames = [...generatedFrames];
      // Ensure sparse array handling
      const currentFrame = newFrames[index];
      const targetFrame = newFrames[targetIndex];
      newFrames[index] = targetFrame;
      newFrames[targetIndex] = currentFrame;

      // Update internal groupIndex if frame exists
      if(newFrames[index]) newFrames[index].groupIndex = index;
      if(newFrames[targetIndex]) newFrames[targetIndex].groupIndex = targetIndex;
      
      setGeneratedFrames(newFrames);

      // 3. Swap Scene Overrides
      const newOverrides = { ...groupSceneOverrides };
      const currentOverride = newOverrides[index];
      const targetOverride = newOverrides[targetIndex];

      if (targetOverride) newOverrides[index] = targetOverride; 
      else delete newOverrides[index];

      if (currentOverride) newOverrides[targetIndex] = currentOverride;
      else delete newOverrides[targetIndex];

      setGroupSceneOverrides(newOverrides);
  };

  // --- AUTO SAVE FUNCTION ---
  const performAutoSave = async (latestFrames: StoryboardFrame[]) => {
      if (!titleRef.current) return; 
      
      const finalSummary = shotsRef.current.map((s) => {
          const themePrefix = s.theme ? `[${s.theme}] ` : '';
          return `${s.id}. ${themePrefix}${s.content}`;
      }).join('\n');
      
      const validFrames = latestFrames.filter(f => f && f.imageUrl);
      
      const idToUse = storyboardId || Date.now().toString();
      const existingSb = storyboards.find(s => s.id === storyboardId);
      const createdAtToUse = existingSb ? existingSb.createdAt : new Date();

      const storyboard: Storyboard = {
          id: idToUse,
          ownerId: '', // Placeholder, will be injected by App
          universeId: universeId!,
          storyEggId: eggId!,
          sceneId: sceneIdRef.current || undefined,
          title: titleRef.current,
          sceneSummary: plotRef.current,
          participatingCharacterIds: participatingCharIdsRef.current, // Save Selection
          plotSummary: finalSummary,
          shots: shotsRef.current, 
          frames: validFrames,
          createdAt: createdAtToUse
      };
      
      try {
          await onSave(storyboard);
          setLastAutoSaveTime(new Date());
          console.log("Auto-save completed.");
      } catch (e) {
          console.error("Auto-save failed", e);
      }
  };

  const handleAIScriptGen = async (groupIndex: number) => {
    if (!sceneTitle) {
      alert("请先输入场景标题");
      return;
    }

    if (!universe || !egg) return;

    setIsBrainstorming(true);
    try {
      const context = `Universe: ${universe.name} (${universe.type}). Rules: ${universe.rules}. Story: ${egg.title}`;
      
      let sceneDesc = "";
      if (selectedSceneId) {
          const scene = scenes.find(s => s.id === selectedSceneId);
          if (scene) sceneDesc = scene.description;
      }

      const fullContext = `${context}. Scene: ${sceneDesc}`;
      
      const currentStartId = groupIndex * SHOTS_PER_GROUP + 1;
      const allExistingShots = scriptShots;
      
      const charactersForScript = availableCharacters.filter(c => participatingCharIds.includes(c.id));

      const newContents = await generateDetailedScript(
          fullContext, 
          sceneTitle, 
          allExistingShots, 
          roughPlot, 
          currentStartId,
          SHOTS_PER_GROUP,
          charactersForScript 
      );
      
      setScriptShots(prev => {
          const updated = [...prev];
          newContents.forEach((content, i) => {
              const absIndex = groupIndex * SHOTS_PER_GROUP + i;
              if (updated[absIndex] && !updated[absIndex].isLocked) {
                  updated[absIndex].content = content;
              }
          });
          return updated;
      });

    } catch (e: any) {
      console.error(e);
      alert(`AI 脚本生成失败: ${e.message}`);
    } finally {
      setIsBrainstorming(false);
    }
  };

  const handlePolishShot = async (index: number) => {
      const shot = scriptShots[index];
      if (!shot.content) return;
      
      const newShots = [...scriptShots];
      newShots[index].isPolishing = true;
      setScriptShots(newShots);

      try {
          const context = `Universe: ${universe?.name}. Scene: ${sceneTitle}`;
          const polished = await polishShotText(context, shot.content);
          
          const updated = [...scriptShots];
          let finalContent = polished;
          
          updated[index] = { ...updated[index], content: finalContent, isPolishing: false };
          setScriptShots(updated);
      } catch (e) {
          const updated = [...scriptShots];
          updated[index].isPolishing = false;
          setScriptShots(updated);
          alert("润色失败");
      }
  };

  const toggleShotLock = (index: number) => {
      const newShots = [...scriptShots];
      newShots[index].isLocked = !newShots[index].isLocked;
      setScriptShots(newShots);
  };

  const updateShotContent = (index: number, val: string) => {
      const newShots = [...scriptShots];
      newShots[index].content = val;
      setScriptShots(newShots);
  };

  const updateShotTheme = (index: number, val: string) => {
    const newShots = [...scriptShots];
    newShots[index].theme = val;
    setScriptShots(newShots);
  };

  const handleGenerateImage = async (groupIndex: number) => {
      const startIndex = groupIndex * SHOTS_PER_GROUP;
      const targetShots = scriptShots.slice(startIndex, startIndex + SHOTS_PER_GROUP);

      if (targetShots.every(s => !s.content.trim())) return alert("本组剧本为空，无法绘制分镜。");
      if (!universe || !egg) return;

      setIsGeneratingMap(prev => ({ ...prev, [groupIndex]: true }));

      const groupCharIds = new Set<string>();
      targetShots.forEach(s => s.characterIds?.forEach(id => groupCharIds.add(id)));
      const groupCharacters = availableCharacters.filter(c => groupCharIds.has(c.id));

      const formattedScript = targetShots.map((s, i) => {
          let cleanContent = s.content.replace(/^\d+[\.\:：]\s*/, '').trim();
          if (!cleanContent) cleanContent = "Static shot. No specific action.";

          const themeContext = s.theme ? `[SHOT TYPE: ${s.theme}] ` : '';

          const shotChars = availableCharacters.filter(c => s.characterIds?.includes(c.id));
          const charPrefix = shotChars.length > 0 
              ? `[CHARACTERS IN SHOT: ${shotChars.map(c => c.roots.name).join(', ')}] `
              : `[ENVIRONMENT SHOT (NO CHARACTERS)] `;

          return `Frame ${i + 1}: ${themeContext}${charPrefix}${cleanContent}`;
      }).join('\n');

      try {
          const context = `Universe: ${universe.name}, ${universe.type}. Story: ${egg.title}`;
          
          // Determine Scene Context Image
          let sceneImageUrl = undefined;
          
          // Priority 1: Group Override
          if (groupSceneOverrides[groupIndex]) {
               sceneImageUrl = groupSceneOverrides[groupIndex];
          } 
          // Priority 2: Global Scene "Main" image
          else if (selectedSceneId) {
             const scene = scenes.find(s => s.id === selectedSceneId);
             if (scene) {
                 const mainImg = scene.images.find(i => i.type === 'main');
                 if (mainImg) sceneImageUrl = mainImg.url;
             }
          }
          
          let previousGroupImageUrl = undefined;
          if (groupIndex > 0) {
              const prevFrame = generatedFrames[groupIndex - 1];
              if (prevFrame && prevFrame.imageUrl) {
                  previousGroupImageUrl = prevFrame.imageUrl;
              }
          }

          const charPayload = groupCharacters.map(c => {
            const refImg = c.images.find(img => img.angle.startsWith('01')) || c.images[0];
            return { name: c.roots.name, imageUrl: refImg ? refImg.url : '' };
          }).filter(c => !!c.imageUrl);

          const shotReferences: ShotReference[] = [];
          targetShots.forEach((s, i) => {
              if (s.characterIds && s.selectedImageIds) {
                  s.characterIds.forEach(charId => {
                      const imgId = s.selectedImageIds![charId];
                      if (imgId) {
                          const char = availableCharacters.find(c => c.id === charId);
                          const img = char?.images.find(img => img.id === imgId);
                          if (char && img) {
                              shotReferences.push({
                                  frameIndex: i, 
                                  charName: char.roots.name,
                                  imageUrl: img.url
                              });
                          }
                      }
                  });
              }
          });

          console.log(`Generating Group ${groupIndex} (Shots ${startIndex+1}-${startIndex+4})`);
          
          const imageUrl = await generateStoryboardFrameImage(
              context,
              formattedScript,
              "Cinematic",
              sceneImageUrl,
              charPayload,
              previousGroupImageUrl,
              shotReferences 
          );
          
          const currentFrames = [...framesRef.current];
          
          while(currentFrames.length <= groupIndex) {
               currentFrames.push({} as any); 
          }

          const existingFrame = currentFrames[groupIndex];
          let existingHistory: string[] = [];
          if (existingFrame && existingFrame.imageUrl) {
              existingHistory = existingFrame.imageHistory || [];
              existingHistory.unshift(existingFrame.imageUrl);
              if (existingHistory.length > 9) existingHistory = existingHistory.slice(0, 9);
          }

          currentFrames[groupIndex] = {
              id: existingFrame?.id || Date.now().toString(),
              groupIndex: groupIndex,
              shotType: "2x2 Grid 4K",
              cameraMovement: "Static",
              description: formattedScript,
              characters: [],
              imageState: 'final',
              imageUrl: imageUrl,
              imageHistory: existingHistory
          };
          
          setGeneratedFrames(currentFrames);
          await performAutoSave(currentFrames);

      } catch (e: any) {
          console.error(e);
          alert(`生成失败: ${e.message}\n如果是权限错误，请检查 Settings 中是否配置了带 Billing 的 Project Key。`);
      } finally {
          setIsGeneratingMap(prev => ({ ...prev, [groupIndex]: false }));
      }
  };

  const handleRefinePanel = async () => {
      if (activeRefineGroupIndex === null) return;
      if (!refineInstruction) return alert("请输入修改指令");
      
      const currentFrame = generatedFrames[activeRefineGroupIndex];
      if (!currentFrame || !currentFrame.imageUrl) return alert("没有可修改的分镜图");

      setIsRefining(true);
      try {
          const refinedImageUrl = await refineStoryboardPanel(
              currentFrame.imageUrl,
              refinePanelNum, 
              refineInstruction
          );
          
          const oldUrl = currentFrame.imageUrl;
          let newHistory = currentFrame.imageHistory ? [...currentFrame.imageHistory] : [];
          if (oldUrl) {
              newHistory.unshift(oldUrl);
              if (newHistory.length > 9) newHistory = newHistory.slice(0, 9);
          }

          const currentFrames = [...framesRef.current];
          currentFrames[activeRefineGroupIndex] = {
              ...currentFrame,
              imageUrl: refinedImageUrl,
              imageHistory: newHistory
          };

          setGeneratedFrames(currentFrames);
          setRefineInstruction("");
          alert(`第 ${activeRefineGroupIndex + 1} 组 - #${refinePanelNum} 号分镜微调完成！`);
          setComparingImage(oldUrl); 
          setCompareTargetGroup(activeRefineGroupIndex);

          await performAutoSave(currentFrames);

      } catch (e: any) {
          console.error(e);
          alert(`微调失败: ${e.message}`);
      } finally {
          setIsRefining(false);
      }
  };
  
  const handleSwitchVersion = (targetHistoryUrl: string) => {
      if (compareTargetGroup === null) return;
      
      const currentFrame = generatedFrames[compareTargetGroup];
      if (!currentFrame || !currentFrame.imageUrl) return;

      const currentUrl = currentFrame.imageUrl;
      let newHistory = currentFrame.imageHistory ? [...currentFrame.imageHistory] : [];
      
      newHistory = newHistory.filter(url => url !== targetHistoryUrl);
      newHistory.unshift(currentUrl);
      if (newHistory.length > 9) newHistory = newHistory.slice(0, 9);

      setGeneratedFrames(prev => {
          const newFrames = [...prev];
          newFrames[compareTargetGroup] = {
              ...currentFrame,
              imageUrl: targetHistoryUrl, 
              imageHistory: newHistory
          };
          return newFrames;
      });

      setComparingImage(null); 
      setCompareTargetGroup(null);
  };

  const handleManualSave = async () => {
    if (!sceneTitle) return alert("请填写场景标题");
    
    const finalSummary = scriptShots.map((s) => {
        const themePrefix = s.theme ? `[${s.theme}] ` : '';
        return `${s.id}. ${themePrefix}${s.content}`;
    }).join('\n');
    
    if (!finalSummary.trim()) return alert("剧本内容为空");
    
    setIsSaving(true);
    const idToUse = storyboardId || Date.now().toString();
    const createdAtToUse = (storyboardId && storyboards.find(s => s.id === storyboardId)?.createdAt) || new Date();
    
    const validFrames = generatedFrames.filter(f => f && f.imageUrl);

    const storyboard: Storyboard = {
      id: idToUse, 
      ownerId: '', // Placeholder, will be injected by App
      universeId: universeId!, 
      storyEggId: eggId!, 
      sceneId: selectedSceneId || undefined,
      title: sceneTitle,
      sceneSummary: roughPlot,
      participatingCharacterIds: participatingCharIds, // Save selection
      plotSummary: finalSummary, 
      shots: scriptShots, 
      frames: validFrames,
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

  const totalGroups = Math.ceil(scriptShots.length / SHOTS_PER_GROUP);
  
  // Characters active in this scene
  const activeCast = availableCharacters.filter(c => participatingCharIds.includes(c.id));
  
  // Scene Images for Override Selector
  const activeSceneObj = selectedSceneId ? scenes.find(s => s.id === selectedSceneId) : null;

  // Helper to render the active image selector
  const renderImageSelectorModal = () => {
      if (!activeImageSelector) return null;
      
      const { shotIndex, charId } = activeImageSelector;
      const char = availableCharacters.find(c => c.id === charId);
      if (!char) return null;

      const validImages = char.images.filter(img => !img.deletedAt);
      
      return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-cinematic-900 border border-cinematic-gold rounded-xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[80vh]">
                   <div className="p-4 border-b border-cinematic-700 flex justify-between items-center bg-cinematic-800/50 rounded-t-xl">
                       <h3 className="text-lg font-bold text-white flex items-center gap-2">
                           <Users size={18} className="text-cinematic-gold"/>
                           选择角色参考图: <span className="text-cinematic-gold">{char.roots.name}</span>
                       </h3>
                       <button onClick={() => setActiveImageSelector(null)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white"><X size={20} /></button>
                   </div>
                   
                   <div className="flex-1 overflow-y-auto p-6 bg-cinematic-900">
                        {validImages.length === 0 ? (
                            <div className="text-center text-slate-500 py-10">
                                暂无可用图片，请前往角色工坊生成。
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {validImages.map(img => {
                                    const isSelected = scriptShots[shotIndex]?.selectedImageIds?.[charId] === img.id;
                                    return (
                                        <div 
                                            key={img.id}
                                            onClick={() => selectImageForCharInShot(shotIndex, charId, img.id)}
                                            className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                                                isSelected 
                                                ? 'border-cinematic-gold ring-2 ring-cinematic-gold/30' 
                                                : 'border-transparent hover:border-cinematic-accent'
                                            }`}
                                        >
                                            <div className="aspect-[3/4] bg-black">
                                                <img src={img.url} className="w-full h-full object-cover" alt={img.angle} />
                                            </div>
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-2 opacity-100">
                                                <p className="text-[10px] text-white font-bold truncate">{img.angle}</p>
                                            </div>
                                            {isSelected && (
                                                <div className="absolute top-2 right-2 bg-cinematic-gold text-black rounded-full p-0.5">
                                                    <Check size={12} strokeWidth={4} />
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                   </div>
                   
                   <div className="p-4 border-t border-cinematic-700 bg-cinematic-800/50 rounded-b-xl flex justify-end">
                       <button 
                         onClick={() => setActiveImageSelector(null)}
                         className="px-4 py-2 text-slate-400 hover:text-white"
                       >
                           取消
                       </button>
                   </div>
              </div>
          </div>
      );
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto pb-32 relative">
      <button onClick={() => navigate(`/universe/${universeId}/egg/${eggId}`)} className="flex items-center text-slate-400 hover:text-white mb-4">
        <ArrowLeft size={16} className="mr-1" /> 返回故事蛋
      </button>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
            <PenTool className="text-cinematic-gold" /> 
            分镜绘制大师 (Multi-Block)
        </h1>
        <div className="flex items-center gap-4">
            {lastAutoSaveTime && (
                <div className="text-xs text-slate-500 flex items-center gap-1 animate-pulse">
                    <Cloud size={12} />
                    已自动保存 {lastAutoSaveTime.toLocaleTimeString()}
                </div>
            )}
            <button 
                onClick={handleManualSave}
                disabled={isSaving}
                className="px-6 py-2 bg-cinematic-gold hover:bg-amber-400 text-black font-bold rounded-lg shadow-lg flex items-center gap-2 disabled:opacity-50"
            >
                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                保存并退出
            </button>
        </div>
      </div>

      <div className="flex flex-col gap-8">
        
        {/* GLOBAL CONTEXT & SETTINGS */}
        <div className="bg-cinematic-800 p-6 rounded-xl border border-cinematic-700 shadow-xl">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">场景标题</label>
                    <input 
                        type="text"
                        value={sceneTitle}
                        onChange={e => setSceneTitle(e.target.value)}
                        className="w-full bg-cinematic-900 border border-cinematic-700 rounded p-3 text-white focus:border-cinematic-accent outline-none"
                        placeholder="例如：雨夜追逐"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1"><Map size={12}/> 演出场景</label>
                    <select 
                        value={selectedSceneId}
                        onChange={(e) => setSelectedSceneId(e.target.value)}
                        className="w-full bg-cinematic-900 border border-cinematic-700 rounded p-3 text-white focus:border-cinematic-accent outline-none appearance-none"
                    >
                        <option value="">-- 选择演出场景 (可选) --</option>
                        {availableScenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
            </div>
             <div className="flex flex-col md:flex-row gap-6">
                 <div className="flex-1 p-4 bg-cinematic-900/50 rounded-lg border border-cinematic-700">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">场景概要</label>
                    <textarea 
                        rows={3}
                        value={roughPlot}
                        onChange={e => setRoughPlot(e.target.value)}
                        className="w-full bg-cinematic-800 border border-cinematic-700 rounded p-2 text-white focus:border-cinematic-accent outline-none resize-none text-sm"
                        placeholder="例如：主角在雨中奔跑，被反派追击，最终躲进废弃仓库..."
                    />
                </div>
                
                {/* CAST SELECTION */}
                <div className="w-full md:w-1/3 p-4 bg-cinematic-900/50 rounded-lg border border-cinematic-700 overflow-y-auto max-h-[120px]">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2 flex justify-between">
                        <span>参演人物 (Cast)</span>
                        <span className="text-cinematic-gold">{participatingCharIds.length} / {availableCharacters.length}</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {availableCharacters.map(c => {
                            const isSelected = participatingCharIds.includes(c.id);
                            return (
                                <button 
                                    key={c.id}
                                    onClick={() => toggleParticipatingChar(c.id)}
                                    className={`text-xs px-2 py-1 rounded-full border transition-all ${
                                        isSelected 
                                        ? 'bg-cinematic-gold/20 text-cinematic-gold border-cinematic-gold' 
                                        : 'bg-cinematic-800 text-slate-500 border-cinematic-700 hover:border-slate-500'
                                    }`}
                                >
                                    {c.roots.name}
                                </button>
                            );
                        })}
                        {availableCharacters.length === 0 && <span className="text-xs text-slate-600">暂无可用角色</span>}
                    </div>
                </div>
             </div>
        </div>

        {/* STORYBOARD GROUPS RENDER LOOP */}
        {Array.from({ length: totalGroups }).map((_, groupIndex) => {
            const startShotIndex = groupIndex * SHOTS_PER_GROUP;
            const groupShots = scriptShots.slice(startShotIndex, startShotIndex + SHOTS_PER_GROUP);
            const generatedFrame = generatedFrames[groupIndex];
            const isGroupGenerating = isGeneratingMap[groupIndex];
            const hasHistory = generatedFrame?.imageHistory && generatedFrame.imageHistory.length > 0;
            
            // Current Scene Override for this group
            const currentOverrideUrl = groupSceneOverrides[groupIndex];
            const isOverrideActive = !!currentOverrideUrl;

            return (
                <div key={groupIndex} className="bg-cinematic-800/50 p-6 rounded-xl border border-cinematic-700 shadow-xl relative animate-in fade-in slide-in-from-bottom-4 transition-all duration-300">
                     {/* Group Label & Reorder Controls */}
                     <div className="absolute top-0 left-0 flex items-center">
                        <div className="bg-cinematic-700 px-3 py-1 rounded-br-lg rounded-tl-lg text-xs font-bold text-white border-r border-b border-cinematic-600">
                             Group {groupIndex + 1} (Shots {startShotIndex + 1} - {startShotIndex + groupShots.length})
                        </div>
                        <div className="flex ml-2 gap-1 opacity-50 hover:opacity-100 transition-opacity">
                            {groupIndex > 0 && (
                                <button onClick={() => handleMoveGroup(groupIndex, 'up')} className="p-1 bg-cinematic-900 border border-cinematic-700 rounded text-slate-400 hover:text-white" title="上移">
                                    <ChevronUp size={14} />
                                </button>
                            )}
                            {groupIndex < totalGroups - 1 && (
                                <button onClick={() => handleMoveGroup(groupIndex, 'down')} className="p-1 bg-cinematic-900 border border-cinematic-700 rounded text-slate-400 hover:text-white" title="下移">
                                    <ChevronDown size={14} />
                                </button>
                            )}
                        </div>
                     </div>

                     <div className="flex flex-col xl:flex-row gap-6 mt-6">
                         
                         {/* LEFT: SCRIPTING AREA (4 SHOTS) */}
                         <div className="flex-1 space-y-4">
                             <div className="flex justify-between items-center mb-2">
                                 <h3 className="text-sm font-bold text-white flex items-center gap-2"><FileText size={16} className="text-cinematic-gold"/> 剧本描述</h3>
                                 <div className="flex items-center gap-2">
                                     {/* Scene Sub-selector */}
                                     {activeSceneObj && activeSceneObj.images.length > 0 && (
                                        <div className="relative">
                                            <button 
                                                onClick={() => setActiveSceneSelectorGroup(activeSceneSelectorGroup === groupIndex ? null : groupIndex)}
                                                className={`text-xs px-2 py-1 rounded border flex items-center gap-1 transition-colors ${
                                                    isOverrideActive 
                                                    ? 'bg-cinematic-gold/20 text-cinematic-gold border-cinematic-gold' 
                                                    : 'bg-cinematic-900 text-slate-400 border-cinematic-700 hover:text-white'
                                                }`}
                                            >
                                                <Layout size={12}/> 
                                                {isOverrideActive ? '已选特定子场景' : '场景视角选择'}
                                            </button>
                                            
                                            {/* Toggle-based Dropdown for Scene Images */}
                                            {activeSceneSelectorGroup === groupIndex && (
                                                <>
                                                    <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setActiveSceneSelectorGroup(null)} />
                                                    <div className="absolute right-0 top-full mt-2 w-[600px] bg-cinematic-900 border border-cinematic-700 rounded-xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2 border-r border-b border-l border-t-0">
                                                        <div className="flex justify-between items-center mb-4 border-b border-cinematic-700 pb-2">
                                                            <span className="text-sm text-slate-200 font-bold uppercase flex items-center gap-2">
                                                                <Layout size={16} className="text-cinematic-gold"/> 
                                                                选择本组参考视角 (Select View Override)
                                                            </span>
                                                            <button onClick={() => setActiveSceneSelectorGroup(null)} className="text-slate-500 hover:text-white bg-cinematic-800 p-1.5 rounded-full transition-colors"><X size={16}/></button>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                                                            {/* Default Option */}
                                                            <div 
                                                                onClick={() => {
                                                                    const newO = {...groupSceneOverrides};
                                                                    delete newO[groupIndex];
                                                                    setGroupSceneOverrides(newO);
                                                                    setActiveSceneSelectorGroup(null);
                                                                }}
                                                                className={`aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer text-sm transition-all h-full min-h-[140px] ${!isOverrideActive ? 'border-cinematic-gold bg-cinematic-gold/10 text-cinematic-gold' : 'border-cinematic-700 text-slate-500 hover:text-white hover:border-slate-500 hover:bg-cinematic-800'}`}
                                                            >
                                                                <span className="font-bold mb-1">使用默认场景 (Default)</span>
                                                                <span className="text-xs opacity-70">不强制指定视角</span>
                                                                {!isOverrideActive && <CheckCircle size={24} className="mt-2"/>}
                                                            </div>
                                                            
                                                            {/* Images */}
                                                            {activeSceneObj.images.map(img => (
                                                                <div 
                                                                    key={img.id}
                                                                    onClick={() => {
                                                                        setGroupSceneOverrides({ ...groupSceneOverrides, [groupIndex]: img.url });
                                                                        setActiveSceneSelectorGroup(null);
                                                                    }}
                                                                    className={`relative aspect-video rounded-xl overflow-hidden cursor-pointer border-2 transition-all group shadow-lg ${currentOverrideUrl === img.url ? 'border-cinematic-gold ring-2 ring-cinematic-gold/30' : 'border-transparent hover:border-cinematic-accent'}`}
                                                                >
                                                                    <img src={img.url} className="w-full h-full object-cover" />
                                                                    
                                                                    {/* Hover Overlay */}
                                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                         <span className="bg-black/80 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur border border-white/20 font-bold">点击选择</span>
                                                                    </div>
                                                                    
                                                                    {/* Label */}
                                                                    {img.type && (
                                                                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-6 flex justify-between items-end">
                                                                            <span className="text-xs text-white font-bold font-mono truncate uppercase shadow-black drop-shadow-md">{img.type}</span>
                                                                        </div>
                                                                    )}

                                                                    {/* Selected Indicator */}
                                                                    {currentOverrideUrl === img.url && (
                                                                         <div className="absolute top-2 right-2 bg-cinematic-gold text-black rounded-full p-1.5 shadow-xl border border-white/20">
                                                                            <Check size={16} strokeWidth={4} />
                                                                         </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                     )}

                                     <button 
                                        onClick={() => handleAIScriptGen(groupIndex)}
                                        disabled={isBrainstorming || !sceneTitle}
                                        className="text-xs px-3 py-1 bg-cinematic-700 hover:bg-cinematic-600 text-white rounded border border-cinematic-600 flex items-center gap-1 disabled:opacity-50"
                                    >
                                        {isBrainstorming ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12} />}
                                        AI 编写本组剧本
                                    </button>
                                 </div>
                             </div>
                             
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                 {groupShots.map((shot, i) => (
                                     <div key={shot.id} className="relative group bg-cinematic-900/50 border border-cinematic-700 rounded-lg p-3 hover:border-cinematic-500 transition-colors flex flex-col gap-2">
                                         <div className="flex justify-between items-center">
                                             <span className="text-xs font-bold text-slate-400">镜头 #{shot.id}</span>
                                             <div className="flex gap-1">
                                                 <button onClick={() => handlePolishShot(startShotIndex + i)} disabled={shot.isLocked || shot.isPolishing} className="p-1 hover:text-cinematic-gold disabled:opacity-30"><Wand2 size={10}/></button>
                                                 <button onClick={() => toggleShotLock(startShotIndex + i)} className={`p-1 ${shot.isLocked ? 'text-cinematic-gold' : 'text-slate-600'}`}>{shot.isLocked ? <Lock size={10}/> : <Unlock size={10}/>}</button>
                                             </div>
                                         </div>
                                         
                                         <select 
                                             value={shot.theme}
                                             onChange={(e) => updateShotTheme(startShotIndex + i, e.target.value)}
                                             className="w-full bg-cinematic-800 text-xs text-cinematic-gold font-bold border border-cinematic-700 rounded px-2 py-1 focus:border-cinematic-gold outline-none"
                                             disabled={shot.isLocked}
                                         >
                                             <option value="">-- 选择景别 / Shot Scale --</option>
                                             {SHOT_SCALES.map((scale, idx) => (
                                                 <option key={idx} value={scale}>{scale}</option>
                                             ))}
                                         </select>

                                         <textarea 
                                             value={shot.content}
                                             onChange={(e) => updateShotContent(startShotIndex + i, e.target.value)}
                                             rows={3}
                                             className="w-full bg-transparent text-xs text-white outline-none resize-none placeholder-slate-600"
                                             placeholder="AI 自动生成视觉描述，或手动填写..."
                                             disabled={shot.isLocked}
                                         />

                                         <div className="border-t border-cinematic-800 pt-2">
                                             <label className="text-[10px] text-slate-500 font-bold block mb-1">参演角色 (点击选中/点击头像换图):</label>
                                             <div className="flex flex-wrap gap-2">
                                                 {activeCast.length === 0 && <span className="text-[10px] text-slate-600">未选择参演角色</span>}
                                                 {activeCast.map(c => {
                                                     const isSelected = shot.characterIds?.includes(c.id);
                                                     const selectedImgId = shot.selectedImageIds?.[c.id];
                                                     const selectedImg = c.images.find(img => img.id === selectedImgId) || c.images.find(img => img.angle.startsWith('01')) || c.images[0];
                                                     
                                                     return (
                                                         <div key={c.id} className="flex items-center gap-1.5 bg-cinematic-800 rounded-full pr-1 pl-1 py-0.5 border border-cinematic-700">
                                                            <button
                                                                onClick={() => toggleCharForShot(startShotIndex + i, c.id)}
                                                                className={`text-[10px] px-2 py-0.5 rounded-full transition-colors flex items-center gap-1 ${
                                                                    isSelected 
                                                                    ? 'bg-cinematic-gold text-black font-bold' 
                                                                    : 'bg-transparent text-slate-400 hover:text-white'
                                                                }`}
                                                            >
                                                                {c.roots.name}
                                                            </button>
                                                            {isSelected && selectedImg && (
                                                                <button
                                                                    type="button" 
                                                                    onClick={() => setActiveImageSelector({ shotIndex: startShotIndex + i, charId: c.id })}
                                                                    className="w-5 h-5 rounded-full overflow-hidden border border-slate-500 hover:border-cinematic-gold hover:scale-110 transition-all cursor-pointer"
                                                                    title="点击更换参考图"
                                                                >
                                                                    <img src={selectedImg.url} className="w-full h-full object-cover" />
                                                                </button>
                                                            )}
                                                         </div>
                                                     );
                                                 })}
                                             </div>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                             
                             <div className="pt-2">
                                 <button 
                                     onClick={() => handleGenerateImage(groupIndex)}
                                     disabled={isGroupGenerating || groupShots.every(s => !s.content.trim())}
                                     className="w-full py-3 bg-gradient-to-r from-cinematic-700 to-cinematic-800 hover:from-cinematic-600 hover:to-cinematic-700 text-white font-bold rounded-lg border border-cinematic-600 shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                                 >
                                     {isGroupGenerating ? <Loader2 className="animate-spin" size={16} /> : <Clapperboard size={16} />}
                                     {generatedFrame?.imageUrl ? "重新生成 (4K 2x2)" : "生成本组分镜 (4K 2x2)"}
                                 </button>
                             </div>
                         </div>

                         {/* RIGHT: IMAGE RESULT AREA */}
                         <div className="xl:w-1/2 flex flex-col">
                             <div className="flex justify-between items-center mb-2">
                                 <h3 className="text-sm font-bold text-white flex items-center gap-2"><Film size={16} className="text-cinematic-gold"/> 视觉呈现</h3>
                                 {isOverrideActive && (
                                    <div className="flex items-center gap-1 text-[10px] text-cinematic-gold bg-cinematic-gold/10 px-2 py-0.5 rounded">
                                        <Layout size={10} /> 使用子场景视角
                                    </div>
                                 )}
                             </div>
                             
                             <div className="flex-1 bg-black rounded-xl border border-cinematic-800 relative overflow-hidden flex items-center justify-center min-h-[300px]">
                                 {generatedFrame?.imageUrl ? (
                                     <>
                                         <img 
                                             src={generatedFrame.imageUrl} 
                                             className="max-h-[500px] w-full object-contain cursor-pointer" 
                                             onClick={() => setViewingImage(generatedFrame.imageUrl || null)}
                                         />
                                         <div className="absolute bottom-2 right-2 flex gap-2">
                                              {hasHistory && (
                                                  <button 
                                                    onClick={() => {
                                                        setShowHistoryForGroup(showHistoryForGroup === groupIndex ? null : groupIndex);
                                                        setCompareTargetGroup(groupIndex);
                                                        setComparingImage(generatedFrame.imageHistory![0]); // Default compare to latest history
                                                    }}
                                                    className="p-2 bg-black/60 hover:bg-cinematic-700 text-white rounded-full backdrop-blur border border-white/10"
                                                    title="历史版本 & 对比"
                                                  >
                                                      <History size={16} />
                                                  </button>
                                              )}
                                              <button 
                                                onClick={() => setActiveRefineGroupIndex(activeRefineGroupIndex === groupIndex ? null : groupIndex)}
                                                className="p-2 bg-black/60 hover:bg-cinematic-gold hover:text-black text-white rounded-full backdrop-blur border border-white/10"
                                                title="局部微调 (Refine)"
                                              >
                                                  <Settings2 size={16} />
                                              </button>
                                         </div>
                                     </>
                                 ) : isGroupGenerating ? (
                                     <div className="flex flex-col items-center gap-3">
                                         <Loader2 className="animate-spin text-cinematic-gold" size={32} />
                                         <span className="text-xs text-slate-500">正在绘制 4K 图像...</span>
                                     </div>
                                 ) : (
                                     <span className="text-xs text-slate-600">等待生成</span>
                                 )}
                             </div>

                             {/* INLINE TOOLS: REFINE & HISTORY */}
                             {activeRefineGroupIndex === groupIndex && generatedFrame?.imageUrl && (
                                <div className="mt-2 bg-cinematic-900 border border-cinematic-700 rounded-lg p-3 animate-in slide-in-from-top-2">
                                     <div className="flex justify-between items-center mb-2">
                                         <span className="text-xs font-bold text-cinematic-gold uppercase">4K 局部微调 / Refine</span>
                                         <button onClick={() => setActiveRefineGroupIndex(null)}><X size={14} className="text-slate-500"/></button>
                                     </div>
                                     <div className="flex gap-2 mb-2">
                                         {[1,2,3,4].map(n => (
                                             <button 
                                                key={n} 
                                                onClick={() => setRefinePanelNum(n)}
                                                className={`flex-1 py-2 rounded text-xs font-bold border transition-colors ${refinePanelNum === n ? 'bg-cinematic-gold text-black border-cinematic-gold' : 'bg-cinematic-800 text-slate-400 border-cinematic-700 hover:text-white'}`}
                                             >
                                                 镜头 #{n}
                                             </button>
                                         ))}
                                     </div>
                                     <div className="flex gap-2">
                                         <input 
                                             value={refineInstruction}
                                             onChange={e => setRefineInstruction(e.target.value)}
                                             placeholder={`修改第 #${refinePanelNum} 号镜头: "改为人物特写..."`}
                                             className="flex-1 bg-black border border-cinematic-700 rounded px-3 py-2 text-xs text-white outline-none focus:border-cinematic-gold"
                                             onKeyDown={(e) => e.key === 'Enter' && handleRefinePanel()}
                                         />
                                         <button onClick={handleRefinePanel} disabled={isRefining} className="px-4 bg-cinematic-accent text-white rounded text-xs font-bold disabled:opacity-50 flex items-center gap-1">
                                             {isRefining ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>} 精修
                                         </button>
                                     </div>
                                     <div className="text-[10px] text-slate-500 mt-1 pl-1">
                                         * AI 将只重绘第 #{refinePanelNum} 号镜头，保持其他 3 个镜头像素级不变。
                                     </div>
                                </div>
                             )}

                             {showHistoryForGroup === groupIndex && generatedFrame?.imageHistory && (
                                 <div className="mt-2 p-3 bg-cinematic-900 border border-cinematic-700 rounded-lg animate-in slide-in-from-top-2">
                                     <div className="flex justify-between items-center mb-2">
                                         <span className="text-xs font-bold text-slate-300 uppercase flex items-center gap-2"><History size={12}/> 历史版本 (点击对比)</span>
                                         <button onClick={() => setShowHistoryForGroup(null)}><X size={14} className="text-slate-500"/></button>
                                     </div>
                                     <div className="grid grid-cols-4 gap-2">
                                         {generatedFrame.imageHistory.map((hUrl, hIdx) => (
                                             <div 
                                                key={hIdx} 
                                                className="aspect-video bg-black rounded border border-cinematic-700 cursor-pointer overflow-hidden hover:border-cinematic-gold relative group"
                                                onClick={() => {
                                                    setComparingImage(hUrl);
                                                    setCompareTargetGroup(groupIndex);
                                                }}
                                             >
                                                 <img src={hUrl} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                                                 <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40">
                                                     <GitCompare size={16} className="text-white"/>
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
        })}

        <div className="flex justify-center py-4">
            <button 
                onClick={handleAddGroup}
                className="px-6 py-3 bg-cinematic-900 border-2 border-dashed border-cinematic-700 hover:border-cinematic-gold text-slate-400 hover:text-cinematic-gold rounded-xl flex items-center gap-2 transition-all font-bold"
            >
                <PlusCircle size={20} /> 添加下一组镜头 (Add Shots {scriptShots.length + 1}-{scriptShots.length + 4})
            </button>
        </div>

      </div>

       {/* Render Active Selector Modal */}
       {renderImageSelectorModal()}

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

        {comparingImage && compareTargetGroup !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-cinematic-900 border border-cinematic-gold rounded-xl p-4 max-w-5xl w-full flex flex-col gap-4 relative shadow-2xl h-[80vh]">
                     <div className="flex justify-between items-center text-cinematic-gold border-b border-cinematic-700 pb-2 flex-shrink-0">
                         <h3 className="font-bold flex items-center gap-2"><GitCompare size={18}/> 版本对比 - Group {compareTargetGroup + 1}</h3>
                         <button onClick={() => { setComparingImage(null); setCompareTargetGroup(null); }} className="hover:text-white"><X size={20}/></button>
                     </div>
                     
                     <div className="flex gap-4 flex-1 min-h-0">
                         <div className="flex-1 flex flex-col gap-2">
                             <span className="text-xs font-bold text-slate-400 text-center uppercase flex-shrink-0">当前版本 (Current)</span>
                             <div className="flex-1 bg-black rounded-lg border border-cinematic-700 overflow-hidden flex items-center justify-center relative">
                                 <img src={generatedFrames[compareTargetGroup]?.imageUrl} className="max-w-full max-h-full object-contain absolute"/>
                             </div>
                         </div>
                         <div className="flex-1 flex flex-col gap-2">
                             <span className="text-xs font-bold text-cinematic-gold text-center uppercase flex-shrink-0">历史选定 (History)</span>
                             <div className="flex-1 bg-black rounded-lg border border-cinematic-gold overflow-hidden flex items-center justify-center relative">
                                 <img src={comparingImage} className="max-w-full max-h-full object-contain absolute"/>
                             </div>
                         </div>
                     </div>
                     
                     <div className="flex justify-center flex-shrink-0 pt-2">
                         <button 
                            onClick={() => handleSwitchVersion(comparingImage)}
                            className="px-8 py-3 bg-cinematic-accent hover:bg-blue-600 text-white font-bold rounded-lg shadow-lg flex items-center gap-2"
                         >
                             <ArrowRightLeft size={18} /> 恢复/使用此历史版本
                         </button>
                     </div>
                </div>
            </div>
        )}

    </div>
  );
};