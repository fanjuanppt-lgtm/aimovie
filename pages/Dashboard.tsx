
import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, Globe, ArrowRight } from 'lucide-react';
import { Universe } from '../types';

interface DashboardProps {
  universes: Universe[];
}

export const Dashboard: React.FC<DashboardProps> = ({ universes }) => {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-white mb-2">创作控制台</h1>
        <p className="text-slate-400">管理你的多元宇宙，孵化新的故事。</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Create New Card */}
        <Link
          to="/create-universe"
          className="group relative flex flex-col items-center justify-center h-64 rounded-2xl border-2 border-dashed border-slate-600 hover:border-cinematic-gold hover:bg-cinematic-800/50 transition-all cursor-pointer"
        >
          <div className="p-4 rounded-full bg-cinematic-800 group-hover:scale-110 transition-transform mb-4 text-cinematic-gold">
            <Plus size={32} />
          </div>
          <h3 className="text-xl font-semibold text-slate-300 group-hover:text-white">创建新宇宙</h3>
          <p className="text-sm text-slate-500 mt-2">定义规则、背景与物理法则</p>
        </Link>

        {/* Universe Cards */}
        {universes.map((u) => (
          <div key={u.id} className="bg-cinematic-800 rounded-2xl border border-cinematic-700 overflow-hidden hover:shadow-2xl hover:shadow-black/50 transition-shadow flex flex-col">
            <div className="h-32 bg-gradient-to-r from-slate-800 to-slate-700 flex items-center justify-center relative">
               <Globe className="text-slate-600 w-16 h-16" />
               <div className="absolute top-4 right-4 px-2 py-1 bg-black/50 backdrop-blur rounded text-xs text-cinematic-gold border border-cinematic-gold/30">
                 {u.type}
               </div>
            </div>
            <div className="p-6 flex-1 flex flex-col">
              <h3 className="text-xl font-bold text-white mb-2">{u.name}</h3>
              <p className="text-slate-400 text-sm line-clamp-3 mb-4 flex-1">{u.description}</p>
              <Link 
                to={`/universe/${u.id}`}
                className="inline-flex items-center justify-center gap-2 w-full py-2 bg-cinematic-700 hover:bg-cinematic-600 text-white rounded-lg transition-colors"
              >
                进入宇宙孵化器 <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
