# NPC Sprite System Architecture

## Overview

This document describes the NPC sprite system, its current issues, and the scalable solution.

## The Three-Layer Frame System

pokeemerald uses a three-layer abstraction for sprite frames:

### 1. Physical Layer (Sprite Sheet)
The actual PNG file contains a specific number of unique images arranged horizontally.

```
Example: nurse.png (4 physical frames)
[Frame 0: Down] [Frame 1: Up] [Frame 2: Left] [Frame 3: Eyes Closed]
```

### 2. Logical Layer (Animation System)
The animation system references frames by logical indices (0-9 typically). These don't directly correspond to physical frames.

### 3. Mapping Layer (Pic Tables)
The `frameMap` array maps logical indices to physical frames:

```
Nurse frameMap: [0, 1, 2, 0, 0, 1, 1, 2, 2, 3]
  Logical 0 → Physical 0 (Face South)
  Logical 1 → Physical 1 (Face North)
  Logical 2 → Physical 2 (Face West/East)
  Logical 3 → Physical 0 (Walk South frame 1 - reuses idle)
  Logical 4 → Physical 0 (Walk South frame 2 - reuses idle)
  Logical 5 → Physical 1 (Walk North frame 1 - reuses idle)
  Logical 6 → Physical 1 (Walk North frame 2 - reuses idle)
  Logical 7 → Physical 2 (Walk West frame 1 - reuses idle)
  Logical 8 → Physical 2 (Walk West frame 2 - reuses idle)
  Logical 9 → Physical 3 (Special: Eyes closed for bow animation)
```

## Sprite Types

### Type A: Standard Walking NPCs (9 frames)
Most human NPCs with full walking animations.

**Physical layout:** down, up, left, down_walk1, down_walk2, up_walk1, up_walk2, left_walk1, left_walk2

**Examples:** boy_1, girl_1, woman_1, man_1, etc.

**frameMap:** None needed (logical = physical)

### Type B: Limited Animation NPCs (4 frames + reuse)
NPCs that don't walk but have special animations.

**Physical layout:** down, up, left, special

**Examples:** nurse (4 frames, eyes closed for bow)

**frameMap:** [0, 1, 2, 0, 0, 1, 1, 2, 2, 3]

### Type C: Simple NPCs (3 frames)
NPCs that only face different directions.

**Physical layout:** down, up, left

**Examples:** Some Pokemon, items, obstacles

**frameMap:** [0, 1, 2, 0, 0, 1, 1, 2, 2]

### Type D: Non-Standard Layout
Sprites where the physical order differs from the standard.

**Example:** Wingull
- Physical: down, down_walk, up, up_walk, left, left_walk
- Standard expects: down, up, left, down_walk1, down_walk2, ...
- **frameMap:** [0, 2, 4, 1, 1, 3, 3, 5, 5]

### Type E: Inanimate Objects
Static sprites that don't animate.

**Examples:** item_ball, berry_tree, signs

**inanimate:** true

## Current Issues

### Issue 1: Graphics ID Naming Mismatch

**Map data uses:** `OBJ_EVENT_GFX_WOMAN_5` (with underscore before number)
**Metadata has:** `OBJ_EVENT_GFX_WOMAN5` (no underscore)

**Source of truth:** The C source files use CamelCase names like `Woman5` which the parser converts inconsistently.

**Fix:** Normalize IDs by removing underscores before single digits.

### Issue 2: Sprite Path Generation

**Metadata generates:** `/people/woman5.png`
**Actual file is:** `/people/woman_5.png`

The `nameToSpritePath()` function doesn't add underscores before numbers.

**Fix:** Update path generation to match actual file naming.

### Issue 3: Animation Table References

Some sprites use custom animation tables:
- `sAnimTable_Nurse` - has ANIM_NURSE_BOW
- `sAnimTable_AcroBike` - has wheelie animations
- `sAnimTable_Surfing` - has mount/dismount animations

