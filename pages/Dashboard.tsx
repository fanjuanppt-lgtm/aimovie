

import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, Globe, Film, Rocket, Glasses, ArrowRight, MoveLeft, MoveRight } from 'lucide-react';
import { Universe, UniverseType } from '../types';

interface DashboardProps {
  universes: Universe[];
  onReorder: (id: string, direction: 'left' | 'right') => void;
}

const getTypeIcon = (type: UniverseType) => {
  switch (type) {
    case UniverseType.REAL: return <Globe size={16} />;
    case UniverseType.ADAPTED: return <Film size={16} />;
    case UniverseType.FICTIONAL: return <Rocket size={16} />;
    case UniverseType.VIRTUAL: return <Glasses size={16} />;
    default: return <Globe size={16} />;
  }
};

export const Dashboard: React.FC<DashboardProps> = ({ universes, onReorder }) => {
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <header className="mb-6 md:mb-10 mt-2 md:mt-0">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">创作控制台</h1>
        <p className="text-sm md:text-base text-slate-400">管理你的多元宇宙，孵化新的故事。</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 pb-20">
        {/* Create New Card */}
        <Link
          to="/create-universe"
          className="group relative flex flex-col items-center justify-center h-64 md:h-80 rounded-2xl border-2 border-dashed border-slate-700 hover:border-cinematic-gold hover:bg-cinematic-800/30 transition-all cursor-pointer"
        >
          <div className="p-4 md:p-5 rounded-full bg-cinematic-800 group-hover:scale-110 transition-transform mb-4 text-cinematic-gold border border-cinematic-700 group-hover:border-cinematic-gold">
            <Plus size={24} className="md:w-8 md:h-8" />
          </div>
          <h3 className="text-lg md:text-xl font-semibold text-slate-300 group-hover:text-white">创建新宇宙</h3>
          <p className="text-xs md:text-sm text-slate-500 mt-2">定义规则、背景与物理法则</p>
        </Link>

        {/* Universe Cards */}
        {universes.map((u, index) => (
          <div key={u.id} className="group bg-cinematic-800 rounded-2xl border border-cinematic-700 overflow-hidden hover:shadow-2xl hover:shadow-black/50 transition-all hover:-translate-y-1 flex flex-col h-72 md:h-80 relative">
            
            {/* Cover Image Background */}
            <div className="absolute inset-0 z-0">
                {u.coverImage ? (
                    <img src={u.coverImage} alt={u.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900" />
                )}
                {/* Gradient Overlay for text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-cinematic-900 via-cinematic-900/80 to-transparent opacity-90" />
            </div>

            <div className="relative z-10 p-5 md:p-6 flex-1 flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                 <div className="px-2 py-1 bg-black/60 backdrop-blur rounded-md text-[10px] md:text-xs text-cinematic-gold border border-cinematic-gold/20 flex items-center gap-1 font-bold uppercase tracking-wider">
                   {getTypeIcon(u.type)} {u.type}
                 </div>
                 
                 {/* Reorder Buttons - Only visible on hover or touch */}
                 <div className="flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                     {index > 0 && (
                         <button 
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onReorder(u.id, 'left'); }}
                            className="p-1.5 bg-black/60 hover:bg-cinematic-gold hover:text-black rounded text-white transition-colors border border-white/10"
                            title="向前移动"
                         >
                             <MoveLeft size={14} />
                         </button>
                     )}
                     {index < universes.length - 1 && (
                         <button 
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onReorder(u.id, 'right'); }}
                            className="p-1.5 bg-black/60 hover:bg-cinematic-gold hover:text-black rounded text-white transition-colors border border-white/10"
                            title="向后移动"
                         >
                             <MoveRight size={14} />
                         </button>
                     )}
                 </div>
              </div>

              <div className="mt-auto">
                <h3 className="text-xl md:text-2xl font-bold text-white mb-2 leading-tight">{u.name}</h3>
                <p className="text-slate-300 text-xs md:text-sm line-clamp-2 mb-4 md:mb-6 opacity-80">{u.description}</p>
                
                <Link 
                    to={`/universe/${u.id}`}
                    className="inline-flex items-center justify-center gap-2 w-full py-2 md:py-3 bg-white/10 hover:bg-cinematic-gold hover:text-black backdrop-blur text-white text-sm md:text-base font-bold rounded-lg transition-all"
                >
                    进入宇宙孵化器 <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};