# Warping Implementation Plan (React, based on `public/pokeemerald`)

Goal: Port Pokémon Emerald–style warps (doors, pads, arrows, dive/fall) into the React renderer using the actual GBA logic as reference. Each step is small, actionable, and references the C source we mirror.

## 0) Prep & References
- [ ] Re-read summary in `doc/warping-poke-emerald.md` and the cited C files as we work: `public/pokeemerald/src/field_control_avatar.c`, `fieldmap.c`, `field_effect.c`, `field_door.c`, `metatile_behavior.c`, `event_object_movement.c`, `region_map.c`.
- [ ] Confirm existing map data in our app includes: warp events per map, metatile behaviors, map connections, border tiles, and player state store.

## 1) Data Shapes & Warp Buffers
- [ ] Mirror warp event structs from `fieldmap.c`/`overworld.c` (`warpGroup/mapNum/warpId/x/y/warpType`). Create TS types for `WarpEvent`, `WarpDestination`, `EscapeWarp`, `DynamicWarp`, `LastHealWarp`.
- [ ] Add a warp buffer store (React state or zustand) that matches `gSaveBlock1Ptr` slots: `warpDestination`, `escapeWarp`, `dynamicWarp`, `lastHealLocation`. Initialize from map metadata like Emerald does on map load.
- [ ] Ensure map headers expose warp arrays and any warp flags; if missing in our JSON, extend the map loader (see `public/pokeemerald/data/maps/*/map.json` equivalents).

## 2) Metatile Behavior Detection (Collision Layer)
- [ ] Port `TryDoMetatileBehaviorWarp` logic from `field_control_avatar.c` and `metatile_behavior.c`: detect warp on the tile underfoot (pads/arrows) and on facing tile for doors.
- [ ] Implement helpers mirroring C predicates (`MetatileBehavior_IsWarpDoor`, `_IsArrowWarp`, `_IsTeleportPad`, `_IsDiveWarp`, `_IsFallWarp`), keyed off our behavior IDs. Keep the names close to C for clarity.
- [ ] In the movement loop, after a step resolves collision, call the warp detector; if true, populate `warpDestination` buffer and pause input (like `DoWarp` task does).

## 3) Warp Task / State Machine
- [ ] Create a small warp state machine modeled on `field_screen_effect.c` (`DoWarp`, `TryDoWarp`). States: `idle -> fadeOut -> mapSwap -> fadeIn -> resume`.
- [ ] When triggered, lock controls, stop movement queue, and select transition type based on warp type + map header (consult `DoWarp`, `DoDoorWarp`, `DoTeleportTileWarp`).
- [ ] After `fadeOut`, call a `applyCurrentWarp()` that loads the target map and positions the player (see Step 4). After `fadeIn`, clear warp buffer and unlock input.

## 4) Map Swap & Spawn Positioning
- [ ] Implement `applyCurrentWarp` by porting `ApplyCurrentWarp` from `fieldmap.c`: resolve target map by `mapGroup/mapNum/warpId` (or `warpId == 0x7F` -> use provided `x/y` like Emerald dynamic warp).
- [ ] Compute spawn coords: door-style warps place the player one tile in front of the target warp facing south; pad/teleport preserve or set facing based on tile behavior. Mirror the offset logic in `FieldCB_DefaultWarpExit`.
- [ ] Update world/map manager to load the new map, adjust camera to keep player centered, and rehydrate border/connection info to allow immediate exit warps.

## 5) Visual Transitions & Field Effects
- [ ] Add fade templates mirroring `WarpFadeOutScreen`/`WarpFadeInScreen` in `field_screen_effect.c`: black fade for standard doors, white flash for teleport pads, quick fade for caves.
- [ ] Port door overlays from `field_effect.c`/`field_door.c`: render an overlay sprite over the metatile when entering/exiting a door warp (`FldEff_DoorOpen/Close`). Time the overlay to finish before map swap.
- [ ] Add teleport pad sparkle/spin effect (Aqua/Magma) based on `DoTeleportTileWarp`: play SE, hide player during spin-out/in.
- [ ] Hook these effects into the warp state machine so they run automatically per warp type.

## 6) Arrow Warps & Forced Movement
- [ ] Use `event_object_movement.c` + `field_player_avatar.c` as templates: when stepping onto `MB_ARROW_WARP_*`, enqueue forced movement in that direction, show/hide arrow overlay (`ShowWarpArrowSprite` analog), and trigger warp when movement stops on the destination pad.
- [ ] Ensure overlays are tied to the tile position and hidden when leaving the tile (`SetSpriteInvisible` analog).

## 7) Special Warp Types
- [ ] Dive/Surface: Mirror `DoDiveWarp`/`DoFallWarp` to set surf/dive state flags and choose correct map pair. Update player sprite variant accordingly on exit.
- [ ] Fall-through holes (Mt. Pyre) and sand hops (Lavaridge): trigger warp with ash puff effect (`field_effect.c`) and a small delay before fade.
- [ ] Escalators/elevators: reuse `DoEscalatorWarp` pattern—forced movement + fade during movement.
- [ ] Secret Base / escape/dynamic warps: support setting `dynamicWarp`/`escapeWarp` buffers from scripts/items and prioritize them like Emerald.

## 8) Return & Connection Handling
- [ ] When entering from overworld into an indoor map, store the exterior door as the “return warp” (Emerald auto-populates via warp index). On exit, default to that stored warp unless a script overrides it.
- [ ] Respect map connections: when resolving `warpId` targets, allow connected-map lookup to match Emerald’s behavior where door exits are implicit via connections.
- [ ] Use `region_map.c`/`rom_header_gf.c` for rules on special save warps (e.g., blacking out to last heal); mirror that selection logic.

## 9) Player Facing & Input Lock Rules
- [ ] Align facing rules with C: door exits face south; pad/teleport preserve facing unless tile enforces direction; spin warps set direction after spin; arrows force direction.
- [ ] Lock input at warp start, unlock only after `fadeIn` completes. Clear movement queue to prevent buffered steps (same as `DoWarp` task).

## 10) Testing & Toggles
- [ ] Add a developer toggle to log warp triggers and buffer contents (helps compare with C flow).
- [ ] Create test scenarios mirroring Emerald: Petalburg Woods arrows, Magma/Aqua HQ pads, Littleroot house door, Dive spot, Mt. Pyre hole. Verify facing, transition, and return warp correctness.
- [ ] Gate new warp system behind a feature flag until parity is proven; the flag should switch between legacy behavior and the new state machine for easy regression checks.
