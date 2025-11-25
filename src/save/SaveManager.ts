/**
 * SaveManager - Orchestrates save/load operations for the game
 *
 * Responsibilities:
 * - Save game state to localStorage
 * - Load game state from localStorage
 * - Reset game to initial state (new game)
 * - Manage multiple save slots
 * - Handle save data migration between versions
 *
 * Usage:
 * ```ts
 * // Save current game
 * saveManager.save(0); // slot 0
 *
 * // Load a save
 * const saveData = saveManager.load(0);
 *
 * // Start new game (reset all state)
 * saveManager.newGame();
 *
 * // Get save slot info for UI
 * const slots = saveManager.getSaveSlots();
 * ```
 */

import {
  type SaveData,
  type SaveSlotInfo,
  type SaveResult,
  type LocationState,
  type PlayTime,
  type PlayerProfile,
  SAVE_VERSION,
  SAVE_STORAGE_KEY,
  DEFAULT_PROFILE,
  DEFAULT_PLAY_TIME,
} from './types';
import { gameFlags } from '../game/GameFlags';

/**
 * Number of save slots available (like Pokemon has 1 main save + backup)
 * We'll use 3 slots for convenience
 */
const NUM_SAVE_SLOTS = 3;

/**
 * Get the localStorage key for a save slot
 */
function getSlotKey(slot: number): string {
  return `${SAVE_STORAGE_KEY}-slot-${slot}`;
}

/**
 * SaveManager singleton class
 */
class SaveManagerClass {
  /** Currently active save slot (-1 if no save loaded) */
  private activeSlot: number = -1;

  /** Current player profile (in-memory) */
  private profile: PlayerProfile = { ...DEFAULT_PROFILE };

  /** Current play time (in-memory, updated by game loop) */
  private playTime: PlayTime = { ...DEFAULT_PLAY_TIME };

  /** Current map ID */
  private currentMapId: string = 'MAP_LITTLEROOT_TOWN';

  /** Play time tracking */
  private playTimeStartMs: number = 0;
  private isPlayTimerRunning: boolean = false;

  constructor() {
    // Try to auto-load most recent save on construction
    this.autoLoad();
  }

  /**
   * Auto-load the most recent save (if any)
   */
  private autoLoad(): void {
    const slots = this.getSaveSlots();
    const mostRecent = slots
      .filter((s) => s.exists)
      .sort((a, b) => (b.preview?.timestamp ?? 0) - (a.preview?.timestamp ?? 0))[0];

    if (mostRecent) {
      this.activeSlot = mostRecent.slot;
      const data = this.load(mostRecent.slot);
      if (data) {
        this.profile = data.profile;
        this.playTime = data.playTime;
        this.currentMapId = data.location.location.mapId;
      }
    }
  }

  /**
   * Get information about all save slots
   */
  getSaveSlots(): SaveSlotInfo[] {
    const slots: SaveSlotInfo[] = [];

    for (let i = 0; i < NUM_SAVE_SLOTS; i++) {
      const key = getSlotKey(i);
      const stored = localStorage.getItem(key);

      if (!stored) {
        slots.push({ slot: i, exists: false });
        continue;
      }

      try {
        const data = JSON.parse(stored) as SaveData;
        slots.push({
          slot: i,
          exists: true,
          preview: {
            playerName: data.profile.name,
            mapId: data.location.location.mapId,
            playTime: data.playTime,
            timestamp: data.timestamp,
            badges: data.stats?.pokemonCaught, // TODO: Add badges when implemented
            pokedexCaught: data.pokedex?.caught.length,
          },
        });
      } catch {
        // Corrupted save data
        slots.push({ slot: i, exists: false });
      }
    }

    return slots;
  }

  /**
   * Check if a save slot has data
   */
  hasSaveData(slot: number): boolean {
    if (slot < 0 || slot >= NUM_SAVE_SLOTS) return false;
    const key = getSlotKey(slot);
    return localStorage.getItem(key) !== null;
  }

  /**
   * Load save data from a slot
   * @returns SaveData if successful, null if slot is empty or corrupted
   */
  load(slot: number): SaveData | null {
    if (slot < 0 || slot >= NUM_SAVE_SLOTS) {
      console.error(`[SaveManager] Invalid slot: ${slot}`);
      return null;
    }

    const key = getSlotKey(slot);
    const stored = localStorage.getItem(key);

    if (!stored) {
      console.log(`[SaveManager] Slot ${slot} is empty`);
      return null;
    }

    try {
      const data = JSON.parse(stored) as SaveData;

      // Version migration (if needed in future)
      if (data.version < SAVE_VERSION) {
        console.log(`[SaveManager] Migrating save from v${data.version} to v${SAVE_VERSION}`);
        // Add migration logic here when needed
      }

      // Load flags into GameFlags system
      gameFlags.loadFromArray(data.flags);

      this.activeSlot = slot;
      this.profile = data.profile;
      this.playTime = data.playTime;
      this.currentMapId = data.location.location.mapId;

      console.log(`[SaveManager] Loaded save from slot ${slot}`);
      return data;
    } catch (err) {
      console.error(`[SaveManager] Failed to load slot ${slot}:`, err);
      return null;
    }
  }

