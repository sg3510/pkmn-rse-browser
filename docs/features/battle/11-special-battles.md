---
title: Special Battle Types
status: reference
last_verified: 2026-01-13
---

# Special Battle Types

Pokemon Emerald features several special battle modes with unique mechanics.

## Safari Zone

### Overview

The Safari Zone uses a completely different battle system:
- No Pokemon battles (no attacking)
- Throw Safari Balls, Bait, or Rocks
- Pokemon can flee at any time
- Limited to 30 Safari Balls and 500 steps

### Safari Zone State

```c
// From safari_zone.c
EWRAM_DATA u8 gNumSafariBalls = 0;           // Remaining balls (starts at 30)
EWRAM_DATA static u16 sSafariZoneStepCounter = 0;  // Remaining steps (500)
EWRAM_DATA static u8 sSafariZoneCaughtMons = 0;    // Pokemon caught
EWRAM_DATA static u8 sSafariZonePkblkUses = 0;     // Pokeblock uses

void EnterSafariMode(void) {
    SetSafariZoneFlag();
    gNumSafariBalls = 30;
    sSafariZoneStepCounter = 500;
    sSafariZoneCaughtMons = 0;
}
```

### Safari Battle Menu

```
┌─────────────────┐
│    BALL   BAIT  │
│   ROCK    RUN   │
└─────────────────┘
```

### Safari Mechanics

**Catch Rate Modifier:**
```c
// From battle_script_commands.c
// Safari Zone has its own catch calculation
if (gBattleTypeFlags & BATTLE_TYPE_SAFARI) {
    // catchRate is modified by:
    // - Bait: decreases catch rate, increases flee rate
    // - Rock: increases catch rate, increases flee rate
    // - Pokeblock: various effects based on Pokemon preferences
}
```

**Flee Calculation:**
```c
// Pokemon has base flee rate
// Modified by:
// - Bait thrown: flee rate increases
// - Rock thrown: flee rate increases more
// - Random check each turn
if (Random() % 100 < fleeRate)
    PokemonFlees();
```

### Pokeblock Feeders

```c
struct PokeblockFeeder {
    s16 x;
    s16 y;
    s8 mapNum;
    u8 stepCounter;           // How long pokeblock lasts
    struct Pokeblock pokeblock;
};

#define NUM_POKEBLOCK_FEEDERS 10
```

## Battle Frontier

The Battle Frontier has 7 unique facilities, each with special rules.

### Battle Tower

Standard singles/doubles battles with these rules:
- Level 50 or Open level
- 3 Pokemon (singles) or 4 Pokemon (doubles)
- 7 battles per challenge
- No duplicate Pokemon or items

```c
// From battle_tower.c
static void InitTowerChallenge(void) {
    // Set up challenge parameters
    // Generate opponent trainers
    // Track win streak
}

// Frontier held items mapping
const u16 gBattleFrontierHeldItems[] = {
    [BATTLE_FRONTIER_ITEM_NONE]         = ITEM_NONE,
    [BATTLE_FRONTIER_ITEM_KINGS_ROCK]   = ITEM_KINGS_ROCK,
    [BATTLE_FRONTIER_ITEM_SITRUS_BERRY] = ITEM_SITRUS_BERRY,
    // ... 70+ items
};
```

### Battle Dome (Tournament)

16-trainer single-elimination tournament:

```c
// From battle_dome.c
struct TourneyTreeInfoCard {
    u8 spriteIds[NUM_INFOCARD_SPRITES];
    u8 pos;
    u8 tournamentIds[NUM_INFOCARD_TRAINERS];
};

// Opponent selection considers type matchups
static int GetTypeEffectivenessPoints(int moveType, int species, int mode) {
    // AI uses type chart to select team
    // EFFECTIVENESS_MODE_GOOD - select good matchups
    // EFFECTIVENESS_MODE_BAD - select bad matchups (harder)
}
```

### Battle Factory

