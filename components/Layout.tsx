
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Film, Home, Egg, Image as ImageIcon, Settings, Menu, X, LogOut, User as UserIcon } from 'lucide-react';
import { UserProfile } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentUser?: UserProfile | null;
  onLogout?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentUser, onLogout }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const isUniverseContext = location.pathname.includes('/universe/');
  
  // Extract IDs if present
  const pathParts = location.pathname.split('/');
  const universeId = isUniverseContext ? pathParts[2] : null;
  const eggId = location.pathname.includes('/egg/') ? pathParts[4] : null;

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="flex h-screen bg-cinematic-900 text-slate-200 overflow-hidden">
      
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-cinematic-800 border-b border-cinematic-700 flex items-center justify-between px-4 z-40">
        <div className="flex items-center gap-2 text-cinematic-gold">
           <Film size={20} />
           <span className="font-bold text-lg">AI 影视造梦师</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-slate-300 hover:text-white"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Overlay (Mobile) */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-cinematic-800 border-r border-cinematic-700 flex flex-col flex-shrink-0 transition-transform duration-300 ease-in-out
        md:static md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-cinematic-700 flex items-center gap-2 hidden md:flex">
          <Film className="w-6 h-6 text-cinematic-gold" />
          <span className="font-bold text-xl tracking-wide text-white">AI 影视造梦师</span>
        </div>

        {/* User Profile Card */}
        {currentUser && (
             <div className="mx-3 mt-4 mb-2 p-3 bg-cinematic-900/50 rounded-lg border border-cinematic-700 flex items-center gap-3">
                 <div className="w-8 h-8 rounded-full bg-cinematic-gold text-black flex items-center justify-center font-bold text-sm">
                     {currentUser.username.charAt(0).toUpperCase()}
                 </div>
                 <div className="flex-1 overflow-hidden">
                     <div className="text-sm font-bold text-white truncate">{currentUser.username}</div>
                     <div className="text-[10px] text-green-400 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> 在线 (本地)
                     </div>
                 </div>
                 {onLogout && (
                     <button onClick={onLogout} className="text-slate-500 hover:text-red-400 transition-colors" title="退出登录">
                         <LogOut size={16} />
                     </button>
                 )}
             </div>
        )}

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-2">
          <NavItem to="/" icon={<Home size={20} />} label="首页概览" active={location.pathname === '/'} onClick={closeMobileMenu} />
          
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
                onClick={closeMobileMenu}
              />
              <NavItem 
                to={`/universe/${universeId}/gallery`} 
                icon={<ImageIcon size={20} />} 
                label="全宇宙图库" 
                active={location.pathname.endsWith('/gallery')} 
                onClick={closeMobileMenu}
              />
            </>
          )}

          {eggId && (
             <div className="mt-2 ml-4 border-l-2 border-cinematic-700 pl-2 space-y-1">
               <Link 
                 to={`/universe/${universeId}/egg/${eggId}`}
                 onClick={closeMobileMenu}
                 className={`block px-3 py-2 rounded text-sm ${location.pathname === `/universe/${universeId}/egg/${eggId}` ? 'text-cinematic-gold bg-cinematic-700/50' : 'text-slate-400 hover:text-slate-200'}`}
               >
                 └ 当前故事蛋详情
               </Link>
                <Link 
                 to={`/universe/${universeId}/egg/${eggId}/character-studio`}
                 onClick={closeMobileMenu}
                 className={`block px-3 py-2 rounded text-sm ${location.pathname.includes('/character-studio') ? 'text-cinematic-gold bg-cinematic-700/50' : 'text-slate-400 hover:text-slate-200'}`}
               >
                 └ 角色工坊
               </Link>
               <Link 
                 to={`/universe/${universeId}/egg/${eggId}/storyboard-creator`}
                 onClick={closeMobileMenu}
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
                onClick={closeMobileMenu}
                className="mt-3 block w-full py-2 px-4 bg-cinematic-accent hover:bg-blue-600 text-white text-center rounded-md text-sm font-medium transition-colors"
               >
                + 新建宇宙
               </Link>
             </div>
          )}
        </nav>
        
        {/* Footer Actions */}
        <div className="p-3 border-t border-cinematic-700 bg-cinematic-800 pb-safe">
           <NavItem to="/settings" icon={<Settings size={18} />} label="全局设置 / Key" active={location.pathname === '/settings'} onClick={closeMobileMenu} />
        </div>

        <div className="p-2 text-xs text-slate-600 text-center hidden md:block">
          Powered by Google Gemini 2.5
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-cinematic-900 relative pt-16 md:pt-0">
        {children}
      </main>
    </div>
  );
};

const NavItem: React.FC<{ to: string; icon: React.ReactNode; label: string; active: boolean; onClick?: () => void }> = ({ to, icon, label, active, onClick }) => (
  <Link
    to={to}
    onClick={onClick}
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