  /**
   * Save current game state to a slot
   */
  save(slot: number, locationState: LocationState): SaveResult {
    if (slot < 0 || slot >= NUM_SAVE_SLOTS) {
      return { success: false, error: `Invalid slot: ${slot}` };
    }

    // Update play time before saving
    this.updatePlayTime();

    const saveData: SaveData = {
      version: SAVE_VERSION,
      timestamp: Date.now(),
      profile: this.profile,
      playTime: this.playTime,
      location: locationState,
      flags: gameFlags.getAllFlags(),
      // Future: Add more state here (party, bag, etc.)
    };

    try {
      const key = getSlotKey(slot);
      localStorage.setItem(key, JSON.stringify(saveData));
      this.activeSlot = slot;
      this.currentMapId = locationState.location.mapId;
      console.log(`[SaveManager] Saved to slot ${slot}`);
      return { success: true };
    } catch (err) {
      console.error(`[SaveManager] Failed to save to slot ${slot}:`, err);
      return { success: false, error: String(err) };
    }
  }

  /**
   * Delete a save slot
   */
  deleteSave(slot: number): SaveResult {
    if (slot < 0 || slot >= NUM_SAVE_SLOTS) {
      return { success: false, error: `Invalid slot: ${slot}` };
    }

    try {
      const key = getSlotKey(slot);
      localStorage.removeItem(key);

      if (this.activeSlot === slot) {
        this.activeSlot = -1;
      }

      console.log(`[SaveManager] Deleted slot ${slot}`);
      return { success: true };
    } catch (err) {
      console.error(`[SaveManager] Failed to delete slot ${slot}:`, err);
      return { success: false, error: String(err) };
    }
  }

  /**
   * Start a new game - reset all state to initial values
   */
  newGame(profile?: Partial<PlayerProfile>): void {
    // Clear all save slots from localStorage
    for (let i = 0; i < NUM_SAVE_SLOTS; i++) {
      const key = getSlotKey(i);
      localStorage.removeItem(key);
    }

    // Reset in-memory state
    this.profile = {
      ...DEFAULT_PROFILE,
      ...profile,
      // Generate random trainer IDs for new game
      trainerId: profile?.trainerId ?? Math.floor(Math.random() * 65536),
      secretId: profile?.secretId ?? Math.floor(Math.random() * 65536),
    };
    this.playTime = { ...DEFAULT_PLAY_TIME };
    this.currentMapId = 'MAP_LITTLEROOT_TOWN';
    this.activeSlot = -1;

    // Reset game flags
    gameFlags.reset();

    // Reset play timer
    this.playTimeStartMs = Date.now();
    this.isPlayTimerRunning = true;

    console.log(`[SaveManager] New game started for ${this.profile.name}`);
  }

  /**
   * Reset current game state (like soft reset)
   * Reloads from the last save if available
   */
  resetToLastSave(): SaveData | null {
    if (this.activeSlot >= 0) {
      return this.load(this.activeSlot);
    }
    return null;
  }

  // === Play Time Management ===

  /**
   * Start the play time timer
   */
  startPlayTimer(): void {
    if (!this.isPlayTimerRunning) {
      this.playTimeStartMs = Date.now();
      this.isPlayTimerRunning = true;
    }
  }

  /**
   * Pause the play time timer
   */
  pausePlayTimer(): void {
    if (this.isPlayTimerRunning) {
      this.updatePlayTime();
      this.isPlayTimerRunning = false;
    }
  }

  /**
   * Update play time from timer
   */
  private updatePlayTime(): void {
    if (!this.isPlayTimerRunning) return;

    const elapsed = Date.now() - this.playTimeStartMs;
    const totalSeconds =
      this.playTime.hours * 3600 +
      this.playTime.minutes * 60 +
      this.playTime.seconds +
      Math.floor(elapsed / 1000);

    this.playTime = {
      hours: Math.floor(totalSeconds / 3600),
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60,
    };

    this.playTimeStartMs = Date.now();
  }

  /**
   * Get current play time
   */
  getPlayTime(): PlayTime {
    this.updatePlayTime();
    return { ...this.playTime };
  }

  // === Getters ===

  /**
   * Get current player profile
   */
  getProfile(): PlayerProfile {
    return { ...this.profile };
  }

  /**
   * Set player profile (for character customization)
   */
  setProfile(profile: Partial<PlayerProfile>): void {
    this.profile = { ...this.profile, ...profile };
  }

  /**
   * Get player name
   */
  getPlayerName(): string {
    return this.profile.name;
  }

