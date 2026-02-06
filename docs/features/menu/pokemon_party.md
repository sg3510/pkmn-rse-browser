---
title: Pokemon Party Menu - Complete Implementation Guide
status: reference
last_verified: 2026-01-13
---

# Pokemon Party Menu - Complete Implementation Guide

Technical reference for implementing the Pokemon party management UI, summary screens, and data integration with the save system.

## Table of Contents

1. [Overview](#overview)
2. [Data Flow Architecture](#data-flow-architecture)
3. [Party Menu UI](#party-menu-ui)
4. [Pokemon Summary Screen](#pokemon-summary-screen)
5. [Icon System](#icon-system)
6. [Stat Calculation](#stat-calculation)
7. [Integration with Save System](#integration-with-save-system)
8. [Implementation Plan](#implementation-plan)

---

## Overview

The Pokemon party menu allows players to:
- View all 6 party slots with Pokemon icons, names, levels, HP
- Select Pokemon to view detailed summary
- Swap Pokemon positions
- Use items on Pokemon
- View/manage held items
- Check moves and stats

### Key Files Reference

| Source | Purpose |
|--------|---------|
| `public/pokeemerald/src/party_menu.c` | Party menu implementation |
| `public/pokeemerald/src/pokemon_summary_screen.c` | Summary screen |
| `public/pokeemerald/include/constants/party_menu.h` | Constants |
| `public/pokeemerald/graphics/party_menu/` | UI assets |
| `public/pokeemerald/graphics/pokemon/*/icon.png` | Pokemon icons (390 species) |
| `docs/systems/save/pokemon-party-storage-system.md` | Data structures reference |

---

## Data Flow Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│  Save File      │────▶│  SaveManager     │────▶│  PartyContext  │
│  (localStorage) │     │  (load/save)     │     │  (React state) │
└─────────────────┘     └──────────────────┘     └────────────────┘
                                                         │
                                                         ▼
                        ┌──────────────────┐     ┌────────────────┐
                        │  Party Menu UI   │◀────│  useParty()    │
                        │  (PartyMenu.tsx) │     │  (hook)        │
                        └──────────────────┘     └────────────────┘
                                │
                                ▼
                        ┌──────────────────┐
                        │  Summary Screen  │
                        │  (PokemonSummary)│
                        └──────────────────┘
```

### Pokemon Data Structure

From `docs/systems/save/pokemon-party-storage-system.md`, the full Pokemon interface:

```typescript
interface Pokemon {
  // Identity
  personality: number;        // 32-bit (nature, gender, ability, shiny)
  otId: number;              // Trainer ID
  species: number;           // 1-411 (National Dex)
  nickname: string | null;   // Max 10 chars
  otName: string;            // Original trainer name

  // Core stats
  level: number;             // 1-100
  experience: number;        // Total EXP
  heldItem: number;          // Item ID (0 = none)
  friendship: number;        // 0-255

  // Moves (4 slots)
  moves: [number, number, number, number];
  pp: [number, number, number, number];
  ppBonuses: number;         // PP Up usage (2 bits per move)

  // IVs (0-31 each)
  ivs: { hp, attack, defense, speed, spAttack, spDefense };

  // EVs (0-255 each, 510 total max)
  evs: { hp, attack, defense, speed, spAttack, spDefense };

  // Calculated stats (party only)
  stats: {
    hp: number;              // Current HP
    maxHp: number;
    attack: number;
    defense: number;
    speed: number;
    spAttack: number;
    spDefense: number;
  };

  // Status
  status: number;            // Condition flags
  isEgg: boolean;
  abilityNum: 0 | 1;         // Which ability slot

  // Origin
  metLocation: number;
  metLevel: number;
  metGame: number;
  pokeball: number;
  otGender: 'male' | 'female';

  // Pokerus
  pokerus: { strain: number; days: number };

  // Markings & ribbons
  markings: { circle, square, triangle, heart };
  ribbons: { /* various ribbon flags */ };
}
```

---

## Party Menu UI

### Layout (from party_menu.c)

The GBA uses a specific layout:

```
┌─────────────────────────────────────────┐
│  ┌───────────────┐  ┌─────────────────┐ │
│  │   [Icon 32x32]│  │   Slot 2        │ │
│  │   Slot 1      │  │   [Icon] Name   │ │
│  │   Name  Lv XX │  │   HP ████░░     │ │
│  │   HP ████████ │  ├─────────────────┤ │
│  │   XXX/XXX     │  │   Slot 3        │ │
│  │   [♂/♀] [PSN] │  │   [Icon] Name   │ │
│  │               │  │   HP ████░░     │ │
│  └───────────────┘  ├─────────────────┤ │
│                     │   Slot 4        │ │
│                     ├─────────────────┤ │
│                     │   Slot 5        │ │
│                     ├─────────────────┤ │
│                     │   Slot 6        │ │
│                     └─────────────────┘ │
│  [CANCEL]                               │
└─────────────────────────────────────────┘
```

### Slot Display Elements

| Element | Description |
|---------|-------------|
| Pokemon Icon | 32x32px from species icon.png |
| Nickname | Or species name if no nickname |
| Level | "Lv XX" format |
| Gender | ♂ or ♀ symbol (if applicable) |
| HP Bar | Color-coded (green ≥50%, yellow 21-49%, red ≤20%) |
| HP Value | "XXX/XXX" current/max |
| Held Item | Small icon if holding item |
| Status | PSN/PAR/SLP/FRZ/BRN icon if affected |

### Selection States

```typescript
enum PartyPalette {
  SELECTED = 1 << 0,      // Currently highlighted
  FAINTED = 1 << 1,       // HP = 0 (grayed out)
  TO_SWITCH = 1 << 2,     // Target for swap
  NO_MON = 1 << 6,        // Empty slot
}
```

### CSS Implementation

```css
.party-slot {
  display: grid;
  grid-template-columns: 32px 1fr;
  gap: 4px;
  padding: 4px;
  border: 2px solid transparent;
  border-radius: 4px;
}

.party-slot.selected {
  border-color: var(--menu-accent-color);
  background: var(--menu-tile-selected);
  animation: party-pulse 1s ease-in-out infinite;
}

.party-slot.fainted {
  opacity: 0.5;
  filter: grayscale(0.8);
}

.hp-bar {
  height: 4px;
  background: #333;
  border-radius: 2px;
  overflow: hidden;
}

.hp-bar-fill {
  height: 100%;
  transition: width 200ms ease;
}

.hp-bar-fill.green { background: #48d048; }
.hp-bar-fill.yellow { background: #f8d030; }
.hp-bar-fill.red { background: #f85888; }
```

---

## Pokemon Summary Screen

5 pages of detailed information:

### Page 1: Info

```
┌─────────────────────────────────┐
│  BULBASAUR       ♂  Lv. 15     │
│  ──────────────────────────────│
│  Dex No.    001                 │
│  Name       BULBASAUR           │
│  Type       GRASS  POISON       │
│  ──────────────────────────────│
│  OT         RED                 │
│  ID No.     12345               │
│  ──────────────────────────────│
│  Item       NONE                │
│                                 │
│  [←] [PAGE 1/5] [→]             │
└─────────────────────────────────┘
```

### Page 2: Skills (Stats)

```
┌─────────────────────────────────┐
│  BULBASAUR                      │
│  ──────────────────────────────│
│  HP         45 / 45             │
│  ATTACK         52              │
│  DEFENSE        49              │
│  SP. ATK        65              │
│  SP. DEF        65              │
│  SPEED          45              │
│  ──────────────────────────────│
│  ABILITY    OVERGROW            │
│  ──────────────────────────────│
│  EXP.       1234                │
│  TO NEXT LV  266                │
│  [████████░░░░░░░░] 75%         │
└─────────────────────────────────┘
```

### Page 3: Moves

```
┌─────────────────────────────────┐
│  BULBASAUR                      │
│  ──────────────────────────────│
│  TACKLE         PP 35/35        │
│    TYPE: NORMAL  POW: 40        │
│  ──────────────────────────────│
│  GROWL          PP 40/40        │
│    TYPE: NORMAL  POW: --        │
│  ──────────────────────────────│
│  VINE WHIP      PP 25/25        │
│    TYPE: GRASS   POW: 45        │
│  ──────────────────────────────│
│  ---            PP --/--        │
│                                 │
└─────────────────────────────────┘
```

---

## Icon System

### Pokemon Icons (390 species)

**Location:** `public/pokeemerald/graphics/pokemon/{species}/icon.png`

**Format:**
- Size: 32x64 pixels (2 animation frames stacked vertically)
- Frame 1: Top 32x32 (default)
- Frame 2: Bottom 32x32 (animated)
- 4-bit color depth (16-color palette)

**Mapping species ID to folder:**

```typescript
// Species ID to folder name mapping
const SPECIES_TO_FOLDER: Record<number, string> = {
  1: 'bulbasaur',
  2: 'ivysaur',
  3: 'venusaur',
  4: 'charmander',
  // ... etc
  25: 'pikachu',
  // Special cases:
  29: 'nidoran_f',   // NIDORAN_F
  32: 'nidoran_m',   // NIDORAN_M
  83: 'farfetchd',   // FARFETCH'D (no apostrophe)
  122: 'mr_mime',    // MR. MIME
  // ... 390 total
};

function getPokemonIconPath(speciesId: number): string {
  const folder = SPECIES_TO_FOLDER[speciesId];
  if (!folder) return '/pokeemerald/graphics/pokemon/egg/icon.png';
  return `/pokeemerald/graphics/pokemon/${folder}/icon.png`;
}
```

### Animated Icons

```typescript
// CSS sprite animation for 2-frame icons
.pokemon-icon {
  width: 32px;
  height: 32px;
  background-size: 32px 64px;
  background-position: 0 0;
  image-rendering: pixelated;
  animation: icon-bounce 0.5s steps(2) infinite;
}

@keyframes icon-bounce {
  0%, 100% { background-position: 0 0; }
  50% { background-position: 0 -32px; }
}

.pokemon-icon.paused {
  animation-play-state: paused;
}
```

### Status Icons

**Location:** `public/pokeemerald/graphics/party_menu/` or similar

| Status | Abbreviation |
|--------|--------------|
| Poison | PSN |
| Paralysis | PAR |
| Sleep | SLP |
| Freeze | FRZ |
| Burn | BRN |
| Fainted | FNT |
| Pokerus | PKRS |

### Held Item Icons

Reuse the item icon system from bag menu:

```typescript
import { getItemIconPath } from '../../data/items';

// In component:
{pokemon.heldItem > 0 && (
  <img
    className="held-item-icon"
    src={getItemIconPath(pokemon.heldItem)}
    alt=""
  />
)}
```

---

## Stat Calculation

### Formulas (from pokemon.c)

```typescript
/**
 * Calculate HP stat
 */
function calculateHP(
  baseHP: number,
  iv: number,
  ev: number,
  level: number
): number {
  // Shedinja special case
  if (baseHP === 1) return 1;

  return Math.floor(
    ((2 * baseHP + iv + Math.floor(ev / 4)) * level) / 100
  ) + level + 10;
}

/**
 * Calculate other stats (Attack, Defense, Speed, Sp.Atk, Sp.Def)
 */
function calculateStat(
  baseStat: number,
  iv: number,
  ev: number,
  level: number,
  natureModifier: number  // 0.9, 1.0, or 1.1
): number {
  const basePart = Math.floor(
    ((2 * baseStat + iv + Math.floor(ev / 4)) * level) / 100
  ) + 5;
  return Math.floor(basePart * natureModifier);
}
```

### Nature Modifiers

```typescript
const NATURE_STAT_MODIFIERS: Record<number, [number, number, number, number, number]> = {
  // [Atk, Def, Spd, SpA, SpD] - values are: 0=neutral, 1=+10%, -1=-10%
  0: [0, 0, 0, 0, 0],   // Hardy (neutral)
  1: [1, -1, 0, 0, 0],  // Lonely (+Atk, -Def)
  2: [1, 0, -1, 0, 0],  // Brave (+Atk, -Spd)
  3: [1, 0, 0, -1, 0],  // Adamant (+Atk, -SpA)
  4: [1, 0, 0, 0, -1],  // Naughty (+Atk, -SpD)
  5: [-1, 1, 0, 0, 0],  // Bold (-Atk, +Def)
  6: [0, 0, 0, 0, 0],   // Docile (neutral)
  7: [0, 1, -1, 0, 0],  // Relaxed (+Def, -Spd)
  8: [0, 1, 0, -1, 0],  // Impish (+Def, -SpA)
  9: [0, 1, 0, 0, -1],  // Lax (+Def, -SpD)
  10: [-1, 0, 1, 0, 0], // Timid (-Atk, +Spd)
  11: [0, -1, 1, 0, 0], // Hasty (+Spd, -Def)
  12: [0, 0, 0, 0, 0],  // Serious (neutral)
  13: [0, 0, 1, -1, 0], // Jolly (+Spd, -SpA)
  14: [0, 0, 1, 0, -1], // Naive (+Spd, -SpD)
  15: [-1, 0, 0, 1, 0], // Modest (-Atk, +SpA)
  16: [0, -1, 0, 1, 0], // Mild (+SpA, -Def)
  17: [0, 0, -1, 1, 0], // Quiet (+SpA, -Spd)
  18: [0, 0, 0, 0, 0],  // Bashful (neutral)
  19: [0, 0, 0, 1, -1], // Rash (+SpA, -SpD)
  20: [-1, 0, 0, 0, 1], // Calm (-Atk, +SpD)
  21: [0, -1, 0, 0, 1], // Gentle (+SpD, -Def)
  22: [0, 0, -1, 0, 1], // Sassy (+SpD, -Spd)
  23: [0, 0, 0, -1, 1], // Careful (+SpD, -SpA)
  24: [0, 0, 0, 0, 0],  // Quirky (neutral)
};

function getNatureModifier(nature: number, statIndex: number): number {
  const modifiers = NATURE_STAT_MODIFIERS[nature] || [0, 0, 0, 0, 0];
  const mod = modifiers[statIndex];
  if (mod === 1) return 1.1;
  if (mod === -1) return 0.9;
  return 1.0;
}
```

### Nature from Personality

```typescript
function getNatureFromPersonality(personality: number): number {
  return personality % 25;
}

const NATURE_NAMES = [
  'Hardy', 'Lonely', 'Brave', 'Adamant', 'Naughty',
  'Bold', 'Docile', 'Relaxed', 'Impish', 'Lax',
  'Timid', 'Hasty', 'Serious', 'Jolly', 'Naive',
  'Modest', 'Mild', 'Quiet', 'Bashful', 'Rash',
  'Calm', 'Gentle', 'Sassy', 'Careful', 'Quirky'
];
```

### Gender from Personality

```typescript
function getGender(personality: number, genderRatio: number): 'male' | 'female' | 'genderless' {
  if (genderRatio === 255) return 'genderless';  // MON_GENDERLESS
  if (genderRatio === 254) return 'female';       // MON_FEMALE (100%)
  if (genderRatio === 0) return 'male';           // MON_MALE (100%)

  // P value from personality determines gender
  const p = personality & 0xFF;
  return p >= genderRatio ? 'male' : 'female';
}
```

---

## Integration with Save System

### SaveManager Extension

```typescript
// src/save/SaveManager.ts additions

interface SaveData {
  // ... existing fields
  party: PartyPokemon[];
  pcStorage: PCStorage;
}

class SaveManager {
  private party: PartyPokemon[] = [];
  private pcStorage: PCStorage = createEmptyStorage();

  setParty(party: PartyPokemon[]): void {
    this.party = party;
  }

  getParty(): PartyPokemon[] {
    return [...this.party];
  }

  // In save():
  save(slot: number, locationState: LocationState): SaveResult {
    const saveData: SaveData = {
      // ... existing
      party: this.party,
      pcStorage: this.pcStorage,
    };
    // ...
  }

  // In load():
  load(slot: number): SaveData | null {
    // ... existing
    if (data.party) {
      this.party = data.party;
    }
    // ...
  }
}
```

### PartyContext Provider

```typescript
// src/contexts/PartyContext.tsx

interface PartyState {
  pokemon: (PartyPokemon | null)[];
  selectedIndex: number;
}

const PartyContext = createContext<{
  state: PartyState;
  dispatch: Dispatch<PartyAction>;
} | null>(null);

export function useParty() {
  const ctx = useContext(PartyContext);
  if (!ctx) throw new Error('useParty outside provider');

  return {
    party: ctx.state.pokemon,
    partyCount: ctx.state.pokemon.filter(p => p !== null).length,
    selectedPokemon: ctx.state.pokemon[ctx.state.selectedIndex],

    addPokemon: (pokemon: PartyPokemon) => {
      ctx.dispatch({ type: 'ADD_POKEMON', pokemon });
    },

    swapPokemon: (i: number, j: number) => {
      ctx.dispatch({ type: 'SWAP_POKEMON', index1: i, index2: j });
    },

    updatePokemon: (index: number, updates: Partial<PartyPokemon>) => {
      ctx.dispatch({ type: 'UPDATE_POKEMON', index, updates });
    },

    healAll: () => {
      ctx.dispatch({ type: 'HEAL_ALL' });
    },
  };
}
```

---

## Implementation Plan

### Phase 1: Data Layer (Foundation)

1. **Generate species data** - Create script to parse pokeemerald and generate:
   - `src/data/species.ts` - SPECIES constants, names, folder mappings
   - `src/data/speciesInfo.ts` - Base stats, types, abilities, gender ratios
   - `src/data/moves.ts` - Move constants and data
   - `src/data/abilities.ts` - Ability constants and names
   - `src/data/natures.ts` - Nature names and stat modifiers

2. **Pokemon types** - Create comprehensive TypeScript interfaces in:
   - `src/pokemon/types.ts` - Pokemon, PartyPokemon, BoxPokemon interfaces

3. **Stat calculator** - Implement calculation functions:
   - `src/pokemon/stats.ts` - calculateStats(), getNature(), getGender()

### Phase 2: State Management

1. **PartyContext** - React context for party state:
   - `src/contexts/PartyContext.tsx`
   - Actions: ADD, REMOVE, SWAP, UPDATE, HEAL_ALL, SET_PARTY

2. **SaveManager integration**:
   - Extend SaveData interface
   - Add party serialization/deserialization

### Phase 3: Party Menu UI

1. **PartyMenu component**:
   - `src/menu/components/PartyMenu.tsx`
   - 6-slot grid layout
   - Pokemon icons with animation
   - HP bars with color coding
   - Status icons

2. **Menu navigation**:
   - Keyboard (arrows + X/Z)
   - Click support
   - Swap mode

### Phase 4: Summary Screen

1. **PokemonSummary component**:
   - `src/menu/components/PokemonSummary.tsx`
   - 5 page tabs (Info, Skills, Moves, Contest, Ribbons)
   - Stats display with EXP bar
   - Move list with PP

### Phase 5: Integration

1. **Connect to MenuOverlay** - Add 'pokemon' menu type
2. **Start menu tile** - Enable Pokemon tile when party has Pokemon
3. **Save/Load testing** - Verify persistence

---

## File Structure (Proposed)

```
src/
├── data/
│   ├── species.ts              # SPECIES constants, names, folders
│   ├── speciesInfo.ts          # Base stats, types, abilities
│   ├── moves.ts                # Move constants and data
│   ├── abilities.ts            # Ability names
│   ├── natures.ts              # Nature data
│   └── items.ts                # (existing) + re-export descriptions
├── pokemon/
│   ├── types.ts                # Pokemon interfaces
│   ├── stats.ts                # Stat calculations
│   ├── validation.ts           # Checksum, bad egg detection
│   └── icons.ts                # Icon path helpers
├── contexts/
│   ├── PartyContext.tsx        # Party state management
│   └── StorageContext.tsx      # PC storage (future)
├── menu/
│   ├── components/
│   │   ├── PartyMenu.tsx       # Party menu
│   │   ├── PartySlot.tsx       # Individual slot
│   │   ├── PokemonSummary.tsx  # Summary screen
│   │   └── HPBar.tsx           # HP bar component
│   └── styles/
│       ├── party-menu.css
│       └── pokemon-summary.css
└── scripts/
    ├── generate-species-data.cjs
    └── generate-move-data.cjs
```

---

## Related Documentation

- `docs/systems/save/pokemon-party-storage-system.md` - Complete data structures
- `docs/systems/save/gen3-party-pokemon-example.md` - Worked encoding example
- `docs/features/menu/party-menu.md` - Original GBA party menu reference
- `docs/features/menu/graphics-assets.md` - Asset inventory

---

*Last Updated: 2025-12-05*
