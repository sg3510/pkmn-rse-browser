---
title: Battle AI Architecture
status: reference
last_verified: 2026-01-13
---

# Battle AI Architecture

## System Architecture

### High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           BATTLE CONTROLLER                                 │
│                     (battle_controller_opponent.c)                         │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                         AI_TrySwitchOrUseItem()                            │
│                       (battle_ai_switch_items.c)                           │
│                                                                            │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐ │
│  │  ShouldSwitch()  │  │  ShouldUseItem() │  │ GetMostSuitableMonTo...  │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                    If not switching/using item
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                         BattleAI_ChooseMoveOrAction()                      │
│                       (battle_ai_script_commands.c)                        │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                          BattleAI_SetupAIData()                            │
│                                                                            │
│  1. Clear AI_ThinkingStruct                                                │
│  2. Set initial scores (100 for valid moves, 0 for invalid)                │
│  3. Check move limitations (PP, disabled, etc.)                            │
│  4. Set aiFlags based on battle type                                       │
│  5. Initialize simulatedRNG for each move                                  │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                     ChooseMoveOrAction_Singles/Doubles()                   │
│                                                                            │
│  FOR each bit set in aiFlags:                                              │
│      BattleAI_DoAIProcessing()                                             │
│          │                                                                 │
│          ▼                                                                 │
│      FOR each move in moveset:                                             │
│          Set gAIScriptPtr to script table entry                            │
│          Execute bytecode commands                                         │
│          Adjust score[moveIndex]                                           │
│                                                                            │
│  Find highest scored moves                                                 │
│  Return random selection among ties                                        │
└────────────────────────────────────────────────────────────────────────────┘
```

## Core Data Structures

### AI_ThinkingStruct

```c
struct AI_ThinkingStruct {
    u8 aiState;                    // Current processing state
    u8 movesetIndex;               // Current move being evaluated (0-3)
    u16 moveConsidered;            // Move ID being considered
    s8 score[MAX_MON_MOVES];       // Score for each move (max 4)
    u32 funcResult;                // Temporary storage for script results
    u32 aiFlags;                   // Active AI script flags
    u8 aiAction;                   // Special actions (flee, watch, etc.)
    u8 aiLogicId;                  // Current AI script index (0-31)
    u8 simulatedRNG[MAX_MON_MOVES]; // Random variance per move
};
```

### AI States

```c
enum {
    AIState_SettingUp,        // Initialize script pointer for current move
    AIState_Processing,       // Execute bytecode commands
    AIState_FinishedProcessing, // Done with all moves for this script
    AIState_DoNotProcess      // Skip processing
};
```

### AI Actions

```c
#define AI_ACTION_DONE          (1 << 0)  // Move evaluation complete
#define AI_ACTION_FLEE          (1 << 1)  // AI chooses to flee
#define AI_ACTION_WATCH         (1 << 2)  // AI chooses to watch (Safari)
#define AI_ACTION_DO_NOT_ATTACK (1 << 3)  // Don't use attacking moves
```

### BattleHistory

```c
struct BattleHistory {
    struct UsedMoves usedMoves[MAX_BATTLERS_COUNT];  // Tracks moves used
    u8 abilities[MAX_BATTLERS_COUNT];                // Observed abilities
    u8 itemEffects[MAX_BATTLERS_COUNT];              // Observed item effects
    u16 trainerItems[MAX_BATTLERS_COUNT];            // Trainer's items
    u8 itemsNo;                                      // Number of items
};

