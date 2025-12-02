

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Universe, StoryEgg, Character, Storyboard, Scene, StoryboardFrame, ScriptShot } from '../types';
import { generateDetailedScript, generateStoryboardFrameImage, refineStoryboardPanel, polishShotText, ShotReference } from '../services/geminiService';
import { ArrowLeft, Clapperboard, Loader2, Save, Sparkles, Map, ZoomIn, X, Users, Wand2, PenTool, FileText, Settings2, Grid, Lock, Unlock, History, GitCompare, ArrowRightLeft, PlusCircle, Film, User, Check, Cloud, ChevronDown, ChevronUp, Eye, Layout, CheckCircle, Smartphone, Monitor } from 'lucide-react';

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
  const [targetAspectRatio, setTargetAspectRatio] = useState<"16:9" | "9:16">("16:9");
  
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
          ownerId: '', 
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
          charactersForScript,
          egg.fullScript 
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
            // New logic: Check if cover image is set, otherwise default to 01
            let refImg = c.images.find(img => img.id === c.coverImageId);
            if (!refImg) refImg = c.images.find(img => img.angle.startsWith('01')) || c.images[0];

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
          
          // Pass targetAspectRatio to the service
          const imageUrl = await generateStoryboardFrameImage(
              context,
              formattedScript,
              "Cinematic",
              sceneImageUrl,
              charPayload,
              previousGroupImageUrl,
              shotReferences,
              targetAspectRatio,
              egg?.visualStyle // Pass Global Style
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

  // ... (handleRefinePanel, handleSwitchVersion, handleManualSave etc remain same) ...
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
      ownerId: '', 
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
  const activeCast = availableCharacters.filter(c => participatingCharIds.includes(c.id));
  const activeSceneObj = selectedSceneId ? scenes.find(s => s.id === selectedSceneId) : null;

  // ... (renderImageSelectorModal remains same) ...
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
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-4">
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
                
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
                        画幅选择
                    </label>
                    <div className="flex bg-cinematic-900 p-1 rounded-lg border border-cinematic-700">
                        <button
                            onClick={() => setTargetAspectRatio("16:9")}
                            className={`flex-1 py-2 rounded-md text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                                targetAspectRatio === "16:9" 
                                ? "bg-cinematic-700 text-white shadow-md" 
                                : "text-slate-500 hover:text-slate-300"
                            }`}
                        >
                            <Monitor size={14} /> 电影横屏 (16:9)
                        </button>
                        <button