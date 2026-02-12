---
title: Double Battle Mechanics
status: reference
written_on: 2025-11-26
last_verified: 2026-01-13
---

# Double Battle Mechanics

## Source Files

- **Battle Type Flags**: `include/constants/battle.h`
- **Battler Positions**: `include/constants/battle.h`
- **Target Selection**: `src/battle_util.c`
- **Multi-target Moves**: `src/battle_script_commands.c`

## Battler Positions

From `include/constants/battle.h`:

```
   + ------------------------- +
   |           Opponent's side |
   |            Right    Left  |
   |              3       1    |
   |                           |
   | Player's side             |
   |  Left   Right             |
   |   0       2               |
   ----------------------------+
```

```c
enum BattlerPosition {
    B_POSITION_PLAYER_LEFT,     // 0
    B_POSITION_OPPONENT_LEFT,   // 1
    B_POSITION_PLAYER_RIGHT,    // 2
    B_POSITION_OPPONENT_RIGHT,  // 3
    MAX_POSITION_COUNT,
};

// Macros for navigating positions
#define BATTLE_OPPOSITE(id) ((id) ^ BIT_SIDE)    // Get opposing side
#define BATTLE_PARTNER(id)  ((id) ^ BIT_FLANK)   // Get partner

#define B_SIDE_PLAYER     0
#define B_SIDE_OPPONENT   1

#define BIT_SIDE   1  // Bit 0: side (player/opponent)
#define BIT_FLANK  2  // Bit 1: flank (left/right)
```

## Move Target Types in Doubles

From `include/battle.h`:

```c
#define MOVE_TARGET_SELECTED            0        // Select one target
#define MOVE_TARGET_DEPENDS             (1 << 0) // Context-dependent
#define MOVE_TARGET_USER_OR_SELECTED    (1 << 1) // Self or select target
#define MOVE_TARGET_RANDOM              (1 << 2) // Random opponent
#define MOVE_TARGET_BOTH                (1 << 3) // Both opponents
#define MOVE_TARGET_USER                (1 << 4) // User only
#define MOVE_TARGET_FOES_AND_ALLY       (1 << 5) // All except user
#define MOVE_TARGET_OPPONENTS_FIELD     (1 << 6) // Opponent's field (Spikes)
```

### Target Type Behavior

| Target Type | Single Battle | Double Battle |
|-------------|---------------|---------------|
| `SELECTED` | Opponent | Choose one target |
| `RANDOM` | Opponent | Random opponent |
| `BOTH` | Opponent | Both opponents |
| `USER` | Self | Self |
| `FOES_AND_ALLY` | Opponent | All 3 other battlers |
| `OPPONENTS_FIELD` | Opp. field | Opp. field |

## Multi-Target Move Damage

From `src/pokemon.c`:

```c
// In CalculateBaseDamage():

// Moves hitting both targets do half damage in double battles
if ((gBattleTypeFlags & BATTLE_TYPE_DOUBLE) &&
    gBattleMoves[move].target == MOVE_TARGET_BOTH &&
    CountAliveMonsInBattle(BATTLE_ALIVE_DEF_SIDE) == 2) {
    damage /= 2;
}
```

**Key Rules:**
- Moves that hit both opponents deal **50% damage** to each
- If only one opponent remains, full damage is dealt
- Spread moves like Earthquake hit ally for full damage

## Partner Interactions

### Moves That Affect Partner

| Move | Effect |
|------|--------|
| Helping Hand | Boost partner's next move by 50% |
| Follow Me | Redirect single-target attacks to self |
| Heal Bell | Cure team status |
| Safeguard | Protect team from status |
| Reflect/Light Screen | Protect team from damage |

### Moves That Can Hit Partner

| Move | Target Type |
|------|-------------|
| Earthquake | `FOES_AND_ALLY` |
| Surf | `FOES_AND_ALLY` |
| Explosion | `FOES_AND_ALLY` |
| Perish Song | All battlers |

## Target Selection Logic

From `src/battle_util.c`:

