---
title: Arrow Warp Research
status: reference
last_verified: 2026-02-13
---

## Arrow Warp Research

### Source References
- `public/pokeemerald/src/field_control_avatar.c`
- `public/pokeemerald/src/field_player_avatar.c`
- `public/pokeemerald/src/field_effect_helpers.c`
- `public/pokeemerald/src/data/field_effects/field_effect_objects.h`

### Metatile Behaviors
- Arrow warps use behaviors `MB_SOUTH_ARROW_WARP (101)`, `MB_NORTH_ARROW_WARP (100)`, `MB_WEST_ARROW_WARP (99)`, `MB_EAST_ARROW_WARP (98)`, and `MB_WATER_SOUTH_ARROW_WARP (109)`.
- `TryArrowWarp()` (`field_control_avatar.c`, lines 688-699) runs after movement input.  
  - Checks `IsArrowWarpMetatileBehavior(behavior, direction)` (i.e., player must walk into the arrow in its required direction).  
  - If a warp event exists at the player’s current position, it calls `DoWarp()` (standard fade transition, no door animation).
- This check is input-driven and applies while surfing as well (for water-arrow tiles), not just while walking.
- Arrow warps are *not* in the forced-movement list; the warp triggers immediately once the player attempts to step in the enforced direction.

### Visual Overlay
- Arrow overlay sprite is created per player object: `objectEvent->warpArrowSpriteId = CreateWarpArrowSprite()` (`field_player_avatar.c`, lines 1398-1405).
- `HideShowWarpArrow()` (`field_player_avatar.c`, lines 1441-1460):  
  - Checks current tile behavior via `sArrowWarpMetatileBehaviorChecks2[]`.  
  - Only shows the overlay when the behavior matches the player’s current facing direction.  
  - Places the sprite one tile ahead (`MoveCoords(direction, &x, &y)`), i.e., over the actual warp tile.  
  - If behavior/direction mismatch, calls `SetSpriteInvisible`.
- `CreateWarpArrowSprite()` / `ShowWarpArrowSprite()` (`field_effect_helpers.c`, lines 175-208):  
  - Assets: `graphics/field_effects/pics/arrow.4bpp`, 16×16 sprite, tag-less tile/palette.  
  - Animation tables (`field_effect_objects.h`, lines 221-275):  
    - 8 frame images arranged per direction, but each direction animates between two frames (`ANIMCMD_FRAME(..., 32)`).  
    - Direction ordering: south, north, west, east (`StartSpriteAnim(sprite, direction - 1)`).

### Warp Execution
- Upon successful `TryArrowWarp`, the game:
  - Calls `StoreInitialPlayerAvatarState()` and `SetupWarp()` (same path as other instant warps).  
  - Invokes `DoWarp()` → standard fade out, `Task_WarpAndLoadMap`, fade in, `FieldCB_DefaultWarpExit`.
- No door overlay or forced walk sequence. The player simply appears at the destination warp coordinates after fade-in, facing the direction defined by `FieldCB_DefaultWarpExit` (usually south).

### Behavior Summary for React Port
1. **Detection:**  
   - After each movement input, if the tile under the player has `MB_*_ARROW_WARP` and the input direction matches the arrow, trigger an arrow warp.
2. **Overlay:**  
   - Maintain a dedicated sprite (canvas layer) that follows the player.  
   - Show the arrow sprite only when the current tile behavior is an arrow warp and the player is facing the enforced direction.  
   - Position it on the tile ahead; hide it otherwise.  
   - Animate by toggling between two frames every ~32 ticks (match GBA timing if possible; otherwise 2-frame loop at ~0.5s total).
3. **Warp Flow:**  
   - Lock input, run standard fade out, load destination map, fade in (reuse existing warp state machine with a new `kind: 'arrow'`).  
   - No door animation or scripted walk; player simply appears at destination.
4. **Assets:**  
   - Use `public/pokeemerald/graphics/field_effects/pics/arrow.4bpp` for sprite frames.  
   - Palette is the default field-effect palette (no per-map variants).  
   - Four animations (south/north/west/east) defined in `sArrowAnim_*`; we can store frames in a single spritesheet and map per direction.

### Open Questions / TODO
- Confirm fade duration for `DoWarp()` vs door warps to match timing.  
- Verify if any arrow warps use custom sound effects (none observed in `DoWarp()` but worth double-checking `field_screen_effect.c`).  
- Identify maps that use arrow warps (Trick House, Petalburg Woods exit, certain building interiors) for test cases.
