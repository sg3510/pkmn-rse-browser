---
title: Grass Effect Investigation
status: reference
last_verified: 2026-01-13
---

# Grass Effect Investigation

## Overview

This document details how grass effects work in pokeemerald, specifically for:
- **Normal/Tall Grass** (Metatile Behavior: `MB_TALL_GRASS`, typically tile 13)
- **Long Grass** (Metatile Behavior: `MB_LONG_GRASS`, typically tile 21)

## Metatile Behaviors

### Normal/Tall Grass (`MB_TALL_GRASS`)
- **Definition**: `include/constants/metatile_behaviors.h:7`
- **Check Function**: `MetatileBehavior_IsTallGrass()` in `metatile_behavior.c:729-735`
- **Properties**:
  - `TILE_FLAG_UNUSED | TILE_FLAG_HAS_ENCOUNTERS`
  - Can be cut with Cut HM
  - Running is allowed
  - Triggers wild encounters

### Long Grass (`MB_LONG_GRASS`)
- **Definition**: Separate metatile behavior
- **Check Function**: `MetatileBehavior_IsLongGrass()` in `metatile_behavior.c:737-743`
- **Properties**:
  - Running is **disallowed**
  - **Covers the bottom half of the player sprite** (this is the key difference!)
  - Can be cut with Cut HM

---

## Field Effect System

### When Grass Effects Trigger

Grass effects are triggered through the ground effect system in `event_object_movement.c`:

1. **On Spawn** (`GROUND_EFFECT_FLAG_TALL_GRASS_ON_SPAWN`):
   - When player spawns on grass tile
   - Calls `GroundEffect_SpawnOnTallGrass()` at line 7802
   - Skips to end of animation (no movement visual)

2. **On Move** (`GROUND_EFFECT_FLAG_TALL_GRASS_ON_MOVE`):
   - When player steps onto grass tile
   - Calls `GroundEffect_StepOnTallGrass()` at line 7815
   - Plays full animation

3. **On Jump Landing** (`GROUND_EFFECT_FLAG_LAND_IN_TALL_GRASS`):
   - When player jumps onto grass
   - Calls `GroundEffect_JumpOnTallGrass()` at line 7949
   - Creates special jump impact grass effect

---

## Tall Grass Animation Sprite

### Sprite Template
**Location**: `src/data/field_effects/field_effect_objects.h:94-102`

```c
const struct SpriteTemplate gFieldEffectObjectTemplate_TallGrass = {
    .tileTag = TAG_NONE,
    .paletteTag = FLDEFF_PAL_TAG_GENERAL_1,
    .oam = &gObjectEventBaseOam_16x16,
    .anims = sAnimTable_TallGrass,
    .images = sPicTable_TallGrass,
    .affineAnims = gDummySpriteAffineAnimTable,
    .callback = UpdateTallGrassFieldEffect,
};
```

### Animation Frames
**Location**: Lines 71-92

- **Size**: 16x16 pixels (2x2 tiles)
- **Frames**: 5 frames total
  - Frame 0: Idle/rest state
  - Frame 1-4: Swaying animation
- **Animation Sequence**:
  ```c
  ANIMCMD_FRAME(1, 10),  // Show frame 1 for 10 ticks
  ANIMCMD_FRAME(2, 10),  // Show frame 2 for 10 ticks
  ANIMCMD_FRAME(3, 10),  // Show frame 3 for 10 ticks
  ANIMCMD_FRAME(4, 10),  // Show frame 4 for 10 ticks
  ANIMCMD_FRAME(0, 10),  // Return to idle for 10 ticks
  ANIMCMD_END,           // Animation completes
  ```
- **Total Duration**: 50 ticks/frames

### Field Effect Creation
**Function**: `FldEff_TallGrass()` in `field_effect_helpers.c:291-314`

Key parameters passed via `gFieldEffectArguments`:
- `[0]`: X coordinate (map coordinates)
- `[1]`: Y coordinate (map coordinates)
- `[2]`: Elevation
- `[3]`: Priority (always 2)
- `[4]`: Local ID << 8 | Map Number
- `[5]`: Map Group
- `[6]`: Current map identifier
- `[7]`: Skip to end flag (TRUE = skip animation, FALSE = play animation)

The sprite is created at the tile position with an 8x8 offset to center it.

