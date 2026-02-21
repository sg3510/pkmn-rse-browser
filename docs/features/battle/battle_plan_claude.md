---
title: Battle System Implementation Plan & Status
status: planned
written_on: 2026-02-12
last_verified: 2026-02-21
---

# Battle System — Implementation Plan & Status

## Existing Documentation Status

| Doc | Title | Written | Status |
|-----|-------|---------|--------|
| `00-battle-overview.md` | Battle System Overview | 2026-01-13 | reference |
| `00-battle-system-overview.md` | System Architecture | 2025-11-26 | reference |
| `00-battle-ai-overview.md` | AI Executive Summary | 2025-11-26 | reference |
| `01-damage-calculation.md` | Damage Formula | 2025-11-26 | reference |
| `01-move-data-structures.md` | Move Structs | 2025-11-26 | reference |
| `01-ai-architecture.md` | AI Architecture | 2025-11-26 | reference |
| `02-type-effectiveness.md` | Type Chart | 2025-11-26 | reference |
| `02-move-selection-scoring.md` | AI Scoring | 2025-11-26 | reference |
| `03-damage-calculation.md` | Damage Calc (alt) | 2025-11-26 | reference |
| `03-pokemon-stats.md` | Stats/IVs/EVs/Natures | 2025-11-26 | reference |
| `03-trainer-vs-wild.md` | Trainer vs Wild AI | 2025-11-26 | reference |
| `04-moves-and-effects.md` | 214 Move Effects | 2025-11-26 | reference |
| `04-ai-scripts-reference.md` | AI Script Commands | 2025-11-26 | reference |
| `04-battle-scripts.md` | Battle Scripting | 2025-11-26 | reference |
| `05-capture-mechanics.md` | Catch Rate Formula | 2025-11-26 | reference |
| `05-battle-messages.md` | Message System | 2025-11-26 | reference |
| `05-switch-item-logic.md` | AI Switch/Item Logic | 2025-11-26 | reference |
| `06-battle-flow.md` | Turn-by-Turn Flow | 2025-11-26 | reference |
| `06-react-implementation.md` | React Plan (early) | 2025-11-26 | planned |
| `06-animation-system.md` | Animation System | 2025-11-26 | reference |
| `07-battle-messages.md` | Messages (alt) | 2025-11-26 | reference |
| `07-double-battles.md` | Doubles Mechanics | 2025-11-26 | reference |
| `07-ai-enhancements.md` | AI Improvements | 2025-11-26 | planned |
| `08-battle-ui.md` | UI Layout & Specs | 2025-11-26 | reference |
| `08-react-implementation.md` | React Plan (mid) | 2025-11-26 | planned |
| `09-battle-animations.md` | Animation Commands | 2025-11-26 | reference |
| `10-ai-system.md` | Full AI Reference | 2025-11-26 | reference |
| `11-special-battles.md` | Safari/Frontier/etc | 2025-11-26 | reference |
| `12-source-files.md` | C Source File List | 2025-11-26 | reference |
| `13-react-implementation.md` | React Plan (final) | 2025-11-26 | planned |
| `battle-system-mvp.md` | MVP Scope | 2026-02-06 | planned |

---

## Requested Features (High-Level)

| Feature | Status | Current State |
|---------|--------|---------------|
| Battle rendering in WebGL | ■ | WebGL offscreen scene in `BattleState` via `BattleWebGLContext` + sprite batching |
| Pixel-perfect GBA authenticity | □ | MVP math exists, type chart/effects/scripts/graphics parity incomplete |
| Use shared dialog system | ■ | Battle messages route through `DialogBridge`/`showMessage` (local textbox fallback kept) |
| Reuse Pokemon menu system | ■ | Battle BAG/POKéMON now opens shared `MenuOverlay` (`BagMenu`/`PartyMenuContent`) in `mode: 'battle'` |
| Show battle background + platforms | ■ | Tilemap-composed BG from `battle_environment` now uses screenblock-correct map indexing + palette-bank rendering (`tiles.png`/`anim_tiles.png` + `map.bin`/`anim_map.bin`) |
| Show Pokemon battle graphics | ■ | Front/back Pokemon sprites loaded from pokeemerald assets via shared loaders |
| Infra for battle animations | □ | No animation scheduler/runtime yet |
| Battle scripting system | □ | Docs exist; no battle script interpreter in TS |
| Use global key mapping system | ■ | `BattleState` uses `inputMap` + `GameButton` for controls |
| Overlay battle on map for large viewports | □ | Battle is separate non-overworld state canvas |
| Wild + single trainer + doubles infra | □ | MVP wild flow exists; trainers are auto-win stubs |
| In-battle items + item scripting | □ | Bag/items exist globally; no in-battle item execution |

## 2026-02-12 Recovery Pass (Implemented)

