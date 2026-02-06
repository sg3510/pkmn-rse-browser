---
title: Special Field Effects
status: reference
last_verified: 2026-01-13
---

# Special Field Effects

This document describes special field effects in Pokemon Emerald that are not yet implemented in the React codebase, including ash grass, ice puzzles, and other per-step callbacks.

## Overview

Pokemon Emerald has several special terrain effects that modify metatiles as the player walks:

1. **Ash Grass** (Route 113) - Ash-covered grass that reveals normal grass when stepped on
2. **Cracked Ice** (Sootopolis Gym) - Ice that cracks and breaks when stepped on
3. **Fortree Bridges** - Log bridges that depress when stepped on
4. **Pacifidlog Bridges** - Floating logs that submerge when stepped on
5. **Cracked Floor** (Sky Pillar) - Floors that crack and create holes

## Source Code Reference

### Key Files in `public/pokeemerald/`
- `src/field_tasks.c` - Per-step callback implementations
- `src/field_effect_helpers.c` - Field effect sprite creation
- `src/metatile_behavior.c` - Metatile behavior flags
- `include/constants/metatile_behaviors.h` - Behavior constants
- `include/constants/field_tasks.h` - Step callback IDs

## Per-Step Callback System

The game maintains a task that runs every frame and calls registered callbacks:

```c
// From field_tasks.c
static const TaskFunc sPerStepCallbacks[] = {
    [STEP_CB_DUMMY]             = DummyPerStepCallback,
    [STEP_CB_ASH]               = AshGrassPerStepCallback,
    [STEP_CB_FORTREE_BRIDGE]    = FortreeBridgePerStepCallback,
    [STEP_CB_PACIFIDLOG_BRIDGE] = PacifidlogBridgePerStepCallback,
    [STEP_CB_SOOTOPOLIS_ICE]    = SootopolisGymIcePerStepCallback,
    [STEP_CB_TRUCK]             = EndTruckSequence,
    [STEP_CB_SECRET_BASE]       = SecretBasePerStepCallback,
    [STEP_CB_CRACKED_FLOOR]     = CrackedFloorPerStepCallback
};

// Main task - runs every frame
static void Task_RunPerStepCallback(u8 taskId) {
    int idx = gTasks[taskId].tCallbackId;
    sPerStepCallbacks[idx](taskId);
}
```

Maps activate specific callbacks via `ActivatePerStepCallback(callbackId)`.

---

## Ash Grass System (Route 113)

### Overview

Route 113 features volcanic ash that covers grass tiles. When the player walks through:
1. The ash-covered grass metatile is replaced with normal grass
2. An "ash puff" field effect sprite appears
3. If the player has a Soot Sack, ash is collected

### Metatile Behavior

```c
// Metatile behavior flag
[MB_ASHGRASS] = TILE_FLAG_UNUSED | TILE_FLAG_HAS_ENCOUNTERS
```

### C Implementation

```c
// From field_tasks.c:748-777
static void AshGrassPerStepCallback(u8 taskId) {
    s16 x, y;
    u16 *ashGatherCount;
    s16 *data = gTasks[taskId].data;
    PlayerGetDestCoords(&x, &y);

    // End if player hasn't moved
    if (x == tPrevX && y == tPrevY)
        return;

    tPrevX = x;
    tPrevY = y;

    if (MetatileBehavior_IsAshGrass(MapGridGetMetatileBehaviorAt(x, y))) {
        // Remove ash from grass - replace with normal grass metatile
        if (MapGridGetMetatileIdAt(x, y) == METATILE_Fallarbor_AshGrass)
            StartAshFieldEffect(x, y, METATILE_Fallarbor_NormalGrass, 4);
        else
            StartAshFieldEffect(x, y, METATILE_Lavaridge_NormalGrass, 4);

        // Collect ash if player has Soot Sack
        if (CheckBagHasItem(ITEM_SOOT_SACK, 1)) {
            ashGatherCount = GetVarPointer(VAR_ASH_GATHER_COUNT);
            if (*ashGatherCount < 9999)
                (*ashGatherCount)++;
        }
    }
}
```

