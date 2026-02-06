---
title: Battle Script System
status: reference
last_verified: 2026-01-13
---

# Battle Script System

## Source Files

- **Script Implementations**: `src/battle_script_commands.c`
- **Move Effect Scripts**: `data/battle_scripts_1.s`
- **Script Macros**: `asm/macros/battle_script.inc`
- **Command Constants**: `include/constants/battle_script_commands.h`

## Script Command Table

Each move effect maps to a battle script. The script executes a series of commands.

From `data/battle_scripts_1.s`:

```asm
gBattleScriptsForMoveEffects::
    .4byte BattleScript_EffectHit              @ EFFECT_HIT (0)
    .4byte BattleScript_EffectSleep            @ EFFECT_SLEEP (1)
    .4byte BattleScript_EffectPoisonHit        @ EFFECT_POISON_HIT (2)
    .4byte BattleScript_EffectAbsorb           @ EFFECT_ABSORB (3)
    .4byte BattleScript_EffectBurnHit          @ EFFECT_BURN_HIT (4)
    .4byte BattleScript_EffectFreezeHit        @ EFFECT_FREEZE_HIT (5)
    .4byte BattleScript_EffectParalyzeHit      @ EFFECT_PARALYZE_HIT (6)
    .4byte BattleScript_EffectExplosion        @ EFFECT_EXPLOSION (7)
    @ ... continues for all effects
```

## Core Script Commands

### Move Execution Commands

| Command | Description |
|---------|-------------|
| `attackcanceler` | Check if move can execute (sleep, frozen, flinch, etc.) |
| `accuracycheck` | Roll accuracy check, jump to miss script if failed |
| `attackstring` | Print "[Pokemon] used [Move]!" message |
| `ppreduce` | Deduct PP from the move |
| `critcalc` | Calculate if critical hit |
| `damagecalc` | Calculate base damage |
| `typecalc` | Apply STAB and type effectiveness |
| `adjustnormaldamage` | Apply damage modifiers (Endure, etc.) |

### Animation Commands

| Command | Description |
|---------|-------------|
| `attackanimation` | Play the move's animation |
| `waitanimation` | Wait for animation to complete |
| `hitanimation BS_TARGET` | Play hit effect on target |
| `effectivenesssound` | Play super effective/not effective sound |

### Health/Status Commands

| Command | Description |
|---------|-------------|
| `healthbarupdate BS_TARGET` | Animate health bar change |
| `datahpupdate BS_TARGET` | Update actual HP value |
| `setmoveeffect EFFECT` | Set secondary effect to apply |
| `seteffectwithchance` | Apply effect with move's chance |
| `seteffectprimary` | Apply effect guaranteed |
| `tryfaintmon BS_TARGET` | Check if target fainted |

### Message Commands

| Command | Description |
|---------|-------------|
| `printstring ID` | Print a specific battle string |
| `critmessage` | Print "Critical hit!" if applicable |
| `resultmessage` | Print effectiveness message |
| `waitmessage TIME` | Wait for message display |

### Flow Control Commands

| Command | Description |
|---------|-------------|
| `goto LABEL` | Jump to script label |
| `call LABEL` | Call script as subroutine |
| `return` | Return from subroutine |
| `end` | End script execution |
| `jumpifstatus` | Conditional jump based on status |
| `jumpifability` | Conditional jump based on ability |
| `jumpiftype` | Conditional jump based on type |
| `moveendall` | Clean up and prepare for next move |

## Standard Hit Script

From `data/battle_scripts_1.s`:

