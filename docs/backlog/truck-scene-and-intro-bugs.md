---
title: "Bug Report: Truck Scene & Intro Sequence Bugs"
status: investigation-complete
last_verified: 2026-02-07
priority: high
---

# Truck Scene & Intro Sequence Bugs

Deep investigation of 7 reported bugs in the truck scene through first house entry,
plus 2 additional observed issues (viewport centering, prof/truck visibility).

---

## Bug 1: Tiles Change Color During Truck Movement

**Severity:** Medium
**Files:** `src/game/TruckSequence.ts`, `src/pages/GamePage.tsx:1651-1658`

### Observed Behavior
During the truck movement sequence, tiles appear to shift color. When the truck stops, the door "opens" with light tiles appearing.

### Root Cause
The truck scene is **missing the door metatile swap**. In the GBA, the inside-of-truck map starts with the door tiles set to `METATILE_InsideOfTruck_ExitLight_*` (light/open), then `ExecuteTruckSequence()` immediately overwrites them to `METATILE_InsideOfTruck_DoorClosedFloor_*` (dark/closed). When the sequence finishes (state 5, +120 frames), the metatiles are swapped back to ExitLight, and `DrawWholeMapView()` redraws the map.

The TypeScript implementation (`TruckSequence.ts`) only implements camera shake — it has no metatile-swapping capability. The door is always in its default (light/open) state from `InsideOfTruck_OnLoad`, so the "color change" the user sees is likely the static light tiles combined with the camera shake creating a visual illusion of change.

### C Reference
`public/pokeemerald/src/field_special_scene.c:248-264`:
```c
// State 5: Swap door metatiles from closed to open
MapGridSetMetatileIdAt(4+MAP_OFFSET, 1+MAP_OFFSET, METATILE_InsideOfTruck_ExitLight_Top);
MapGridSetMetatileIdAt(4+MAP_OFFSET, 2+MAP_OFFSET, METATILE_InsideOfTruck_ExitLight_Mid);
MapGridSetMetatileIdAt(4+MAP_OFFSET, 3+MAP_OFFSET, METATILE_InsideOfTruck_ExitLight_Bottom);
DrawWholeMapView();
```

Metatile IDs defined in `public/pokeemerald/include/constants/metatile_labels.h:252-258`.

### Also Missing: Box Sprite Offsets and Step Callback

The TS implementation is also missing:

- **Moving box physics:** The 3 box sprites (`LOCALID_TRUCK_BOX_TOP/BOTTOM_L/BOTTOM_R`) should bounce during the driving sequence via `SetObjectEventSpritePosByLocalIdAndMap()`. Each box has distinct timing offsets and amplitudes (`field_special_scene.c:89-108`). Currently boxes are static in TS.

- **Step callback reset:** On the GBA, `InsideOfTruck_OnResume` sets `STEP_CB_TRUCK` (`scripts.inc`), which is mapped to `EndTruckSequence` in the step callback table (`field_tasks.c:66`). When the player takes their first step, this callback fires and ends the truck driving mode. The TS port lacks this step-callback mechanism — the truck sequence ends purely by frame count.

### Proposed Fix
1. Add a `setMetatileAt(x, y, metatileId)` API to WorldManager or the map layer system
2. On truck sequence start: swap door tiles to DoorClosedFloor variants (dark)
3. At sequence phase 5 completion (~840 frames): swap back to ExitLight variants (light)
4. Trigger a full map redraw after each swap
5. Metatile IDs: Closed = `0x20D/0x215/0x21D`, Open = `0x208/0x210/0x218`
6. Implement box sprite bouncing with per-box offsets matching `field_special_scene.c`
7. Add step-callback system or equivalent to end truck mode on first player step

---

## Bug 2: Start Menu Accessible During Truck Scene

**Severity:** High
**File:** `src/pages/GamePage.tsx:458-480`

### Observed Behavior
Player can open the start menu (Enter key) during the truck cutscene, even though movement is locked.

### Root Cause
The menu open handler at `GamePage.tsx:460-475` checks `currentState`, `dialogIsOpen`, `player?.isMoving`, and `menuStateManager.isMenuOpen()` — but does **NOT** check `truckSequenceRef.current`. The truck lock is only applied to player movement (`GamePage.tsx:1403-1405`), not to menu input.

