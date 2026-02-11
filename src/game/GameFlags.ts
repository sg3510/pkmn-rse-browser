/**
 * Game flags persistence system
 * Tracks collected items, story progress, etc.
 * Backed by the centralized SaveStateStore.
 */

import { saveStateStore } from '../save/SaveStateStore.ts';

class GameFlagsManager {
  /**
   * Check if a flag is set
   */
  isSet(flag: string): boolean {
    return saveStateStore.isFlagSet(flag);
  }

  /**
   * Set a flag
   */
  set(flag: string): void {
    saveStateStore.setFlag(flag);
  }

  /**
   * Clear a flag
   */
  clear(flag: string): void {
    saveStateStore.clearFlag(flag);
  }

  /**
   * Reset all flags (new game)
   */
  reset(): void {
    saveStateStore.replaceFlags([]);
  }

  /**
   * Load flags from an array (used by SaveManager)
   * This replaces all current flags with the provided array
   */
  loadFromArray(flagArray: string[]): void {
    saveStateStore.replaceFlags(flagArray);
  }

  /**
   * Get all set flags (for saving/debugging)
   */
  getAllFlags(): string[] {
    return saveStateStore.getAllFlags();
  }

  /**
   * Get count of set flags
   */
  getCount(): number {
    return saveStateStore.getFlagCount();
  }
}

// Singleton instance
export const gameFlags = new GameFlagsManager();

// Export type for use elsewhere
export type { GameFlagsManager };
