import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Universe, UniverseType } from '../types';
import { Sparkles, ArrowLeft } from 'lucide-react';

interface UniverseCreatorProps {
  onSave: (u: Universe) => void;
}

export const UniverseCreator: React.FC<UniverseCreatorProps> = ({ onSave }) => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [type, setType] = useState<UniverseType>(UniverseType.ADAPTED);
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newUniverse: Universe = {
      id: Date.now().toString(),
      name,
      type,
      description,
      rules,
      createdAt: new Date(),
    };
    onSave(newUniverse);
    navigate(`/universe/${newUniverse.id}/character`);
  };

  return (
    <div className="max-w-3xl mx-auto p-8">
      <button onClick={() => navigate('/')} className="flex items-center text-slate-400 hover:text-white mb-6">
        <ArrowLeft size={16} className="mr-1" /> 返回
      </button>

      <div className="bg-cinematic-800 rounded-2xl border border-cinematic-700 p-8 shadow-xl">
        <div className="flex items-center gap-3 mb-8 border-b border-cinematic-700 pb-6">
          <div className="p-3 bg-cinematic-gold/10 rounded-lg text-cinematic-gold">
            <Sparkles size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">构建新宇宙</h2>
            <p className="text-slate-400 text-sm">设定你故事的基石</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">宇宙名称</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：赛博朋克2077-Neo Tokyo"
              className="w-full bg-cinematic-900 border border-cinematic-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-cinematic-accent focus:border-transparent outline-none transition-all"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">宇宙类型</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.values(UniverseType).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                    type === t
                      ? 'bg-cinematic-accent border-cinematic-accent text-white'
                      : 'bg-cinematic-900 border-cinematic-700 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">位置与背景设定</label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="描述这个宇宙的地理位置、时代背景、社会结构..."
              className="w-full bg-cinematic-900 border border-cinematic-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-cinematic-accent focus:border-transparent outline-none transition-all resize-none"
            />
          </div>

          {/* Rules */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">核心规则与情节触发机制</label>
            <textarea
              required
              rows={4}
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              placeholder="物理法则（是否有魔法/高科技）、社会禁忌、可能触发情节的关键冲突点..."
              className="w-full bg-cinematic-900 border border-cinematic-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-cinematic-accent focus:border-transparent outline-none transition-all resize-none"
            />
          </div>

          <div className="pt-4">
            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-cinematic-accent to-blue-600 hover:from-blue-500 hover:to-blue-600 text-white font-bold rounded-lg shadow-lg shadow-blue-900/20 transition-all transform hover:scale-[1.01]"
            >
              完成设定并进入
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