```typescript
// Line 460-475: MISSING truckLocked check
const handleMenuKey = (e: KeyboardEvent) => {
  if (currentState !== GameState.OVERWORLD) return;
  if (dialogIsOpen) return;
  if (player?.isMoving) return;
  if (menuStateManager.isMenuOpen()) return;
  // BUG: No check for truckSequenceRef.current
  if (e.code === 'Enter') {
    menuStateManager.open('start');
  }
};
```

### Proposed Fix
Add truck lock check to menu handler. Two options:

**Option A (quick):** Add `truckSequenceRef` check inside the handler:
```typescript
if (truckSequenceRef.current && !truckSequenceRef.current.isComplete()) return;
```

**Option B (robust):** Create a `isInputLocked()` helper that consolidates all lock checks (truck, story script, dialog, warping) so they can't get out of sync. Use this for both movement and menu input. This would also prevent the menu from opening during story scripts, warps, etc.

---

## Bug 3: Truck Positioning & Screen Jump on Exit

**Severity:** Medium
**Files:** `src/rendering/spriteUtils.ts:544-572`, `src/game/ObjectEventManager.ts:85-97`

### Observed Behavior
When exiting the truck to Littleroot Town, the truck sprite appears badly positioned and the screen/camera jumps.

### Root Cause Analysis

**Truck sprite positioning:** The truck is a 48x48 sprite positioned at its map object event coordinates. In Littleroot Town, Brendan's truck is at `(2, 10)` and May's at `(11, 10)` per `data/maps/LittlerootTown/map.json:78-101`.

The GBA uses a subsprite table (`sOamTables_48x48`) to compose the 48x48 image from multiple smaller hardware sprites, each with specific x/y offsets relative to the object event's center position. The browser port renders it as a single 48x48 sprite from `createLargeObjectSpriteInstance()` (`spriteUtils.ts:544-572`), anchored at the top-left tile coordinate:
```typescript
const worldX = obj.tileX * METATILE_SIZE; // top-left origin
const worldY = obj.tileY * METATILE_SIZE;
```

On the GBA, the object event position is the **center** of the sprite (with centerToCornerVec applied). The TS code positions from the **top-left tile**. This 24px offset in each direction could cause the truck to appear shifted.

**Screen jump:** When the player warps from InsideOfTruck to LittlerootTown at `(3, 10)`, the camera snaps to center on the player's new position. There is no smooth camera transition between maps — the warp executor sets the player position and the camera immediately recenters. The GBA uses `warpsilent` which suppresses the map name popup and does a special camera transition.

### Proposed Fix
1. **Truck position:** Adjust `createLargeObjectSpriteInstance` to use center-based positioning matching the GBA:
   ```typescript
   // Center the 48x48 sprite on the object event position
   const worldX = obj.tileX * METATILE_SIZE + (METATILE_SIZE / 2) - (TRUCK_SPRITE_SIZE / 2);
   const worldY = obj.tileY * METATILE_SIZE + METATILE_SIZE - TRUCK_SPRITE_SIZE;
   ```
   Validate against GBA screenshots for pixel-perfect alignment.

2. **Screen jump:** Implement `warpsilent` matching the GBA pipeline. The C source (`scrcmd.c:753-765`) calls `DoDiveWarp()` which does: `LockPlayerFieldControls()` → `TryFadeOutOldMapMusic()` → `WarpFadeOutScreen()` → `PlayRainStoppingSoundEffect()` → set `gFieldCallback = FieldCB_DefaultWarpExit` → `CreateTask(Task_WarpAndLoadMap)` (`field_screen_effect.c:495-503`). This is a full fade-out → warp-during-black → fade-in pipeline, NOT a camera lerp. The TS implementation should match this: fade to black, execute warp while screen is black, then fade in on the new map.

---

## Bug 4: Mom NPC Not Visible After Truck

**Severity:** High
**Files:** `src/game/NewGameFlow.ts:172-221`, `src/pages/GamePage.tsx:731-736`, `src/game/ObjectEventManager.ts:445-450`

### Observed Behavior
Mom NPC never appears during the step-off-truck cutscene in Littleroot Town.

### Root Cause
**Double authority conflict between `visible` property and flag state.**

The story script at `NewGameFlow.ts:180` calls:
```typescript
ctx.setNpcVisible(mapId, momLocalId, true); // Sets npc.visible = true
```

