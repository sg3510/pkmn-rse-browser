/**
 * Battle engine types — pure data, no rendering/UI dependencies.
 *
 * C ref: public/pokeemerald/include/battle.h (BattlePokemon, BattleStruct)
 * C ref: public/pokeemerald/include/constants/battle.h (STATUS1/2, BATTLE_TYPE)
 */

import type { PartyPokemon } from '../../pokemon/types.ts';

// ── Stat stages ──

/** All 7 stat stage indices. */
export type StatStageId = 'attack' | 'defense' | 'speed' | 'spAttack' | 'spDefense' | 'accuracy' | 'evasion';

export interface StatStages {
  attack: number;
  defense: number;
  speed: number;
  spAttack: number;
  spDefense: number;
  accuracy: number;
  evasion: number;
}

export function createDefaultStages(): StatStages {
  return { attack: 0, defense: 0, speed: 0, spAttack: 0, spDefense: 0, accuracy: 0, evasion: 0 };
}

// ── Volatile status (reset on switch) ──

export interface VolatileStatus {
  confusion: number;          // turns remaining (0 = not confused)
  flinch: boolean;
  leechSeed: boolean;
  substitute: number;         // substitute HP (0 = no sub)
  trapped: number;            // turns remaining in Wrap/Bind
  trappedBy: 'attacker' | 'defender' | null;
  nightmare: boolean;
  curse: boolean;
  focusEnergy: boolean;
  protect: boolean;           // this turn
  endure: boolean;            // this turn
  protectSuccessCount: number;
  attractedTo: number | null; // battler index
  encore: number;             // turns remaining
  encoredMove: number;        // forced move ID
  disabled: number;           // turns remaining
  disabledMove: number;       // disabled move ID
  perishSong: number;         // turns until faint (0 = not active, 3/2/1 countdown)
  destinyBond: boolean;
  yawn: number;               // 0=none, 2=just yawned, 1=fall asleep next turn
  ingrain: boolean;
  taunt: number;              // turns remaining
  torment: boolean;
  lastMoveUsed: number;       // for Torment/Encore checks
  chargeMove: number;         // two-turn move charging (0 = not charging)
  semiInvulnerableMove: number; // active semi-invulnerable move (Fly/Dig/Dive/Bounce)
  recharging: boolean;        // Hyper Beam recharge turn
  lockOnTurns: number;        // lock-on turns remaining
  lockOnTargetIsPlayer: boolean | null;
  meanLookSourceIsPlayer: boolean | null;
  foresight: boolean;
  minimized: boolean;
  rampageTurns: number;
  rampageMove: number;
  futureSightTurns: number;
  futureSightMoveId: number;
  futureSightDamage: number;
  futureSightAttackerIsPlayer: boolean | null;
  bide: number;               // turns remaining
  bideDamage: number;         // accumulated damage
  rage: boolean;
  rollout: number;            // consecutive uses (0-4)
  furyCutter: number;         // consecutive uses (0-4)
  toxicCounter: number;       // bad poison counter (increments each end turn while toxic)
}

export function createDefaultVolatile(): VolatileStatus {
  return {
    confusion: 0,
    flinch: false,
    leechSeed: false,
    substitute: 0,
    trapped: 0,
    trappedBy: null,
    nightmare: false,
    curse: false,
    focusEnergy: false,
    protect: false,
    endure: false,
    protectSuccessCount: 0,
    attractedTo: null,
    encore: 0,
    encoredMove: 0,
    disabled: 0,
    disabledMove: 0,
    perishSong: 0,
    destinyBond: false,
    yawn: 0,
    ingrain: false,
    taunt: 0,
    torment: false,
    lastMoveUsed: 0,
    chargeMove: 0,
    semiInvulnerableMove: 0,
    recharging: false,
    lockOnTurns: 0,
    lockOnTargetIsPlayer: null,
    meanLookSourceIsPlayer: null,
    foresight: false,
    minimized: false,
    rampageTurns: 0,
    rampageMove: 0,
    futureSightTurns: 0,
    futureSightMoveId: 0,
    futureSightDamage: 0,
    futureSightAttackerIsPlayer: null,
    bide: 0,
    bideDamage: 0,
    rage: false,
    rollout: 0,
    furyCutter: 0,
    toxicCounter: 0,
  };
}

// ── Battle Pokemon (wraps party Pokemon + volatile state) ──

export interface BattlePokemon {
  pokemon: PartyPokemon;
  name: string;
  currentHp: number;
  maxHp: number;
  stages: StatStages;
  volatile: VolatileStatus;
  /** Ability ID */
  ability: number;
  /** Index into the party (0-5) */
  partyIndex: number;
  /** Is this the player's side? */
  isPlayer: boolean;
}

// ── Side state (screens, hazards, etc.) ──

export interface SideState {
  reflect: number;            // turns remaining (0 = inactive)
  lightScreen: number;
  safeguard: number;
  mist: number;
  spikes: number;             // layers (0-3)
  tailwind: number;
  wishTurn: number;           // 0 = no wish, else countdown
  wishAmount: number;
}

export function createDefaultSide(): SideState {
  return {
    reflect: 0,
    lightScreen: 0,
    safeguard: 0,
    mist: 0,
    spikes: 0,
    tailwind: 0,
    wishTurn: 0,
    wishAmount: 0,
  };
}

// ── Weather ──

export type WeatherType = 'none' | 'rain' | 'sun' | 'sandstorm' | 'hail';

