---
title: Battle Plan (Codex)
status: planned
written_on: 2026-02-12
last_verified: 2026-02-12
---

# Battle Plan (Codex)

## Goal
Build a complete battle system that is performant (WebGL), visually/authentically close to GBA Emerald, and integrated with the shared dialog, menu, input, scripting, and item systems.

## Requested Feature Status (2026-02-12)

| Feature | Status | Current State |
|---|---|---|
| Battle rendering in WebGL | □ | `src/states/BattleState.ts` renders via Canvas2D only. |
| Pixel-perfect GBA authenticity | □ | MVP math exists, but type chart/effects/scripts/graphics parity is incomplete. |
| Use shared dialog system | □ | Battle text is local queue rendering, not `src/components/dialog/*`. |
| Reuse Pokemon menu system | □ | Battle state does not use `src/menu/*` for party/bag actions. |
| Show battle background + platforms | □ | Placeholder rectangles only. |
| Show Pokemon battle graphics | □ | Placeholder rectangles; no battle sprites loaded. |
| Infra for battle animations | □ | No battle animation scheduler/runtime yet. |
| Investigate/implement battle scripting | □ | Docs exist; no battle script interpreter runtime in TS. |
| Use global key mapping system | □ | Battle state hardcodes key codes; no `inputMap` usage. |
| Overlay battle on top of map for large viewports | □ | Battle is separate non-overworld state canvas. |
| Wild + single trainer support, doubles-ready infra | □ | MVP wild flow exists; trainer battles are mapped placeholders. |
| In-battle items + item scripting support | □ | Bag/items exist globally; no in-battle item execution. |

## Current Foundation Already In Repo

- ■ `src/states/BattleState.ts` has MVP turn loop, action menu, move menu, damage, EXP, and return-to-overworld transitions.
- ■ Story script entry points can trigger battle state (`startFirstBattle`, `startTrainerBattle`) in `src/pages/gamePage/useHandledStoryScript.ts`.
- ■ `trainerbattle_*` script commands exist in `src/scripting/ScriptRunner.ts` and set trainer defeated flags.
- ■ Shared systems already exist and should be reused: `src/components/dialog/*`, `src/menu/*`, `src/core/InputMap.ts`, `src/game/BagManager.ts`, `src/data/items.ts`.
- ■ Battle documentation set under `docs/features/battle/*` now has explicit `written_on` + `status` + `last_verified`.

## Source-of-Truth C Files (Parity Targets)

- `public/pokeemerald/src/battle_main.c` (5,267 lines — state machine, gTypeEffectiveness at L335-449, turn loop)
- `public/pokeemerald/src/battle_setup.c` (~800 lines — wild/trainer battle initialization)
- `public/pokeemerald/src/battle_script_commands.c` (10,326 lines — 60+ battle commands, move execution)
- `public/pokeemerald/src/battle_util.c` (4,038 lines — status checks, ability interactions, stat utilities)
- `public/pokeemerald/src/battle_interface.c` (~1,500 lines — health boxes, HP bars, status icons)
- `public/pokeemerald/src/battle_bg.c` (~600 lines — background loading, terrain mapping)
- `public/pokeemerald/src/battle_gfx_sfx_util.c` (~800 lines — sprite loading, palette management)
- `public/pokeemerald/src/battle_anim.c` (main animation engine, command interpreter)
- `public/pokeemerald/src/battle_ai_script_commands.c` (~3,000 lines — 92+ AI bytecode commands, scoring)
- `public/pokeemerald/src/battle_ai_switch_items.c` (~1,000 lines — switching/item AI decisions)
- `public/pokeemerald/src/pokemon.c` (7,171 lines — damage formula at L3106, stat calcs, exp tables, catch rate)
- `public/pokeemerald/src/random.c` (~50 lines — LCG RNG: `gRngValue * 0x41C64E6D + 0x00006073`)
- `public/pokeemerald/src/wild_encounter.c` (~800 lines — encounter rates, wild Pokemon generation)
- `public/pokeemerald/src/item_use.c` (~1,500 lines — battle item effects: potions, balls, etc.)
- `public/pokeemerald/src/battle_message.c` (~2,000 lines — battle text, string buffers, placeholder tokens)
- `public/pokeemerald/src/battle_transition.c` (~2,000 lines — screen transition effects)
- `public/pokeemerald/src/data/*.h` battle-related data tables (see detailed list below)