This correctly sets `npc.visible = true` via `ObjectEventManager.setNPCVisibilityByLocalId()` (line 316-321). However, at the END of the story script execution (`GamePage.tsx:736`):
```typescript
objectEventManagerRef.current.refreshCollectedState();
```

This calls `refreshNPCVisibility()` (`ObjectEventManager.ts:445-450`) which recalculates visibility FROM the flag:
```typescript
refreshNPCVisibility(): void {
  for (const npc of this.npcs.values()) {
    npc.visible = !(npc.flag && npc.flag !== '0' ? gameFlags.isSet(npc.flag) : false);
  }
}
```

Since `FLAG_HIDE_LITTLEROOT_TOWN_MOM_OUTSIDE` was set during `initializeNewGameStoryState()` (`NewGameFlow.ts:106`), and the script only calls `setNpcVisible` without clearing the flag, `refreshNPCVisibility()` immediately hides Mom again.

The GBA works differently — `clearflag FLAG_HIDE_*` directly clears the flag, and visibility is always derived from flag state. The browser port has a split where `setNpcVisible` sets a property but doesn't touch the flag.

### Proposed Fix

**Important C-parity note:** In the GBA, visibility toggles (`showobject`/`hideobject` → `SetObjectInvisibility()` at `event_object_movement.c:1939-1945`) and hide flags (`setflag`/`clearflag FLAG_HIDE_*`) are **separate systems**. `SetObjectInvisibility` sets `gObjectEvents[id].invisible` directly without touching the flag. Flags are a persistent layer checked on map load. Conflating these in TS (e.g., making `setNpcVisible` auto-update flags) would break C-parity and cause subtle bugs where temporary visibility changes (scripted cutscene shows → hides) incorrectly alter persistent flag state.

**Option A (match GBA — separate systems):** Keep `setNpcVisible` as a transient visibility toggle (like `SetObjectInvisibility`), and separately implement `clearflag`/`setflag` for persistent flag changes. The script should use both:
```typescript
// Transient: show Mom for the cutscene
ctx.setNpcVisible(mapId, momLocalId, true);
// ... cutscene plays ...
// Persistent: when Mom enters house, set the hide flag
gameFlags.set('FLAG_HIDE_LITTLEROOT_TOWN_MOM_OUTSIDE');
```
Then fix `refreshCollectedState()` to NOT overwrite transient visibility — only recalculate on map load, not after every script.

**Option B (quick fix for the script):** In `NewGameFlow.ts`, explicitly clear the flag before showing Mom:
```typescript
gameFlags.clear('FLAG_HIDE_LITTLEROOT_TOWN_MOM_OUTSIDE');
ctx.setNpcVisible(mapId, momLocalId, true);
```
And then re-set it at line 215 when Mom enters the house (which already happens).

Option A is preferred for long-term C-parity. Option B works as a quick fix for this specific case. The key fix regardless is removing the `refreshCollectedState()` call at `GamePage.tsx:736` from the post-script path, or making it skip NPCs whose visibility was explicitly set during the script.

---

## Bug 5: House Entry Flash / No Fade / No Door Animation

**Severity:** High
**Files:** `src/field/DoorSequencer.ts`, `src/game/DoorActionDispatcher.ts`, `src/field/FadeController.ts`, `src/game/WarpExecutor.ts:320-384`

### Observed Behavior
When entering the house during the intro cutscene:
1. Screen flashes instead of smooth fade-to-black
2. New map appears abruptly without fade-from-black
3. No door opening animation

### Root Cause Analysis

**Flash instead of fade:** The intro house entry uses `ctx.queueWarp()` (`NewGameFlow.ts:220`) which triggers a standard warp. The warp system DOES have fade support (`WarpExecutor.ts:369` calls `fadeController.startFadeIn()` with 500ms duration), but the scripted warp path may bypass the door sequencer's fade-out phase. The script calls `queueWarp` directly rather than going through the door entry flow (which has `startFadeOut` → wait → `executeWarp` stages).

The scripted warp flow is:
1. Script sets up flags and calls `ctx.queueWarp('MAP_...', x, y, 'up')`
2. Warp executes immediately after script ends
3. Map loads, camera snaps to new position
4. `startFadeIn()` may fire but the map transition is instant

On the GBA, `LittlerootTown_EventScript_GoInsideWithMom` uses `warpsilent` which:
- Fades screen to black BEFORE warping
- Warps during black screen
- Fades back in after new map loads

