---
title: "New Game to First Pokemon - Master Backlog"
status: planned
last_verified: 2026-02-15
goal: "Make the game playable from pressing NEW GAME through choosing a starter and winning the first battle"
---

Status markers: done [x], part done [-], not done [ ]     

# New Game to First Pokemon - Master Backlog

## Goal

Make the TypeScript browser version playable through the complete new game experience:

```
Title Screen → Main Menu → Birch Intro → Gender/Name → Truck Scene →
Littleroot Arrival → Player's House → Meet Rival → Route 101 →
Birch Rescue → Choose Starter → Battle Poochyena → Return to Lab
```

## Architecture Principles

- **Script engine is universal** - not new-game-specific. It powers ALL NPC dialogue, cutscenes, and story progression game-wide
- **Reference C code directly** - every feature must match `pokeemerald/src/` behavior. Document the exact C function/file when implementing
- **Scalable systems first** - build reusable systems (scripts, battles, variables) not one-off hacks
- **Minimal viable features** - implement only the ~30 script commands needed now, but with an architecture that trivially extends to all 220+

## Critical Design Decisions (Document In `docs/` With Status/Date)

- [x] Rendering backend decision for gameplay viewport: WebGL2 primary with Canvas2D fallback (decided: WebGL first for FUI; document rationale + fallback rules)
- [ ] Pixel-perfect scaling policy: integer-only scaling, letterbox vs crop, CSS `image-rendering`, handling sub-tile camera offsets
- [-] Input mapping and repeat rates: keyboard + gamepad + touch, A/B/Start/Select mapping, GBA key-repeat timing parity
- [ ] Title screen fidelity: keep current 3D Rayquaza vs replace with GBA title assets for pixel-perfect goal
- [ ] Audio strategy: M4A emulation via WebAudio vs pre-rendered OGG/MP3, loop points, latency budget
- [x] Clock handling: skip wall clock UI (auto-set local time) vs replicate (set flags/vars to avoid blocking scripts)
- [x] Script data pipeline: build-time `scripts.inc` → JSON vs runtime parser, constant/label resolution strategy
- [-] Save format strategy: browser-native schema vs GBA-compatible import/export, migration plan

## Legendary Island Encounter Parity (Encounter-Only)

- [x] Add `MAP_SCRIPT_ON_RETURN_TO_FIELD` generation/runtime support and wire it through map script types.
- [x] Parse shared scripts from `public/pokeemerald/data/event_scripts.s` and generate `Common_EventScript_LegendaryFlewAway`.
- [x] Implement `seteventmon` command and route species/level/held-item into the existing scripted wild-battle flow.
- [x] Extend battle transition payload to carry scripted wild held items (`wildHeldItem`).
- [x] Add modular legendary-island specials (`SpawnCameraObject`, `RemoveCameraObject`, `ShakeCamera`, `LoopWingFlapSE`, Deoxys/Mew specials).
- [x] Implement scripted camera runtime and handle `applymovement LOCALID_CAMERA` as camera movement (no NPC lookup warning).
- [x] Implement Deoxys rock progression/result logic and `FLDEFF_DESTROY_DEOXYS_ROCK` runtime support.
- [x] Implement exact Deoxys rock palette progression from source `deoxys_rock_*.pal` data with runtime sprite variant replacement.
- [x] Add centralized sprite alias fixes (`OBJ_EVENT_GFX_HOOH` and `OBJ_EVENT_GFX_DEOXYS_TRIANGLE`) and explicit NPC graphics classification.
- [x] Add generator/parser verification coverage (assembler-directive filtering + shared legendary script extraction) and legendary script-ingestion gate.
- [x] Implement Faraway Mew copy-player-in-grass movement translation plus step-cadence visibility behavior.
- [x] Add island step-counter updates (`VAR_FARAWAY_ISLAND_STEP_COUNTER`, `VAR_DEOXYS_ROCK_STEP_COUNT`) through reusable step hooks.
- [x] Run scripted-battle post-return flow with `onReturnToField` then `onResume`.
- [x] Publish implementation notes in `docs/features/overworld/legendary-island-parity.md`.
- [ ] Manual in-game QA pass for Faraway/Birth/Navel/Southern encounter branches (defeat, run, catch).

## Berry System Parity (Completed 2026-02-15)

- [x] Fix berry script command/special handling (`setberrytree`, `waitbuttonpress`, berry `ObjectEventInteraction*`, `PlayerHasBerries`, `Bag_ChooseBerry`, `DoWateringBerryTreeAnim`)
- [x] Add authoritative berry runtime manager with growth timing, watering bits, regrowth, harvest yield, and interaction APIs
- [x] Preserve berry tree interaction identity from object events into script interaction context
- [x] Integrate callback-driven bag berry selection mode and resume script waitstate on select/cancel
- [x] Match callback-return field fade semantics for callback specials (`Bag_ChooseBerry` resumes via return-to-field fade-in and guarded stale-black recovery)
- [x] Regenerate berry animation metadata and wire stage-aware berry tree sprite rendering
- [x] Persist berry state in app JSON saves and load with backward-compatible defaults
- [x] Parse berry trees + last berry update timestamp from native `.sav` imports and apply elapsed-time updates
- [x] Complete berry item data coverage for IDs `133..175` and verify berry pocket classification

---

## Phase 0: Foundation Systems (Prerequisite)

These systems are shared infrastructure used by ALL subsequent phases.

### 0.0 Deterministic Timing & RNG
> C ref: `src/main.c`, `src/random.c`

- [x] Lock simulation to 60 FPS logic tick (even if render is variable) for script delays and movement parity
- [-] Implement Gen 3 LCG RNG (`Random()`, `Random2()`) with deterministic seed storage for battles, IVs, and script randomness
- [-] Centralize frame counter + RNG usage to avoid desync between scripts, movement, and battle

### 0.1 Game Variables Manager
> C ref: `include/constants/vars.h`, `src/script.c` (`GetVarPointer`)