## Comprehensive File Reference Map (Required)

This is the full reference map for battle work, from runtime logic through assets and trainer data.

### 1) Core Battle Logic

- TypeScript (current runtime/integration):
  - `src/states/BattleState.ts`
  - `src/pages/gamePage/useHandledStoryScript.ts`
  - `src/scripting/ScriptRunner.ts`
  - `src/scripting/trainerFlags.ts`
  - `src/game/NewGameFlow.ts`
  - `src/core/GameStateManager.ts`
  - `src/pages/GamePage.tsx`
- Pokeemerald parity files:
  - `public/pokeemerald/src/battle_setup.c`
  - `public/pokeemerald/src/battle_main.c`
  - `public/pokeemerald/src/battle_util.c`
  - `public/pokeemerald/src/battle_util2.c`
  - `public/pokeemerald/src/battle_script_commands.c`
  - `public/pokeemerald/src/battle_controllers.c`
  - `public/pokeemerald/src/battle_controller_player.c`
  - `public/pokeemerald/src/battle_controller_opponent.c`
  - `public/pokeemerald/src/battle_message.c`
  - `public/pokeemerald/src/post_battle_event_funcs.c`

### 2) Headers and Constants

- Core battle headers:
  - `public/pokeemerald/include/battle.h`
  - `public/pokeemerald/include/battle_main.h`
  - `public/pokeemerald/include/battle_setup.h`
  - `public/pokeemerald/include/battle_script_commands.h`
  - `public/pokeemerald/include/battle_scripts.h`
  - `public/pokeemerald/include/battle_interface.h`
  - `public/pokeemerald/include/battle_bg.h`
  - `public/pokeemerald/include/battle_anim.h`
- Constants needed for parity:
  - `public/pokeemerald/include/constants/battle.h` (STATUS1/2 bitmasks, BATTLE_TYPE flags, B_OUTCOME values, MOVE_TARGET_*)
  - `public/pokeemerald/include/constants/battle_ai.h` (AI_FLAG_* constants)
  - `public/pokeemerald/include/constants/battle_move_effects.h` (214 EFFECT_* IDs)
  - `public/pokeemerald/include/constants/battle_string_ids.h` (300+ message IDs)
  - `public/pokeemerald/include/constants/battle_anim.h` (animation IDs)
  - `public/pokeemerald/include/constants/battle_script_commands.h`
  - `public/pokeemerald/include/constants/battle_setup.h`
  - `public/pokeemerald/include/constants/moves.h` (move ID constants)
  - `public/pokeemerald/include/constants/items.h` (item ID constants)
  - `public/pokeemerald/include/constants/item.h` (item properties)
  - `public/pokeemerald/include/constants/item_effects.h` (ITEM_EFFECT_* — HP amounts, status cure flags)
  - `public/pokeemerald/include/constants/abilities.h` (ability ID constants)
  - `public/pokeemerald/include/constants/hold_effects.h` (80+ HOLD_EFFECT_* — Choice Band, Leftovers, type boosters)
  - `public/pokeemerald/include/constants/pokemon.h` (TYPE_*, NATURE_*, growth rate constants, stat indices)
  - `public/pokeemerald/include/constants/trainers.h` (TRAINER_* IDs)
  - `public/pokeemerald/include/constants/trainer_types.h` (class base money per type)
  - `public/pokeemerald/include/constants/weather.h` (weather type constants)

### 3) Scripting (Field and Battle)

- TypeScript script runtime:
  - `src/scripting/ScriptRunner.ts`
  - `src/data/scripts/index.ts`
  - `src/data/scripts/types.ts`
  - `src/data/scripts/*.gen.ts` (contains `trainerbattle_*`, `setwildbattle`, `dowildbattle`)
- Pokeemerald script sources:
  - `public/pokeemerald/data/scripts/trainer_battle.inc`
  - `public/pokeemerald/data/battle_scripts_1.s`
  - `public/pokeemerald/data/battle_scripts_2.s`
  - `public/pokeemerald/data/battle_ai_scripts.s`
  - `public/pokeemerald/data/battle_anim_scripts.s`

### 4) Items (Battle Usage and Effects)

