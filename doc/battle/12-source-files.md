# Source Files Reference

Complete reference of all battle-related source files in pokeemerald.

## Core Battle Files

### Main Battle Logic

| File | Lines | Description |
|------|-------|-------------|
| `battle_main.c` | ~6000 | Main battle loop, turn execution, type effectiveness |
| `battle_script_commands.c` | ~11000 | Battle script bytecode interpreter |
| `battle_util.c` | ~3500 | Utility functions, ability checks |
| `battle_controllers.c` | ~800 | Controller dispatching |
| `battle_setup.c` | ~1500 | Battle initialization |

### Controller Files (Input Handling)

| File | Description |
|------|-------------|
| `battle_controller_player.c` | Human player input handling |
| `battle_controller_opponent.c` | AI opponent control |
| `battle_controller_link_opponent.c` | Link battle opponent |
| `battle_controller_link_partner.c` | Link battle partner |
| `battle_controller_player_partner.c` | In-game partner control |
| `battle_controller_recorded_opponent.c` | Recorded battle opponent |
| `battle_controller_recorded_player.c` | Recorded battle player |
| `battle_controller_wally.c` | Wally tutorial battle |
| `battle_controller_oak.c` | Oak tutorial (FR/LG) |
| `battle_controller_oak_old_man.c` | Old Man tutorial (FR/LG) |

### UI and Graphics

| File | Description |
|------|-------------|
| `battle_interface.c` | Health boxes, status icons |
| `battle_message.c` | Message display and formatting |
| `battle_bg.c` | Battle backgrounds |
| `battle_intro.c` | Battle introduction animations |
| `battle_gfx_sfx_util.c` | Graphics and sound utilities |
| `battle_transition.c` | Screen transitions into battle |
| `battle_transition_frontier.c` | Frontier-specific transitions |

### Animation Files

| File | Description |
|------|-------------|
| `battle_anim.c` | Animation script interpreter |
| `battle_anim_effects_1.c` | General effects (part 1) |
| `battle_anim_effects_2.c` | General effects (part 2) |
| `battle_anim_effects_3.c` | General effects (part 3) |
| `battle_anim_mons.c` | Pokemon sprite animations |
| `battle_anim_mon_movement.c` | Pokemon movement |
| `battle_anim_utility_funcs.c` | Animation utilities |
| `battle_anim_sound_tasks.c` | Sound effect tasks |
| `battle_anim_status_effects.c` | Status condition visuals |

### Type-Specific Animations

| File | Types Covered |
|------|---------------|
| `battle_anim_normal.c` | Normal |
| `battle_anim_fire.c` | Fire |
| `battle_anim_water.c` | Water |
| `battle_anim_electric.c` | Electric |
| `battle_anim_ice.c` | Ice |
| `battle_anim_fight.c` | Fighting |
| `battle_anim_poison.c` | Poison |
| `battle_anim_ground.c` | Ground |
| `battle_anim_flying.c` | Flying |
| `battle_anim_psychic.c` | Psychic |
| `battle_anim_bug.c` | Bug |
| `battle_anim_rock.c` | Rock |
| `battle_anim_ghost.c` | Ghost |
| `battle_anim_dragon.c` | Dragon |
| `battle_anim_dark.c` | Dark |
| `battle_anim_throw.c` | Pokeball throws |
| `battle_anim_smokescreen.c` | Smokescreen effect |

### AI System

| File | Description |
|------|-------------|
| `battle_ai_script_commands.c` | AI bytecode interpreter |
| `battle_ai_switch_items.c` | Switch and item decisions |

### Battle Frontier

| File | Description |
|------|-------------|
| `battle_tower.c` | Battle Tower logic |
| `battle_dome.c` | Battle Dome tournament |
| `battle_factory.c` | Battle Factory rentals |
| `battle_factory_screen.c` | Factory UI |
| `battle_pike.c` | Battle Pike rooms |
| `battle_pyramid.c` | Battle Pyramid dungeon |
| `battle_pyramid_bag.c` | Pyramid bag system |
| `battle_palace.c` | Battle Palace AI |
| `battle_arena.c` | Battle Arena judging |
| `battle_tent.c` | Training facilities |
| `frontier_pass.c` | Frontier Pass menu |
| `frontier_util.c` | Shared utilities |

### Special Battle Types

| File | Description |
|------|-------------|
| `safari_zone.c` | Safari Zone mechanics |
| `wild_encounter.c` | Wild encounter generation |
| `trainer_see.c` | Trainer spotting player |

