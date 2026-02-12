---
title: Pokemon Stats System
status: reference
written_on: 2025-11-26
last_verified: 2026-01-13
---

# Pokemon Stats System

This document covers how Pokemon stats are stored, calculated, and used in battle.

## Stat Constants

```c
// include/constants/pokemon.h
#define STAT_HP     0
#define STAT_ATK    1
#define STAT_DEF    2
#define STAT_SPEED  3
#define STAT_SPATK  4
#define STAT_SPDEF  5
#define STAT_ACC    6  // Accuracy (battle only)
#define STAT_EVASION 7 // Evasion (battle only)

#define NUM_STATS   6  // HP through SpDef
#define NUM_BATTLE_STATS 8  // Including Acc and Evasion
```

## Pokemon Data Structures

### BoxPokemon (PC Storage)

```c
struct BoxPokemon {
    u32 personality;       // Determines nature, gender, ability, shiny, etc.
    u32 otId;              // Original trainer ID
    u8 nickname[POKEMON_NAME_LENGTH];  // 10 chars
    u8 language;
    u8 isBadEgg:1;
    u8 hasSpecies:1;
    u8 isEgg:1;
    u8 unused:5;
    u8 otName[PLAYER_NAME_LENGTH];  // 7 chars
    u8 markings;
    u16 checksum;
    u16 unknown;
    union PokemonSubstruct substructs[4];  // Encrypted data
};
```

### Pokemon (Party)

```c
struct Pokemon {
    struct BoxPokemon box;
    u32 status;           // Status condition
    u8 level;
    u8 mail;
    u16 hp;
    u16 maxHP;
    u16 attack;
    u16 defense;
    u16 speed;
    u16 spAttack;
    u16 spDefense;
};
```

### BattlePokemon (In Battle)

```c
struct BattlePokemon {
    u16 species;
    u16 attack;
    u16 defense;
    u16 speed;
    u16 spAttack;
    u16 spDefense;
    u16 moves[MAX_MON_MOVES];
    u32 otId;
    u32 personality;
    u8 statStages[NUM_BATTLE_STATS];  // -6 to +6, stored as 0-12
    u8 ability;
    u8 type1;
    u8 type2;
    u8 unknown;
    u8 pp[MAX_MON_MOVES];
    u16 hp;
    u8 level;
    u8 friendship;
    u16 maxHP;
    u16 item;
    u8 nickname[POKEMON_NAME_LENGTH + 1];
    u8 ppBonuses;
    u8 otName[PLAYER_NAME_LENGTH + 1];
    u32 experience;
    u32 status1;          // Primary status (PSN, BRN, etc.)
    u32 status2;          // Secondary status (confusion, etc.)
    u32 otGender:1;
    u32 metLevel:7;
    u32 metGame:4;
    u32 pokeball:4;
    u32 isEgg:1;
    u32 abilityNum:1;
    u32 unused:14;
};
```

## Base Stats Structure

From `species_info.h`:

```c
struct SpeciesInfo {
    u8 baseHP;
    u8 baseAttack;
    u8 baseDefense;
    u8 baseSpeed;
    u8 baseSpAttack;
    u8 baseSpDefense;
    u8 types[2];
    u8 catchRate;
    u8 expYield;
    u8 evYield_HP;
    u8 evYield_Attack;
    u8 evYield_Defense;
    u8 evYield_Speed;
    u8 evYield_SpAttack;
    u8 evYield_SpDefense;
    u16 itemCommon;
    u16 itemRare;
    u8 genderRatio;
    u8 eggCycles;
    u8 friendship;
    u8 growthRate;
    u8 eggGroups[2];
    u8 abilities[2];
    u8 safariZoneFleeRate;
    u8 bodyColor;
    u8 noFlip;
};
```

## Example Base Stats

```c
[SPECIES_BULBASAUR] = {
    .baseHP        = 45,
    .baseAttack    = 49,
    .baseDefense   = 49,
    .baseSpeed     = 45,
    .baseSpAttack  = 65,
    .baseSpDefense = 65,
    .types = { TYPE_GRASS, TYPE_POISON },
    .catchRate = 45,
    .expYield = 64,
    .evYield_SpAttack = 1,
    .genderRatio = PERCENT_FEMALE(12.5),
    .eggCycles = 20,
    .friendship = 70,
    .growthRate = GROWTH_MEDIUM_SLOW,
    .abilities = {ABILITY_OVERGROW, ABILITY_NONE},
},

[SPECIES_PIKACHU] = {
    .baseHP        = 35,
    .baseAttack    = 55,
    .baseDefense   = 30,
    .baseSpeed     = 90,
    .baseSpAttack  = 50,
    .baseSpDefense = 40,
    .types = { TYPE_ELECTRIC, TYPE_ELECTRIC },
    .catchRate = 190,
    .expYield = 82,
    .evYield_Speed = 2,
    .genderRatio = PERCENT_FEMALE(50),
    .abilities = {ABILITY_STATIC, ABILITY_NONE},
},
```