Rent random Pokemon, swap after wins:

```c
// From battle_factory.c
// Player doesn't use own Pokemon
// Choose 3 from 6 random rental Pokemon
// Can swap 1 Pokemon after each win
// IVs based on challenge level
```

### Battle Pike

Luck-based facility with room choices:

```c
// Room types (hidden until entered):
// - Wild Pokemon battle
// - Trainer battle
// - Pokemon healing
// - Status condition (random)
// - Hint about other rooms
// - Nothing happens
```

### Battle Pyramid

Roguelike dungeon with limited items:

```c
// Bag is emptied at start
// Find items in dungeon
// Wild Pokemon roam floors
// Trainers to battle
// 7 floors, boss at top
```

### Battle Palace

Pokemon fight on their own:

```c
// Player cannot choose moves!
// Pokemon choose based on nature
// Attack/Defense/Support tendencies
// HP affects behavior
```

### Battle Arena

3v3 with judging:

```c
// Only 3 turns per matchup
// If no KO, judged on:
// - Mind (offensive moves used)
// - Skill (move effectiveness)
// - Body (remaining HP)
// Loser is eliminated
```

## Double Battles

Standard but with 2v2 mechanics:

```c
#define BATTLE_TYPE_DOUBLE (1 << 0)

// Targeting rules
enum {
    MOVE_TARGET_SELECTED,        // Choose target
    MOVE_TARGET_DEPENDS,         // Move-dependent
    MOVE_TARGET_USER_OR_SELECTED,// Self or ally/foe
    MOVE_TARGET_RANDOM,          // Random opponent
    MOVE_TARGET_BOTH,            // Both opponents
    MOVE_TARGET_USER,            // Self only
    MOVE_TARGET_FOES_AND_ALLY,   // All except self
    MOVE_TARGET_OPPONENTS_FIELD, // Spikes, etc.
    MOVE_TARGET_ALLY,            // Partner only
    MOVE_TARGET_ALL_BATTLERS,    // Everyone including self
};
```

### Double Battle Specific Moves

```c
// Moves that hit multiple targets
// Earthquake - all except user
// Surf - all except user
// Rock Slide - both opponents
// Blizzard - both opponents
// Helping Hand - ally only
// Protect - self only
```

## Multi Battles

2v2 with partner trainer:

```c
#define BATTLE_TYPE_MULTI (1 << 6)
#define BATTLE_TYPE_INGAME_PARTNER (1 << 12)

// Each trainer controls 1 Pokemon
// Partner AI uses different scripts
// Combine teams for full party
```

## Link Battles

PvP battles via link cable:

```c
#define BATTLE_TYPE_LINK (1 << 2)

// Features:
// - Timer (optional)
// - No fleeing
// - No catching
// - No items (in some modes)
// - Synchronizes via link protocol
```

## Legendary Battles

Special rules for legendaries:

```c
// Cannot flee from certain Pokemon
// Master Ball guaranteed catch
// Some have special catch rates
// Weather/terrain may be active

// Rayquaza example
[SPECIES_RAYQUAZA] = {
    .catchRate = 45,  // Standard legendary rate
    // Battle starts with no weather (Air Lock active)
};
```

## Battle Type Flags Summary