```asm
BattleScript_EffectHit::
    @ Special case: Surf does double damage to diving targets
    jumpifnotmove MOVE_SURF, BattleScript_HitFromAtkCanceler
    jumpifnostatus3 BS_TARGET, STATUS3_UNDERWATER, BattleScript_HitFromAtkCanceler
    orword gHitMarker, HITMARKER_IGNORE_UNDERWATER
    setbyte sDMG_MULTIPLIER, 2

BattleScript_HitFromAtkCanceler::
    attackcanceler                              @ Check if can attack

BattleScript_HitFromAccCheck::
    accuracycheck BattleScript_PrintMoveMissed, ACC_CURR_MOVE

BattleScript_HitFromAtkString::
    attackstring                                @ "[Pokemon] used [Move]!"
    ppreduce                                    @ Reduce PP

BattleScript_HitFromCritCalc::
    critcalc                                    @ Roll for crit
    damagecalc                                  @ Calculate damage
    typecalc                                    @ Apply type/STAB
    adjustnormaldamage                          @ Final adjustments

BattleScript_HitFromAtkAnimation::
    attackanimation                             @ Play attack anim
    waitanimation
    effectivenesssound                          @ Play SE
    hitanimation BS_TARGET                      @ Target reacts
    waitstate
    healthbarupdate BS_TARGET                   @ Animate HP bar
    datahpupdate BS_TARGET                      @ Update HP data
    critmessage                                 @ "Critical hit!"
    waitmessage B_WAIT_TIME_LONG
    resultmessage                               @ Effectiveness
    waitmessage B_WAIT_TIME_LONG
    seteffectwithchance                         @ Try secondary effect
    tryfaintmon BS_TARGET                       @ Check faint

BattleScript_MoveEnd::
    moveendall                                  @ Cleanup
    end
```

## Sleep Move Script

```asm
BattleScript_EffectSleep::
    attackcanceler
    attackstring
    ppreduce

    @ Cannot sleep a substitute
    jumpifstatus2 BS_TARGET, STATUS2_SUBSTITUTE, BattleScript_ButItFailed

    @ Already asleep
    jumpifstatus BS_TARGET, STATUS1_SLEEP, BattleScript_AlreadyAsleep

    @ Uproar prevents sleep
    jumpifcantmakeasleep BattleScript_CantMakeAsleep

    @ Cannot stack status conditions
    jumpifstatus BS_TARGET, STATUS1_ANY, BattleScript_ButItFailed

    @ Accuracy check
    accuracycheck BattleScript_ButItFailed, ACC_CURR_MOVE

    @ Safeguard blocks
    jumpifsideaffecting BS_TARGET, SIDE_STATUS_SAFEGUARD, BattleScript_SafeguardProtected

    @ Apply sleep
    attackanimation
    waitanimation
    setmoveeffect MOVE_EFFECT_SLEEP
    seteffectprimary
    goto BattleScript_MoveEnd

BattleScript_AlreadyAsleep::
    setalreadystatusedmoveattempt BS_ATTACKER
    pause B_WAIT_TIME_SHORT
    printstring STRINGID_PKMNALREADYASLEEP
    waitmessage B_WAIT_TIME_LONG
    goto BattleScript_MoveEnd
```

## Absorb/Drain Script

```asm
BattleScript_EffectAbsorb::
    attackcanceler
    accuracycheck BattleScript_PrintMoveMissed, ACC_CURR_MOVE
    attackstring
    ppreduce
    critcalc
    damagecalc
    typecalc
    adjustnormaldamage
    attackanimation
    waitanimation
    effectivenesssound
    hitanimation BS_TARGET
    waitstate
    healthbarupdate BS_TARGET
    datahpupdate BS_TARGET
    critmessage
    waitmessage B_WAIT_TIME_LONG
    resultmessage
    waitmessage B_WAIT_TIME_LONG

    @ Negate damage for healing
    negativedamage
    orword gHitMarker, HITMARKER_IGNORE_SUBSTITUTE

    @ Liquid Ooze reverses drain
    jumpifability BS_TARGET, ABILITY_LIQUID_OOZE, BattleScript_AbsorbLiquidOoze
    setbyte cMULTISTRING_CHOOSER, B_MSG_ABSORB
    goto BattleScript_AbsorbUpdateHp

BattleScript_AbsorbLiquidOoze::
    manipulatedamage DMG_CHANGE_SIGN
    setbyte cMULTISTRING_CHOOSER, B_MSG_ABSORB_OOZE

BattleScript_AbsorbUpdateHp::
    healthbarupdate BS_ATTACKER
    datahpupdate BS_ATTACKER
    jumpifmovehadnoeffect BattleScript_AbsorbTryFainting
    printfromtable gAbsorbDrainStringIds
    waitmessage B_WAIT_TIME_LONG

BattleScript_AbsorbTryFainting::
    tryfaintmon BS_ATTACKER
    tryfaintmon BS_TARGET
    goto BattleScript_MoveEnd
```

## Multi-Hit Script