export interface WeatherState {
  type: WeatherType;
  turnsRemaining: number;     // 0 = permanent (from ability)
  permanent: boolean;
}

// ── Battle configuration ──

export type BattleType = 'wild' | 'trainer';

export interface BattleConfig {
  type: BattleType;
  /** Terrain for background. */
  terrain?: string;
  /** Trainer ID (for trainer battles). */
  trainerId?: number;
  /** Is this the first battle (route 101)? Restricts actions. */
  firstBattle?: boolean;
  /** Force specific wild Pokemon (species + level). */
  wildSpecies?: number;
  wildLevel?: number;
  /** Is this a double battle? (for future use) */
  doubleBattle?: boolean;
}

// ── Battle actions (player/AI choices) ──

export type BattleActionType = 'fight' | 'switch' | 'item' | 'run';

export interface FightAction {
  type: 'fight';
  moveId: number;
  moveSlot: number;
}

export interface SwitchAction {
  type: 'switch';
  partyIndex: number;
}

export interface ItemAction {
  type: 'item';
  itemId: number;
  targetPartyIndex?: number;  // for healing items
}

export interface RunAction {
  type: 'run';
}

export type BattleAction = FightAction | SwitchAction | ItemAction | RunAction;

export type MoveSelectionBlockReason =
  | 'no_pp'
  | 'disabled'
  | 'taunt'
  | 'torment'
  | 'choice_lock';

export interface BattleActionValidationResult {
  ok: boolean;
  normalizedAction: BattleAction;
  blockedReason?: MoveSelectionBlockReason;
  blockedMoveSlot?: number;
  allMovesUnusable?: boolean;
}

// ── Battle events (emitted by engine, consumed by UI) ──

export type BattleEventType =
  | 'message'
  | 'damage'
  | 'heal'
  | 'faint'
  | 'stat_change'
  | 'status_applied'
  | 'status_cured'
  | 'weather_change'
  | 'weather_damage'
  | 'switch_out'
  | 'switch_in'
  | 'exp_gain'
  | 'level_up'
  | 'learn_move'
  | 'battle_end'
  | 'animation'
  | 'miss'
  | 'critical'
  | 'effectiveness'
  | 'recoil'
  | 'drain'
  | 'flinch'
  | 'confusion_self_hit'
  | 'fully_paralyzed'
  | 'fast_asleep'
  | 'frozen_solid'
  | 'thaw'
  | 'wake_up'
  | 'hurt_by_status'
  | 'capture_attempt'
  | 'capture_shake'
  | 'capture_success'
  | 'capture_fail';

export interface BattleEvent {
  type: BattleEventType;
  /** Which battler this event concerns (0 = player, 1 = enemy). */
  battler?: number;
  /** Display message for 'message' type. */
  message?: string;
  /** Numeric value (damage amount, stat change magnitude, etc.). */
  value?: number;
  /** Additional context. */
  detail?: string;
  /** Move ID for animation events. */
  moveId?: number;
  /** Move info for learn_move events. */
  newMoveId?: number;
  replacedMoveSlot?: number;
}

// ── Battle outcome ──

export type BattleOutcome = 'win' | 'lose' | 'draw' | 'flee' | 'capture';

// ── Turn result ──

export interface TurnResult {
  events: BattleEvent[];
  outcome: BattleOutcome | null;
  consumedTurn: boolean;
}

// ── Physical/Special split (Gen 3 = type-based) ──

const PHYSICAL_TYPES = new Set([
  'NORMAL', 'FIGHTING', 'FLYING', 'POISON', 'GROUND', 'ROCK', 'BUG', 'GHOST', 'STEEL',
]);

export function isPhysicalType(type: string): boolean {
  return PHYSICAL_TYPES.has(type);
}

// ── Stat stage application (GBA-accurate ratios) ──

/**
 * GBA stat stage multipliers: gStatStageRatios[stage+6]
 * C ref: public/pokeemerald/src/battle_util.c
 */
const STAGE_NUMERATORS =   [2, 2, 2, 2, 2, 2, 2, 3, 4, 5, 6, 7, 8];
const STAGE_DENOMINATORS = [8, 7, 6, 5, 4, 3, 2, 2, 2, 2, 2, 2, 2];

/** Apply a stat stage modifier (-6 to +6) to a base stat value. */
export function applyStatStage(stat: number, stage: number): number {
  const idx = Math.max(0, Math.min(12, stage + 6));
  return Math.floor(stat * STAGE_NUMERATORS[idx] / STAGE_DENOMINATORS[idx]);
}

/**
 * Accuracy/evasion stage ratios (different from stat stages in GBA).
 * C ref: public/pokeemerald/src/battle_util.c (gAccuracyStageRatios)
 */
const ACC_NUMERATORS =   [33, 36, 43, 50, 60, 75, 100, 133, 166, 200, 233, 266, 300];
const ACC_DENOMINATORS = [100,100,100,100,100,100,100, 100, 100, 100, 100, 100, 100];

export function getAccuracyMultiplier(accuracyStage: number, evasionStage: number): number {
  const effectiveStage = Math.max(-6, Math.min(6, accuracyStage - evasionStage));
  const idx = effectiveStage + 6;
  return ACC_NUMERATORS[idx] / ACC_DENOMINATORS[idx];
}

/** Clamp a stat stage to [-6, +6]. */
export function clampStage(value: number): number {
  return Math.max(-6, Math.min(6, value));
}