- ■ Fixed scripted wild battle payload corruption in `src/pages/gamePage/useHandledStoryScript.ts`:
  - Removed duplicate `startWildBattle` context key (positional signature no longer overrides request signature).
  - Added guards for malformed wild battle requests (`speciesId`/`level` must be numeric and > 0).
  - Removed duplicate `battleType` key in trainer battle transition payload.
- ■ Added reusable battle environment resolver in `src/battle/render/battleEnvironmentResolver.ts` (C parity oriented):
  - Resolves terrain from map type + metatile behavior using `BattleSetup_GetEnvironmentId` logic.
  - Supports special legendary profile variants for Kyogre/Groudon/Rayquaza based on scripted `source/species`.
- ■ Reworked battle background rendering:
  - `src/rendering/gbaTilemap.ts` now supports explicit GBA screenblock indexing (64x32/32x32 text BG layouts).
  - Added indexed-color draw path with palette-bank handling from tilemap entry palette bits.
  - `src/battle/render/BattleBackground.ts` now composes from indexed tiles + JASC palette (`parsePalette`), including special variant palettes (`kyogre.pal`, `groudon.pal`, `sky/palette.pal`).
  - Entry layer now uses color-index-0 transparency during composition.
- ■ Battle state integration:
  - `BattleStateData` now accepts `backgroundProfile`.
  - `BattleState` consumes profile-based background loading and logs malformed wild payloads defensively before mon creation.

## Current Foundation Already In Repo

- ■ `src/states/BattleState.ts` — MVP turn loop, action menu, move menu, damage, EXP, return-to-overworld
- ■ `src/pages/gamePage/useHandledStoryScript.ts` — story script entry points (`startFirstBattle`, `startTrainerBattle`, `SCRIPTED_TRAINER_BATTLES` placeholder table)
- ■ `src/scripting/ScriptRunner.ts` — `trainerbattle_*` commands (L954-1111) exist and set trainer defeated flags
- ■ `src/game/NewGameFlow.ts` — first battle trigger, flag management
- ■ Shared systems to reuse: `src/components/dialog/*`, `src/menu/*`, `src/core/InputMap.ts`, `src/game/BagManager.ts`, `src/data/items.ts`
- ■ Battle docs under `docs/features/battle/*` have `written_on` + `status` + `last_verified`

## Duplicate Docs to Consolidate

- `00-battle-overview.md` / `00-battle-system-overview.md` — two overview docs
- `01-damage-calculation.md` / `03-damage-calculation.md` — duplicate damage calc
- `05-battle-messages.md` / `07-battle-messages.md` — duplicate message docs
- `06-react-implementation.md` / `08-react-implementation.md` / `13-react-implementation.md` — three React plans

---

## Feature Status: Data Generation

| Status | Feature | Script | Output |
|--------|---------|--------|--------|
| ■ | Type effectiveness chart | `generate-type-effectiveness.cjs` | `typeEffectiveness.gen.ts` |
| ■ | Enhanced move data (effects, priority, flags) | `generate-battle-moves.cjs` | `battleMoves.gen.ts` |
| ■ | Trainer party compositions | `generate-trainer-parties.cjs` | `trainerParties.gen.ts` |
| ■ | Battle background mappings | `generate-battle-backgrounds.cjs` | `battleEnvironments.gen.ts` |
| ■ | Item battle effects & held items | `generate-item-battle-effects.cjs` | `itemBattleEffects.gen.ts` |
| ■ | Pokemon sprite coordinates | `generate-pokemon-sprite-coords.cjs` | `pokemonSpriteCoords.gen.ts` |
| ■ | Level-up learnsets | `generate-learnsets.cjs` | `learnsets.gen.ts` |
| ■ | Move constants (power/type/acc/pp) | `generate-moves.cjs` | `moves.ts` |
| ■ | Species info (base stats, types) | `generate-species-info.cjs` | `speciesInfo.ts` |
| ■ | Trainer ID constants | `generate-trainer-ids.cjs` | `trainerIds.gen.ts` |
| ■ | Item descriptions | `generate-item-descriptions.cjs` | `itemDescriptions.ts` |
| ■ | Battle script bytecode (move effects) | `generate-battle-scripts.cjs` | `battleScripts.gen.ts` |
| ■ | Battle animation scripts | `generate-battle-animations.cjs` | `battleAnimations.gen.ts` |
| ■ | Battle constants (STATUS, OUTCOME, etc.) | `generate-battle-constants.cjs` | `battleConstants.gen.ts` |
| ■ | Move constants (power/type/acc/pp) | `generate-moves.cjs` | `moves.ts` |
| ■ | Species info (base stats, types) | `generate-species-info.cjs` | `speciesInfo.ts` |
| ■ | Trainer ID constants | `generate-trainer-ids.cjs` | `trainerIds.gen.ts` |
| ■ | Item descriptions | `generate-item-descriptions.cjs` | `itemDescriptions.ts` |
| ■ | Ability constants + descriptions | `generate-abilities.cjs` | `abilities.ts` |
| ■ | Flag/var name→ID maps | `generate-flag-var-maps.cjs` | flag/var maps |
| ■ | New game flags | `generate-new-game-flags.cjs` | `newGameFlags.gen.ts` |
| ■ | Multichoice menus | `generate-multichoice.cjs` | `multichoice.gen.ts` |
| ■ | Map scripts | `generate-scripts.cjs` | `scripts/*.gen.ts` |