### Recording and Playback

| File | Description |
|------|-------------|
| `recorded_battle.c` | Battle recording system |
| `battle_records.c` | Battle record storage |
| `battle_tv.c` | TV broadcast of battles |

## Data Files

### Move and Pokemon Data

| File | Description |
|------|-------------|
| `data/battle_moves.h` | Move data (power, type, effect) |
| `data/pokemon/species_info.h` | Base stats, abilities, catch rates |
| `data/pokemon/level_up_learnsets.h` | Level-up moves |
| `data/pokemon/tmhm_learnsets.h` | TM/HM compatibility |
| `data/pokemon/egg_moves.h` | Egg moves |
| `data/pokemon/evolution.h` | Evolution data |

### Animation Data

| File | Description |
|------|-------------|
| `data/battle_anim.h` | Animation data tables |
| `data/battle_anim_scripts.s` | Animation bytecode scripts |

### AI Scripts

| File | Description |
|------|-------------|
| `data/battle_ai_scripts.s` | AI evaluation scripts |

### Trainer Data

| File | Description |
|------|-------------|
| `data/trainers.h` | Trainer definitions |
| `data/trainer_parties.h` | Trainer Pokemon teams |
| `data/battle_frontier_trainers.h` | Frontier trainer data |
| `data/battle_frontier_mons.h` | Frontier Pokemon pool |

## Constants and Headers

### Battle Constants

| File | Key Contents |
|------|--------------|
| `constants/battle.h` | Battle type flags, result codes |
| `constants/battle_move_effects.h` | 214 move effect IDs |
| `constants/battle_string_ids.h` | Message string IDs |
| `constants/battle_anim.h` | Animation constants |
| `constants/battle_ai.h` | AI flag definitions |

### Type and Move Constants

| File | Key Contents |
|------|--------------|
| `constants/moves.h` | Move ID definitions |
| `constants/abilities.h` | Ability ID definitions |
| `constants/pokemon.h` | Species IDs, stat indices |

### Item Constants

| File | Key Contents |
|------|--------------|
| `constants/items.h` | Item ID definitions |
| `constants/hold_effects.h` | Held item effects |

## Key Structures

### In `include/battle.h`

```c
struct BattlePokemon;     // Active battler data
struct DisableStruct;     // Disable/Encore tracking
struct ProtectStruct;     // Protection moves
struct SpecialStatus;     // Special conditions
struct SideTimer;         // Field effects
struct WishFutureKnock;   // Delayed effects
struct BattleResources;   // Battle memory pools
```

### In `include/pokemon.h`

```c
struct Pokemon;           // Full Pokemon data (100 bytes)
struct BoxPokemon;        // PC storage (80 bytes)
struct BattleMove;        // Move data structure
```

## File Size Overview

Approximate line counts for major files:

```
battle_script_commands.c  ~11,000 lines
battle_main.c             ~6,000 lines
pokemon.c                 ~7,000 lines
battle_util.c             ~3,500 lines
battle_dome.c             ~3,000 lines
battle_tower.c            ~2,500 lines
battle_anim.c             ~1,200 lines
battle_message.c          ~1,500 lines
battle_interface.c        ~2,000 lines
battle_ai_script_commands ~1,400 lines
```

## Recommended Reading Order

For understanding the battle system:

1. **Start with structures**: `include/battle.h`, `include/pokemon.h`
2. **Constants**: `constants/battle.h`, `constants/battle_move_effects.h`
3. **Battle flow**: `battle_main.c` (focus on `BattleMainCB2`)
4. **Damage calculation**: `pokemon.c` (`CalculateBaseDamage`)
5. **Move effects**: `battle_script_commands.c`
6. **Type effectiveness**: `battle_main.c` (`gTypeEffectiveness`)
7. **AI**: `battle_ai_script_commands.c`
8. **UI**: `battle_interface.c`, `battle_message.c`

## Graphics Assets Location

```
graphics/
├── battle_anims/          # Animation sprites
│   ├── masks/             # Effect masks
│   └── sprites/           # Effect sprites
├── battle_interface/      # UI elements
│   ├── healthbox/         # Health box graphics
│   └── ball_display/      # Party ball icons
├── battle_terrain/        # Battle backgrounds
├── pokemon/               # Pokemon sprites
│   ├── front/             # Front sprites
│   ├── back/              # Back sprites
│   └── icons/             # Menu icons
└── trainers/
    ├── front/             # Trainer front sprites
    └── back/              # Player back sprites
```
