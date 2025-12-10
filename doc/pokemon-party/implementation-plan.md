# Pokemon Party System - Real Data Implementation Plan

This plan covers implementing real Pokemon data from .sav files and at-scale sprite handling.

---

## Phase 1: Pokemon Data Parsing from .sav Files

### 1.1 Understand the Encrypted Structure

GBA Pokemon are stored with encryption:
- **Encryption key**: `personality XOR otId`
- **Data**: 48 bytes split into 4 substructs (12 bytes each)
- **Shuffling**: Substruct order determined by `personality % 24`

```
BoxPokemon (80 bytes):
├── personality (4 bytes) - unencrypted
├── otId (4 bytes) - unencrypted
├── nickname (10 bytes) - unencrypted
├── language (2 bytes) - unencrypted
├── otName (7 bytes) - unencrypted
├── markings (1 byte) - unencrypted
├── checksum (2 bytes) - unencrypted
├── padding (2 bytes)
└── substructs (48 bytes) - ENCRYPTED & SHUFFLED
    ├── Growth: species, item, exp, ppBonuses, friendship
    ├── Attacks: moves[4], pp[4]
    ├── EVs/Condition: EVs, contest stats
    └── Misc: pokerus, met location, origins, IVs, ribbons

PartyPokemon (100 bytes):
└── BoxPokemon + status (4) + level (1) + mail (1) + currentHP (2) + maxHP (2) + stats (10)
```

### 1.2 Files to Create/Modify

```
src/save/native/
├── Gen3Pokemon.ts        # NEW: Pokemon decryption & parsing
├── Gen3Constants.ts      # ADD: Pokemon offsets & substruct sizes
├── Gen3SaveParser.ts     # MODIFY: Call Pokemon parser
└── index.ts              # EXPORT: New functions
```

### 1.3 Implementation Tasks

- [ ] Add Pokemon constants to Gen3Constants.ts:
  ```typescript
  export const POKEMON_BOX_SIZE = 80;
  export const POKEMON_PARTY_SIZE = 100;
  export const SUBSTRUCT_SIZE = 12;
  export const PARTY_OFFSET = 0x238;  // In SaveBlock1
  export const PARTY_COUNT_OFFSET = 0x234;
  ```

- [ ] Create Gen3Pokemon.ts with:
  - `decryptSubstructs(data, personality, otId)`
  - `getSubstructOrder(personality)` - returns [G,A,E,M] indices
  - `parseBoxPokemon(data, offset)` → BoxPokemon
  - `parsePartyPokemon(data, offset)` → PartyPokemon
  - `parseParty(data, sectionMap)` → PartyPokemon[]

- [ ] Add substruct order lookup table (24 permutations)

- [ ] Integrate into Gen3SaveParser.ts:
  - Call `parseParty()` when reading SaveBlock1
  - Add `party` field to result SaveData

---

## Phase 2: SaveManager Integration

### 2.1 Update Save Types

In `src/save/types.ts`:
- [ ] Update `PartyState` to use full `PartyPokemon` from `src/pokemon/types.ts`
- [ ] Or create adapter between save format and runtime format

### 2.2 Update SaveManager

In `src/save/SaveManager.ts`:
- [ ] Add `private party: PartyState` field
- [ ] Save party in `save()` method
- [ ] Load party in `load()` method
- [ ] Add `getParty()` / `setParty()` methods
- [ ] Initialize empty party in `newGame()`

### 2.3 Connect to PartyContext

- [ ] Add PartyProvider to component tree (in App.tsx or GamePage.tsx)
- [ ] On app load, call `saveManager.getParty()` → `partyContext.setParty()`
- [ ] On save, call `partyContext.party` → `saveManager.save()`

---

## Phase 3: UI - Pokemon Summary Screen

### 3.1 Component Structure

```
src/menu/components/
├── PokemonSummary.tsx      # Main container with page tabs
├── SummaryInfoPage.tsx     # Species, nickname, OT, nature, ability
├── SummarySkillsPage.tsx   # Stats bars, EVs/IVs, EXP bar
├── SummaryMovesPage.tsx    # 4 moves with type, PP, power, accuracy
└── PokemonSprite.tsx       # Reusable sprite display component
```

### 3.2 Summary Pages

**INFO Page:**
- Large Pokemon sprite (front.png or anim_front.png)
- Species name, nickname
- Level, nature, ability
- OT name, OT ID
- Met location (optional)

**SKILLS Page:**
- 6 stat bars (HP, Atk, Def, SpA, SpD, Spe)
- Base stat + IV + EV breakdown (optional)
- EXP bar with "To next level: X"
- Ability name + description

