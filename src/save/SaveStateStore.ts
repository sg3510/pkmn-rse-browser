/**
 * SaveStateStore
 *
 * Canonical runtime store for mutable save-backed gameplay state.
 * This centralizes flag/var/bag/party ownership so subsystems do not drift.
 */

import type { BagState, GameVars, GameOptions, GameStats, PokedexState, ItemSlot } from './types';
import { DEFAULT_OPTIONS } from './types';
import type { PartyPokemon } from '../pokemon/types';
import { createEmptyParty } from '../pokemon/types.ts';
import { FLAG_ID_TO_NAME, VAR_ID_TO_NAME } from '../data/flagVarMaps.gen.ts';

const RAW_FLAG_BYTES = 0x12C;
const RAW_VAR_COUNT = 256;
const VAR_BASE_ID = 0x4000;

const FLAG_NAME_TO_ID: Record<string, number> = {};
for (const [id, name] of Object.entries(FLAG_ID_TO_NAME)) {
  FLAG_NAME_TO_ID[name] = Number(id);
}

const VAR_NAME_TO_ID: Record<string, number> = {};
for (const [id, name] of Object.entries(VAR_ID_TO_NAME)) {
  VAR_NAME_TO_ID[name] = Number(id);
}

function createEmptyBagState(): BagState {
  return {
    items: [],
    keyItems: [],
    pokeBalls: [],
    tmHm: [],
    berries: [],
  };
}

function normalizeParty(party: (PartyPokemon | null)[]): (PartyPokemon | null)[] {
  const normalized = party.slice(0, 6);
  while (normalized.length < 6) {
    normalized.push(null);
  }
  return normalized;
}

class SaveStateStore {
  private flags = new Set<string>();
  private vars = new Map<string, number>();
  private rawFlags = new Uint8Array(RAW_FLAG_BYTES);
  private rawVars = new Uint16Array(RAW_VAR_COUNT);
  private bag: BagState = createEmptyBagState();
  private party: (PartyPokemon | null)[] = createEmptyParty().pokemon;
  private money: number = 3000;
  private coins: number = 0;
  private registeredItem: number = 0;
  private pcItems: ItemSlot[] = [];
  private options: GameOptions = { ...DEFAULT_OPTIONS };
  private stats: GameStats = { pokemonCaught: 0, trainersDefeated: 0, stepCount: 0, pokemonBattles: 0, wildBattles: 0 };
  private pokedex: PokedexState = { seen: [], caught: [], nationalDex: false };

  isRawFlagSet(flagId: number): boolean {
    if (flagId < 0) return false;
    const byteIdx = flagId >> 3;
    const bitMask = 1 << (flagId & 7);
    if (byteIdx < 0 || byteIdx >= this.rawFlags.length) return false;
    return (this.rawFlags[byteIdx] & bitMask) !== 0;
  }

  setRawFlagById(flagId: number, isSet: boolean): void {
    if (flagId < 0) return;
    const byteIdx = flagId >> 3;
    const bitMask = 1 << (flagId & 7);
    if (byteIdx < 0 || byteIdx >= this.rawFlags.length) return;
    if (isSet) {
      this.rawFlags[byteIdx] |= bitMask;
    } else {
      this.rawFlags[byteIdx] &= (~bitMask & 0xFF);
    }
  }

  private syncNamedFlagsFromRaw(): void {
    this.flags.clear();

    for (let byteIdx = 0; byteIdx < this.rawFlags.length; byteIdx++) {
      const value = this.rawFlags[byteIdx];
      if (value === 0) continue;

      for (let bit = 0; bit < 8; bit++) {
        if ((value & (1 << bit)) === 0) continue;
        const flagId = byteIdx * 8 + bit;
        const name = FLAG_ID_TO_NAME[flagId];
        if (name) {
          this.flags.add(name);
        }
      }
    }
  }

  private syncNamedVarsFromRaw(): void {
    this.vars.clear();

    for (let i = 0; i < this.rawVars.length; i++) {
      const value = this.rawVars[i];
      if (value === 0) continue;
      const varId = VAR_BASE_ID + i;
      const name = VAR_ID_TO_NAME[varId];
      if (name) {
        this.vars.set(name, value);
      }
    }
  }