### StartAshFieldEffect Function

```c
// Creates the "puff" sprite and modifies the metatile
void StartAshFieldEffect(s16 x, s16 y, u16 replacementMetatile, u8 delay) {
    // Arguments for field effect creation
    gFieldEffectArguments[0] = x;
    gFieldEffectArguments[1] = y;
    gFieldEffectArguments[2] = 82;     // Priority
    gFieldEffectArguments[3] = 1;      // OAM priority
    gFieldEffectArguments[4] = replacementMetatile;
    gFieldEffectArguments[5] = delay;  // Frames before metatile change

    // Create ash puff field effect
    FieldEffectStart(FLDEFF_ASH);
}
```

### FldEff_Ash Implementation

```c
// From field_effect_helpers.c:926-945
u32 FldEff_Ash(void) {
    u8 spriteId;
    s16 x = gFieldEffectArguments[0];
    s16 y = gFieldEffectArguments[1];

    SetSpritePosToOffsetMapCoords(&x, &y, 8, 8);
    spriteId = CreateSpriteAtEnd(
        gFieldEffectObjectTemplatePointers[FLDEFFOBJ_ASH],
        x, y,
        gFieldEffectArguments[2]
    );

    if (spriteId != MAX_SPRITES) {
        struct Sprite *sprite = &gSprites[spriteId];
        sprite->coordOffsetEnabled = TRUE;
        sprite->oam.priority = gFieldEffectArguments[3];
        sprite->sX = gFieldEffectArguments[0];
        sprite->sY = gFieldEffectArguments[1];
        sprite->sMetatileId = gFieldEffectArguments[4];
        sprite->sDelay = gFieldEffectArguments[5];
    }
    return 0;
}
```

### Ash Sprite Animation

The ash puff sprite plays an animation and then modifies the metatile:

```c
// Animation callback (simplified)
static void UpdateAshFieldEffect(struct Sprite *sprite) {
    // Wait for animation to complete
    if (sprite->animEnded) {
        // Change the metatile
        MapGridSetMetatileIdAt(sprite->sX, sprite->sY, sprite->sMetatileId);
        CurrentMapDrawMetatileAt(sprite->sX, sprite->sY);
        DestroySprite(sprite);
    }
}
```

### Ash Weather Effect

Route 113 also has falling ash particles as a weather effect:

```c
// Weather type for volcanic ash
#define WEATHER_VOLCANIC_ASH 7

// Creates ash particle sprites that fall across screen
void Ash_InitAll(void) {
    Ash_InitVars();
    while (gWeatherPtr->weatherGfxLoaded == FALSE)
        Ash_Main();
}
```

---

## Sootopolis Gym Ice System

### Overview

The ice puzzle in Sootopolis Gym requires stepping on each ice tile exactly once:
1. First step: Ice cracks (visual change)
2. Second step: Ice breaks, creates hole (impassable)

### Tracking System

Uses temporary variables to track which tiles have been stepped on:

```c
// Each row of ice has a temp var, bits represent X coordinates
static const u16 sSootopolisGymIceRowVars[] = {
    0, 0, 0, 0, 0, 0,          // Non-ice rows
    VAR_TEMP_1,                 // Row 6
    VAR_TEMP_2,                 // Row 7
    VAR_TEMP_3,                 // Row 8
    // ... etc
};
```

### Implementation

```c
static void SootopolisGymIcePerStepCallback(u8 taskId) {
    s16 x, y;
    u16 behavior;
    s16 *data = gTasks[taskId].data;

    PlayerGetDestCoords(&x, &y);
    behavior = MapGridGetMetatileBehaviorAt(x, y);

    // Track ice stepping
    if (MetatileBehavior_IsThinIce(behavior)) {
        u16 *varPtr = GetVarPointer(sSootopolisGymIceRowVars[y]);
        u16 bit = 1 << (x - LEFT_EDGE);

        if (*varPtr & bit) {
            // Second step - break ice
            SetIceHoleMetatile(x, y);
        } else {
            // First step - crack ice
            SetCrackedIceMetatile(x, y);
            *varPtr |= bit;
        }
    }
}
```