---

## Feature Status: Rendering (WebGL)

| Status | Feature | Notes |
|--------|---------|-------|
| ■ | Offscreen WebGL canvas for battle | `BattleWebGLContext` (240x160 offscreen WebGL2) + `WebGLSpriteRenderer` |
| ■ | Pokemon front sprites (enemy) | Loaded from `graphics/pokemon/{species}/front.png` |
| ■ | Pokemon back sprites (player) | Loaded from `graphics/pokemon/{species}/back.png` |
| □ | Shiny sprite palette support | From `shiny.pal` files |
| ■ | Battle backgrounds (10 terrains) | Indexed + palette-bank composition from `graphics/battle_environment/{terrain}` with screenblock-correct tilemap decoding |
| ■ | Player/enemy platforms | Included via battle BG tilemaps (`map.bin`/`anim_map.bin`) |
| ■ | GBA-accurate health boxes | `BattleHealthBox` draws `healthbox_singles_*` assets from `graphics/battle_interface/` |
| ■ | HP bar (green/yellow/red) | Dynamic fill with G/Y/R thresholds in `BattleHealthBox` |
| ■ | EXP bar | Dynamic EXP fill rendered in player health box |
| ■ | Status condition icons (PSN/BRN/etc) | Status badges rendered from `status.png` in health boxes |
| ■ | Enemy shadow sprite | Rendered via WebGL sprite from `enemy_mon_shadow.png` for elevated enemy species |
| □ | Party ball indicators | From `ball_display.png` |
| ■ | Battle text box | `drawTextBox` / menus use `textbox.png` backdrop |
| □ | Trainer sprites | From `graphics/trainers/front_pics/` |
| ■ | Overlay mode (strictly larger than GBA+2 on both axes) | Overlay activates only when `tilesWide > 17 && tilesHigh > 12`, with centered battle over map backdrop and Emerald frame corners |
| ■ | Pixel-perfect constraints | Integer sprite placement + nearest-neighbor rendering in battle WebGL path |
| ■ | Player back sprite (trainer) | Intro throw sequence uses `graphics/trainers/back_pics/` frames |
| □ | HP digit font rendering | From `numbers1.png` + `numbers2.png` |
| □ | Level-up banner | From `level_up_banner.png` |
| ■ | Canvas2D battle rendering (MVP) | Current `BattleState.ts` — to be replaced |

---

## Feature Status: Input & Dialog

| Status | Feature | Notes |
|--------|---------|-------|
| ■ | InputMap for all battle controls | `BattleState` routes A/B/D-pad via `inputMap` |
| ■ | Dialog system for battle messages | `BattleState.queueMessages` now uses shared `DialogBridge.showMessage()` |
| □ | Action menu via dialog `showChoice` | FIGHT / BAG / POKEMON / RUN |
| □ | Move menu via dialog | 4 moves with PP display |
| □ | Remove "Z / Enter" hardcoded text | Use blinking arrow instead |
| ■ | Basic input handling | A/B/D-pad works in battle menus (via InputMap) |
| ■ | Custom message queue | Internal to BattleState — to be replaced |

---

## Feature Status: Battle Engine (Logic)