**MOVES Page:**
- 4 move slots
- Move name, type icon, PP (current/max)
- Select move → show power, accuracy, description
- Move descriptions from pokeemerald source

### 3.3 Navigation

- Left/Right arrows switch pages
- Up/Down on moves page selects move
- B button returns to party menu
- Page indicator dots at bottom

---

## Phase 4: Sprites at Scale

### 4.1 Available Sprites per Pokemon

```
public/pokeemerald/graphics/pokemon/{species}/
├── icon.png         # 32x64 (2 frames) - party menu
├── front.png        # ~64x64 - summary, pokedex
├── back.png         # ~64x64 - battle (player side)
├── anim_front.png   # Multi-frame animation
├── footprint.png    # Pokedex footprint
├── normal.pal       # Normal palette
└── shiny.pal        # Shiny palette
```

### 4.2 Sprite Utilities

Create `src/pokemon/sprites.ts`:
```typescript
export function getFrontSpritePath(speciesId: number): string;
export function getBackSpritePath(speciesId: number): string;
export function getIconSpritePath(speciesId: number): string;
export function getShinyPalette(speciesId: number): string;
```

### 4.3 Sprite Component

Create reusable `PokemonSprite.tsx`:
```typescript
interface PokemonSpriteProps {
  speciesId: number;
  variant: 'icon' | 'front' | 'back';
  shiny?: boolean;
  animated?: boolean;
  size?: number;
}
```

### 4.4 Performance Considerations

- [ ] Use CSS `image-rendering: pixelated` for crisp scaling
- [ ] Preload commonly used sprites
- [ ] Consider sprite sheets for icons (optional optimization)
- [ ] Lazy load sprites not in viewport

---

## Phase 5: Move Data

### 5.1 Generate Move Info

Create `scripts/generate-move-info.cjs`:
- Parse `public/pokeemerald/src/data/moves_info.h`
- Extract: power, accuracy, PP, type, effect, description

Output `src/data/moveInfo.ts`:
```typescript
export interface MoveInfo {
  name: string;
  type: string;
  power: number;
  accuracy: number;
  pp: number;
  effect: string;
  description: string;
}
export const MOVE_INFO: Record<number, MoveInfo>;
```

### 5.2 Display Moves

- Show type icon (colored badge)
- Format PP as "PP XX/XX"
- Show power/accuracy on selection
- Color PP based on remaining (full=black, low=yellow, empty=red)

---

## Phase 6: Testing & Verification

### 6.1 Icon Verification

- [ ] Create test page that renders all 387 species icons
- [ ] Check for missing/broken images
- [ ] Verify animation works (2-frame bounce)

### 6.2 Save Import Testing

- [ ] Test with real Pokemon Emerald .sav file
- [ ] Verify all 6 party Pokemon parse correctly
- [ ] Check species, moves, stats match expected values
- [ ] Test with Ruby/Sapphire saves (different offsets)

### 6.3 Edge Cases

- [ ] Handle egg Pokemon
- [ ] Handle bad egg (corrupted)
- [ ] Handle empty party slots
- [ ] Handle Pokemon with no moves (only Struggle)

---

## File Summary

**New Files:**
- `src/save/native/Gen3Pokemon.ts` - Pokemon parsing
- `src/pokemon/sprites.ts` - Sprite path utilities
- `src/data/moveInfo.ts` - Generated move data
- `src/menu/components/PokemonSummary.tsx` - Summary screen
- `src/menu/components/SummaryInfoPage.tsx`
- `src/menu/components/SummarySkillsPage.tsx`
- `src/menu/components/SummaryMovesPage.tsx`
- `src/menu/components/PokemonSprite.tsx`
- `src/menu/styles/pokemon-summary.css`
- `scripts/generate-move-info.cjs`

**Modified Files:**
- `src/save/native/Gen3Constants.ts` - Add Pokemon offsets
- `src/save/native/Gen3SaveParser.ts` - Parse party
- `src/save/SaveManager.ts` - Save/load party
- `src/save/types.ts` - Update PartyState type
- `src/menu/components/MenuOverlay.tsx` - Route to Summary
- `src/menu/components/PartyMenu.tsx` - Open Summary on select
- `App.tsx` or `GamePage.tsx` - Add PartyProvider

---

## Execution Order

1. **Gen3Pokemon.ts** - Core parsing logic (most complex)
2. **SaveManager integration** - Wire up persistence
3. **PartyProvider** - Add to component tree
4. **PokemonSummary** - Display Pokemon details
5. **Move info generation** - Show move details
6. **Testing** - Verify with real saves

Estimated scope: ~800-1000 lines of new code
