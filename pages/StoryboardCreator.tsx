

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Universe, StoryEgg, Character, Storyboard, Scene, StoryboardFrame, ScriptShot } from '../types';
import { generateDetailedScript, generateStoryboardFrameImage, refineStoryboardPanel, polishShotText, ShotReference } from '../services/geminiService';
import { ArrowLeft, Clapperboard, Loader2, Save, Sparkles, Map, ZoomIn, X, Users, Wand2, PenTool, FileText, Settings2, Grid, Lock, Unlock, History, GitCompare, ArrowRightLeft, PlusCircle, Film, User, Check, Cloud, ChevronDown, ChevronUp, Eye, Layout, CheckCircle, Smartphone, Monitor, AlertCircle } from 'lucide-react';

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

      // Prepare Script for Prompt (Formatted)
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

      // Prepare Shot References from selections
      const shotRefs: ShotReference[] = [];
      targetShots.forEach((s, idx) => {
          if (s.selectedImageIds) {
              Object.entries(s.selectedImageIds).forEach(([charId, imgId]) => {
                  const char = availableCharacters.find(c => c.id === charId);
                  const img = char?.images.find(i => i.id === imgId);
                  if (char && img) {
                      shotRefs.push({
                          frameIndex: idx, // 0 to 3 relative to group
                          charName: char.roots.name,
                          imageUrl: img.url
                      });
                  }
              });
          }
      });

      // Prepare Characters for General Ref (Characters appearing in this group)
      // We collect unique characters appearing in this group to pass as general style reference
      // Service will limit to top 2 to avoid payload issues.
      const charsInGroup = new Set<string>();
      targetShots.forEach(s => s.characterIds?.forEach(id => charsInGroup.add(id)));
      const charRefs = availableCharacters
          .filter(c => charsInGroup.has(c.id))
          .map(c => {
               // Prefer cover image, else first valid image
               const img = c.images.find(i => i.id === c.coverImageId) || c.images.find(i => !i.deletedAt);
               return { name: c.roots.name, imageUrl: img?.url || '' };
          })
          .filter(c => !!c.imageUrl);
      
      // Resolve Scene Image for this Group (Override > Global > None)
      let currentGroupSceneUrl = null;
      if (groupSceneOverrides[groupIndex]) {
            currentGroupSceneUrl = groupSceneOverrides[groupIndex];
      } else if (activeSceneObj) {
            const main = activeSceneObj.images.find(i => i.type === 'main');
            if (main) currentGroupSceneUrl = main.url;
      }

      // Context construction
      const context = `Universe: ${universe.name} (${universe.type}). Story: ${egg.title}. Scene: ${sceneTitle}. ${roughPlot}`;

      try {
         const imageUrl = await generateStoryboardFrameImage(
            context,
            formattedScript,
            "cinematic", // Internal style hint, effectively overridden by stylePreset
            currentGroupSceneUrl || undefined,
            charRefs,
            groupIndex > 0 ? generatedFrames[groupIndex - 1]?.imageUrl : undefined,
            shotRefs,
            targetAspectRatio,
            egg.visualStyle // stylePreset
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
              shotType: `2x2 Grid ${targetAspectRatio}`,
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
          const msg = e.message || '';
          if (msg.includes('Safety') || msg.includes('SAFETY')) {
              alert("生成失败：触发安全拦截 (Safety Block)。\n请尝试修改剧本中过于暴力或敏感的描述。");
          } else if (msg.includes('429') || msg.includes('Overloaded')) {
              alert("生成失败：模型过载 (Overloaded)。\n请稍等几秒后重试。");
          } else {
              alert(`生成失败: ${msg}`);
          }
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
                            onClick={() => setTargetAspectRatio("9:16")}
                            className={`flex-1 py-2 rounded-md text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                                targetAspectRatio === "9:16" 
                                ? "bg-cinematic-700 text-white shadow-md" 
                                : "text-slate-500 hover:text-slate-300"
                            }`}
                        >
                            <Smartphone size={14} /> 短剧竖屏 (9:16)
                        </button>
                    </div>
                </div>
             </div>

             {/* CAST SELECTION */}
             <div className="bg-cinematic-900/30 p-4 rounded-lg border border-cinematic-700/50">
                 <label className="block text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1"><Users size={12}/> 本场参演角色 (Cast)</label>
                 <div className="flex flex-wrap gap-2">
                     {availableCharacters.map(char => {
                         const isSelected = participatingCharIds.includes(char.id);
                         return (
                             <button
                                key={char.id}
                                onClick={() => toggleParticipatingChar(char.id)}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 border transition-all ${
                                    isSelected 
                                    ? 'bg-cinematic-gold/20 text-cinematic-gold border-cinematic-gold' 
                                    : 'bg-cinematic-900 text-slate-500 border-cinematic-700 hover:border-slate-500'
                                }`}
                             >
                                 <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-cinematic-gold' : 'bg-slate-600'}`} />
                                 {char.roots.name}
                             </button>
                         )
                     })}
                     {availableCharacters.length === 0 && <span className="text-xs text-slate-600">无可用角色，请在角色工坊创建。</span>}
                 </div>
             </div>
        </div>

        {/* SHOT GROUPS */}
        {Array.from({ length: totalGroups }).map((_, groupIndex) => {
            const groupShots = scriptShots.slice(groupIndex * SHOTS_PER_GROUP, (groupIndex + 1) * SHOTS_PER_GROUP);
            const frameData = generatedFrames[groupIndex]; // This holds the 2x2 Image
            
            // Resolve Scene Image for this Group (Override > Global > None)
            let currentGroupSceneUrl = null;
            if (groupSceneOverrides[groupIndex]) {
                 currentGroupSceneUrl = groupSceneOverrides[groupIndex];
            } else if (activeSceneObj) {
                 const main = activeSceneObj.images.find(i => i.type === 'main');
                 if (main) currentGroupSceneUrl = main.url;
            }

            return (
                <div key={groupIndex} className="bg-cinematic-800 border border-cinematic-700 rounded-xl overflow-hidden shadow-xl animate-in slide-in-from-bottom-4">
                    {/* GROUP HEADER */}
                    <div className="bg-cinematic-900/80 p-3 border-b border-cinematic-700 flex justify-between items-center">
                         <div className="flex items-center gap-3">
                             <span className="bg-cinematic-700 text-white px-2 py-1 rounded text-xs font-bold">Group {groupIndex + 1}</span>
                             <span className="text-slate-500 text-xs">Shots {groupIndex * SHOTS_PER_GROUP + 1} - {(groupIndex + 1) * SHOTS_PER_GROUP}</span>
                         </div>
                         <div className="flex gap-1">
                              <button 
                                 onClick={() => handleMoveGroup(groupIndex, 'up')}
                                 disabled={groupIndex === 0}
                                 className="p-1.5 text-slate-500 hover:text-white disabled:opacity-30"
                              >
                                  <ArrowRightLeft className="-rotate-90" size={14} />
                              </button>
                              <button 
                                 onClick={() => handleMoveGroup(groupIndex, 'down')}
                                 disabled={groupIndex === totalGroups - 1}
                                 className="p-1.5 text-slate-500 hover:text-white disabled:opacity-30"
                              >
                                  <ArrowRightLeft className="rotate-90" size={14} />
                              </button>
                         </div>
                    </div>

                    <div className="flex flex-col lg:flex-row">
                        {/* LEFT: SCRIPTING (4 Shots) */}
                        <div className="flex-1 p-6 border-r border-cinematic-700 space-y-6">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2"><FileText size={16}/> 剧本脚本</h3>
                                <button 
                                    onClick={() => handleAIScriptGen(groupIndex)}
                                    disabled={isBrainstorming}
                                    className="text-xs bg-cinematic-700 hover:bg-cinematic-600 text-cinematic-gold px-3 py-1.5 rounded flex items-center gap-1 disabled:opacity-50 transition-colors"
                                >
                                    {isBrainstorming ? <Loader2 className="animate-spin" size={12}/> : <Sparkles size={12}/>} 
                                    AI 灵感生成
                                </button>
                            </div>

                            <div className="space-y-4">
                                {groupShots.map((shot, i) => {
                                    const realIndex = groupIndex * SHOTS_PER_GROUP + i;
                                    return (
                                        <div key={shot.id} className="bg-cinematic-900/50 p-3 rounded-lg border border-cinematic-700/50">
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-cinematic-gold font-bold text-xs w-6">{shot.id}.</span>
                                                    <select 
                                                        value={shot.theme}
                                                        onChange={(e) => updateShotTheme(realIndex, e.target.value)}
                                                        className="bg-cinematic-800 text-slate-300 text-[10px] rounded px-1 py-0.5 border border-cinematic-700 outline-none w-28"
                                                    >
                                                        <option value="">- 镜头景别 -</option>
                                                        {SHOT_SCALES.map(s => <option key={s} value={s}>{s}</option>)}
                                                    </select>
                                                </div>
                                                <div className="flex gap-2">
                                                     {/* Char Selector Trigger */}
                                                     <div className="flex -space-x-1">
                                                         {shot.characterIds?.map(cid => {
                                                             const c = availableCharacters.find(ch => ch.id === cid);
                                                             if (!c) return null;
                                                             // Check if specific image selected
                                                             const hasImg = !!shot.selectedImageIds?.[cid];
                                                             return (
                                                                 <div 
                                                                    key={cid} 
                                                                    onClick={() => setActiveImageSelector({ shotIndex: realIndex, charId: cid })}
                                                                    className={`w-5 h-5 rounded-full border border-cinematic-800 bg-slate-700 flex items-center justify-center text-[8px] cursor-pointer hover:z-10 relative ${hasImg ? 'ring-1 ring-green-500' : ''}`}
                                                                    title={c.roots.name}
                                                                 >
                                                                     {c.roots.name[0]}
                                                                     {hasImg && <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full"></div>}
                                                                 </div>
                                                             )
                                                         })}
                                                         <button 
                                                            onClick={(e) => {
                                                                const rect = e.currentTarget.getBoundingClientRect();
                                                                // Simple toggle menu logic could go here, or just a dropdown
                                                            }}
                                                            className="w-5 h-5 rounded-full bg-cinematic-800 border border-cinematic-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-cinematic-700"
                                                         >
                                                             <PlusCircle size={10} />
                                                         </button>
                                                         {/* Custom Dropdown for Characters */}
                                                         <select 
                                                            className="w-5 h-5 opacity-0 absolute cursor-pointer"
                                                            onChange={(e) => {
                                                                if(e.target.value) toggleCharForShot(realIndex, e.target.value);
                                                                e.target.value = "";
                                                            }}
                                                         >
                                                             <option value="">Add</option>
                                                             {activeCast.map(c => (
                                                                 <option key={c.id} value={c.id}>{c.roots.name}</option>
                                                             ))}
                                                         </select>
                                                     </div>

                                                    <button 
                                                        onClick={() => handlePolishShot(realIndex)}
                                                        disabled={shot.isPolishing || !shot.content}
                                                        className="p-1 hover:bg-cinematic-800 rounded text-slate-500 hover:text-cinematic-gold" 
                                                        title="AI 润色"
                                                    >
                                                        {shot.isPolishing ? <Loader2 className="animate-spin" size={12}/> : <Wand2 size={12}/>}
                                                    </button>
                                                    <button 
                                                        onClick={() => toggleShotLock(realIndex)}
                                                        className={`p-1 hover:bg-cinematic-800 rounded ${shot.isLocked ? 'text-cinematic-gold' : 'text-slate-600'}`}
                                                    >
                                                        {shot.isLocked ? <Lock size={12}/> : <Unlock size={12}/>}
                                                    </button>
                                                </div>
                                            </div>
                                            <textarea 
                                                value={shot.content}
                                                onChange={e => updateShotContent(realIndex, e.target.value)}
                                                rows={2}
                                                className="w-full bg-transparent text-xs text-white placeholder-slate-600 outline-none resize-none leading-relaxed"
                                                placeholder="描述画面内容、动作和运镜..."
                                            />
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Scene Context Override */}
                            <div className="mt-4 pt-4 border-t border-cinematic-700/50">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                                        <Map size={10} /> 本组场景 (Scene Context)
                                    </span>
                                    {currentGroupSceneUrl ? (
                                        <div className="flex items-center gap-2">
                                            <img src={currentGroupSceneUrl} className="w-8 h-4 object-cover rounded border border-slate-600" />
                                            <button 
                                                onClick={() => setActiveSceneSelectorGroup(groupIndex)}
                                                className="text-[10px] text-cinematic-gold hover:underline"
                                            >
                                                更换
                                            </button>
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={() => setActiveSceneSelectorGroup(groupIndex)}
                                            className="text-[10px] text-slate-500 hover:text-white flex items-center gap-1"
                                        >
                                            <PlusCircle size={10} /> 指定场景
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: VISUAL BOARD (2x2 Grid) */}
                        <div className="lg:w-[500px] xl:w-[600px] p-6 bg-black/20 flex flex-col">
                             <div className="flex justify-between items-center mb-4">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2"><Layout size={16}/> 视觉呈现</h3>
                                <button 
                                    onClick={() => handleGenerateImage(groupIndex)}
                                    disabled={isGeneratingMap[groupIndex]}
                                    className="bg-cinematic-gold hover:bg-amber-400 text-black font-bold px-4 py-1.5 rounded text-xs flex items-center gap-2 shadow-lg disabled:opacity-50 transition-transform active:scale-95"
                                >
                                    {isGeneratingMap[groupIndex] ? <Loader2 className="animate-spin" size={14}/> : <Film size={14}/>}
                                    生成分镜组图
                                </button>
                             </div>

                             <div className={`relative bg-black rounded-lg border-2 overflow-hidden shadow-2xl transition-all group/board ${frameData ? 'border-cinematic-gold' : 'border-cinematic-700'}`}>
                                  {/* Aspect Ratio Container */}
                                  <div className={`w-full ${targetAspectRatio === "16:9" ? "aspect-video" : "aspect-[9/16]"}`}>
                                      {frameData && frameData.imageUrl ? (
                                          <img 
                                            src={frameData.imageUrl} 
                                            alt="Storyboard" 
                                            className="w-full h-full object-cover" 
                                          />
                                      ) : isGeneratingMap[groupIndex] ? (
                                          <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                                              <Loader2 className="animate-spin text-cinematic-gold" size={32} />
                                              <span className="text-xs text-slate-400 animate-pulse">AI 正在绘制 4K 分镜...</span>
                                          </div>
                                      ) : (
                                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-700">
                                              <Clapperboard size={48} className="mb-2 opacity-20" />
                                              <span className="text-xs">等待生成</span>
                                          </div>
                                      )}
                                  </div>

                                  {/* Overlay Controls */}
                                  {frameData && frameData.imageUrl && (
                                      <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover/board:opacity-100 transition-opacity">
                                           <button 
                                              onClick={() => setViewingImage(frameData.imageUrl!)}
                                              className="p-2 bg-black/60 hover:bg-white text-white hover:text-black rounded-full backdrop-blur"
                                              title="全屏预览"
                                           >
                                               <ZoomIn size={16} />
                                           </button>
                                           <button 
                                              onClick={() => {
                                                  setActiveRefineGroupIndex(groupIndex);
                                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                              }}
                                              className="p-2 bg-black/60 hover:bg-cinematic-gold text-white hover:text-black rounded-full backdrop-blur"
                                              title="局部精修 (Inpainting)"
                                           >
                                               <Settings2 size={16} />
                                           </button>
                                           <button 
                                              onClick={() => setShowHistoryForGroup(groupIndex)}
                                              className="p-2 bg-black/60 hover:bg-blue-500 text-white rounded-full backdrop-blur"
                                              title="版本历史"
                                           >
                                               <History size={16} />
                                           </button>
                                      </div>
                                  )}

                                  {/* Compare Overlay */}
                                  {comparingImage && compareTargetGroup === groupIndex && (
                                      <div className="absolute bottom-2 left-2 right-2 bg-black/80 text-white text-xs p-2 rounded flex justify-between items-center animate-in slide-in-from-bottom-2">
                                           <span>已更新。是否对比旧版？</span>
                                           <div className="flex gap-2">
                                               <button onClick={() => setViewingImage(comparingImage)} className="text-cinematic-gold hover:underline">查看旧版</button>
                                               <button onClick={() => { setComparingImage(null); setCompareTargetGroup(null); }} className="text-slate-400 hover:text-white"><X size={14}/></button>
                                           </div>
                                      </div>
                                  )}
                             </div>
                        </div>
                    </div>

                    {/* HISTORY DRAWER */}
                    {showHistoryForGroup === groupIndex && frameData?.imageHistory && (
                        <div className="bg-black/50 p-4 border-t border-cinematic-700 animate-in slide-in-from-top-2">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="text-xs font-bold text-slate-400 uppercase">版本历史</h4>
                                <button onClick={() => setShowHistoryForGroup(null)}><X size={14} className="text-slate-500 hover:text-white" /></button>
                            </div>
                            <div className="flex gap-3 overflow-x-auto pb-2">
                                {frameData.imageHistory.map((url, hIdx) => (
                                    <div key={hIdx} className="flex-shrink-0 w-32 aspect-video bg-black rounded border border-slate-700 relative group/hist">
                                        <img src={url} className="w-full h-full object-cover opacity-60 group-hover/hist:opacity-100 transition-opacity" />
                                        <button 
                                            onClick={() => handleSwitchVersion(url)}
                                            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover/hist:opacity-100 text-xs font-bold text-white transition-opacity"
                                        >
                                            恢复此版
                                        </button>
                                    </div>
                                ))}
                                {frameData.imageHistory.length === 0 && <span className="text-xs text-slate-600">无历史记录</span>}
                            </div>
                        </div>
                    )}
                </div>
            );
        })}

        {/* ADD GROUP BUTTON */}
        <button 
            onClick={handleAddGroup}
            className="w-full py-4 border-2 border-dashed border-cinematic-700 hover:border-cinematic-gold rounded-xl text-slate-500 hover:text-cinematic-gold flex items-center justify-center gap-2 transition-all group"
        >
            <PlusCircle size={20} className="group-hover:scale-110 transition-transform"/>
            <span className="font-bold">添加下一组分镜 (4 Shots)</span>
        </button>

      </div>

      {/* REFINE TOOLBAR (Sticky Bottom or Modal) */}
      {activeRefineGroupIndex !== null && (
          <div className="fixed bottom-0 left-0 right-0 bg-cinematic-900 border-t border-cinematic-gold z-50 p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-full">
               <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-cinematic-800 p-2 rounded text-white font-bold text-sm whitespace-nowrap">
                            Group {activeRefineGroupIndex + 1}
                        </div>
                        <div className="h-8 w-px bg-slate-700"></div>
                        <div className="flex items-center gap-2">
                             <span className="text-xs text-slate-400 uppercase font-bold">修改第几格?</span>
                             <div className="flex bg-cinematic-800 rounded border border-cinematic-700">
                                 {[1,2,3,4].map(n => (
                                     <button 
                                        key={n}
                                        onClick={() => setRefinePanelNum(n)}
                                        className={`px-3 py-1.5 text-sm font-bold transition-colors ${refinePanelNum === n ? 'bg-cinematic-gold text-black' : 'text-slate-400 hover:text-white'}`}
                                     >
                                         {n}
                                     </button>
                                 ))}
                             </div>
                        </div>
                    </div>
                    
                    <div className="flex-1 w-full relative">
                        <input 
                            value={refineInstruction}
                            onChange={e => setRefineInstruction(e.target.value)}
                            placeholder="描述修改内容 (例如: 2号镜头的角色表情改为惊讶，背景更暗一些)"
                            className="w-full bg-cinematic-800 border border-cinematic-700 rounded-lg px-4 py-2 pr-24 text-white text-sm focus:border-cinematic-gold outline-none"
                            onKeyDown={(e) => e.key === 'Enter' && handleRefinePanel()}
                        />
                        <button 
                            onClick={handleRefinePanel}
                            disabled={isRefining}
                            className="absolute right-1 top-1 bottom-1 px-4 bg-cinematic-700 hover:bg-cinematic-600 text-white text-xs font-bold rounded flex items-center gap-2 disabled:opacity-50"
                        >
                            {isRefining ? <Loader2 className="animate-spin" size={14}/> : <Wand2 size={14}/>}
                            执行
                        </button>
                    </div>

                    <button onClick={() => setActiveRefineGroupIndex(null)} className="p-2 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white">
                        <X size={20} />
                    </button>
               </div>
          </div>
      )}

      {/* FULL SCREEN VIEWER */}
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

      {/* IMAGE SELECTOR MODAL */}
      {renderImageSelectorModal()}

      {/* SCENE SELECTOR MODAL */}
      {activeSceneSelectorGroup !== null && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-cinematic-900 border border-cinematic-gold rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh]">
                   <div className="p-4 border-b border-cinematic-700 flex justify-between items-center bg-cinematic-800/50 rounded-t-xl">
                       <h3 className="text-lg font-bold text-white flex items-center gap-2">
                           <Map size={18} className="text-cinematic-gold"/>
                           为 Group {activeSceneSelectorGroup + 1} 指定场景
                       </h3>
                       <button onClick={() => setActiveSceneSelectorGroup(null)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white"><X size={20} /></button>
                   </div>
                   <div className="p-6 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-4">
                       <button 
                          onClick={() => {
                              const newOverrides = { ...groupSceneOverrides };
                              delete newOverrides[activeSceneSelectorGroup];
                              setGroupSceneOverrides(newOverrides);
                              setActiveSceneSelectorGroup(null);
                          }}
                          className="bg-cinematic-800 border-2 border-dashed border-slate-600 rounded-lg p-4 flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-white hover:border-white"
                       >
                           <X size={24} />
                           <span className="text-xs font-bold">清除指定 (使用全局)</span>
                       </button>
                       {availableScenes.map(scene => {
                           const mainImg = scene.images.find(i => i.type === 'main');
                           return (
                               <div 
                                  key={scene.id} 
                                  onClick={() => {
                                      if (mainImg) {
                                          setGroupSceneOverrides(prev => ({ ...prev, [activeSceneSelectorGroup]: mainImg.url }));
                                      }
                                      setActiveSceneSelectorGroup(null);
                                  }}
                                  className="group cursor-pointer"
                               >
                                   <div className="aspect-video bg-black rounded-lg overflow-hidden border border-slate-700 group-hover:border-cinematic-gold">
                                       {mainImg ? (
                                           <img src={mainImg.url} className="w-full h-full object-cover" />
                                       ) : (
                                           <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">无图</div>
                                       )}
                                   </div>
                                   <p className="text-xs text-center mt-2 text-slate-400 group-hover:text-white truncate">{scene.name}</p>
                               </div>
                           )
                       })}
                   </div>
              </div>
          </div>
      )}

    </div>
  );
};
