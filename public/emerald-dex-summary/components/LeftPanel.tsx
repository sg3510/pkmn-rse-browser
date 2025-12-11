import React from 'react';
import { PokemonData } from '../types';

interface LeftPanelProps {
  data: PokemonData;
  activeTab: number; // 0=Profile, 1=Skills, 2=Moves
  selectedMoveIndex?: number;
}

const LeftPanel: React.FC<LeftPanelProps> = ({ data, activeTab, selectedMoveIndex = 0 }) => {
  // Format ID to be at least 3 digits
  const formattedId = data.id.toString().padStart(3, '0');
  
  const selectedMove = data.moves[selectedMoveIndex] || { power: '---', accuracy: '---' };

  return (
    <div className="w-[42%] flex flex-col h-full relative border-r-2 border-gba-shadow/20">
      {/* Background with stripes */}
      <div className="absolute inset-0 bg-stripes-teal opacity-20 pointer-events-none z-0"></div>

      {/* Header Info: No & Marks */}
      <div className="flex items-center justify-between px-2 pt-1 z-10">
        <div className="font-gba-header text-[10px] text-white text-shadow-sm tracking-tighter">
          <span className="text-yellow-200">No</span>{formattedId}
        </div>
        <div className="flex space-x-1">
          {/* Status Markers (Circle, Square, Triangle, Heart) */}
          {['●', '■', '▲', '♥'].map((mark, i) => (
            <span key={i} className="text-[8px] text-gba-shadow opacity-50">{mark}</span>
          ))}
        </div>
      </div>

      {/* Sprite Container */}
      <div className="mx-auto mt-2 bg-white/80 border-2 border-gba-panelDark rounded w-24 h-24 flex items-center justify-center relative shadow-inner">
         <div className="absolute inset-0 bg-stripes-white opacity-50"></div>
         <img 
            src={data.spriteUrl} 
            alt={data.name} 
            className="w-20 h-20 pixelated relative z-10 object-contain"
         />
      </div>

      {/* Conditional Bottom Section */}
      {activeTab === 2 ? (
         /* MOVES VIEW: Show Name and then Power/Accuracy Table */
         <div className="px-2 mt-2 z-10 flex-1 flex flex-col">
            <div className="font-gba-header text-white text-[10px] leading-relaxed text-shadow-sm uppercase mb-1">
               {data.name}
            </div>
            
            <div className="mt-auto mb-2">
                {/* EFFECT Header */}
                <div className="bg-gradient-header-darkpurple w-full px-2 py-0.5 mb-0.5 rounded-sm">
                   <span className="font-gba-header text-[9px] text-white tracking-wider text-shadow-sm block text-center">EFFECT</span>
                </div>
                
                {/* Power/Accuracy Table */}
                <div className="bg-gba-panel border-2 border-gba-panelDark rounded p-1">
                    <div className="flex justify-between items-center mb-0.5">
                        <span className="font-gba-header text-[9px] text-gba-text text-shadow-white">POWER</span>
                        <span className="font-gba-header text-[10px] text-black">{selectedMove.power}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="font-gba-header text-[9px] text-gba-text text-shadow-white">ACCURACY</span>
                        <span className="font-gba-header text-[10px] text-black">{selectedMove.accuracy}</span>
                    </div>
                </div>
            </div>
         </div>
      ) : (
         /* NORMAL VIEW (Profile/Skills): Show Name, Nickname, Ball, Level */
         <div className="px-2 mt-4 z-10">
            <div className="font-gba-header text-white text-[10px] leading-relaxed text-shadow-sm uppercase">
               {data.name}
            </div>
            <div className="font-gba-header text-white text-[10px] leading-relaxed text-shadow-sm uppercase opacity-80">
               /{data.name}
            </div>

            <div className="flex items-center justify-between mt-3">
               <div className="flex items-center">
               {/* Pokeball Icon */}
               <div className="w-3 h-3 bg-red-500 rounded-full border border-white mr-2 relative overflow-hidden shadow-sm">
                  <div className="absolute bottom-0 w-full h-1/2 bg-white"></div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-white rounded-full border border-gray-500"></div>
               </div>
               <span className="font-gba-header text-[10px] text-white text-shadow-sm">
                  L<span className="text-[8px] align-top">v</span>{data.level}
               </span>
               </div>
               <div className="font-gba-header text-[10px] text-red-300 text-shadow-sm">
               {data.gender === 'female' ? '♀' : data.gender === 'male' ? '♂' : ''}
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default LeftPanel;