| Status | Feature | Notes |
|--------|---------|-------|
| □ | BattleEngine class (event-driven) | Pure logic, no rendering |
| □ | Complete type effectiveness (18×18) | Currently stubbed to 1 |
| □ | Full damage formula (all modifiers) | Currently basic — missing abilities, items, weather, screens |
| □ | All 7 stat stages (atk/def/spa/spd/spe/acc/eva) | Currently only atk + def |
| ■ | Status: Sleep | Move-induced sleep now uses Emerald 2–5 turn duration |
| ■ | Status: Poison / Toxic | Toxic now uses progressive counter damage (1/16, 2/16, …) with cure reset |
| □ | Status: Burn (atk halve + residual) | |
| □ | Status: Freeze | |
| □ | Status: Paralysis (speed + skip chance) | |
| □ | Status: Confusion | |
| □ | Status: Flinch | |
| □ | Status: Infatuation | |
| □ | Status: Leech Seed | |
| □ | Status: Substitute | |
| □ | Move priority brackets (-7 to +5) | Currently speed-only |
| □ | Weather: Rain / Sun / Sandstorm / Hail | |
| □ | Reflect / Light Screen | |
| □ | Ability effects in damage calc | Huge Power, Guts, Overgrow, etc. |
| □ | Held item effects in damage calc | Choice Band, type boosters, etc. |
| □ | Move effects: Tier 1 (~20 core effects) | EFFECT_HIT through stat changes |
| □ | Move effects: Tier 2 (~20 common effects) | TOXIC, OHKO, PROTECT, REST, etc. |
| □ | Move effects: Tier 3 (remaining ~170) | Two-turn, Transform, etc. |
| □ | Multi-hit moves (2-5 hits) | |
| □ | Recoil moves | |
| □ | Two-turn moves (Fly, Dig, Solar Beam) | |
| □ | GBA-accurate RNG (LCG) | `gRngValue * 0x41C64E6D + 0x00006073` |
| ■ | Accuracy/evasion stage interaction | Emerald ratio table aligned (+4 stage = 233/100) |
| □ | Critical hit stage system | Focus Energy, High Crit moves, Scope Lens |
| ■ | Battle outcome plumbing → VAR_RESULT | Battle script flow now reads/writes only `VAR_RESULT` (`GetBattleOutcome` aligned) |
| □ | Typed BattleStartRequest payload | Replace ad-hoc data objects |
| □ | End-of-turn effects (poison, burn, weather, wrap, etc.) | |
| □ | Ability effects beyond damage (Intimidate, Trace, etc.) | |
| ■ | Basic damage formula | `((2*level/5+2) * power * atk/def / 50) + 2` |
| ■ | STAB multiplier (1.5×) | |
| ■ | Critical hits (1/16, ×2) | |
| ■ | Random factor (85-100%) | |
| ■ | Physical/Special by type | PHYSICAL_TYPES set |
| ■ | Basic stat stages (atk/def only) | Growl, Leer |
| ■ | PP consumption | Persisted to save |
| ■ | Accuracy/miss check | |
| ■ | Speed-based turn order | |

---

## Feature Status: Party & Items in Battle

| Status | Feature | Notes |
|--------|---------|-------|
| ■ | Open party menu during battle | Reuses `PartyMenuContent` via `MenuOverlay` with `mode: 'battle'` callbacks |
| ■ | Switch Pokemon | Menu-driven switch now consumes turn order and still allows enemy response |
| □ | Forced switch on faint | Must select replacement |
| ■ | Open bag during battle | Reuses `BagMenu` via `MenuOverlay` with `mode: 'battle'` callbacks |
| ■ | Use healing items (Potions, etc.) | Active-mon healing items wired and now resolved through turn order (enemy can act) |
| ■ | Use status-cure items | Active-mon cures wired and now resolved through turn order (enemy can act) |
| □ | Throw Pokeballs (wild only) | Capture formula implementation |
| ■ | Block Pokeballs in trainer battles | Trainer battles now show: "The TRAINER blocked the BALL!" |
| □ | Held item end-of-turn effects | Leftovers, berries |
| □ | Choice-locking items | Choice Band locks to first move used |
| ■ | Bag system (field use) | BagManager fully implemented |
| ■ | Party system (field) | SaveManager party persistence |
| ■ | Money system | MoneyManager fully implemented |

---

## Feature Status: Trainer Battles

| Status | Feature | Notes |
|--------|---------|-------|
| ■ | Wire ScriptRunner trainerbattle → BattleEngine | Uses BattleState flow; no more auto-win script stub |
| □ | Load trainer parties from generated data | Species, level, moves, items |
| □ | Trainer AI: CHECK_BAD_MOVE scoring | Penalize immune/useless moves |
| □ | Trainer AI: TRY_TO_FAINT scoring | Bonus for KO moves |
| □ | Trainer AI: CHECK_VIABILITY scoring | Per-effect comprehensive scoring |
| □ | Post-battle money reward | Class base × level × 4 |
| □ | Post-battle defeat text | Via dialog system |
| □ | Post-battle defeat script | Run via ScriptRunner |
| ■ | VAR_RESULT set to battle outcome | Win/Loss/Draw/Run outcomes now propagate for script branching |
| □ | Trainer re-battle prevention | isTrainerDefeated check |
| □ | Trainer AI: item usage | Parity with `battle_ai_switch_items.c` |
| □ | Trainer AI: switching logic | Type disadvantage → switch to counter |
| ■ | `setwildbattle` + `dowildbattle` commands | Script-triggered wild encounters now transition into BattleState |
| ■ | trainerbattle_no_intro variant | Runs battle callback + respects outcome before setting trainer flag |
| ■ | trainerbattle_single script command | Exists but stubs to auto-win |
| ■ | trainerbattle_double script command | Exists but stubs to auto-win |
| ■ | trainerbattle_rematch command | Exists but stubs |
| ■ | Trainer defeat flags | trainerFlags.ts fully working |

---

## Feature Status: Animations