## Stat Calculation Formula

Stats are calculated from base stats, IVs (0-31), EVs (0-255), level, and nature.

### HP Formula

```
HP = floor((2 × Base + IV + floor(EV/4)) × Level / 100) + Level + 10
```

For Shedinja: HP is always 1.

### Other Stats Formula

```
Stat = floor((floor((2 × Base + IV + floor(EV/4)) × Level / 100) + 5) × Nature)
```

Where Nature is:
- 1.1 (110%) for boosted stat
- 0.9 (90%) for hindered stat
- 1.0 (100%) for neutral

## Nature Effects

```c
// 25 Natures in 5×5 grid
// Row = boosted stat, Column = lowered stat

const s8 gNatureStatTable[NUM_NATURES][NUM_STATS] = {
    //       Atk  Def  Spd  SpA  SpD
    [HARDY]   = {  0,   0,   0,   0,   0 }, // Neutral
    [LONELY]  = { +1,  -1,   0,   0,   0 },
    [BRAVE]   = { +1,   0,  -1,   0,   0 },
    [ADAMANT] = { +1,   0,   0,  -1,   0 },
    [NAUGHTY] = { +1,   0,   0,   0,  -1 },
    [BOLD]    = { -1,  +1,   0,   0,   0 },
    [DOCILE]  = {  0,   0,   0,   0,   0 }, // Neutral
    [RELAXED] = {  0,  +1,  -1,   0,   0 },
    [IMPISH]  = {  0,  +1,   0,  -1,   0 },
    [LAX]     = {  0,  +1,   0,   0,  -1 },
    [TIMID]   = { -1,   0,  +1,   0,   0 },
    [HASTY]   = {  0,  -1,  +1,   0,   0 },
    [SERIOUS] = {  0,   0,   0,   0,   0 }, // Neutral
    [JOLLY]   = {  0,   0,  +1,  -1,   0 },
    [NAIVE]   = {  0,   0,  +1,   0,  -1 },
    [MODEST]  = { -1,   0,   0,  +1,   0 },
    [MILD]    = {  0,  -1,   0,  +1,   0 },
    [QUIET]   = {  0,   0,  -1,  +1,   0 },
    [BASHFUL] = {  0,   0,   0,   0,   0 }, // Neutral
    [RASH]    = {  0,   0,   0,  +1,  -1 },
    [CALM]    = { -1,   0,   0,   0,  +1 },
    [GENTLE]  = {  0,  -1,   0,   0,  +1 },
    [SASSY]   = {  0,   0,  -1,   0,  +1 },
    [CAREFUL] = {  0,   0,   0,  -1,  +1 },
    [QUIRKY]  = {  0,   0,   0,   0,   0 }, // Neutral
};
```

Nature is determined by `personality % 25`.

## IVs (Individual Values)

- Range: 0-31 for each stat
- Stored as bit fields in the Pokemon's data (5 bits each)
- Determined at Pokemon creation, never change
- Affect Hidden Power type and power

```c
struct PokemonSubstruct3 {
    // ...
    u32 hpIV:5;
    u32 attackIV:5;
    u32 defenseIV:5;
    u32 speedIV:5;
    u32 spAttackIV:5;
    u32 spDefenseIV:5;
    // ...
};
```

## EVs (Effort Values)

- Range: 0-255 for each stat
- Maximum total: 510 across all stats
- Gained from defeating Pokemon
- Each 4 EVs = +1 stat point at level 100

```c
struct PokemonSubstruct2 {
    u8 hpEV;
    u8 attackEV;
    u8 defenseEV;
    u8 speedEV;
    u8 spAttackEV;
    u8 spDefenseEV;
    // ... contest stats
};
```

## Stat Stages in Battle

During battle, stat stages modify the effective stat:

