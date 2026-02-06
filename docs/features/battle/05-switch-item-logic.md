---
title: Switch & Item Logic
status: reference
last_verified: 2026-01-13
---

# Switch & Item Logic

## Overview

Before selecting a move, trainer AI evaluates whether to switch Pokemon or use an item. This logic is handled by `AI_TrySwitchOrUseItem()` in `battle_ai_switch_items.c`.

## Decision Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   AI_TrySwitchOrUseItem()                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Is this a TRAINER battle?                     │
└─────────────────────────────────────────────────────────────────┘
                    │                    │
                   YES                   NO
                    │                    │
                    ▼                    ▼
┌───────────────────────┐    ┌─────────────────────────────────────┐
│    ShouldSwitch()?    │    │  Use move (no switch/item)          │
└───────────────────────┘    └─────────────────────────────────────┘
          │
    YES   │   NO
          │
          ▼
┌───────────────────────┐
│  GetMostSuitable      │
│  MonToSwitchInto()    │
│  Execute switch       │
└───────────────────────┘
          │
          │ (if switch not chosen)
          ▼
┌───────────────────────┐
│  ShouldUseItem()?     │
│  Execute item use     │
└───────────────────────┘
          │
          │ (if item not used)
          ▼
┌───────────────────────┐
│  Use move normally    │
└───────────────────────┘
```

## Switching Logic

### ShouldSwitch() - Main Function

Checks whether the AI should switch, returning TRUE if switching is recommended.

#### Trapping Checks

Cannot switch if trapped by:
- `STATUS2_WRAPPED` - Bind, Wrap, Fire Spin, etc.
- `STATUS2_ESCAPE_PREVENTION` - Mean Look, Block, etc.
- `STATUS3_ROOTED` - Ingrain
- Opponent has `ABILITY_SHADOW_TAG`
- Opponent has `ABILITY_ARENA_TRAP` (bug: doesn't check Flying/Levitate)
- `ABILITY_MAGNET_PULL` and user is Steel-type

#### Switch Priority Order

1. **ShouldSwitchIfPerishSong()** - Highest priority
2. **ShouldSwitchIfWonderGuard()** - Counter Wonder Guard
3. **FindMonThatAbsorbsOpponentsMove()** - Ability-based switch
4. **ShouldSwitchIfNaturalCure()** - Strategic cure
5. **Type-based switches** - Better matchup

### ShouldSwitchIfPerishSong()

```c
static bool8 ShouldSwitchIfPerishSong(void)
{
    if (gStatuses3[gActiveBattler] & STATUS3_PERISH_SONG
        && gDisableStructs[gActiveBattler].perishSongTimer == 0)
    {
        // Perish timer is 0 - will faint this turn!
        // Must switch or die
        return TRUE;
    }
    return FALSE;
}
```

**Logic**: Switch immediately when Perish Song counter hits 0.

### ShouldSwitchIfWonderGuard()

```c
static bool8 ShouldSwitchIfWonderGuard(void)
{
    // Only in singles
    if (gBattleTypeFlags & BATTLE_TYPE_DOUBLE)
        return FALSE;

    // Check if opponent has Wonder Guard
    if (opponent->ability != ABILITY_WONDER_GUARD)
        return FALSE;

    // Check if current Pokemon has super effective move
    for (i = 0; i < MAX_MON_MOVES; i++)
    {
        move = gBattleMons[gActiveBattler].moves[i];
        moveFlags = AI_TypeCalc(move, opponent->species, opponent->ability);
        if (moveFlags & MOVE_RESULT_SUPER_EFFECTIVE)
            return FALSE;  // Can hit, don't switch
    }

    // Search party for Pokemon with super effective move
    for (i = 0; i < PARTY_SIZE; i++)
    {
        // Check each party member's moves
        for (j = 0; j < MAX_MON_MOVES; j++)
        {
            move = GetMonData(&party[i], MON_DATA_MOVE1 + j);
            moveFlags = AI_TypeCalc(move, opponent->species, opponent->ability);
            if (moveFlags & MOVE_RESULT_SUPER_EFFECTIVE && Random() % 3 < 2)
            {
                // Found suitable Pokemon - switch
                return TRUE;
            }
        }
    }
    return FALSE;
}
```

**Logic**: Switch to a Pokemon that can hit Wonder Guard if current one cannot.

### FindMonThatAbsorbsOpponentsMove()

```c
static bool8 FindMonThatAbsorbsOpponentsMove(void)
{
    // Skip if we have super effective moves
    if (HasSuperEffectiveMoveAgainstOpponents(TRUE) && Random() % 3 != 0)
        return FALSE;

    // Check last move that hit us
    if (gLastLandedMoves[gActiveBattler] == MOVE_NONE)
        return FALSE;

    // Determine absorbing ability needed
    if (moveType == TYPE_FIRE)
        absorbingTypeAbility = ABILITY_FLASH_FIRE;
    else if (moveType == TYPE_WATER)
        absorbingTypeAbility = ABILITY_WATER_ABSORB;
    else if (moveType == TYPE_ELECTRIC)
        absorbingTypeAbility = ABILITY_VOLT_ABSORB;
    else
        return FALSE;

    // Already have absorbing ability
    if (gBattleMons[gActiveBattler].ability == absorbingTypeAbility)
        return FALSE;

    // Search party for Pokemon with absorbing ability
    for (i = 0; i < PARTY_SIZE; i++)
    {
        if (monAbility == absorbingTypeAbility && Random() & 1)
        {
            return TRUE;  // Switch to absorber
        }
    }
    return FALSE;
}
```

**Logic**: Switch to absorb predicted repeated move (Fire→Flash Fire, Water→Water Absorb, Electric→Volt Absorb).

### ShouldSwitchIfNaturalCure()

```c
static bool8 ShouldSwitchIfNaturalCure(void)
{
    // Must be asleep with Natural Cure
    if (!(gBattleMons[gActiveBattler].status1 & STATUS1_SLEEP))
        return FALSE;
    if (gBattleMons[gActiveBattler].ability != ABILITY_NATURAL_CURE)
        return FALSE;

    // Don't switch if HP too low
    if (gBattleMons[gActiveBattler].hp < gBattleMons[gActiveBattler].maxHP / 2)
        return FALSE;

    // Random chance to switch when opponent used non-damaging move
    if (gBattleMoves[gLastLandedMoves[gActiveBattler]].power == 0 && Random() & 1)
        return TRUE;

    // Look for type-advantaged Pokemon
    if (FindMonWithFlagsAndSuperEffective(MOVE_RESULT_DOESNT_AFFECT_FOE, 1))
        return TRUE;
    if (FindMonWithFlagsAndSuperEffective(MOVE_RESULT_NOT_VERY_EFFECTIVE, 1))
        return TRUE;

    return FALSE;
}
```

**Logic**: Wake up from Sleep via Natural Cure switch-out when safe.

### Final Switch Conditions

```c
// After specific checks pass...

