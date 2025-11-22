# Sand Footprints Implementation Details

## Overview
Sand footprints are temporary field effects that appear when a player or NPC walks on sand tiles. They persist for a short duration, flicker, and then disappear.

## Triggering Tiles
The effect is triggered by specific metatile behaviors:
- **MB_SAND (38)**: Standard sand footprints (`FLDEFF_SAND_FOOTPRINTS`).
- **MB_DEEP_SAND (11)**: Deep sand footprints (`FLDEFF_DEEP_SAND_FOOTPRINTS`).

Common tiles with these behaviors include:
- **Sand**: 664, 673, 292, 601, 298 (as noted by user).

## Sprite Assets
- **Image**: `graphics/field_effects/pics/sand_footprints.png` (4bpp)
- **Deep Sand Image**: `graphics/field_effects/pics/deep_sand_footprints.png` (4bpp)
- **Size**: 16x16 pixels (standard tile size).

## Rendering Logic

### Creation
- Triggered in `event_object_movement.c` via `GroundEffect_StepOnSand` or similar.
- Created using `CreateSpriteAtEnd`.
- Positioned at the tile coordinates (centered with 8,8 offset).

### Z-Layering
- **Priority**: Set via `gFieldEffectArguments[3]`. Typically matches the player's priority or slightly below/above depending on the specific effect setup (usually priority 1 or 2).
- **Subpriority**: Managed to ensure they render correctly relative to the player and other sprites.

### Animation & Fading
The lifecycle is managed by `UpdateFootprintsTireTracksFieldEffect` in `field_effect_helpers.c`:

1.  **Wait Phase (Step 0)**:
    - The sprite remains visible and static for **40 frames**.
    - `sprite->sTimer` increments until it exceeds 40.

2.  **Flicker Phase (Step 1)**:
    - The sprite toggles visibility every frame (`sprite->invisible ^= 1`).
    - This creates a flickering/fading effect.
    - Lasts for **16 frames** (until `sprite->sTimer > 56`).

3.  **Cleanup**:
    - Once `sTimer > 56`, the effect is stopped and the sprite is removed (`FieldEffectStop`).

## Implementation Plan for React
1.  **GrassEffectManager Expansion**:
    - Rename to `FieldEffectManager` or similar to handle generic effects.
    - Add support for `sand` and `deep_sand` types.
2.  **Lifecycle Management**:
    - Implement the 40-frame wait + 16-frame flicker logic.
    - Ensure `cleanup` removes them after 56 frames.
3.  **Rendering**:
    - Load `sand_footprints.png`.
    - Render in `MapRenderer` with appropriate Z-index (likely 'bottom' layer, behind player).