These need proper lookup and fallback.

## Data Sources (pokeemerald C files)

### 1. `object_event_graphics_info.h`
Defines sprite properties:
- Width, height
- Animation table reference
- inanimate flag
- Shadow size

### 2. `object_event_pic_tables.h`
Defines frame mappings via `overworld_frame()` macro:
```c
static const struct SpriteFrameImage sPicTable_Nurse[] = {
    overworld_frame(gObjectEventPic_Nurse, 2, 4, 0),  // logical 0 → physical 0
    overworld_frame(gObjectEventPic_Nurse, 2, 4, 1),  // logical 1 → physical 1
    overworld_frame(gObjectEventPic_Nurse, 2, 4, 2),  // logical 2 → physical 2
    overworld_frame(gObjectEventPic_Nurse, 2, 4, 0),  // logical 3 → physical 0 (reuse)
    // ...
    overworld_frame(gObjectEventPic_Nurse, 2, 4, 3),  // logical 9 → physical 3 (eyes closed)
};
```

### 3. `object_event_anims.h`
Defines animation sequences and tables:
```c
static const union AnimCmd sAnim_NurseBow[] = {
    ANIMCMD_FRAME(0, 8),   // Frame 0 for 8 ticks
    ANIMCMD_FRAME(9, 32),  // Frame 9 (eyes closed) for 32 ticks
    ANIMCMD_FRAME(0, 8),
    ANIMCMD_END,
};
```

## Animation Sequence Format

Each animation is an array of frames:
```json
{
  "frameIndex": 7,     // Logical frame index (mapped via frameMap)
  "duration": 8,       // Duration in game ticks (~16.67ms each)
  "hFlip": true,       // Horizontal flip (for East-facing)
  "vFlip": false       // Vertical flip (rarely used)
}
```

### Standard Walking Animation (sAnim_GoEast)
```json
[
  { "frameIndex": 7, "duration": 8, "hFlip": true },   // Walk frame 1
  { "frameIndex": 2, "duration": 8, "hFlip": true },   // Idle frame
  { "frameIndex": 8, "duration": 8, "hFlip": true },   // Walk frame 2
  { "frameIndex": 2, "duration": 8, "hFlip": true }    // Idle frame
]
```

## Scalable Solution

### 1. Fix Metadata Parser (`scripts/parse-sprite-metadata.ts`)

Update `nameToSpritePath()` to handle numbered suffixes:
```typescript
function nameToSpritePath(name: string): string {
  let snakeName = name
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();

  // Add underscore before trailing numbers: woman5 → woman_5
  snakeName = snakeName.replace(/(\D)(\d+)$/, '$1_$2');

  // ... rest of function
}
```

### 2. Normalize Graphics IDs Consistently

The `normalizeGraphicsId()` function in `spriteMetadata.ts` should work bidirectionally.

### 3. Fallback Chain for Sprite Loading

```
1. Try metadata path (normalized ID)
2. Try hardcoded path lookup
3. Try guessed path with underscore variations
4. Log warning if all fail
```

### 4. Animation Table Fallback

```
1. Look up sprite's animation table
2. Find animation by index in that table
3. If not found, fallback to sAnimTable_Standard
4. Apply frameMap to all frame indices
```

## Regenerating Metadata

After fixing the parser:
```bash
npx tsx scripts/parse-sprite-metadata.ts
```

This regenerates `src/data/sprite-metadata.json` with correct paths and frame mappings.

## Testing Checklist

- [ ] Standard NPCs display correctly (boy_1, girl_1, etc.)
- [ ] Nurse displays and bow animation works
- [ ] Pokemon sprites display (zigzagoon, wingull)
- [ ] Walking animations use correct frames
- [ ] East-facing uses hFlip correctly
- [ ] Inanimate sprites don't animate
- [ ] Custom animation tables work (nurse bow, etc.)