---

## Fortree Bridge System

### Overview

The log bridges in Fortree City depress when stepped on and return to normal when left.

### Implementation

```c
static void FortreeBridgePerStepCallback(u8 taskId) {
    s16 x, y;
    s16 *data = gTasks[taskId].data;

    PlayerGetDestCoords(&x, &y);

    if (x == tPrevX && y == tPrevY)
        return;

    // Restore previous bridge tile
    if (tPrevBridgeType != 0) {
        SetFloatingBridgeMetatile(tPrevX, tPrevY, tPrevBridgeType);
    }

    // Depress current bridge tile
    u8 bridgeType = GetBridgeType(x, y);
    if (bridgeType != 0) {
        SetDepressedBridgeMetatile(x, y, bridgeType);
        tPrevBridgeType = bridgeType;
    }

    tPrevX = x;
    tPrevY = y;
}
```

---

## Pacifidlog Bridge System

### Overview

The floating log platforms in Pacifidlog Town submerge in a sequence:
1. Normal → Half submerged → Fully submerged

### Metatile Offsets

```c
// Pairs of metatiles for each bridge orientation
static const struct PacifidlogMetatileOffsets sHalfSubmergedBridgeMetatileOffsets[] = {
    { 0,  0, METATILE_Pacifidlog_HalfSubmergedLogs_VerticalTop},
    { 0,  1, METATILE_Pacifidlog_HalfSubmergedLogs_VerticalBottom},
    // ...
};

static const struct PacifidlogMetatileOffsets sFullySubmergedBridgeMetatileOffsets[] = {
    { 0,  0, METATILE_Pacifidlog_SubmergedLogs_VerticalTop},
    { 0,  1, METATILE_Pacifidlog_SubmergedLogs_VerticalBottom},
    // ...
};
```

---

## Cracked Floor System (Sky Pillar)

### Overview

Sky Pillar has floors that crack and break with a delay after stepping:

```c
static void CrackedFloorPerStepCallback(u8 taskId) {
    s16 x, y;
    u16 behavior;
    s16 *data = gTasks[taskId].data;

    PlayerGetDestCoords(&x, &y);
    behavior = MapGridGetMetatileBehaviorAt(x, y);

    // Process delayed floor breaks
    if (tFloor1Delay != 0 && (--tFloor1Delay) == 0)
        SetCrackedFloorHoleMetatile(tFloor1X, tFloor1Y);
    if (tFloor2Delay != 0 && (--tFloor2Delay) == 0)
        SetCrackedFloorHoleMetatile(tFloor2X, tFloor2Y);

    if (x == tPrevX && y == tPrevY)
        return;

    tPrevX = x;
    tPrevY = y;

    if (MetatileBehavior_IsCrackedFloor(behavior)) {
        // Queue this tile to break after delay
        tFloor2Delay = tFloor1Delay;
        tFloor2X = tFloor1X;
        tFloor2Y = tFloor1Y;
        tFloor1Delay = 3;  // Break after 3 frames
        tFloor1X = x;
        tFloor1Y = y;

        VarSet(VAR_ICE_STEP_COUNT, VarGet(VAR_ICE_STEP_COUNT) + 1);
    }
}
```

---

## Proposed React Implementation

### Architecture

