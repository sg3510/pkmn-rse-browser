---
title: Wild Pokemon Encounter System
status: reference
last_verified: 2026-01-13
---

# Wild Pokemon Encounter System

This document describes the Pokemon Emerald wild encounter system and proposes a modular React implementation.

## Overview

Wild Pokemon encounters occur when the player walks through certain terrain types (grass, water, caves) or uses specific actions (fishing, rock smash). Each map can have different encounter tables with varying species, levels, and encounter rates.

## Source Code Reference

### Key Files in `public/pokeemerald/`
- `src/wild_encounter.c` (967 lines) - Main encounter logic
- `src/data/wild_encounters.json` - Encounter table data for all maps
- `include/wild_encounter.h` - Data structures
- `include/constants/wild_encounter.h` - Slot count constants

## Data Structures

### WildPokemon
```c
struct WildPokemon {
    u8 minLevel;
    u8 maxLevel;
    u16 species;
};
```

### WildPokemonInfo
```c
struct WildPokemonInfo {
    u8 encounterRate;                    // Base rate (0-255)
    const struct WildPokemon *wildPokemon;  // Array of encounter slots
};
```

### WildPokemonHeader (per map)
```c
struct WildPokemonHeader {
    u8 mapGroup;
    u8 mapNum;
    const struct WildPokemonInfo *landMonsInfo;      // Grass/cave
    const struct WildPokemonInfo *waterMonsInfo;     // Surfing
    const struct WildPokemonInfo *rockSmashMonsInfo; // Rock Smash
    const struct WildPokemonInfo *fishingMonsInfo;   // Old/Good/Super Rod
};
```

## Encounter Slot Distribution

From `wild_encounters.json`:

### Land Encounters (12 slots)
| Slot | Encounter Rate | Cumulative |
|------|---------------|------------|
| 0 | 20% | 0-19 |
| 1 | 20% | 20-39 |
| 2 | 10% | 40-49 |
| 3 | 10% | 50-59 |
| 4 | 10% | 60-69 |
| 5 | 10% | 70-79 |
| 6 | 5% | 80-84 |
| 7 | 5% | 85-89 |
| 8 | 4% | 90-93 |
| 9 | 4% | 94-97 |
| 10 | 1% | 98 |
| 11 | 1% | 99 |

### Water/Rock Smash Encounters (5 slots)
| Slot | Encounter Rate |
|------|---------------|
| 0 | 60% |
| 1 | 30% |
| 2 | 5% |
| 3 | 4% |
| 4 | 1% |

### Fishing Encounters (10 slots)
| Rod | Slots | Distribution |
|-----|-------|--------------|
| Old Rod | 0-1 | 70%, 30% |
| Good Rod | 2-4 | 60%, 20%, 20% |
| Super Rod | 5-9 | 40%, 40%, 15%, 4%, 1% |

## Encounter Rate Calculation

From `wild_encounter.c`:

```c
#define MAX_ENCOUNTER_RATE 2880

static bool8 WildEncounterCheck(u32 encounterRate, bool8 ignoreAbility) {
    // Base rate from map multiplied by 16
    encounterRate *= 16;

    // Bike reduces encounter rate by 20%
    if (TestPlayerAvatarFlags(PLAYER_AVATAR_FLAG_MACH_BIKE | PLAYER_AVATAR_FLAG_ACRO_BIKE))
        encounterRate = encounterRate * 80 / 100;

    // Flute modifiers
    if (FlagGet(FLAG_SYS_ENC_UP_ITEM))      // White Flute
        encounterRate += encounterRate / 2;  // +50%
    else if (FlagGet(FLAG_SYS_ENC_DOWN_ITEM)) // Black Flute
        encounterRate = encounterRate / 2;   // -50%

    // Cleanse Tag
    if (GetMonData(&gPlayerParty[0], MON_DATA_HELD_ITEM) == ITEM_CLEANSE_TAG)
        encounterRate = encounterRate * 2 / 3;  // -33%

    // Lead Pokemon abilities
    u32 ability = GetMonAbility(&gPlayerParty[0]);
    if (ability == ABILITY_STENCH || ability == ABILITY_WHITE_SMOKE)
        encounterRate /= 2;
    else if (ability == ABILITY_ILLUMINATE || ability == ABILITY_ARENA_TRAP)
        encounterRate *= 2;
    else if (ability == ABILITY_SAND_VEIL && weather == WEATHER_SANDSTORM)
        encounterRate /= 2;

    // Cap at maximum
    if (encounterRate > MAX_ENCOUNTER_RATE)
        encounterRate = MAX_ENCOUNTER_RATE;

    // Random check
    return (Random() % MAX_ENCOUNTER_RATE) < encounterRate;
}
```