---

## Long Grass Animation Sprite

### Sprite Template
**Location**: `src/data/field_effects/field_effect_objects.h:637-645`

```c
const struct SpriteTemplate gFieldEffectObjectTemplate_LongGrass = {
    .tileTag = TAG_NONE,
    .paletteTag = FLDEFF_PAL_TAG_GENERAL_1,
    .oam = &gObjectEventBaseOam_16x16,
    .anims = sAnimTable_LongGrass,
    .images = sPicTable_LongGrass,
    .affineAnims = gDummySpriteAffineAnimTable,
    .callback = UpdateLongGrassFieldEffect,
};
```

### Animation Frames
**Location**: Lines 613-635

- **Size**: 16x16 pixels (2x2 tiles)
- **Frames**: 4 frames
- **Animation Sequence**:
  ```c
  ANIMCMD_FRAME(1, 3),   // Quick sway
  ANIMCMD_FRAME(2, 3),
  ANIMCMD_FRAME(0, 4),   // Idle
  ANIMCMD_FRAME(3, 4),   // Sway other direction
  ANIMCMD_FRAME(0, 4),   // Idle
  ANIMCMD_FRAME(3, 4),   // Sway again
  ANIMCMD_FRAME(0, 4),   // Return to idle
  ANIMCMD_END,
  ```
- **Total Duration**: 26 frames
- **Characteristics**: Faster, more erratic animation than tall grass

---

## Layering & Z-Order System

### Priority System
Both grass types use **priority = 2** (background priority for field effects).

### Subpriority Management
**Function**: `UpdateGrassFieldEffectSubpriority()` in `field_effect_helpers.c`

The subpriority determines rendering order among sprites with the same priority:
1. Base subpriority is calculated from elevation and position
2. The function iterates through all active object events
3. If a player/NPC sprite overlaps the grass sprite:
   - Grass sprite's subpriority is adjusted to render behind the player
   - Special handling ensures grass "parts" around the player's feet

**Tall Grass Subpriority Logic**:
- When animation is at frame index 0 (idle): subpriority += 4 (renders behind player more)
- Otherwise: subpriority stays normal (renders closer to player level)

This creates the visual effect of grass rustling **around** the player rather than always being completely behind or in front.

---

## The "Tall Grass Coverage" Effect

### How Long Grass Covers the Player

**THE KEY MECHANISM**: Subsprite Table Switching

**Function**: `SetObjectEventSpriteOamTableForLongGrass()` in `event_object_movement.c:7690-7705`

```c
static void SetObjectEventSpriteOamTableForLongGrass(struct ObjectEvent *objEvent, struct Sprite *sprite)
{
    if (objEvent->disableCoveringGroundEffects)
        return;

    if (!MetatileBehavior_IsLongGrass(objEvent->currentMetatileBehavior))
        return;

    if (!MetatileBehavior_IsLongGrass(objEvent->previousMetatileBehavior))
        return;

    sprite->subspriteTableNum = 4;  // Use "covered by grass" subsprite table

    if (ElevationToPriority(objEvent->previousElevation) == 1)
        sprite->subspriteTableNum = 5;  // Different coverage for elevated tiles
}
```

### What are Subsprite Tables?

In GBA Pokemon, large sprites (like 16x32 or 32x32) are composed of multiple 8x8 hardware sprites. The **subsprite table** defines:
- Which 8x8 tiles to show
- Their relative positions
- Which tiles to hide

**Normal rendering** (`subspriteTableNum = 0-3`):
- Shows full character sprite

**Long grass rendering** (`subspriteTableNum = 4`):
- **Hides the bottom half of the character sprite**
- Only shows top 16 pixels (upper body)
- This creates the illusion that the player is "inside" tall grass

**Elevated long grass** (`subspriteTableNum = 5`):
- Different coverage pattern for bridges/elevated areas

### Elevation-Based Subsprite Tables
**Data**: `sElevationToSubspriteTableNum` in `event_object_movement.c:7733-7735`

```c
static const u8 sElevationToSubspriteTableNum[] = {
    1, 1, 1, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 0, 0, 1,
};
```

This maps elevation values (0-15) to subsprite table numbers:
- Most elevations use table 1 or 2
- Elevation 13-14 (special cases) use table 0