```
src/
├── field-effects/
│   ├── PerStepCallbackManager.ts   # Main callback coordinator
│   ├── callbacks/
│   │   ├── AshGrassCallback.ts     # Route 113 ash
│   │   ├── IceFloorCallback.ts     # Sootopolis Gym
│   │   ├── FortreeBridgeCallback.ts
│   │   ├── PacifidlogBridgeCallback.ts
│   │   └── CrackedFloorCallback.ts
│   ├── effects/
│   │   ├── AshPuffEffect.ts        # Ash puff sprite
│   │   └── IceCrackEffect.ts       # Ice crack visuals
│   └── MetatileModifier.ts         # Dynamic metatile changes
```

### PerStepCallbackManager

```typescript
type StepCallbackType =
  | 'STEP_CB_DUMMY'
  | 'STEP_CB_ASH'
  | 'STEP_CB_FORTREE_BRIDGE'
  | 'STEP_CB_PACIFIDLOG_BRIDGE'
  | 'STEP_CB_SOOTOPOLIS_ICE'
  | 'STEP_CB_CRACKED_FLOOR';

interface StepCallback {
  type: StepCallbackType;
  update(playerX: number, playerY: number, deltaMs: number): void;
  reset(): void;
}

class PerStepCallbackManager {
  private activeCallback: StepCallback | null = null;
  private callbacks: Map<StepCallbackType, StepCallback>;
  private prevX: number = 0;
  private prevY: number = 0;

  constructor(metatileModifier: MetatileModifier) {
    this.callbacks = new Map([
      ['STEP_CB_ASH', new AshGrassCallback(metatileModifier)],
      ['STEP_CB_SOOTOPOLIS_ICE', new IceFloorCallback(metatileModifier)],
      // ... other callbacks
    ]);
  }

  // Activate callback for current map
  activateCallback(type: StepCallbackType): void {
    this.activeCallback = this.callbacks.get(type) || null;
    this.activeCallback?.reset();
  }

  // Called every frame
  update(playerX: number, playerY: number): void {
    if (!this.activeCallback) return;

    // Only process on position change
    if (playerX !== this.prevX || playerY !== this.prevY) {
      this.activeCallback.update(playerX, playerY, 0);
      this.prevX = playerX;
      this.prevY = playerY;
    }
  }
}
```

### AshGrassCallback

```typescript
// Metatile IDs for ash grass
const METATILE_FALLARBOR_ASH_GRASS = 0x208;  // Example ID
const METATILE_FALLARBOR_NORMAL_GRASS = 0x209;
const METATILE_LAVARIDGE_ASH_GRASS = 0x20A;
const METATILE_LAVARIDGE_NORMAL_GRASS = 0x20B;

class AshGrassCallback implements StepCallback {
  type: StepCallbackType = 'STEP_CB_ASH';

  private metatileModifier: MetatileModifier;
  private effectManager: FieldEffectManager;
  private ashCount: number = 0;
  private hasSootSack: boolean = false;

  constructor(
    metatileModifier: MetatileModifier,
    effectManager: FieldEffectManager
  ) {
    this.metatileModifier = metatileModifier;
    this.effectManager = effectManager;
  }

  setHasSootSack(has: boolean): void {
    this.hasSootSack = has;
  }

  getAshCount(): number {
    return this.ashCount;
  }

  update(playerX: number, playerY: number): void {
    const metatileId = this.metatileModifier.getMetatileId(playerX, playerY);
    const behavior = this.metatileModifier.getBehavior(playerX, playerY);

    // Check if this is ash grass
    if (!this.isAshGrassBehavior(behavior)) {
      return;
    }

    // Determine replacement metatile
    let replacementId: number;
    if (metatileId === METATILE_FALLARBOR_ASH_GRASS) {
      replacementId = METATILE_FALLARBOR_NORMAL_GRASS;
    } else {
      replacementId = METATILE_LAVARIDGE_NORMAL_GRASS;
    }

    // Create ash puff effect
    this.effectManager.createAshPuff(playerX, playerY, () => {
      // After animation, change metatile
      this.metatileModifier.setMetatile(playerX, playerY, replacementId);
    });

    // Collect ash if player has Soot Sack
    if (this.hasSootSack && this.ashCount < 9999) {
      this.ashCount++;
    }
  }

  private isAshGrassBehavior(behavior: number): boolean {
    return behavior === MB_ASHGRASS;  // 0x18
  }

  reset(): void {
    // Ash count persists across map changes
  }
}
```

