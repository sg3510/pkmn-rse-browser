---
title: Moves and Effects System
status: reference
last_verified: 2026-01-13
---

# Moves and Effects System

Move data is defined in `data/battle_moves.h` and effects are processed via the battle script system.

## Move Data Structure

```c
struct BattleMove {
    u8 effect;              // Effect ID (0-213)
    u8 power;               // Base power (0-255, 0 for status moves)
    u8 type;                // Move type (0-17)
    u8 accuracy;            // Accuracy (0-100, 0 = always hits)
    u8 pp;                  // Base PP
    u8 secondaryEffectChance; // % chance for secondary effect
    u8 target;              // Target type
    s8 priority;            // Move priority (-7 to +5)
    u32 flags;              // Move flags (contact, protect, etc.)
};
```

## Move Targets

```c
#define MOVE_TARGET_SELECTED         0x00  // Player selects target
#define MOVE_TARGET_DEPENDS          0x01  // Depends on move (Counter, etc.)
#define MOVE_TARGET_USER_OR_SELECTED 0x02  // Aromatherapy, etc.
#define MOVE_TARGET_RANDOM           0x04  // Random opponent
#define MOVE_TARGET_BOTH             0x08  // Both opponents (Earthquake)
#define MOVE_TARGET_USER             0x10  // Self (stat boosts)
#define MOVE_TARGET_FOES_AND_ALLY    0x20  // All adjacent (Explosion)
#define MOVE_TARGET_OPPONENTS_FIELD  0x40  // Entry hazards
```

## Move Priority

| Priority | Examples |
|----------|----------|
| +5 | Helping Hand |
| +4 | Magic Coat, Snatch |
| +3 | Fake Out, Follow Me |
| +2 | Detect, Endure, Protect |
| +1 | Mach Punch, Quick Attack, ExtremeSpeed |
| 0 | Most moves |
| -1 | Vital Throw |
| -3 | Focus Punch |
| -5 | Counter, Mirror Coat |
| -6 | Roar, Whirlwind |
| -7 | Trick Room (Gen 4+, not in Emerald) |

## Move Flags

```c
#define FLAG_MAKES_CONTACT           (1 << 0)  // Triggers contact abilities
#define FLAG_PROTECT_AFFECTED        (1 << 1)  // Blocked by Protect
#define FLAG_MAGIC_COAT_AFFECTED     (1 << 2)  // Reflected by Magic Coat
#define FLAG_SNATCH_AFFECTED         (1 << 3)  // Stolen by Snatch
#define FLAG_MIRROR_MOVE_AFFECTED    (1 << 4)  // Copied by Mirror Move
#define FLAG_KINGS_ROCK_AFFECTED     (1 << 5)  // Can flinch with King's Rock
```

## Move Effects (214 Total)

### Basic Damage Effects

| ID | Effect | Description |
|----|--------|-------------|
| 0 | EFFECT_HIT | Standard damage, no secondary effect |
| 2 | EFFECT_POISON_HIT | Damage + chance to poison |
| 3 | EFFECT_ABSORB | Drain 50% of damage dealt |
| 4 | EFFECT_BURN_HIT | Damage + chance to burn |
| 5 | EFFECT_FREEZE_HIT | Damage + chance to freeze |
| 6 | EFFECT_PARALYZE_HIT | Damage + chance to paralyze |
| 7 | EFFECT_EXPLOSION | Damage + user faints |
| 31 | EFFECT_FLINCH_HIT | Damage + chance to flinch |
| 48 | EFFECT_RECOIL | Damage + 1/4 recoil |
| 198 | EFFECT_DOUBLE_EDGE | Damage + 1/3 recoil |

### Status Moves

| ID | Effect | Description |
|----|--------|-------------|
| 1 | EFFECT_SLEEP | Puts target to sleep |
| 33 | EFFECT_TOXIC | Badly poisons target |
| 66 | EFFECT_POISON | Regular poison |
| 67 | EFFECT_PARALYZE | Paralyzes target |
| 37 | EFFECT_REST | Sleep + full heal |
| 49 | EFFECT_CONFUSE | Confuses target |
| 120 | EFFECT_ATTRACT | Infatuates opposite gender |

### Stat Modifiers

