import React from 'react';
import { PokemonData } from '../types';

interface RightPanelProps {
  data: PokemonData;
  activeTab: number;
  selectedMoveIndex: number;
  onMoveSelect: (index: number) => void;
}

const TYPE_COLORS: Record<string, string> = {
  normal: '#A8A878', fire: '#F08030', water: '#6890F0', grass: '#78C850',
  electric: '#F8D030', ice: '#98D8D8', fighting: '#C03028', poison: '#A040A0',
  ground: '#E0C068', flying: '#A890F0', psychic: '#F85888', bug: '#A8B820',
  rock: '#B8A038', ghost: '#705898', dragon: '#7038F8', steel: '#B8B8D0',
  dark: '#705848', fairy: '#EE99AC'
};

const RightPanel: React.FC<RightPanelProps> = ({ data, activeTab, selectedMoveIndex, onMoveSelect }) => {
  
  // === TAB 0: PROFILE ===
  if (activeTab === 0) {
    return (
      <div className="w-[58%] bg-gba-panel h-full border-l-4 border-gba-panelDark flex flex-col relative overflow-hidden">
        <div className="absolute inset-0 bg-stripes-white opacity-30 pointer-events-none"></div>

        <div className="p-1 z-10 flex flex-col h-full">
          
          {/* Section: PROFILE */}
          <div className="mb-1">
            <div className="bg-gradient-header-blue w-full px-2 py-0.5 mb-1 rounded-sm shadow-sm">
               <span className="font-gba-header text-[9px] text-white tracking-wider text-shadow-sm block">PROFILE</span>
            </div>
            
            <div className="flex justify-between px-2 mb-1">
                <span className="font-gba-header text-[9px] text-gba-tealLight text-shadow-sm">OT/</span>
                <span className="font-gba-header text-[9px] text-gba-blueDark uppercase flex-1 ml-1 font-bold">{data.ot}</span>
                <span className="font-gba-header text-[9px] text-gba-text tracking-tighter">
                    <span className="text-[8px] text-gba-blueDark mr-0.5">IDNo.</span>{data.otId}
                </span>
            </div>

            <div className="flex px-2 items-center mb-2">
                 <span className="font-gba-header text-[9px] text-gba-text mr-2">TYPE/</span>
                 <div className="flex gap-1 flex-wrap">
                    {data.types.map(t => (
                        <span 
                            key={t} 
                            style={{ backgroundColor: TYPE_COLORS[t.toLowerCase()] || '#A8A878' }}
                            className="font-gba-header text-[7px] text-white px-2 py-0.5 rounded-sm uppercase text-shadow-sm border border-black/10 block min-w-[3.5rem] text-center"
                        >
                            {t}
                        </span>
                    ))}
                 </div>
            </div>
          </div>

          {/* Section: ABILITY */}
          <div className="mb-1">
            <div className="bg-gradient-header-blue w-full px-2 py-0.5 mb-1 rounded-sm shadow-sm">
               <span className="font-gba-header text-[9px] text-white tracking-wider text-shadow-sm block">ABILITY</span>
            </div>
            {data.abilities.length > 0 && (
                <div className="px-2">
                    <div className="font-gba-header text-[9px] text-gba-text uppercase mb-0.5">{data.abilities[0].name}</div>
                    <div className="bg-white/50 p-1 rounded-sm border border-gba-blueDark/10">
                        <div className="font-gba-body text-[18px] text-gba-text leading-4 tracking-tight">
                            {data.abilities[0].description}
                        </div>
                    </div>
                </div>
            )}
          </div>

          {/* Section: TRAINER MEMO */}
          <div className="flex-1 flex flex-col">
             <div className="bg-gradient-header-blue w-full px-2 py-0.5 mb-1 rounded-sm shadow-sm">
               <span className="font-gba-header text-[9px] text-white tracking-wider text-shadow-sm block">TRAINER MEMO</span>
            </div>
            <div className="px-2 pt-0.5 font-gba-body text-[18px] leading-5 text-gba-text">
                <span className="text-gba-red font-bold uppercase">{data.nature} </span>
                <span>nature, </span>
                <br/>
                <span>met at L</span><span className="text-[14px]">v</span>{data.metLevel},
                <br/>
                <span className="text-gba-red font-bold uppercase">{data.metLocation}.</span>
            </div>
             <div className="px-2 mt-auto font-gba-body text-[16px] text-gba-text opacity-80 leading-4 italic border-t border-gba-blueDark/20 pt-1">
                "{data.flavorText}"
             </div>
          </div>

        </div>
      </div>
    );
  }

  // === TAB 1: SKILLS (Stats) ===
  if (activeTab === 1) {
    return (
      <div className="w-[58%] bg-gba-panel h-full border-l-4 border-gba-panelDark flex flex-col relative">
         <div className="absolute inset-0 bg-stripes-white opacity-30 pointer-events-none"></div>
         <div className="p-1 z-10 flex flex-col h-full">
            
            {/* Top Row: ITEM & RIBBON */}
            <div className="flex gap-1 mb-1">
                <div className="flex-1">
                     <div className="bg-gradient-header-yellow w-full px-1 py-0.5 mb-1 rounded-sm text-center">
                        <span className="font-gba-header text-[9px] text-gba-text/70 tracking-wider text-shadow-white block">ITEM</span>
                     </div>
                     <div className="font-gba-header text-[9px] text-gba-text text-center">{data.heldItem || 'NONE'}</div>
                </div>
                <div className="flex-1">
                     <div className="bg-gradient-header-yellow w-full px-1 py-0.5 mb-1 rounded-sm text-center">
                        <span className="font-gba-header text-[9px] text-gba-text/70 tracking-wider text-shadow-white block">RIBBON</span>
                     </div>
                     <div className="font-gba-header text-[9px] text-gba-text text-center">NONE</div>
                </div>
            </div>

            {/* Middle: STATS */}
            <div className="bg-gradient-header-yellow w-full px-2 py-0.5 mb-1 rounded-sm shadow-sm">
               <span className="font-gba-header text-[9px] text-gba-text/70 tracking-wider text-shadow-white block">STATS</span>
            </div>
            
            <div className="px-2 space-y-1.5 flex-1">
                {/* HP Special Row */}
                <div className="flex items-center justify-between">
                     <span className="font-gba-header text-[8px] text-gba-blueDark uppercase w-16">HP</span>
                     <div className="font-gba-header text-[10px] text-gba-text flex gap-1">
                        <span className="w-8 text-right">{data.currentHp}/</span>
                        <span className="w-6 text-right">{data.maxHp}</span>
                     </div>
                </div>
                
                {/* Other Stats */}
                {data.stats.slice(1).map((stat) => (
                    <div key={stat.name} className="flex items-center justify-between">
                        <span className="font-gba-header text-[8px] text-gba-blueDark uppercase w-20">{stat.name}</span>
                        <span className="font-gba-header text-[10px] text-gba-text w-6 text-right font-bold">{stat.value}</span>
                    </div>
                ))}
            </div>

            {/* Bottom: EXP */}
            <div className="mt-auto">
                 <div className="bg-gradient-header-yellow w-full px-2 py-0.5 mb-1 rounded-sm shadow-sm">
                    <span className="font-gba-header text-[9px] text-gba-text/70 tracking-wider text-shadow-white block">EXP.</span>
                 </div>
                 <div className="px-2 pb-1">
                    <div className="flex justify-between items-center mb-1">
                        <span className="font-gba-header text-[8px] text-gba-blueDark uppercase">EXP. POINTS</span>
                        <span className="font-gba-header text-[10px] text-gba-text font-bold">{data.exp}</span>
                    </div>
                    <div className="flex justify-between items-center mb-1">
                        <span className="font-gba-header text-[8px] text-gba-blueDark uppercase">NEXT LV.</span>
                        <span className="font-gba-header text-[10px] text-gba-text font-bold">{data.nextLevelExp}</span>
                    </div>
                    {/* EXP BAR */}
                    <div className="flex items-center gap-1 mt-1">
                         <span className="font-gba-header text-[7px] text-gba-blueDark font-bold">EXP</span>
                         <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden border border-white/50 relative">
                             <div className="absolute inset-0 bg-blue-500 w-[65%]"></div>
                             {/* Gloss effect */}
                             <div className="absolute top-0 left-0 w-full h-[1px] bg-white/30"></div>
                         </div>
                    </div>
                 </div>
            </div>
         </div>
      </div>
    );
  }

  // === TAB 2: MOVES ===
  if (activeTab === 2) {
      return (
      <div className="w-[58%] bg-gba-panel h-full border-l-4 border-gba-panelDark flex flex-col relative">
         <div className="absolute inset-0 bg-stripes-white opacity-30 pointer-events-none"></div>
         <div className="p-1 z-10 flex flex-col h-full">
             
             {/* MOVES HEADER */}
             <div className="bg-gradient-header-darkpurple w-full px-2 py-0.5 mb-1 rounded-sm shadow-sm">
                <span className="font-gba-header text-[9px] text-white tracking-wider text-shadow-sm block">MOVES</span>
             </div>

             {/* MOVES LIST */}
             <div className="flex-1 px-1 space-y-1">
                {data.moves.map((move, index) => {
                    const isSelected = selectedMoveIndex === index;
                    return (
                        <div 
                            key={index}
                            onClick={() => onMoveSelect(index)}
                            className={`flex items-center p-1 cursor-pointer transition-transform ${isSelected ? 'bg-red-500/10 -translate-y-0.5 shadow-sm border border-red-400 rounded-sm' : ''}`}
                        >
                            {/* Type Icon */}
                            <div 
                                style={{ backgroundColor: TYPE_COLORS[move.type.toLowerCase()] || '#888' }}
                                className="w-12 h-4 flex items-center justify-center border border-black/20 rounded-sm mr-2 shadow-sm"
                            >
                                <span className="font-gba-header text-[6px] text-white uppercase text-shadow-sm">{move.type}</span>
                            </div>
                            
                            {/* Move Name */}
                            <div className="flex-1 font-gba-header text-[9px] text-gba-text uppercase text-shadow-white">{move.name}</div>
                            
                            {/* PP */}
                            <div className="font-gba-header text-[9px] text-gba-text">
                                PP <span className="ml-1">{move.pp}/{move.maxPp}</span>
                            </div>
                        </div>
                    );
                })}
                {/* Empty slots filler */}
                {[...Array(4 - data.moves.length)].map((_, i) => (
                     <div key={`empty-${i}`} className="flex items-center p-1 opacity-30">
                         <div className="w-12 h-4 bg-gray-300 rounded-sm mr-2"></div>
                         <div className="flex-1 h-1 bg-gray-300 rounded-sm"></div>
                         <div className="w-10 h-1 bg-gray-300 rounded-sm"></div>
                     </div>
                ))}
             </div>

             {/* DESCRIPTION */}
             <div className="mt-auto">
                 <div className="bg-gradient-header-darkpurple w-full px-2 py-0.5 mb-1 rounded-sm shadow-sm">
                    <span className="font-gba-header text-[9px] text-white tracking-wider text-shadow-sm block">DESCRIPTION</span>
                 </div>
                 <div className="px-2 h-16 bg-white/40 rounded-sm border border-gba-blueDark/10 p-1">
                     <p className="font-gba-body text-[18px] leading-5 text-gba-text">
                        {data.moves[selectedMoveIndex]?.description || "Select a move to see details."}
                     </p>
                 </div>
             </div>
         </div>
      </div>
      );
  }

  return null;
};

export default RightPanel;