struct UsedMoves {
    u16 moves[MAX_MON_MOVES];  // Up to 4 moves tracked per battler
};
```

## Bytecode Script Engine

### Script Command Format

Each command is a single byte opcode followed by variable-length parameters:

```
┌──────────┬───────────────────────────────────────────┐
│ Byte 0   │ Command opcode (0x00 - 0x62)              │
├──────────┼───────────────────────────────────────────┤
│ Byte 1+  │ Parameters (varies by command)            │
└──────────┴───────────────────────────────────────────┘
```

### Command Table (Key Commands)

| Opcode | Command | Parameters | Description |
|--------|---------|------------|-------------|
| 0x00 | `if_random_less_than` | threshold (1), ptr (4) | Jump if Random() < threshold |
| 0x04 | `score` | adjustment (1, signed) | Add/subtract from current move score |
| 0x05 | `if_hp_less_than` | battler (1), hp% (1), ptr (4) | Jump if HP below threshold |
| 0x09 | `if_status` | battler (1), status (4), ptr (4) | Jump if status condition |
| 0x21 | `get_turn_count` | - | Store turn count in funcResult |
| 0x22 | `get_type` | type_selector (1) | Get Pokemon type |
| 0x24 | `get_how_powerful_move_is` | - | Compare to strongest move |
| 0x2F | `get_ability` | battler (1) | Get ability to funcResult |
| 0x31 | `if_type_effectiveness` | effectiveness (1), ptr (4) | Check type effectiveness |
| 0x3D | `if_can_faint` | ptr (4) | Jump if move can KO target |
| 0x45 | `flee` | - | Set AI_ACTION_FLEE |
| 0x58 | `call` | ptr (4) | Call subroutine |
| 0x59 | `goto` | ptr (4) | Unconditional jump |
| 0x5A | `end` | - | End script for current move |

### Script Execution Flow

```c
static void BattleAI_DoAIProcessing(void)
{
    while (AI_THINKING_STRUCT->aiState != AIState_FinishedProcessing)
    {
        switch (AI_THINKING_STRUCT->aiState)
        {
            case AIState_SettingUp:
                // Set script pointer from table
                gAIScriptPtr = gBattleAI_ScriptsTable[AI_THINKING_STRUCT->aiLogicId];

                // Set current move being considered
                if (gBattleMons[sBattler_AI].pp[movesetIndex] == 0)
                    AI_THINKING_STRUCT->moveConsidered = 0;
                else
                    AI_THINKING_STRUCT->moveConsidered = gBattleMons[sBattler_AI].moves[movesetIndex];

                AI_THINKING_STRUCT->aiState++;
                break;

            case AIState_Processing:
                if (AI_THINKING_STRUCT->moveConsidered != 0)
                {
                    // Execute command at current script pointer
                    sBattleAICmdTable[*gAIScriptPtr]();
                }
                else
                {
                    // No PP - score 0
                    AI_THINKING_STRUCT->score[movesetIndex] = 0;
                    AI_THINKING_STRUCT->aiAction |= AI_ACTION_DONE;
                }

                if (AI_THINKING_STRUCT->aiAction & AI_ACTION_DONE)
                {
                    // Move to next move
                    AI_THINKING_STRUCT->movesetIndex++;
                    if (movesetIndex < MAX_MON_MOVES)
                        AI_THINKING_STRUCT->aiState = AIState_SettingUp;
                    else
                        AI_THINKING_STRUCT->aiState++;
                }
                break;
        }
    }
}
```

## AI Flag Selection Logic

```c
void BattleAI_SetupAIData(u8 defaultScoreMoves)
{
    // ... initialization ...

    // Choose AI flags based on battle type
    if (gBattleTypeFlags & BATTLE_TYPE_RECORDED)
        AI_THINKING_STRUCT->aiFlags = GetAiScriptsInRecordedBattle();
    else if (gBattleTypeFlags & BATTLE_TYPE_SAFARI)
        AI_THINKING_STRUCT->aiFlags = AI_SCRIPT_SAFARI;
    else if (gBattleTypeFlags & BATTLE_TYPE_ROAMER)
        AI_THINKING_STRUCT->aiFlags = AI_SCRIPT_ROAMING;
    else if (gBattleTypeFlags & BATTLE_TYPE_FIRST_BATTLE)
        AI_THINKING_STRUCT->aiFlags = AI_SCRIPT_FIRST_BATTLE;
    else if (gBattleTypeFlags & BATTLE_TYPE_FACTORY)
        AI_THINKING_STRUCT->aiFlags = GetAiScriptsInBattleFactory();
    else if (gBattleTypeFlags & (BATTLE_TYPE_FRONTIER | ...))
        AI_THINKING_STRUCT->aiFlags = AI_SCRIPT_CHECK_BAD_MOVE |
                                       AI_SCRIPT_CHECK_VIABILITY |
                                       AI_SCRIPT_TRY_TO_FAINT;
    else if (gBattleTypeFlags & BATTLE_TYPE_TWO_OPPONENTS)
        AI_THINKING_STRUCT->aiFlags = gTrainers[A].aiFlags | gTrainers[B].aiFlags;
    else
        AI_THINKING_STRUCT->aiFlags = gTrainers[gTrainerBattleOpponent_A].aiFlags;

    // Double battles always get double battle awareness
    if (gBattleTypeFlags & BATTLE_TYPE_DOUBLE)
        AI_THINKING_STRUCT->aiFlags |= AI_SCRIPT_DOUBLE_BATTLE;
}
```

## Move Selection Algorithm

### Singles

```c
static u8 ChooseMoveOrAction_Singles(void)
{
    // Record opponent's last move for learning
    RecordLastUsedMoveByTarget();

    // Run all enabled AI scripts
    while (AI_THINKING_STRUCT->aiFlags != 0)
    {
        if (AI_THINKING_STRUCT->aiFlags & 1)
        {
            AI_THINKING_STRUCT->aiState = AIState_SettingUp;
            BattleAI_DoAIProcessing();
        }
        AI_THINKING_STRUCT->aiFlags >>= 1;
        AI_THINKING_STRUCT->aiLogicId++;
        AI_THINKING_STRUCT->movesetIndex = 0;
    }

    // Handle special actions
    if (AI_THINKING_STRUCT->aiAction & AI_ACTION_FLEE)
        return AI_CHOICE_FLEE;
    if (AI_THINKING_STRUCT->aiAction & AI_ACTION_WATCH)
        return AI_CHOICE_WATCH;

    // Find best moves
    numOfBestMoves = 1;
    currentMoveArray[0] = AI_THINKING_STRUCT->score[0];
    consideredMoveArray[0] = 0;

    for (i = 1; i < MAX_MON_MOVES; i++)
    {
        if (gBattleMons[sBattler_AI].moves[i] != MOVE_NONE)
        {
            if (currentMoveArray[0] == AI_THINKING_STRUCT->score[i])
            {
                // Tie - add to candidates
                consideredMoveArray[numOfBestMoves++] = i;
            }
            if (currentMoveArray[0] < AI_THINKING_STRUCT->score[i])
            {
                // New best - reset candidates
                numOfBestMoves = 1;
                currentMoveArray[0] = AI_THINKING_STRUCT->score[i];
                consideredMoveArray[0] = i;
            }
        }
    }

    // Random selection among tied best moves
    return consideredMoveArray[Random() % numOfBestMoves];
}
```

### Doubles

In doubles, the AI evaluates all moves against all possible targets (including partner), then selects the best target/move combination.

Key differences:
1. Evaluates each target separately
2. Scores moves against ally at -30 by default
3. Considers partner synergies (Helping Hand, etc.)
4. Can target partner with beneficial moves

## Source File Reference

### battle_ai_script_commands.c

| Lines | Content |
|-------|---------|
| 1-25 | Includes and defines |
| 27-34 | AI state enum |
| 44-261 | Command function declarations and table |
| 263-281 | Ignored move effects for power calculation |
| 283-380 | BattleAI_SetupAIData() |
| 382-445 | ChooseMoveOrAction_Singles() |
| 448-570 | ChooseMoveOrAction_Doubles() |
| 572-616 | BattleAI_DoAIProcessing() |
| 618-661 | Move history recording |
| 663+ | Individual command implementations |

### battle_ai_switch_items.c

| Lines | Content |
|-------|---------|
| 20-33 | ShouldSwitchIfPerishSong() |
| 35-117 | ShouldSwitchIfWonderGuard() |
| 119-216 | FindMonThatAbsorbsOpponentsMove() |
| 218-256 | ShouldSwitchIfNaturalCure() |
| 258-312 | HasSuperEffectiveMoveAgainstOpponents() |
| 314-326 | AreStatsRaised() |
| 328-427 | FindMonWithFlagsAndSuperEffective() |
| 429-526 | ShouldSwitch() |
| 528-603 | AI_TrySwitchOrUseItem() |
| 605-627 | ModulateByTypeEffectiveness() |
| 629-790 | GetMostSuitableMonToSwitchInto() |
| 792-944 | ShouldUseItem() |