```c
// Default stage is 6 (index 6 in array = 1.0× multiplier)
#define DEFAULT_STAT_STAGE 6
#define MIN_STAT_STAGE 0
#define MAX_STAT_STAGE 12

// Stage multipliers
const u8 gStatStageRatios[13][2] = {
    {25, 100},  // Stage -6: 25% (2/8)
    {28, 100},  // Stage -5: 28% (2/7)
    {33, 100},  // Stage -4: 33% (2/6)
    {40, 100},  // Stage -3: 40% (2/5)
    {50, 100},  // Stage -2: 50% (2/4)
    {66, 100},  // Stage -1: 66% (2/3)
    {100, 100}, // Stage  0: 100% (2/2)
    {150, 100}, // Stage +1: 150% (3/2)
    {200, 100}, // Stage +2: 200% (4/2)
    {250, 100}, // Stage +3: 250% (5/2)
    {300, 100}, // Stage +4: 300% (6/2)
    {350, 100}, // Stage +5: 350% (7/2)
    {400, 100}, // Stage +6: 400% (8/2)
};

// Accuracy/Evasion stages (different formula)
const u8 gAccuracyStageRatios[13][2] = {
    {33, 100},  // -6: 33%
    {36, 100},  // -5: 36%
    {43, 100},  // -4: 43%
    {50, 100},  // -3: 50%
    {60, 100},  // -2: 60%
    {75, 100},  // -1: 75%
    {100, 100}, //  0: 100%
    {133, 100}, // +1: 133%
    {166, 100}, // +2: 166%
    {200, 100}, // +3: 200%
    {250, 100}, // +4: 250%
    {266, 100}, // +5: 266%
    {300, 100}, // +6: 300%
};
```

## Experience and Growth Rates

```c
// Growth rate constants
#define GROWTH_MEDIUM_FAST  0
#define GROWTH_ERRATIC      1
#define GROWTH_FLUCTUATING  2
#define GROWTH_MEDIUM_SLOW  3
#define GROWTH_FAST         4
#define GROWTH_SLOW         5
```

Experience needed per level is stored in `experience_tables.h`:

| Growth Rate | Level 100 Total EXP |
|-------------|---------------------|
| Erratic | 600,000 |
| Fast | 800,000 |
| Medium Fast | 1,000,000 |
| Medium Slow | 1,059,860 |
| Slow | 1,250,000 |
| Fluctuating | 1,640,000 |

## Experience Gain Formula

```c
// Base experience gained
exp = (baseExpYield × enemyLevel) / 7;

// Modifiers:
// - Trainer battle: ×1.5
// - Traded Pokemon: ×1.5
// - Lucky Egg: ×1.5
// - Exp Share: Split 50/50 between battlers and Exp Share holders
// - Multiple Pokemon participated: Split among participants
```

## Implementation Notes for React

```typescript
interface Pokemon {
  species: number;
  personality: number;
  level: number;
  experience: number;
  ivs: {
    hp: number;      // 0-31
    attack: number;
    defense: number;
    speed: number;
    spAttack: number;
    spDefense: number;
  };
  evs: {
    hp: number;      // 0-255, total max 510
    attack: number;
    defense: number;
    speed: number;
    spAttack: number;
    spDefense: number;
  };
  nature: number;    // 0-24
  status: number;
  currentHp: number;
  moves: number[];
  pp: number[];
  ability: number;
  heldItem: number;
  friendship: number;
}

interface BattlePokemon extends Pokemon {
  statStages: number[];  // 0-12, default 6
  status2: number;       // In-battle status
  types: [number, number];
  // Calculated stats
  stats: {
    hp: number;
    attack: number;
    defense: number;
    speed: number;
    spAttack: number;
    spDefense: number;
  };
}

function calculateStat(
  base: number,
  iv: number,
  ev: number,
  level: number,
  nature: number,
  statIndex: number
): number {
  const evContribution = Math.floor(ev / 4);
  const baseStat = Math.floor(((2 * base + iv + evContribution) * level) / 100);

  if (statIndex === STAT_HP) {
    return baseStat + level + 10;
  }

  const natureMultiplier = getNatureMultiplier(nature, statIndex);
  return Math.floor((baseStat + 5) * natureMultiplier);
}

function applyStatStage(stat: number, stage: number): number {
  const ratio = STAT_STAGE_RATIOS[stage];
  return Math.floor((stat * ratio[0]) / ratio[1]);
}
```
