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
  type GameOptions,
  type BerryState,
  type PokedexState,
  SAVE_VERSION,
  SAVE_STORAGE_KEY,
  DEFAULT_PROFILE,
  DEFAULT_PLAY_TIME,
  DEFAULT_OPTIONS,
} from './types';
import { gameFlags } from '../game/GameFlags';
import { gameVariables } from '../game/GameVariables';
import { bagManager } from '../game/BagManager';
import { ITEMS } from '../data/items';
import { parseGen3Save, isValidGen3Save } from './native';
import type { PartyPokemon } from '../pokemon/types';
import { createEmptyParty } from '../pokemon/types';
import { saveStateStore } from './SaveStateStore';
import type { ObjectEventRuntimeState } from '../types/objectEvents';
import { berryManager, isValidBerryEpochTimestamp } from '../game/berry/BerryManager.ts';

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

function normalizeLocationTraversal(
  location: LocationState & { isUnderwater?: boolean; bikeMode?: 'none' | 'mach' | 'acro'; isRidingBike?: boolean }
): void {
  if (typeof location.isUnderwater !== 'boolean') {
    location.isUnderwater = false;
  }
  if (location.bikeMode !== 'mach' && location.bikeMode !== 'acro') {
    location.bikeMode = 'none';
  }
  if (typeof location.isRidingBike !== 'boolean') {
    location.isRidingBike = false;
  }
  // Backward compatibility: old saves could persist underwater + surfing at once.
  if (location.isUnderwater) {
    location.isSurfing = false;
    location.isRidingBike = false;
  }
  if (location.isSurfing) {
    location.isRidingBike = false;
  }
  if (location.isRidingBike && location.bikeMode === 'none') {
    location.isRidingBike = false;
  }
}

