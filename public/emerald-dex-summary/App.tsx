import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import LeftPanel from './components/LeftPanel';
import RightPanel from './components/RightPanel';
import { PokemonData } from './types';

// Accurate Ralts Data from screenshot
const DEFAULT_POKEMON: PokemonData = {
  id: 29,
  name: 'Ralts',
  spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/280.png',
  types: ['Psychic'],
  height: 4,
  weight: 66,
  abilities: [
    { name: 'Synchronize', description: 'Passes on status problems.' }
  ],
  stats: [
    { name: 'ATTACK', value: 11 },
    { name: 'DEFENSE', value: 12 },
    { name: 'SP. ATK', value: 14 },
    { name: 'SP. DEF', value: 11 },
    { name: 'SPEED', value: 12 },
  ],
  maxHp: 25,
  currentHp: 25,
  exp: 925,
  nextLevelExp: 325,
  flavorText: "It senses the emotions of people and Pokémon with the horns on its head.",
  level: 9,
  gender: 'male',
  heldItem: null,
  ot: 'Seb',
  otId: 32267,
  nature: 'Relaxed',
  metLocation: 'ROUTE 102',
  metLevel: 4,
  moves: [
    { 
        name: 'GROWL', type: 'Normal', pp: 40, maxPp: 40, power: '---', accuracy: 100, 
        description: "Growls cutely to reduce the foe's ATTACK." 
    },
    { 
        name: 'CONFUSION', type: 'Psychic', pp: 25, maxPp: 25, power: 50, accuracy: 100, 
        description: "A psychic attack that may cause confusion." 
    }
  ]
};

