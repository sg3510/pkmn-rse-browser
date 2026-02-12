---
title: AI Scripts Reference
status: reference
written_on: 2025-11-26
last_verified: 2026-01-13
---

# AI Scripts Reference

## Script Table

All scripts are stored in `data/battle_ai_scripts.s` and referenced via `gBattleAI_ScriptsTable`:

```assembly
gBattleAI_ScriptsTable::
    .4byte AI_CheckBadMove          @ Bit 0 - AI_SCRIPT_CHECK_BAD_MOVE
    .4byte AI_TryToFaint            @ Bit 1 - AI_SCRIPT_TRY_TO_FAINT
    .4byte AI_CheckViability        @ Bit 2 - AI_SCRIPT_CHECK_VIABILITY
    .4byte AI_SetupFirstTurn        @ Bit 3 - AI_SCRIPT_SETUP_FIRST_TURN
    .4byte AI_Risky                 @ Bit 4 - AI_SCRIPT_RISKY
    .4byte AI_PreferPowerExtremes   @ Bit 5 - AI_SCRIPT_PREFER_POWER_EXTREMES
    .4byte AI_PreferBatonPass       @ Bit 6 - AI_SCRIPT_PREFER_BATON_PASS
    .4byte AI_DoubleBattle          @ Bit 7 - AI_SCRIPT_DOUBLE_BATTLE
    .4byte AI_HPAware               @ Bit 8 - AI_SCRIPT_HP_AWARE
    .4byte AI_TrySunnyDayStart      @ Bit 9 - AI_SCRIPT_TRY_SUNNY_DAY_START
    @ Bits 10-28 unused (AI_Ret)
    .4byte AI_Roaming               @ Bit 29 - AI_SCRIPT_ROAMING
    .4byte AI_Safari                @ Bit 30 - AI_SCRIPT_SAFARI
    .4byte AI_FirstBattle           @ Bit 31 - AI_SCRIPT_FIRST_BATTLE
```

## Script Commands Reference

### Conditional Commands

| Command | Opcode | Parameters | Description |
|---------|--------|------------|-------------|
| `if_random_less_than` | 0x00 | threshold, ptr | Jump if Random()%256 < threshold |
| `if_random_greater_than` | 0x01 | threshold, ptr | Jump if Random()%256 > threshold |
| `if_hp_less_than` | 0x05 | battler, hp%, ptr | Jump if HP% < threshold |
| `if_hp_more_than` | 0x06 | battler, hp%, ptr | Jump if HP% > threshold |
| `if_status` | 0x09 | battler, status, ptr | Jump if has status |
| `if_not_status` | 0x0A | battler, status, ptr | Jump if doesn't have status |
| `if_status2` | 0x0B | battler, status2, ptr | Jump if has status2 |
| `if_status3` | 0x0D | battler, status3, ptr | Jump if has status3 |
| `if_side_affecting` | 0x0F | battler, flags, ptr | Jump if side has flags |
| `if_less_than` | 0x11 | value, ptr | Jump if funcResult < value |
| `if_more_than` | 0x12 | value, ptr | Jump if funcResult > value |
| `if_equal` | 0x13 | value, ptr | Jump if funcResult == value |
| `if_not_equal` | 0x14 | value, ptr | Jump if funcResult != value |
| `if_move` | 0x19 | move_id, ptr | Jump if considering this move |
| `if_not_move` | 0x1A | move_id, ptr | Jump if not considering this move |
| `if_in_bytes` | 0x1B | table_ptr, ptr | Jump if funcResult in byte table |
| `if_not_in_bytes` | 0x1C | table_ptr, ptr | Jump if funcResult not in table |
| `if_in_hwords` | 0x1D | table_ptr, ptr | Jump if funcResult in halfword table |
| `if_user_goes` | 0x28 | order, ptr | Jump based on turn order |
| `if_type_effectiveness` | 0x31 | effectiveness, ptr | Jump based on type effectiveness |
| `if_stat_level_less_than` | 0x39 | battler, stat, level, ptr | Jump if stat stage < level |
| `if_stat_level_more_than` | 0x3A | battler, stat, level, ptr | Jump if stat stage > level |
| `if_can_faint` | 0x3D | ptr | Jump if move can faint target |
| `if_cant_faint` | 0x3E | ptr | Jump if move cannot faint target |
| `if_has_move` | 0x3F | battler, move_id, ptr | Jump if battler knows move |
| `if_has_move_with_effect` | 0x41 | battler, effect, ptr | Jump if has move with effect |
| `if_any_move_disabled` | 0x43 | battler, ptr | Jump if any move disabled/encored |
| `if_effect` | 0x37 | effect, ptr | Jump if move has this effect |
| `if_not_effect` | 0x38 | effect, ptr | Jump if move doesn't have effect |
| `if_target_taunted` | 0x5C | ptr | Jump if target is taunted |
| `if_target_is_ally` | 0x5E | ptr | Jump if targeting ally (doubles) |
| `if_flash_fired` | 0x61 | battler, ptr | Jump if Flash Fire activated |
| `if_holds_item` | 0x62 | battler, item, ptr | Jump if holding item |