- [x] Create `src/game/GameVariables.ts` — numeric variable store (mirrors GBA's `gSaveBlock1Ptr->vars[]`)
- [x] Support named constants: `VAR_LITTLEROOT_INTRO_STATE`, `VAR_BIRCH_LAB_STATE`, `VAR_ROUTE101_STATE`, etc.
- [x] Integrate with SaveManager for persistence
- [x] Add `getVar(id)`, `setVar(id, value)`, `addVar(id, delta)`, `compareVar(id, value)` API
- [x] Map variable IDs from `include/constants/vars.h` (at minimum the ~20 needed for new game)
- [-] Implement `VAR_RESULT` and `VAR_0x8000..VAR_0x800F` temp vars used heavily in scripts (`checkplayergender`, yes/no prompts, etc.)
- [-] Mirror `VarGet`/`VarSet` semantics for special vars (e.g., `VAR_RESULT`) vs save-backed vars
- [ ] Track which vars are transient vs persisted so script temp usage doesn't leak across saves
- [-] Include `VAR_STARTER_MON`, `VAR_FACING`, and other intro-critical vars in the mapped list

See: [docs/features/newgame/game-variables.md](../features/newgame/game-variables.md)

### 0.2 Enhanced Game Flags
> C ref: `include/constants/flags.h`, `src/event_data.c`

- [x] Extend existing `GameFlags.ts` with numeric flag IDs (not just strings)
- [x] Add all visibility flags needed for new game NPCs (see reference doc)
- [x] Connect flags to `ObjectEventManager` — NPCs with `flag` property auto-hide when flag is set
- [x] Wire flags into SaveManager serialization
- [x] Add system/progression flags used in early flow: `FLAG_HIDE_MAP_NAME_POPUP`, `FLAG_SYS_POKEMON_GET`, `FLAG_RESCUED_BIRCH`, starter bag hide flags
- [x] Ensure `EventScript_ResetAllMapFlags` (new game) mirrors `InitEventData` reset behavior

### 0.3 Script Engine Core
> C ref: `src/script.c` (471 lines), `src/scrcmd.c` (2307 lines, 220 commands)

This is the **most critical system**. It powers every NPC interaction, cutscene, and story event in the entire game. Build it as a general-purpose interpreter, not a new-game-specific hack.

- [x] Create `src/scripting/ScriptEngine.ts` — bytecode-style interpreter with:
  - Script context (instruction pointer, call stack of 20 levels, mode: stopped/running/waiting)
  - Command dispatch table (extensible — add new commands by registering handlers)
  - Yielding execution (script pauses, resumes next frame — like GBA's `ScriptContext_RunScript`)
  - Multiple concurrent scripts (map scripts can run alongside NPC scripts)
- [x] Implement two contexts: global (yielding) + immediate (RunScriptImmediately for ON_LOAD/ON_TRANSITION)
- [x] Mirror `ScriptContext_Stop/Enable` and field-control lock/unlock semantics (`LockPlayerFieldControls`)
- [x] Create `src/scripting/ScriptCommands.ts` — implement MVP command set (~30 of 220):

**Control Flow (8 commands):**
```
end, return, goto, call, goto_if_eq, goto_if_ne, goto_if_lt, goto_if_ge
```

**Variables & Flags (8 commands):**
```
setvar, copyvar, addvar, compare, setflag, clearflag, checkflag, checkplayergender
```

**NPC Movement (7 commands):**
```
applymovement, waitmovement, turnobject, setobjectxy, setobjectxyperm,
addobject, removeobject
```

**Dialogue (6 commands):**
```
msgbox, message, waitmessage, closemessage, lockall, releaseall
```

**World (5 commands):**
```
warp, fadescreen, delay, playse, special
```

**Additional New-Game Commands (from InsideOfTruck/Littleroot/Route101/Lab scripts):**
```
call_if_eq, call_if_ne, call_if_set, call_if_unset, goto_if_set, goto_if_unset,
call_if_lt, call_if_ge, lock, lockall, release, releaseall, hideplayer, showplayer,
faceplayer, waitstate, waitdooranim, warpsilent, playbgm, savebgm, fadedefaultbgm,
playfanfare, waitfanfare, setrespawn, setdynamicwarp, setstepcallback,
setobjectmovementtype, setmaplayoutindex, bufferleadmonspeciesname,
msgbox (MSGBOX_YESNO), specialvar
```

- [x] Create `src/scripting/MovementScript.ts` — movement command interpreter:
  - `walk_up/down/left/right`, `walk_fast_*`, `walk_in_place_fast_*`, `walk_in_place_faster_*`
  - `delay_16`, `delay_8`, `step_end`
  - `jump_*` (truck exit), `set_invisible`, `walk_in_place_faster_left/right/up/down`
  - Multiple simultaneous movements (Birch + Zigzagoon chasing)
  - Match GBA step duration/speed tables for `walk_fast_*` and normal movement
- [x] Parse shared movement scripts from `data/scripts/movement.inc` (`Common_Movement_*`)
- [x] Create `src/scripting/ScriptSpecials.ts` — "special" function registry (C functions called by index):
  - `ChooseStarter` (must start first battle + set `VAR_STARTER_MON` and `VAR_RESULT`)
  - `HealPlayerParty`, `BeginTruckUnload`, `CheckPlayerGender`
  - `GetRivalSonDaughterString` (string buffer used by rival mom dialog)
- [x] Create `src/scripting/ScriptDataLoader.ts` — parse map `scripts.inc` data into executable format
  - Convert assembly-style scripts to JSON command arrays
  - Parse `.string` text resources and control codes (`\n`, `\p`, placeholders)
  - Resolve cross-file labels (`Common_EventScript_*`, `PlayersHouse_1F_*`, etc.)
  - Pre-generate from C source during build (or hardcode MVP scripts)
- [x] `VarGet` parity: if ID is not a valid var, return the ID (needed for `map_script_2` compare-to-constant)
- [x] Support script args that can be *vars* (e.g., `applymovement VAR_0x8004, ...`)
- [x] Allow scripts to suspend for battles and resume after returning to overworld

See: [docs/systems/scripts-logic/script-engine-design.md](../systems/scripts-logic/script-engine-design.md)

### 0.4 Map Script Hooks
> C ref: `src/overworld.c`, `include/constants/map_scripts.h`

- [x] Add map script trigger points to WorldManager:
  - `MAP_SCRIPT_ON_LOAD` — when map tiles load (before visible)
  - `MAP_SCRIPT_ON_TRANSITION` — during warp fade (position NPCs)
  - `MAP_SCRIPT_ON_RESUME` — after returning to field (truck step callback)
  - `MAP_SCRIPT_ON_RETURN_TO_FIELD` — after battles/menus
  - `MAP_SCRIPT_ON_DIVE_WARP` — not used in intro but keep parity
  - `MAP_SCRIPT_ON_FRAME_TABLE` — every frame, check condition→script table
  - `MAP_SCRIPT_ON_WARP_INTO_MAP` — after objects loaded
- [x] Wire coordinate trigger events (step on tile X,Y when VAR matches → run script)
- [x] Wire object event interaction (press A facing NPC → run their script)
- [x] Implement `map_script_2` table evaluation using `VarGet(var) == VarGet(compare)` semantics
- [x] Support `MAP_DYNAMIC` / `WARP_ID_DYNAMIC` resolution using `setdynamicwarp` state

### 0.5 NPC Interaction System
> C ref: `src/field_player_avatar.c`, `src/event_object_interaction.c`

- [x] Implement A-button NPC interaction:
  - Detect which NPC player is facing
  - Call `lock` (freeze NPC + player)
  - Execute NPC's attached script
  - Call `release` when script ends
- [x] Implement `faceplayer` — NPC turns to face the player when talked to
- [x] Connect to existing DialogContext for `msgbox` display
- [x] Ensure `VAR_FACING` reflects current player facing for scripts that branch on direction
- [x] Add movement types used in intro maps (e.g., `MOVEMENT_TYPE_JOG_IN_PLACE_LEFT/RIGHT`)
- [x] `lockall` should pause all NPC movement + player input until `releaseall`

### 0.6 Text, Message Boxes, and String Tokens
> C ref: `src/text.c`, `src/string_util.c`, `src/scrcmd.c` (message/msgbox)

- [x] Parse script text control codes (`\n`, `\p`, `\l`, placeholders like `{PLAYER}`, `{KUN}`, arrows)
- [x] Implement `STR_VAR_1..3` buffers for script commands like `bufferleadmonspeciesname`
- [-] Support message box styles: `MSGBOX_DEFAULT`, `MSGBOX_NPC`, `MSGBOX_SIGN`, `MSGBOX_YESNO`
- [x] Match GBA text speed + paging behavior (wait for A/B to advance, typewriter speed)
- [x] `MSGBOX_YESNO` must set `VAR_RESULT` to YES/NO values used by scripts

### 0.7 Input & Key Repeat Parity
> C ref: `src/main.c` (`gKeyRepeatStartDelay`, `gKeyRepeatContinueDelay`), `src/naming_screen.c`

- [ ] Implement GBA key repeat defaults (start 40 frames, continue 5 frames) and allow per-screen overrides
- [x] Define input mapping for A/B/Start/Select with keyboard + gamepad + touch
- [x] Ensure input is fully locked during scripts, fades, and modal dialogs
- [x] Unify action input (NPC talk, sign read, item pickup) under A-button mapping
- [x] Add mobile virtual controls (D-pad/A/B/Start/Select) via InputMap-backed synthetic keyboard events with portrait/landscape shell layouts

### 0.8 Camera Effects & Per-Step Callbacks
> C ref: `src/field_camera.c`, `src/field_tasks.c`, `src/field_special_scene.c`

- [x] Add camera pan/offset system (used by truck shake and scripted effects)
- [x] Implement `setstepcallback` + per-step task registry (`STEP_CB_TRUCK` at minimum)
- [x] Support temporary camera override during `ExecuteTruckSequence` and restore after `EndTruckSequence`

### 0.9 Map Name Popup
> C ref: `src/fieldmap.c`, `src/overworld.c`

- [ ] Implement map name popup UI (trigger on map load/warp)
- [-] Respect `FLAG_HIDE_MAP_NAME_POPUP` (scripts set/clear it frequently in intro flow)

### 0.10 Asset Pipeline For Intro Flow
> C ref: `graphics/birch_speech/`, `graphics/starter_choose/`, `graphics/battle_environment/`

- [x] Ensure extraction + decoding for Birch speech, starter choose UI, route 101 sprites, lab assets
- [ ] Ensure font + UI frame assets match GBA palettes and 4bpp formats

### 0.11 Map Event Data (Coord + BG Events)
> C ref: `include/global.fieldmap.h`, map `.json` data

- [x] Extend map event loader to parse `coord_events` (trigger tiles with var + value)
- [x] Extend map event loader to parse coord weather events (`type: "weather"`) and map default weather (`map.json.weather`)
- [x] Extend map event loader to parse `bg_events` (signs and background interactions)
- [x] Ensure coordinate events respect elevation and trigger only on step-in
- [x] Wire `bg_events` to A-button interaction (signs use `MSGBOX_SIGN`)
- [ ] Respect `player_facing_dir` constraints for `bg_events`

### 0.16 Dive + Underwater Weather Parity
> C ref: `src/field_control_avatar.c`, `src/overworld.c`, `src/field_weather_effect.c`

- [x] Add bidirectional Dive field action flow (surface dive + underwater emerge) with temporary HM/badge bypass
- [x] Match Dive warp destination order: connection (`dive`/`emerge`) -> `MAP_SCRIPT_ON_DIVE_WARP` -> `setdivewarp` fallback
- [x] Reuse fade warp transition pipeline for Dive warp execution
- [x] Persist and restore underwater traversal state across scripted warps and save/load
- [x] Add scalable weather runtime (`WeatherManager` + registry) wired to script commands (`setweather` / `resetweather` / `doweather`)
- [x] Implement `WEATHER_UNDERWATER_BUBBLES` visual effect (horizontal fog + bubble sprites)
- [x] Implement remaining field weather visuals (rain/thunder/downpour, snow, ash, sandstorm, fog variants, sunny clouds, shade, drought, abnormal cycle)
- [x] Add weather runtime generator (`npm run generate:weather-runtime`) to map C callback table to TS weather effect keys in one pass
- [x] Separate underwater traversal mode from surfing runtime state (`land`/`surf`/`underwater`)
- [x] Prevent surf blob rendering while underwater in both Canvas and WebGL pipelines
- [x] Normalize old saves where `isUnderwater=true && isSurfing=true` to underwater traversal on load/import
- [x] Move underwater weather sprites to shared keyed-transparency loading and integer fog tiling primitives
- [x] Fix surf/dive sprite regressions: logical surfing frame mapping, traversal-safe input locking, frame-driven WebGL atlas selection, runtime underwater bobbing parity

### 0.12 Scripted Object Events (Non-NPC)
> C ref: `event_object_movement.c` (object events are more than NPCs)

- [x] Support scripted objects like `OBJ_EVENT_GFX_BIRCHS_BAG` (interactable, no movement)
- [x] Allow object events with `script` but not `OBJ_EVENT_GFX_ITEM_BALL` to run scripts
- [x] Persist object visibility based on `FLAG_HIDE_*` and update live when flags change
- [x] Provide stable lookup by `local_id` for script commands (`setobjectxy`, `applymovement`, etc.)
- [x] Implement `setobjectxy` (runtime move) vs `setobjectxyperm` (persisted spawn) semantics
- [-] When `setobjectxy` targets `LOCALID_PLAYER`, update PlayerController + camera immediately

### 0.13 Field Effect Emotes
> C ref: `src/field_effect.c` (exclamation mark, question mark)

- [ ] Implement exclamation mark field effect used in early intro scenes (`Common_Movement_ExclamationMark`)
- [x] Ensure field effects render above NPCs and respect script locking

### 0.14 Player Movement Timing Parity
> C ref: `src/field_player_avatar.c`, `src/event_object_movement.c`

- [x] Verify walking/running step timing matches GBA (16px per tile, per-frame speed)
- [x] Match turn-in-place animation timing (walk_in_place vs faster variants)
- [x] Ensure collision + elevation checks remain pixel-accurate during scripted movement

### 0.15 Scripted NPC Movement (`applymovement` / `waitmovement`)
> C ref: `src/event_object_movement.c`, `src/scrcmd.c`
> Design doc: [docs/backlog/reference/scripted-movement.md](reference/scripted-movement.md)

- [x] Create `ScriptMovementManager` for concurrent NPC movement scripts
- [x] Implement face actions (face_down/up/left/right)
- [x] Implement walk normal (4 dirs) with proper tile-crossing animation
- [x] Implement delay actions (frame counting)
- [x] Implement walk-in-place (animation only, no tile change)
- [x] Implement `applymovement(localId, actions[])` script command
- [x] Implement `waitmovement(localId)` async wait
- [x] Implement `lockall` / `releaseall` for freezing autonomous NPC movement
- [x] Support scripted player movement (disable keyboard, drive player like NPC)
- [x] Full house entry cutscene (replace dialog-only handler in NewGameFlow.ts)

---

## Phase 1: Birch Intro & New Game Setup

### 1.1 Birch Speech State
> C ref: `src/main_menu.c` (`Task_NewGameBirchSpeech_*`), `graphics/birch_speech/`

- [x] Add `NEW_GAME_BIRCH` to GameState enum
- [ ] Create `src/states/BirchSpeechState.ts`:
  - Background: load `graphics/birch_speech/` assets (birch.png, shadow.png, bg palettes, map.bin)
  - Phase 1: Fade in, Birch appears with shadow
  - Phase 2: Birch's monologue ("This is the world of Pokemon...") with DialogContext
  - Phase 3: Show Poochyena sprite, Birch explains Pokemon
  - Phase 4: Gender selection (Boy/Girl sprites)
  - Phase 5: Name input screen
  - Phase 6: Confirm and shrink player into Pokeball
  - Phase 7: Fade to black → transition to InsideOfTruck
- [x] Wire MainMenuState "NEW GAME" to transition to `NEW_GAME_BIRCH` instead of `OVERWORLD`
- [ ] Implement gender-dependent rival selection (Brendan if girl, May if boy)
- [ ] Match `Task_NewGameBirchSpeech_*` timings, palette fades, and sprite positions from C
- [ ] Support A/B input cadence and text speed during Birch speech (no skipping beyond GBA rules)
- [x] Birch intro parity pass (visual): render real Birch speech assets from `graphics/birch_speech/` (Birch sprite, shadow, background layers) instead of placeholder panels
- [x] Birch intro parity pass (dialog): use script text from `data/text/birch_speech.inc` with phase ordering that matches `Task_NewGameBirchSpeech_*`
- [x] Birch intro parity pass (Pokemon reveal): show Birch's Pokemon graphic during the corresponding dialog phase before gender selection
- [x] Birch intro parity pass (tile layering): render `graphics/birch_speech/map.bin` as a 32x20 8x8 tilemap using `shadow.png` tile source to match GBA background composition
- [x] Birch intro parity pass (viewport scaling): render to a fixed 240x160 GBA framebuffer, then integer-scale + letterbox into configurable viewport sizes
- [x] Birch intro parity pass (scene cleanup): remove placeholder blue/green gradient fills and use map-accurate black stage + spotlight backdrop
- [x] Birch intro parity pass (dialog architecture): remove custom Birch textbox rendering and route speech/choices through shared dialog system (`src/components/dialog/*`)
- [x] Birch intro parity pass (name entry architecture): remove Birch-specific Canvas2D name panel and run name entry through shared dialog component with the standard framed border
- [x] Birch intro parity pass (shared input UX): add reusable dialog text-entry mode so intro naming uses the same dialog renderer/cadence pipeline as overworld chat
- [x] Birch intro parity pass (overlay alignment): keep dialog overlay viewport-anchored (bottom aligned) while Birch scene scales/centers responsively
- [x] Birch intro parity pass (dialog cadence): disable instant text skip for Birch speech so lines reveal letter-by-letter via shared dialog system
- [x] Birch intro parity pass (responsive vertical alignment): center Birch scene in viewport at any aspect ratio so Birch + platform stay compositionally centered

### 1.2 Player Profile Initialization
> C ref: `src/new_game.c` (`NewGameInitData`)

- [x] On new game start, initialize:
  - Player name, gender, trainer ID (random)
  - Clear all flags and variables
  - Default options: text speed, frame type, sound mode, battle style
  - Set `VAR_LITTLEROOT_INTRO_STATE = 0`
  - Set initial visibility flags (hide Mom outside, show truck, etc.)
  - Set respawn point based on gender
  - Initialize money (3000), empty bag/party, and reset game stats
  - Run `EventScript_ResetAllMapFlags` equivalent to sync map object visibility
- [x] Warp to `MAP_INSIDE_OF_TRUCK` after init (mirrors `WarpToTruck`)
- [x] Wire SaveManager to persist this initial state
- [x] Main Menu "NEW GAME" must call new-game init before Birch speech

### 1.3 Name Input Screen
> C ref: `src/naming_screen.c` (1800+ lines)

- [x] Create `src/states/NamingScreenState.ts` or component:
  - GBA keyboard layout (upper/lower/symbols, 3 pages)
  - 7-character max name
  - Cursor navigation with A/B/Select/Start
  - Can be reused later for Pokemon nicknames
- [x] Simplified approach acceptable: text input field for MVP, GBA keyboard as enhancement
- [-] Preserve GBA character set + capitalization rules (for `{PLAYER}` text token parity)
- [ ] Match naming screen key-repeat timing overrides (`gKeyRepeatStartDelay = 16` during naming)

---

## Phase 2: Truck & Littleroot Arrival

### 2.1 Inside Truck Map
> C ref: `src/field_special_scene.c` (`ExecuteTruckSequence`, `Task_HandleTruckSequence`)
> Map: `data/maps/InsideOfTruck/scripts.inc`

- [x] Ensure InsideOfTruck map loads correctly (tilesets, layout)
- [x] Implement truck shake effect (`STEP_CB_TRUCK`):
  - Camera oscillation: y offset cycles through [0, 0, 0, 1, 1, 2, 2, 2, 2, 2, 1, 1, 0, 0, -1, -1]
  - Repeats every ~60 frames
  - C ref: `src/field_special_scene.c` lines 189-280
- [x] MAP_SCRIPT_ON_LOAD: Set exit light metatiles at (4,1), (4,2), (4,3)
- [x] MAP_SCRIPT_ON_RESUME: `setstepcallback STEP_CB_TRUCK` (runs `EndTruckSequence` per-step callback)
- [x] MAP_SCRIPT_ON_FRAME: Trigger `TruckArrival` script:
  - Player turns in place (walk_in_place_faster variations)
  - Play SE_TRUCK_DOOR sound
  - Call `Special_BeginTruckUnload` (screen brightening)
  - Set flags: show Mom, hide trucks
  - `VAR_LITTLEROOT_INTRO_STATE = 1`
  - Warp to Littleroot Town (4, 10)
- [x] Implement `setstepcallback STEP_CB_TRUCK` — step callback system for camera effects
- [x] Implement full `ExecuteTruckSequence` timing: SE_TRUCK_MOVE/STOP/UNLOAD, fade in, camera pan table, box bobbing
- [-] Support `setrespawn` + `setdynamicwarp` used by `InsideOfTruck_EventScript_SetIntroFlags*`
- [x] `InsideOfTruck_EventScript_SetIntroFlags*` sets `VAR_LITTLEROOT_INTRO_STATE` to 1 (male) or 2 (female) and dynamic warp to Littleroot coordinates
- [x] `InsideOfTruck_EventScript_SetIntroFlags*` also sets house-state vars + hide flags for mom/truck/rival sibling
- [x] Remove MVP shortcut teleport from truck trigger: `InsideOfTruck_EventScript_SetIntroFlags` should set flags/vars/dynamic warp only, then return control so player can walk to truck exit
- [x] Implement `MAP_DYNAMIC` / `WARP_ID_DYNAMIC` warp resolution for truck exit so walking onto truck door warp sends player to gender-specific Littleroot coordinates (from `setdynamicwarp`)
- [x] Keep truck shake active while inside truck (until exit warp), matching `STEP_CB_TRUCK` behavior at a practical MVP fidelity

### 2.2 Littleroot Town Arrival Cutscene
> Map: `data/maps/LittlerootTown/scripts.inc` (900+ lines)

- [x] MAP_SCRIPT_ON_FRAME when `VAR_LITTLEROOT_INTRO_STATE == 1`:
  - Gender check → run `StepOffTruckMale` or `StepOffTruckFemale`
  - Player jumps off truck (movement: `jump_right` then face directions)
  - Play SE_LEDGE
  - Mom exits house (opendoor, applymovement, closedoor sequence)
  - Mom dialogue: "Welcome to Littleroot Town!"
  - Both walk to house together (parallel movements)
  - opendoor → Mom enters → Player enters → closedoor
  - `VAR_LITTLEROOT_INTRO_STATE = 2` then `3`
  - Warp to Player's House 1F
- [x] Implement `opendoor` / `closedoor` / `waitdooranim` script commands
- [x] Conditional NPC spawning: truck visible only before arrival, Mom only after flags set
- [x] Support `warpsilent` + `waitstate` (used to enter house without fade)
- [x] Implement `hideplayer` / `showplayer` (used during door sequences)
- [x] Implement `call_if_eq`, `call_if_unset`, and `map_script_2` table evaluation
- [x] Handle `LittlerootTown_OnTransition` setup: `FLAG_VISITED_LITTLEROOT_TOWN`, rival gfx id, twin position logic
- [x] Ensure truck is visible when stepping into Littleroot from truck exit and only hidden at the correct post-step-off point (`FLAG_HIDE_LITTLEROOT_TOWN_*_HOUSE_TRUCK`)
- [x] Ensure first Littleroot arrival runs a mom greeting sequence after stepping off truck (before normal free-roam), matching `LittlerootTown_EventScript_StepOffTruck*` intent

### 2.3 Player's House Events
> Map: `data/maps/LittlerootTown_BrendansHouse_1F/scripts.inc` (500+ lines)

- [x] MAP_SCRIPT_ON_FRAME when `VAR_LITTLEROOT_INTRO_STATE == 3`:
  - Mom welcomes player, mentions setting clock upstairs
  - Vigoroth moving boxes (2 NPCs with movement type MOVEMENT_TYPE_WANDER_AROUND)
  - `VAR_LITTLEROOT_INTRO_STATE = 4`
- [x] Player's Room (2F):
  - Clock interaction → simplified clock set (auto-trigger "Seems like it's already correct!")
  - Set `FLAG_SET_WALL_CLOCK`
  - Pokeball item on floor (if not collected)
- [x] Modern adaptation: if skipping clock UI, auto-set time + `FLAG_SET_WALL_CLOCK` and advance `VAR_LITTLEROOT_INTRO_STATE` to 6
- [x] After clock set (`VAR_LITTLEROOT_INTRO_STATE == 6`):
  - Mom calls player downstairs
  - TV broadcast about Dad's gym
  - `VAR_LITTLEROOT_INTRO_STATE = 7` → free exploration begins
- [x] Block player from leaving house until `VAR_LITTLEROOT_INTRO_STATE >= 7` (GoSeeRoom coord event blocks at state 4, state 5 pushes upstairs)
- [x] Implement both house variants (`BrendansHouse_*` and `MaysHouse_*`) and select by player gender
- [x] Support house scripts that call shared `PlayersHouse_1F_*` and `PlayersHouse_2F_*` event scripts
- [x] Support moving-box metatile swaps on load (`setmetatile ... TRUE` for immediate redraw)
- [x] Implement rival-mom intro event (exclamation emote + approach + `GetRivalSonDaughterString`)

### 2.4 Meet Rival
> Map: `data/maps/LittlerootTown_BrendansHouse_2F/scripts.inc` (or May's)

- [x] When player enters rival's room (controlled by `VAR_LITTLEROOT_RIVAL_STATE`):
  - Rival appears, introduces themselves
  - Movement script: Rival approaches from different positions (3 coord event variants)
  - Brief dialogue about Pokemon and Birch
  - Rival runs out of room
  - `VAR_LITTLEROOT_RIVAL_STATE = 3`
- [x] Interaction is triggered by rival's Pokeball object script (not a generic NPC) — deferred, requires A-button NPC interaction
- [x] Branch movement based on coord event variant (0/1/2 positions per house)
- [-] BGM flow: `playbgm MUS_ENCOUNTER_*`, `savebgm`, then `fadedefaultbgm`

---

## Phase 3: Route 101 — Birch Rescue & Starter Selection

### 3.1 Route 101 Entry Trigger
> Map: `data/maps/Route101/scripts.inc`

- [-] Coordinate trigger at (10,19) and (11,19) when `VAR_ROUTE101_STATE == 1`:
  - `lockall`
  - Play `MUS_HELP` background music
  - `msgbox "Help me!"` (Birch calling)
  - Position Birch at (0,15), Zigzagoon at (0,16)
  - Apply simultaneous movement scripts:
    - Player walks into scene
    - Birch runs away (walk_fast patterns)
    - Zigzagoon chases Birch (3 rectangular loops)
  - Birch and Zigzagoon face each other
  - `msgbox "Help! In my BAG!"`
  - `VAR_ROUTE101_STATE = 2`
  - `releaseall`
- [x] Block exits while `VAR_ROUTE101_STATE == 2` (trigger events on map edges)
- [x] Birch's bag is an interactable object event on the ground
- [x] Route 101 ON_FRAME table sets `FLAG_HIDE_MAP_NAME_POPUP` and `VAR_ROUTE101_STATE = 1`
- [x] Coordinate triggers come from `coord_events` in `map.json`, not `scripts.inc`

### 3.2 Starter Selection
> C ref: `src/starter_choose.c`, `graphics/starter_choose/`

- [x] When player interacts with Birch's bag (`Route101_EventScript_BirchsBag`):
  - `setflag FLAG_SYS_POKEMON_GET`
  - `setflag FLAG_RESCUED_BIRCH`
  - Fade to black, remove Zigzagoon
  - Call `special ChooseStarter` → opens starter UI
- [-] Implement Starter Choose screen:
  - Display 3 Pokeballs with Pokemon previews (Treecko/Torchic/Mudkip)
  - Background: `graphics/starter_choose/birch_grass.bin` (grassy field)
  - Birch's bag sprite
  - Select → confirm dialog ("You want TREECKO?") → add to party
  - C ref: `src/starter_choose.c` (`Task_StarterChoose*`)
- [x] After selection:
  - `givemon SPECIES_[chosen], 5` (level 5 starter)
  - Birch approaches player, thanks them
  - `special HealPlayerParty`
  - Set progression flags
  - Warp to Birch's Lab (6, 5)
- [x] `ChooseStarter` special must set `VAR_STARTER_MON` + `VAR_RESULT` and start the first battle (see `CB2_GiveStarter`)
- [x] Post-choice script sets `FLAG_HIDE_ROUTE_101_BIRCH_ZIGZAGOON_BATTLE`, `FLAG_HIDE_ROUTE_101_BIRCH_STARTERS_BAG`, `FLAG_HIDE_LITTLEROOT_TOWN_BIRCHS_LAB_BIRCH`, `VAR_BIRCH_LAB_STATE = 2`, `VAR_ROUTE101_STATE = 3`

### 3.3 Pokemon Data for Starters
> C ref: `src/data/pokemon/species_info.h`, `src/data/pokemon/level_up_learnsets.h`

- [x] Ensure species data exists for: Treecko (252), Torchic (255), Mudkip (258)
- [x] Ensure species data exists for: Poochyena (261) for first battle
- [x] Level 5 movesets:
  - Treecko: Pound, Leer
  - Torchic: Scratch, Growl
  - Mudkip: Tackle, Growl
- [x] Stats calculation at level 5 with random IVs and neutral nature
- [x] Integrate with `PartyContext` — add starter to party slot 0

### 3.4 Birch's Lab — Receive Starter
> Map: `data/maps/LittlerootTown_ProfessorBirchsLab/scripts.inc`

- [ ] MAP_SCRIPT_ON_FRAME when `VAR_BIRCH_LAB_STATE == 2`:
  - Birch: "I'd like you to have this Pokemon"
  - Fanfare music plays
  - Nickname prompt (Yes/No)
  - If yes → NamingScreen for Pokemon
  - Birch suggests meeting rival
  - `VAR_BIRCH_LAB_STATE = 3`
- [x] Use `bufferleadmonspeciesname STR_VAR_1` in dialog
- [-] `playfanfare` + `waitfanfare` around message flow
- [ ] Nickname flow uses `Common_EventScript_NameReceivedPartyMon` with `VAR_0x8004 = 0` (party slot)

---

## Phase 4: Battle System (MVP)

The first battle is a scripted wild encounter: player's Level 5 starter vs Level 2 Poochyena. This is the simplest possible battle — no items needed, no switching, no catching.

### 4.1 Battle State & Transition
> C ref: `src/battle_setup.c` (`BattleSetup_StartWildBattle`), `src/battle_transition.c`

- [x] Add `BATTLE` to GameState enum
- [x] Create `src/states/BattleState.ts`:
  - Accept battle params: player party, wild pokemon species/level
  - Battle transition effect (screen wipe/slide)
  - Return to overworld after battle with outcome
- [x] Create transition animation (simple fade-to-black acceptable for MVP)
- [-] First battle entry uses `B_TRANSITION_BLUR` and sets `BATTLE_TYPE_FIRST_BATTLE`
- [x] `ChooseStarter` special must kick off battle flow and hand control to BattleState

### 4.2 Battle Scene & UI
> C ref: `src/battle_main.c`, `src/battle_bg.c`, `src/battle_interface.c`

- [x] Create `src/battle/BattleScene.tsx`:
  - Background: Route 101 grass battlefield (`graphics/battle_environment/`)
  - Player's Pokemon sprite (back view) — left side
  - Wild Pokemon sprite (front view) — right side
  - HP bars for both (reuse existing HPBar component)
  - Pokemon name + level display
  - Text box at bottom
- [x] Battle intro sequence:
  - "Wild POOCHYENA appeared!"
  - Send out animation (Pokeball throw → Pokemon appears)
  - "Go! TREECKO!"

### 4.3 Battle Action Menu
> C ref: `src/battle_controllers_player.c` (`HandleInputChooseAction`)

- [x] Create action menu: FIGHT / BAG / POKEMON / RUN
  - FIGHT → show move list (1-2 moves for starters)
  - BAG → "No items" or disabled for first battle
  - POKEMON → party view (only 1 Pokemon)
  - RUN → attempt to flee (may fail for scripted battle)
- [x] Move selection submenu: show move name, PP, type
- [x] If `BATTLE_TYPE_FIRST_BATTLE`, force BAG/POKEMON/RUN disabled

### 4.4 Damage Calculation
> C ref: `src/pokemon.c` (`CalculateBaseDamage`, lines 3106-3340)

- [x] Implement Gen 3 damage formula:
  ```
  damage = ((2 * level / 5 + 2) * power * atk / def / 50 + 2) * modifier
  modifier = STAB * typeEffectiveness * random(85..100) / 100
  ```
- [x] Physical/Special split: Gen 3 uses type-based split (not move-based)
  - Physical types: Normal, Fighting, Flying, Poison, Ground, Rock, Bug, Ghost, Steel
  - Special types: Fire, Water, Grass, Electric, Psychic, Ice, Dragon, Dark
- [x] Type effectiveness table (at minimum for types used in first battle)
- [x] Critical hit chance: stage 0 = 1/16, stage 1 = 1/8
- [x] STAB: 1.5x when move type matches Pokemon type
- [x] Fixed-damage parity for `Super Fang` / `Sonic Boom` / level-damage moves now respects type immunity checks
- [x] False Swipe now pre-clamps damage to leave target at 1 HP with no faint event emission

### 4.5 Turn Execution
> C ref: `src/battle_main.c` (`BattleMainCB1`), `src/battle_script_commands.c`

- [x] Turn order: compare Speed stats, higher goes first (ties: random)
- [x] Item and manual switch actions now consume turn order and still allow enemy response
- [x] Accuracy/evasion stage table aligned for Emerald (`+4 = 233/100`)
- [x] Execute moves in order:
  - Accuracy check (hit/miss)
  - Damage calculation
  - Apply damage to HP
  - Display battle message ("TREECKO used POUND!")
  - Show HP bar animation (decrease smoothly)
  - Check faint condition
- [x] Status moves (Leer, Growl): modify stat stages
  - Stat stages: -6 to +6, ratios from `gStatStageRatios[]`
  - Leer: lower defense 1 stage
  - Growl: lower attack 1 stage

### 4.6 Wild AI (Poochyena)
> C ref: `src/battle_ai_main.c`, but for wild Pokemon it's simple

- [x] Wild Pokemon AI: select random move from available moves
- [x] Poochyena level 2 moveset: Tackle only (learns Howl at L5)
- [x] No switching, no items for wild Pokemon

### 4.7 Battle End
> C ref: `src/battle_main.c` (`HandleEndTurn_FinishBattle`)

- [x] Victory condition: wild Pokemon HP reaches 0
  - "Wild POOCHYENA fainted!"
  - EXP gain calculation: use Gen 3 formula from C (wild vs trainer multipliers)
  - Level up check and stat recalculation
  - "TREECKO gained X EXP. Points!"
  - If level up: "TREECKO grew to LV. X!" + stat increase display
- [x] Defeat condition: player's Pokemon HP reaches 0
  - "TREECKO fainted!" → white out → respawn at last heal point
- [x] Run condition: `runChance = (playerSpeed * 128 / wildSpeed + 30 * escapeAttempts) % 256`
  - First battle is scripted — running may be blocked
- [x] Simultaneous faint now resolves as draw and maps to `B_OUTCOME_DREW` (player-defeated script path)
- [x] Toxic end-turn damage now scales correctly (1/16, 2/16, …) and sleep infliction uses Emerald 2–5 turns
- [x] Return to overworld: transition back with battle outcome

### 4.8 Post-Battle Return
> C ref: `src/battle_setup.c` (`CB2_EndWildBattle`)

- [x] After winning, return to Route 101 overworld
- [x] Script continues: Birch thanks player, warp to lab
- [x] Game progression flags already set during bag interaction
- [ ] Restore map music after battle (match `Overworld_ClearSavedMusic` behavior)

---

## Phase 5: Polish & Integration

### 5.1 Sound Effects
> C ref: `sound/songs/midi/`, `include/constants/songs.h`

- [ ] Implement basic sound effect system (Web Audio API or simple audio tags)
- [ ] Priority sounds for new game flow:
  - SE_TRUCK_MOVE, SE_TRUCK_STOP, SE_TRUCK_UNLOAD, SE_TRUCK_DOOR
  - SE_LEDGE, SE_DOOR, SE_EXIT, SE_PIN, SE_SELECT, SE_CLICK
  - MUS_HELP (Birch rescue), MUS_NEWGAME_LEAVE_HOME, MUS_ENCOUNTER_BRENDAN
  - MUS_OBTAIN_ITEM (fanfare), MUS_TITLE
  - Battle music

### 5.2 Screen Transitions
> C ref: `src/task.c`, `src/palette.c` (`BeginNormalPaletteFade`)

- [x] Enhance FadeController for script-triggered fades:
  - `fadescreen FADE_TO_BLACK` / `FADE_FROM_BLACK`
  - Warp transitions: fade out → load map → fade in
- [x] Battle transition effect
- [x] Implement `warpsilent` (no fade, but still runs map scripts + updates camera)

### 5.3 Conditional Object Display
> C ref: `src/event_data.c`, `src/field_control_avatar.c`

- [x] When loading map objects, check each object's `flag` field:
  - If flag name starts with `FLAG_HIDE_*` and flag IS set → hide the NPC
  - If no flag → always show
- [x] Update on flag changes (e.g., after script sets/clears a flag, refresh visible objects)
- [x] This is already partially wired in ObjectEventManager — verify and complete

### 5.4 Map-Specific Metatile Overrides
> C ref: `src/scrcmd.c` (`ScrCmd_setmetatile`)

- [x] Implement `setmetatile` script command:
  - Changes a tile at runtime (e.g., truck exit light)
  - Used by InsideOfTruck ON_LOAD to set light tiles
  - Persists until map unload
- [x] Respect redraw flag (`TRUE` redraws map immediately; `FALSE` defers)

### 5.5 Save Integration
- [x] Save all new game state: variables, flags, party Pokemon, current map
- [x] Auto-save after key events (choosing starter, entering lab)
- [x] Continue from save restores exact state (flags, variables, party, position)
- [-] Persist dynamic warp + respawn point + RNG seed for deterministic continuation

---

## Implementation Order (Recommended)

```
Week 1: Foundation
  ├── 0.0 Deterministic Timing & RNG
  ├── 0.1 Game Variables
  ├── 0.2 Enhanced Game Flags
  └── 0.3 Script Engine Core (commands + movement)

Week 2: Script Integration
  ├── 0.4 Map Script Hooks
  ├── 0.5 NPC Interaction
  ├── 0.6 Text + 0.7 Input Parity
  ├── 0.11 Map Events + 0.12 Scripted Objects + 0.13 Field Effects + 0.14 Movement Parity
  └── 1.3 Name Input (simplified)

Week 3: New Game Flow Part 1
  ├── 1.1 Birch Speech State
  ├── 1.2 Player Profile Init
  ├── 2.1 Inside Truck
  └── 2.2 Littleroot Arrival

Week 4: New Game Flow Part 2
  ├── 2.3 Player's House Events
  ├── 2.4 Meet Rival
  ├── 3.1 Route 101 Trigger
  └── 3.2 Starter Selection

Week 5: Battle System
  ├── 4.1 Battle State & Transition
  ├── 4.2 Battle Scene & UI
  ├── 4.3 Battle Action Menu
  ├── 4.4 Damage Calculation
  └── 4.5 Turn Execution

Week 6: Completion
  ├── 4.6-4.8 Battle End & Return
  ├── 3.3 Pokemon Data
  ├── 3.4 Birch's Lab
  └── 5.1-5.5 Polish
```

---

## Key C Source Files Reference

| System | C File | Lines | Purpose |
|--------|--------|-------|---------|
| Script engine | `src/script.c` | 471 | Core interpreter, ScriptContext |
| Script commands | `src/scrcmd.c` | 2307 | 220 command implementations |
| Script movement | `src/script_movement.c` | 250 | Movement script execution |
| Field specials | `src/field_specials.c` | 1000+ | Special C functions called by script |
| Truck scene | `src/field_special_scene.c` | 280 | Truck shake, camera effects |
| New game init | `src/new_game.c` | 200 | Data initialization |
| Main menu | `src/main_menu.c` | 1500 | Birch speech, naming |
| Naming screen | `src/naming_screen.c` | 1800 | Character name input |
| Starter choose | `src/starter_choose.c` | 600 | Starter selection UI |
| Battle main | `src/battle_main.c` | 5000 | Battle state machine |
| Battle setup | `src/battle_setup.c` | 800 | Wild/trainer battle init |
| Damage calc | `src/pokemon.c:3106` | 240 | CalculateBaseDamage |
| Overworld | `src/overworld.c` | 2000 | Map scripts, field control |
| Object events | `src/event_object_movement.c` | 5000 | NPC movement system |

## Key Map Scripts Reference

| Map | Script File | Key Events |
|-----|-------------|------------|
| InsideOfTruck | `data/maps/InsideOfTruck/scripts.inc` | Truck arrival, intro flags |
| LittlerootTown | `data/maps/LittlerootTown/scripts.inc` | Mom greeting, house entry |
| Player House 1F | `data/maps/LittlerootTown_BrendansHouse_1F/scripts.inc` | Mom welcome, TV, clock |
| Player House 2F | `data/maps/LittlerootTown_BrendansHouse_2F/scripts.inc` | Clock, rival meeting |
| Birch's Lab | `data/maps/LittlerootTown_ProfessorBirchsLab/scripts.inc` | Starter gift, Pokedex |
| Route 101 | `data/maps/Route101/scripts.inc` | Birch rescue, starter choose |

## State Variable Quick Reference

| Variable | Values | Purpose |
|----------|--------|---------|
| `VAR_LITTLEROOT_INTRO_STATE` | 0-7 | Main intro progression |
| `VAR_LITTLEROOT_TOWN_STATE` | 0-3 | Town events |
| `VAR_BIRCH_LAB_STATE` | 0-5 | Lab events |
| `VAR_ROUTE101_STATE` | 0-3 | Route 101 rescue |
| `VAR_LITTLEROOT_RIVAL_STATE` | 0-4 | Rival encounters |

See: [docs/features/newgame/STATE_VARIABLES.md](../features/newgame/STATE_VARIABLES.md)