```c
void HandleAction_UseMove(void)
{
    u8 side;
    u8 var = 4;

    gBattlerAttacker = gBattlerByTurnOrder[gCurrentTurnActionNumber];

    // Choose target
    side = BATTLE_OPPOSITE(GetBattlerSide(gBattlerAttacker));

    // Follow Me redirects attacks
    if (gSideTimers[side].followmeTimer != 0
        && gBattleMoves[gCurrentMove].target == MOVE_TARGET_SELECTED
        && GetBattlerSide(gBattlerAttacker) != GetBattlerSide(gSideTimers[side].followmeTarget)
        && gBattleMons[gSideTimers[side].followmeTarget].hp != 0) {
        gBattlerTarget = gSideTimers[side].followmeTarget;
    }
    // Lightning Rod redirects Electric moves
    else if ((gBattleTypeFlags & BATTLE_TYPE_DOUBLE)
             && gSideTimers[side].followmeTimer == 0
             && gBattleMoves[gCurrentMove].type == TYPE_ELECTRIC
             && gBattleMoves[gCurrentMove].power != 0) {
        // Find Lightning Rod user
        for (gActiveBattler = 0; gActiveBattler < gBattlersCount; gActiveBattler++) {
            if (GetBattlerSide(gActiveBattler) != GetBattlerSide(gBattlerAttacker)
                && gBattleMons[gActiveBattler].ability == ABILITY_LIGHTNING_ROD) {
                gBattlerTarget = gActiveBattler;
                gSpecialStatuses[gActiveBattler].lightningRodRedirected = 1;
                break;
            }
        }
    }
    // Random target selection for MOVE_TARGET_RANDOM
    else if (gBattleTypeFlags & BATTLE_TYPE_DOUBLE
             && gBattleMoves[gChosenMove].target & MOVE_TARGET_RANDOM) {
        if (GetBattlerSide(gBattlerAttacker) == B_SIDE_PLAYER) {
            if (Random() & 1)
                gBattlerTarget = GetBattlerAtPosition(B_POSITION_OPPONENT_LEFT);
            else
                gBattlerTarget = GetBattlerAtPosition(B_POSITION_OPPONENT_RIGHT);
        } else {
            if (Random() & 1)
                gBattlerTarget = GetBattlerAtPosition(B_POSITION_PLAYER_LEFT);
            else
                gBattlerTarget = GetBattlerAtPosition(B_POSITION_PLAYER_RIGHT);
        }
    }
    else {
        gBattlerTarget = *(gBattleStruct->moveTarget + gBattlerAttacker);
    }

    // Handle absent battler (fainted target)
    if (gAbsentBattlerFlags & gBitTable[gBattlerTarget]) {
        // Retarget to partner if target fainted
        if (GetBattlerSide(gBattlerAttacker) != GetBattlerSide(gBattlerTarget)) {
            gBattlerTarget = GetBattlerAtPosition(BATTLE_PARTNER(GetBattlerPosition(gBattlerTarget)));
        }
    }
}
```

## Turn Order in Doubles

```c
u8 GetWhoStrikesFirst(u8 battler1, u8 battler2, bool8 ignoreChosenMoves)
{
    u8 who = 0;
    s8 priority1, priority2;
    u16 speed1, speed2;

    // Get move priorities
    if (!ignoreChosenMoves) {
        priority1 = gBattleMoves[gChosenMoveByBattler[battler1]].priority;
        priority2 = gBattleMoves[gChosenMoveByBattler[battler2]].priority;
    } else {
        priority1 = priority2 = 0;
    }

    // Priority takes precedence
    if (priority1 > priority2)
        return battler1;
    if (priority2 > priority1)
        return battler2;

    // Calculate speeds with modifiers
    speed1 = GetBattlerSpeed(battler1);
    speed2 = GetBattlerSpeed(battler2);

    // Quick Claw check
    if (gProtectStructs[battler1].quickClaw && !gProtectStructs[battler2].quickClaw)
        return battler1;
    if (gProtectStructs[battler2].quickClaw && !gProtectStructs[battler1].quickClaw)
        return battler2;

    // Speed comparison (Trick Room reverses)
    if (gBattleWeather & B_WEATHER_TRICK_ROOM) {
        if (speed1 < speed2)
            return battler1;
        if (speed2 < speed1)
            return battler2;
    } else {
        if (speed1 > speed2)
            return battler1;
        if (speed2 > speed1)
            return battler2;
    }

    // Speed tie - random
    return (Random() & 1) ? battler1 : battler2;
}
```

## Multi-Target Move Execution

From `data/battle_scripts_1.s`:

```asm
BattleScript_EffectExplosion::
    attackcanceler
    attackstring
    ppreduce
    tryexplosion
    setatkhptozero
    waitstate
    @ ...

BattleScript_ExplosionLoop:
    movevaluescleanup
    critcalc
    damagecalc
    typecalc
    adjustnormaldamage
    accuracycheck BattleScript_ExplosionMissed, ACC_CURR_MOVE
    effectivenesssound
    hitanimation BS_TARGET
    waitstate
    healthbarupdate BS_TARGET
    datahpupdate BS_TARGET
    critmessage
    waitmessage B_WAIT_TIME_LONG
    resultmessage
    waitmessage B_WAIT_TIME_LONG
    tryfaintmon BS_TARGET

    @ Move to next target
    moveendto MOVEEND_NEXT_TARGET
    jumpifnexttargetvalid BattleScript_ExplosionLoop

    tryfaintmon BS_ATTACKER
    end
```

