This outlines how Emerald renders character/NPC reflections on water/ice and what we need to mirror in the browser.

## Where the logic lives
- Reflection ground effect: `public/pokeemerald/src/event_object_movement.c`
  - `GetGroundEffectFlags_Reflection` sets `GROUND_EFFECT_FLAG_WATER_REFLECTION` or `GROUND_EFFECT_FLAG_ICE_REFLECTION` when the object steps onto a reflective metatile.
  - Reflective detection uses `ObjectEventGetNearbyReflectionType` → `GetReflectionTypeByMetatileBehavior` → `MetatileBehavior_IsReflective`.
  - Reflective metatile behaviors: `MB_POND_WATER`, `MB_PUDDLE`, `MB_UNUSED_SOOTOPOLIS_DEEP_WATER_2`, `MB_ICE`, `MB_SOOTOPOLIS_DEEP_WATER`, `MB_REFLECTION_UNDER_BRIDGE` (`public/pokeemerald/src/metatile_behavior.c`).
  - The scan searches a rectangle under the sprite: width = ceil((sprite.width + 8)/16) tiles, height = ceil((sprite.height + 8)/16), offset 1 tile downward from the anchor. Both current and previous coords are checked to keep reflections when moving.
- Reflection sprite rendering: `public/pokeemerald/src/field_effect_helpers.c`
  - `SetUpReflection` creates a copy sprite with inverted Y (OAM vflip), same tiles as the source, palette remapped via `gReflectionEffectPaletteMap`, priority 3 (so it sits above background but under player/NPC top layer).
  - `UpdateObjectReflectionSprite` keeps the reflection in sync each frame: mirrors matrix (hflip-aware), copies shape/size/subsprites/tileNum, positions it at `(main.x, main.y + heightOffset + bridgeOffset)` and sets `y2 = -main.y2` so bobbing is mirrored. Hidden if `hasReflection` is cleared.
  - Palette choice: `LoadObjectRegularReflectionPalette` uses a reflectionPaletteTag from graphics info (player/NPC specific) and blends with weather. Bridges use a darker palette via `LoadObjectHighBridgeReflectionPalette` when `MB_REFLECTION_UNDER_BRIDGE` or bridge types hit.
  - Vertical offsets: base offset = sprite height - 2; bridges add `[12,28,44]` depending on bridge height (`MetatileBehavior_GetBridgeType` keyed off current/previous metatile).
  - Wavy distortion: Two hidden `FLDEFFOBJ_REFLECTION_DISTORTION` sprites are spawned at startup. They run affine animations (`sAffineAnims_ReflectionDistortion`) that cycle the X-scale of affine matrices 0 and 1.
    - **Animation**: The X-scale pulses by roughly 1.5% (adds `4/256` to scale over 4 frames, waits 8 frames, subtracts `4/256` over 4 frames).
    - **Effect**: This creates a subtle horizontal "breathing" or "shiver" effect on the reflection.
    - **Implementation**: The reflection sprite sets `oam.matrixNum` to 0 or 1 (depending on H-flip) to opt-in to this global affine transformation.
- Ground effects scheduler: `GetAllGroundEffectFlags_OnBeginStep/OnFinishStep` (same file) triggers the reflection flag when stepping into reflective tiles and clears `hasReflection` otherwise.

## Maps/tilesets where reflections appear
- Any map using reflective behaviors on metatiles:
  - Pond water / puddles: common in routes/towns (e.g., Route 117 ponds, Littleroot puddles).
  - Ice: Shoal Cave ice.
  - Sootopolis deep water (and the unused variant).
  - Under-bridge reflection tiles (Route 120 bridge over water).
- Determining metatiles: `metatile_attributes.bin` plus `metatile_behaviors.h` mapping; behaviors are encoded in the lower byte of attributes. The behavior applies to the whole 16×16 metatile; there is no per-8×8 clipping. Mixed land/water metatiles still count as reflective for the entire tile if they carry a reflective behavior.

## Layering considerations
- Reflections are separate sprites (not tile animations). They render under the main sprite but above most background; priority 3 in OAM matches NPC sprite priority rules.
- Shadows are suppressed on reflective surfaces (`FieldEffectStop` check in `UpdateShadowFieldEffect`), so reflection replaces shadow.
- Reflection respects sprite invisibility/hiding and stops when `hasReflection` toggles off.
- Water surfaces themselves can animate independently: ripples (`GroundEffect_Ripple`, `FLDEFF_RIPPLE`) are spawned when stepping into ripple-enabled water/puddles (`MetatileBehavior_HasRipples`), and shallow flowing water has its own ground effect (`GroundEffect_FlowingWater`). These are separate sprites layered with priority from the triggering sprite and don’t alter the reflection logic, but they add “shiver” motion to water tiles. Combined with the reflection’s subtle affine wobble, still water appears gently flowy (e.g., Route 104/117 ponds).

