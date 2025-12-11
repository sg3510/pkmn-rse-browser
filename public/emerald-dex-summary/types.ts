export interface Move {
  name: string;
  type: string;
  pp: number;
  maxPp: number;
  power: number | string;
  accuracy: number | string;
  description: string;
}

export interface PokemonData {
  id: number;
  name: string;
  spriteUrl: string;
  types: string[];
  height: number;
  weight: number;
  abilities: {
    name: string;
    description: string;
  }[];
  // Stats Order: HP, Atk, Def, SpA, SpD, Spe
  stats: {
    name: string;
    value: number;
  }[];
  maxHp: number;
  currentHp: number;
  exp: number;
  nextLevelExp: number;
  flavorText: string;
  level: number;
  gender: 'male' | 'female' | 'genderless';
  heldItem: string | null;
  ot: string;
  otId: number;
  nature: string;
  metLocation: string;
  metLevel: number;
  moves: Move[];
}