- TypeScript:
  - `src/game/BagManager.ts` — `bagManager.addItem()`, `.removeItem()`, `.hasItem()`, `.getItemQuantity()`, `.getPocket()`; 5 pockets (items/keyItems/pokeBalls/tmHm/berries)
  - `src/game/MoneyManager.ts` — `moneyManager.addMoney()`, `.removeMoney()`, `.isEnoughMoney()`; MAX_MONEY=999999, MAX_COINS=9999
  - `src/data/items.ts` — ITEMS constants, `getItemName()`, `getItemId()`
  - `src/data/itemDescriptions.ts`
  - `src/data/itemScripts.ts`
  - `src/menu/components/BagMenu.tsx` — existing bag screen (needs `mode: 'battle'` filter)
- Pokeemerald parity:
  - `public/pokeemerald/include/constants/items.h`
  - `public/pokeemerald/include/constants/item_effects.h` (item effect byte definitions — heal amounts, status cures)
  - `public/pokeemerald/include/constants/hold_effects.h` (80+ held item effects)
  - `public/pokeemerald/src/data/items.h` (`.battleUsage`, `.battleUseFunc` fields, ball catch multipliers)
  - `public/pokeemerald/src/data/pokemon/item_effects.h` (item effect byte arrays)
  - `public/pokeemerald/src/battle_ai_switch_items.c`
  - `public/pokeemerald/src/item_use.c` (battle item functions)

### 5) Moves

- TypeScript:
  - `src/data/moves.ts`
- Pokeemerald parity:
  - `public/pokeemerald/src/data/battle_moves.h`
  - `public/pokeemerald/include/constants/moves.h`
  - `public/pokeemerald/include/constants/battle_move_effects.h`
  - `public/pokeemerald/data/battle_scripts_1.s`
  - `public/pokeemerald/data/battle_scripts_2.s`

### 6) Pokemon Data and Stats

- TypeScript:
  - `src/data/species.ts` — `SPECIES` constants (1-411)
  - `src/data/speciesInfo.ts` — `getSpeciesInfo(id)` → `{ baseHP, baseAttack, ..., types: [str,str], catchRate, expYield, evYield, growthRate, abilities: [num,num] }`
  - `src/data/abilities.ts` — ability constants and descriptions
  - `src/pokemon/types.ts` — `PartyPokemon`, `BoxPokemon`, `Stats`, `STATUS` constants (NONE/SLEEP/POISON/BURN/FREEZE/PARALYSIS/TOXIC)
  - `src/pokemon/stats.ts` — `calculateAllStats()`, `calculateLevelFromExp()`, `recalculatePartyStats()`, `getExpForLevel()`, `getExpToNextLevel()`, `getNatureStatModifier()`, `isShiny()`, `getAbility()`
  - `src/pokemon/testFactory.ts` — `createTestPokemon(options)`, `createQuickPokemon(name, level)`
  - `src/save/native/Gen3Pokemon.ts`
  - `src/save/types.ts`
- Pokeemerald parity:
  - `public/pokeemerald/src/pokemon.c` (7,171 lines — damage formula L3106, stat calcs, exp, catch rate, nature modifiers)
  - `public/pokeemerald/include/pokemon.h` (BattlePokemon struct at L260, BattleMove struct at L327)
  - `public/pokeemerald/src/data/pokemon/species_info.h` (base stats, types, abilities, catch rate per species)
  - `public/pokeemerald/src/data/pokemon/experience_tables.h` (6 growth rate tables: ERRATIC, FAST, MEDIUM_FAST, MEDIUM_SLOW, SLOW, FLUCTUATING)
  - `public/pokeemerald/src/data/pokemon/level_up_learnsets.h` (level-up moves per species)
  - `public/pokeemerald/src/data/pokemon/level_up_learnset_pointers.h`
  - `public/pokeemerald/src/data/pokemon/tmhm_learnsets.h`
  - `public/pokeemerald/src/data/pokemon/egg_moves.h`
  - `public/pokeemerald/src/data/pokemon/evolution.h`
  - `public/pokeemerald/src/data/text/nature_names.h` (25 nature names)

### 7) Randomness and Determinism

- TypeScript current state:
  - `src/states/BattleState.ts` (uses `Math.random` directly)
  - `src/pokemon/testFactory.ts` (random IV/personality helpers)
  - `src/core/GameStateManager.ts`
  - `src/config/timing.ts`
- Pokeemerald parity:
  - `public/pokeemerald/src/random.c`
  - `public/pokeemerald/include/random.h`
  - `public/pokeemerald/src/main.c`
  - `public/pokeemerald/include/main.h`