## Screen Damage Reduction in Doubles

From `src/pokemon.c`:

```c
// Reflect in doubles
if ((sideStatus & SIDE_STATUS_REFLECT) && gCritMultiplier == 1) {
    if ((gBattleTypeFlags & BATTLE_TYPE_DOUBLE) &&
        CountAliveMonsInBattle(BATTLE_ALIVE_DEF_SIDE) == 2) {
        damage = 2 * (damage / 3);  // 2/3 reduction in doubles
    } else {
        damage /= 2;  // 1/2 reduction in singles
    }
}

// Light Screen in doubles
if ((sideStatus & SIDE_STATUS_LIGHTSCREEN) && gCritMultiplier == 1) {
    if ((gBattleTypeFlags & BATTLE_TYPE_DOUBLE) &&
        CountAliveMonsInBattle(BATTLE_ALIVE_DEF_SIDE) == 2) {
        damage = 2 * (damage / 3);  // 2/3 reduction in doubles
    } else {
        damage /= 2;  // 1/2 reduction in singles
    }
}
```

## TypeScript Double Battle Interface

```typescript
interface DoubleBattleState {
  playerLeft: BattlePokemon | null;
  playerRight: BattlePokemon | null;
  opponentLeft: BattlePokemon | null;
  opponentRight: BattlePokemon | null;
}

enum BattlerPosition {
  PLAYER_LEFT = 0,
  OPPONENT_LEFT = 1,
  PLAYER_RIGHT = 2,
  OPPONENT_RIGHT = 3,
}

function getValidTargets(
  attacker: BattlerPosition,
  move: Move,
  battleState: DoubleBattleState
): BattlerPosition[] {
  const targets: BattlerPosition[] = [];
  const attackerSide = attacker & 1;  // 0 = player, 1 = opponent

  switch (move.target) {
    case MoveTarget.SELECTED:
      // Can target either opponent
      if (attackerSide === 0) {
        if (battleState.opponentLeft) targets.push(BattlerPosition.OPPONENT_LEFT);
        if (battleState.opponentRight) targets.push(BattlerPosition.OPPONENT_RIGHT);
      } else {
        if (battleState.playerLeft) targets.push(BattlerPosition.PLAYER_LEFT);
        if (battleState.playerRight) targets.push(BattlerPosition.PLAYER_RIGHT);
      }
      break;

    case MoveTarget.BOTH:
      // Targets both opponents
      if (attackerSide === 0) {
        if (battleState.opponentLeft) targets.push(BattlerPosition.OPPONENT_LEFT);
        if (battleState.opponentRight) targets.push(BattlerPosition.OPPONENT_RIGHT);
      } else {
        if (battleState.playerLeft) targets.push(BattlerPosition.PLAYER_LEFT);
        if (battleState.playerRight) targets.push(BattlerPosition.PLAYER_RIGHT);
      }
      break;

    case MoveTarget.FOES_AND_ALLY:
      // All except self
      for (let pos = 0; pos < 4; pos++) {
        if (pos !== attacker && getBattlerAt(pos, battleState)) {
          targets.push(pos);
        }
      }
      break;

    case MoveTarget.USER:
      targets.push(attacker);
      break;

    case MoveTarget.USER_OR_SELECTED:
      // Self or partner for some moves
      targets.push(attacker);
      const partner = attacker ^ 2;  // Toggle flank bit
      if (getBattlerAt(partner, battleState)) {
        targets.push(partner);
      }
      break;
  }

  return targets;
}

function calculateSpreadDamage(
  baseDamage: number,
  targetCount: number
): number {
  // In Gen 3, spread moves deal 50% to each target if hitting multiple
  if (targetCount > 1) {
    return Math.floor(baseDamage / 2);
  }
  return baseDamage;
}

function determineDoubleBattleTurnOrder(
  battlers: BattlerPosition[],
  chosenMoves: Map<BattlerPosition, Move>,
  speeds: Map<BattlerPosition, number>
): BattlerPosition[] {
  return battlers.sort((a, b) => {
    const moveA = chosenMoves.get(a)!;
    const moveB = chosenMoves.get(b)!;

    // Priority first
    if (moveA.priority !== moveB.priority) {
      return moveB.priority - moveA.priority;
    }

    // Then speed
    const speedA = speeds.get(a)!;
    const speedB = speeds.get(b)!;
    if (speedA !== speedB) {
      return speedB - speedA;  // Higher speed first
    }

    // Random tie-breaker
    return Math.random() < 0.5 ? -1 : 1;
  });
}
```
