/**
 * Game flags persistence system
 * Tracks collected items, story progress, etc.
 * Persists to localStorage for save/load functionality
 */

const STORAGE_KEY = 'pokemon-rse-browser-flags';

class GameFlagsManager {
  private flags: Set<string> = new Set();
  private loaded: boolean = false;

  constructor() {
    this.load();
  }

  /**
   * Load flags from localStorage
   */
  private load(): void {
    if (this.loaded) return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.flags = new Set(parsed);
        }
      }
    } catch (e) {
      console.warn('[GameFlags] Failed to load flags from localStorage:', e);
    }

    this.loaded = true;
  }

  /**
   * Save flags to localStorage
   */
  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.flags]));
    } catch (e) {
      console.warn('[GameFlags] Failed to save flags to localStorage:', e);
    }
  }

  /**
   * Check if a flag is set
   */
  isSet(flag: string): boolean {
    // "0" is used in map data to indicate no flag
    if (!flag || flag === '0') return false;
    return this.flags.has(flag);
  }

  /**
   * Set a flag
   */
  set(flag: string): void {
    if (!flag || flag === '0') return;
    this.flags.add(flag);
    this.save();
  }

  /**
   * Clear a flag
   */
  clear(flag: string): void {
    if (!flag || flag === '0') return;
    this.flags.delete(flag);
    this.save();
  }

  /**
   * Reset all flags (new game)
   */
  reset(): void {
    this.flags.clear();
    this.save();
  }

  /**
   * Load flags from an array (used by SaveManager)
   * This replaces all current flags with the provided array
   */
  loadFromArray(flagArray: string[]): void {
    this.flags.clear();
    for (const flag of flagArray) {
      if (flag && flag !== '0') {
        this.flags.add(flag);
      }
    }
    this.save();
  }

  /**
   * Get all set flags (for saving/debugging)
   */
  getAllFlags(): string[] {
    return [...this.flags];
  }

  /**
   * Get count of set flags
   */
  getCount(): number {
    return this.flags.size;
  }
}

// Singleton instance
export const gameFlags = new GameFlagsManager();

// Export type for use elsewhere
export type { GameFlagsManager };