### Data Retrieval Commands

| Command | Opcode | Parameters | Description |
|---------|--------|------------|-------------|
| `get_turn_count` | 0x21 | - | Store turn count in funcResult |
| `get_type` | 0x22 | selector | Get type (user1, user2, target1, target2, move) |
| `get_considered_move_power` | 0x23 | - | Get current move's power |
| `get_how_powerful_move_is` | 0x24 | - | Compare to strongest move |
| `get_last_used_battler_move` | 0x25 | battler | Get last move used by battler |
| `get_considered_move` | 0x2D | - | Get current move ID |
| `get_considered_move_effect` | 0x2E | - | Get current move's effect |
| `get_ability` | 0x2F | battler | Get battler's ability |
| `get_highest_type_effectiveness` | 0x30 | - | Get best effectiveness |
| `get_weather` | 0x36 | - | Get current weather |
| `get_hold_effect` | 0x48 | battler | Get held item effect |
| `get_gender` | 0x49 | battler | Get gender |
| `get_stockpile_count` | 0x4B | battler | Get Stockpile count |
| `get_used_held_item` | 0x4D | battler | Get previously held item |
| `get_protect_count` | 0x51 | battler | Get consecutive Protect uses |

### Score & Action Commands

| Command | Opcode | Parameters | Description |
|---------|--------|------------|-------------|
| `score` | 0x04 | adjustment | Add to current move's score (signed) |
| `flee` | 0x45 | - | Set AI_ACTION_FLEE |
| `watch` | 0x47 | - | Set AI_ACTION_WATCH |

### Flow Control Commands

| Command | Opcode | Parameters | Description |
|---------|--------|------------|-------------|
| `call` | 0x58 | ptr | Call subroutine |
| `goto` | 0x59 | ptr | Unconditional jump |
| `end` | 0x5A | - | End script for current move |

### Utility Commands

| Command | Opcode | Parameters | Description |
|---------|--------|------------|-------------|
| `count_usable_party_mons` | 0x2C | battler | Count remaining party Pokemon |
| `is_first_turn_for` | 0x4A | battler | Check if first turn |
| `is_double_battle` | 0x4C | - | Check if double battle |
| `if_level_cond` | 0x5B | comparison, ptr | Compare levels |
| `check_ability` | 0x60 | side, ability, ptr | Check if ability on field |
| `is_of_type` | 0x5F | battler, type, ptr | Check if battler has type |

## Battler Constants

```c
#define AI_TARGET         0  // The target of the move
#define AI_USER           1  // The AI's Pokemon
#define AI_TARGET_PARTNER 2  // Target's partner (doubles)
#define AI_USER_PARTNER   3  // AI's partner (doubles)
```

## Type Effectiveness Values

```c
#define AI_EFFECTIVENESS_x4     160  // Super effective x2 twice
#define AI_EFFECTIVENESS_x2     80   // Super effective
#define AI_EFFECTIVENESS_x1     40   // Normal effectiveness
#define AI_EFFECTIVENESS_x0_5   20   // Not very effective
#define AI_EFFECTIVENESS_x0_25  10   // Not very effective x2
#define AI_EFFECTIVENESS_x0     0    // Immune
```