## What we need in the browser
1) Detect reflective tiles:
   - Decode metatile behaviors; flag tiles whose behavior is one of the reflective set.
   - When the player or NPC moves, scan beneath/around them with the same offset/size heuristic to decide if reflection should be shown.
2) Draw reflection:
   - Mirror the current sprite frame vertically (vflip) and reuse the same frame/tile data; apply a palette tweak (at minimum, a darker/more transparent version of the base palette; ideally mimic `gReflectionEffectPaletteMap`).
   - Position: same X, Y shifted down by `(spriteHeight - 2)` plus any bridge offset. Invert bobbing offset (negate y2 equivalent).
   - Layer: render after the background and animated tiles but before top-layer tiles that cover the player (respect `METATILE_LAYER_TYPE_NORMAL/SPLIT`).
3) Bridges/ice:
   - If the behavior is ice, reflection type = ice; if under-bridge reflective tiles, apply the darker “high bridge” palette and extra vertical offset (12/28/44 by bridge height).
4) Cleanup:
   - Hide/omit the reflection when leaving reflective tiles or when the sprite is hidden.

## Files to reference
- `public/pokeemerald/src/event_object_movement.c` (reflection ground effect, `ObjectEventGetNearbyReflectionType`, `GetGroundEffectFlags_Reflection`).
- `public/pokeemerald/src/metatile_behavior.c` (which behaviors count as reflective).
- `public/pokeemerald/include/event_object_movement.h` (reflection enum).
- `public/pokeemerald/src/field_effect_helpers.c` (reflection sprite creation, palette handling, per-frame sync, bridge offsets).
- `public/pokeemerald/src/field_effect.c` (dispatcher for field effects).
- Optional palette specifics: `gReflectionEffectPaletteMap` and object palettes in `public/pokeemerald/src/event_object_movement.c` / graphics info tables.

## Implementation sketch (React)
- Precompute a set of reflective metatile IDs by reading metatile attributes (behavior byte) and matching reflective behaviors.
- On each player/NPC update, determine `hasReflection` by scanning underneath using the width/height heuristic and the 1-tile downward offset.
- If reflective, render a vflipped copy of the current sprite:
  - Use the same frame/tile sheet already loaded; apply a simple palette transform (e.g., darken + slight alpha) to approximate GBA reflection palettes (`gReflectionEffectPaletteMap` uses dedicated darker palettes).
  - Position at `y + spriteHeight - 2 (+ bridgeOffset)` and negate bobbing offset.
  - Draw in the same pass as the player sprite, but behind the player and above animated background.
- Remove reflection when `hasReflection` is false or sprite hidden.

## On-map-load plan (browser)
1) Parse metatile behaviors for both tilesets; build `reflectiveMetatileIds` by testing behaviors against the reflective set.
2) At map load, optionally flag whether any reflective tiles exist to enable/disable reflection logic early.
3) Each frame, when updating sprites:
   - Compute reflection type and presence by scanning the rectangle under the sprite (width = ceil((sprite.w + 8)/16), height = ceil((sprite.h + 8)/16), offset +1 tile down; current + previous coords).
   - If reflective, render the mirrored sprite with palette dampening and apply a small periodic scale wobble (approx ±1–2% at ~1–2 Hz) to mimic `FLDEFFOBJ_REFLECTION_DISTORTION`; Y-offset = spriteHeight - 2 plus bridge offset when the underlying behavior is `MB_REFLECTION_UNDER_BRIDGE`/bridge tiles.
   - Layer it: after background/animated tiles, before the player/NPC draw, and below top tiles (NORMAL/SPLIT). Suppress shadows while reflection is visible.
   - Hide immediately when leaving reflective surfaces or when the sprite is invisible.

This logic gives us the Route 117 pond reflection (and other reflective surfaces) without relying on hardcoded tile IDs.***

___
old doc:
# Water Reflection Implementation in pokeemerald

This document details the implementation of the water reflection effect found in maps like Route 117 (ponds) and puddles.

## Overview

The water reflection effect creates a mirrored image of the player or NPC in the water when they are standing near it. This effect is achieved using a secondary sprite (the reflection) that is vertically flipped and placed below the main sprite. The "clipping" effect (where the reflection is only visible on water and not on the surrounding land) is achieved through the Game Boy Advance's hardware layer priority system.

## Core Logic

### 1. Trigger Mechanism
The game constantly checks the tiles surrounding an object event (player or NPC) to determine if a reflection should be generated.

- **Function**: `GetGroundEffectFlags_Reflection` in `src/event_object_movement.c`.
- **Check**: It calls `ObjectEventGetNearbyReflectionType`.
- **Directionality**: `ObjectEventGetNearbyReflectionType` specifically checks tiles **below** the object (South). This is because, from the game's perspective, a reflection would naturally appear "below" the character on the screen.
    - It scans `y + 1` to `y + height` relative to the object.