**No door animation:** The scripted house entry doesn't go through the door sequencer at all. The door sequencer (`DoorSequencer.ts`) handles player-initiated door warps (when the player walks into a door tile). But during the intro, the player is being moved by script — the warp is queued manually, bypassing `DoorSequencer.startEntry()`.

### C Reference: Full Scripted Sequence
The GBA's `LittlerootTown_EventScript_GoInsideWithMom` (`scripts.inc:132-164`) explicitly uses door animations throughout:

```asm
@ Mom exits house
opendoor VAR_0x8004, VAR_0x8005       @ Open the house door
waitdooranim                           @ Wait for open animation to finish
addobject LOCALID_LITTLEROOT_MOM       @ Spawn Mom NPC
applymovement ... MomExitHouse         @ Mom walks out
closedoor VAR_0x8004, VAR_0x8005       @ Close door behind Mom
waitdooranim

@ ... dialog, movement ...

@ Player and Mom enter house
opendoor VAR_0x8004, VAR_0x8005       @ Open door again
waitdooranim
applymovement ... MomEnterHouse        @ Mom walks in
applymovement ... PlayerEnterHouse     @ Player walks in
waitmovement 0
setflag FLAG_HIDE_LITTLEROOT_TOWN_MOM_OUTSIDE
hideplayer
closedoor VAR_0x8004, VAR_0x8005       @ Close door
waitdooranim
```

The door script commands (`scrcmd.c:2050-2085`) call `FieldAnimateDoorOpen()`/`FieldAnimateDoorClose()` which animate the actual door metatiles, and `ScrCmd_waitdooranim` blocks script execution until the animation completes.

### Proposed Fix
1. **Implement `opendoor`/`closedoor`/`waitdooranim` script commands:** These need to trigger the existing `DoorSequencer` or `useDoorAnimations` system from within the story script context. The script context (`NewGameFlow.ts`) needs `ctx.openDoor(x, y)` / `ctx.closeDoor(x, y)` / `ctx.waitDoorAnim()` methods.

2. **Implement `warpsilent`:** Create a dedicated `warpSilent()` method matching the GBA's `DoDiveWarp()` pipeline (`field_screen_effect.c:495-503`): `WarpFadeOutScreen()` → `Task_WarpAndLoadMap` → `FieldCB_DefaultWarpExit` (fade in). This is NOT a camera lerp — it's a full fade-out → warp-during-black → fade-in sequence.

3. **Rewrite the NewGameFlow house entry script** to match the GBA sequence: open door → wait → Mom exits → close door → wait → dialog → open door → wait → both enter → close door → wait → warpsilent.

---

## Bug 6: Vigoroth Display Bugs

**Severity:** High
**Files:** `src/game/npc/movementTypes/walkInPlace.ts`, `src/game/npc/movementTypes/wanderDirectional.ts` (misused), `src/rendering/spriteUtils.ts:428-480`, `src/game/npc/NPCSpriteLoader.ts`, `src/game/npc/movementTypes/index.ts` (movement type mapping)

### Observed Behaviors
1. Vigoroth in front of TV (WALK_IN_PLACE_UP) flickers/jumps up and down
2. Vigoroth carrying box (WALK_LEFT_AND_RIGHT) doesn't move off screen properly
3. Movement overall feels broken and not pixel-perfect
4. Both are 32x32 sprites (larger than standard 16x32 NPCs)

### 6a: TV Vigoroth Jumping Up/Down

**Map data** (`data/maps/LittlerootTown_BrendansHouse_1F/map.json`):
```json
{
  "graphics_id": "OBJ_EVENT_GFX_VIGOROTH_FACING_AWAY",
  "x": 4, "y": 5,
  "movement_type": "MOVEMENT_TYPE_WALK_IN_PLACE_UP"
}
```

**Root cause:** The `walkInPlace` handler (`walkInPlace.ts:65`) toggles `state.isWalking` between true/false every 16 frames. When `isWalking` is true, `getNPCFrameInfo()` returns a walk animation frame (e.g., frame index 5 or 6 for "up walk"). When false, it returns the idle frame (index 1 for "up idle").

For standard 16x32 NPCs, the walk and idle frames have the same visual anchor — the sprite height doesn't change. But for 32x32 Vigoroth sprites that use a **custom frame map** (`getSpriteInfo(graphicsId).frameMap`), the frame indices may map to different rows/positions in the sprite sheet. If the Vigoroth sprite sheet has frames at different vertical positions, or if the frame dimensions differ between idle and walk frames, the sprite will appear to jump.