### First Step Modifier

When stepping onto a different tile type, there's a 40% chance to skip the encounter check:

```c
static bool8 AllowWildCheckOnNewMetatile(void) {
    if (Random() % 100 >= 60)  // 40% chance to skip
        return FALSE;
    return TRUE;
}
```

## Encounter Data Example

From `wild_encounters.json`:

```json
{
  "map": "MAP_ROUTE101",
  "base_label": "gRoute101",
  "land_mons": {
    "encounter_rate": 20,
    "mons": [
      { "min_level": 2, "max_level": 2, "species": "SPECIES_WURMPLE" },
      { "min_level": 2, "max_level": 2, "species": "SPECIES_POOCHYENA" },
      { "min_level": 2, "max_level": 2, "species": "SPECIES_WURMPLE" },
      { "min_level": 3, "max_level": 3, "species": "SPECIES_WURMPLE" },
      { "min_level": 3, "max_level": 3, "species": "SPECIES_POOCHYENA" },
      { "min_level": 3, "max_level": 3, "species": "SPECIES_POOCHYENA" },
      { "min_level": 3, "max_level": 3, "species": "SPECIES_WURMPLE" },
      { "min_level": 3, "max_level": 3, "species": "SPECIES_POOCHYENA" },
      { "min_level": 2, "max_level": 2, "species": "SPECIES_ZIGZAGOON" },
      { "min_level": 2, "max_level": 2, "species": "SPECIES_ZIGZAGOON" },
      { "min_level": 3, "max_level": 3, "species": "SPECIES_ZIGZAGOON" },
      { "min_level": 3, "max_level": 3, "species": "SPECIES_ZIGZAGOON" }
    ]
  }
}
```

## Special Encounter Mechanics

### Repel System

Repel blocks encounters with Pokemon below the lead Pokemon's level:

```c
static bool8 IsWildLevelAllowedByRepel(u8 wildLevel) {
    if (!VarGet(VAR_REPEL_STEP_COUNT))
        return TRUE;  // No repel active

    for (i = 0; i < PARTY_SIZE; i++) {
        if (GetMonData(&gPlayerParty[i], MON_DATA_HP)) {
            u8 ourLevel = GetMonData(&gPlayerParty[i], MON_DATA_LEVEL);
            return wildLevel >= ourLevel;  // Block if wild < party
        }
    }
    return FALSE;
}
```

### Ability: Keen Eye / Intimidate

Reduces encounters with Pokemon 5+ levels below lead:

```c
static bool8 IsAbilityAllowingEncounter(u8 level) {
    u8 ability = GetMonAbility(&gPlayerParty[0]);
    if (ability == ABILITY_KEEN_EYE || ability == ABILITY_INTIMIDATE) {
        u8 playerLevel = GetMonData(&gPlayerParty[0], MON_DATA_LEVEL);
        if (playerLevel > 5 && level <= playerLevel - 5) {
            if (Random() % 2 == 0)
                return FALSE;  // 50% chance to block
        }
    }
    return TRUE;
}
```

### Ability: Magnet Pull / Static

50% chance to force encounters with Steel/Electric types:

```c
// In TryGenerateWildMon
if (TryGetAbilityInfluencedWildMonIndex(wildMon, TYPE_STEEL, ABILITY_MAGNET_PULL, &index))
    break;
if (TryGetAbilityInfluencedWildMonIndex(wildMon, TYPE_ELECTRIC, ABILITY_STATIC, &index))
    break;
```

### Ability: Synchronize

50% chance to match wild Pokemon's nature to lead:

```c
if (GetMonAbility(&gPlayerParty[0]) == ABILITY_SYNCHRONIZE && Random() % 2 == 0) {
    return GetMonData(&gPlayerParty[0], MON_DATA_PERSONALITY) % NUM_NATURES;
}
```

### Ability: Hustle / Vital Spirit / Pressure

50% chance to force maximum level for encounter slot:

```c
if (ability == ABILITY_HUSTLE || ability == ABILITY_VITAL_SPIRIT || ability == ABILITY_PRESSURE) {
    if (Random() % 2 == 0)
        return maxLevel;  // Force max level
}
```

### Feebas Special Case