// Don't switch if we have super effective moves
if (HasSuperEffectiveMoveAgainstOpponents(FALSE))
    return FALSE;

// Don't switch if we have stat boosts
if (AreStatsRaised())
    return FALSE;

// Consider switching for type advantage
if (FindMonWithFlagsAndSuperEffective(MOVE_RESULT_DOESNT_AFFECT_FOE, 2)
    || FindMonWithFlagsAndSuperEffective(MOVE_RESULT_NOT_VERY_EFFECTIVE, 3))
    return TRUE;
```

## GetMostSuitableMonToSwitchInto()

Selects the best Pokemon to switch to based on:

1. **Type Advantage**: Find Pokemon whose type resists opponent's attacks
2. **Super Effective Moves**: Pokemon must have SE move against opponent
3. **Damage Potential**: If no type match, select highest damage dealer

### Known Bug

```c
// BUG: This comparison selects Pokemon that takes MORE damage
// Should be: if (bestDmg > typeDmg) for LESS damage
if (bestDmg < typeDmg)
{
    bestDmg = typeDmg;
    bestMonId = i;
}
```

## Item Usage Logic

### ShouldUseItem() - Main Function

Trainers can use items defined in their trainer data:

```c
struct Trainer {
    // ...
    u16 items[4];  // Up to 4 items per trainer
    // ...
};
```

### Item Categories

```c
#define AI_ITEM_FULL_RESTORE     0  // Full HP + all status cure
#define AI_ITEM_HEAL_HP          1  // Potions
#define AI_ITEM_CURE_CONDITION   2  // Status healing
#define AI_ITEM_X_STAT           3  // X Attack, X Defend, etc.
#define AI_ITEM_GUARD_SPEC       4  // Guard Spec
#define AI_ITEM_NOT_RECOGNIZABLE 5  // Unknown/unhandled
```

### Usage Conditions

#### Full Restore

```c
case AI_ITEM_FULL_RESTORE:
    if (gBattleMons[gActiveBattler].hp >= gBattleMons[gActiveBattler].maxHP / 4)
        break;  // HP not low enough
    if (gBattleMons[gActiveBattler].hp == 0)
        break;  // Already fainted
    shouldUse = TRUE;
    break;