## Move Power Classification

```c
#define MOVE_POWER_OTHER        0  // Power <= 1 or special effect
#define MOVE_NOT_MOST_POWERFUL  1  // Not the strongest attacking move
#define MOVE_MOST_POWERFUL      2  // Strongest attacking move
```

## Weather Constants

```c
#define AI_WEATHER_SUN       0
#define AI_WEATHER_RAIN      1
#define AI_WEATHER_SANDSTORM 2
#define AI_WEATHER_HAIL      3
```

## Complete Script: AI_CheckBadMove

```assembly
AI_CheckBadMove:
    if_target_is_ally AI_Ret                    @ Don't attack ally
    if_move MOVE_FISSURE, AI_CBM_CheckIfNegatesType
    if_move MOVE_HORN_DRILL, AI_CBM_CheckIfNegatesType
    get_how_powerful_move_is
    if_equal MOVE_POWER_OTHER, AI_CheckBadMove_CheckSoundproof

AI_CBM_CheckIfNegatesType:
    @ Check type immunity
    if_type_effectiveness AI_EFFECTIVENESS_x0, Score_Minus10

    @ Check ability immunity
    get_ability AI_TARGET
    if_equal ABILITY_VOLT_ABSORB, CheckIfVoltAbsorbCancelsElectric
    if_equal ABILITY_WATER_ABSORB, CheckIfWaterAbsorbCancelsWater
    if_equal ABILITY_FLASH_FIRE, CheckIfFlashFireCancelsFire
    if_equal ABILITY_WONDER_GUARD, CheckIfWonderGuardCancelsMove
    if_equal ABILITY_LEVITATE, CheckIfLevitateCancelsGroundMove
    goto AI_CheckBadMove_CheckSoundproof_

CheckIfVoltAbsorbCancelsElectric:
    get_curr_move_type
    if_equal_ TYPE_ELECTRIC, Score_Minus12
    goto AI_CheckBadMove_CheckSoundproof_

@ ... continues for each effect type ...
```

## Complete Script: AI_TryToFaint

```assembly
AI_TryToFaint:
    if_target_is_ally AI_Ret
    if_can_faint AI_TryToFaint_TryToEncourageQuickAttack
    get_how_powerful_move_is
    if_equal MOVE_NOT_MOST_POWERFUL, Score_Minus1
    if_type_effectiveness AI_EFFECTIVENESS_x4, AI_TryToFaint_DoubleSuperEffective
    end

AI_TryToFaint_DoubleSuperEffective:
    if_random_less_than 80, AI_TryToFaint_End
    score +2
    end

AI_TryToFaint_TryToEncourageQuickAttack:
    if_effect EFFECT_EXPLOSION, AI_TryToFaint_End
    if_not_effect EFFECT_QUICK_ATTACK, AI_TryToFaint_ScoreUp4
    score +2
AI_TryToFaint_ScoreUp4:
    score +4
AI_TryToFaint_End:
    end
```

## Score Labels (Common Jumps)

```assembly
Score_Minus1:   score -1    end
Score_Minus2:   score -2    end
Score_Minus3:   score -3    end
Score_Minus5:   score -5    end
Score_Minus8:   score -8    end
Score_Minus10:  score -10   end
Score_Minus12:  score -12   end
Score_Minus30:  score -30   end

Score_Plus1:    score +1    end
Score_Plus2:    score +2    end
Score_Plus3:    score +3    end
Score_Plus5:    score +5    end
Score_Plus10:   score +10   end
```

## Known Bugs in Vanilla AI Scripts

1. **Counter/Mirror Coat Type Check**: Scripts check if target is physical/special type instead of if their last move was physical/special

2. **Foresight Target Check**: Checks user's type instead of target's type for Ghost immunity

3. **Facade Check**: Checks target's status instead of user's status

4. **Semi-Invulnerable Weather**: Hail and Sandstorm resistance checks are swapped

5. **GetMostSuitableMonToSwitchInto**: Bug prefers Pokemon that take MORE damage from opponent

These bugs are marked with `#ifdef BUGFIX` in the decomp source.