---

## Update Loop

### Tall Grass Update
**Function**: `UpdateTallGrassFieldEffect()` in `field_effect_helpers.c:316-357`

Every frame:
1. Check if player is still on the tile (via x, y coordinates)
2. If player moved away, set `sObjectMoved = TRUE`
3. Once animation ends AND player moved, destroy the sprite
4. While active, update subpriority to maintain proper layering

### Long Grass Update
**Function**: `UpdateLongGrassFieldEffect()` in `field_effect_helpers.c:420-455`

Similar to tall grass but:
- Always uses subpriority offset of 0 (no frame-based adjustment)
- Simpler layering logic

---

## Animation Staying on Tile

The grass animation sprite **stays locked to the tile** through:

1. **Position Stored**: When created, stores map coordinates in sprite data:
   ```c
   sprite->sX = gFieldEffectArguments[0];  // Original tile X
   sprite->sY = gFieldEffectArguments[1];  // Original tile Y
   ```

2. **Map Tracking**: Stores current map info:
   ```c
   sprite->sCurrentMap = (mapNum << 8) | mapGroup;
   ```

3. **Camera Adjustment**: When camera moves (e.g., on map transitions):
   ```c
   if (gCamera.active && map changed) {
       sprite->sX -= gCamera.x;
       sprite->sY -= gCamera.y;
       // Update current map
   }
   ```

4. **Cleanup**: Sprite is destroyed when:
   - Player moves away from the tile
   - Animation completes
   - Player transitions to different metatile type
   - Object event becomes invalid

---

## React Implementation Plan

### 1. Data Structures

```typescript
interface GrassEffectSprite {
  id: string;
  x: number;  // Tile X coordinate
  y: number;  // Tile Y coordinate
  elevation: number;
  animationFrame: number;
  animationTick: number;
  type: 'tall' | 'long';
  isJumpImpact: boolean;
 objectEventId: string;  // Which player/NPC triggered this
  skipAnimation: boolean;  // True if spawned on tile
}
```

### 2. Grass Effect Manager

Create a `GrassEffectManager` class that:
- Tracks active grass effect sprites
- Creates new grass effects when player steps/spawns on grass tiles
- Updates animation frames (tick counter++)
- Removes completed animations
- Handles camera offset adjustments

### 3. Rendering Strategy

**Layer 1: Base Map Tiles** (z-index: 0)
- Normal tile rendering

**Layer 2: Grass Effect Sprites** (z-index: calculated)
- Render at tile position + 8px offset (center of tile)
- Use CSS position: absolute
- Calculate z-index based on:
  - Priority (2 for grass)
  - Subpriority (calculated from Y position + elevation)
  - Animation frame (frame 0 gets lower subpriority)

**Layer 3: Player Sprite** (z-index: calculated)
- Normal rendering OR modified rendering:
  - If on long grass: use CSS clipping or render only top half
  - Implement via `clip-path` or dual-layer rendering

### 4. Player Sprite Clipping for Long Grass

**Option A: CSS Clip Path**
```typescript
if (isOnLongGrass) {
  playerStyle.clipPath = 'inset(0 0 50% 0)';  // Show only top 50%
}
```

**Option B: Dual Layer Rendering** (More Accurate)
- Render player sprite in two parts:
  - Top half: Normal z-index (above grass)
  - Bottom half: Lower z-index (behind grass)
- This matches GBA subsprite table behavior exactly

### 5. Animation Tick System

Integrate with existing 60 FPS game loop:

```typescript
class GrassEffectManager {
  update() {
    this.grassEffects.forEach(effect => {
      effect.animationTick++;
      
      if (effect.type === 'tall') {
        // Tall grass: 5 frames, 10 ticks each
        const FRAME_DURATION = 10;
        const frameSequence = [1, 2, 3, 4, 0];
        if (effect.animationTick >= FRAME_DURATION) {
          effect.animationTick = 0;
          effect.animationFrame = (effect.animationFrame + 1) %frameSequence.length;
        }
      } else {
        // Long grass: different timing
        // ... implement long grass sequence
      }
    });
  }
}
```

### 6. Metatile Behavior Integration

Extend existing metatile behavior system:

