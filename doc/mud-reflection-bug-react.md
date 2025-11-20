# Route 120 Mud/Puddle Reflection: React vs. pokeemerald Debug Notes

## What the engine does (C)
- Reflective whitelist: `MB_POND_WATER (16)`, `MB_PUDDLE (22)`, `MB_UNUSED_SOOTOPOLIS_DEEP_WATER_2 (26)`, `MB_ICE (32)`, `MB_SOOTOPOLIS_DEEP_WATER (20)`, `MB_REFLECTION_UNDER_BRIDGE (43)`.
- Shallow water (`MB_SHALLOW_WATER = 23`) is **not** reflective; it spawns `FLDEFF_FEET_IN_FLOWING_WATER`.
- Puddles (`MB_PUDDLE = 22`) spawn `FLDEFF_SPLASH` and reflect; there is no color/palette gate—behavior+BG1 mask only.
- Scan rectangle: width = `(sprite.w+8)>>4`, height = `(sprite.h+8)>>4`; starts at y+1 below anchor, checks current+previous coords.

## Current React overrides (Fortree tileset)
- We remap Fortree metatiles **628, 629, 636, 637, 657** to `MB_SHALLOW_WATER` to suppress false reflections on marsh tiles.
- Other Fortree metatiles with behavior 22 (e.g., **665**, 208–210) remain reflective.

## Dump findings
- **Dump1 (25,36)**: Reflection mask comes from tile (25,37) metatile **665**, behavior **22** (not overridden) ⇒ reflection shows even though immediate tiles (657) are non-reflective. That’s why “mud” still reflects here.
- **Dump2 (same pos)**: Mask still from (25,37) **665**; only tip of hair reflects because only the lower reflective row contributes (y+2), and mask is limited to that row’s transparent pixels.
- **Dump3 (23,34)**: Mask from puddle tiles (209/208) two rows down → lower part reflects; hair clipped because only one reflective row participates (y+1), no reflective coverage at y+2.
- **Dump4**: All tiles reflective around the player ⇒ full reflection works.
- **Dump5**: MaskPixels=0 ⇒ scan rectangle didn’t hit any reflective behavior; no reflection drawn (expected when no puddle in y+1/y+2).

## Conclusions
- The remaining “bad” reflections come from Fortree metatiles with behavior 22 that we did **not** override (e.g., **665**). The renderer is behaving authentically: any behavior-22 tile in the scan rectangle will reflect; mask coverage depends on BG1 transparency of that tile row.
- Partial reflections (only hair or only lower sprite) are due to the scan rectangle hitting reflective tiles only in one of the checked rows, and/or limited BG1-transparent pixels in those tiles.

## Fix options
1) **Extend overrides** for Route 120: add Fortree metatiles like **665** (and any other marshy variants) to `MB_SHALLOW_WATER` so they won’t reflect but can still trigger the feet-in-water effect if desired.
2) **Per-map behavior remap**: for Route 120 specifically, remap the marsh metatiles to shallow water; leave other maps untouched.
3) **Data fix** (upstream): change the metatile behaviors in the Fortree tileset if the art truly isn’t puddle; this would match the C engine without React overrides.

Given the dumps, option (1) is the quickest for authentic behavior: marsh tiles stop reflecting; real puddles (209/210/etc.) keep reflecting. If we stick with the scan rectangle and BG1 masking from the engine, partial reflections will occur whenever only one of the scanned rows is reflective—matching Emerald’s behavior.***