```asm
BattleScript_EffectMultiHit::
    attackcanceler
    accuracycheck BattleScript_PrintMoveMissed, ACC_CURR_MOVE
    attackstring
    ppreduce

    @ Set hit count (2-5 times)
    setmultihitcounter

BattleScript_MultiHitLoop::
    movevaluescleanup
    critcalc
    damagecalc
    typecalc
    adjustnormaldamage
    attackanimation
    waitanimation
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
    moveendto MOVEEND_NEXT_TARGET

    @ Decrement counter, loop if more hits
    decrementmultihit BattleScript_MultiHitPrintStrings
    jumpifhasnomorehs BattleScript_MultiHitLoop
    goto BattleScript_MultiHitLoop

BattleScript_MultiHitPrintStrings::
    printstring STRINGID_HITXTIMES         @ "Hit X time(s)!"
    waitmessage B_WAIT_TIME_LONG
    goto BattleScript_MoveEnd
```

## Script Command Implementations

From `src/battle_script_commands.c`:

```c
static void Cmd_attackcanceler(void)
{
    s32 i;

    // Pre-battle checks that can cancel the attack

    // Check if attacker fainted
    if (gBattleMons[gBattlerAttacker].hp == 0) {
        gCurrentActionFuncId = B_ACTION_FINISHED;
        return;
    }

    // Check confusion
    if (gBattleMons[gBattlerAttacker].status2 & STATUS2_CONFUSION) {
        gBattleMons[gBattlerAttacker].status2 -= STATUS2_CONFUSION_TURN(1);
        if (gBattleMons[gBattlerAttacker].status2 & STATUS2_CONFUSION) {
            // Still confused
            if (Random() % 2 == 0) {
                // Hit self
                gBattleCommunication[MULTISTRING_CHOOSER] = B_MSG_HURT_ITSELF;
                gBattlerTarget = gBattlerAttacker;
                gBattleMoveDamage = CalculateConfusionDamage();
                gBattlescriptCurrInstr = BattleScript_ConfusionTurn;
                return;
            }
        } else {
            // Snapped out of confusion
            gBattlescriptCurrInstr = BattleScript_ConfusionEnd;
            return;
        }
    }

    // Check paralysis (25% chance to fail)
    if ((gBattleMons[gBattlerAttacker].status1 & STATUS1_PARALYSIS) &&
        Random() % 4 == 0) {
        gBattlescriptCurrInstr = BattleScript_ParalyzedCantMove;
        return;
    }

    // Check frozen (20% thaw each turn)
    if (gBattleMons[gBattlerAttacker].status1 & STATUS1_FREEZE) {
        if (Random() % 5 == 0) {
            gBattleMons[gBattlerAttacker].status1 &= ~STATUS1_FREEZE;
        } else if (!(gBattleMoves[gCurrentMove].effect == EFFECT_THAW_HIT)) {
            gBattlescriptCurrInstr = BattleScript_Frozen;
            return;
        }
    }

    // Check sleep
    if (gBattleMons[gBattlerAttacker].status1 & STATUS1_SLEEP) {
        gBattleMons[gBattlerAttacker].status1 -= STATUS1_SLEEP_TURN(1);
        if (gBattleMons[gBattlerAttacker].status1 & STATUS1_SLEEP) {
            // Still asleep
            if (gBattleMoves[gCurrentMove].effect != EFFECT_SNORE &&
                gBattleMoves[gCurrentMove].effect != EFFECT_SLEEP_TALK) {
                gBattlescriptCurrInstr = BattleScript_Asleep;
                return;
            }
        } else {
            // Woke up
            gBattlescriptCurrInstr = BattleScript_WokeUp;
            return;
        }
    }

    // Check flinch
    if (gBattleMons[gBattlerAttacker].status2 & STATUS2_FLINCHED) {
        gBattleMons[gBattlerAttacker].status2 &= ~STATUS2_FLINCHED;
        gBattlescriptCurrInstr = BattleScript_Flinched;
        return;
    }

    gBattlescriptCurrInstr++;
}

static void Cmd_accuracycheck(void)
{
    u16 move = T2_READ_16(gBattlescriptCurrInstr + 5);
    u32 accuracy;

    // Moves with 0 accuracy always hit
    if (gBattleMoves[move].accuracy == 0) {
        gBattlescriptCurrInstr += 7;
        return;
    }

    // Lock-On/Mind Reader guarantees hit
    if (gBattleMons[gBattlerAttacker].status3 & STATUS3_ALWAYS_HITS) {
        gBattlescriptCurrInstr += 7;
        return;
    }

    // No Guard guarantees hit
    if (gBattleMons[gBattlerAttacker].ability == ABILITY_NO_GUARD ||
        gBattleMons[gBattlerTarget].ability == ABILITY_NO_GUARD) {
        gBattlescriptCurrInstr += 7;
        return;
    }

    // Calculate accuracy
    accuracy = gBattleMoves[move].accuracy;

    // Apply accuracy/evasion stat stages
    accuracy *= gStatStageRatios[gBattleMons[gBattlerAttacker].statStages[STAT_ACC]][0];
    accuracy /= gStatStageRatios[gBattleMons[gBattlerAttacker].statStages[STAT_ACC]][1];
    accuracy *= gStatStageRatios[gBattleMons[gBattlerTarget].statStages[STAT_EVASION]][1];
    accuracy /= gStatStageRatios[gBattleMons[gBattlerTarget].statStages[STAT_EVASION]][0];

    // Compound Eyes boosts accuracy
    if (gBattleMons[gBattlerAttacker].ability == ABILITY_COMPOUNDEYES)
        accuracy = (accuracy * 130) / 100;

    // Hustle lowers accuracy of physical moves
    if (gBattleMons[gBattlerAttacker].ability == ABILITY_HUSTLE &&
        IS_TYPE_PHYSICAL(gBattleMoves[move].type))
        accuracy = (accuracy * 80) / 100;

    if (Random() % 100 + 1 > accuracy) {
        // Miss
        gMoveResultFlags |= MOVE_RESULT_MISSED;
        gBattlescriptCurrInstr = T1_READ_PTR(gBattlescriptCurrInstr + 1);
    } else {
        // Hit
        gBattlescriptCurrInstr += 7;
    }
}
```