  replaceRawEventState(rawFlags: number[] | Uint8Array, rawVars: number[] | Uint16Array): void {
    this.rawFlags.fill(0);
    this.rawVars.fill(0);

    for (let i = 0; i < Math.min(RAW_FLAG_BYTES, rawFlags.length); i++) {
      const value = rawFlags[i];
      if (typeof value === 'number' && Number.isFinite(value)) {
        this.rawFlags[i] = value & 0xFF;
      }
    }

    for (let i = 0; i < Math.min(RAW_VAR_COUNT, rawVars.length); i++) {
      const value = rawVars[i];
      if (typeof value === 'number' && Number.isFinite(value)) {
        this.rawVars[i] = value & 0xFFFF;
      }
    }

    this.syncNamedFlagsFromRaw();
    this.syncNamedVarsFromRaw();
  }

  getRawFlags(): number[] {
    return Array.from(this.rawFlags);
  }

  getRawVars(): number[] {
    return Array.from(this.rawVars);
  }

  // === Flags ===

  isFlagSet(flag: string): boolean {
    if (!flag || flag === '0') return false;
    return this.flags.has(flag);
  }

  setFlag(flag: string): void {
    if (!flag || flag === '0') return;
    this.flags.add(flag);
    const flagId = FLAG_NAME_TO_ID[flag];
    if (typeof flagId === 'number') {
      this.setRawFlagById(flagId, true);
    }
  }

  clearFlag(flag: string): void {
    if (!flag || flag === '0') return;
    this.flags.delete(flag);
    const flagId = FLAG_NAME_TO_ID[flag];
    if (typeof flagId === 'number') {
      this.setRawFlagById(flagId, false);
    }
  }

  replaceFlags(flags: string[]): void {
    this.flags.clear();
    this.rawFlags.fill(0);

    for (const flag of flags) {
      if (flag && flag !== '0') {
        this.flags.add(flag);
        const flagId = FLAG_NAME_TO_ID[flag];
        if (typeof flagId === 'number') {
          this.setRawFlagById(flagId, true);
        }
      }
    }
  }

  mergeNamedFlags(flags: string[]): void {
    for (const flag of flags) {
      if (flag && flag !== '0') {
        this.flags.add(flag);
      }
    }
  }

  getAllFlags(): string[] {
    return [...this.flags];
  }

  getFlagCount(): number {
    return this.flags.size;
  }

  // === Vars ===

  getVar(name: string): number {
    return this.vars.get(name) ?? 0;
  }

  setVar(name: string, value: number): void {
    const normalized = value | 0;
    this.vars.set(name, normalized);

    const varId = VAR_NAME_TO_ID[name];
    if (typeof varId === 'number') {
      const idx = varId - VAR_BASE_ID;
      if (idx >= 0 && idx < RAW_VAR_COUNT) {
        this.rawVars[idx] = normalized & 0xFFFF;
      }
    }
  }