| ID | Effect | Target | Stages |
|----|--------|--------|--------|
| 10 | EFFECT_ATTACK_UP | User | +1 Atk |
| 50 | EFFECT_ATTACK_UP_2 | User | +2 Atk |
| 18 | EFFECT_ATTACK_DOWN | Target | -1 Atk |
| 58 | EFFECT_ATTACK_DOWN_2 | Target | -2 Atk |
| 11 | EFFECT_DEFENSE_UP | User | +1 Def |
| 51 | EFFECT_DEFENSE_UP_2 | User | +2 Def |
| 12 | EFFECT_SPEED_UP | User | +1 Spe |
| 52 | EFFECT_SPEED_UP_2 | User | +2 Spe |
| 142 | EFFECT_BELLY_DRUM | User | Max Atk, -50% HP |
| 212 | EFFECT_DRAGON_DANCE | User | +1 Atk, +1 Spe |
| 211 | EFFECT_CALM_MIND | User | +1 SpA, +1 SpD |
| 208 | EFFECT_BULK_UP | User | +1 Atk, +1 Def |

### Multi-Hit Moves

| ID | Effect | Hits |
|----|--------|------|
| 29 | EFFECT_MULTI_HIT | 2-5 hits |
| 44 | EFFECT_DOUBLE_HIT | 2 hits |
| 104 | EFFECT_TRIPLE_KICK | 3 hits, increasing power |
| 154 | EFFECT_BEAT_UP | One hit per party member |

### Two-Turn Moves

| ID | Effect | Move |
|----|--------|------|
| 39 | EFFECT_RAZOR_WIND | Razor Wind |
| 75 | EFFECT_SKY_ATTACK | Sky Attack |
| 151 | EFFECT_SOLAR_BEAM | Solar Beam |
| 145 | EFFECT_SKULL_BASH | Skull Bash |
| 155 | EFFECT_SEMI_INVULNERABLE | Fly, Dig, Dive, Bounce |

### OHKO Moves

| ID | Effect | Accuracy |
|----|--------|----------|
| 38 | EFFECT_OHKO | (Level diff + 30)%, fails if faster |

### Fixed Damage

| ID | Effect | Damage |
|----|--------|--------|
| 41 | EFFECT_DRAGON_RAGE | Fixed 40 |
| 130 | EFFECT_SONICBOOM | Fixed 20 |
| 87 | EFFECT_LEVEL_DAMAGE | Equal to user's level |
| 88 | EFFECT_PSYWAVE | Random 50-150% of level |
| 40 | EFFECT_SUPER_FANG | 50% of current HP |

### Retaliation Moves

| ID | Effect | Description |
|----|--------|-------------|
| 89 | EFFECT_COUNTER | 2× physical damage received |
| 144 | EFFECT_MIRROR_COAT | 2× special damage received |
| 185 | EFFECT_REVENGE | 2× if hit this turn |

### Weather

| ID | Effect | Weather |
|----|--------|---------|
| 136 | EFFECT_RAIN_DANCE | Rain (5 turns) |
| 137 | EFFECT_SUNNY_DAY | Sun (5 turns) |
| 115 | EFFECT_SANDSTORM | Sandstorm (5 turns) |
| 164 | EFFECT_HAIL | Hail (5 turns) |

### Field Effects

| ID | Effect | Description |
|----|--------|-------------|
| 65 | EFFECT_REFLECT | Halves physical damage (5 turns) |
| 35 | EFFECT_LIGHT_SCREEN | Halves special damage (5 turns) |
| 112 | EFFECT_SPIKES | Entry hazard |
| 124 | EFFECT_SAFEGUARD | Prevents status (5 turns) |
| 46 | EFFECT_MIST | Prevents stat drops (5 turns) |

### Special Mechanics

| ID | Effect | Description |
|----|--------|-------------|
| 9 | EFFECT_MIRROR_MOVE | Copy last move used by target |
| 83 | EFFECT_METRONOME | Random move |
| 82 | EFFECT_MIMIC | Copy target's last move |
| 95 | EFFECT_SKETCH | Permanently learn target's move |
| 57 | EFFECT_TRANSFORM | Copy target Pokemon |
| 127 | EFFECT_BATON_PASS | Switch, pass stat changes |
| 79 | EFFECT_SUBSTITUTE | Create substitute (25% HP) |
| 101 | EFFECT_FALSE_SWIPE | Cannot KO (leaves 1 HP) |