```

**Triggers when**: HP < 25% and not fainted

#### HP Healing (Potions)

```c
case AI_ITEM_HEAL_HP:
    if (gBattleMons[gActiveBattler].hp == 0)
        break;
    // Use if HP < 25% OR if heal amount would be useful
    if (gBattleMons[gActiveBattler].hp < maxHP / 4 ||
        maxHP - currentHP > healAmount)
        shouldUse = TRUE;
    break;
```

**Triggers when**: HP < 25% OR heal would not be wasted

#### Status Cure

```c
case AI_ITEM_CURE_CONDITION:
    if (hasStatus(SLEEP) && itemCures(SLEEP))
        shouldUse = TRUE;
    if (hasStatus(POISON) && itemCures(POISON))
        shouldUse = TRUE;
    // ... similar for Burn, Freeze, Paralysis, Confusion
    break;
```

**Triggers when**: Pokemon has curable status

#### X Items (Stat Boost)

```c
case AI_ITEM_X_STAT:
    // Only use on first turn
    if (gDisableStructs[gActiveBattler].isFirstTurn == 0)
        break;
    // Set appropriate boost flags
    shouldUse = TRUE;
    break;
```

**Triggers when**: First turn only

#### Guard Spec

```c
case AI_ITEM_GUARD_SPEC:
    // First turn AND Mist not active
    if (isFirstTurn && gSideTimers[side].mistTimer == 0)
        shouldUse = TRUE;
    break;
```

**Triggers when**: First turn and Mist not active

## Item Restriction

Items can only be used in certain battle types:

```c
// Items are allowed ONLY in trainer battles, excluding:
if ((gBattleTypeFlags & BATTLE_TYPE_TRAINER)
    && !(gBattleTypeFlags & (
        BATTLE_TYPE_LINK |
        BATTLE_TYPE_SAFARI |
        BATTLE_TYPE_BATTLE_TOWER |
        BATTLE_TYPE_EREADER_TRAINER |
        BATTLE_TYPE_SECRET_BASE |
        BATTLE_TYPE_FRONTIER |
        BATTLE_TYPE_INGAME_PARTNER |
        BATTLE_TYPE_RECORDED_LINK
    )))
{
    // Can use items
}
```

## Implementation Notes

### For React Implementation

```typescript
interface SwitchDecision {
  shouldSwitch: boolean;
  targetPartyIndex: number | null;
  reason: SwitchReason;
}

enum SwitchReason {
  PerishSong,
  WonderGuard,
  AbsorbAbility,
  NaturalCure,
  TypeAdvantage,
  None
}

function evaluateSwitch(
  battle: BattleState,
  aiPokemon: Pokemon,
  party: Pokemon[]
): SwitchDecision {
  // Check trapping first
  if (isTrapped(aiPokemon, battle)) {
    return { shouldSwitch: false, targetPartyIndex: null, reason: SwitchReason.None };
  }

  // Priority checks
  if (shouldSwitchPerishSong(aiPokemon)) {
    return findBestSwitch(party, SwitchReason.PerishSong);
  }

  // Continue with other checks...
}
```

### Item Usage Structure

```typescript
interface ItemDecision {
  shouldUseItem: boolean;
  itemId: number | null;
  itemType: AIItemType;
}

enum AIItemType {
  FullRestore,
  HealHP,
  CureCondition,
  XStat,
  GuardSpec
}

function evaluateItemUse(
  aiPokemon: Pokemon,
  trainerItems: number[],
  isFirstTurn: boolean
): ItemDecision {
  for (const item of trainerItems) {
    const itemType = getAIItemType(item);
    if (shouldUseItem(aiPokemon, itemType, isFirstTurn)) {
      return { shouldUseItem: true, itemId: item, itemType };
    }
  }
  return { shouldUseItem: false, itemId: null, itemType: null };
}
```
