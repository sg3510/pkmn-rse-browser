---
title: Marsh Reflection Findings
status: research
last_verified: 2026-01-13
---

# Marsh Reflection Findings

## Analysis of `pokeemerald` Source Code

I have investigated the source code of `pokeemerald` to understand the behavior of puddles and marsh tiles.

### Behavior IDs
- **MB_PUDDLE (22)**: This behavior is defined in `include/constants/metatile_behaviors.h`.
- **MB_SHALLOW_WATER (23)**: This behavior is defined immediately after.

### Reflection Logic
In `src/metatile_behavior.c`, the function `MetatileBehavior_IsReflective` explicitly includes `MB_PUDDLE`:

```c
bool8 MetatileBehavior_IsReflective(u8 metatileBehavior)
{
    if (metatileBehavior == MB_POND_WATER
     || metatileBehavior == MB_PUDDLE // <--- 22 is reflective
     ...
        return TRUE;
    else
        return FALSE;
}
```

`MB_SHALLOW_WATER` (23) is **NOT** in this list, so it is not reflective.

### Ground Effects (Splash vs Flowing Water)
In `src/event_object_movement.c`:
- **MB_PUDDLE (22)** triggers `GetGroundEffectFlags_Puddle`, which causes `GroundEffect_StepOnPuddle`, which starts `FLDEFF_SPLASH`.
- **MB_SHALLOW_WATER (23)** triggers `GetGroundEffectFlags_ShallowFlowingWater`, which causes `GroundEffect_FlowingWater`, which starts `FLDEFF_FEET_IN_FLOWING_WATER`.

### Conclusion on Fortree/Route 120 Tiles
The marsh tiles in Fortree/Route 120 are tagged as **MB_PUDDLE (22)** in the tileset data.
Therefore, in the original `pokeemerald` game:
1.  They **DO** reflect the player/NPCs.
2.  They **DO** cause a splash effect (`FLDEFF_SPLASH`).

The previous assumption that "marshy feet" implies non-reflective behavior was incorrect regarding the actual game implementation. If the goal is to **mirror `pokeemerald`**, these tiles *should* be reflective.

The `BEHAVIOR_OVERRIDES` in `MapRenderer.tsx` was forcing these tiles to `MB_SHALLOW_WATER` (23), which disabled reflection and changed the effect to "feet in flowing water". This was a deviation from the original game's logic.

To strictly mirror `pokeemerald`, we should remove the override and allow behavior 22 to be reflective.