  replaceVars(record: GameVars): void {
    this.vars.clear();
    this.rawVars.fill(0);

    for (const [key, value] of Object.entries(record)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        const normalized = value | 0;
        this.vars.set(key, normalized);
        const varId = VAR_NAME_TO_ID[key];
        if (typeof varId === 'number') {
          const idx = varId - VAR_BASE_ID;
          if (idx >= 0 && idx < RAW_VAR_COUNT) {
            this.rawVars[idx] = normalized & 0xFFFF;
          }
        }
      }
    }
  }

  getAllVars(): GameVars {
    return Object.fromEntries(this.vars.entries());
  }

  clearVars(): void {
    this.vars.clear();
    this.rawVars.fill(0);
  }

  // === Bag ===

  getBagState(): BagState {
    return {
      items: [...this.bag.items],
      keyItems: [...this.bag.keyItems],
      pokeBalls: [...this.bag.pokeBalls],
      tmHm: [...this.bag.tmHm],
      berries: [...this.bag.berries],
    };
  }

  setBagState(state?: BagState): void {
    if (!state) {
      this.bag = createEmptyBagState();
      return;
    }

    this.bag = {
      items: state.items ? [...state.items] : [],
      keyItems: state.keyItems ? [...state.keyItems] : [],
      pokeBalls: state.pokeBalls ? [...state.pokeBalls] : [],
      tmHm: state.tmHm ? [...state.tmHm] : [],
      berries: state.berries ? [...state.berries] : [],
    };
  }

  // === Party ===

  getParty(): (PartyPokemon | null)[] {
    return [...this.party];
  }

  setParty(party: (PartyPokemon | null)[]): void {
    this.party = normalizeParty(party);
  }

  getPartyCount(): number {
    return this.party.filter((p) => p !== null).length;
  }

  hasParty(): boolean {
    return this.party.some((p) => p !== null);
  }

  // === Money / Coins / Registered Item ===

  getMoney(): number { return this.money; }
  setMoney(n: number): void { this.money = Math.max(0, Math.min(999999, n)); }

  getCoins(): number { return this.coins; }
  setCoins(n: number): void { this.coins = Math.max(0, Math.min(9999, n)); }

  getRegisteredItem(): number { return this.registeredItem; }
  setRegisteredItem(itemId: number): void { this.registeredItem = itemId; }

  // === PC Items ===

  getPCItems(): ItemSlot[] { return [...this.pcItems]; }
  setPCItems(items: ItemSlot[]): void { this.pcItems = [...items]; }

  // === Options ===

  getOptions(): GameOptions { return { ...this.options }; }
  setOptions(opts: GameOptions): void { this.options = { ...opts }; }

  // === Stats ===

  getStats(): GameStats { return { ...this.stats }; }
  setStats(s: GameStats): void { this.stats = { ...s }; }

  // === Pokedex ===

  getPokedex(): PokedexState { return { seen: [...this.pokedex.seen], caught: [...this.pokedex.caught], nationalDex: this.pokedex.nationalDex }; }
  setPokedex(p: PokedexState): void { this.pokedex = { seen: [...p.seen], caught: [...p.caught], nationalDex: p.nationalDex }; }

  // === Object Event Template Overrides ===
  // Stores permanent NPC position overrides from copyobjectxytoperm.
  // Key: "mapId:localId", Value: {x, y} in map-local coordinates.

  private objectEventOverrides = new Map<string, { x: number; y: number }>();

  setObjectEventOverride(mapId: string, localId: string, x: number, y: number): void {
    this.objectEventOverrides.set(`${mapId}:${localId}`, { x, y });
  }

  getObjectEventOverride(mapId: string, localId: string): { x: number; y: number } | null {
    return this.objectEventOverrides.get(`${mapId}:${localId}`) ?? null;
  }

  getAllObjectEventOverrides(): Record<string, { x: number; y: number }> {
    return Object.fromEntries(this.objectEventOverrides.entries());
  }

  setAllObjectEventOverrides(overrides: Record<string, { x: number; y: number }>): void {
    this.objectEventOverrides.clear();
    for (const [key, val] of Object.entries(overrides)) {
      if (val && typeof val.x === 'number' && typeof val.y === 'number') {
        this.objectEventOverrides.set(key, { x: val.x, y: val.y });
      }
    }
  }

  getObjectEventOverridesForMap(mapId: string): Array<{ localId: string; x: number; y: number }> {
    const results: Array<{ localId: string; x: number; y: number }> = [];
    const prefix = `${mapId}:`;
    for (const [key, val] of this.objectEventOverrides) {
      if (key.startsWith(prefix)) {
        results.push({ localId: key.slice(prefix.length), x: val.x, y: val.y });
      }
    }
    return results;
  }

  // === Reset ===

  resetRuntimeState(): void {
    this.flags.clear();
    this.vars.clear();
    this.rawFlags.fill(0);
    this.rawVars.fill(0);
    this.bag = createEmptyBagState();
    this.party = createEmptyParty().pokemon;
    this.money = 3000;
    this.coins = 0;
    this.registeredItem = 0;
    this.pcItems = [];
    this.options = { ...DEFAULT_OPTIONS };
    this.stats = { pokemonCaught: 0, trainersDefeated: 0, stepCount: 0, pokemonBattles: 0, wildBattles: 0 };
    this.pokedex = { seen: [], caught: [], nationalDex: false };
    this.objectEventOverrides.clear();
  }
}

export const saveStateStore = new SaveStateStore();
