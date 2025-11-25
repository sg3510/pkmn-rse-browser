# Water Ground Effects - Deep Dive Investigation

This document investigates the pokeemerald C code for water-related ground effects (RIPPLES and SPLASH), documenting exact timing, animation frames, trigger conditions, and a refactor plan for integrating them into a unified `FieldEffectManager`.

## IMPORTANT: Two Different Effects!

There are **TWO DISTINCT** water-related ground effects that are often confused:

| Effect | ID | Trigger | Sprite | Size | Duration | Behavior |
|--------|-----|---------|--------|------|----------|----------|
| **RIPPLES** | `FLDEFF_RIPPLE` | Surfing on water (`MB_POND_WATER`, `MB_PUDDLE`, `MB_SOOTOPOLIS_DEEP_WATER`) | `ripple.png` | 16x16 (5 frames) | 79 ticks (~1.32s) | Stays in place |
| **SPLASH** | `FLDEFF_SPLASH` | Walking in puddle (BOTH tiles must be `MB_PUDDLE`) | `splash.png` | 16x8 (2 frames) | 8 ticks (~133ms) | Follows player |

- **Sootopolis water** (`0x10` = `MB_POND_WATER`) triggers **RIPPLES**, not splash!
- **Puddle splash** only triggers when walking WITHIN a puddle area (both current and previous tiles are `MB_PUDDLE`)

