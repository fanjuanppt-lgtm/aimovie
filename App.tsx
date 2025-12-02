
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Universe, StoryEgg, Character, Storyboard, Scene, UserProfile } from './types';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { UniverseCreator } from './pages/UniverseCreator';
import { UniverseDetail } from './pages/UniverseDetail';
import { StoryEggDetail } from './pages/StoryEggDetail';
import { CharacterStudio } from './pages/CharacterStudio';
import { StoryboardCreator } from './pages/StoryboardCreator';
import { SceneStudio } from './pages/SceneStudio';
import { Gallery } from './pages/Gallery';
import { Settings } from './pages/Settings';
import { LoginPage } from './pages/LoginPage';
import { dbService } from './services/db';
import { Loader2 } from 'lucide-react';

const App: React.FC = () => {
  // Auth State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Data State
  const [universes, setUniverses] = useState<Universe[]>([]);
  const [storyEggs, setStoryEggs] = useState<StoryEgg[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [storyboards, setStoryboards] = useState<Storyboard[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);

  // 1. Check Login Session on Mount
  useEffect(() => {
    const checkSession = async () => {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            try {
                const user = JSON.parse(storedUser);
                setCurrentUser(user);
            } catch (e) {
                localStorage.removeItem('currentUser');
            }
        }
        setIsAuthChecking(false);
    };
    checkSession();
  }, []);

  // 2. Load Data when User Changes
  useEffect(() => {
    const loadUserData = async () => {
      if (!currentUser) {
          // Clear data if logged out
          setUniverses([]);
          setStoryEggs([]);
          setCharacters([]);
          setStoryboards([]);
          setScenes([]);
          return;
      }

      setIsDataLoading(true);
      try {
        const userId = currentUser.id;
        const [u, e, c, s, sc] = await Promise.all([
          dbService.getUniverses(userId),
          dbService.getStoryEggs(userId),
          dbService.getCharacters(userId),
          dbService.getStoryboards(userId),
          dbService.getScenes(userId)
        ]);
        
        setUniverses(u.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0)));
        setStoryEggs(e);
        setCharacters(c);
        setStoryboards((s || []).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0)));
        setScenes((sc || []).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0)));
      } catch (error) {
        console.error("Failed to load user data:", error);
      } finally {
        setIsDataLoading(false);
      }
    };

    loadUserData();
  }, [currentUser]);

  // Auth Handlers
  const handleLogin = (user: UserProfile) => {
      localStorage.setItem('currentUser', JSON.stringify(user));
      setCurrentUser(user);
  };

  const handleLogout = () => {
      localStorage.removeItem('currentUser');
      setCurrentUser(null);
  };

  // --- CRUD WRAPPERS (Inject Owner ID) ---
  const injectOwner = (item: any) => ({ ...item, ownerId: currentUser?.id });

  const addUniverse = async (u: Universe) => {
    if (!currentUser) return;
    try {
      const maxIndex = universes.length > 0 ? Math.max(...universes.map(un => un.orderIndex || 0)) : -1;
      const newUniverse = { ...injectOwner(u), orderIndex: maxIndex + 1 };
      
      await dbService.saveUniverse(newUniverse);
      setUniverses(prev => [...prev, newUniverse]);
    } catch (error) { console.error(error); }
  };

  const addStoryEgg = async (e: StoryEgg) => {
    if (!currentUser) return;
    try {
      const newEgg = injectOwner(e);
      await dbService.saveStoryEgg(newEgg);
      setStoryEggs(prev => [...prev, newEgg]);
    } catch (error) { console.error(error); }
  };

  const addCharacter = async (c: Character) => {
    if (!currentUser) return;
    try {
      const newChar = injectOwner(c);
      await dbService.saveCharacter(newChar);
      setCharacters(prev => {
        const exists = prev.find(char => char.id === c.id);
        return exists ? prev.map(char => char.id === c.id ? newChar : char) : [...prev, newChar];
      });
    } catch (error) { console.error(error); }
  };

  const deleteCharacter = async (id: string) => {
      if (!currentUser) return;
      try {
          const char = characters.find(c => c.id === id);
          if (char) {
              const updated = { ...char, deletedAt: new Date().toISOString() };
              await dbService.saveCharacter(updated);
              setCharacters(prev => prev.map(c => c.id === id ? updated : c));
          }
      } catch (error) { console.error(error); }
  };

  const restoreCharacter = async (id: string) => {
      if (!currentUser) return;
      try {
          const char = characters.find(c => c.id === id);
          if (char) {
              const updated = { ...char, deletedAt: undefined };
              await dbService.saveCharacter(updated);
              setCharacters(prev => prev.map(c => c.id === id ? updated : c));
          }
      } catch (error) { console.error(error); }
  };

  const hardDeleteCharacter = async (id: string) => {
      if (!currentUser) return;
      try {
          await dbService.deleteCharacter(id);
          setCharacters(prev => prev.filter(c => c.id !== id));
      } catch (error) { console.error(error); }
  };

  const addScene = async (s: Scene) => {
      if (!currentUser) return;
      try {
          let finalScene = injectOwner(s);
          // Set orderIndex if new
          if (finalScene.orderIndex === undefined) {
             const siblings = scenes.filter(sc => sc.storyEggId === s.storyEggId);
             const maxIndex = siblings.length > 0 ? Math.max(...siblings.map(sc => sc.orderIndex || 0)) : -1;
             finalScene = { ...finalScene, orderIndex: maxIndex + 1 };
          }

          await dbService.saveScene(finalScene);
          setScenes(prev => {
              const exists = prev.find(item => item.id === s.id);
              return exists ? prev.map(item => item.id === s.id ? finalScene : item) : [...prev, finalScene];
          });
      } catch (error) { console.error(error); }
  }

  const updateScene = async (s: Scene) => {
      if (!currentUser) return;
      try {
          const updated = injectOwner(s);
          await dbService.saveScene(updated);
          setScenes(prev => prev.map(item => item.id === s.id ? updated : item));
      } catch (error) { console.error(error); }
  };

  const addStoryboard = async (s: Storyboard) => {
    if (!currentUser) return;
    try {
      let finalSb = injectOwner(s);
      if (s.orderIndex === undefined) {
          const siblings = storyboards.filter(sb => sb.storyEggId === s.storyEggId);
          const maxIndex = siblings.length > 0 ? Math.max(...siblings.map(sb => sb.orderIndex || 0)) : -1;
          finalSb = { ...finalSb, orderIndex: maxIndex + 1 };
      }
      await dbService.saveStoryboard(finalSb);
      setStoryboards(prev => {
        const exists = prev.find(sb => sb.id === finalSb.id);
        return exists ? prev.map(sb => sb.id === finalSb.id ? finalSb : sb) : [...prev, finalSb];
      });
    } catch (error) { console.error(error); }
  };
  
  const updateStoryboard = async (s: Storyboard) => {
       if (!currentUser) return;
       try {
          const updated = injectOwner(s);
          await dbService.saveStoryboard(updated);
          setStoryboards(prev => prev.map(sb => sb.id === s.id ? updated : sb));
       } catch (error) { console.error(error); }
  };

  const updateUniverse = async (u: Universe) => {
    if (!currentUser) return;
    try {
      const updated = injectOwner(u);
      await dbService.saveUniverse(updated); 
      setUniverses(prev => prev.map(item => item.id === u.id ? updated : item));
    } catch (error) { console.error(error); }
  };
  
  const reorderUniverse = async (id: string, direction: 'left' | 'right') => {
      if (!currentUser) return;
      const currentIndex = universes.findIndex(u => u.id === id);
      if (currentIndex === -1) return;
      
      const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= universes.length) return;
      
      const currentU = universes[currentIndex];
      const targetU = universes[targetIndex];
      
      const idx1 = currentU.orderIndex ?? currentIndex;
      const idx2 = targetU.orderIndex ?? targetIndex;
      
      const updatedCurrent = { ...currentU, orderIndex: idx2 };
      const updatedTarget = { ...targetU, orderIndex: idx1 };
      
      try {
          await Promise.all([dbService.saveUniverse(updatedCurrent), dbService.saveUniverse(updatedTarget)]);
          const newUniverses = [...universes];
          newUniverses[currentIndex] = updatedTarget;
          newUniverses[targetIndex] = updatedCurrent;
          setUniverses(newUniverses);
      } catch (e) { console.error(e); }
  };

  const updateStoryEgg = async (e: StoryEgg) => {
    if (!currentUser) return;
    try {
      const updated = injectOwner(e);
      await dbService.saveStoryEgg(updated);
      setStoryEggs(prev => prev.map(item => item.id === e.id ? updated : item));
    } catch (error) { console.error(error); }
  };

  if (isAuthChecking) {
    return (
      <div className="h-screen w-screen bg-cinematic-900 flex flex-col items-center justify-center text-slate-400">
        <Loader2 size={48} className="animate-spin text-cinematic-gold mb-4" />
        <p>初始化安全环境...</p>
      </div>
    );
  }

  if (!currentUser) {
      return <LoginPage onLogin={handleLogin} />;
  }

  if (isDataLoading) {
     return (
      <div className="h-screen w-screen bg-cinematic-900 flex flex-col items-center justify-center text-slate-400">
        <Loader2 size={48} className="animate-spin text-cinematic-gold mb-4" />
        <p>正在加密加载 {currentUser.username} 的宇宙数据...</p>
      </div>
    );
  }

  return (
    <Router>
      <Layout currentUser={currentUser} onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Dashboard universes={universes} onReorder={reorderUniverse} />} />
          <Route path="/create-universe" element={<UniverseCreator onSave={addUniverse} />} />
          <Route path="/settings" element={<Settings />} />
          
          <Route 
            path="/universe/:universeId" 
            element={
                <UniverseDetail 
                    universes={universes} 
                    storyEggs={storyEggs} 
                    storyboards={storyboards}
                    onSaveEgg={addStoryEgg} 
                    onUpdateUniverse={updateUniverse} 
                />
            } 
          />

          <Route 
            path="/universe/:universeId/egg/:eggId" 
            element={
                <StoryEggDetail 
                    universes={universes} 
                    storyEggs={storyEggs} 
                    characters={characters} 
                    storyboards={storyboards} 
                    scenes={scenes} 
                    onUpdateEgg={updateStoryEgg} 
                    onUpdateCharacter={addCharacter}
                    onDeleteCharacter={deleteCharacter}
                    onRestoreCharacter={restoreCharacter}
                    onHardDeleteCharacter={hardDeleteCharacter}
                    onUpdateStoryboard={updateStoryboard}
                    onUpdateScene={updateScene}
                />
            } 
          />

          <Route 
            path="/universe/:universeId/egg/:eggId/character-studio" 
            element={<CharacterStudio universes={universes} storyEggs={storyEggs} characters={characters} onSave={addCharacter} />} 
          />
           <Route 
            path="/universe/:universeId/egg/:eggId/character-studio/:characterId" 
            element={<CharacterStudio universes={universes} storyEggs={storyEggs} characters={characters} onSave={addCharacter} />} 
          />

          <Route 
             path="/universe/:universeId/egg/:eggId/scene-studio"
             element={<SceneStudio universes={universes} storyEggs={storyEggs} scenes={scenes} onSave={addScene} />}
          />
          <Route 
             path="/universe/:universeId/egg/:eggId/scene-studio/:sceneId"
             element={<SceneStudio universes={universes} storyEggs={storyEggs} scenes={scenes} onSave={addScene} />}
          />
          
          <Route 
            path="/universe/:universeId/egg/:eggId/storyboard-creator" 
            element={<StoryboardCreator universes={universes} storyEggs={storyEggs} characters={characters} storyboards={storyboards} scenes={scenes} onSave={addStoryboard} />} 
          />
          <Route 
            path="/universe/:universeId/egg/:eggId/storyboard-creator/:storyboardId" 
            element={<StoryboardCreator universes={universes} storyEggs={storyEggs} characters={characters} storyboards={storyboards} scenes={scenes} onSave={addStoryboard} />} 
          />

          <Route path="/universe/:universeId/gallery" element={<Gallery characters={characters} />} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
