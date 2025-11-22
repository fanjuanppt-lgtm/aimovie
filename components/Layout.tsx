
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Film, Users, Image as ImageIcon, Home, Egg, Clapperboard } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const isUniverseContext = location.pathname.includes('/universe/');
  
  // Extract IDs if present
  const pathParts = location.pathname.split('/');
  const universeId = isUniverseContext ? pathParts[2] : null;
  const eggId = location.pathname.includes('/egg/') ? pathParts[4] : null;

  return (
    <div className="flex h-screen bg-cinematic-900 text-slate-200 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-cinematic-800 border-r border-cinematic-700 flex flex-col flex-shrink-0 transition-all duration-300">
        <div className="p-6 border-b border-cinematic-700 flex items-center gap-2">
          <Film className="w-6 h-6 text-cinematic-gold" />
          <span className="font-bold text-xl tracking-wide text-white">AI 影视造梦师</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-2">
          <NavItem to="/" icon={<Home size={20} />} label="首页概览" active={location.pathname === '/'} />
          
          {universeId && (
            <>
              <div className="pt-4 pb-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                当前宇宙工作区
              </div>
              <NavItem 
                to={`/universe/${universeId}`} 
                icon={<Egg size={20} />} 
                label="故事孵化中心" 
                active={location.pathname === `/universe/${universeId}` || (location.pathname.includes('/egg') && !eggId)} 
              />
              <NavItem 
                to={`/universe/${universeId}/gallery`} 
                icon={<ImageIcon size={20} />} 
                label="全宇宙图库" 
                active={location.pathname.endsWith('/gallery')} 
              />
            </>
          )}

          {eggId && (
             <div className="mt-2 ml-4 border-l-2 border-cinematic-700 pl-2 space-y-1">
               <Link 
                 to={`/universe/${universeId}/egg/${eggId}`}
                 className={`block px-3 py-2 rounded text-sm ${location.pathname === `/universe/${universeId}/egg/${eggId}` ? 'text-cinematic-gold bg-cinematic-700/50' : 'text-slate-400 hover:text-slate-200'}`}
               >
                 └ 当前故事蛋详情
               </Link>
                <Link 
                 to={`/universe/${universeId}/egg/${eggId}/character-studio`}
                 className={`block px-3 py-2 rounded text-sm ${location.pathname.includes('/character-studio') ? 'text-cinematic-gold bg-cinematic-700/50' : 'text-slate-400 hover:text-slate-200'}`}
               >
                 └ 角色工坊
               </Link>
               <Link 
                 to={`/universe/${universeId}/egg/${eggId}/storyboard-creator`}
                 className={`block px-3 py-2 rounded text-sm ${location.pathname.includes('/storyboard-creator') ? 'text-cinematic-gold bg-cinematic-700/50' : 'text-slate-400 hover:text-slate-200'}`}
               >
                 └ 智能分镜工坊
               </Link>
             </div>
          )}

          {!universeId && (
             <div className="mt-8 p-4 bg-cinematic-700/50 rounded-lg border border-cinematic-700 mx-2">
               <p className="text-sm text-slate-400">请选择或创建一个宇宙以开始创作。</p>
               <Link 
                to="/create-universe"
                className="mt-3 block w-full py-2 px-4 bg-cinematic-accent hover:bg-blue-600 text-white text-center rounded-md text-sm font-medium transition-colors"
               >
                + 新建宇宙
               </Link>
             </div>
          )}
        </nav>

        <div className="p-4 border-t border-cinematic-700 text-xs text-slate-500 text-center">
          Powered by Google Gemini 2.5
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-cinematic-900 relative">
        {children}
      </main>
    </div>
  );
};

const NavItem: React.FC<{ to: string; icon: React.ReactNode; label: string; active: boolean }> = ({ to, icon, label, active }) => (
  <Link
    to={to}
    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
      active 
        ? 'bg-cinematic-700 text-white border-l-4 border-cinematic-gold' 
        : 'text-slate-400 hover:bg-cinematic-700/50 hover:text-slate-200'
    }`}
  >
    {icon}
    <span className="font-medium">{label}</span>
  </Link>
);