| Status | Feature | Notes |
|--------|---------|-------|
| □ | Animation system core (queue + player) | Frame-based AnimationCommand queue |
| ■ | Damage flash (sprite blink ×3) | Target sprite blink on damage events in `BattleState` |
| ■ | Faint slide-down | Fainted sprite slides down + fades out |
| ■ | HP bar smooth drain | Animated in `BattleState` via displayed HP interpolation |
| ■ | EXP bar smooth fill | Animated in `BattleState` using interpolated exp percent + level rollover |
| ■ | Send-out animation (ball throw → appear) | C-timed sequence in `BattleState` using trainer back sprite + Pokeball arc/open + emerge |
| □ | Recall animation (shrink into ball) | |
| □ | Switch-in animation | |
| ■ | Wild encounter slide-in | Enemy sprite slides in during intro in `BattleState` |
| ■ | Default move animation (flash) | White flash overlay triggered on damage events |
| ■ | Per-move animation registration | `MOVE_ANIMATIONS` map in `BattleState` with default fallback |
| ■ | Stat change arrow indicators | Event-driven ATK/DEF/etc up/down overlays in `BattleState` |
| ■ | Weather visual effects | Rain/sun/sand/hail overlays rendered from engine weather state |
| ■ | Battle transition (fade to/from black) | Enter fade-in and exit fade-out in `BattleState` |
| ■ | Status condition tint/overlay | Sprite tint by status (poison/burn/paralysis/freeze) in `BattleState` |
| □ | Pokeball throw + catch animation | Arc, shake count, break-out or click |
| □ | Animation data-driven (importable/generated) | From `battle_anim_scripts.s` |

---

## Feature Status: Experience & Leveling

| Status | Feature | Notes |
|--------|---------|-------|
| □ | Participant-based exp distribution | Only Pokemon that fought get exp |
| □ | EV yield application | From speciesInfo.evYield |
| ■ | Level-up move learning | C-style level-range extraction, replacement loops, HM retry, B/NO parity |
| ■ | Move replacement prompt (at 4 moves) | Dedicated `moveForget` modal with InputMap controls |
| ■ | Evolution check (post-battle) | Battle win now builds and runs queued evolutions via `GameState.EVOLUTION` |
| ■ | Basic exp gain formula | `(baseExp * level) / 7` |
| ■ | Level-up detection | calculateLevelFromExp |
| ■ | Stat recalculation on level-up | recalculatePartyStats |
| ■ | Experience persistence | Saved via SaveManager |

---

## Feature Status: Special Mechanics

| Status | Feature | Notes |
|--------|---------|-------|
| ■ | Flee formula (speed-based) | `speed*128/wildSpeed + 30*attempts` vs random `0..255` (Gen 3 parity) |
| ■ | Block flee in trainer battles | Engine returns no-escape failure path for trainer battles |
| □ | Doubles: 2 active per side | Infrastructure only |
| □ | Doubles: move targeting | SELECTED, BOTH, ALL, etc. |
| □ | Doubles: spread damage reduction | |
| □ | 4-battler indexing from start | Doubles-ready data model for singles |
| □ | Side timers (Reflect/LightScreen/etc.) | Per-side turn counters |
| □ | Safari Zone battles | Deferred |
| □ | Battle Frontier | Deferred |
| ■ | Wild battle flow | MVP works (starter vs Poochyena) |
| ■ | First battle flag management | FLAG_HIDE_* flags set correctly |
| ■ | Return to overworld after battle | State transition with savedLocation |

---

## Feature Status: Integration

| Status | Feature | Notes |
|--------|---------|-------|
| □ | BattleDialogBridge (class↔React) | Pass dialog functions via enter() data |
| □ | BattleMenuBridge (class↔MenuOverlay) | Open party/bag during battle |
| □ | Save persistence after battle | HP, PP, status, exp, items, money, flags |
| □ | Caught Pokemon → party/PC | Add to party or first open PC box |
| ■ | Deterministic timing in overlay mode | Passive map animation (water/etc) continues while movement/scripts/warps/camera updates stay frozen |
| □ | Golden tests (damage, turns, status) | Parity validation vs C source |
| □ | Scripted replay tests | Curated encounter fixtures |
| □ | Perf benchmarks | Frame time, draw calls, texture swaps |
| ■ | GameState.BATTLE registered | State machine knows about battle |
| ■ | BattleStateData interface | playerPokemon, wildSpecies, wildLevel, etc. |
| ■ | First battle victory → flag updates | Works in MVP |

---

## Summary

| Category | Done (■) | Todo (□) | Total |
|----------|----------|----------|-------|
| Data Generation | 9 | 10 | 19 |
| Rendering | 1 | 19 | 20 |
| Input & Dialog | 2 | 5 | 7 |
| Battle Engine | 9 | 36 | 45 |
| Party & Items | 3 | 10 | 13 |
| Trainer Battles | 4 | 14 | 18 |
| Animations | 0 | 17 | 17 |
| Exp & Leveling | 4 | 5 | 9 |
| Special Mechanics | 3 | 8 | 11 |
| Integration | 3 | 7 | 10 |
| **TOTAL** | **38** | **131** | **169** |