  /**
   * Get current map ID
   */
  getCurrentMapId(): string {
    return this.currentMapId;
  }

  /**
   * Set current map ID (called when changing maps)
   */
  setCurrentMapId(mapId: string): void {
    this.currentMapId = mapId;
  }

  /**
   * Get active save slot (-1 if no save loaded)
   */
  getActiveSlot(): number {
    return this.activeSlot;
  }

  /**
   * Check if there are any saves
   */
  hasAnySave(): boolean {
    return this.getSaveSlots().some((s) => s.exists);
  }

  // === Quick Save/Load (for development) ===

  /**
   * Quick save to slot 0 with current location
   */
  quickSave(tileX: number, tileY: number, direction: 'up' | 'down' | 'left' | 'right', mapId: string, isSurfing: boolean = false): SaveResult {
    const locationState: LocationState = {
      pos: { x: tileX, y: tileY },
      location: { mapId, warpId: 0, x: tileX, y: tileY },
      continueGameWarp: { mapId, warpId: 0, x: tileX, y: tileY },
      lastHealLocation: { mapId: 'MAP_LITTLEROOT_TOWN', warpId: 0, x: 5, y: 3 },
      escapeWarp: { mapId: 'MAP_LITTLEROOT_TOWN', warpId: 0, x: 5, y: 3 },
      direction,
      elevation: 3, // Default elevation
      isSurfing,
    };

    return this.save(0, locationState);
  }

  /**
   * Quick load from slot 0
   */
  quickLoad(): SaveData | null {
    return this.load(0);
  }

  // === File Export/Import ===

  /**
   * Export save data from a slot as a JSON string
   * @returns JSON string of save data, or null if slot is empty
   */
  exportToJson(slot: number = 0): string | null {
    if (slot < 0 || slot >= NUM_SAVE_SLOTS) {
      console.error(`[SaveManager] Invalid slot for export: ${slot}`);
      return null;
    }

    const key = getSlotKey(slot);
    const stored = localStorage.getItem(key);

    if (!stored) {
      console.log(`[SaveManager] No save data to export in slot ${slot}`);
      return null;
    }

    return stored;
  }

  /**
   * Export save data as a downloadable file
   */
  exportToFile(slot: number = 0, filename?: string): SaveResult {
    const json = this.exportToJson(slot);
    if (!json) {
      return { success: false, error: 'No save data to export' };
    }

    try {
      // Create blob and download link
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const defaultFilename = `pokemon-rse-save-${timestamp}.json`;

      // Create temporary link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = filename ?? defaultFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up
      URL.revokeObjectURL(url);

      console.log(`[SaveManager] Exported save to file: ${link.download}`);
      return { success: true };
    } catch (err) {
      console.error(`[SaveManager] Failed to export save:`, err);
      return { success: false, error: String(err) };
    }
  }

  /**
   * Import save data from a JSON string
   */
  importFromJson(json: string, slot: number = 0): SaveResult {
    if (slot < 0 || slot >= NUM_SAVE_SLOTS) {
      return { success: false, error: `Invalid slot: ${slot}` };
    }

    try {
      // Parse and validate the JSON
      const data = JSON.parse(json) as SaveData;

      // Basic validation
      if (typeof data.version !== 'number') {
        return { success: false, error: 'Invalid save file: missing version' };
      }
      if (!data.profile || typeof data.profile.name !== 'string') {
        return { success: false, error: 'Invalid save file: missing profile' };
      }
      if (!data.location || typeof data.location.pos?.x !== 'number') {
        return { success: false, error: 'Invalid save file: missing location' };
      }
      if (!Array.isArray(data.flags)) {
        return { success: false, error: 'Invalid save file: missing flags' };
      }

      // Version migration if needed
      if (data.version < SAVE_VERSION) {
        console.log(`[SaveManager] Migrating imported save from v${data.version} to v${SAVE_VERSION}`);
        data.version = SAVE_VERSION;
      }

      // Save to localStorage
      const key = getSlotKey(slot);
      localStorage.setItem(key, JSON.stringify(data));

      // Load the imported save
      this.load(slot);

      console.log(`[SaveManager] Imported save to slot ${slot}`);
      return { success: true };
    } catch (err) {
      console.error(`[SaveManager] Failed to import save:`, err);
      if (err instanceof SyntaxError) {
        return { success: false, error: 'Invalid JSON format' };
      }
      return { success: false, error: String(err) };
    }
  }

  /**
   * Import save data from a File object (from file input)
   */
  async importFromFile(file: File, slot: number = 0): Promise<SaveResult> {
    try {
      const text = await file.text();
      return this.importFromJson(text, slot);
    } catch (err) {
      console.error(`[SaveManager] Failed to read file:`, err);
      return { success: false, error: `Failed to read file: ${err}` };
    }
  }
}

// Export singleton instance
export const saveManager = new SaveManagerClass();

// Export class for testing
export { SaveManagerClass };
