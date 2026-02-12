// Auto-generated — do not edit
// Source: public/pokeemerald/src/battle_main.c (gTypeEffectiveness)
// Regenerate: node scripts/generate-type-effectiveness.cjs

/** All type names in index order (skipping TYPE_MYSTERY at index 9). */
export const TYPE_NAMES = [
  'NORMAL',
  'FIGHTING',
  'FLYING',
  'POISON',
  'GROUND',
  'ROCK',
  'BUG',
  'GHOST',
  'STEEL',
  'FIRE',
  'WATER',
  'GRASS',
  'ELECTRIC',
  'PSYCHIC',
  'ICE',
  'DRAGON',
  'DARK',
] as const;

/** Sparse type chart — only non-1.0x entries stored. */
export const TYPE_CHART: Record<string, Record<string, number>> = {
  NORMAL: { ROCK: 0.5, STEEL: 0.5 },
  FIGHTING: { NORMAL: 2, FLYING: 0.5, POISON: 0.5, ROCK: 2, BUG: 0.5, STEEL: 2, PSYCHIC: 0.5, ICE: 2, DARK: 2 },
  FLYING: { FIGHTING: 2, ROCK: 0.5, BUG: 2, STEEL: 0.5, GRASS: 2, ELECTRIC: 0.5 },
  POISON: { POISON: 0.5, GROUND: 0.5, ROCK: 0.5, GHOST: 0.5, STEEL: 0, GRASS: 2 },
  GROUND: { FLYING: 0, POISON: 2, ROCK: 2, BUG: 0.5, STEEL: 2, FIRE: 2, GRASS: 0.5, ELECTRIC: 2 },
  ROCK: { FIGHTING: 0.5, FLYING: 2, GROUND: 0.5, BUG: 2, STEEL: 0.5, FIRE: 2, ICE: 2 },
  BUG: { FIGHTING: 0.5, FLYING: 0.5, POISON: 0.5, GHOST: 0.5, STEEL: 0.5, FIRE: 0.5, GRASS: 2, PSYCHIC: 2, DARK: 2 },
  GHOST: { NORMAL: 0, GHOST: 2, STEEL: 0.5, PSYCHIC: 2, DARK: 0.5 },
  STEEL: { ROCK: 2, STEEL: 0.5, FIRE: 0.5, WATER: 0.5, ELECTRIC: 0.5, ICE: 2 },
  FIRE: { ROCK: 0.5, BUG: 2, STEEL: 2, FIRE: 0.5, WATER: 0.5, GRASS: 2, ICE: 2, DRAGON: 0.5 },
  WATER: { GROUND: 2, ROCK: 2, FIRE: 2, WATER: 0.5, GRASS: 0.5, DRAGON: 0.5 },
  GRASS: { FLYING: 0.5, POISON: 0.5, GROUND: 2, ROCK: 2, BUG: 0.5, STEEL: 0.5, FIRE: 0.5, WATER: 2, GRASS: 0.5, DRAGON: 0.5 },
  ELECTRIC: { FLYING: 2, GROUND: 0, WATER: 2, GRASS: 0.5, ELECTRIC: 0.5, DRAGON: 0.5 },
  PSYCHIC: { FIGHTING: 2, POISON: 2, STEEL: 0.5, PSYCHIC: 0.5, DARK: 0 },
  ICE: { FLYING: 2, GROUND: 2, STEEL: 0.5, FIRE: 0.5, WATER: 0.5, GRASS: 2, ICE: 0.5, DRAGON: 2 },
  DRAGON: { STEEL: 0.5, DRAGON: 2 },
  DARK: { FIGHTING: 0.5, GHOST: 2, STEEL: 0.5, PSYCHIC: 2, DARK: 0.5 },
};

/**
 * Foresight/Odor Sleuth overrides.
 * When active, these entries replace normal chart values (Ghost immunities → neutral).
 */
export const FORESIGHT_OVERRIDES: Array<{ attack: string; defense: string; multiplier: number }> = [
  { attack: 'NORMAL', defense: 'GHOST', multiplier: 0 },
  { attack: 'FIGHTING', defense: 'GHOST', multiplier: 0 },
];

/** Get effectiveness multiplier for a move type vs one or two defender types. */
export function getTypeEffectiveness(
  moveType: string,
  defenderType1: string,
  defenderType2?: string,
): number {
  const row = TYPE_CHART[moveType];
  let mult = 1;
  if (row) {
    if (row[defenderType1] !== undefined) mult *= row[defenderType1];
    if (defenderType2 && defenderType2 !== defenderType1 && row[defenderType2] !== undefined)
      mult *= row[defenderType2];
  }
  return mult;
}