### 8) Graphics, Sprites, and UI Assets

- Pokemon battle sprites (386 species, 64×64 each):
  - `public/pokeemerald/graphics/pokemon/{species_name}/front.png` — front battle sprite
  - `public/pokeemerald/graphics/pokemon/{species_name}/back.png` — back battle sprite
  - `public/pokeemerald/graphics/pokemon/{species_name}/normal.pal` — normal palette (indexed 4bpp)
  - `public/pokeemerald/graphics/pokemon/{species_name}/shiny.pal` — shiny palette
- Battle environments (10 terrains, each with tiles + map + palette):
  - `public/pokeemerald/graphics/battle_environment/{tall_grass,long_grass,sand,underwater,water,pond_water,rock,cave,building,sky,stadium}/`
  - Each has: `tiles.png`, `map.bin`, `palette.pal`, optionally `anim_tiles.png` + `anim_map.bin`
- Battle interface (37 files):
  - `public/pokeemerald/graphics/battle_interface/healthbox_singles_player.png`
  - `public/pokeemerald/graphics/battle_interface/healthbox_singles_opponent.png`
  - `public/pokeemerald/graphics/battle_interface/healthbox_doubles_player.png`
  - `public/pokeemerald/graphics/battle_interface/healthbox_doubles_opponent.png`
  - `public/pokeemerald/graphics/battle_interface/hpbar.png` + `hpbar_anim.png`
  - `public/pokeemerald/graphics/battle_interface/expbar.png`
  - `public/pokeemerald/graphics/battle_interface/status.png` (PSN/BRN/SLP/FRZ/PAR icons)
  - `public/pokeemerald/graphics/battle_interface/ball_display.png` (party status indicators)
  - `public/pokeemerald/graphics/battle_interface/enemy_mon_shadow.png`
  - `public/pokeemerald/graphics/battle_interface/textbox.png`
  - `public/pokeemerald/graphics/battle_interface/numbers1.png` + `numbers2.png` (HP digit fonts)
  - `public/pokeemerald/graphics/battle_interface/level_up_banner.png`
  - `public/pokeemerald/graphics/battle_interface/misc.png`
  - Various `.pal` files: `textbox_normal.pal`, `text.pal`, `text_pp.pal`
- Battle transitions:
  - `public/pokeemerald/graphics/battle_transitions/`
- Trainer battle sprites:
  - `public/pokeemerald/graphics/trainers/front_pics/` (all trainer classes)
  - `public/pokeemerald/graphics/trainers/back_pics/` (player back sprites)
  - `public/pokeemerald/graphics/trainers/palettes/`
- Animation sprites:
  - `public/pokeemerald/graphics/battle_anims/sprites/` (effect particles, weather, stat arrows)
- C asset manifests:
  - `public/pokeemerald/src/data/graphics/battle_environment.h`
  - `public/pokeemerald/src/data/graphics/trainers.h`
  - `public/pokeemerald/src/data/graphics/pokemon.h`
  - `public/pokeemerald/src/data/pokemon_graphics/front_pic_table.h` + `back_pic_table.h`
  - `public/pokeemerald/src/data/pokemon_graphics/front_pic_coordinates.h` + `back_pic_coordinates.h`
  - `public/pokeemerald/src/data/pokemon_graphics/palette_table.h` + `shiny_palette_table.h`
  - `public/pokeemerald/src/data/pokemon_graphics/enemy_mon_elevation.h`
  - `public/pokeemerald/src/data/trainer_graphics/front_pic_tables.h` + `back_pic_tables.h`
- TypeScript consumers already in repo:
  - `src/menu/components/PokemonSummaryContent.tsx`
  - `src/menu/components/PokemonSummary.tsx`

### 9) Battle Animation System