```c
#define BATTLE_TYPE_DOUBLE           (1 << 0)   // 2v2 format
#define BATTLE_TYPE_LINK             (1 << 2)   // Link cable PvP
#define BATTLE_TYPE_IS_MASTER        (1 << 3)   // Link master
#define BATTLE_TYPE_TRAINER          (1 << 4)   // Trainer battle
#define BATTLE_TYPE_FIRST_BATTLE     (1 << 5)   // Tutorial battle
#define BATTLE_TYPE_MULTI            (1 << 6)   // 2v2 with partners
#define BATTLE_TYPE_SAFARI           (1 << 7)   // Safari Zone
#define BATTLE_TYPE_BATTLE_TOWER     (1 << 8)   // Battle Tower
#define BATTLE_TYPE_ROAMER           (1 << 10)  // Roaming legendary
#define BATTLE_TYPE_EREADER_TRAINER  (1 << 11)  // E-Reader trainer
#define BATTLE_TYPE_KYOGRE_GROUDON   (1 << 12)  // Special legendary
#define BATTLE_TYPE_LEGENDARY        (1 << 13)  // Legendary Pokemon
#define BATTLE_TYPE_REGI             (1 << 14)  // Regi trio
#define BATTLE_TYPE_FRONTIER         (1 << 17)  // Battle Frontier
#define BATTLE_TYPE_TRAINER_HILL     (1 << 18)  // Trainer Hill
#define BATTLE_TYPE_SECRET_BASE      (1 << 19)  // Secret Base
#define BATTLE_TYPE_GROUDON          (1 << 20)  // Groudon specific
#define BATTLE_TYPE_KYOGRE           (1 << 21)  // Kyogre specific
#define BATTLE_TYPE_RAYQUAZA         (1 << 22)  // Rayquaza specific
#define BATTLE_TYPE_RECORDED         (1 << 23)  // Recorded battle
#define BATTLE_TYPE_RECORDED_LINK    (1 << 24)  // Recorded link battle
#define BATTLE_TYPE_TRAINER_TOWER    (1 << 25)  // FR/LG Trainer Tower
#define BATTLE_TYPE_PALACE           (1 << 26)  // Battle Palace
#define BATTLE_TYPE_ARENA            (1 << 27)  // Battle Arena
#define BATTLE_TYPE_FACTORY          (1 << 28)  // Battle Factory
#define BATTLE_TYPE_PIKE             (1 << 29)  // Battle Pike
#define BATTLE_TYPE_PYRAMID          (1 << 30)  // Battle Pyramid
#define BATTLE_TYPE_DOME             (1 << 31)  // Battle Dome
```

## React Implementation for Special Battles

```tsx
type BattleMode =
  | 'wild'
  | 'trainer'
  | 'safari'
  | 'double'
  | 'multi'
  | 'frontier';

interface BattleConfig {
  mode: BattleMode;
  flags: number;
  allowFlee: boolean;
  allowCatch: boolean;
  allowItems: boolean;
  turnLimit?: number;      // For Arena
  ballCount?: number;      // For Safari
}

function getSafariMenu(): MenuItem[] {
  return [
    { label: 'BALL', action: 'throwBall' },
    { label: 'BAIT', action: 'throwBait' },
    { label: 'ROCK', action: 'throwRock' },
    { label: 'RUN', action: 'run' },
  ];
}

function handleSafariAction(action: string, battle: BattleState) {
  switch (action) {
    case 'throwBall':
      // Use Safari ball catch calculation
      return attemptCatch(battle, { isSafari: true });

    case 'throwBait':
      // Decrease catch rate, increase flee rate
      return {
        catchMod: battle.catchMod * 0.5,
        fleeMod: battle.fleeMod * 1.5,
      };

    case 'throwRock':
      // Increase catch rate, increase flee rate more
      return {
        catchMod: battle.catchMod * 2,
        fleeMod: battle.fleeMod * 2,
      };

    case 'run':
      return { fled: true };
  }
}
```

## Key Source Files

| File | Purpose |
|------|---------|
| `safari_zone.c` | Safari Zone mechanics |
| `battle_tower.c` | Battle Tower logic |
| `battle_dome.c` | Battle Dome tournament |
| `battle_factory.c` | Battle Factory rental |
| `battle_pike.c` | Battle Pike rooms |
| `battle_pyramid.c` | Battle Pyramid dungeon |
| `battle_palace.c` | Battle Palace AI |
| `battle_arena.c` | Battle Arena judging |
| `battle_tent.c` | Practice facilities |
| `frontier_util.c` | Shared Frontier utilities |