Additionally, the Vigoroth FACING_AWAY sprite only has a single facing direction — it should NOT cycle between walk frames at all. On the GBA, `MOVEMENT_TYPE_WALK_IN_PLACE_UP` for this specific sprite just cycles its 2 animation frames (bobbing), but the TS code applies the generic 9-frame NPC layout which doesn't match.

**Proposed Fix:**
- Check the Vigoroth sprite metadata (`OBJ_EVENT_GFX_VIGOROTH_FACING_AWAY`) for correct frame count and layout
- If the sprite only has 2-4 frames (not the standard 9), implement a custom frame mapping that cycles between the correct animation frames
- Ensure the frame dimensions are consistent within the animation cycle (no height changes between frames)
- Consider adding a `walkInPlaceFrameCount` property to handle sprites with fewer animation frames

### 6b: Box-Carrying Vigoroth Not Moving Properly

**Map data** (`data/maps/LittlerootTown_BrendansHouse_1F/map.json:31-43`):
```json
{
  "graphics_id": "OBJ_EVENT_GFX_VIGOROTH_CARRYING_BOX",
  "x": 1, "y": 3,
  "movement_type": "MOVEMENT_TYPE_WALK_RIGHT_AND_LEFT",
  "movement_range_x": 3
}
```

**Root cause:** The movement type is `MOVEMENT_TYPE_WALK_RIGHT_AND_LEFT` (NOT `WANDER_LEFT_AND_RIGHT`). This is a **deterministic back-and-forth walk** — in C, all four `WALK_*_AND_*` variants map to `MovementType_WalkBackAndForth` (`event_object_movement.c:249-252`). The initial direction for `WALK_RIGHT_AND_LEFT` is `DIR_EAST` (line 380).

The GBA implementation (`event_object_movement.c:3764-3820`) works as follows:
1. Walk continuously in current direction (no random delay between steps)
2. On each step, check `GetCollisionInDirection()` — if `COLLISION_OUTSIDE_RANGE`, toggle `directionSequenceIndex` and reverse direction
3. When returning to initial position with `directionSequenceIndex` set, reset it to 0
4. This produces smooth continuous back-and-forth movement within the range

The TS code likely maps `MOVEMENT_TYPE_WALK_RIGHT_AND_LEFT` to `wander_left_and_right` (handled by `wanderDirectional.ts`), which is a **random wander with delays** — fundamentally wrong behavior. WalkBackAndForth is deterministic and continuous; Wander is random with pauses.

Additionally, the movement range (x ± 3 from initial x=1) means x=-2 to x=4, which extends **off the left edge of the map**. On the GBA, the Vigoroth walks partially off-screen, carrying the box out. The TS collision system may block this at the map boundary.

**Proposed Fix:**
1. Ensure `MOVEMENT_TYPE_WALK_RIGHT_AND_LEFT` (and all `WALK_*_AND_*` variants) maps to a dedicated `walkBackAndForth` handler, NOT the `wanderDirectional` handler
2. Implement `walkBackAndForth` as a continuous walk with no random delay — walk one direction, reverse on range boundary or collision, repeat
3. Implement `COLLISION_OUTSIDE_RANGE` checking in `getCollisionInDirection` based on `initialTileX/Y` and `movementRangeX/Y`
4. Allow NPCs to walk to positions outside the visible map area (the GBA allows this — sprites render even at negative coordinates)

### 6c: General Large Sprite Positioning

The sprite positioning formula at `spriteUtils.ts:456-457`:
```typescript
const worldX = npc.tileX * METATILE_SIZE + subTileX + Math.floor((METATILE_SIZE - sw) / 2);
const worldY = npc.tileY * METATILE_SIZE + subTileY - (sh - METATILE_SIZE);
```

For 32x32 sprites: `worldX = tileX*16 + sub - 8`, `worldY = tileY*16 + sub - 16`.
For 16x32 sprites: `worldX = tileX*16 + sub + 0`, `worldY = tileY*16 + sub - 16`.

The X centering shifts 32x32 sprites 8px left, which is correct (centering a 32px sprite on a 16px tile). The Y formula is identical for both sizes, which may be incorrect — 32x32 sprites should have their visual center at a different point than 16x32 sprites.

