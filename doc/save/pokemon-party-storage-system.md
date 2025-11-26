# Pokemon Party & Storage System - Complete Technical Reference

This document provides an exhaustive analysis of Pokemon Emerald's party and PC storage system, how data is structured in the ROM, and how it can be implemented in React for this browser-based recreation.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Pokemon Data Structure - Deep Dive](#pokemon-data-structure---deep-dive)
3. [Party System](#party-system)
4. [PC Box Storage System](#pc-box-storage-system)
5. [Data Encryption & Checksums](#data-encryption--checksums)
6. [Save Block Architecture](#save-block-architecture)
7. [TypeScript Type Definitions](#typescript-type-definitions)
8. [React Implementation Architecture](#react-implementation-architecture)
9. [Integration with Existing SaveManager](#integration-with-existing-savemanager)
10. [Species & Move Data](#species--move-data)
11. [Implementation Roadmap](#implementation-roadmap)

---

## Executive Summary

### Key Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `PARTY_SIZE` | 6 | Maximum Pokemon in player's party |
| `TOTAL_BOXES_COUNT` | 14 | Number of PC storage boxes |
| `IN_BOX_COUNT` | 30 | Pokemon per box (5 rows × 6 columns) |
| `POKEMON_NAME_LENGTH` | 10 | Max characters for Pokemon nickname |
| `PLAYER_NAME_LENGTH` | 7 | Max characters for trainer name |
| `BOX_NAME_LENGTH` | 8 | Max characters for box name |
| `MAX_MON_MOVES` | 4 | Moves per Pokemon |
| `NUM_SPECIES` | 412 | Total species (including Egg) |

### Total Storage Capacity
- **Party**: 6 Pokemon (active, with full battle stats)
- **PC Storage**: 14 boxes × 30 slots = **420 Pokemon**
- **Grand Total**: 426 Pokemon maximum

---

## Pokemon Data Structure - Deep Dive

Pokemon Emerald uses a two-tier structure: `BoxPokemon` (80 bytes) for storage and `Pokemon` (100 bytes) for the active party with cached battle stats.

### Reference: `public/pokeemerald/include/pokemon.h`

### BoxPokemon Structure (80 bytes)
This is the compact format used for PC storage. It contains all persistent Pokemon data.

```
Offset  Size  Field              Description
------  ----  -----              -----------
0x00    4     personality        32-bit value determining nature, gender, ability, Unown form, Spinda spots
0x04    4     otId               Original Trainer ID (16-bit public + 16-bit secret)
0x08    10    nickname           Pokemon's nickname (game encoding, not ASCII)
0x12    1     language           Language of origin (for cross-region trading)
0x13    1     flags              Bit flags: isBadEgg:1, hasSpecies:1, isEgg:1, blockBoxRS:1
0x14    7     otName             Original Trainer's name
0x1B    1     markings           Circle, Square, Triangle, Heart marks
0x1C    2     checksum           Validation checksum for substruct data
0x1E    2     unknown            Padding/unused
0x20    48    secure             4 encrypted substructs (12 bytes each)
```

### Encrypted Substructs (48 bytes total)

The `secure` field contains 4 substructs of 12 bytes each. They are **XOR-encrypted** and **shuffled** based on the personality value. This was Nintendo's anti-cheat mechanism.

#### Substruct 0: Core Data
```c
struct PokemonSubstruct0 {
    u16 species;      // National Dex number (1-411)
    u16 heldItem;     // Item ID (0 = none)
    u32 experience;   // Total EXP points
    u8 ppBonuses;     // PP Up usage per move (2 bits each)
    u8 friendship;    // 0-255, affects evolution & Return/Frustration
    u16 filler;       // Unused padding
}; // 12 bytes
```

#### Substruct 1: Moves
```c
struct PokemonSubstruct1 {
    u16 moves[4];     // Move IDs (0 = empty slot)
    u8 pp[4];         // Current PP for each move
}; // 12 bytes
```

#### Substruct 2: EVs & Contest Stats
```c
struct PokemonSubstruct2 {
    u8 hpEV;          // HP Effort Value (0-255)
    u8 attackEV;      // Attack EV
    u8 defenseEV;     // Defense EV
    u8 speedEV;       // Speed EV
    u8 spAttackEV;    // Special Attack EV
    u8 spDefenseEV;   // Special Defense EV
    u8 cool;          // Contest: Cool condition
    u8 beauty;        // Contest: Beauty condition
    u8 cute;          // Contest: Cute condition
    u8 smart;         // Contest: Smart condition
    u8 tough;         // Contest: Tough condition
    u8 sheen;         // Contest: Sheen (pokeblock limit)
}; // 12 bytes
```

#### Substruct 3: IVs, Origin & Ribbons
```c
struct PokemonSubstruct3 {
    u8 pokerus;       // Pokerus strain & days remaining
    u8 metLocation;   // Map ID where caught

    // Bit-packed fields (16 bits):
    u16 metLevel:7;   // Level when caught (0-100)
    u16 metGame:4;    // Game of origin (Ruby, Sapphire, Emerald, etc.)
    u16 pokeball:4;   // Ball used to catch
    u16 otGender:1;   // Original trainer's gender

    // IVs and flags (32 bits):
    u32 hpIV:5;       // HP Individual Value (0-31)
    u32 attackIV:5;   // Attack IV
    u32 defenseIV:5;  // Defense IV
    u32 speedIV:5;    // Speed IV
    u32 spAttackIV:5; // Special Attack IV
    u32 spDefenseIV:5; // Special Defense IV
    u32 isEgg:1;      // Is this an egg?
    u32 abilityNum:1; // Which of 2 possible abilities (0 or 1)

    // Ribbon flags (32 bits):
    u32 coolRibbon:3;     // Contest rank (0-4)
    u32 beautyRibbon:3;
    u32 cuteRibbon:3;
    u32 smartRibbon:3;
    u32 toughRibbon:3;
    u32 championRibbon:1;
    u32 winningRibbon:1;
    u32 victoryRibbon:1;
    u32 artistRibbon:1;
    u32 effortRibbon:1;
    u32 marineRibbon:1;
    u32 landRibbon:1;
    u32 skyRibbon:1;
    u32 countryRibbon:1;
    u32 nationalRibbon:1;
    u32 earthRibbon:1;
    u32 worldRibbon:1;
    u32 unusedRibbons:4;
    u32 modernFatefulEncounter:1; // Mew/Deoxys obedience flag
}; // 12 bytes
```

### Pokemon Structure (100 bytes) - Party Pokemon
Extends BoxPokemon with calculated battle stats:

```c
struct Pokemon {
    struct BoxPokemon box;  // 80 bytes (all data above)

    // Cached/calculated fields (20 bytes):
    u32 status;       // Status conditions (paralysis, burn, sleep, etc.)
    u8 level;         // Calculated from experience
    u8 mail;          // Attached mail ID
    u16 hp;           // Current HP
    u16 maxHP;        // Maximum HP (calculated from base stats + IVs + EVs)
    u16 attack;       // Calculated Attack stat
    u16 defense;      // Calculated Defense stat
    u16 speed;        // Calculated Speed stat
    u16 spAttack;     // Calculated Special Attack stat
    u16 spDefense;    // Calculated Special Defense stat
}; // 100 bytes total
```

### Substruct Shuffling Algorithm

The 4 substructs are stored in a shuffled order based on `personality % 24`:

```
Order  Substruct positions [0,1,2,3]
-----  -----------------------------
0      G A E M (Growth, Attacks, EVs, Misc)
1      G A M E
2      G E A M
3      G E M A
4      G M A E
5      G M E A
6      A G E M
7      A G M E
8      A E G M
9      A E M G
10     A M G E
11     A M E G
12     E G A M
13     E G M A
14     E A G M
15     E A M G
16     E M G A
17     E M A G
18     M G A E
19     M G E A
20     M A G E
21     M A E G
22     M E G A
23     M E A G
```

### XOR Encryption

After shuffling, each 32-bit word in the substructs is XORed with the encryption key:
```c
encryptionKey = otId ^ personality
```

---

## Party System

### Reference: `public/pokeemerald/include/global.h:984-1001`

The player's party is stored in SaveBlock1:

```c
struct SaveBlock1 {
    // ... other fields ...
    /*0x234*/ u8 playerPartyCount;     // Number of Pokemon (0-6)
    /*0x235*/ u8 padding2[3];
    /*0x238*/ struct Pokemon playerParty[PARTY_SIZE]; // 6 Pokemon × 100 bytes = 600 bytes
    // ... other fields ...
};
```

### Party Characteristics

1. **Ordered Array**: Position matters - first Pokemon is sent into battle first
2. **Full Stats Cached**: Party Pokemon have calculated stats for battle
3. **Real-time Updates**: Stats recalculated when:
   - Level up
   - EV changes (after battle/vitamin)
   - Evolution
   - Stat-modifying items (Rare Candy, etc.)

### Party Operations

| Operation | Description |
|-----------|-------------|
| Add Pokemon | `GiveMonToPlayer()` - adds to first empty slot or sends to PC |
| Remove Pokemon | Not directly supported (trade/release only) |
| Swap Positions | UI operation, array index swap |
| Count Alive | `CalculatePlayerPartyCount()` |
| Compact Slots | `CompactPartySlots()` - removes gaps |

---

## PC Box Storage System

### Reference: `public/pokeemerald/include/pokemon_storage_system.h`

```c
#define TOTAL_BOXES_COUNT       14
#define IN_BOX_ROWS             5
#define IN_BOX_COLUMNS          6
#define IN_BOX_COUNT            (IN_BOX_ROWS * IN_BOX_COLUMNS)  // 30
#define BOX_NAME_LENGTH         8

struct PokemonStorage {
    /*0x0000*/ u8 currentBox;           // Currently selected box (0-13)
    /*0x0001*/ struct BoxPokemon boxes[14][30];  // 14 boxes × 30 slots × 80 bytes
    /*0x8344*/ u8 boxNames[14][9];      // Box names (8 chars + null)
    /*0x83C2*/ u8 boxWallpapers[14];    // Wallpaper ID per box
}; // Total: ~33,744 bytes
```

### Box Layout Visualization

```
            COLUMNS
ROWS        0   1   2   3   4   5
            6   7   8   9   10  11
            12  13  14  15  16  17
            18  19  20  21  22  23
            24  25  26  27  28  29
```

### Storage Operations

| Function | Description |
|----------|-------------|
| `StorageGetCurrentBox()` | Get selected box index |
| `GetBoxMonDataAt(boxId, pos, field)` | Read data from stored Pokemon |
| `SetBoxMonDataAt(boxId, pos, field, value)` | Write data to stored Pokemon |
| `GetFirstFreeBoxSpot(boxId)` | Find first empty slot in a box |
| `CountMonsInBox(boxId)` | Count Pokemon in a specific box |
| `CountAllStorageMons()` | Count all stored Pokemon |
| `CheckFreePokemonStorageSpace()` | Check if any box has space |
| `ZeroBoxMonAt(boxId, pos)` | Clear a slot |
| `SetBoxMonAt(boxId, pos, src)` | Copy Pokemon into slot |

### Save Sector Allocation

Pokemon storage is spread across multiple save sectors due to size:

```
Sector  Contents
------  --------
5       Box 1-2 (partial)
6       Box 2-3 (partial)
7       Box 4-5 (partial)
8       Box 6-7 (partial)
9       Box 8-9 (partial)
10      Box 10-11 (partial)
11      Box 12-13 (partial)
12      Box 13-14 (partial)
13      Box 14 + Box names + Wallpapers
```

Each sector holds 3968 bytes of data + 128 byte footer (checksum, etc.)

---

## Data Encryption & Checksums

### Substruct Encryption

```javascript
// Decryption algorithm (JavaScript equivalent)
function decryptSubstructs(boxMon) {
    const key = boxMon.otId ^ boxMon.personality;
    const order = getSubstructOrder(boxMon.personality % 24);

    const substructs = [];
    for (let i = 0; i < 4; i++) {
        const encrypted = boxMon.secure[i];
        const decrypted = [];
        for (let j = 0; j < 12; j += 4) {
            const word = (encrypted[j] | (encrypted[j+1] << 8) |
                         (encrypted[j+2] << 16) | (encrypted[j+3] << 24));
            const decryptedWord = word ^ key;
            decrypted.push(decryptedWord);
        }
        substructs[order[i]] = decrypted;
    }
    return substructs;
}
```

### Checksum Calculation

```javascript
function calculateChecksum(substructs) {
    let sum = 0;
    for (const substruct of substructs) {
        for (let i = 0; i < 6; i++) {  // 6 u16 values per substruct
            sum = (sum + substruct.raw[i]) & 0xFFFF;
        }
    }
    return sum;
}
```

### Bad Egg Detection

A Pokemon becomes a "Bad Egg" if:
- Checksum doesn't match calculated value
- `hasSpecies` flag is set but species is 0
- Corruption detected during decryption

---

## Save Block Architecture

### SaveBlock1 (Party & Items)

```c
// Reference: global.h lines 984-1079
struct SaveBlock1 {
    /*0x238*/ struct Pokemon playerParty[6];  // Party Pokemon
    /*0x490*/ u32 money;
    /*0x494*/ u16 coins;
    /*0x498*/ struct ItemSlot pcItems[50];    // PC item storage
    /*0x560*/ struct ItemSlot bagPocket_Items[30];
    /*0x5D8*/ struct ItemSlot bagPocket_KeyItems[30];
    /*0x650*/ struct ItemSlot bagPocket_PokeBalls[16];
    /*0x690*/ struct ItemSlot bagPocket_TMHM[64];
    /*0x790*/ struct ItemSlot bagPocket_Berries[46];
    // ...flags, vars, other game state...
}; // 0x3D88 bytes total
```

### SaveBlock2 (Profile & Pokedex)

```c
// Reference: global.h lines 508-543
struct SaveBlock2 {
    /*0x00*/ u8 playerName[8];
    /*0x08*/ u8 playerGender;
    /*0x0A*/ u8 playerTrainerId[4];
    /*0x0E*/ u16 playTimeHours;
    /*0x10*/ u8 playTimeMinutes;
    /*0x11*/ u8 playTimeSeconds;
    /*0x18*/ struct Pokedex pokedex;
    // ... options, frontier data ...
}; // 0xF2C bytes
```

### Existing TypeScript Types

From `src/save/types.ts`:

```typescript
export interface Pokemon {
  species: number;
  nickname: string | null;
  otName: string;
  otId: number;
  level: number;
  experience: number;
  // Future: IVs, EVs, moves, ability, nature, held item, etc.
}

export interface PartyState {
  pokemon: (Pokemon | null)[];
  count: number;
}

export interface PCPokemonState {
  currentBox: number;
  boxes: {
    name: string;
    pokemon: (Pokemon | null)[];
  }[];
}
```

---

## TypeScript Type Definitions

### Complete Pokemon Interface (Proposed)

```typescript
// Full Pokemon data structure for React implementation
export interface PokemonData {
  // Core identity
  personality: number;           // 32-bit personality value
  otId: number;                  // Combined trainer ID
  species: number;               // National Dex number (1-411)

  // Display data
  nickname: string | null;       // Custom name (max 10 chars)
  otName: string;                // Original trainer name (max 7 chars)
  language: number;              // Language of origin

  // Held item & experience
  heldItem: number;              // Item ID (0 = none)
  experience: number;            // Total EXP
  level: number;                 // Calculated from experience

  // Friendship
  friendship: number;            // 0-255

  // Moves
  moves: [number, number, number, number];  // Move IDs
  pp: [number, number, number, number];     // Current PP
  ppBonuses: number;             // PP Up bonuses (2 bits per move)

  // EVs (0-255 each, 510 total max)
  evs: {
    hp: number;
    attack: number;
    defense: number;
    speed: number;
    spAttack: number;
    spDefense: number;
  };

  // IVs (0-31 each)
  ivs: {
    hp: number;
    attack: number;
    defense: number;
    speed: number;
    spAttack: number;
    spDefense: number;
  };

  // Calculated stats (for party Pokemon)
  stats?: {
    hp: number;
    maxHp: number;
    attack: number;
    defense: number;
    speed: number;
    spAttack: number;
    spDefense: number;
  };

  // Status
  status: number;                // Status condition flags
  isEgg: boolean;
  isBadEgg: boolean;

  // Origin info
  metLocation: number;           // Map ID where caught
  metLevel: number;              // Level when caught
  metGame: number;               // Game of origin
  pokeball: number;              // Ball used to catch
  otGender: 'male' | 'female';

  // Ability
  abilityNum: 0 | 1;             // Which ability slot

  // Pokerus
  pokerus: {
    strain: number;              // 0 = never had, 1-15 = strain
    days: number;                // Days remaining (0 = cured)
  };

  // Contest stats
  contest: {
    cool: number;
    beauty: number;
    cute: number;
    smart: number;
    tough: number;
    sheen: number;
  };

  // Ribbons (stored as booleans for easy manipulation)
  ribbons: {
    champion: boolean;
    winning: boolean;
    victory: boolean;
    artist: boolean;
    effort: boolean;
    marine: boolean;
    land: boolean;
    sky: boolean;
    country: boolean;
    national: boolean;
    earth: boolean;
    world: boolean;
    coolRank: number;      // 0-4
    beautyRank: number;    // 0-4
    cuteRank: number;      // 0-4
    smartRank: number;     // 0-4
    toughRank: number;     // 0-4
  };

  // Markings (for PC organization)
  markings: {
    circle: boolean;
    square: boolean;
    triangle: boolean;
    heart: boolean;
  };

  // Mail (for party only)
  mail?: number;

  // Fateful encounter flag (for event Pokemon)
  fatefulEncounter: boolean;
}

// Simplified version for storage (BoxPokemon equivalent)
export type BoxPokemonData = Omit<PokemonData, 'stats' | 'mail'>;

// Party with full stats
export interface PartyPokemon extends PokemonData {
  stats: {
    hp: number;
    maxHp: number;
    attack: number;
    defense: number;
    speed: number;
    spAttack: number;
    spDefense: number;
  };
}
```

### Box Storage Types

```typescript
export interface StorageBox {
  name: string;                  // Box name (max 8 chars)
  wallpaper: number;             // Wallpaper ID
  pokemon: (BoxPokemonData | null)[]; // 30 slots
}

export interface PCStorage {
  currentBox: number;            // Selected box (0-13)
  boxes: StorageBox[];           // 14 boxes
}

// Constants
export const PARTY_SIZE = 6;
export const TOTAL_BOXES = 14;
export const IN_BOX_COUNT = 30;
export const IN_BOX_ROWS = 5;
export const IN_BOX_COLUMNS = 6;
export const BOX_NAME_LENGTH = 8;
export const POKEMON_NAME_LENGTH = 10;
```

---

## React Implementation Architecture

### Recommended Context Pattern

Following the established pattern from `DialogContext.tsx`:

```typescript
// PartyContext.tsx
import React, { createContext, useContext, useReducer, useCallback } from 'react';

interface PartyState {
  pokemon: (PartyPokemon | null)[];
  selectedIndex: number;
}

type PartyAction =
  | { type: 'SET_PARTY'; pokemon: (PartyPokemon | null)[] }
  | { type: 'ADD_POKEMON'; pokemon: PartyPokemon }
  | { type: 'REMOVE_POKEMON'; index: number }
  | { type: 'SWAP_POKEMON'; index1: number; index2: number }
  | { type: 'UPDATE_POKEMON'; index: number; updates: Partial<PartyPokemon> }
  | { type: 'SELECT_POKEMON'; index: number }
  | { type: 'HEAL_ALL' }
  | { type: 'GIVE_ITEM'; index: number; itemId: number }
  | { type: 'TAKE_ITEM'; index: number };

function partyReducer(state: PartyState, action: PartyAction): PartyState {
  switch (action.type) {
    case 'SET_PARTY':
      return { ...state, pokemon: action.pokemon };

    case 'ADD_POKEMON': {
      const emptySlot = state.pokemon.findIndex(p => p === null);
      if (emptySlot === -1) return state; // Party full
      const newParty = [...state.pokemon];
      newParty[emptySlot] = action.pokemon;
      return { ...state, pokemon: newParty };
    }

    case 'REMOVE_POKEMON': {
      const newParty = [...state.pokemon];
      newParty[action.index] = null;
      return { ...state, pokemon: newParty };
    }

    case 'SWAP_POKEMON': {
      const newParty = [...state.pokemon];
      [newParty[action.index1], newParty[action.index2]] =
        [newParty[action.index2], newParty[action.index1]];
      return { ...state, pokemon: newParty };
    }

    case 'UPDATE_POKEMON': {
      const pokemon = state.pokemon[action.index];
      if (!pokemon) return state;
      const newParty = [...state.pokemon];
      newParty[action.index] = { ...pokemon, ...action.updates };
      return { ...state, pokemon: newParty };
    }

    case 'SELECT_POKEMON':
      return { ...state, selectedIndex: action.index };

    case 'HEAL_ALL': {
      const newParty = state.pokemon.map(p => {
        if (!p) return null;
        return {
          ...p,
          stats: { ...p.stats, hp: p.stats.maxHp },
          status: 0,
          pp: calculateMaxPP(p.moves, p.ppBonuses),
        };
      });
      return { ...state, pokemon: newParty };
    }

    default:
      return state;
  }
}

// Context
const PartyContext = createContext<{
  state: PartyState;
  dispatch: React.Dispatch<PartyAction>;
} | null>(null);

// Provider
export const PartyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(partyReducer, {
    pokemon: [null, null, null, null, null, null],
    selectedIndex: 0,
  });

  return (
    <PartyContext.Provider value={{ state, dispatch }}>
      {children}
    </PartyContext.Provider>
  );
};

// Hook
export function useParty() {
  const context = useContext(PartyContext);
  if (!context) throw new Error('useParty must be used within PartyProvider');

  const { state, dispatch } = context;

  return {
    party: state.pokemon,
    selectedIndex: state.selectedIndex,
    partyCount: state.pokemon.filter(p => p !== null).length,

    addPokemon: useCallback((pokemon: PartyPokemon) => {
      dispatch({ type: 'ADD_POKEMON', pokemon });
    }, [dispatch]),

    swapPokemon: useCallback((i1: number, i2: number) => {
      dispatch({ type: 'SWAP_POKEMON', index1: i1, index2: i2 });
    }, [dispatch]),

    selectPokemon: useCallback((index: number) => {
      dispatch({ type: 'SELECT_POKEMON', index });
    }, [dispatch]),

    healAll: useCallback(() => {
      dispatch({ type: 'HEAL_ALL' });
    }, [dispatch]),

    // ... more helpers
  };
}
```

### Storage Context Pattern

```typescript
// StorageContext.tsx
interface StorageState {
  currentBox: number;
  boxes: StorageBox[];
  cursorPosition: number;  // 0-29 within current box
  isMovingPokemon: boolean;
  heldPokemon: BoxPokemonData | null;
}

type StorageAction =
  | { type: 'SET_STORAGE'; storage: PCStorage }
  | { type: 'SELECT_BOX'; boxIndex: number }
  | { type: 'NEXT_BOX' }
  | { type: 'PREV_BOX' }
  | { type: 'MOVE_CURSOR'; position: number }
  | { type: 'PICKUP_POKEMON' }
  | { type: 'PLACE_POKEMON' }
  | { type: 'DEPOSIT_FROM_PARTY'; pokemon: BoxPokemonData }
  | { type: 'WITHDRAW_TO_PARTY'; position: number }
  | { type: 'RELEASE_POKEMON'; boxIndex: number; position: number }
  | { type: 'RENAME_BOX'; boxIndex: number; name: string }
  | { type: 'SET_WALLPAPER'; boxIndex: number; wallpaper: number };
```

---

## Integration with Existing SaveManager

### Current SaveManager Structure

From `src/save/SaveManager.ts`:

```typescript
// Current save method (line 192-221)
save(slot: number, locationState: LocationState): SaveResult {
  const saveData: SaveData = {
    version: SAVE_VERSION,
    timestamp: Date.now(),
    profile: this.profile,
    playTime: this.playTime,
    location: locationState,
    flags: gameFlags.getAllFlags(),
    // Future: Add more state here (party, bag, etc.)  <-- Ready for expansion
  };
  // ...
}
```

### Proposed Integration

```typescript
// Extended SaveManager methods

class SaveManagerClass {
  // ... existing code ...

  private party: PartyState = { pokemon: [], count: 0 };
  private pcStorage: PCStorage = {
    currentBox: 0,
    boxes: Array(14).fill(null).map((_, i) => ({
      name: `BOX ${i + 1}`,
      wallpaper: i % 4,
      pokemon: Array(30).fill(null),
    })),
  };

  setParty(party: PartyState): void {
    this.party = party;
  }

  getParty(): PartyState {
    return { ...this.party };
  }

  setPCStorage(storage: PCStorage): void {
    this.pcStorage = storage;
  }

  getPCStorage(): PCStorage {
    return { ...this.pcStorage };
  }

  // Modified save method
  save(slot: number, locationState: LocationState): SaveResult {
    const saveData: SaveData = {
      version: SAVE_VERSION,
      timestamp: Date.now(),
      profile: this.profile,
      playTime: this.playTime,
      location: locationState,
      flags: gameFlags.getAllFlags(),
      party: this.party,           // NEW
      pcPokemon: this.pcStorage,   // NEW
    };
    // ... rest of save logic
  }

  // Modified load method
  load(slot: number): SaveData | null {
    // ... existing load logic ...

    if (data.party) {
      this.party = data.party;
    }
    if (data.pcPokemon) {
      this.pcStorage = data.pcPokemon;
    }

    return data;
  }
}
```

### MapRenderer Integration

Following the pattern at `src/components/MapRenderer.tsx:760`:

```typescript
useImperativeHandle(ref, () => ({
  saveGame: (): SaveResult => {
    // ... existing location state gathering ...

    // Get party from context (needs to be passed in)
    saveManager.setParty(partyState);
    saveManager.setPCStorage(storageState);

    return saveManager.save(0, locationState);
  },

  loadGame: (): SaveData | null => {
    const saveData = saveManager.load(0);
    if (saveData) {
      // ... existing state restoration ...

      // Update party/storage contexts
      if (saveData.party) {
        setPartyState(saveData.party);
      }
      if (saveData.pcPokemon) {
        setStorageState(saveData.pcPokemon);
      }
    }
    return saveData;
  },

  // New methods
  getParty: () => saveManager.getParty(),
  getPCStorage: () => saveManager.getPCStorage(),
}));
```

---

## Species & Move Data

### Species Constants

From `public/pokeemerald/include/constants/species.h`:

```typescript
export const Species = {
  NONE: 0,
  BULBASAUR: 1,
  IVYSAUR: 2,
  VENUSAUR: 3,
  // ... through ...
  CHIMECHO: 411,
  EGG: 412,
  // Unown forms: 413-439
} as const;

export const NUM_SPECIES = 412;
```

### Type Constants

From `public/pokeemerald/include/constants/pokemon.h`:

```typescript
export const Types = {
  NORMAL: 0,
  FIGHTING: 1,
  FLYING: 2,
  POISON: 3,
  GROUND: 4,
  ROCK: 5,
  BUG: 6,
  GHOST: 7,
  STEEL: 8,
  FIRE: 10,
  WATER: 11,
  GRASS: 12,
  ELECTRIC: 13,
  PSYCHIC: 14,
  ICE: 15,
  DRAGON: 16,
  DARK: 17,
} as const;
```

### Nature Constants

```typescript
export const Natures = {
  HARDY: 0,   LONELY: 1,  BRAVE: 2,   ADAMANT: 3, NAUGHTY: 4,
  BOLD: 5,    DOCILE: 6,  RELAXED: 7, IMPISH: 8,  LAX: 9,
  TIMID: 10,  HASTY: 11,  SERIOUS: 12, JOLLY: 13, NAIVE: 14,
  MODEST: 15, MILD: 16,   QUIET: 17,  BASHFUL: 18, RASH: 19,
  CALM: 20,   GENTLE: 21, SASSY: 22,  CAREFUL: 23, QUIRKY: 24,
} as const;

// Nature stat modifiers (+10% / -10%)
// Row = nature, columns = [Atk, Def, Spd, SpA, SpD]
export const NatureStatTable: [number, number, number, number, number][] = [
  [0, 0, 0, 0, 0],   // Hardy (neutral)
  [1, -1, 0, 0, 0],  // Lonely (+Atk, -Def)
  [1, 0, -1, 0, 0],  // Brave (+Atk, -Spd)
  // ... etc
];
```

### Stat Calculation

```typescript
function calculateStat(
  base: number,
  iv: number,
  ev: number,
  level: number,
  natureModifier: number,  // 0.9, 1.0, or 1.1
  isHP: boolean
): number {
  if (isHP) {
    // HP formula
    return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + level + 10;
  } else {
    // Other stats formula
    const baseStat = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5;
    return Math.floor(baseStat * natureModifier);
  }
}
```

---

## Implementation Roadmap

### Phase 1: Core Types & Utilities
1. Define complete Pokemon TypeScript interfaces
2. Create species/move/nature constant files
3. Implement stat calculation functions
4. Build Pokemon creation/validation utilities

### Phase 2: Party System
1. Create PartyContext with reducer
2. Implement party manipulation hooks
3. Add party to SaveManager
4. Build party menu UI component

### Phase 3: PC Storage
1. Create StorageContext with reducer
2. Implement box navigation logic
3. Add deposit/withdraw operations
4. Build PC storage UI component

### Phase 4: Integration
1. Connect contexts to MapRenderer
2. Integrate with save/load system
3. Add Pokemon receiving (starter, catches)
4. Connect to healing locations (Pokemon Centers)

### Phase 5: UI Components
1. Party summary screen
2. PC box view
3. Pokemon details/summary
4. Move selection menus

---

## Related Files

| File | Purpose |
|------|---------|
| `src/save/types.ts` | Current save type definitions |
| `src/save/SaveManager.ts` | Save/load orchestration |
| `src/components/dialog/DialogContext.tsx` | React Context pattern example |
| `src/game/GameFlags.ts` | Flag state management pattern |
| `public/pokeemerald/include/pokemon.h` | ROM Pokemon structure |
| `public/pokeemerald/include/pokemon_storage_system.h` | ROM storage constants |
| `public/pokeemerald/include/global.h` | ROM SaveBlock structures |
| `public/pokeemerald/include/constants/species.h` | Species IDs |
| `public/pokeemerald/include/constants/pokemon.h` | Pokemon constants |

---

*Last Updated: 2025-11-26*
*Based on Pokemon Emerald decompilation project (pokeemerald)*