## Table of Contents
1. [Metatile Behavior](#metatile-behavior)
2. [Puddle Detection Logic](#puddle-detection-logic)
3. [Trigger Conditions - Walking vs Surfing](#trigger-conditions---walking-vs-surfing)
4. [Splash Animation Data](#splash-animation-data)
5. [Jump Splash Effects](#jump-splash-effects)
6. [Sound Effects](#sound-effects)
7. [Sprite Positioning](#sprite-positioning)
8. [React Refactor Plan](#react-refactor-plan)

---

## Metatile Behavior

**Source File:** `public/pokeemerald/include/constants/metatile_behaviors.h`

```c
#define MB_PUDDLE 22  // 0x16
```

Puddles are distinct from shallow water (`MB_SHALLOW_WATER = 23`) and deep water tiles. The key difference:
- **MB_PUDDLE (22)**: Walkable, causes splash effect
- **MB_SHALLOW_WATER (23)**: Blocks walking, requires surf

Puddles are also treated as **reflective surfaces** alongside:
- `MB_POND_WATER (16)`
- `MB_ICE (32)`
- `MB_SOOTOPOLIS_DEEP_WATER (20)`
- `MB_REFLECTION_UNDER_BRIDGE (43)`

**Our React code already has this:** `src/utils/metatileBehaviors.ts:13`
```typescript
export const MB_PUDDLE = 22;
```

---

## Puddle Detection Logic

**Source File:** `public/pokeemerald/src/metatile_behavior.c`

```c
bool8 MetatileBehavior_IsPuddle(u8 metatileBehavior)
{
    if (metatileBehavior == MB_PUDDLE)
        return TRUE;
    else
        return FALSE;
}
```

**Ground Effect Flag Check:**

**Source File:** `public/pokeemerald/src/event_object_movement.c` (~line 7520)

```c
#define GROUND_EFFECT_FLAG_PUDDLE (1 << 10)  // Bit 10 = 1024

static void GetGroundEffectFlags_Puddle(struct ObjectEvent *objEvent, u32 *flags)
{
    if (MetatileBehavior_IsPuddle(objEvent->currentMetatileBehavior)
        && MetatileBehavior_IsPuddle(objEvent->previousMetatileBehavior))
        *flags |= GROUND_EFFECT_FLAG_PUDDLE;
}
```

### CRUCIAL DETAIL: Dual-Tile Check

The puddle splash is **only triggered when BOTH**:
1. **Current tile** is MB_PUDDLE (22)
2. **Previous tile** is ALSO MB_PUDDLE (22)

This means:
- **Entering a puddle from dry ground**: NO splash
- **Walking within a puddle area**: Splash on every step
- **Exiting a puddle onto dry ground**: NO splash

This is different from grass effects which trigger when entering the tile.

---

## Trigger Conditions - Walking vs Surfing

### Walking Trigger

**Source File:** `public/pokeemerald/src/event_object_movement.c` (~line 7939)

```c
void GroundEffect_StepOnPuddle(struct ObjectEvent *objEvent, struct Sprite *sprite)
{
    StartFieldEffectForObjectEvent(FLDEFF_SPLASH, objEvent);
}
```

Called when `GROUND_EFFECT_FLAG_PUDDLE` is set in the ground effects mask.

### Surfing / Jump Triggers

When jumping into or out of water, different splash effects are used:

| Action | Effect | Constant |
|--------|--------|----------|
| Jump onto shallow water | Small splash | `FLDEFF_JUMP_SMALL_SPLASH = 16` |
| Jump onto deep water | Big splash | `FLDEFF_JUMP_BIG_SPLASH = 14` |
| Walking in puddle | Normal splash | `FLDEFF_SPLASH = 15` |

**Jump trigger functions:**

```c
// Line ~7979
void GroundEffect_JumpOnShallowWater(struct ObjectEvent *objEvent, struct Sprite *sprite)
{
    gFieldEffectArguments[0] = objEvent->currentCoords.x;
    gFieldEffectArguments[1] = objEvent->currentCoords.y;
    gFieldEffectArguments[2] = objEvent->previousElevation;
    gFieldEffectArguments[3] = sprite->oam.priority;
    FieldEffectStart(FLDEFF_JUMP_SMALL_SPLASH);
}

// Line ~7988
void GroundEffect_JumpOnWater(struct ObjectEvent *objEvent, struct Sprite *sprite)
{
    gFieldEffectArguments[0] = objEvent->currentCoords.x;
    gFieldEffectArguments[1] = objEvent->currentCoords.y;
    gFieldEffectArguments[2] = objEvent->previousElevation;
    gFieldEffectArguments[3] = sprite->oam.priority;
    FieldEffectStart(FLDEFF_JUMP_BIG_SPLASH);
}
```

---

## Splash Animation Data

**Source File:** `public/pokeemerald/src/data/field_effects/field_effect_objects.h` (lines 543-582)

### Sprite Sheet

```c
static const struct SpriteFrameImage sPicTable_Splash[] = {
    overworld_frame(gFieldEffectObjectPic_Splash, 2, 1, 0),  // Frame 0
    overworld_frame(gFieldEffectObjectPic_Splash, 2, 1, 1),  // Frame 1
};
```

- **Graphics file:** `graphics/field_effects/pics/splash.png`
- **Dimensions:** 2x1 tiles = **32x16 pixels** total (16x8 per frame after OAM)
- **Frame count:** 2 frames
- **OAM template:** `gObjectEventBaseOam_16x8` (16 width x 8 height display)
- **Palette:** `FLDEFF_PAL_TAG_GENERAL_0`

### Animation Sequences

**Animation 0 - Walking Splash (One-shot):**

```c
static const union AnimCmd sAnim_Splash_0[] =
{
    ANIMCMD_FRAME(0, 4),   // Frame 0 for 4 ticks
    ANIMCMD_FRAME(1, 4),   // Frame 1 for 4 ticks
    ANIMCMD_END,           // Total: 8 ticks
};
```

| Step | Frame | Duration (ticks) | Duration (ms @ 60fps) |
|------|-------|------------------|----------------------|
| 1 | 0 | 4 | 66.67 |
| 2 | 1 | 4 | 66.67 |
| **Total** | - | **8** | **~133** |

**Animation 1 - Continuous Splash (Looping):**

```c
static const union AnimCmd sAnim_Splash_1[] =
{
    ANIMCMD_FRAME(0, 4),   // Frame 0 for 4 ticks
    ANIMCMD_FRAME(1, 4),   // Frame 1 for 4 ticks
    ANIMCMD_FRAME(0, 6),   // Frame 0 for 6 ticks
    ANIMCMD_FRAME(1, 6),   // Frame 1 for 6 ticks
    ANIMCMD_FRAME(0, 8),   // Frame 0 for 8 ticks
    ANIMCMD_FRAME(1, 8),   // Frame 1 for 8 ticks
    ANIMCMD_FRAME(0, 6),   // Frame 0 for 6 ticks
    ANIMCMD_FRAME(1, 6),   // Frame 1 for 6 ticks
    ANIMCMD_JUMP(0),       // Loop back to start
};
```

| Step | Frame | Duration (ticks) | Duration (ms @ 60fps) |
|------|-------|------------------|----------------------|
| 1 | 0 | 4 | 66.67 |
| 2 | 1 | 4 | 66.67 |
| 3 | 0 | 6 | 100.00 |
| 4 | 1 | 6 | 100.00 |
| 5 | 0 | 8 | 133.33 |
| 6 | 1 | 8 | 133.33 |
| 7 | 0 | 6 | 100.00 |
| 8 | 1 | 6 | 100.00 |
| **Cycle Total** | - | **48** | **~800** |

The looping animation has a "breathing" rhythm: starts fast (4 ticks), slows down (8 ticks), then speeds back up (6 ticks).

### Creation and Update Functions

**Source File:** `public/pokeemerald/src/field_effect_helpers.c` (lines 642-678)

```c
#define sLocalId  data[0]
#define sMapNum   data[1]
#define sMapGroup data[2]

u32 FldEff_Splash(void)
{
    u8 objectEventId = GetObjectEventIdByLocalIdAndMap(
        gFieldEffectArguments[0],
        gFieldEffectArguments[1],
        gFieldEffectArguments[2]
    );
    struct ObjectEvent *objectEvent = &gObjectEvents[objectEventId];
    u8 spriteId = CreateSpriteAtEnd(
        gFieldEffectObjectTemplatePointers[FLDEFFOBJ_SPLASH],
        0, 0, 0
    );

    if (spriteId != MAX_SPRITES)
    {
        struct Sprite *linkedSprite;
        const struct ObjectEventGraphicsInfo *graphicsInfo =
            GetObjectEventGraphicsInfo(objectEvent->graphicsId);
        struct Sprite *sprite = &gSprites[spriteId];

        sprite->coordOffsetEnabled = TRUE;
        linkedSprite = &gSprites[objectEvent->spriteId];
        sprite->oam.priority = linkedSprite->oam.priority;
        sprite->sLocalId = gFieldEffectArguments[0];
        sprite->sMapNum = gFieldEffectArguments[1];
        sprite->sMapGroup = gFieldEffectArguments[2];
        sprite->y2 = (graphicsInfo->height >> 1) - 4;  // Y offset

        PlaySE(SE_PUDDLE);  // SOUND EFFECT
    }
    return 0;
}

void UpdateSplashFieldEffect(struct Sprite *sprite)
{
    u8 objectEventId;

    if (sprite->animEnded ||
        TryGetObjectEventIdByLocalIdAndMap(
            sprite->sLocalId, sprite->sMapNum, sprite->sMapGroup, &objectEventId))
    {
        FieldEffectStop(sprite, FLDEFF_SPLASH);
    }
    else
    {
        // Follow the player sprite
        sprite->x = gSprites[gObjectEvents[objectEventId].spriteId].x;
        sprite->y = gSprites[gObjectEvents[objectEventId].spriteId].y;
        UpdateObjectEventSpriteInvisibility(sprite, FALSE);
    }
}
```

**Key behaviors:**
1. Splash sprite follows the player during animation
2. Removed when animation completes (`animEnded`)
3. Y offset positions splash at player's feet: `(height / 2) - 4` pixels

---

## Jump Splash Effects

### Small Splash (Shallow Water)

**Source File:** `public/pokeemerald/src/data/field_effects/field_effect_objects.h` (lines 584-611)

```c
static const struct SpriteFrameImage sPicTable_JumpSmallSplash[] = {
    overworld_frame(gFieldEffectObjectPic_JumpSmallSplash, 2, 1, 0),
    overworld_frame(gFieldEffectObjectPic_JumpSmallSplash, 2, 1, 1),
    overworld_frame(gFieldEffectObjectPic_JumpSmallSplash, 2, 1, 2),
};

static const union AnimCmd sAnim_JumpSmallSplash[] =
{
    ANIMCMD_FRAME(0, 4),
    ANIMCMD_FRAME(1, 4),
    ANIMCMD_FRAME(2, 4),
    ANIMCMD_END,
};
```

| Property | Value |
|----------|-------|
| Frame count | 3 |
| Sprite size | 32x16 pixels |
| Duration | 12 ticks (~200ms) |
| Loops | No |

### Big Splash (Deep Water)

**Source File:** `public/pokeemerald/src/data/field_effects/field_effect_objects.h` (lines 512-541)

```c
static const struct SpriteFrameImage sPicTable_JumpBigSplash[] = {
    overworld_frame(gFieldEffectObjectPic_JumpBigSplash, 2, 2, 0),
    overworld_frame(gFieldEffectObjectPic_JumpBigSplash, 2, 2, 1),
    overworld_frame(gFieldEffectObjectPic_JumpBigSplash, 2, 2, 2),
    overworld_frame(gFieldEffectObjectPic_JumpBigSplash, 2, 2, 3),
};

static const union AnimCmd sAnim_JumpBigSplash[] =
{
    ANIMCMD_FRAME(0, 8),
    ANIMCMD_FRAME(1, 8),
    ANIMCMD_FRAME(2, 8),
    ANIMCMD_FRAME(3, 8),
    ANIMCMD_END,
};
```

| Property | Value |
|----------|-------|
| Frame count | 4 |
| Sprite size | 32x32 pixels |
| Duration | 32 ticks (~533ms) |
| Loops | No |

---

## Sound Effects

**Source File:** `public/pokeemerald/include/constants/songs.h`

```c
#define SE_PUDDLE  70  // Also called SE_MIZU (water)
```

The puddle sound (`SE_PUDDLE = 70`) is played once when `FldEff_Splash()` is called.

---

## Sprite Positioning

All splash sprites follow this positioning formula:

```c
// World coordinates (tile-aligned)
worldX = tileX * 16 + 8;  // Center of tile
worldY = tileY * 16 + 8;  // Center of tile

// Y offset for feet positioning
yOffset = (character_sprite_height / 2) - 4;
```

For a standard 16x32 player sprite:
- `yOffset = (32 / 2) - 4 = 12` pixels below center

---

## Summary: Animation Timing Constants

| Effect | Frames | Per-Frame Duration | Total Duration | Loop |
|--------|--------|-------------------|----------------|------|
| Walking Puddle (Anim 0) | 2 | 4 ticks each | 8 ticks (133ms) | No |
| Walking Puddle (Anim 1) | 2 | 4→6→8→6 varying | 48 ticks (800ms) | Yes |
| Jump Small Splash | 3 | 4 ticks each | 12 ticks (200ms) | No |
| Jump Big Splash | 4 | 8 ticks each | 32 ticks (533ms) | No |

---

## React Refactor Plan

### Rename: `FieldEffectManager` (Already Done!)

The current `FieldEffectManager.ts` already has a good generic name. However, its types and internal naming still reference "grass". We should update it to be truly generic.

### New Effect Types to Add

Update the `type` union in `FieldEffect`:

```typescript
// Current
type: 'tall' | 'long' | 'sand' | 'deep_sand';

// Proposed
type: 'tall_grass' | 'long_grass' | 'sand' | 'deep_sand' | 'puddle_splash' | 'jump_small_splash' | 'jump_big_splash';
```

### Animation Constants to Add

```typescript
/**
 * Puddle splash animation (walking in puddle)
 * From: sAnim_Splash_0 in field_effect_objects.h
 */
const PUDDLE_SPLASH_ANIMATION_SEQUENCE = [0, 1];
const PUDDLE_SPLASH_FRAME_DURATIONS = [4, 4];  // Total: 8 ticks

/**
 * Jump small splash (shallow water)
 * From: sAnim_JumpSmallSplash in field_effect_objects.h
 */
const JUMP_SMALL_SPLASH_ANIMATION_SEQUENCE = [0, 1, 2];
const JUMP_SMALL_SPLASH_FRAME_DURATIONS = [4, 4, 4];  // Total: 12 ticks

/**
 * Jump big splash (deep water)
 * From: sAnim_JumpBigSplash in field_effect_objects.h
 */
const JUMP_BIG_SPLASH_ANIMATION_SEQUENCE = [0, 1, 2, 3];
const JUMP_BIG_SPLASH_FRAME_DURATIONS = [8, 8, 8, 8];  // Total: 32 ticks
```

### Trigger Logic Changes

In `PlayerController.ts`, add puddle detection:

```typescript
// After movement completes, check for puddle splash
const currentBehavior = getMetatileBehavior(currentTileX, currentTileY);
const previousBehavior = getMetatileBehavior(previousTileX, previousTileY);

// Key insight: Both tiles must be puddles for splash to occur
if (currentBehavior === MB_PUDDLE && previousBehavior === MB_PUDDLE) {
  fieldEffectManager.create(
    currentTileX,
    currentTileY,
    'puddle_splash',
    false,  // Don't skip animation
    'player'
  );
  // Play SE_PUDDLE sound
}
```

### Sprite Sheet Requirements

Need to extract and load these graphics:
- `graphics/field_effects/pics/splash.png` (32x16, 2 frames)
- `graphics/field_effects/pics/jump_small_splash.png` (32x16, 3 frames)
- `graphics/field_effects/pics/jump_big_splash.png` (32x32, 4 frames)

### FieldEffectForRendering Updates

```typescript
export interface FieldEffectForRendering {
  id: string;
  worldX: number;
  worldY: number;
  frame: number;
  type: 'tall_grass' | 'long_grass' | 'sand' | 'deep_sand' |
        'puddle_splash' | 'jump_small_splash' | 'jump_big_splash';
  subpriorityOffset: number;
  visible: boolean;
  direction?: 'up' | 'down' | 'left' | 'right';
  flipHorizontal?: boolean;
  yOffset?: number;  // NEW: For splash positioning at feet
}
```

### Cleanup Logic

Puddle splashes are simpler than grass:
- Remove immediately when animation completes
- No "resting frame" that persists
- No direction-dependent cleanup

```typescript
// In cleanup():
if (effect.type === 'puddle_splash' ||
    effect.type === 'jump_small_splash' ||
    effect.type === 'jump_big_splash') {
  if (effect.completed) {
    this.effects.delete(id);
  }
}
```

### Implementation Checklist

1. [ ] Extract splash sprite sheets from pokeemerald graphics
2. [ ] Add new effect types to FieldEffect interface
3. [ ] Add animation constants for splash effects
4. [ ] Implement `update()` logic for splash animation timing
5. [ ] Add puddle trigger in PlayerController (dual-tile check!)
6. [ ] Add jump splash triggers for surfing transitions
7. [ ] Update ObjectRenderer to draw splash sprites
8. [ ] Add yOffset calculation for feet positioning
9. [ ] Add SE_PUDDLE sound effect playback
10. [ ] Test: Walking within puddle area
11. [ ] Test: Entering/exiting puddle (should NOT splash)
12. [ ] Test: Jump into shallow water
13. [ ] Test: Jump into deep water

---

## Source Files Reference

### Pokeemerald Decompilation
| File | Content |
|------|---------|
| `include/constants/metatile_behaviors.h` | `MB_PUDDLE = 22` |
| `include/constants/field_effects.h` | `FLDEFF_SPLASH = 15` |
| `include/constants/songs.h` | `SE_PUDDLE = 70` |
| `include/event_object_movement.h` | `GROUND_EFFECT_FLAG_PUDDLE` |
| `src/event_object_movement.c` | Puddle trigger logic |
| `src/metatile_behavior.c` | `MetatileBehavior_IsPuddle()` |
| `src/field_effect_helpers.c` | `FldEff_Splash()` |
| `src/data/field_effects/field_effect_objects.h` | Sprite templates & animations |

### Graphics
| File | Dimensions | Frames |
|------|------------|--------|
| `graphics/field_effects/pics/splash.png` | 32x16 | 2 |
| `graphics/field_effects/pics/jump_small_splash.png` | 32x16 | 3 |
| `graphics/field_effects/pics/jump_big_splash.png` | 32x32 | 4 |

### React Project
| File | Role |
|------|------|
| `src/utils/metatileBehaviors.ts` | `MB_PUDDLE` constant |
| `src/game/FieldEffectManager.ts` | Effect management (to extend) |
| `src/game/PlayerController.ts` | Trigger detection (to extend) |