## Script Execution Order

```
┌─────────────────────────────────────────────────────────────┐
│                MOVE EXECUTION PIPELINE                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. attackcanceler                                          │
│     ├─ Check if attacker fainted                            │
│     ├─ Process confusion (may hit self)                     │
│     ├─ Process paralysis (25% fail)                         │
│     ├─ Process freeze (20% thaw or blocked)                 │
│     ├─ Process sleep (tick down or blocked)                 │
│     ├─ Process flinch                                       │
│     └─ Process infatuation (50% immobilized)                │
│                                                             │
│  2. accuracycheck                                           │
│     ├─ Check always-hit conditions                          │
│     ├─ Apply accuracy/evasion stages                        │
│     ├─ Apply ability modifiers                              │
│     └─ Random roll                                          │
│                                                             │
│  3. attackstring + ppreduce                                 │
│     ├─ Display "[Pokemon] used [Move]!"                     │
│     └─ Deduct 1 PP                                          │
│                                                             │
│  4. critcalc + damagecalc + typecalc                        │
│     ├─ Roll for critical hit                                │
│     ├─ Calculate base damage                                │
│     ├─ Apply STAB                                           │
│     └─ Apply type effectiveness                             │
│                                                             │
│  5. adjustnormaldamage                                      │
│     ├─ Apply random factor (85-100%)                        │
│     ├─ Check Endure                                         │
│     └─ Check Focus Sash/Band                                │
│                                                             │
│  6. attackanimation + hitanimation                          │
│     ├─ Play move animation                                  │
│     └─ Play hit reaction                                    │
│                                                             │
│  7. healthbarupdate + datahpupdate                          │
│     ├─ Animate health bar                                   │
│     └─ Update HP value                                      │
│                                                             │
│  8. critmessage + resultmessage                             │
│     ├─ "Critical hit!" (if applicable)                      │
│     └─ "Super effective!" etc.                              │
│                                                             │
│  9. seteffectwithchance                                     │
│     └─ Apply secondary effects                              │
│                                                             │
│  10. tryfaintmon                                            │
│      └─ Check/handle fainting                               │
│                                                             │
│  11. moveendall                                             │
│      └─ Cleanup and prepare for next                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```
