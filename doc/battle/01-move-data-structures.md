# Move Data Structures

## Source Files

- **Move Data**: `src/data/battle_moves.h`
- **Move Constants**: `include/constants/moves.h`
- **Effect Constants**: `include/constants/battle_move_effects.h`
- **Move Names**: `src/data/text/move_names.h`
- **Move Descriptions**: `src/data/text/move_descriptions.h`

## Move Structure Definition

From `include/battle.h`:

```c
struct BattleMove
{
    u8 effect;                 // Effect ID - determines which script runs
    u8 power;                  // Base power (0 for status moves)
    u8 type;                   // Pokemon type (TYPE_NORMAL, TYPE_FIRE, etc.)
    u8 accuracy;               // Base accuracy (0 = always hits)
    u8 pp;                     // Base PP
    u8 secondaryEffectChance;  // % chance for secondary effect (0-100)
    u8 target;                 // Target selection flags
    s8 priority;               // Priority bracket (-7 to +5)
    u8 flags;                  // Move flags (contact, sound, etc.)
};
```

## Move Target Flags

From `include/battle.h`:

```c
#define MOVE_TARGET_SELECTED            0        // User selects target
#define MOVE_TARGET_DEPENDS             (1 << 0) // Depends on move
#define MOVE_TARGET_USER_OR_SELECTED    (1 << 1) // Self or selected
#define MOVE_TARGET_RANDOM              (1 << 2) // Random opponent
#define MOVE_TARGET_BOTH                (1 << 3) // Both opponents (doubles)
#define MOVE_TARGET_USER                (1 << 4) // User only (self-targeting)
#define MOVE_TARGET_FOES_AND_ALLY       (1 << 5) // All battlers except user
#define MOVE_TARGET_OPPONENTS_FIELD     (1 << 6) // Opponent's side (Spikes)
```

## Move Flags

From `include/battle.h`:

```c
#define FLAG_MAKES_CONTACT          (1 << 0)  // Triggers contact abilities
#define FLAG_PROTECT_AFFECTED       (1 << 1)  // Blocked by Protect/Detect
#define FLAG_MAGIC_COAT_AFFECTED    (1 << 2)  // Can be bounced
#define FLAG_SNATCH_AFFECTED        (1 << 3)  // Can be snatched
#define FLAG_MIRROR_MOVE_AFFECTED   (1 << 4)  // Can be copied
#define FLAG_KINGS_ROCK_AFFECTED    (1 << 5)  // Can cause flinch with item
```

## Move Effects (Partial List)

From `include/constants/battle_move_effects.h`:

```c
// Basic Effects
#define EFFECT_HIT                    0   // Standard damage move
#define EFFECT_SLEEP                  1   // Causes sleep
#define EFFECT_POISON_HIT             2   // Damage + may poison
#define EFFECT_ABSORB                 3   // Drain HP
#define EFFECT_BURN_HIT               4   // Damage + may burn
#define EFFECT_FREEZE_HIT             5   // Damage + may freeze
#define EFFECT_PARALYZE_HIT           6   // Damage + may paralyze

// Special Damage
#define EFFECT_EXPLOSION              7   // Self-destruct
#define EFFECT_DREAM_EATER            8   // Only works on sleeping targets
#define EFFECT_MIRROR_MOVE            9   // Copy last move used

// Stat Modifications
#define EFFECT_ATTACK_UP              10  // +1 Attack
#define EFFECT_DEFENSE_UP             11  // +1 Defense
#define EFFECT_SPEED_UP               12  // +1 Speed
#define EFFECT_SPECIAL_ATTACK_UP      13  // +1 Sp. Attack
#define EFFECT_SPECIAL_DEFENSE_UP     14  // +1 Sp. Defense
#define EFFECT_ACCURACY_UP            15  // +1 Accuracy
#define EFFECT_EVASION_UP             16  // +1 Evasion

#define EFFECT_ATTACK_DOWN            18  // -1 Attack target
#define EFFECT_DEFENSE_DOWN           19  // -1 Defense target
#define EFFECT_SPEED_DOWN             20  // -1 Speed target

// +2 Stat Modifications
#define EFFECT_ATTACK_UP_2            51  // +2 Attack (Swords Dance)
#define EFFECT_DEFENSE_UP_2           52  // +2 Defense (Iron Defense)
#define EFFECT_SPEED_UP_2             53  // +2 Speed (Agility)
#define EFFECT_SPECIAL_ATTACK_UP_2    54  // +2 Sp. Attack (Nasty Plot)

// Hit + Stat Changes
#define EFFECT_ATTACK_DOWN_HIT        69  // Hit + may lower attack
#define EFFECT_DEFENSE_DOWN_HIT       70  // Hit + may lower defense
#define EFFECT_SPEED_DOWN_HIT         71  // Hit + may lower speed

// Special Effects
#define EFFECT_MULTI_HIT              29  // Hit 2-5 times
#define EFFECT_FLINCH_HIT             31  // Hit + may flinch
#define EFFECT_OHKO                   38  // One-hit KO
#define EFFECT_CONFUSE                49  // Cause confusion
#define EFFECT_TOXIC                  33  // Badly poison
#define EFFECT_RECOIL                 48  // Damage + recoil
#define EFFECT_REST                   37  // Full heal + sleep
#define EFFECT_PROTECT                111 // Block all attacks

// Two-Turn Moves
#define EFFECT_RAZOR_WIND             39  // Charge + attack
#define EFFECT_SKY_ATTACK             75  // Charge + attack
#define EFFECT_SOLAR_BEAM             151 // Charge (skip in sun)
#define EFFECT_SEMI_INVULNERABLE      155 // Fly/Dig/Dive/Bounce
```