**Proposed Fix:** Compare rendered positions against GBA screenshots at specific tiles to determine the exact pixel offset needed for 32x32 sprites.

---

## Bug 7: `{PLAYER}` Placeholder Not Resolved in Dialog

**Severity:** Medium
**Files:** `src/game/NewGameFlow.ts:288,295`, `src/components/dialog/DialogContext.tsx:310-315`, `src/components/dialog/DialogText.tsx`

### Observed Behavior
Dialog shows literal `{PLAYER}` text instead of the player's name (e.g., "See, {PLAYER}?").

### Root Cause
The dialog system has **no text placeholder expansion**. Dialog text flows unchanged through the entire pipeline:

1. `NewGameFlow.ts:288` → `ctx.showMessage("MOM: See, {PLAYER}?\n...")`
2. `GamePage.tsx:697` → `showMessage(text)` (passes raw string)
3. `DialogContext.tsx:310-315` → stores raw text in message queue
4. `DialogText.tsx` → renders raw text with typewriter effect

No component in this chain performs `{PLAYER}` → actual name substitution.

Interestingly, some dialog lines in the same file use template literals correctly:
```typescript
// Line 298-ish in BirchSpeechState — uses JS template literal
await ctx.showMessage(`Ah, okay!\nYou're ${this.playerName}.`);
```

But the NewGameFlow scripts use `{PLAYER}` placeholder syntax (matching GBA style) without any expansion logic.

### C Reference
The GBA uses a binary placeholder system (`public/pokeemerald/src/string_util.c:335-525`):
- `0xFD` byte marks a placeholder, followed by an ID byte
- `PLACEHOLDER_ID_PLAYER` (0x01) → resolves to `gSaveBlock2Ptr->playerName`
- `StringExpandPlaceholders()` recursively expands all placeholders before display

### Proposed Fix

**Option A (Simple — template literal approach):**
Replace `{PLAYER}` with JS template literals everywhere in `NewGameFlow.ts`:
```typescript
const playerName = saveManager.getProfile().name;
await ctx.showMessage(`MOM: See, ${playerName}?\nIsn't it nice in here, too?`);
```
This works for hardcoded scripts but doesn't scale to data-driven dialog.

**Option B (Robust — text expansion utility):**
Create a `expandDialogText()` utility that replaces placeholders before display:
```typescript
function expandDialogText(text: string, context: DialogContext): string {
  return text
    .replace(/\{PLAYER\}/g, context.playerName)
    .replace(/\{RIVAL\}/g, context.rivalName)
    .replace(/\{STR_VAR_1\}/g, context.stringVar1 ?? '')
    .replace(/\{STR_VAR_2\}/g, context.stringVar2 ?? '')
    .replace(/\{STR_VAR_3\}/g, context.stringVar3 ?? '');
}
```
Call this in `DialogContext.showMessage()` before storing the message.

Option B is preferred because it matches the GBA architecture and will scale as more scripts are added. The placeholder system will be needed for NPC dialog loaded from script data.

---

## Bug 8: Truck Not Centered in Viewport / Shake Runs Forever

**Severity:** Medium
**Files:** `src/game/TruckSequence.ts`, `src/pages/GamePage.tsx:1386-1398,1651-1658`

### Observed Behavior
When the truck scene starts, the inside-of-truck map may not be correctly centered in the viewport. Additionally, the camera shake can appear to run indefinitely rather than stopping cleanly after the truck "arrives."

### Root Cause Analysis
The player spawns at `(2, 2)` inside the truck (`BirchSpeechState.ts:45-55`). The camera centers on the player, but the InsideOfTruck map is very small (5x4 metatiles). If the viewport is larger than the map, the camera may not center correctly — there's not enough map to fill the screen, causing the truck interior to appear off-center.

For the shake duration: `TruckSequence.ts` runs on a fixed frame counter (`PHASE_FRAMES = [90, 240, 540, 630, 720, 840]`). The sequence completes at frame 840. However, the `update()` method is called from the render loop (`GamePage.tsx:1652`) which runs at display refresh rate (potentially 60fps or higher), not at GBA frame rate (59.7fps). If the frame counter increments once per render frame instead of once per GBA frame, timing is off. Also, there's no GBA-style step callback (`STEP_CB_TRUCK` → `EndTruckSequence` at `field_tasks.c:66`) to end the sequence on first player step.

### Proposed Fix
1. Ensure the camera is clamped to center the small truck map properly in the viewport
2. Verify `TruckSequence` frame counting matches GBA timing (~59.7fps, not display refresh)
3. Add step-callback or equivalent to cleanly end the truck sequence when the player first moves

---

## Bug 9: Professor Visible / Truck Sprite Missing on Littleroot Town

**Severity:** Medium
**Files:** `src/game/NewGameFlow.ts:101-128`, `src/game/ObjectEventManager.ts`

### Observed Behavior
When arriving in Littleroot Town after exiting the truck, the professor (Birch) may be visible when he shouldn't be, and the truck sprite may not be displayed.

### Root Cause Analysis
`initializeNewGameStoryState()` (`NewGameFlow.ts:101-128`) sets several hide flags at game start:
```typescript
gameFlags.set('FLAG_HIDE_ROUTE_101_BIRCH');
```

However, Birch's NPC is on Route 101, not Littleroot Town. If the flag isn't being checked correctly on Littleroot Town map load, or if the NPC shows up due to map stitching (adjacent maps loading NPCs), Birch could appear where he shouldn't.

For the truck: the truck sprite's visibility depends on `FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_TRUCK` (or May's equivalent). During the intro sequence, the opposite gender's truck is hidden (`NewGameFlow.ts:147-158`), but the player's truck should remain visible. If the flag is set prematurely or the `LargeObject` visibility refresh doesn't run after the warp, the truck won't render.

### Proposed Fix
1. Verify that `FLAG_HIDE_ROUTE_101_BIRCH` is checked on NPC load for the correct map scope — Birch should only exist on Route 101's NPC list
2. Verify truck `LargeObject` visibility is refreshed after warping to Littleroot Town
3. Check that map stitching doesn't pull in NPCs from adjacent maps when their hide flags are set
4. Debug with screenshots comparing flag state vs rendered NPCs at each story state transition

---

## Non-Bug: Dad Not Visible

Dad (`FLAG_HIDE_PLAYERS_HOUSE_DAD`) is intentionally hidden at new game start. The C source explicitly sets this flag in `new_game.inc:154`:
```asm
setflag FLAG_HIDE_PLAYERS_HOUSE_DAD
```
Dad doesn't appear until later in the story. This is expected behavior, not a bug.

---

## Summary Table

| # | Bug | Severity | Root Cause | Fix Complexity |
|---|-----|----------|------------|----------------|
| 1 | Tile color change during truck | Medium | Missing metatile swap + box sprites + step callback | High — needs new API |
| 2 | Start menu during truck | High | Missing `truckLocked` check in menu handler | Low — one line |
| 3 | Truck position & screen jump | Medium | Top-left vs center anchoring; missing `warpsilent` pipeline | Medium |
| 4 | Mom NPC invisible | High | `refreshCollectedState()` overwrites transient visibility | Medium — separate visibility systems |
| 5 | House entry flash/no fade/no door | High | Missing `opendoor`/`closedoor`/`waitdooranim` + `warpsilent` | High — script commands needed |
| 6 | Vigoroth display bugs | High | Wrong movement handler (wander vs walkBackAndForth); 32x32 frame issues | High |
| 7 | `{PLAYER}` literal in dialog | Medium | No text placeholder expansion system | Low-Medium |
| 8 | Truck not centered / shake duration | Medium | Viewport centering for small map; frame timing mismatch | Medium |
| 9 | Prof visible / truck missing | Medium | Flag check scope; LargeObject visibility refresh after warp | Medium |

## Recommended Fix Order

1. **Bug 2** — Start menu lock (one-line fix, high impact)
2. **Bug 4** — Mom visibility (separate transient vs flag visibility, fix refreshCollectedState)
3. **Bug 7** — `{PLAYER}` placeholder (small utility, visible improvement)
4. **Bug 9** — Prof/truck visibility (flag scope debugging)
5. **Bug 5** — House entry: implement `opendoor`/`closedoor`/`waitdooranim` + `warpsilent` (high effort but critical for C-parity)
6. **Bug 6** — Vigoroth: add `walkBackAndForth` handler, fix 32x32 frame mapping (high effort)
7. **Bug 3** — Truck positioning + `warpsilent` pipeline (medium effort)
8. **Bug 8** — Truck viewport centering and timing (medium effort)
9. **Bug 1** — Metatile swap + box sprites + step callback (high effort, needs new system)