- Pokeemerald animation runtime:
  - `public/pokeemerald/src/battle_anim.c`
  - `public/pokeemerald/src/battle_anim_effects_1.c`
  - `public/pokeemerald/src/battle_anim_effects_2.c`
  - `public/pokeemerald/src/battle_anim_effects_3.c`
  - `public/pokeemerald/src/battle_anim_mons.c`
  - `public/pokeemerald/src/battle_anim_mon_movement.c`
  - `public/pokeemerald/src/battle_anim_utility_funcs.c`
  - `public/pokeemerald/src/battle_anim_sound_tasks.c`
  - `public/pokeemerald/src/battle_anim_status_effects.c`
  - `public/pokeemerald/src/battle_anim_normal.c`
  - `public/pokeemerald/src/battle_anim_fire.c`
  - `public/pokeemerald/src/battle_anim_water.c`
  - `public/pokeemerald/src/battle_anim_electric.c`
  - `public/pokeemerald/src/battle_anim_ice.c`
  - `public/pokeemerald/src/battle_anim_fight.c`
  - `public/pokeemerald/src/battle_anim_poison.c`
  - `public/pokeemerald/src/battle_anim_ground.c`
  - `public/pokeemerald/src/battle_anim_flying.c`
  - `public/pokeemerald/src/battle_anim_psychic.c`
  - `public/pokeemerald/src/battle_anim_bug.c`
  - `public/pokeemerald/src/battle_anim_rock.c`
  - `public/pokeemerald/src/battle_anim_ghost.c`
  - `public/pokeemerald/src/battle_anim_dragon.c`
  - `public/pokeemerald/src/battle_anim_dark.c`
  - `public/pokeemerald/src/battle_anim_throw.c`
  - `public/pokeemerald/src/battle_anim_smokescreen.c`
- Animation data/assets:
  - `public/pokeemerald/data/battle_anim_scripts.s`
  - `public/pokeemerald/src/data/battle_anim.h`
  - `public/pokeemerald/graphics/battle_anims/`

### 10) Trainer Battles and Trainer Assets

- TypeScript:
  - `src/pages/gamePage/useHandledStoryScript.ts` (`SCRIPTED_TRAINER_BATTLES` placeholder table)
  - `src/scripting/ScriptRunner.ts` (`trainerbattle_*` handling)
  - `src/scripting/trainerFlags.ts`
- Pokeemerald trainer data + flow:
  - `public/pokeemerald/src/data/trainers.h`
  - `public/pokeemerald/src/data/trainer_parties.h`
  - `public/pokeemerald/src/data/battle_frontier/battle_frontier_trainers.h`
  - `public/pokeemerald/src/data/battle_frontier/battle_frontier_mons.h`
  - `public/pokeemerald/src/data/battle_frontier/battle_frontier_trainer_mons.h`
  - `public/pokeemerald/data/text/trainers.inc`
  - `public/pokeemerald/src/trainer_see.c`
  - `public/pokeemerald/src/wild_encounter.c`
  - `public/pokeemerald/graphics/trainers/`

### 11) WebGL Runtime Paths to Reuse/Extend

- Existing WebGL infra:
  - `src/rendering/webgl/WebGLContext.ts`
  - `src/rendering/webgl/WebGLRenderPipeline.ts`
  - `src/rendering/webgl/WebGLSpriteRenderer.ts`
  - `src/rendering/webgl/WebGLFadeRenderer.ts`
  - `src/rendering/webgl/WebGLScanlineRenderer.ts`
  - `src/rendering/webgl/TilesetUploader.ts`
  - `src/rendering/compositeWebGLFrame.ts`
- Planned battle-specific extension point:
  - `src/rendering/webgl/battle/*` (to be added)

## Implementation Plan

### Phase 0: Architecture + Baseline Cleanup

- ■ Add `written_on` metadata to all docs under `docs/features/battle/*`.
- ■ Inventory current docs and implementation status.
- □ Consolidate overlapping docs into one canonical track:
  - `00-battle-overview.md` / `00-battle-system-overview.md`
  - `01-damage-calculation.md` / `03-damage-calculation.md`
  - `05-battle-messages.md` / `07-battle-messages.md`
  - `06-react-implementation.md` / `08-react-implementation.md` / `13-react-implementation.md`
- □ Define one canonical runtime architecture doc for battle modules before code expansion.

### Phase 1: Runtime Split (Engine vs Presentation)

- □ Create `src/battle/engine/*` (pure simulation/state transitions, no rendering).
- □ Create `src/battle/runtime/*` for orchestration between scripts, state manager, and overlays.
- □ Replace ad-hoc battle payloads with typed `BattleStartRequest` supporting:
  - Wild battle
  - Single trainer battle
  - Reserved slots/teams for doubles-ready structure
- □ Introduce deterministic RNG service for battle parity (seeded, frame-safe).

### Phase 2: WebGL Battle Scene (Performance + Pixel Parity)

