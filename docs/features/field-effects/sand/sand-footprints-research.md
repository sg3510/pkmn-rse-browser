---
title: Sand Footprints Deep Research - pokeemerald C Code Analysis
status: research
last_verified: 2026-01-13
---

# Sand Footprints Deep Research - pokeemerald C Code Analysis

## Critical Findings

### 1. **Timing: Footprints Appear on PREVIOUS Tile**

**File**: `event_object_movement.c:7899-7904`

```c
gFieldEffectArguments[0] = objEvent->previousCoords.x;  // PREVIOUS position!
gFieldEffectArguments[1] = objEvent->previousCoords.y;
gFieldEffectArguments[2] = 149;  // elevation
gFieldEffectArguments[3] = 2;    // priority
gFieldEffectArguments[4] = objEvent->facingDirection;  // Direction for frame selection!
FieldEffectStart(sandFootprints_FieldEffectData[isDeepSand]);
```

**Key**: Footprints are created at `previousCoords`, NOT current coords!
- When you move FROM tile A TO tile B
- Footprint appears on tile A (where you were)
- This is OPPOSITE of grass (grass triggers on destination tile)

### 2. **Trigger Condition: Previous Tile**

**File**: `event_object_movement.c:7480-7487`

```c
static void GetGroundEffectFlags_Tracks(struct ObjectEvent *objEvent, u32 *flags)
{
    if (MetatileBehavior_IsDeepSand(objEvent->previousMetatileBehavior))
        *flags |= GROUND_EFFECT_FLAG_DEEP_SAND;
    else if (MetatileBehavior_IsSandOrDeepSand(objEvent->previousMetatileBehavior)
             || MetatileBehavior_IsFootprints(objEvent->previousMetatileBehavior))
        *flags |= GROUND_EFFECT_FLAG_SAND;
}
```

**Key**: Checks `previousMetatileBehavior`, not current!

### 3. **Directional Frames**

**File**: `field_effect_objects.h:367-374`

```c
static const union AnimCmd *const sAnimTable_SandFootprints[] =
{
    sSandFootprintsAnim_South,    // Index 0: DIR_SOUTH
    sSandFootprintsAnim_South,    // Index 1: DIR_NORTH (but still uses South anim)
    sSandFootprintsAnim_North,    // Index 2: DIR_UP
    sSandFootprintsAnim_West,     // Index 3: DIR_LEFT (frame 1)
    sSandFootprintsAnim_East,     // Index 4: DIR_RIGHT (frame 1, h-flipped)
};
```

**Frame mapping**:
- **DIR_SOUTH (1)**: Frame 0
- **DIR_NORTH (2)**: Frame 0 (different anim, but still frame 0)
- **DIR_WEST (3)**: Frame 1
- **DIR_EAST (4)**: Frame 1 with h-flip

**Actual frames in sprite**:
- Frame 0: Vertical footprints (North/South)
- Frame 1: Horizontal footprints (East/West)

### 4. **Lifecycle & Fading**

**File**: `field_effect_helpers.c:615-631`

```c
static void FadeFootprintsTireTracks_Step0(struct Sprite *sprite)
{
    // Wait 40 frames before the flickering starts.
    if (++sprite->sTimer > 40)
        sprite->sState = 1;
    UpdateObjectEventSpriteInvisibility(sprite, FALSE);
}

static void FadeFootprintsTireTracks_Step1(struct Sprite *sprite)
{
    sprite->invisible ^= 1;  // Toggle visibility
    sprite->sTimer++;
    UpdateObjectEventSpriteInvisibility(sprite, sprite->invisible);
    if (sprite->sTimer > 56)
        FieldEffectStop(sprite, sprite->sFldEff);
}
```

**Timing**:
- Frames 0-40: Visible (static)
- Frames 41-56: Flicker (toggle every frame)
- Frame 57+: Removed

## Implementation Bugs in Current Code

### Bug 1: Wrong Trigger Time ❌
**Current**: Triggers on destination tile when movement starts  
**Correct**: Should trigger on source tile when movement completes

### Bug 2: No Direction Support ❌
**Current**: Always uses frame 0  
**Correct**: Should select frame based on facingDirection

### Bug 3: Wrong Position ❌
**Current**: Creates effect at current tile  
**Correct**: Should create at previous tile

### Bug 4: Trigger on Current Tile ❌
**Current**: Checks current tile behavior  
**Correct**: Should check previous tile behavior

## Correct Implementation Plan

### Step 1: Track Previous Tile
PlayerController needs to track:
```typescript
private prevTileX: number;
private prevTileY: number;
private prevTileBehavior: number | undefined;
```

### Step 2: Trigger After Movement
In `processMovement()`, when movement completes (pixelsMoved >= TILE_PIXELS):
```typescript
// Check if we just left a sand tile
if (this.prevTileBehavior === MB_SAND || this.prevTileBehavior === MB_DEEP_SAND) {
  // Create footprint on the tile we just left
  const type = this.prevTileBehavior === MB_DEEP_SAND ? 'deep_sand' : 'sand';
  this.grassEffectManager.create(
    this.prevTileX,
    this.prevTileY,
    type,
    false,  // don't skip animation
    'player',
    this.dir  // PASS DIRECTION!
  );
}
```

### Step 3: Update Effect Manager
Add direction parameter:
```typescript
create(
  tileX: number,
  tileY: number,
  type: 'tall' | 'long' | 'sand' | 'deep_sand',
  skipAnimation: boolean,
  ownerObjectId: string,
  direction?: 'up' | 'down' | 'left' | 'right'  // NEW!
): string
```

### Step 4: Select Correct Frame
Map direction to frame:
```typescript
const directionToFrame = {
  'down': 0,   // South - vertical
  'up': 0,     // North - vertical (same frame)
  'left': 1,   // West - horizontal
  'right': 1   // East - horizontal
};
```

### Step 5: Handle Flipping
For East direction, render with horizontal flip:
```typescript
const shouldFlip = type === 'sand' && direction === 'right';
```

## Key Differences: Grass vs Sand

| Aspect | Grass | Sand |
|--------|-------|------|
| **Trigger Tile** | Destination (current) | Source (previous) |
| **Trigger Time** | Start of movement | End of movement |
| **Direction** | No directional frames | 4-directional frames |
| **Purpose** | Show plant rustling | Show footprints left behind |

## Animation Table Indices

pokeemerald uses weird indexing. Here's the mapping:

| facingDirection | Value | Animation Index | Frame | Flip |
|-----------------|-------|-----------------|-------|------|
| DIR_SOUTH | 1 | 0 or 1 | 0 | No |
| DIR_NORTH | 2 | 2 | 0 | No |
| DIR_WEST | 3 | 3 | 1 | No |
| DIR_EAST | 4 | 4 | 1 | Yes |

Our React directions ('up', 'down', 'left', 'right') need to map accordingly.
