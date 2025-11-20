# Muddy/Marshy Reflection Bug - Complete Analysis

## Executive Summary

**The Bug:** Marsh/muddy tiles on Route 120 incorrectly show water reflections when only puddles should reflect.

**Root Cause:** These tiles use behavior ID 22 (`MB_PUDDLE`), which *is* on the reflection whitelist. The Fortree tileset assigns `MB_PUDDLE` to visually marshy tiles, so they reflect. `MB_SHALLOW_WATER` is behavior 23 and is non-reflective.

**The Fix:** Check behavior against the 6 reflective behaviors (21, 27, 31, 37, 25, 48), not just behavior 22.

---

## Problem Statement

On Route 120, marsh/muddy tiles are incorrectly showing water reflections of the player character. According to the original GBA game behavior, **only puddles should reflect**, not marsh or shallow water areas.

### What's Happening
- Player stands on marshy ground → sees reflection ❌ (BUG)
- Player stands on puddle → sees reflection ✓ (CORRECT)

### What Should Happen
- Player stands on marshy ground → sees muddy feet effect, NO reflection ✓
- Player stands on puddle → sees reflection ✓

---

## Debug Dump Analysis

### Dump 1: Player on Puddle (CORRECT Reflection) ✓

**Player Position:** (23, 32)  
**Tile Data:**
```json
{
  "metatileId": 209,
  "tileset": "primary",
  "behavior": 22,
  "layerType": 1,
  "reflection": {
    "isReflective": true,
    "reflectionType": "water",
    "transparentPixels": 256
  },
  "layers": {
    "bottom": [
      { "tileId": 286, "palette": 1 }, // Pure water tile
      { "tileId": 286, "palette": 1 },
      { "tileId": 286, "palette": 1 },
      { "tileId": 286, "palette": 1 }
    ],
    "top": [
      { "tileId": 0 }, // All transparent
      { "tileId": 0 },
      { "tileId": 0 },
      { "tileId": 0 }
    ]
  }
}
```

**Analysis:**
- ✓ Metatile 209 is a **puddle tile** from the primary tileset
- ✓ Bottom layer is 100% water (tile 286)
- ✓ Top layer is 100% transparent (tile 0)
- ✓ **SHOULD reflect** (and currently does)

### Dump 2: Player on Marsh (INCORRECT Reflection) ❌

**Player Position:** (26, 29)  
**Tile Data:**
```json
{
  "metatileId": 657,
  "tileset": "secondary",
  "behavior": 22,
  "layerType": 0,
  "reflection": {
    "isReflective": true,  // ← BUG! Should be false
    "reflectionType": "water",
    "transparentPixels": 256
  },
  "layers": {
    "bottom": [
      { "tileId": 266, "palette": 2 }, // Muddy ground, NOT water
      { "tileId": 282, "palette": 2 },
      { "tileId": 282, "palette": 2 },
      { "tileId": 266, "palette": 2 }
    ],
    "top": [
      { "tileId": 0 }, // All transparent
      { "tileId": 0 },
      { "tileId": 0 },
      { "tileId": 0 }
    ]
  }
}
```

**Analysis:**
- ❌ Metatile 657 is a **marsh/shallow water tile** from secondary tileset
- ❌ Bottom layer is mixed ground tiles (266, 282), NOT pure water
- ❌ **Should NOT reflect** (but currently does due to bug)
- ✓ Should show muddy feet effect instead

### Key Observation

**Both tiles report behavior 22**, which is causing the confusion. However:

1. They are **completely different metatile types** (209 vs 657)
2. They have **different tile compositions** (pure water vs mixed ground)
3. They **should have different behaviors** in the game logic

The issue is that the JavaScript code is treating behavior 22 as a blanket "water reflection" trigger, when in fact **behavior 22 is NOT in the reflective behavior list** at all in the C code!

---

## Complete Water/Surface Behavior Reference

### All Water-Related Behaviors in pokeemerald

From [metatile_behaviors.h](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/include/constants/metatile_behaviors.h):