## Example Move Definitions

```c
[MOVE_TACKLE] = {
    .effect = EFFECT_HIT,
    .power = 35,
    .type = TYPE_NORMAL,
    .accuracy = 95,
    .pp = 35,
    .secondaryEffectChance = 0,
    .target = MOVE_TARGET_SELECTED,
    .priority = 0,
    .flags = FLAG_MAKES_CONTACT | FLAG_PROTECT_AFFECTED
           | FLAG_MIRROR_MOVE_AFFECTED | FLAG_KINGS_ROCK_AFFECTED,
},

[MOVE_FLAMETHROWER] = {
    .effect = EFFECT_BURN_HIT,
    .power = 95,
    .type = TYPE_FIRE,
    .accuracy = 100,
    .pp = 15,
    .secondaryEffectChance = 10,  // 10% burn chance
    .target = MOVE_TARGET_SELECTED,
    .priority = 0,
    .flags = FLAG_PROTECT_AFFECTED | FLAG_MIRROR_MOVE_AFFECTED,
},

[MOVE_SWORDS_DANCE] = {
    .effect = EFFECT_ATTACK_UP_2,
    .power = 0,
    .type = TYPE_NORMAL,
    .accuracy = 0,
    .pp = 30,
    .secondaryEffectChance = 0,
    .target = MOVE_TARGET_USER,
    .priority = 0,
    .flags = FLAG_SNATCH_AFFECTED,
},

[MOVE_PROTECT] = {
    .effect = EFFECT_PROTECT,
    .power = 0,
    .type = TYPE_NORMAL,
    .accuracy = 0,
    .pp = 10,
    .secondaryEffectChance = 0,
    .target = MOVE_TARGET_USER,
    .priority = +2,
    .flags = 0,
},

[MOVE_QUICK_ATTACK] = {
    .effect = EFFECT_QUICK_ATTACK,
    .power = 40,
    .type = TYPE_NORMAL,
    .accuracy = 100,
    .pp = 30,
    .secondaryEffectChance = 0,
    .target = MOVE_TARGET_SELECTED,
    .priority = +1,
    .flags = FLAG_MAKES_CONTACT | FLAG_PROTECT_AFFECTED
           | FLAG_MIRROR_MOVE_AFFECTED | FLAG_KINGS_ROCK_AFFECTED,
},
```

## Secondary Effect Processing

Secondary effects are processed after damage with `secondaryEffectChance`:

```c
// Check if secondary effect triggers
if (gBattleMoves[gCurrentMove].secondaryEffectChance > 0) {
    if ((Random() % 100) < gBattleMoves[gCurrentMove].secondaryEffectChance) {
        // Apply secondary effect based on move effect ID
        switch (gBattleMoves[gCurrentMove].effect) {
            case EFFECT_BURN_HIT:
                // Apply burn
                break;
            case EFFECT_POISON_HIT:
                // Apply poison
                break;
            // etc.
        }
    }
}
```

## Serene Grace Ability

Doubles secondary effect chance:

```c
if (attacker->ability == ABILITY_SERENE_GRACE)
    effectChance *= 2;
```

## Implementation Notes for React

```typescript
interface MoveData {
  id: number;
  name: string;
  effect: number;
  power: number;
  type: number;
  accuracy: number;
  pp: number;
  secondaryEffectChance: number;
  target: number;
  priority: number;
  flags: number;
}

const MOVES: Map<number, MoveData> = new Map([
  [MOVE_POUND, {
    id: 1,
    name: 'Pound',
    effect: EFFECT_HIT,
    power: 40,
    type: TYPE_NORMAL,
    accuracy: 100,
    pp: 35,
    secondaryEffectChance: 0,
    target: MOVE_TARGET_SELECTED,
    priority: 0,
    flags: FLAG_MAKES_CONTACT | FLAG_PROTECT_AFFECTED,
  }],
  // ... all 354 moves
]);

function checkSecondaryEffect(
  move: MoveData,
  attackerAbility: number
): boolean {
  if (move.secondaryEffectChance === 0) return false;

  let chance = move.secondaryEffectChance;
  if (attackerAbility === ABILITY_SERENE_GRACE) {
    chance *= 2;
  }

  return Math.random() * 100 < chance;
}
```
