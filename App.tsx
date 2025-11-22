
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Universe, StoryEgg, Character, Storyboard } from './types';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { UniverseCreator } from './pages/UniverseCreator';
import { UniverseDetail } from './pages/UniverseDetail';
import { StoryEggDetail } from './pages/StoryEggDetail';
import { CharacterStudio } from './pages/CharacterStudio';
import { StoryboardCreator } from './pages/StoryboardCreator';
import { Gallery } from './pages/Gallery';
import { dbService } from './services/db';
import { Loader2 } from 'lucide-react';

// Main App Component
const App: React.FC = () => {
  const [universes, setUniverses] = useState<Universe[]>([]);
  const [storyEggs, setStoryEggs] = useState<StoryEgg[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [storyboards, setStoryboards] = useState<Storyboard[]>([]);
  const [isAppLoading, setIsAppLoading] = useState(true);

  // Load initial data from IndexedDB (Async)
  useEffect(() => {
    const initData = async () => {
      try {
        const [u, e, c, s] = await Promise.all([
          dbService.getUniverses(),
          dbService.getStoryEggs(),
          dbService.getCharacters(),
          dbService.getStoryboards()
        ]);
        setUniverses(u);
        setStoryEggs(e);
        setCharacters(c);
        setStoryboards(s || []);
      } catch (error) {
        console.error("Failed to load data from DB:", error);
      } finally {
        setIsAppLoading(false);
      }
    };

    initData();
  }, []);

  // --- Create Handlers ---

  const addUniverse = async (u: Universe) => {
    try {
      await dbService.saveUniverse(u);
      setUniverses(prev => [...prev, u]);
    } catch (error) {
      console.error("Failed to save universe", error);
      alert("保存宇宙失败，请重试");
    }
  };

  const addStoryEgg = async (e: StoryEgg) => {
    try {
      await dbService.saveStoryEgg(e);
      setStoryEggs(prev => [...prev, e]);
    } catch (error) {
      console.error("Failed to save story egg", error);
      alert("保存故事蛋失败");
    }
  };

  const addCharacter = async (c: Character) => {
    try {
      await dbService.saveCharacter(c);
      setCharacters(prev => {
        const exists = prev.find(char => char.id === c.id);
        if (exists) {
          return prev.map(char => char.id === c.id ? c : char);
        }
        return [...prev, c];
      });
    } catch (error) {
      console.error("Failed to save character", error);
      alert("保存角色失败，可能是图片过大或存储空间不足");
    }
  };

  const addStoryboard = async (s: Storyboard) => {
    try {
      await dbService.saveStoryboard(s);
      setStoryboards(prev => {
        const exists = prev.find(sb => sb.id === s.id);
        if (exists) {
          return prev.map(sb => sb.id === s.id ? s : sb);
        }
        return [...prev, s];
      });
    } catch (error) {
      console.error("Failed to save storyboard", error);
      alert("保存分镜失败");
    }
  };

  // --- Update Handlers ---

  const updateUniverse = async (u: Universe) => {
    try {
      await dbService.saveUniverse(u); // IndexedDB put acts as update if key exists
      setUniverses(prev => prev.map(item => item.id === u.id ? u : item));
    } catch (error) {
      console.error("Failed to update universe", error);
      alert("更新宇宙失败");
    }
  };

  const updateStoryEgg = async (e: StoryEgg) => {
    try {
      await dbService.saveStoryEgg(e);
      setStoryEggs(prev => prev.map(item => item.id === e.id ? e : item));
    } catch (error) {
      console.error("Failed to update story egg", error);
      alert("更新故事蛋失败");
    }
  };

  if (isAppLoading) {
    return (
      <div className="h-screen w-screen bg-cinematic-900 flex flex-col items-center justify-center text-slate-400">
        <Loader2 size={48} className="animate-spin text-cinematic-gold mb-4" />
        <p>正在加载影业数据库...</p>
      </div>
    );
  }

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard universes={universes} />} />
          <Route path="/create-universe" element={<UniverseCreator onSave={addUniverse} />} />
          
          {/* Universe Level */}
          <Route 
            path="/universe/:universeId" 
            element={<UniverseDetail universes={universes} storyEggs={storyEggs} onSaveEgg={addStoryEgg} onUpdateUniverse={updateUniverse} />} 
          />

          {/* Egg Level */}
          <Route 
            path="/universe/:universeId/egg/:eggId" 
            element={<StoryEggDetail universes={universes} storyEggs={storyEggs} characters={characters} storyboards={storyboards} onUpdateEgg={updateStoryEgg} />} 
          />

          {/* Character Creation Level (Create) */}
          <Route 
            path="/universe/:universeId/egg/:eggId/character-studio" 
            element={<CharacterStudio universes={universes} storyEggs={storyEggs} characters={characters} onSave={addCharacter} />} 
          />
          
          {/* Character Creation Level (Edit) */}
           <Route 
            path="/universe/:universeId/egg/:eggId/character-studio/:characterId" 
            element={<CharacterStudio universes={universes} storyEggs={storyEggs} characters={characters} onSave={addCharacter} />} 
          />
          
          {/* Storyboard Creation & Editing Level */}
          <Route 
            path="/universe/:universeId/egg/:eggId/storyboard-creator" 
            element={<StoryboardCreator universes={universes} storyEggs={storyEggs} characters={characters} storyboards={storyboards} onSave={addStoryboard} />} 
          />
          <Route 
            path="/universe/:universeId/egg/:eggId/storyboard-creator/:storyboardId" 
            element={<StoryboardCreator universes={universes} storyEggs={storyEggs} characters={characters} storyboards={storyboards} onSave={addStoryboard} />} 
          />

          {/* Global Gallery */}
          <Route path="/universe/:universeId/gallery" element={<Gallery characters={characters} />} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
