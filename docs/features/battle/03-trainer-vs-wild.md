---
title: Trainer vs Wild Pokemon AI Differences
status: reference
written_on: 2025-11-26
last_verified: 2026-01-13
---

# Trainer vs Wild Pokemon AI Differences

## Critical Finding

**Wild Pokemon use NO AI at all.** They select moves completely at random.

This is one of the most significant design decisions in the Pokemon battle system.

## The Code

### Trainer Battle (battle_controller_opponent.c:1563-1592)

```c
if (gBattleTypeFlags & (BATTLE_TYPE_TRAINER | BATTLE_TYPE_FIRST_BATTLE |
                        BATTLE_TYPE_SAFARI | BATTLE_TYPE_ROAMER))
{
    // Full AI system
    BattleAI_SetupAIData(ALL_MOVES_MASK);
    chosenMoveId = BattleAI_ChooseMoveOrAction();

    switch (chosenMoveId)
    {
        case AI_CHOICE_WATCH:
            BtlController_EmitTwoReturnValues(B_ACTION_SAFARI_WATCH_CAREFULLY);
            break;
        case AI_CHOICE_FLEE:
            BtlController_EmitTwoReturnValues(B_ACTION_RUN);
            break;
        default:
            // Handle move targeting
            BtlController_EmitTwoReturnValues(chosenMoveId | (gBattlerTarget << 8));
            break;
    }
}
```

### Wild Pokemon Battle (battle_controller_opponent.c:1594-1611)

```c
else  // Wild Pokemon
{
    u16 move;
    do {
        // Pure random selection!
        chosenMoveId = MOD(Random(), MAX_MON_MOVES);
        move = moveInfo->moves[chosenMoveId];
    } while (move == MOVE_NONE);

    // Simple targeting
    if (gBattleMoves[move].target & (MOVE_TARGET_USER_OR_SELECTED | MOVE_TARGET_USER))
        BtlController_EmitTwoReturnValues(chosenMoveId | (gActiveBattler << 8));
    else if (gBattleTypeFlags & BATTLE_TYPE_DOUBLE)
        BtlController_EmitTwoReturnValues(chosenMoveId | (GetBattlerAtPosition(Random() & 2) << 8));
    else
        BtlController_EmitTwoReturnValues(chosenMoveId | (GetBattlerAtPosition(B_POSITION_PLAYER_LEFT) << 8));
}
```

## Behavioral Comparison

### Move Selection

| Aspect | Trainer | Wild |
|--------|---------|------|
| **Selection Method** | Score-based evaluation | Pure random |
| **Type Effectiveness** | Considered | Ignored |
| **Status Move Timing** | Context-aware | Random |
| **KO Moves Prioritized** | Yes | No |
| **Bad Moves Avoided** | Yes | No |
| **HP Awareness** | Yes | No |

### Specific Scenarios

#### Scenario 1: Water Pokemon vs Fire Pokemon

**Trainer AI:**
```
Considering Water Gun:
  - Super effective (+2 effectiveness bonus)
  - Can potentially faint (+4 if so)
  Score: ~106

Considering Tail Whip:
  - No damage
  - Setup move at low priority
  Score: ~98

Result: Water Gun selected
```

**Wild Pokemon:**
```
Random selection: 25% each move
Could easily use Tail Whip against Fire type
```

#### Scenario 2: Pokemon at 1 HP

**Trainer AI:**
```
Considering any attacking move:
  - Can faint: +4 priority
  - Most powerful: +0 adjustment
  Score: 104+

Result: Selects best attacking move
```

**Wild Pokemon:**
```
25% chance for each move
May use Growl instead of finishing blow
```

#### Scenario 3: Own Pokemon at Low HP

**Trainer AI:**
```
Considering setup moves:
  - HP < 40%: -2 to most stat moves
  - May consider healing or priority moves

Considering attacking moves:
  - Normal scoring
```