```typescript
enum MetatileBehavior {
  MB_TALL_GRASS = 13,  // Or whatever ID
  MB_LONG_GRASS = 21,
  // ... other behaviors
}

function isTallGrass(behavior: number): boolean {
  return behavior === MetatileBehavior.MB_TALL_GRASS;
}

function isLongGrass(behavior: number): boolean {
  return behavior === MetatileBehavior.MB_LONG_GRASS;
}
```

### 7. Event Triggers

Hook into player movement state machine:

```typescript
class PlayerController {
  onEnterTile(x: number, y: number) {
    const behavior = this.getMetatileBehavior(x, y);
    
    if (isTallGrass(behavior) || isLongGrass(behavior)) {
      this.grassEffectManager.createGrassEffect({
        x, y,
        type: isTallGrass(behavior) ? 'tall' : 'long',
        skipAnimation: false,  // False for movement
        elevation: this.elevation,
        objectEventId: this.id
      });
    }
  }
  
  onSpawnOnTile(x: number, y: number) {
    const behavior = this.getMetatileBehavior(x, y);
    
    if (isTallGrass(behavior) || isLongGrass(behavior)) {
      this.grassEffectManager.createGrassEffect({
        x, y,
        type: isTallGrass(behavior) ? 'tall' : 'long',
        skipAnimation: true,  // True = jump to end frame
        elevation: this.elevation,
        objectEventId: this.id
      });
    }
  }
}
```

### 8. Sprite Assets

**Required Assets**:
- `tall_grass.png`: 5 frames of 16x16 grass animation (80x16 sprite sheet)
- `long_grass.png`: 4 frames of 16x16 grass animation (64x16 sprite sheet)

**Extraction from ROM**:
- Graphics are in `graphics/field_effects/pics/tall_grass.png` (pokeemerald repo)
- Graphics are in `graphics/field_effects/pics/long_grass.png`

### 9. Z-Index Calculation

Implement subpriority calculation:

```typescript
function calculateSubpriority(
  y: number,
  elevation: number,
  extraOffset: number
): number {
  // Mimics SetObjectSubpriorityByElevation from C code
  const elevationBase = ELEVATION_TO_SUBPRIORITY[elevation];
  const yComponent = (16 - (((y + 8) & 0xFF) >> 4)) * 2;
  return yComponent + elevationBase + extraOffset;
}

function calculateZIndex(priority: number, subpriority: number): number {
  // Higher priority = lower z-index (renders behind)
  // Lower subpriority = lower z-index (renders behind)
  return (3 - priority) * 1000 + (255 - subpriority);
}
```

### 10. Grass Effect Cleanup

```typescript
class GrassEffectManager {
  update() {
    this.grassEffects = this.grassEffects.filter(effect => {
      // Remove if animation completed and player moved
      if (effect.animationEnded) {
        const player = getObjectEvent(effect.objectEventId);
        const playerMoved = player.x !== effect.x || player.y !== effect.y;
        return !playerMoved;  // Remove if player moved
      }
      return true;  // Keep if animation ongoing
    });
  }
}
```

---

## Summary

| Feature | Tall Grass | Long Grass |
|---------|-----------|------------|
| **Metatile Behavior** | `MB_TALL_GRASS` | `MB_LONG_GRASS` |
| **Animation Frames** | 5 frames | 4 frames |
| **Frame Duration** | 10 ticks each | 3-4 ticks (varies) |
| **Total Animation Time** | 50 frames | 26 frames |
| **Running Allowed** | ✅ Yes | ❌ No |
| **Player Coverage** | None (grass behind player) | Bottom half covered |
| **Coverage Mechanism** | Priority/subpriority | **Subsprite table switching** |
| **Sprite Size** | 16x16 | 16x16 |
| **Priority** | 2 | 2 |
| **Subpriority Offset** | 0 or 4 (frame-dependent) | 0 (always) |

### Key Takeaway

The "tall grass covers player" effect in long grass is achieved by:
1. **NOT** rendering grass on top of player
2. **Instead**: Switching the player sprite's subsprite table to hide the bottom half
3. This makes it **look like** the grass is covering them when it's actually the player being partially hidden

For React implementation:
- Use CSS `clip-path` or dual-layer rendering for player sprite
- Manage grass animation sprites separately
- Calculate proper z-indices for layering
- Hook into player movement events to create/destroy grass effects