- □ Build `src/rendering/webgl/battle/*` render path:
  - Background layer
  - Platform layer
  - Battler sprite layer (front/back)
  - UI layer composition
- □ Load and atlas battle assets from `/pokeemerald/graphics/battle_interface/*` and battle environments.
- □ Enforce pixel-perfect constraints:
  - Integer coordinates
  - Nearest-neighbor sampling
  - No subpixel camera drift
  - Palette-faithful color handling
- □ Keep 2D fallback only for debug parity checks.

### Phase 3: UI, Dialog, Menu, and Input Integration

- □ Replace local battle text queue with shared dialog bridge (`src/components/dialog/DialogBridge.ts` + context hooks).
- □ Replace hardcoded battle key checks with `inputMap` (`src/core/InputMap.ts`).
- □ Hook BATTLE actions to menu components:
  - `BAG` routes into bag flow with battle-use filters.
  - `POKEMON` routes into party flow with battle constraints.
- □ Remove hardcoded UX text like "Press Z / Enter" and use mapped button labels.

### Phase 4: Battle Placement and Overlay Rules

- □ Implement viewport-based presentation mode:
  - If viewport tiles > `25x18`, render battle as top overlay above live map (Start-menu style).
  - Else use dedicated battle scene mode.
- □ Freeze/lock overworld movement and interactions while battle overlay is active.
- □ Keep map and battle timing deterministic when overlay mode is used.

### Phase 5: Core Mechanics Parity (Single Battles First)

- □ Complete type effectiveness table and immunity handling.
- □ Implement proper move effect dispatch (status/stat/weather/volatile effects).
- □ Implement turn-order, accuracy/evasion, crit stages, and edge-case checks per C ordering.
- □ Implement battle outcome values and script-visible result plumbing (`GetBattleOutcome` parity).
- □ Implement trainer team loading from real trainer data (no placeholder species mapping).
- □ Implement wild battle request handling from `setwildbattle` + `dowildbattle`.

### Phase 6: Items and Item Script Integration

- □ Add in-battle item action flow (Bag -> target selection -> effect application).
- □ Import/translate relevant battle item effect logic from C constants/scripts.
- □ Support trainer AI item usage with parity heuristics from `battle_ai_switch_items.c`.
- □ Connect item usage messages and side effects through shared dialog/message pipeline.

### Phase 7: Battle Script Engine + Animation Infra

- □ Implement battle script VM scaffold (opcode table + command handlers + stack/callback semantics).
- □ Implement animation task scheduler independent from battle logic tick.
- □ Add minimal move animation hooks first (tackle/scratch/pound/growl/leer), then expand.
- □ Keep animation events data-driven so scripts can be imported/generated.

### Phase 8: Doubles-Ready Infrastructure

- □ Keep battler indexing and side state compatible with 4 battlers from the start.
- □ Add targeting infrastructure for single now, doubles next.
- □ Implement command/data model for partner slots and side timers.
- □ Add non-regression tests that single-battle logic remains correct with doubles-capable data model.

### Phase 9: Testing, Parity Validation, and Performance Gates

- □ Add golden tests for damage, turn resolution, status flows, and script outcomes.
- □ Add scripted replay tests from curated encounter fixtures.
- □ Add perf benchmarks (frame time, draw calls, texture swaps, memory churn).
- □ Define done criteria:
  - Gameplay parity checks pass for starter, several wild, and trainer battles.
  - Overlay mode behaves correctly on large viewport.
  - Dialog/menu/input parity integrated and no hardcoded key prompts remain.

## Import-at-Scale Script Plan

Follow existing `scripts/generate-*.cjs` pattern (regex-parse C → emit `.gen.ts`). Use `npm run generate:all` convention.

### Already Exist (working generators)
- ■ `scripts/generate-moves.cjs` → `src/data/moves.ts` (355 moves: power, type, accuracy, pp, description)
- ■ `scripts/generate-species-info.cjs` → `src/data/speciesInfo.ts` (base stats, types, abilities, growthRate, evYield, catchRate)
- ■ `scripts/generate-trainer-ids.cjs` → `src/data/trainerIds.gen.ts` (trainer name→ID mapping)
- ■ `scripts/generate-scripts.cjs` → `src/data/scripts/*.gen.ts` (468 maps, 7,666 scripts incl. trainerbattle_*)
- ■ `scripts/generate-item-descriptions.cjs` → `src/data/itemDescriptions.ts`
- ■ `scripts/generate-abilities.cjs` → `src/data/abilities.ts`
- ■ `scripts/generate-flag-var-maps.cjs` → flag/var name→ID maps
- ■ `scripts/generate-new-game-flags.cjs` → `src/data/newGameFlags.gen.ts`
- ■ `scripts/generate-multichoice.cjs` → `src/data/multichoice.gen.ts`

