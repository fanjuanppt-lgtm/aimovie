
import React, { useState } from 'react';
import { Film, User, Lock, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { dbService } from '../services/db';
import { UserProfile } from '../types';

interface LoginPageProps {
  onLogin: (user: UserProfile) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isRegistering) {
        // Register
        const newUser: UserProfile = {
          id: Date.now().toString(),
          username,
          password, // Note: In production, hash this!
          createdAt: new Date()
        };
        await dbService.registerUser(newUser);
        
        // Auto migrate legacy data to the first registered user? 
        // Or just migrate on login. Let's migrate on first successful login/register interaction.
        await dbService.migrateLegacyData(newUser.id);
        
        onLogin(newUser);
      } else {
        // Login
        const user = await dbService.loginUser(username, password);
        if (user) {
           onLogin(user);
        } else {
           setError("用户名或密码错误");
        }
      }
    } catch (err: any) {
      setError(err.message || "操作失败");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cinematic-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Cinematic Background Elements */}
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1600&q=80')] bg-cover bg-center opacity-20"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-cinematic-900 via-cinematic-900/90 to-cinematic-900/60"></div>
      
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-cinematic-gold text-black mb-4 shadow-[0_0_20px_rgba(245,158,11,0.5)]">
             <Film size={32} />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 tracking-tight">AI 影视造梦师</h1>
          <p className="text-slate-400">专业级 AI 辅助创作工作台</p>
        </div>

        <div className="bg-cinematic-800/80 backdrop-blur-xl border border-cinematic-700 p-8 rounded-2xl shadow-2xl">
           <div className="flex justify-center mb-6 border-b border-cinematic-700">
               <button 
                 onClick={() => setIsRegistering(false)}
                 className={`pb-3 px-4 text-sm font-bold transition-colors border-b-2 ${!isRegistering ? 'text-cinematic-gold border-cinematic-gold' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
               >
                 登录账号
               </button>
               <button 
                 onClick={() => setIsRegistering(true)}
                 className={`pb-3 px-4 text-sm font-bold transition-colors border-b-2 ${isRegistering ? 'text-cinematic-gold border-cinematic-gold' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
               >
                 注册新用户
               </button>
           </div>

           <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                 <label className="block text-xs font-bold text-slate-400 uppercase mb-2">用户名</label>
                 <div className="relative">
                    <User className="absolute left-3 top-3 text-slate-500" size={16} />
                    <input 
                      type="text" 
                      required
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      className="w-full bg-cinematic-900 border border-cinematic-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:border-cinematic-gold outline-none transition-all"
                      placeholder="输入用户名"
                    />
                 </div>
              </div>

              <div>
                 <label className="block text-xs font-bold text-slate-400 uppercase mb-2">密码</label>
                 <div className="relative">
                    <Lock className="absolute left-3 top-3 text-slate-500" size={16} />
                    <input 
                      type="password" 
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full bg-cinematic-900 border border-cinematic-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:border-cinematic-gold outline-none transition-all"
                      placeholder="********"
                    />
                 </div>
              </div>

              {error && (
                <div className="p-3 bg-red-900/20 border border-red-900/50 rounded text-red-400 text-xs text-center">
                   {error}
                </div>
              )}

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-gradient-to-r from-cinematic-gold to-amber-500 hover:from-amber-400 hover:to-amber-500 text-black font-bold rounded-lg shadow-lg shadow-amber-900/20 flex items-center justify-center gap-2 transition-all transform active:scale-95 mt-4"
              >
                 {isLoading ? <Loader2 className="animate-spin" size={18}/> : (isRegistering ? <Sparkles size={18}/> : <ArrowRight size={18}/>)}
                 {isRegistering ? '立即注册并进入' : '进入工作台'}
              </button>
           </form>

           {isRegistering && (
             <p className="text-[10px] text-slate-500 mt-4 text-center">
                * 本地模式：数据存储在当前浏览器的 IndexedDB 中。不同用户数据相互隔离。
             </p>
           )}
        </div>
        
        <div className="mt-8 text-center">
            <p className="text-xs text-slate-600">v2.0.0 Multi-User Edition</p>
        </div>
      </div>
    </div>
  );
};
