---
title: Legendary Island Encounter Parity (Faraway/Birth/Navel/Southern)
status: in-progress
last_verified: 2026-02-13
---

# Legendary Island Encounter Parity (Faraway/Birth/Navel/Southern)

## Scope

This tracks encounter-only parity for:

- Mew / Faraway Island / Old Sea Map map scripts
- Deoxys / Birth Island / Aurora Ticket map scripts
- Lugia + Ho-Oh / Navel Rock / Mystic Ticket map scripts
- Latias + Latios / Southern Island / Eon Ticket map scripts

Ticket distribution UX and event delivery are intentionally out of scope.

## Primary C References

- `public/pokeemerald/src/scrcmd.c`
- `public/pokeemerald/src/battle_setup.c`
- `public/pokeemerald/src/field_specials.c`
- `public/pokeemerald/src/faraway_island.c`
- `public/pokeemerald/src/event_object_movement.c`
- `public/pokeemerald/src/field_control_avatar.c`
- `public/pokeemerald/data/event_scripts.s`

## Implemented Runtime/Scripting Parity

### Script ingestion and map script hooks

- Added `MAP_SCRIPT_ON_RETURN_TO_FIELD` generation and runtime typing support.
- Added `public/pokeemerald/data/event_scripts.s` to shared script ingestion.
- Added assembler-directive filtering in script parsing for deterministic imports.
- Generated `Common_EventScript_LegendaryFlewAway` in `src/data/scripts/common.gen.ts`.
- Added script-ingestion parity gate: `npm run verify:legendary-script-ingestion`.
- Added parser/regression tests in `scripts/__tests__/generate-scripts.test.cjs`.

### Script commands and battle pipeline

- Implemented `seteventmon` in `src/scripting/ScriptRunner.ts` using the existing wild battle setup path.
- Kept a single battle path (`seteventmon` / `setwildbattle` -> `BattleSetup_Start*` specials -> `BattleState`).
- Added held-item propagation:
  - `ScriptRunner` -> `BattleCommandRunner` -> `useHandledStoryScript` -> `BattleState`
  - payload field: `wildHeldItem`.

### Special handlers (modular)

- Added `src/scripting/specials/legendaryIslandSpecials.ts` for:
  - `SpawnCameraObject`
  - `RemoveCameraObject`
  - `LoopWingFlapSE` (handled no-op to remove warning)
  - `ShakeCamera`
  - `DoDeoxysRockInteraction`
  - `SetDeoxysRockPalette`
  - `SetMewAboveGrass`
  - `DestroyMewEmergingGrassSprite`
- Added Deoxys result constant handling (`DEOXYS_ROCK_FAILED/PROGRESSED/SOLVED/COMPLETE`) in `ScriptRunner` constant resolution.

### Scripted camera runtime

- Added camera runtime services in `src/pages/GamePage.tsx`:
  - spawn/remove scripted camera target
  - scripted camera `applyMovement`
  - scripted camera shake
- `applymovement LOCALID_CAMERA` now routes to camera runtime and no longer does NPC lookup.

### Deoxys rock progression and effects

- Implemented C-style Deoxys progression rules (step limits, result codes, level progression, solved/complete handling) in legendary special handlers.
- `DoDeoxysRockInteraction` now writes `VAR_RESULT` explicitly (C `gSpecialVar_Result` parity for `switch VAR_RESULT` scripts).
- Added field effect runtime support for `FLDEFF_DESTROY_DEOXYS_ROCK` (`run` + `wait`) in `GamePage` script services.
- Replaced tint approximation with exact palette runtime:
  - `src/game/legendary/deoxysRockPaletteRuntime.ts` loads `deoxys_rock_1.pal..deoxys_rock_11.pal`
  - applies indexed-palette recolor to Birth Island stone sprite
  - installs per-level runtime sprite variants via `NPCSpriteLoader` cache override API.
- Deoxys rock movement now invalidates render state every interpolation frame to avoid visible snap-to-target.

### Faraway Mew movement/visibility

- Added translated Mew movement module:
  - `src/game/legendary/farawayMew.ts`
  - includes `GetMewMoveDirection` behavior and step-based visibility cadence rules.
- Replaced placeholder copy-player behavior with C-structured copy-player movement handler:
  - `src/game/npc/movementTypes/copyPlayer.ts`
  - supports copy variants and `_IN_GRASS` rules.
- Added Mew-specific long-grass rendering control via canonical NPC runtime field `renderAboveGrass`.
- Fixed Mew frame dimensions in `NPCSpriteLoader` (`OBJ_EVENT_GFX_MEW`: `16x32`) to prevent partial-body rendering bugs.

### Step-counter parity hooks

- Added reusable island step-counter updates in `StepCallbackManager`:
  - `VAR_FARAWAY_ISLAND_STEP_COUNTER` on `MAP_FARAWAY_ISLAND_INTERIOR`
  - `VAR_DEOXYS_ROCK_STEP_COUNT` on `MAP_BIRTH_ISLAND_EXTERIOR`

### Sprite ID/path and classification parity

- Added alias mapping in `src/data/spriteMetadata.ts`:
  - `OBJ_EVENT_GFX_HOOH` -> `OBJ_EVENT_GFX_HO_OH`
  - `OBJ_EVENT_GFX_DEOXYS_TRIANGLE` -> `OBJ_EVENT_GFX_BIRTH_ISLAND_STONE`
- Replaced brittle substring NPC classification with metadata-driven explicit classification in `src/types/objectEvents.ts`.

### Post-battle scripted return flow

- Added scripted-wild return flow parity:
  - after non-defeat scripted wild battles, run map `onReturnToField` then `onResume`.

## Current Warning Gate Status

The following warning classes are implemented/handled in code paths above and should no longer appear in normal legendary encounter flows:

- `Unimplemented special: SpawnCameraObject/RemoveCameraObject/LoopWingFlapSE/ShakeCamera/DoDeoxysRockInteraction/...`
- `Unknown command: seteventmon`
- `goto target not found: Common_EventScript_LegendaryFlewAway`
- `applymovement skipped: NPC LOCALID_CAMERA not found`
- Ho-Oh alias mismatch (`OBJ_EVENT_GFX_HOOH`)

## Verification Checklist (Manual QA)

- Birth Island: triangle visible, movement sequence + progression logic, solve path, Deoxys spawn/battle.
- Navel Rock: Ho-Oh and Lugia scripted pans/shake paths and level 70 battles.
- Southern Island: camera pan + Lati approach + level 50 battle with Soul Dew via `seteventmon`.
- Faraway Island: hide-and-seek movement cadence, no persistent clipping bug, battle + return behavior.