**Progress: 38/169 features (22% complete)**

---

## Comprehensive File Reference Map

All paths relative to `public/pokeemerald/` unless prefixed with `src/`.

### 1) Core Battle Logic (TS ↔ C pairings)

**TypeScript (current):**
- `src/states/BattleState.ts` — MVP battle state (to be upgraded)
- `src/pages/gamePage/useHandledStoryScript.ts` — story script hooks (`startFirstBattle`, `SCRIPTED_TRAINER_BATTLES`)
- `src/scripting/ScriptRunner.ts` — `trainerbattle_*` commands (L954-1111)
- `src/scripting/trainerFlags.ts` — `isTrainerDefeated()`, `setTrainerDefeated()`
- `src/game/NewGameFlow.ts` — first battle trigger
- `src/core/GameStateManager.ts` — state machine
- `src/pages/GamePage.tsx` — main game component

**C parity files:**
- `src/battle_main.c` (5,267 lines) — state machine, gTypeEffectiveness L335-449, turn loop
- `src/battle_setup.c` (~800 lines) — wild/trainer battle initialization
- `src/battle_script_commands.c` (10,326 lines) — 60+ battle commands, move execution
- `src/battle_util.c` (4,038 lines) — status checks, ability interactions
- `src/battle_util2.c` — additional utility functions
- `src/battle_controllers.c` — controller dispatch
- `src/battle_controller_player.c` (~2,000 lines) — player action handling
- `src/battle_controller_opponent.c` (~2,000 lines) — AI action handling
- `src/battle_message.c` (~2,000 lines) — text, string buffers, placeholder tokens
- `src/post_battle_event_funcs.c` — post-battle scripting hooks

### 2) Headers and Constants

**Core headers:**
- `include/battle.h` — BattlePokemon struct, BattleStruct, ProtectStruct, DisableStruct, SideTimer
- `include/battle_main.h` — gTypeEffectiveness extern
- `include/battle_setup.h`, `include/battle_scripts.h`, `include/battle_script_commands.h`
- `include/battle_interface.h`, `include/battle_bg.h`, `include/battle_anim.h`
- `include/pokemon.h` — BattlePokemon struct L260, BattleMove struct L327

**Constants:**
- `include/constants/battle.h` — STATUS1/2 bitmasks, BATTLE_TYPE flags, B_OUTCOME values, MOVE_TARGET_*
- `include/constants/battle_move_effects.h` — 214 EFFECT_* IDs
- `include/constants/battle_ai.h` — AI_FLAG_* constants
- `include/constants/battle_string_ids.h` — 300+ message IDs
- `include/constants/battle_anim.h` — animation IDs
- `include/constants/battle_script_commands.h`, `battle_setup.h`
- `include/constants/moves.h` — move ID constants
- `include/constants/items.h`, `item.h`, `item_effects.h` — item IDs, properties, effect bytes
- `include/constants/abilities.h` — ability ID constants
- `include/constants/hold_effects.h` — 80+ HOLD_EFFECT_* (Choice Band, Leftovers, type boosters)
- `include/constants/pokemon.h` — TYPE_*, NATURE_*, growth rate constants
- `include/constants/trainers.h`, `trainer_types.h` — trainer IDs, class base money
- `include/constants/weather.h` — weather type constants

### 3) Scripting (Field + Battle)

**TypeScript:**
- `src/scripting/ScriptRunner.ts` — field script commands including trainerbattle_*
- `src/data/scripts/index.ts`, `types.ts`, `*.gen.ts` — generated map scripts

**C:**
- `data/scripts/trainer_battle.inc` — trainer battle script template
- `data/battle_scripts_1.s`, `battle_scripts_2.s` — move effect scripts (bytecode)
- `data/battle_ai_scripts.s` — AI decision scripts
- `data/battle_anim_scripts.s` — animation scripts
- `asm/macros/battle_script.inc` — battle script macro definitions
- `asm/macros/battle_anim_script.inc` — animation macros
- `asm/macros/battle_ai_script.inc` — AI script macros

### 4) Items (Battle Usage + Effects)

**TypeScript:**
- `src/game/BagManager.ts` — `addItem()`, `removeItem()`, `hasItem()`, `getPocket()`; 5 pockets
- `src/game/MoneyManager.ts` — `addMoney()`, `removeMoney()`, `isEnoughMoney()`; MAX_MONEY=999999
- `src/data/items.ts` — ITEMS constants, `getItemName()`, `getItemId()`
- `src/data/itemDescriptions.ts`, `src/data/itemScripts.ts`
- `src/menu/components/BagMenu.tsx` — existing bag screen (needs `mode: 'battle'` filter)