function reconcileBikeOwnershipState(
  location: LocationState & { bikeMode?: 'none' | 'mach' | 'acro'; isRidingBike?: boolean }
): void {
  const hasMachBikeInBag = bagManager.hasItem(ITEMS.ITEM_MACH_BIKE, 1);
  const hasAcroBikeInBag = bagManager.hasItem(ITEMS.ITEM_ACRO_BIKE, 1);
  const pcItems = saveStateStore.getPCItems();
  const hasMachBikeInPC = pcItems.some((slot) => slot.itemId === ITEMS.ITEM_MACH_BIKE && slot.quantity > 0);
  const hasAcroBikeInPC = pcItems.some((slot) => slot.itemId === ITEMS.ITEM_ACRO_BIKE && slot.quantity > 0);
  const hasAnyBike = hasMachBikeInBag || hasAcroBikeInBag || hasMachBikeInPC || hasAcroBikeInPC;

  if (!hasAnyBike && gameFlags.isSet('FLAG_RECEIVED_BIKE')) {
    gameFlags.clear('FLAG_RECEIVED_BIKE');
    console.warn('[SaveManager] Cleared FLAG_RECEIVED_BIKE (no Mach/Acro bike in bag or PC)');
  }

  const registeredItem = saveStateStore.getRegisteredItem();
  const registeredBikeMissing =
    (registeredItem === ITEMS.ITEM_MACH_BIKE && !hasMachBikeInBag)
    || (registeredItem === ITEMS.ITEM_ACRO_BIKE && !hasAcroBikeInBag);
  if (registeredBikeMissing) {
    saveStateStore.setRegisteredItem(ITEMS.ITEM_NONE);
    console.warn('[SaveManager] Cleared registered bike item (bike no longer in bag)');
  }

  if (!hasAnyBike && location.isRidingBike) {
    location.isRidingBike = false;
    location.bikeMode = 'none';
  }
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
  private pendingObjectEventRuntimeState: ObjectEventRuntimeState | null = null;

  constructor() {
    berryManager.reset();
    // Try to auto-load most recent save on construction
    this.autoLoad();
  }

  private normalizeBerryStateTimestamp(
    berry: BerryState | undefined,
    nowTimestamp: number,
    options?: { logPrefix?: string }
  ): boolean {
    if (!berry) return false;

    const prefix = options?.logPrefix ?? '[SaveManager]';
    const normalizedNow = Math.trunc(nowTimestamp);
    const rawTimestamp = Number.isFinite(berry.lastUpdateTimestamp)
      ? Math.trunc(berry.lastUpdateTimestamp!)
      : null;

    if (rawTimestamp === null) {
      berry.lastUpdateTimestampDomain = berry.lastUpdateRtc ? 'rtc' : undefined;
      return false;
    }

    if (isValidBerryEpochTimestamp(rawTimestamp)) {
      berry.lastUpdateTimestamp = rawTimestamp;
      if (berry.lastUpdateTimestampDomain !== 'epoch-ms') {
        berry.lastUpdateTimestampDomain = 'epoch-ms';
        return true;
      }
      return false;
    }

    berry.lastUpdateTimestamp = normalizedNow;
    berry.lastUpdateTimestampDomain = 'epoch-ms';
    console.warn(`${prefix} Rebased legacy berry timestamp`, {
      previous: rawTimestamp,
      now: normalizedNow,
    });
    return true;
  }

  private migrateSaveData(data: SaveData, nowTimestamp: number): boolean {
    let migrated = false;
    let version = Number.isFinite(data.version) ? Math.trunc(data.version) : 0;

    if (version < 4) {
      if (this.normalizeBerryStateTimestamp(data.berry, nowTimestamp, { logPrefix: '[SaveManager] v4 migration' })) {
        migrated = true;
      }
      if (data.berry && data.berry.lastUpdateTimestampDomain === undefined && data.berry.lastUpdateRtc) {
        data.berry.lastUpdateTimestampDomain = 'rtc';
        migrated = true;
      }
      version = 4;
    } else if (this.normalizeBerryStateTimestamp(data.berry, nowTimestamp)) {
      migrated = true;
    }

    if (migrated || data.version !== version) {
      data.version = version;
      migrated = true;
    }

    return migrated;
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
      this.pendingObjectEventRuntimeState = null;
      return null;
    }

    const key = getSlotKey(slot);
    const stored = localStorage.getItem(key);

    if (!stored) {
      console.log(`[SaveManager] Slot ${slot} is empty`);
      this.pendingObjectEventRuntimeState = null;
      return null;
    }

    try {
      const data = JSON.parse(stored) as SaveData;
      const nowTimestamp = Date.now();

      // Version migration (if needed in future)
      if (data.version < SAVE_VERSION) {
        console.log(`[SaveManager] Migrating save from v${data.version} to v${SAVE_VERSION}`);
      }
      const migrated = this.migrateSaveData(data, nowTimestamp);
      if (migrated) {
        localStorage.setItem(key, JSON.stringify(data));
      }

      const locationWithMigration = data.location as LocationState & { isUnderwater?: boolean };
      normalizeLocationTraversal(locationWithMigration);

      // Prefer raw event state if present so unknown IDs are preserved.
      if (Array.isArray(data.rawFlags) && Array.isArray(data.rawVars)) {
        saveStateStore.replaceRawEventState(data.rawFlags, data.rawVars);
        if (Array.isArray(data.flags) && data.flags.length > 0) {
          // Preserve profile-specific named projections (e.g. romhack flag aliases)
          // without mutating the underlying raw bitfield.
          saveStateStore.mergeNamedFlags(data.flags);
        }
      } else if (Array.isArray(data.rawFlags)) {
        saveStateStore.replaceRawEventState(data.rawFlags, []);
        if (Array.isArray(data.flags) && data.flags.length > 0) {
          saveStateStore.mergeNamedFlags(data.flags);
        }
        gameVariables.loadFromRecord(data.vars ?? {});
      } else if (Array.isArray(data.rawVars)) {
        saveStateStore.replaceRawEventState([], data.rawVars);
        gameFlags.loadFromArray(data.flags);
      } else {
        gameFlags.loadFromArray(data.flags);
        gameVariables.loadFromRecord(data.vars ?? {});
      }

      // Load bag state if present
      if (data.bag) {
        bagManager.loadBagState(data.bag);
      } else {
        bagManager.reset();
      }

      // Load money, coins, registered item
      if (data.money) {
        saveStateStore.setMoney(data.money.money);
        saveStateStore.setCoins(data.money.coins);
      }
      if (data.registeredItem != null) {
        saveStateStore.setRegisteredItem(data.registeredItem);
      }

      // Load PC items
      if (data.pcItems) {
        saveStateStore.setPCItems(data.pcItems.items);
      } else {
        saveStateStore.setPCItems([]);
      }
      reconcileBikeOwnershipState(locationWithMigration);

      // Load options
      if (data.options) {
        saveStateStore.setOptions(data.options);
      }

      // Load stats
      if (data.stats) {
        saveStateStore.setStats(data.stats);
      }

      // Load pokedex
      if (data.pokedex) {
        saveStateStore.setPokedex(data.pokedex);
      }

      // Load object event overrides (copyobjectxytoperm)
      if (data.objectEventOverrides) {
        saveStateStore.setAllObjectEventOverrides(data.objectEventOverrides);
      }

      // Support both current `partyFull` and legacy `_fullParty` payloads.
      const legacy = data as SaveData & { _fullParty?: (PartyPokemon | null)[] };
      const fullParty = data.partyFull ?? legacy._fullParty ?? [];
      saveStateStore.setParty(fullParty);
      if (fullParty.length > 0) {
        console.log(`[SaveManager] Loaded ${saveStateStore.getPartyCount()} Pokemon from party`);
      }

      if (data.berry) {
        berryManager.loadState(data.berry);
      } else {
        berryManager.reset();
      }
      berryManager.applyElapsedSinceLastUpdate(nowTimestamp);

      this.activeSlot = slot;
      this.profile = data.profile;
      this.playTime = data.playTime;
      this.currentMapId = locationWithMigration.location.mapId;
      this.pendingObjectEventRuntimeState = data.objectEventRuntimeState ?? null;

      console.log(`[SaveManager] Loaded save from slot ${slot}`);
      return data;
    } catch (err) {
      console.error(`[SaveManager] Failed to load slot ${slot}:`, err);
      this.pendingObjectEventRuntimeState = null;
      return null;
    }
  }

  /**
   * Save current game state to a slot
   */
  save(slot: number, locationState: LocationState, objectEventRuntimeState?: ObjectEventRuntimeState): SaveResult {
    if (slot < 0 || slot >= NUM_SAVE_SLOTS) {
      return { success: false, error: `Invalid slot: ${slot}` };
    }

    // Update play time before saving
    this.updatePlayTime();
    const partyFull = saveStateStore.getParty();
    const berryState = berryManager.getStateForSave();
    berryState.lastUpdateTimestamp = Date.now();
    berryState.lastUpdateTimestampDomain = 'epoch-ms';

    const saveData: SaveData = {
      version: SAVE_VERSION,
      timestamp: Date.now(),
      profile: this.profile,
      playTime: this.playTime,
      location: locationState,
      flags: gameFlags.getAllFlags(),
      rawFlags: saveStateStore.getRawFlags(),
      vars: gameVariables.getAllVars(),
      rawVars: saveStateStore.getRawVars(),
      bag: bagManager.getBagState(),
      money: { money: saveStateStore.getMoney(), coins: saveStateStore.getCoins() },
      registeredItem: saveStateStore.getRegisteredItem(),
      pcItems: { items: saveStateStore.getPCItems() },
      options: saveStateStore.getOptions(),
      stats: saveStateStore.getStats(),
      pokedex: saveStateStore.getPokedex(),
      partyFull,
      objectEventOverrides: saveStateStore.getAllObjectEventOverrides(),
      objectEventRuntimeState,
      berry: berryState,
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
        this.pendingObjectEventRuntimeState = null;
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
    this.pendingObjectEventRuntimeState = null;

    // Reset game flags
    gameFlags.reset();
    gameVariables.reset();

    // Reset bag
    bagManager.reset();

    // Reset money, coins, registered item, PC items, options, stats, pokedex
    saveStateStore.setMoney(3000);
    saveStateStore.setCoins(0);
    saveStateStore.setRegisteredItem(0);
    saveStateStore.setPCItems([]);
    saveStateStore.setOptions({ ...DEFAULT_OPTIONS });
    saveStateStore.setStats({ pokemonCaught: 0, trainersDefeated: 0, stepCount: 0, pokemonBattles: 0, wildBattles: 0 });
    saveStateStore.setPokedex({ seen: [], caught: [], nationalDex: false });

    // Reset party
    saveStateStore.setParty(createEmptyParty().pokemon);
    berryManager.reset(Date.now());

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

  getOptions(): GameOptions {
    return saveStateStore.getOptions();
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

  stagePendingObjectEventRuntimeState(state: ObjectEventRuntimeState | null): void {
    this.pendingObjectEventRuntimeState = state;
  }

  consumePendingObjectEventRuntimeState(): ObjectEventRuntimeState | null {
    const state = this.pendingObjectEventRuntimeState;
    this.pendingObjectEventRuntimeState = null;
    return state;
  }

  /**
   * Check if there are any saves
   */
  hasAnySave(): boolean {
    return this.getSaveSlots().some((s) => s.exists);
  }

  // === Party Management ===

  /**
   * Get current party Pokemon
   */
  getParty(): (PartyPokemon | null)[] {
    return saveStateStore.getParty();
  }

  /**
   * Set party Pokemon
   */
  setParty(party: (PartyPokemon | null)[]): void {
    saveStateStore.setParty(party);
  }

  /**
   * Get party count (non-null Pokemon)
   */
  getPartyCount(): number {
    return saveStateStore.getPartyCount();
  }

  /**
   * Check if party has any Pokemon
   */
  hasParty(): boolean {
    return saveStateStore.hasParty();
  }

  // === Pokedex Management ===

  getPokedex(): PokedexState {
    return saveStateStore.getPokedex();
  }

  setPokedex(pokedex: PokedexState): void {
    saveStateStore.setPokedex(pokedex);
  }

  hasCaughtSpecies(species: number): boolean {
    if (!Number.isFinite(species) || species <= 0) return false;
    const normalized = Math.trunc(species);
    return saveStateStore.getPokedex().caught.includes(normalized);
  }

  registerSpeciesSeen(species: number): void {
    if (!Number.isFinite(species) || species <= 0) return;
    const normalized = Math.trunc(species);
    const pokedex = saveStateStore.getPokedex();
    if (pokedex.seen.includes(normalized)) return;
    pokedex.seen.push(normalized);
    saveStateStore.setPokedex(pokedex);
  }

  registerSpeciesCaught(species: number): void {
    if (!Number.isFinite(species) || species <= 0) return;
    const normalized = Math.trunc(species);
    const pokedex = saveStateStore.getPokedex();
    if (!pokedex.seen.includes(normalized)) {
      pokedex.seen.push(normalized);
    }
    if (!pokedex.caught.includes(normalized)) {
      pokedex.caught.push(normalized);
    }
    saveStateStore.setPokedex(pokedex);
  }

  // === Quick Save/Load (for development) ===

  /**
   * Quick save to slot 0 with current location
   */
  quickSave(
    tileX: number,
    tileY: number,
    direction: 'up' | 'down' | 'left' | 'right',
    mapId: string,
    isSurfing: boolean = false,
    isUnderwater: boolean = false
  ): SaveResult {
    const locationState: LocationState = {
      pos: { x: tileX, y: tileY },
      location: { mapId, warpId: 0, x: tileX, y: tileY },
      continueGameWarp: { mapId, warpId: 0, x: tileX, y: tileY },
      lastHealLocation: { mapId: 'MAP_LITTLEROOT_TOWN', warpId: 0, x: 5, y: 3 },
      escapeWarp: { mapId: 'MAP_LITTLEROOT_TOWN', warpId: 0, x: 5, y: 3 },
      direction,
      elevation: 3, // Default elevation
      isSurfing: isSurfing && !isUnderwater,
      isUnderwater,
      bikeMode: 'none',
      isRidingBike: false,
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
      if (!Array.isArray(data.flags) && !Array.isArray(data.rawFlags)) {
        return { success: false, error: 'Invalid save file: missing flags/rawFlags' };
      }

      // Normalize optional projections for backward/forward compatibility.
      if (!Array.isArray(data.flags)) {
        data.flags = [];
      }

      const nowTimestamp = Date.now();

      // Version migration if needed
      if (data.version < SAVE_VERSION) {
        console.log(`[SaveManager] Migrating imported save from v${data.version} to v${SAVE_VERSION}`);
      }
      this.migrateSaveData(data, nowTimestamp);

      const importedLocation = data.location as LocationState & { isUnderwater?: boolean };
      normalizeLocationTraversal(importedLocation);

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
   * Automatically detects .sav vs .json format
   */
  async importFromFile(file: File, slot: number = 0): Promise<SaveResult> {
    try {
      // Check file extension and content to determine format
      const fileName = file.name.toLowerCase();
      const isSavFile = fileName.endsWith('.sav');

      if (isSavFile) {
        // Native .sav file
        const buffer = await file.arrayBuffer();
        return this.importFromNativeSave(buffer, slot, file.name);
      } else {
        // JSON file
        const text = await file.text();
        return this.importFromJson(text, slot);
      }
    } catch (err) {
      console.error(`[SaveManager] Failed to read file:`, err);
      return { success: false, error: `Failed to read file: ${err}` };
    }
  }

  /**
   * Import save data from a native .sav file (GBA format)
   */
  importFromNativeSave(buffer: ArrayBuffer, slot: number = 0, filename?: string): SaveResult {
    if (slot < 0 || slot >= NUM_SAVE_SLOTS) {
      return { success: false, error: `Invalid slot: ${slot}` };
    }

    // Parse the native save
    const result = parseGen3Save(buffer, filename);

    if (!result.success || !result.saveData) {
      return { success: false, error: result.error ?? 'Failed to parse .sav file' };
    }

    if (result.nativeMetadata && !result.nativeMetadata.layoutSupported) {
      const issues = result.nativeMetadata.sanity.issues.join(' ');
      const candidateSummary = result.nativeMetadata.layoutCandidates
        .map((candidate) => `${candidate.profileId}:${candidate.score}`)
        .join(', ');
      return {
        success: false,
        error: `Unsupported or low-confidence save layout (${result.nativeMetadata.layoutProfileId}, confidence=${result.nativeMetadata.layoutConfidence}). Import aborted to avoid incorrect state. Candidates: ${candidateSummary}. ${issues}`,
      };
    }

    // Stage full party data if available.
    const fullParty = result.saveData.partyFull ?? [];
    if (fullParty.length > 0) {
      saveStateStore.setParty(fullParty);
      console.log(`[SaveManager] Loaded ${saveStateStore.getPartyCount()} Pokemon from .sav file`);
    }

    // Log what we parsed for debugging
    console.log(`[SaveManager] Parsed native save:`, {
      name: result.saveData.profile.name,
      gender: result.saveData.profile.gender === 0 ? 'male' : 'female',
      trainerId: result.saveData.profile.trainerId,
      playTime: `${result.saveData.playTime.hours}:${result.saveData.playTime.minutes}:${result.saveData.playTime.seconds}`,
      mapId: result.saveData.location.location.mapId,
      money: result.saveData.money?.money,
      game: result.nativeMetadata?.game,
      layoutProfileId: result.nativeMetadata?.layoutProfileId,
      layoutConfidence: result.nativeMetadata?.layoutConfidence,
      layoutSupported: result.nativeMetadata?.layoutSupported,
      sourceFormat: result.nativeMetadata?.sourceFormat,
      partyCount: fullParty.filter((p) => p !== null).length,
      sanity: result.nativeMetadata?.sanity,
    });

    // Update version and timestamp
    const nowTimestamp = Date.now();
    this.migrateSaveData(result.saveData, nowTimestamp);
    result.saveData.version = SAVE_VERSION;
    result.saveData.timestamp = nowTimestamp;

    // Save to localStorage
    try {
      const key = getSlotKey(slot);
      localStorage.setItem(key, JSON.stringify(result.saveData));

      // Load the imported save
      this.load(slot);

      console.log(`[SaveManager] Imported native save to slot ${slot}`);
      return { success: true };
    } catch (err) {
      console.error(`[SaveManager] Failed to save imported data:`, err);
      return { success: false, error: String(err) };
    }
  }

  /**
   * Check if a buffer contains a valid Gen3 save
   */
  isValidNativeSave(buffer: ArrayBuffer): boolean {
    return isValidGen3Save(buffer);
  }
}

// Export singleton instance
export const saveManager = new SaveManagerClass();

// Export class for testing
export { SaveManagerClass };
