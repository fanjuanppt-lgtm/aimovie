import React from 'react';
import { Character } from '../types';
import { User } from 'lucide-react';

interface GalleryProps {
  characters: Character[];
}

export const Gallery: React.FC<GalleryProps> = ({ characters }) => {
  // Flatten all images from all characters
  const allImages = characters.flatMap(char => 
    char.images.map(img => ({ ...img, charName: char.roots.name }))
  );

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-white mb-8">资产图库</h1>
      
      {allImages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-500">
          <p>暂无生成的图像资产。</p>
        </div>
      ) : (
        <div className="columns-1 md:columns-3 lg:columns-4 gap-4 space-y-4">
          {allImages.map((img) => (
            <div key={img.id} className="break-inside-avoid bg-cinematic-800 rounded-xl overflow-hidden border border-cinematic-700 shadow-lg hover:shadow-cinematic-accent/20 transition-shadow">
              <img src={img.url} alt={img.prompt} className="w-full display-block" />
              <div className="p-3">
                <div className="flex items-center gap-2 text-sm font-bold text-white mb-1">
                   <User size={14} className="text-cinematic-gold" /> {img.charName}
                </div>
                <p className="text-xs text-slate-400">{img.angle}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