### New Generators Needed

- □ `scripts/generate-type-effectiveness.cjs`
  - Parse: `public/pokeemerald/src/battle_main.c` lines 335-449 (gTypeEffectiveness[336] — 112 triples of [attackType, defType, multiplier])
  - Also: `public/pokeemerald/include/constants/pokemon.h` (TYPE_* constants: NORMAL=0..DARK=16, TYPE_MYSTERY=9)
  - Emit: `src/data/typeEffectiveness.gen.ts`
  - Output: `TYPE_CHART: Record<string, Record<string, number>>` (sparse, only non-1.0 entries) + `getTypeEffectiveness(moveType, defenderTypes): number`

- □ `scripts/generate-battle-moves.cjs`
  - Parse: `public/pokeemerald/src/data/battle_moves.h` (gBattleMoves[] — effect, power, type, accuracy, pp, secondaryEffectChance, target, priority, flags)
  - Also: `public/pokeemerald/include/constants/battle_move_effects.h` (214 EFFECT_* constants)
  - Also: `public/pokeemerald/include/constants/battle.h` (MOVE_TARGET_*, FLAG_MAKES_CONTACT, FLAG_PROTECT_AFFECTED, etc.)
  - Emit: `src/data/battleMoves.gen.ts`
  - Output: `BATTLE_MOVE_DATA: Record<number, BattleMoveData>` with `{ effect, secondaryEffectChance, target, priority, flags }`

- □ `scripts/generate-trainer-parties.cjs`
  - Parse: `public/pokeemerald/src/data/trainers.h` (trainer class, name, AI flags, items[], doubleBattle)
  - Also: `public/pokeemerald/src/data/trainer_parties.h` (4 party struct variants: NoItemDefaultMoves, NoItemCustomMoves, ItemDefaultMoves, ItemCustomMoves)
  - Also: `public/pokeemerald/include/constants/trainers.h` + `trainer_types.h` (IDs, base money per class)
  - Also: `public/pokeemerald/src/data/text/trainer_class_names.h`
  - Emit: `src/data/trainerParties.gen.ts`
  - Output: `TRAINER_DATA: Record<string, TrainerData>` with `{ className, name, doubleBattle, aiFlags, items, party: TrainerMon[] }`

- □ `scripts/generate-battle-backgrounds.cjs`
  - Parse: `public/pokeemerald/src/battle_bg.c` (sBattleTerrainTable, BG templates)
  - Also: `public/pokeemerald/include/constants/battle.h` (BATTLE_TERRAIN_* enums: GRASS..PLAIN)
  - Also: `public/pokeemerald/src/data/graphics/battle_environment.h`
  - Emit: `src/data/battleEnvironments.gen.ts`
  - Output: Maps terrain type → graphics paths + palette info

- □ `scripts/generate-item-battle-effects.cjs`
  - Parse: `public/pokeemerald/src/data/items.h` (`.battleUsage`, `.battleUseFunc`)
  - Also: `public/pokeemerald/include/constants/item_effects.h` (heal amounts, status cure flags)
  - Also: `public/pokeemerald/include/constants/hold_effects.h` (80+ HOLD_EFFECT_*)
  - Also: `public/pokeemerald/src/data/pokemon/item_effects.h` (item effect byte arrays)
  - Emit: `src/data/itemBattleEffects.gen.ts`
  - Output: `ITEM_BATTLE_EFFECTS` (canUseInBattle, healAmount, curesStatus, catchMultiplier) + `HELD_ITEM_EFFECTS` (holdEffect, holdEffectParam)

- □ `scripts/generate-pokemon-sprite-coords.cjs`
  - Parse: `public/pokeemerald/src/data/pokemon_graphics/front_pic_coordinates.h`
  - Also: `public/pokeemerald/src/data/pokemon_graphics/back_pic_coordinates.h`
  - Also: `public/pokeemerald/src/data/pokemon_graphics/enemy_mon_elevation.h`
  - Emit: `src/data/pokemonSpriteCoords.gen.ts`
  - Output: Maps species → `{ frontX, frontY, frontSize, backX, backY, backSize, elevation }`