**C:**
- `src/data/items.h` — `.battleUsage`, `.battleUseFunc`, ball catch multipliers
- `src/data/pokemon/item_effects.h` — item effect byte arrays
- `include/constants/item_effects.h` — heal amounts, status cure flags
- `include/constants/hold_effects.h` — 80+ held item effects
- `src/item_use.c` (~1,500 lines) — battle item functions
- `src/battle_ai_switch_items.c` — AI item usage decisions

### 5) Moves

**TypeScript:**
- `src/data/moves.ts` — MOVES constants, `getMoveInfo()`, `getMoveName()` (355 moves)

**C:**
- `src/data/battle_moves.h` — gBattleMoves[355] (effect, power, type, accuracy, pp, secondaryEffectChance, target, priority, flags)
- `include/constants/moves.h` — move ID constants
- `include/constants/battle_move_effects.h` — 214 EFFECT_* IDs
- `data/battle_scripts_1.s` + `battle_scripts_2.s` — move effect bytecode scripts

### 6) Pokemon Data and Stats

**TypeScript:**
- `src/data/species.ts` — SPECIES constants (1-411)
- `src/data/speciesInfo.ts` — `getSpeciesInfo(id)` → baseStats, types, abilities, growthRate, evYield, catchRate
- `src/data/abilities.ts` — ability constants and descriptions
- `src/pokemon/types.ts` — PartyPokemon, BoxPokemon, Stats, STATUS constants
- `src/pokemon/stats.ts` — `calculateAllStats()`, `calculateLevelFromExp()`, `recalculatePartyStats()`, `getNatureStatModifier()`, `isShiny()`, `getAbility()`
- `src/pokemon/testFactory.ts` — `createTestPokemon()`, `createQuickPokemon()`
- `src/save/native/Gen3Pokemon.ts`, `src/save/types.ts`

**C:**
- `src/pokemon.c` (7,171 lines) — damage formula L3106, stat calcs, exp, catch rate, natures
- `include/pokemon.h` — BattlePokemon struct L260, BattleMove struct L327
- `src/data/pokemon/species_info.h` — base stats, types, abilities per species
- `src/data/pokemon/experience_tables.h` — 6 growth rate tables
- `src/data/pokemon/level_up_learnsets.h` + `level_up_learnset_pointers.h`
- `src/data/pokemon/evolution.h`, `tmhm_learnsets.h`, `egg_moves.h`
- `src/data/text/nature_names.h` — 25 nature names

### 7) Randomness

**TypeScript:** `src/states/BattleState.ts` uses `Math.random` (non-deterministic)
**C:** `src/random.c` — LCG: `gRngValue = gRngValue * 0x41C64E6D + 0x00006073`

### 8) Graphics, Sprites, and UI Assets

**Pokemon sprites** (386 species, 64×64 each):
- `graphics/pokemon/{species}/front.png`, `back.png`, `normal.pal`, `shiny.pal`

**Battle environments** (10+ terrains):
- `graphics/battle_environment/{tall_grass,long_grass,sand,underwater,water,pond_water,rock,cave,building,sky,stadium}/`
- Each: `tiles.png`, `map.bin`, `palette.pal`, optionally `anim_tiles.png` + `anim_map.bin`

**Battle interface** (37 files):
- `graphics/battle_interface/healthbox_singles_player.png`, `healthbox_singles_opponent.png`
- `graphics/battle_interface/healthbox_doubles_player.png`, `healthbox_doubles_opponent.png`
- `graphics/battle_interface/hpbar.png`, `hpbar_anim.png`, `expbar.png`
- `graphics/battle_interface/status.png` (PSN/BRN/SLP/FRZ/PAR icons)
- `graphics/battle_interface/ball_display.png`, `enemy_mon_shadow.png`, `textbox.png`
- `graphics/battle_interface/numbers1.png`, `numbers2.png` (HP digit fonts)
- `graphics/battle_interface/level_up_banner.png`, `misc.png`
- Various `.pal` files

**Trainers:**
- `graphics/trainers/front_pics/` — all trainer class battle sprites
- `graphics/trainers/back_pics/` — player back sprites
- `graphics/trainers/palettes/`

**Transitions:** `graphics/battle_transitions/`
**Animation sprites:** `graphics/battle_anims/sprites/`

**C manifests:**
- `src/data/graphics/battle_environment.h`, `trainers.h`, `pokemon.h`
- `src/data/pokemon_graphics/front_pic_table.h`, `back_pic_table.h`
- `src/data/pokemon_graphics/front_pic_coordinates.h`, `back_pic_coordinates.h`
- `src/data/pokemon_graphics/palette_table.h`, `shiny_palette_table.h`
- `src/data/pokemon_graphics/enemy_mon_elevation.h`
- `src/data/trainer_graphics/front_pic_tables.h`, `back_pic_tables.h`

### 9) Battle Animations (29 C files)

