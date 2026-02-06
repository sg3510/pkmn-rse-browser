---
title: Sand Footprints Fade Analysis - C vs React
status: research
last_verified: 2026-01-13
---

# Sand Footprints Fade Analysis - C vs React

## C Code Implementation

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
    sprite->invisible ^= 1;              // Toggle visibility
    sprite->sTimer++;                     // Continue incrementing timer
    UpdateObjectEventSpriteInvisibility(sprite, sprite->invisible);
    if (sprite->sTimer > 56)
        FieldEffectStop(sprite, sprite->sFldEff);
}
```

### C Code Timer Logic

| Frame | sTimer | sState | invisible | Action |
|-------|--------|--------|-----------|--------|
| 1 | 1 | 0 | FALSE | Visible, increment timer |
| 2 | 2 | 0 | FALSE | Visible, increment timer |
| ... | ... | 0 | FALSE | ... |
| 40 | 40 | 0 | FALSE | Visible, increment timer |
| 41 | 41 | **1** | **TRUE** | **State changes to 1**, toggle visible |
| 42 | 42 | 1 | FALSE | Toggle visible |
| 43 | 43 | 1 | TRUE | Toggle visible |
| ... | ... | 1 | alternating | ... |
| 56 | 56 | 1 | FALSE | Toggle visible |
| 57 | 57 | 1 | TRUE | **Removed** (sTimer > 56) |

**Key Points:**
- Timer starts at 0, incremented **before** check (++sTimer)
- Check uses `>` not `>=` (checks AFTER increment)
- Frame 1: timer = 1
- Frame 41: timer = 41, check `41 > 40` → TRUE, switch to state 1
- Flicker happens frames 41-56 (16 frames total)
- Frame 57: timer = 57, check `57 > 56` → TRUE, destroy

## React Implementation

**File**: `GrassEffectManager.ts:158-173`

```typescript
else if (effect.type === 'sand' || effect.type === 'deep_sand') {
  // Sand footprints:
  // 0-40 frames: Static (Step 0)
  // 40-56 frames: Flicker (Step 1)
  // 56+ frames: End
  
  if (effect.animationTick > 56) {
    effect.completed = true;
  } else if (effect.animationTick > 40) {
    // Flicker phase: toggle visibility every frame
    // In C code: sprite->invisible ^= 1
    effect.visible = !effect.visible;
  }
}
```

**Note**: `animationTick` is incremented at line 129:
```typescript
effect.animationTick++;  // Increment happens BEFORE logic
```

### React Timer Logic

| Frame | animationTick (after increment) | visible | Action |
|-------|--------------------------------|---------|--------|
| 1 | 1 | TRUE | Visible |
| 2 | 2 | TRUE | Visible |
| ... | ... | TRUE | ... |
| 40 | 40 | TRUE | Visible |
| 41 | 41 | **FALSE** | **Flicker starts** |
| 42 | 42 | TRUE | Toggle |
| 43 | 43 | FALSE | Toggle |
| ... | ... | alternating | ... |
| 56 | 56 | TRUE | Toggle |
| 57 | 57 | - | **Removed** |

## Comparison

### ✅ MATCHES C Code:
- **Frame 1-40**: Visible (static)
- **Frame 41-56**: Flicker (16 frames)
- **Frame 57+**: Removed
- **Total duration**: 56 frames
- **Flicker duration**: 16 frames
- **Uses `>` not `>=`** in both comparisons
- **Increments before check** (matches `++sTimer`)

### ⚠️ Minor Difference:
**Flicker pattern offset by 1 frame:**

#### C Code:
- Frame 41: invisible = TRUE (toggled from FALSE)
- Frame 42: invisible = FALSE (toggled from TRUE)

#### React:
- Frame 41: visible = FALSE (toggled from TRUE)
- Frame 42: visible = TRUE (toggled from FALSE)

**Why?** C code starts with `invisible = FALSE` (visible), then toggles to TRUE (invisible) on frame 41. React starts with `visible = TRUE`, then toggles to FALSE on frame 41.

**Impact**: The pattern is **inverted but same frequency**. C shows invisible first, React shows visible first. This is **cosmetically identical** in practice.

### ✅ Timer Accuracy CHECK:

#### C Code Frame Count:
- Static: Frames 1-40 = **40 frames** ✓
- Flicker: Frames 41-56 = **16 frames** ✓
- Total: **56 frames** ✓

#### React Code Frame Count:
- Static: Frames 1-40 = **40 frames** ✓
- Flicker: Frames 41-56 = **16 frames** ✓
- Total: **56 frames** ✓

## Timing at 60 FPS

| Phase | Frames | Duration (seconds) | C Code | React |
|-------|--------|-------------------|--------|-------|
| **Static** | 40 | 0.67s | ✓ | ✓ |
| **Flicker** | 16 | 0.27s | ✓ | ✓ |
| **Total** | 56 | 0.93s | ✓ | ✓ |

## Conclusion

### ✅ 100% Authentic
The React implementation is **functionally identical** to the C code:
- Same frame durations
- Same total lifetime
- Same flicker frequency
- Same removal timing
- Same toggle logic (`^= 1` equivalent to `!visible`)

### Minor Cosmetic Difference
The only difference is whether the first flicker frame is visible or invisible, which is imperceptible to the player. Both implementations flicker at the same rate and for the same duration.

## Recommendation
**No changes needed** - the implementation is authentic to pokeemerald!