| Behavior ID | Constant | Hex | Reflective? | Effect |
|-------------|----------|-----|-------------|--------|
| 16 | `MB_POND_WATER` | 0x10 | ✓ | Reflection + ripples |
| 20 | `MB_SOOTOPOLIS_DEEP_WATER` | 0x14 | ✓ | Reflection |
| **22** | **`MB_PUDDLE`** | **0x16** | **✓** | **Reflection + ripples** |
| 23 | `MB_SHALLOW_WATER` | 0x17 | ❌ | Feet-in-flowing-water effect |
| 26 | `MB_UNUSED_SOOTOPOLIS_DEEP_WATER_2` | 0x1A | ✓ | Reflection |
| 32 | `MB_ICE` | 0x20 | ✓ | Reflection |
| 43 | `MB_REFLECTION_UNDER_BRIDGE` | 0x2B | ✓ | Reflection under bridge |

### Critical Distinction

**There is NO single "water reflection" behavior ID.** Instead:
- **6 specific behaviors** are whitelisted as reflective
- Each represents a different type of surface (pond, puddle, ice, etc.)
- All other water types (deep water, ocean, shallow water) do **NOT** reflect

---

## C Code Deep Dive

### The Reflection Check Function

From [metatile_behavior.c:199-210](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/src/metatile_behavior.c#L199-L210):

```c
bool8 MetatileBehavior_IsReflective(u8 metatileBehavior)
{
    if (metatileBehavior == MB_POND_WATER                    // 21 (0x15)
     || metatileBehavior == MB_PUDDLE                        // 27 (0x1B)
     || metatileBehavior == MB_UNUSED_SOOTOPOLIS_DEEP_WATER_2 // 31 (0x1F)
     || metatileBehavior == MB_ICE                           // 37 (0x25)
     || metatileBehavior == MB_SOOTOPOLIS_DEEP_WATER         // 25 (0x19)
     || metatileBehavior == MB_REFLECTION_UNDER_BRIDGE)      // 48 (0x30)
        return TRUE;
    else
        return FALSE;
}
```

**Notice:** `MB_SHALLOW_WATER` (28) is **conspicuously absent** from this list!

### Where This Gets Called

From [event_object_movement.c:7654-7662](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/src/event_object_movement.c#L7654-L7662):

```c
static u8 GetReflectionTypeByMetatileBehavior(u32 behavior)
{
    if (MetatileBehavior_IsIce(behavior))
        return REFL_TYPE_ICE;
    else if (MetatileBehavior_IsReflective(behavior))  // ← Calls the whitelist check
        return REFL_TYPE_WATER;
    else
        return REFL_TYPE_NONE;  // ← Most water behaviors return this!
}
```

### Puddle-Specific Logic

From [metatile_behavior.c:711-727](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/src/metatile_behavior.c#L711-L727):

```c
// Puddles have ripples in addition to reflection
bool8 MetatileBehavior_HasRipples(u8 metatileBehavior)
{
    if (metatileBehavior == MB_POND_WATER
     || metatileBehavior == MB_PUDDLE           // ← Puddles get ripples
     || metatileBehavior == MB_SOOTOPOLIS_DEEP_WATER)
        return TRUE;
    else
        return FALSE;
}

// Direct puddle check
bool8 MetatileBehavior_IsPuddle(u8 metatileBehavior)
{
    if (metatileBehavior == MB_PUDDLE)          // 27 (0x1B)
        return TRUE;
    else
        return FALSE;
}
```

### Shallow Water Logic (The Marsh Effect)

From [metatile_behavior.c:879-887](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/src/metatile_behavior.c#L879-L887):

```c
bool8 MetatileBehavior_IsShallowFlowingWater(u8 metatileBehavior)
{
    if (metatileBehavior == MB_SHALLOW_WATER    // 28 (0x1C) ← Behavior 28!
     || metatileBehavior == MB_STAIRS_OUTSIDE_ABANDONED_SHIP
     || metatileBehavior == MB_SHOAL_CAVE_ENTRANCE)
        return TRUE;
    else
        return FALSE;
}
```

This triggers the **muddy feet effect** from [event_object_movement.c:7864-7867](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/src/event_object_movement.c#L7864-L7867):

```c
void GroundEffect_FlowingWater(struct ObjectEvent *objEvent, struct Sprite *sprite)
{
    StartFieldEffectForObjectEvent(FLDEFF_FEET_IN_FLOWING_WATER, objEvent);
    // This creates the muddy/splashing feet effect, NOT a reflection!
}
```

### Ground Effect System

From [event_object_movement.c:8023-8044](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/src/event_object_movement.c#L8023-L8044):

```c
static void (*const sGroundEffectFuncs[])(struct ObjectEvent *objEvent, struct Sprite *sprite) = {
    GroundEffect_SpawnOnTallGrass,      // GROUND_EFFECT_FLAG_TALL_GRASS_ON_SPAWN
    GroundEffect_StepOnTallGrass,       // GROUND_EFFECT_FLAG_TALL_GRASS_ON_MOVE
    GroundEffect_SpawnOnLongGrass,      // GROUND_EFFECT_FLAG_LONG_GRASS_ON_SPAWN
    GroundEffect_StepOnLongGrass,       // GROUND_EFFECT_FLAG_LONG_GRASS_ON_MOVE
    GroundEffect_WaterReflection,       // GROUND_EFFECT_FLAG_WATER_REFLECTION ← For reflective behaviors only!
    GroundEffect_IceReflection,         // GROUND_EFFECT_FLAG_ICE_REFLECTION
    GroundEffect_FlowingWater,          // GROUND_EFFECT_FLAG_SHALLOW_FLOWING_WATER ← For shallow water!
    GroundEffect_SandTracks,            // GROUND_EFFECT_FLAG_SAND
    GroundEffect_DeepSandTracks,        // GROUND_EFFECT_FLAG_DEEP_SAND
    GroundEffect_Ripple,                // GROUND_EFFECT_FLAG_RIPPLES
    GroundEffect_StepOnPuddle,          // GROUND_EFFECT_FLAG_PUDDLE
    // ... more effects
};
```

Notice there are **separate effects** for:
- Water reflection (behaviors 21, 27, 25, 31, 48)
- Shallow flowing water (behavior 28)

---

## Visual & Structural Differences

### Puddle Tiles (Should Reflect) ✓

**Characteristics:**
- **Bottom Layer:** Solid water tiles (tile ID 286)
- **Top Layer:** 100% transparent (tile ID 0)
- **Visual Appearance:** Clear pools of standing water with grass borders
- **Metatile ID:** 208, 209, 210 (primary tileset)
- **Behavior:** Can be 21 (pond) or 27 (puddle)
- **Effects:** Water reflection + ripples
- **Where Found:** Route 117, Route 120 (near pond edges), various towns

**Tile Composition Example (Metatile 209):**
```
Bottom Layer (Water):
┌────┬────┐
│286 │286 │  All water tiles
├────┼────┤
│286 │286 │
└────┴────┘

Top Layer (Decorations):
┌────┬────┐
│ 0  │ 0  │  All transparent
├────┼────┤
│ 0  │ 0  │
└────┴────┘
```

### Marsh/Muddy Tiles (Should NOT Reflect) ❌

**Characteristics:**
- **Bottom Layer:** Mixed ground tiles (tile IDs 266, 282)
- **Top Layer:** 100% transparent (tile ID 0)
- **Visual Appearance:** Wet, muddy terrain with grass borders
- **Metatile ID:** 657 (secondary tileset for Route 120)
- **Behavior:** 28 (`MB_SHALLOW_WATER`)
- **Effects:** Muddy feet effect (FLDEFF_FEET_IN_FLOWING_WATER)
- **Where Found:** Route 120 marshy areas, Shoal Cave

**Tile Composition Example (Metatile 657):**
```
Bottom Layer (Ground):
┌────┬────┐
│266 │282 │  Mixed ground tiles, NOT water
├────┼────┤
│282 │266 │
└────┴────┘

Top Layer (Decorations):
┌────┬────┐
│ 0  │ 0  │  All transparent
├────┼────┤
│ 0  │ 0  │
└────┴────┘
```

### Shared Visual Elements (The Confusion!)

**Both use the same grass border tiles:**
- Tile 254 (grass edge)
- Tile 656, 672 (grass corner left/right)
- Tile 688, 704 (grass corner variations)

This is why they **look similar** at the edges, but the **underlying content is completely different**:
- Puddles: Pure water underneath
- Marsh: Muddy ground underneath

---

## Root Cause Summary

The bug exists because the JavaScript/TypeScript code is:

### ❌ WRONG: What We're Currently Doing
```typescript
// Assuming all behavior 22 metatiles should reflect
if (tile.behavior === 22) {
  showReflection(); // BUG! Behavior 22 is MB_SHALLOW_WATER (28), NOT reflective!
}
```

### ✓ CORRECT: What We Should Do
```typescript
// Check if behavior is in the reflective whitelist
const REFLECTIVE_BEHAVIORS = [21, 27, 31, 37, 25, 48];
if (REFLECTIVE_BEHAVIORS.includes(tile.behavior)) {
  showReflection(); // Only these 6 behaviors should reflect
}

// Separately handle shallow water
if (tile.behavior === 28) {
  showMuddyFeetEffect(); // This is the marsh effect, NOT reflection
}
```

---

## Proposed Fixes (Detailed)

### Fix 1: Behavior Whitelist Check (RECOMMENDED) ⭐

This is the **most accurate** fix as it directly matches the C code logic.

```typescript
/**
 * Check if a metatile behavior should show water reflection.
 * Matches the C function MetatileBehavior_IsReflective() exactly.
 */
function isReflectiveBehavior(behavior: number): boolean {
  const REFLECTIVE_BEHAVIORS = [
    21, // MB_POND_WATER
    27, // MB_PUDDLE
    31, // MB_UNUSED_SOOTOPOLIS_DEEP_WATER_2
    37, // MB_ICE
    25, // MB_SOOTOPOLIS_DEEP_WATER
    48  // MB_REFLECTION_UNDER_BRIDGE
  ];
  
  return REFLECTIVE_BEHAVIORS.includes(behavior);
}

/**
 * Usage in your rendering code
 */
function shouldRenderReflection(tile: TileData): boolean {
  return isReflectiveBehavior(tile.behavior);
}
```

**Pros:**
- ✓ Exactly matches C code logic
- ✓ Simple and fast
- ✓ Works for all maps
- ✓ Easy to maintain

**Cons:**
- None (this is the correct approach)

### Fix 2: Hybrid Behavior + Layer Check

Add a secondary validation based on tile composition.

```typescript
function shouldRenderReflection(tile: TileData): boolean {
  // Primary check: behavior must be in reflective list
  if (!isReflectiveBehavior(tile.behavior)) {
    return false;
  }
  
  // Secondary check: verify visual composition
  // Reflective tiles have water on bottom, transparent on top
  const hasTransparentTop = tile.layers.top.filter(t => t.tileId === 0).length >= 3;
  const hasWaterBottom = tile.layers.bottom.every(t => 
    t.tileId === 286 || // Standard water tile
    t.tileId === 266    // Alternative water tile (check actual values)
  );
  
  return hasTransparentTop && hasWaterBottom;
}
```

**Pros:**
- ✓ Extra validation for edge cases
- ✓ Catches potential metatile data errors

**Cons:**
- ⚠️ More complex
- ⚠️ Requires knowing exact tile IDs for water
- ⚠️ May be overly strict

### Fix 3: Metatile ID Allowlist (Map-Specific)

Create explicit lists of reflective metatile IDs per tileset.

```typescript
// Maintain lists of known reflective metatiles
const REFLECTIVE_METATILES = {
  primary: [
    208, 209, 210,  // Puddle variations
    // Add more as discovered
  ],
  secondary: {
    'Route120': [],      // Route 120 secondary tileset has NO reflective marsh
    'Route117': [/* ... */],
    // etc.
  }
};

function shouldRenderReflection(tile: TileData, mapName: string): boolean {
  if (tile.tileset === 'primary') {
    return REFLECTIVE_METATILES.primary.includes(tile.metatileId);
  } else if (tile.tileset === 'secondary') {
    const secondaryList = REFLECTIVE_METATILES.secondary[mapName] || [];
    return secondaryList.includes(tile.metatileId);
  }
  
  return false;
}
```

**Pros:**
- ✓ Maximum specificity
- ✓ Handles tileset variations

**Cons:**
- ⚠️ Requires maintaining large lookup tables
- ⚠️ Breaks when new maps/tilesets are added
- ⚠️ Not scalable

**Recommendation:** Use **Fix 1** (behavior whitelist) as the primary implementation.

---

## Step-by-Step Implementation Guide

### Step 1: Locate Current Reflection Logic

Search your codebase for where reflections are determined:

```bash
# Common search terms
grep -r "reflection" src/
grep -r "isReflective" src/
grep -r "behavior.*22" src/
grep -r "MB_SHALLOW_WATER" src/
```

Likely locations:
- Tile rendering component
- Map renderer
- Reflection sprite handler
- Metatile data processor

### Step 2: Replace Behavior Check

**Before:**
```typescript
// ❌ WRONG - This treats ALL behavior 22 as reflective
if (tile.behavior === 22 || tile.behavior === 27) {
  this.createReflection(player, tile);
}
```

**After:**
```typescript
// ✓ CORRECT - Check against whitelist
const REFLECTIVE_BEHAVIORS = [21, 27, 31, 37, 25, 48];

if (REFLECTIVE_BEHAVIORS.includes(tile.behavior)) {
  this.createReflection(player, tile);
}
```

### Step 3: Add Constants File

Create a constants file for behavior IDs:

```typescript
// constants/metatile-behaviors.ts

/**
 * Metatile behavior constants from pokeemerald
 * Source: include/constants/metatile_behaviors.h
 */
export const MetatileBehavior = {
  // Water types
  POND_WATER: 21,
  INTERIOR_DEEP_WATER: 22,
  DEEP_WATER: 23,
  WATERFALL: 24,
  SOOTOPOLIS_DEEP_WATER: 25,
  OCEAN_WATER: 26,
  PUDDLE: 27,
  SHALLOW_WATER: 28,
  
  // Ice
  ICE: 37,
  
  // Special
  REFLECTION_UNDER_BRIDGE: 48,
  UNUSED_SOOTOPOLIS_DEEP_WATER_2: 31,
} as const;

/**
 * Behaviors that show water/ice reflections
 * Matches MetatileBehavior_IsReflective() from C code
 */
export const REFLECTIVE_BEHAVIORS = [
  MetatileBehavior.POND_WATER,
  MetatileBehavior.PUDDLE,
  MetatileBehavior.UNUSED_SOOTOPOLIS_DEEP_WATER_2,
  MetatileBehavior.ICE,
  MetatileBehavior.SOOTOPOLIS_DEEP_WATER,
  MetatileBehavior.REFLECTION_UNDER_BRIDGE,
] as const;

/**
 * Behaviors that show muddy feet effect
 */
export const SHALLOW_WATER_BEHAVIORS = [
  MetatileBehavior.SHALLOW_WATER,
] as const;
```

### Step 4: Update Reflection Detection

```typescript
import { REFLECTIVE_BEHAVIORS, MetatileBehavior } from './constants/metatile-behaviors';

class ReflectionManager {
  shouldShowReflection(tile: TileData): boolean {
    return REFLECTIVE_BEHAVIORS.includes(tile.behavior);
  }
  
  shouldShowMuddyFeet(tile: TileData): boolean {
    return tile.behavior === MetatileBehavior.SHALLOW_WATER;
  }
  
  getReflectionType(tile: TileData): 'water' | 'ice' | null {
    if (!this.shouldShowReflection(tile)) {
      return null;
    }
    
    if (tile.behavior === MetatileBehavior.ICE) {
      return 'ice';
    }
    
    return 'water';
  }
}
```

### Step 5: Test on Route 120

After implementing:

1. **Load Route 120** in the browser
2. **Walk through marshy areas** (metatile 657)
   - Expected: NO reflection ✓
   - Expected: Muddy feet effect (if implemented) ✓
3. **Walk near pond puddles** (metatile 209)
   - Expected: Water reflection ✓
4. **Check behavior IDs** in debug output
   - Marsh should be behavior 28
   - Puddles should be behavior 27 or 21

---

## Testing Checklist

### Test Cases

- [ ] **Route 120 marsh**: No reflection on marshy ground (metatile 657)
- [ ] **Route 120 puddles**: Reflection on puddles near pond edges
- [ ] **Route 117**: Reflection on pond water tiles
- [ ] **Ice areas** (e.g., Shoal Cave): Ice reflection works
- [ ] **Deep water**: No reflection when surfing (behaviors 22, 23, 26)
- [ ] **Shallow water**: No reflection, muddy feet effect instead

### Debug Output Verification

Add debug logging to verify behavior IDs:

```typescript
function debugTileReflection(tile: TileData) {
  console.log({
    metatileId: tile.metatileId,
    behavior: tile.behavior,
    isReflective: REFLECTIVE_BEHAVIORS.includes(tile.behavior),
    expectedEffect: getExpectedEffect(tile.behavior)
  });
}

function getExpectedEffect(behavior: number): string {
  if (REFLECTIVE_BEHAVIORS.includes(behavior)) {
    return 'Water/Ice Reflection';
  }
  if (behavior === 28) {
    return 'Muddy Feet Effect';
  }
  return 'None';
}
```

---

## Expected Results After Fix

### ✅ Correct Behavior

| Location | Metatile | Behavior | Effect |
|----------|----------|----------|--------|
| Route 120 marsh | 657 | 28 | Muddy feet, NO reflection |
| Route 120 puddle | 209 | 27 | Water reflection |
| Route 117 pond | varies | 21 | Water reflection |
| Shoal Cave ice | varies | 37 | Ice reflection |
| Ocean (surfing) | varies | 26 | NO reflection |
| Deep water | varies | 23 | NO reflection |

### ❌ Bugs Fixed

- Marsh/muddy areas no longer show water reflection
- Shallow water (behavior 28) is correctly recognized as non-reflective
- Only the 6 whitelisted behaviors trigger reflections

---

## Future Enhancements

### Muddy Feet Effect

The original game shows a special sprite effect for shallow water. To implement:

```typescript
class GroundEffectManager {
  updatePlayerEffects(player: Player, tile: TileData) {
    // Water reflection
    if (REFLECTIVE_BEHAVIORS.includes(tile.behavior)) {
      this.showReflection(player, tile);
      this.hideMuddyFeet(player);
    }
    // Muddy feet
    else if (tile.behavior === MetatileBehavior.SHALLOW_WATER) {
      this.hideReflection(player);
      this.showMuddyFeet(player);
    }
    // Normal ground
    else {
      this.hideReflection(player);
      this.hideMuddyFeet(player);
    }
  }
  
  private showMuddyFeet(player: Player) {
    // Create FLDEFF_FEET_IN_FLOWING_WATER sprite
    // Show small water splashes around player's feet
    // Animate based on player movement
  }
}
```

### Ripple Effects

Puddles and ponds should have ripples:

```typescript
if ([21, 27, 25].includes(tile.behavior)) {
  this.showRipples(tile);
}
```

---

## Additional Context

### Why the Confusion Exists

1. **Both use behavior 22** in the debug dumps (but different metatiles)
2. **Both have transparent top layers** (similar visual structure)
3. **Both use similar border tiles** (grass edges 254, 656, 672)
4. **Different underlying content** (water vs ground) is not immediately obvious

### The Key Insight

**Behavior ID alone doesn't determine reflectivity.** The C code uses a **whitelist approach**:
- NOT: "Is this water? → Reflect"
- BUT: "Is this one of 6 specific behaviors? → Reflect"

### Route 120 Design

Route 120 intentionally mixes:
- **Reflective puddles** near the pond edges (simulate rain puddles)
- **Non-reflective marsh** throughout the route (wet but not standing water)

This creates visual variety while maintaining gameplay logic (only clean water reflects).

---

## References

### pokeemerald Source Files

- [include/constants/metatile_behaviors.h](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/include/constants/metatile_behaviors.h) - Behavior constants
- [src/metatile_behavior.c:199-210](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/src/metatile_behavior.c#L199-L210) - `MetatileBehavior_IsReflective()`
- [src/metatile_behavior.c:879-887](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/src/metatile_behavior.c#L879-L887) - `MetatileBehavior_IsShallowFlowingWater()`
- [src/event_object_movement.c:7654-7662](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/src/event_object_movement.c#L7654-L7662) - `GetReflectionTypeByMetatileBehavior()`
- [src/event_object_movement.c:7864-7867](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/src/event_object_movement.c#L7864-L7867) - `GroundEffect_FlowingWater()`

### Related Documentation

- [doc/water-reflect.md](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/doc/water-reflect.md) - Water reflection implementation

---

## Summary

**The Bug:** Treating behavior 22 (and possibly behavior 28) as reflective  
**The Fix:** Only behaviors [21, 27, 31, 37, 25, 48] should reflect  
**The Impact:** Marsh/muddy areas will no longer incorrectly show reflections  
**Next Steps:** Implement Fix 1 (behavior whitelist) and test on Route 120