**Engine + utilities:**
- `src/battle_anim.c` — main animation engine, command interpreter
- `src/battle_anim_effects_1.c`, `effects_2.c`, `effects_3.c` — general effects
- `src/battle_anim_mons.c`, `battle_anim_mon_movement.c` — Pokemon sprite animations
- `src/battle_anim_utility_funcs.c`, `battle_anim_sound_tasks.c`
- `src/battle_anim_status_effects.c`, `battle_anim_throw.c`, `battle_anim_smokescreen.c`

**Type-specific** (18 files): `src/battle_anim_{normal,fire,water,electric,ice,fight,poison,ground,flying,psychic,bug,rock,ghost,dragon,dark,grass,steel}.c`

**Data:** `data/battle_anim_scripts.s`, `src/data/battle_anim.h`, `graphics/battle_anims/`

### 10) Trainers

**TypeScript:**
- `src/pages/gamePage/useHandledStoryScript.ts` — `SCRIPTED_TRAINER_BATTLES` placeholder
- `src/scripting/ScriptRunner.ts` — trainerbattle_* handling
- `src/scripting/trainerFlags.ts`

**C:**
- `src/data/trainers.h` — trainer definitions (class, name, AI, party pointer)
- `src/data/trainer_parties.h` — party compositions (4 struct variants)
- `src/data/text/trainer_class_names.h`
- `src/trainer_see.c` — trainer line-of-sight detection
- `src/wild_encounter.c` — wild encounter generation
- `src/data/battle_frontier/` — frontier trainer/mon data (deferred)
- `data/text/trainers.inc` — trainer dialogue text

### 11) WebGL Runtime to Reuse/Extend

- `src/rendering/webgl/WebGLContext.ts` — WebGL2 context creation
- `src/rendering/webgl/WebGLRenderPipeline.ts` — 3-pass tile rendering
- `src/rendering/webgl/WebGLSpriteRenderer.ts` — instanced sprite batching (up to 1024/batch)
- `src/rendering/webgl/WebGLFadeRenderer.ts` — fade effects
- `src/rendering/webgl/WebGLScanlineRenderer.ts` — CRT scanline effect
- `src/rendering/webgl/TilesetUploader.ts` — tileset texture management
- `src/rendering/compositeWebGLFrame.ts` — 7+ layer compositing
- `src/rendering/types.ts` — SpriteInstance (atlas, position, flip, alpha, tint, sortKey)

### 12) Existing TS Infrastructure to Reuse

| System | File | Key Exports |
|--------|------|-------------|
| Dialog | `src/components/dialog/DialogContext.tsx` | `useDialog()` → `showMessage`, `showYesNo`, `showChoice` |
| Menu | `src/menu/MenuStateManager.ts` | `menuStateManager.open(type, data)`, `.close()`, `.back()` |
| Party | `src/menu/components/PartyMenuContent.tsx` | Full party screen with HP bars |
| Bag | `src/menu/components/BagMenu.tsx` | Item pockets, selection |
| Summary | `src/menu/components/PokemonSummaryContent.tsx` | 3-page Pokemon detail |
| Input | `src/core/InputMap.ts` | `inputMap.isPressed(input, GameButton.A)` |
| Pokemon | `src/pokemon/types.ts` | `PartyPokemon`, `Stats`, `STATUS` constants |
| Stats | `src/pokemon/stats.ts` | `calculateLevelFromExp()`, `recalculatePartyStats()` |
| Factory | `src/pokemon/testFactory.ts` | `createTestPokemon(options)` |
| Species | `src/data/speciesInfo.ts` | `getSpeciesInfo(id)` → baseStats, types, abilities |
| Moves | `src/data/moves.ts` | `getMoveInfo(id)`, `getMoveName(id)`, `MOVES` |
| Items | `src/data/items.ts` | `ITEMS` constants, `getItemName(id)` |
| Bag | `src/game/BagManager.ts` | `bagManager.addItem()`, `.removeItem()`, `.hasItem()` |
| Money | `src/game/MoneyManager.ts` | `moneyManager.addMoney()`, `.removeMoney()` |
| Flags | `src/game/GameFlags.ts` | `gameFlags.set()`, `.isSet()`, `.clear()` |
| Variables | `src/game/GameVariables.ts` | `gameVariables.setVar()`, `.getVar()`, `GAME_VARS` |
| Trainer Flags | `src/scripting/trainerFlags.ts` | `isTrainerDefeated()`, `setTrainerDefeated()` |
| Save | `src/save/SaveManager.ts` | `saveManager.getParty()`, `.setParty()` |
| State | `src/core/GameState.ts` | `StateRenderer` interface, `GameState.BATTLE` |
| Sprites | `src/rendering/webgl/WebGLSpriteRenderer.ts` | `uploadSpriteSheet()`, `renderBatch()` |
| Script | `src/scripting/ScriptRunner.ts` | `trainerbattle_*` commands (L954-1111) |
| Timing | `src/config/timing.ts` | Frame timing constants |