Route 119 has 6 random fishing spots that can spawn Feebas:

```c
#define NUM_FEEBAS_SPOTS 6
#define NUM_FISHING_SPOTS 447  // Total accessible water tiles

static bool8 CheckFeebas(void) {
    // Only on Route 119
    if (gSaveBlock1Ptr->location != MAP_ROUTE119)
        return FALSE;

    // 50% base chance
    if (Random() % 100 > 49)
        return FALSE;

    // RNG seeded by Dewford trendy phrase
    FeebasSeedRng(gSaveBlock1Ptr->dewfordTrends[0].rand);

    // Generate 6 random spot IDs
    for (i = 0; i < NUM_FEEBAS_SPOTS; i++) {
        feebasSpots[i] = FeebasRandom() % NUM_FISHING_SPOTS;
    }

    // Check if player's fishing spot matches
    spotId = GetFeebasFishingSpotId(x, y, section);
    for (i = 0; i < NUM_FEEBAS_SPOTS; i++) {
        if (spotId == feebasSpots[i])
            return TRUE;
    }
    return FALSE;
}
```

### Mass Outbreak (Swarm)

TV-announced Pokemon swarms have increased spawn rates:

```c
static bool8 DoMassOutbreakEncounterTest(void) {
    if (gSaveBlock1Ptr->outbreakPokemonSpecies != SPECIES_NONE
        && gSaveBlock1Ptr->location.mapNum == gSaveBlock1Ptr->outbreakLocationMapNum) {
        if (Random() % 100 < gSaveBlock1Ptr->outbreakPokemonProbability)
            return TRUE;
    }
    return FALSE;
}
```

## Metatile Behaviors for Encounters

From `metatile_behavior.c`:

| Behavior | Description | Encounter Type |
|----------|-------------|----------------|
| `MB_TALL_GRASS` | Normal grass | Land |
| `MB_LONG_GRASS` | Tall grass | Land |
| `MB_ASHGRASS` | Ash-covered grass | Land |
| `MB_CAVE` | Cave floor | Land |
| `MB_POND_WATER` | Surfable water | Water |
| `MB_OCEAN_WATER` | Ocean (surfing) | Water |
| `MB_UNDERWATER` | Dive areas | Water |

## Proposed React Implementation

### Architecture

```
src/
├── encounters/
│   ├── EncounterManager.ts       # Main encounter logic
│   ├── EncounterData.ts          # Load/parse wild_encounters.json
│   ├── EncounterRates.ts         # Rate calculation with modifiers
│   ├── SpeciesSelector.ts        # Select species from encounter table
│   └── types.ts                  # TypeScript interfaces
```

### EncounterManager Interface

```typescript
interface WildPokemon {
  species: string;      // e.g., "SPECIES_ZIGZAGOON"
  minLevel: number;
  maxLevel: number;
}

interface EncounterTable {
  encounterRate: number;
  mons: WildPokemon[];
}

interface MapEncounterData {
  mapId: string;
  landMons?: EncounterTable;
  waterMons?: EncounterTable;
  rockSmashMons?: EncounterTable;
  fishingMons?: EncounterTable;
}

interface EncounterResult {
  species: string;
  level: number;
  encountered: boolean;
}

class EncounterManager {
  private encounterData: Map<string, MapEncounterData>;
  private repelSteps: number = 0;

  // Load all encounter data
  async loadEncounterData(): Promise<void>;

  // Check for encounter on step
  checkLandEncounter(
    mapId: string,
    currentBehavior: number,
    previousBehavior: number,
    partyLeadInfo: PartyLeadInfo
  ): EncounterResult | null;

  // Check for water encounter while surfing
  checkWaterEncounter(
    mapId: string,
    partyLeadInfo: PartyLeadInfo
  ): EncounterResult | null;

  // Rock smash encounter
  checkRockSmashEncounter(
    mapId: string,
    partyLeadInfo: PartyLeadInfo
  ): EncounterResult | null;

  // Fishing encounter
  checkFishingEncounter(
    mapId: string,
    rodType: 'old' | 'good' | 'super',
    partyLeadInfo: PartyLeadInfo
  ): EncounterResult | null;

  // Update repel counter
  updateRepel(): boolean;  // Returns true if repel wore off
}
```

### Rate Calculation Module

