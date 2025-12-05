/**
 * Pokemon Natures
 *
 * 25 natures that affect stat growth.
 * Nature is determined by: personality % 25
 *
 * Each nature has:
 * - A boosted stat (+10%)
 * - A reduced stat (-10%)
 * - Or neutral (5 natures have no effect)
 */

// Nature ID constants
export const NATURES = {
  HARDY: 0,
  LONELY: 1,
  BRAVE: 2,
  ADAMANT: 3,
  NAUGHTY: 4,
  BOLD: 5,
  DOCILE: 6,
  RELAXED: 7,
  IMPISH: 8,
  LAX: 9,
  TIMID: 10,
  HASTY: 11,
  SERIOUS: 12,
  JOLLY: 13,
  NAIVE: 14,
  MODEST: 15,
  MILD: 16,
  QUIET: 17,
  BASHFUL: 18,
  RASH: 19,
  CALM: 20,
  GENTLE: 21,
  SASSY: 22,
  CAREFUL: 23,
  QUIRKY: 24,
} as const;

export type NatureId = typeof NATURES[keyof typeof NATURES];

// Nature display names
export const NATURE_NAMES: string[] = [
  'Hardy',
  'Lonely',
  'Brave',
  'Adamant',
  'Naughty',
  'Bold',
  'Docile',
  'Relaxed',
  'Impish',
  'Lax',
  'Timid',
  'Hasty',
  'Serious',
  'Jolly',
  'Naive',
  'Modest',
  'Mild',
  'Quiet',
  'Bashful',
  'Rash',
  'Calm',
  'Gentle',
  'Sassy',
  'Careful',
  'Quirky',
];

/**
 * Nature stat modifiers
 * Index: [Attack, Defense, Speed, SpAttack, SpDefense]
 * Values: 1 = +10%, -1 = -10%, 0 = neutral
 */
export const NATURE_STAT_MODIFIERS: readonly [number, number, number, number, number][] = [
  [0, 0, 0, 0, 0],    // Hardy (neutral)
  [1, -1, 0, 0, 0],   // Lonely (+Atk, -Def)
  [1, 0, -1, 0, 0],   // Brave (+Atk, -Spd)
  [1, 0, 0, -1, 0],   // Adamant (+Atk, -SpA)
  [1, 0, 0, 0, -1],   // Naughty (+Atk, -SpD)
  [-1, 1, 0, 0, 0],   // Bold (-Atk, +Def)
  [0, 0, 0, 0, 0],    // Docile (neutral)
  [0, 1, -1, 0, 0],   // Relaxed (+Def, -Spd)
  [0, 1, 0, -1, 0],   // Impish (+Def, -SpA)
  [0, 1, 0, 0, -1],   // Lax (+Def, -SpD)
  [-1, 0, 1, 0, 0],   // Timid (-Atk, +Spd)
  [0, -1, 1, 0, 0],   // Hasty (+Spd, -Def)
  [0, 0, 0, 0, 0],    // Serious (neutral)
  [0, 0, 1, -1, 0],   // Jolly (+Spd, -SpA)
  [0, 0, 1, 0, -1],   // Naive (+Spd, -SpD)
  [-1, 0, 0, 1, 0],   // Modest (-Atk, +SpA)
  [0, -1, 0, 1, 0],   // Mild (+SpA, -Def)
  [0, 0, -1, 1, 0],   // Quiet (+SpA, -Spd)
  [0, 0, 0, 0, 0],    // Bashful (neutral)
  [0, 0, 0, 1, -1],   // Rash (+SpA, -SpD)
  [-1, 0, 0, 0, 1],   // Calm (-Atk, +SpD)
  [0, -1, 0, 0, 1],   // Gentle (+SpD, -Def)
  [0, 0, -1, 0, 1],   // Sassy (+SpD, -Spd)
  [0, 0, 0, -1, 1],   // Careful (+SpD, -SpA)
  [0, 0, 0, 0, 0],    // Quirky (neutral)
];

// Stat indices for the modifier array
export const STAT_INDEX = {
  ATTACK: 0,
  DEFENSE: 1,
  SPEED: 2,
  SP_ATTACK: 3,
  SP_DEFENSE: 4,
} as const;

/**
 * Get nature name from ID
 */
export function getNatureName(natureId: number): string {
  return NATURE_NAMES[natureId] ?? 'Unknown';
}

/**
 * Get nature from personality value
 */
export function getNatureFromPersonality(personality: number): number {
  return personality % 25;
}

/**
 * Get stat modifier for a nature and stat
 * @param natureId Nature ID (0-24)
 * @param statIndex Stat index (0=Atk, 1=Def, 2=Spd, 3=SpA, 4=SpD)
 * @returns Multiplier: 0.9, 1.0, or 1.1
 */
export function getNatureStatModifier(natureId: number, statIndex: number): number {
  const modifiers = NATURE_STAT_MODIFIERS[natureId];
  if (!modifiers) return 1.0;

  const mod = modifiers[statIndex];
  if (mod === 1) return 1.1;
  if (mod === -1) return 0.9;
  return 1.0;
}

/**
 * Get which stats are boosted/reduced by a nature
 * @returns { increased: string | null, decreased: string | null }
 */
export function getNatureStatEffects(natureId: number): {
  increased: string | null;
  decreased: string | null;
} {
  const modifiers = NATURE_STAT_MODIFIERS[natureId];
  if (!modifiers) return { increased: null, decreased: null };

  const statNames = ['Attack', 'Defense', 'Speed', 'Sp. Atk', 'Sp. Def'];
  let increased: string | null = null;
  let decreased: string | null = null;

  for (let i = 0; i < 5; i++) {
    if (modifiers[i] === 1) increased = statNames[i];
    if (modifiers[i] === -1) decreased = statNames[i];
  }

  return { increased, decreased };
}