- □ `scripts/generate-learnsets.cjs`
  - Parse: `public/pokeemerald/src/data/pokemon/level_up_learnsets.h`
  - Also: `public/pokeemerald/src/data/pokemon/level_up_learnset_pointers.h`
  - Emit: `src/data/learnsets.gen.ts`
  - Output: `LEARNSETS: Record<number, Array<{ level: number, moveId: number }>>` per species

- □ `scripts/generate-battle-scripts.cjs` (future — battle script bytecode)
  - Parse: `public/pokeemerald/data/battle_scripts_1.s` + `battle_scripts_2.s`
  - Also: `public/pokeemerald/asm/macros/battle_script.inc` (macro definitions)
  - Emit: `src/data/battleScripts.gen.ts`
  - Output: Move effect scripts as TypeScript command arrays

- □ `scripts/generate-battle-animations.cjs` (future — animation scripts)
  - Parse: `public/pokeemerald/data/battle_anim_scripts.s`
  - Also: `public/pokeemerald/asm/macros/battle_anim_script.inc`
  - Emit: `src/data/battleAnimations.gen.ts`

- □ `scripts/generate-battle-constants.cjs`
  - Parse: `public/pokeemerald/include/constants/battle*.h`
  - Emit: `src/data/battleConstants.gen.ts`
  - Output: STATUS1_*, STATUS2_*, BATTLE_TYPE_*, B_OUTCOME_*, B_ACTION_* as TS constants

## Docs Inventory Status (All Battle Docs)

| File | Status | Written On | Last Verified |
|---|---|---|---|
| 00-battle-ai-overview.md | reference | 2025-11-26 | 2026-01-13 |
| 00-battle-overview.md | reference | 2025-11-26 | 2026-01-13 |
| 00-battle-system-overview.md | reference | 2025-11-26 | 2026-01-13 |
| 01-ai-architecture.md | reference | 2025-11-26 | 2026-01-13 |
| 01-damage-calculation.md | reference | 2025-11-26 | 2026-01-13 |
| 01-move-data-structures.md | reference | 2025-11-26 | 2026-01-13 |
| 02-move-selection-scoring.md | reference | 2025-11-26 | 2026-01-13 |
| 02-type-effectiveness.md | reference | 2025-11-26 | 2026-01-13 |
| 03-damage-calculation.md | reference | 2025-11-26 | 2026-01-13 |
| 03-pokemon-stats.md | reference | 2025-11-26 | 2026-01-13 |
| 03-trainer-vs-wild.md | reference | 2025-11-26 | 2026-01-13 |
| 04-ai-scripts-reference.md | reference | 2025-11-26 | 2026-01-13 |
| 04-battle-scripts.md | reference | 2025-11-26 | 2026-01-13 |
| 04-moves-and-effects.md | reference | 2025-11-26 | 2026-01-13 |
| 05-battle-messages.md | reference | 2025-11-26 | 2026-01-13 |
| 05-capture-mechanics.md | reference | 2025-11-26 | 2026-01-13 |
| 05-switch-item-logic.md | reference | 2025-11-26 | 2026-01-13 |
| 06-animation-system.md | reference | 2025-11-26 | 2026-01-13 |
| 06-battle-flow.md | reference | 2025-11-26 | 2026-01-13 |
| 06-react-implementation.md | planned | 2025-11-26 | 2026-01-13 |
| 07-ai-enhancements.md | reference | 2025-11-26 | 2026-01-13 |
| 07-battle-messages.md | reference | 2025-11-26 | 2026-01-13 |
| 07-double-battles.md | reference | 2025-11-26 | 2026-01-13 |
| 08-battle-ui.md | reference | 2025-11-26 | 2026-01-13 |
| 08-react-implementation.md | planned | 2025-11-26 | 2026-01-13 |
| 09-battle-animations.md | reference | 2025-11-26 | 2026-01-13 |
| 10-ai-system.md | reference | 2025-11-26 | 2026-01-13 |
| 11-special-battles.md | reference | 2025-11-26 | 2026-01-13 |
| 12-source-files.md | reference | 2025-11-26 | 2026-01-13 |
| 13-react-implementation.md | planned | 2025-11-26 | 2026-01-13 |
| battle-system-mvp.md | planned | 2026-02-06 | 2026-02-06 |