```typescript
interface RateModifiers {
  onBike: boolean;
  whiteFlute: boolean;
  blackFlute: boolean;
  cleanseTag: boolean;
  leadAbility: string;
  currentWeather: WeatherType;
}

const MAX_ENCOUNTER_RATE = 2880;

function calculateEncounterRate(
  baseRate: number,
  modifiers: RateModifiers
): number {
  let rate = baseRate * 16;

  // Bike modifier
  if (modifiers.onBike) {
    rate = Math.floor(rate * 0.8);
  }

  // Flute modifiers
  if (modifiers.whiteFlute) {
    rate = Math.floor(rate * 1.5);
  } else if (modifiers.blackFlute) {
    rate = Math.floor(rate * 0.5);
  }

  // Cleanse Tag
  if (modifiers.cleanseTag) {
    rate = Math.floor(rate * 2 / 3);
  }

  // Ability modifiers
  switch (modifiers.leadAbility) {
    case 'ABILITY_STENCH':
    case 'ABILITY_WHITE_SMOKE':
      rate = Math.floor(rate / 2);
      break;
    case 'ABILITY_ILLUMINATE':
    case 'ABILITY_ARENA_TRAP':
      rate *= 2;
      break;
    case 'ABILITY_SAND_VEIL':
      if (modifiers.currentWeather === WeatherType.SANDSTORM) {
        rate = Math.floor(rate / 2);
      }
      break;
  }

  return Math.min(rate, MAX_ENCOUNTER_RATE);
}

function rollEncounter(rate: number): boolean {
  return Math.floor(Math.random() * MAX_ENCOUNTER_RATE) < rate;
}
```

### Species Selection Module

```typescript
const LAND_SLOT_THRESHOLDS = [20, 40, 50, 60, 70, 80, 85, 90, 94, 98, 99, 100];
const WATER_SLOT_THRESHOLDS = [60, 90, 95, 99, 100];

function selectLandEncounterSlot(): number {
  const rand = Math.floor(Math.random() * 100);
  for (let i = 0; i < LAND_SLOT_THRESHOLDS.length; i++) {
    if (rand < LAND_SLOT_THRESHOLDS[i]) {
      return i;
    }
  }
  return 11;
}

function selectLevel(minLevel: number, maxLevel: number, leadAbility?: string): number {
  const range = maxLevel - minLevel + 1;

  // Hustle/Vital Spirit/Pressure: 50% max level
  if (['ABILITY_HUSTLE', 'ABILITY_VITAL_SPIRIT', 'ABILITY_PRESSURE'].includes(leadAbility || '')) {
    if (Math.random() < 0.5) {
      return maxLevel;
    }
  }

  return minLevel + Math.floor(Math.random() * range);
}
```

### Integration Example

```typescript
// In PlayerController or movement handler
function onPlayerStep(
  newX: number,
  newY: number,
  currentBehavior: number,
  previousBehavior: number
): void {
  // Check for land encounter
  if (metatileBehaviors.isLandEncounter(currentBehavior)) {
    const result = encounterManager.checkLandEncounter(
      currentMapId,
      currentBehavior,
      previousBehavior,
      getPartyLeadInfo()
    );

    if (result?.encountered) {
      startWildBattle(result.species, result.level);
    }
  }

  // Update repel counter
  if (encounterManager.updateRepel()) {
    showMessage("Repel's effect wore off!");
  }
}
```

## Implementation Priority

1. **Phase 1**: Basic encounter data loading
   - Parse wild_encounters.json
   - Map to current map ID system
   - Store in encounter data map

2. **Phase 2**: Land encounters
   - Basic rate calculation
   - Species/level selection
   - Trigger encounter events

3. **Phase 3**: Water/Fishing/Rock Smash
   - Surfing encounters
   - Fishing mechanics (rod types)
   - Rock smash encounters

4. **Phase 4**: Modifiers
   - Repel system
   - Item modifiers (Flutes, Cleanse Tag)
   - Ability modifiers

5. **Phase 5**: Special cases
   - Feebas spots on Route 119
   - Mass outbreaks/swarms
   - Roaming Pokemon (Latios/Latias)

## Data Files

Main data file: `src/data/wild_encounters.json`

Format:
```json
{
  "wild_encounter_groups": [
    {
      "label": "gWildMonHeaders",
      "for_maps": true,
      "fields": [
        {
          "type": "land_mons",
          "encounter_rates": [20, 20, 10, 10, 10, 10, 5, 5, 4, 4, 1, 1]
        },
        ...
      ],
      "encounters": [
        { "map": "MAP_ROUTE101", "land_mons": { ... } },
        ...
      ]
    }
  ]
}
```