### MetatileModifier

```typescript
interface ModifiedMetatile {
  x: number;
  y: number;
  originalId: number;
  currentId: number;
}

class MetatileModifier {
  private mapManager: MapManager;
  private modifications: Map<string, ModifiedMetatile> = new Map();

  constructor(mapManager: MapManager) {
    this.mapManager = mapManager;
  }

  getMetatileId(x: number, y: number): number {
    const key = `${x},${y}`;
    const mod = this.modifications.get(key);
    if (mod) {
      return mod.currentId;
    }
    return this.mapManager.getMetatileIdAt(x, y);
  }

  getBehavior(x: number, y: number): number {
    const metatileId = this.getMetatileId(x, y);
    return this.mapManager.getBehaviorForMetatile(metatileId);
  }

  setMetatile(x: number, y: number, newId: number): void {
    const key = `${x},${y}`;
    const existing = this.modifications.get(key);

    this.modifications.set(key, {
      x,
      y,
      originalId: existing?.originalId ?? this.mapManager.getMetatileIdAt(x, y),
      currentId: newId
    });

    // Trigger re-render of this tile
    this.mapManager.invalidateTile(x, y);
  }

  // Reset all modifications (map change)
  reset(): void {
    this.modifications.clear();
  }

  // Get modified tiles for rendering
  getModifications(): ModifiedMetatile[] {
    return Array.from(this.modifications.values());
  }
}
```

### IceFloorCallback

```typescript
interface IceRowTracker {
  varId: string;
  stepped: Set<number>;  // X coordinates stepped on
}

class IceFloorCallback implements StepCallback {
  type: StepCallbackType = 'STEP_CB_SOOTOPOLIS_ICE';

  private metatileModifier: MetatileModifier;
  private rowTrackers: Map<number, IceRowTracker> = new Map();

  // Row Y coordinates that have ice
  private static readonly ICE_ROWS = [6, 7, 8, 12, 13, 14, 17, 18, 19];

  constructor(metatileModifier: MetatileModifier) {
    this.metatileModifier = metatileModifier;
  }

  reset(): void {
    this.rowTrackers.clear();
    for (const y of IceFloorCallback.ICE_ROWS) {
      this.rowTrackers.set(y, {
        varId: `VAR_TEMP_${y - 5}`,
        stepped: new Set()
      });
    }
  }

  update(playerX: number, playerY: number): void {
    const behavior = this.metatileModifier.getBehavior(playerX, playerY);

    if (!this.isThinIceBehavior(behavior)) {
      return;
    }

    const tracker = this.rowTrackers.get(playerY);
    if (!tracker) return;

    if (tracker.stepped.has(playerX)) {
      // Second step - break ice
      this.breakIce(playerX, playerY);
    } else {
      // First step - crack ice
      this.crackIce(playerX, playerY);
      tracker.stepped.add(playerX);
    }
  }

  private crackIce(x: number, y: number): void {
    // Change to cracked ice metatile
    this.metatileModifier.setMetatile(x, y, METATILE_ICE_CRACKED);
  }

  private breakIce(x: number, y: number): void {
    // Change to hole metatile (impassable)
    this.metatileModifier.setMetatile(x, y, METATILE_ICE_HOLE);
  }

  private isThinIceBehavior(behavior: number): boolean {
    return behavior === MB_THIN_ICE;
  }
}
```

### AshPuff Field Effect

