# Implementation Plan: Normal Grass Field Effect (Tile 13)

## Goal

Implement the normal/tall grass field effect for metatile behavior `MB_TALL_GRASS` (value 2) with pixel-perfect faithful animation matching the pokeemerald C source code. When player walks on or spawns on grass tiles, animate grass swaying based on exact timing from the original game.

## User Review Required

> [!IMPORTANT]
> This implementation uses **5 animation frames with 10 ticks per frame** (50 total frames/ticks) as specified in pokeemerald source code (`src/data/field_effects/field_effect_objects.h` lines 79-86).

## Proposed Changes

### New Files

#### [NEW] [`src/game/GrassEffectManager.ts`](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/src/game/GrassEffectManager.ts)

Create grass effect manager to track and update grass animation sprites.

**Key implementations**:
- `GrassEffect` interface with:
  - `id`: Unique identifier
  - `tileX`, `tileY`: World tile coordinates
  - `animationFrame`: Current frame (0-4)
  - `animationTick`: Tick counter within current frame
  - `skipAnimation`: If true, start at frame 0 (spawn case)
  - `ownerObjectId`: Player/NPC that triggered this
  - `completed`: Whether animation finished
- `GrassEffectManager` class with:
  - `effects`: Map of active grass effects
  - `create(x, y, skipAnimation)`: Create new grass effect
  - `update()`: Update all effects, advance animation ticks/frames
  - `cleanup()`: Remove completed effects where player moved away
  - `getEffectsForRendering()`: Get effects with render positions

**Animation sequence** (from C code):
```
Frame 1: 10 ticks
Frame 2: 10 ticks
Frame 3: 10 ticks
Frame 4: 10 ticks
Frame 0: 10 ticks
END (mark as completed)
```

---

### Modified Files

#### [MODIFY] [`src/utils/metatileBehaviors.ts`](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/src/utils/metatileBehaviors.ts)

Add grass behavior helpers:

```typescript
// Import from generated file
import { MB_TALL_GRASS } from './metatileBehaviors.generated';

export { MB_TALL_GRASS };

export function isTallGrassBehavior(behavior: number): boolean {
  return behavior === MB_TALL_GRASS;
}
```

#### [MODIFY] [`src/game/PlayerController.ts`](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/src/game/PlayerController.ts)

Add grass effect integration:

1. Import `GrassEffectManager` and `isTallGrassBehavior`
2. Add `grassEffectManager` property to `PlayerController`
3. In `enter()` methods of states that complete tile movement:
   - Check if new tile is tall grass
   - Create grass effect: `grassEffectManager.create(tileX, tileY, false)`
4. In constructor/spawn:
   - Check if spawning on tall grass
   - Create grass effect with skip: `grassEffectManager.create(tileX, tileY, true)`
5. Export grass effect manager for rendering: `getGrassEffectManager()`

#### [MODIFY] [`src/components/MapRenderer.tsx`](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/src/components/MapRenderer.tsx)

Add grass sprite rendering:

1. Load grass sprite sheet from `/pokeemerald/graphics/field_effects/pics/tall_grass.png`
2. In render loop after map tiles but before player:
   - Get grass effects from `playerController.getGrassEffectManager()`
   - For each effect:
     - Calculate screen position from world tile coords
     - Calculate z-index based on priority (2) and subpriority
     - Render current animation frame from sprite sheet
3. **Z-index calculation**:
   - Base priority: 2
   - Subpriority offset: 0 normally, +4 when `animationFrame === 0`
   - Formula: `z-index = (3 - priority) * 1000 + (255 - subpriority)`
4. **Sprite rendering**:
   - 5 frames at 16x16 pixels each
   - Frame positions in sprite sheet: (0,0), (16,0), (32,0), (48,0), (64,0)
   - Render at tile center: `screenX + 8, screenY + 8`

---

## Sprite Asset Preparation

The tall grass sprite already exists at:
`public/pokeemerald/graphics/field_effects/pics/tall_grass.png`

This is a 5-frame sprite sheet (80x16 pixels total, each frame 16x16).

---

## Verification Plan

### Automated Tests

No existing test infrastructure found for game logic. Will add manual verification.

### Manual Verification

**Test 1: Grass Animation on Walk**
1. Run `npm run dev`
2. Navigate to Route 101 (or any route with grass)
3. Walk onto a grass tile
4. **Expected**: 
   - Grass sprite appears at tile position
   - Animates through 5 frames over 50 game frames (~833ms at 60 FPS)
   - Animation sequence: frames 1→2→3→4→0, then stops
5. Walk away from grass tile
6. **Expected**: Grass animation remains visible until completion

**Test 2: Grass on Spawn**
1. Load save game on grass tile (or set spawn point on grass)
2. **Expected**:
   - Grass sprite shows frame 0 immediately (no animation)
   - Sprite stays visible

**Test 3: Multiple Grass Tiles**
1. Walk across multiple grass tiles rapidly
2. **Expected**:
   - Each grass tile gets its own grass effect sprite
   - All animate independently
   - No visual glitches or overlapping issues

**Test 4: Z-order Correctness**
1. Walk on grass at different elevations
2. **Expected**:
   - Grass renders behind player character
   - Proper layering with map tiles

**Test 5: Timing Accuracy**
1. Record video of walking on grass at 60 FPS
2. Count frames from grass start to grass end
3. **Expected**: Exactly 50 frames (verified against C code timing)

---

## Implementation Notes

### From C Source Code Reference

**Animation frame data** (`public/pokeemerald/src/data/field_effects/field_effect_objects.h:71-102`):
- 5 frames stored in `sPicTable_TallGrass[]`
- Animation defined in `sAnim_TallGrass[]`:
  ```c
  ANIMCMD_FRAME(1, 10),  // Frame 1, 10 ticks
  ANIMCMD_FRAME(2, 10),  // Frame 2, 10 ticks
  ANIMCMD_FRAME(3, 10),  // Frame 3, 10 ticks
  ANIMCMD_FRAME(4, 10),  // Frame 4, 10 ticks
  ANIMCMD_FRAME(0, 10),  // Frame 0, 10 ticks
  ANIMCMD_END,
  ```

**Field effect creation** (`public/pokeemerald/src/field_effect_helpers.c:291-314`):
- Sprite created at tile position with 8x8 pixel offset (center of tile)
- Priority: 2
- Elevation stored and used for subpriority calculation

**Ground effect triggers** (`public/pokeemerald/src/event_object_movement.c:7802-7826`):
- `GroundEffect_SpawnOnTallGrass()`: When spawning on grass, skip to end (frame 0)
- `GroundEffect_StepOnTallGrass()`: When stepping onto grass, play full animation

**Update logic** (`public/pokeemerald/src/field_effect_helpers.c:316-357`):
- Effect stays alive until animation completes AND player moved away
- Subpriority adjusted based on current frame (frame 0 gets +4 offset)

### Key Differences from Long Grass

Normal grass (tile 13) does NOT hide player's bottom half (no subsprite table switching).