## Example Move Definitions

From `src/data/battle_moves.h`:

```c
const struct BattleMove gBattleMoves[MOVES_COUNT] =
{
    [MOVE_NONE] = {
        .effect = EFFECT_HIT,
        .power = 0,
        .type = TYPE_NORMAL,
        .accuracy = 0,
        .pp = 0,
        .secondaryEffectChance = 0,
        .target = MOVE_TARGET_SELECTED,
        .priority = 0,
        .flags = 0,
    },

    [MOVE_POUND] = {
        .effect = EFFECT_HIT,
        .power = 40,
        .type = TYPE_NORMAL,
        .accuracy = 100,
        .pp = 35,
        .secondaryEffectChance = 0,
        .target = MOVE_TARGET_SELECTED,
        .priority = 0,
        .flags = FLAG_MAKES_CONTACT | FLAG_PROTECT_AFFECTED | FLAG_MIRROR_MOVE_AFFECTED | FLAG_KINGS_ROCK_AFFECTED,
    },

    [MOVE_THUNDER] = {
        .effect = EFFECT_THUNDER,
        .power = 120,
        .type = TYPE_ELECTRIC,
        .accuracy = 70,
        .pp = 10,
        .secondaryEffectChance = 30,
        .target = MOVE_TARGET_SELECTED,
        .priority = 0,
        .flags = FLAG_PROTECT_AFFECTED | FLAG_MIRROR_MOVE_AFFECTED | FLAG_KINGS_ROCK_AFFECTED,
    },

    [MOVE_QUICK_ATTACK] = {
        .effect = EFFECT_HIT,
        .power = 40,
        .type = TYPE_NORMAL,
        .accuracy = 100,
        .pp = 30,
        .secondaryEffectChance = 0,
        .target = MOVE_TARGET_SELECTED,
        .priority = 1,  // Priority move
        .flags = FLAG_MAKES_CONTACT | FLAG_PROTECT_AFFECTED | FLAG_MIRROR_MOVE_AFFECTED | FLAG_KINGS_ROCK_AFFECTED,
    },

    [MOVE_PROTECT] = {
        .effect = EFFECT_PROTECT,
        .power = 0,
        .type = TYPE_NORMAL,
        .accuracy = 0,
        .pp = 10,
        .secondaryEffectChance = 0,
        .target = MOVE_TARGET_USER,
        .priority = 3,  // High priority
        .flags = 0,
    },

    [MOVE_EARTHQUAKE] = {
        .effect = EFFECT_EARTHQUAKE,
        .power = 100,
        .type = TYPE_GROUND,
        .accuracy = 100,
        .pp = 10,
        .secondaryEffectChance = 0,
        .target = MOVE_TARGET_FOES_AND_ALLY,  // Hits all adjacent
        .priority = 0,
        .flags = FLAG_PROTECT_AFFECTED | FLAG_MIRROR_MOVE_AFFECTED | FLAG_KINGS_ROCK_AFFECTED,
    },
};
```

## Priority Brackets

Move priority determines execution order within a turn:

| Priority | Example Moves |
|----------|---------------|
| +5 | Helping Hand |
| +4 | Protect, Detect, Endure |
| +3 | Fake Out, Follow Me |
| +2 | Extreme Speed |
| +1 | Quick Attack, Mach Punch, Bullet Punch |
| 0 | Most moves |
| -1 | Vital Throw |
| -3 | Focus Punch |
| -5 | Counter, Mirror Coat |
| -6 | Roar, Whirlwind |
| -7 | Trick Room (later gens) |

## Move Categories (Gen 3)

In Generation 3, physical/special is determined by **type**, not the individual move:

### Physical Types
- Normal, Fighting, Flying, Poison, Ground
- Rock, Bug, Ghost, Steel

### Special Types
- Fire, Water, Grass, Electric, Psychic
- Ice, Dragon, Dark

```c
// From src/pokemon.c
#define IS_TYPE_PHYSICAL(type) ((type) < TYPE_MYSTERY)
#define IS_TYPE_SPECIAL(type)  ((type) > TYPE_MYSTERY)
```

## TypeScript Interface

```typescript
interface Move {
  id: number;
  name: string;
  effect: MoveEffect;
  power: number;          // 0 for status moves
  type: PokemonType;
  accuracy: number;       // 0 = never miss
  pp: number;
  secondaryChance: number;
  target: MoveTarget;
  priority: number;
  flags: MoveFlags;
}

enum MoveTarget {
  SELECTED = 0,
  DEPENDS = 1,
  USER_OR_SELECTED = 2,
  RANDOM = 4,
  BOTH_OPPONENTS = 8,
  USER = 16,
  ALL_EXCEPT_USER = 32,
  OPPONENT_FIELD = 64,
}

interface MoveFlags {
  makesContact: boolean;
  protectAffected: boolean;
  magicCoatAffected: boolean;
  snatchAffected: boolean;
  mirrorMoveAffected: boolean;
  kingsRockAffected: boolean;
}
```