- **Tile Identification**: It uses `GetReflectionTypeByMetatileBehavior` which checks `MetatileBehavior_IsReflective`.

### 2. Reflective Tiles
A tile is considered reflective if its metatile behavior matches specific constants.

- **File**: `src/metatile_behavior.c`
- **Function**: `MetatileBehavior_IsReflective`
- **Reflective Behaviors**:
    - `MB_POND_WATER` (Used in Route 117)
    - `MB_PUDDLE`
    - `MB_SOOTOPOLIS_DEEP_WATER`
    - `MB_ICE` (Returns `REFL_TYPE_ICE` instead of `REFL_TYPE_WATER`)
    - `MB_REFLECTION_UNDER_BRIDGE`

### 3. Sprite Creation & Rendering
When a reflection is needed, a new sprite is created.

- **File**: `src/field_effect_helpers.c`
- **Function**: `SetUpReflection`
- **Sprite Properties**:
    - **Priority**: `3`. This is crucial.
        - **Land/Ground**: Typically Priority `2`.
        - **Water**: Typically Priority `3` (Background).
        - **Result**: Land (Prio 2) draws *over* the Reflection (Prio 3), while the Reflection (Prio 3) draws *over* the Water (Prio 3, as Sprites usually appear above BG of same priority). This creates the perfect mask where the reflection is only visible on the water.
    - **Vertical Flip**: `reflectionSprite->oam.matrixNum |= ST_OAM_VFLIP`.
    - **Position**: `y = mainSprite->y + GetReflectionVerticalOffset(...)`. The offset places it directly below the character's feet.

### 4. Palette Management
Reflections use specific palettes to look "watery" (often tinted or semi-transparent look, though implemented as a palette swap).

- **File**: `src/event_object_movement.c`
- **Mapping**: `gReflectionEffectPaletteMap` maps normal palette tags to reflection palette tags.
    - Example: `OBJ_EVENT_PAL_TAG_BRENDAN` -> `OBJ_EVENT_PAL_TAG_BRENDAN_REFLECTION`.
- **Loading**: `LoadObjectReflectionPalette` handles loading the correct palette.

### 5. Animation Sync
The reflection sprite must mimic the main sprite's animation.

- **Function**: `UpdateObjectReflectionSprite` in `src/field_effect_helpers.c`.
- **Sync**: It copies the `oam.shape`, `oam.size`, `oam.tileNum`, `x`, and `y` (with offset) from the main sprite every frame.
- **Invisibility**: If the main sprite becomes invisible, or the player moves away from water (`hasReflection` becomes false), the reflection is hidden/destroyed.

## Summary of Relevant Files

| File | Purpose |
|------|---------|
| `src/event_object_movement.c` | Trigger logic (`GetGroundEffectFlags_Reflection`), Palette definitions, Neighboring tile checks. |
| `src/field_effect_helpers.c` | Sprite creation (`SetUpReflection`), Update loop (`UpdateObjectReflectionSprite`). |
| `src/metatile_behavior.c` | Defines which tiles are reflective (`MetatileBehavior_IsReflective`). |
| `include/metatile_behavior.h` | Header for metatile behaviors. |

## Animation Details

### Static vs. Animated
- **Standard Reflection**: The reflection sprite itself is **static**. It does not have any independent "shiver", "wave", or distortion effect applied to it.
- **Water Movement**: The "flowy" feel of water comes from the *underlying water tiles* which have their own palette animation or tile animation. The reflection simply sits on top of this.
- **Bobbing**: If the player is surfing, the player sprite bobs up and down. Since the reflection mirrors the player's Y position, the reflection will also bob. This is not a separate effect but a consequence of the parent sprite's movement.
- **Scanline Effects**: While the engine supports wave effects (`ScanlineEffect_InitWave`), they are **not** used for standard overworld reflections.

## Implementation Steps for React App

To replicate this in the React application:

1.  **Identify Reflective Tiles**: Mark water tiles in the map data (e.g., Route 117 ponds) as "reflective".
2.  **Check Proximity**: In the player/NPC update loop, check if there are reflective tiles immediately below the character.
3.  **Render Reflection**:
    -   Draw a duplicate of the character sprite.
    -   Apply a vertical flip transform (`scaleY(-1)`).
    -   Position it below the character.
    -   **Z-Index/Layering**: Ensure the reflection is drawn *below* the ground layer but *above* the water layer.
        -   If using a single canvas, draw order: Water -> Reflection -> Ground -> Character.
    -   **Visual Style**: Apply a CSS filter or canvas blend mode (e.g., `opacity: 0.6` or a teal tint) to mimic the palette swap.
    -   **Animation**: Do **not** apply a sine wave or distortion to the reflection sprite unless you want to deviate from the original game. The water tile animation underneath should provide enough visual interest.