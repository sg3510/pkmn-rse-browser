/**
 * Save System
 *
 * Provides game state persistence including:
 * - Player position and location
 * - Game flags (items collected, events, story progress)
 * - Player profile (name, gender, trainer IDs)
 * - Play time tracking
 * - Multiple save slots
 *
 * Future expansion planned for:
 * - Pokemon party and PC storage
 * - Item bag and PC items
 * - Pokedex progress
 * - Game statistics
 *
 * Usage:
 * ```ts
 * import { saveManager } from './save';
 *
 * // Save game
 * saveManager.quickSave(player.tileX, player.tileY, player.dir, mapId);
 *
 * // Load game
 * const saveData = saveManager.quickLoad();
 * if (saveData) {
 *   // Apply loaded state
 * }
 *
 * // New game
 * saveManager.newGame({ name: 'RED' });
 *
 * // Reset flags only
 * import { gameFlags } from '../game/GameFlags';
 * gameFlags.reset();
 * ```
 */

// Main save manager
export { saveManager, SaveManagerClass } from './SaveManager';
export { saveStateStore } from './SaveStateStore';

// Types
export type {
  SaveData,
  SaveSlotInfo,
  SaveResult,
  LocationState,
  WarpData,
  PlayerProfile,
  PlayTime,
  GameOptions,
  PokedexState,
  ItemSlot,
  BagState,
  PCItemsState,
  MoneyState,
  GameFlags,
  GameVars,
  GameStats,
  Pokemon,
  PartyState,
  PCPokemonState,
} from './types';

// Constants
export {
  SAVE_VERSION,
  SAVE_STORAGE_KEY,
  DEFAULT_PROFILE,
  DEFAULT_PLAY_TIME,
  DEFAULT_OPTIONS,
} from './types';