```typescript
// Add to FieldEffectManager (extends existing implementation)

interface AshPuffEffect extends FieldEffect {
  type: 'ash_puff';
  onComplete: () => void;
}

// Animation sequence for ash puff
const ASH_PUFF_ANIMATION = [0, 1, 2, 3];  // Frame indices
const ASH_PUFF_TICKS_PER_FRAME = 4;

class FieldEffectManager {
  // Existing code...

  createAshPuff(
    tileX: number,
    tileY: number,
    onComplete: () => void
  ): string {
    const id = `ash_puff_${this.nextId++}`;

    const effect: AshPuffEffect = {
      id,
      tileX,
      tileY,
      animationFrame: 0,
      sequenceIndex: 0,
      animationTick: 0,
      type: 'ash_puff',
      skipAnimation: false,
      ownerObjectId: 'player',
      completed: false,
      visible: true,
      onComplete
    };

    this.effects.set(id, effect);
    return id;
  }

  // In update method, add ash_puff handling:
  private updateAshPuff(effect: AshPuffEffect, ticksElapsed: number): void {
    effect.animationTick += ticksElapsed;

    while (effect.animationTick >= ASH_PUFF_TICKS_PER_FRAME && !effect.completed) {
      effect.animationTick -= ASH_PUFF_TICKS_PER_FRAME;

      if (effect.sequenceIndex < ASH_PUFF_ANIMATION.length - 1) {
        effect.sequenceIndex++;
        effect.animationFrame = ASH_PUFF_ANIMATION[effect.sequenceIndex];
      } else {
        effect.completed = true;
        effect.onComplete();  // Trigger metatile change
      }
    }
  }
}
```

### Integration with Rendering

```typescript
// In LayerRenderer or MapRenderer

function renderModifiedMetatiles(
  ctx: CanvasRenderingContext2D,
  metatileModifier: MetatileModifier,
  viewport: Viewport
): void {
  for (const mod of metatileModifier.getModifications()) {
    // Check if in viewport
    if (!isInViewport(mod.x, mod.y, viewport)) continue;

    // Get metatile graphics for modified ID
    const metatile = tilesetManager.getMetatile(mod.currentId);

    // Render at world position
    const screenX = (mod.x * 16) - viewport.x;
    const screenY = (mod.y * 16) - viewport.y;

    renderMetatile(ctx, metatile, screenX, screenY);
  }
}
```

## Implementation Priority

1. **Phase 1**: MetatileModifier infrastructure
   - Track metatile changes
   - Integrate with rendering
   - Save/restore state

2. **Phase 2**: Ash Grass (Route 113)
   - Detect MB_ASHGRASS behavior
   - Metatile replacement
   - Ash puff effect sprite
   - Soot Sack collection counter

3. **Phase 3**: Ice Floor (Sootopolis Gym)
   - Per-row step tracking
   - Cracked ice visual
   - Hole creation
   - Reset on exit

4. **Phase 4**: Fortree/Pacifidlog Bridges
   - Bridge depression
   - Submersion animation
   - Auto-restore when leaving

5. **Phase 5**: Cracked Floor (Sky Pillar)
   - Delayed hole creation
   - Queue system for pending breaks

## Sprite Assets

Field effect sprites in `public/pokeemerald/graphics/field_effects/`:

| Effect | File | Frames | Size |
|--------|------|--------|------|
| Ash puff | `ash.4bpp` | 4 | 16x16 |
| Ash launch | `ash_launch.4bpp` | 4 | 16x32 |
| Footprints | `footprints.4bpp` | 2 | 16x16 |
| Dust | `ground_impact_dust.4bpp` | 4 | 16x16 |

## Metatile Behavior Constants

From `constants/metatile_behaviors.h`:

| Constant | Value | Description |
|----------|-------|-------------|
| `MB_ASHGRASS` | 0x18 | Ash-covered grass |
| `MB_THIN_ICE` | 0x1A | Gym ice (cracks) |
| `MB_CRACKED_ICE` | 0x1B | Cracked ice |
| `MB_HOT_SPRINGS` | 0x1C | Hot springs |
| `MB_CRACKED_FLOOR` | 0x50 | Sky Pillar floor |
| `MB_FORTREE_BRIDGE` | 0x52 | Log bridge |