export default function App() {
  const [activeTab, setActiveTab] = useState(0); // 0 = Profile, 1 = Skills, 2 = Moves
  const [data, setData] = useState<PokemonData>(DEFAULT_POKEMON);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedMoveIndex, setSelectedMoveIndex] = useState(0);

  // Dynamic Header Title based on active tab
  const getHeaderTitle = () => {
    switch(activeTab) {
        case 0: return "POKéMON INFO";
        case 1: return "POKéMON SKILLS";
        case 2: return "BATTLE MOVES";
        default: return "POKéMON INFO";
    }
  };

  // Gemini Handler
  const handleAnalyze = async () => {
    if (!process.env.API_KEY) {
      alert("Please provide an API Key to use Gemini features.");
      return;
    }
    
    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Write a short, immersive, 2-sentence "Trainer Memo" or Pokedex entry for a level ${data.level} ${data.nature} nature ${data.name}. The tone should be like the Game Boy games (Gen 3). Do not include quotes.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const newFlavorText = response.text.trim();
      setData(prev => ({ ...prev, flavorText: newFlavorText }));
    } catch (e) {
      console.error("Gemini Error:", e);
      alert("Gemini is busy right now. Try again later!");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Search Handler (PokeAPI)
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;

    setLoading(true);
    try {
      const formattedQuery = searchQuery.toLowerCase();
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${formattedQuery}`);
      if (!res.ok) throw new Error('Pokemon not found');
      
      const pData = await res.json();
      
      // Get Species data for flavor text
      const speciesRes = await fetch(pData.species.url);
      const sData = await speciesRes.json();
      
      const flavorEntry = sData.flavor_text_entries.find((entry: any) => entry.language.name === 'en');
      const cleanFlavor = flavorEntry 
        ? flavorEntry.flavor_text.replace(/\f/g, ' ').replace(/\n/g, ' ') 
        : 'Data not available.';

      // Get Ability Details
      const abilityUrl = pData.abilities[0]?.ability?.url;
      let abilityDesc = "No description.";
      if (abilityUrl) {
          const abRes = await fetch(abilityUrl);
          const abData = await abRes.json();
          const abEntry = abData.effect_entries.find((e: any) => e.language.name === 'en');
          abilityDesc = abEntry ? abEntry.short_effect : "Effect unknown.";
      }

      // Fetch basic moves data (limiting to first 4 for simplicity)
      const fetchedMoves = [];
      for (const m of pData.moves.slice(0, 4)) {
          const moveRes = await fetch(m.move.url);
          const moveData = await moveRes.json();
          const descEntry = moveData.flavor_text_entries.find((e: any) => e.language.name === 'en' && e.version_group.name === 'emerald') 
                         || moveData.flavor_text_entries.find((e: any) => e.language.name === 'en');
          
          fetchedMoves.push({
              name: moveData.name.replace('-', ' '),
              type: moveData.type.name,
              pp: moveData.pp,
              maxPp: moveData.pp, // Simplified
              power: moveData.power || '---',
              accuracy: moveData.accuracy || '---',
              description: descEntry ? descEntry.flavor_text.replace(/\n/g, ' ') : "No description available."
          });
      }

      const hpStat = pData.stats.find((s:any) => s.stat.name === 'hp').base_stat;

      const newData: PokemonData = {
        id: pData.id,
        name: pData.name,
        spriteUrl: pData.sprites.front_default || DEFAULT_POKEMON.spriteUrl,
        types: pData.types.map((t: any) => t.type.name),
        height: pData.height,
        weight: pData.weight,
        abilities: [{
            name: pData.abilities[0]?.ability?.name.replace('-', ' ') || 'Unknown',
            description: abilityDesc
        }],
        stats: pData.stats.filter((s:any) => s.stat.name !== 'hp').map((s: any) => ({ 
            name: s.stat.name.replace('special-attack', 'SP. ATK').replace('special-defense', 'SP. DEF').replace('speed', 'SPEED').replace('attack', 'ATTACK').replace('defense', 'DEFENSE').toUpperCase(), 
            value: s.base_stat 
        })),
        maxHp: hpStat,
        currentHp: hpStat,
        exp: pData.base_experience * 10, // Mocked
        nextLevelExp: 1000, // Mocked
        flavorText: cleanFlavor,
        level: Math.floor(Math.random() * 50) + 5,
        gender: Math.random() > 0.5 ? 'male' : 'female',
        heldItem: null,
        ot: 'YOU',
        otId: Math.floor(Math.random() * 99999),
        nature: ['Bold', 'Hardy', 'Timid', 'Jolly', 'Gentle'][Math.floor(Math.random() * 5)],
        metLocation: 'Unknown Area',
        metLevel: 5,
        moves: fetchedMoves.length > 0 ? fetchedMoves : DEFAULT_POKEMON.moves
      };

      setData(newData);
      setSearchQuery('');
      setActiveTab(0); // Reset to profile
    } catch (err) {
      alert("Pokemon not found! Try 'Pikachu' or 'Mew'.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 font-sans bg-gray-900 overflow-hidden">
      
      {/* Container for responsive scaling */}
      <div className="w-full max-w-[520px] flex flex-col items-center gap-6">
        
        {/* Game Boy Advance Screen Frame - Responsive Wrapper */}
        <div className="w-full aspect-[3/2] relative bg-black p-[2%] rounded-lg shadow-2xl">
          
          {/* Main Display Area */}
          <div className="w-full h-full bg-gba-teal overflow-hidden flex flex-col relative border-4 border-gray-700 rounded-sm shadow-inner">
            
            {/* Emerald Header - "Progress Bar" Style */}
            {/* The background of the whole header strip is the light pill color */}
            <div className="h-[12%] bg-emerald-pill border-b-4 border-emerald-headerBorder flex items-center justify-between relative z-20 shadow-md">
                
                {/* Dark Purple Title Overlay - Convex Shape */}
                <div className="absolute left-0 top-0 bottom-0 w-[60%] bg-emerald-header rounded-r-full z-10"></div>

                {/* Title Text - Sits on top of the dark purple overlay */}
                <div className="relative z-20 pl-2 font-gba-header text-white text-[clamp(10px,3vw,16px)] tracking-tight text-shadow-hard text-stroke-sm uppercase whitespace-nowrap">
                    {getHeaderTitle()}
                </div>

                {/* Right Side Controls */}
                <div className="relative z-20 flex items-center pr-2 h-full">
                    {/* Pagination Dots - Sits on the light purple background */}
                    <div className="flex space-x-1.5 items-center mr-4">
                        {/* Dot 1: Info */}
                        <button 
                            onClick={() => setActiveTab(0)}
                            className={`w-3 h-3 rounded-full transition-all duration-100 border border-black/10 ${activeTab === 0 ? 'bg-white shadow-[0_0_4px_rgba(255,255,255,0.8)] scale-110' : 'bg-emerald-dotInactive hover:bg-emerald-dotInactive/80'}`}
                        ></button>
                        {/* Dot 2: Skills */}
                         <button 
                            onClick={() => setActiveTab(1)}
                            className={`w-3 h-3 rounded-full transition-all duration-100 border border-black/10 ${activeTab === 1 ? 'bg-white shadow-[0_0_4px_rgba(255,255,255,0.8)] scale-110' : 'bg-emerald-dotInactive hover:bg-emerald-dotInactive/80'}`}
                        ></button>
                        {/* Dot 3: Moves */}
                        <button 
                            onClick={() => setActiveTab(2)}
                            className={`w-3 h-3 rounded-full transition-all duration-100 border border-black/10 ${activeTab === 2 ? 'bg-white shadow-[0_0_4px_rgba(255,255,255,0.8)] scale-110' : 'bg-emerald-dotInactive hover:bg-emerald-dotInactive/80'}`}
                        ></button>
                    </div>

                    {/* Cancel Button */}
                    <div className="flex items-center">
                        <div className="w-4 h-4 rounded-full bg-red-600 border-b-2 border-r-2 border-red-800 flex items-center justify-center text-[9px] font-bold text-white mr-1 shadow-sm leading-none pt-0.5">
                            A
                        </div>
                        <span className="font-gba-header text-[clamp(8px,2.5vw,12px)] text-white text-shadow-sm text-stroke-sm">CANCEL</span>
                    </div>
                </div>
            </div>

            {/* Content Area - Flex Grow to fill remaining space */}
            <div className="flex flex-1 relative overflow-hidden">
                {loading ? (
                    <div className="absolute inset-0 z-50 bg-gba-teal flex items-center justify-center font-gba-header text-white animate-pulse">
                        SEARCHING...
                    </div>
                ) : (
                    <>
                        <LeftPanel data={data} activeTab={activeTab} selectedMoveIndex={selectedMoveIndex} />
                        <RightPanel 
                            data={data} 
                            activeTab={activeTab} 
                            selectedMoveIndex={selectedMoveIndex}
                            onMoveSelect={setSelectedMoveIndex}
                        />
                    </>
                )}
            </div>

          </div>
        </div>

        {/* Controls / Inputs */}
        <div className="w-full bg-gray-800 p-4 rounded-lg border border-gray-700 flex flex-col sm:flex-row justify-between items-center shadow-lg gap-4">
            <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-auto">
                <input 
                    type="text" 
                    placeholder="Search..." 
                    className="bg-gray-700 text-white font-gba-body text-xl px-3 py-1 rounded border border-gray-600 focus:outline-none focus:border-blue-400 w-full sm:w-48 placeholder-gray-500 uppercase"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-gba-header text-[10px] px-4 py-2 rounded shadow transition-colors shrink-0">
                    LOAD
                </button>
            </form>

            <button 
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="w-full sm:w-auto bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-gba-header text-[10px] px-4 py-2 rounded shadow flex items-center justify-center gap-2 transition-all"
            >
                {isAnalyzing ? (
                    <span className="animate-spin">✦</span>
                ) : (
                    <span>★</span>
                )}
                {isAnalyzing ? 'THINKING...' : 'ASK DEX AI'}
            </button>
        </div>
        
        <div className="text-gray-500 font-gba-body text-sm text-center">
            Tip: Click the dots to switch pages (Info / Skills / Moves). <br/>
            On Moves page, click a move to see its Power/Accuracy.
        </div>

      </div>
    </div>
  );
}