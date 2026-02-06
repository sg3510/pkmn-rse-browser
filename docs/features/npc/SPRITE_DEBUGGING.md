---
title: NPC Sprite Debugging Guide
status: bug
last_verified: 2026-01-13
---

# NPC Sprite Debugging Guide

## Quick Diagnosis

### Sprite Not Showing (Transparent)

1. **Check graphics ID match:**
   ```bash
   # What does the map data say?
   # Look for: graphicsId: OBJ_EVENT_GFX_WOMAN_5

   # Does it exist in metadata?
   grep 'OBJ_EVENT_GFX_WOMAN_5' src/data/sprite-metadata.json
   ```

2. **Check file exists:**
   ```bash
   ls public/pokeemerald/graphics/object_events/pics/people/woman_5.png
   ```

3. **Check path in metadata:**
   ```bash
   cat src/data/sprite-metadata.json | python3 -c "
   import json,sys
   d=json.load(sys.stdin)
   print(d['sprites'].get('OBJ_EVENT_GFX_WOMAN_5', {}).get('spritePath'))
   "
   ```

### Wrong Animation Frame

1. **Check animation being used:**
   - Add console.log in `NPCAnimationEngine.ts`:
   ```typescript
   console.log('NPC animation:', npcId, animNum, getCurrentFrame(state));
   ```

2. **Check frameMap is applied:**
   - Logical frame index should be mapped through `mapLogicalToPhysicalFrame()`

3. **Check hFlip for East direction:**
   - East-facing should use `hFlip: true` with West frames

### Walking Shows Wrong Direction

1. **Verify direction state updates:**
   - Check `NPCAnimationManager.getState()` is called with correct direction
   - Check `setAnimationForMovement()` is being triggered

2. **Check animation index mapping:**
   ```
   Direction → Animation Index:
   down  + idle    → 0 (FACE_SOUTH)
   up    + idle    → 1 (FACE_NORTH)
   left  + idle    → 2 (FACE_WEST)
   right + idle    → 3 (FACE_EAST)
   down  + walking → 4 (GO_SOUTH)
   up    + walking → 5 (GO_NORTH)
   left  + walking → 6 (GO_WEST)
   right + walking → 7 (GO_EAST)
   ```

## Regenerating Metadata

After changing the parser:

```bash
npx tsx scripts/parse-sprite-metadata.ts
```

## Key Files

| File | Purpose |
|------|---------|
| `src/data/sprite-metadata.json` | Generated metadata (don't edit directly) |
| `scripts/parse-sprite-metadata.ts` | Parser that generates metadata |
| `src/data/spriteMetadata.ts` | TypeScript API for accessing metadata |
| `src/game/npc/NPCAnimationEngine.ts` | Animation state management |
| `src/game/npc/NPCSpriteLoader.ts` | Sprite loading and caching |
| `src/game/npc/NPCRenderer.ts` | Canvas2D rendering |

## Frame Layout Quick Reference

### Standard 9-Frame NPC (16x32)

```
Physical: [0:down] [1:up] [2:left] [3:down_w1] [4:down_w2] [5:up_w1] [6:up_w2] [7:left_w1] [8:left_w2]
```

No frameMap needed (logical = physical).

### Limited Animation NPC (e.g., Nurse)

```
Physical: [0:down] [1:up] [2:left] [3:special]
frameMap: [0, 1, 2, 0, 0, 1, 1, 2, 2, 3]
```

Logical frames 3-8 reuse idle frames; logical 9 = special frame.

### Non-Standard Layout (e.g., Wingull)

```
Physical: [0:down] [1:down_walk] [2:up] [3:up_walk] [4:left] [5:left_walk]
frameMap: [0, 2, 4, 1, 1, 3, 3, 5, 5]
```

## Console Debug Commands

```javascript
// In browser console:

// Check loaded sprites
npcSpriteCache.getStats()

// Check animation state
npcAnimationManager.states

// Get frame info for specific NPC
npcAnimationManager.getFrameInfo('npc_1_10_5')
```

## Common Issues & Fixes

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Sprite invisible | Path mismatch | Check metadata path vs actual file |
| Shows frame 0 always | Animation not updating | Check getState() detects changes |
| East shows West frame | hFlip not applied | Check frameInfo.hFlip in renderer |
| Walking shows idle | isMoving not true | Check NPC movement state |
| Wrong walk frame | frameMap not applied | Check mapLogicalToPhysicalFrame() |
| Walking left shows up anim | Wrong frame indices | Fixed in getNPCFrameInfo |
| Large sprite positioned wrong | Missing X centering | Fixed with (16-sw)/2 offset |

## Sprite Positioning (pokeemerald formula)

For all sprite sizes, centering uses the pokeemerald `centerToCornerVec` formula:

```typescript
// Horizontal: center sprite on tile
worldX = tileX * 16 + subTileX + Math.floor((16 - spriteWidth) / 2)

// Vertical: feet at bottom of tile
worldY = tileY * 16 + subTileY - (spriteHeight - 16)
```

Examples:
- **16x32 sprite** (standard NPC): X offset = (16-16)/2 = 0
- **64x64 sprite** (Rayquaza): X offset = (16-64)/2 = -24 (centered)
- **32x32 sprite**: X offset = (16-32)/2 = -8 (centered)

## Two Animation Code Paths

There are currently TWO ways NPC frames are determined:

### 1. Animation Manager (Canvas2D)
- **File:** `NPCRenderer.ts` → `NPCAnimationEngine.ts`
- **Uses:** Full animation sequences from metadata (e.g., sAnim_GoWest: [7, 2, 8, 2])
- **Features:** Proper timing, frame sequencing, animation table lookups

### 2. getNPCFrameInfo (WebGL)
- **File:** `spriteUtils.ts` → `NPCSpriteLoader.ts`
- **Uses:** Simplified 2-frame alternation
- **Features:** Direct frame index mapping

The WebGL renderer uses `getNPCFrameInfo` for simplicity. Ensure this function's
frame indices match the standard 9-frame layout:

```
Frame 0: down idle     Frame 3: down walk 1   Frame 5: up walk 1     Frame 7: left walk 1
Frame 1: up idle       Frame 4: down walk 2   Frame 6: up walk 2     Frame 8: left walk 2
Frame 2: left idle
```