**Wild Pokemon:**
```
Same 25% chance regardless of HP
May use Swords Dance at 5% HP
```

## Battle Type Flags

```c
// Uses AI (full scoring system)
BATTLE_TYPE_TRAINER         // Standard trainer battles
BATTLE_TYPE_FIRST_BATTLE    // Tutorial battle
BATTLE_TYPE_SAFARI          // Safari Zone (special flee/watch AI)
BATTLE_TYPE_ROAMER          // Legendary roamers (flee AI)

// No AI (pure random)
Everything else             // Wild Pokemon encounters
```

## Why Wild Pokemon Are Random

### Gameplay Design Reasons

1. **Difficulty Balance**: Wild encounters are meant to be easier/faster
2. **Player Advantage**: Allows grinding without frustration
3. **Resource Conservation**: Less processing needed per wild battle
4. **Thematic**: Wild Pokemon are untrained, unpredictable

### Technical Reasons

1. **No Trainer Data**: Wild Pokemon have no `aiFlags` field
2. **Simplified Logic**: Reduces code complexity
3. **Faster Battles**: No AI evaluation overhead

## Special Cases

### Roaming Pokemon

Legendary roamers (Latios, Latias) use `AI_SCRIPT_ROAMING`:
- 50% chance to flee each turn
- When not fleeing, still random moves (no other AI flags)

```assembly
AI_Roaming:
    if_random_less_than 128, AI_Roaming_End
    flee
AI_Roaming_End:
    end
```

### Safari Zone

Safari Zone Pokemon use `AI_SCRIPT_SAFARI`:
- Can flee based on catch rate
- Can "watch carefully" (delay action)

```assembly
AI_Safari:
    if_random_safari_flee AI_Safari_Pokemon_Flee
    watch
AI_Safari_Pokemon_Flee:
    flee
```

### First Battle

Birch's rescue battle uses `AI_SCRIPT_FIRST_BATTLE`:
- Basic AI to ensure tutorial is winnable
- Limited move selection

## Trainer AI Difficulty Tiers

### Tier 0: No AI (aiFlags = 0)
- Same as wild Pokemon - random
- Theoretically possible but not used in vanilla game

### Tier 1: Basic (aiFlags = AI_SCRIPT_CHECK_BAD_MOVE)
- Only avoids obviously bad moves (immunities, blocked by abilities)
- Still may use inefficient moves
- Used by: Weakest trainers

### Tier 2: Standard (aiFlags = CHECK_BAD_MOVE | TRY_TO_FAINT | CHECK_VIABILITY)
- Avoids bad moves
- Prioritizes KO moves
- Evaluates move viability
- Used by: Most trainers, Gym Leaders, Elite Four

### Tier 3: Advanced (Standard + HP_AWARE or SETUP_FIRST_TURN)
- All standard features
- HP-based strategy adjustments
- Setup move optimization
- Used by: Some special trainers

### Tier 4: Expert (Standard + DOUBLE_BATTLE + additional flags)
- Full double battle support
- Partner awareness
- Complex strategies
- Used by: Battle Frontier, tough doubles trainers

## Implementation Notes for React

When implementing this system in React, consider:

1. **Wild Pokemon Mode**: Simply random selection - no scoring needed
2. **Trainer Mode**: Full scoring pipeline required
3. **Configuration**: Make AI flags configurable per battle type
4. **Difficulty Settings**: Could add AI to wild Pokemon for hard mode

### Suggested React Structure

```typescript
interface BattleAIConfig {
  isTrainer: boolean;
  aiFlags: number;
}

function selectMove(
  pokemon: Pokemon,
  target: Pokemon,
  config: BattleAIConfig
): number {
  if (!config.isTrainer) {
    // Wild Pokemon - pure random
    return selectRandomMove(pokemon);
  }

  // Trainer - full AI evaluation
  return evaluateAndSelectMove(pokemon, target, config.aiFlags);
}
```
