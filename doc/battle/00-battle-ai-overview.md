# Pokemon Emerald Battle AI System - Overview

## Executive Summary

The Pokemon Emerald battle AI system is a sophisticated bytecode-interpreted scripting engine that evaluates moves based on a scoring system. Each move starts with a base score of 100, and various AI scripts add or subtract points based on situational analysis. The highest-scored move is selected, with ties broken randomly.

## Key Components

### 1. Core Files

| File | Purpose | Lines |
|------|---------|-------|
| `src/battle_ai_script_commands.c` | AI engine & command implementations | ~1600 |
| `src/battle_ai_switch_items.c` | Switching & item usage logic | ~945 |
| `data/battle_ai_scripts.s` | AI bytecode scripts | ~3200 |
| `include/constants/battle_ai.h` | AI flags & constants | ~52 |

### 2. Decision Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    BATTLE TURN START                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Is this a TRAINER battle?                           │
│         (BATTLE_TYPE_TRAINER | FIRST_BATTLE | SAFARI | ROAMER)  │
└─────────────────────────────────────────────────────────────────┘
                    │                    │
                   YES                   NO (Wild Pokemon)
                    │                    │
                    ▼                    ▼
┌───────────────────────┐    ┌─────────────────────────────────────┐
│ BattleAI_SetupAIData()│    │  Random() % MAX_MON_MOVES           │
│ BattleAI_ChooseMove() │    │  Select completely random move      │
└───────────────────────┘    └─────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                 FOR EACH AI SCRIPT FLAG                          │
│              (bits 0-31 in trainer's aiFlags)                   │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│              FOR EACH MOVE IN MOVESET                            │
│         Execute script bytecode, adjust move scores             │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│              SELECT HIGHEST SCORED MOVE                          │
│         (Random selection among ties)                           │
└─────────────────────────────────────────────────────────────────┘
```

### 3. AI Script Flags

```c
#define AI_SCRIPT_CHECK_BAD_MOVE        (1 << 0)   // Avoid ineffective moves
#define AI_SCRIPT_TRY_TO_FAINT          (1 << 1)   // Prioritize KO moves
#define AI_SCRIPT_CHECK_VIABILITY       (1 << 2)   // Evaluate move effectiveness
#define AI_SCRIPT_SETUP_FIRST_TURN      (1 << 3)   // Setup moves on turn 0
#define AI_SCRIPT_RISKY                 (1 << 4)   // Use high-risk moves
#define AI_SCRIPT_PREFER_POWER_EXTREMES (1 << 5)   // Prefer strongest/weakest
#define AI_SCRIPT_PREFER_BATON_PASS     (1 << 6)   // Baton Pass strategy
#define AI_SCRIPT_DOUBLE_BATTLE         (1 << 7)   // Double battle awareness
#define AI_SCRIPT_HP_AWARE              (1 << 8)   // HP-based decisions
#define AI_SCRIPT_TRY_SUNNY_DAY_START   (1 << 9)   // Weather setup

// Special flags (bits 29-31)
#define AI_SCRIPT_ROAMING               (1 << 29)  // Roaming Pokemon flee
#define AI_SCRIPT_SAFARI                (1 << 30)  // Safari Zone behavior
#define AI_SCRIPT_FIRST_BATTLE          (1 << 31)  // Tutorial battle
```

### 4. Common AI Configurations

| Trainer Type | AI Flags | Behavior |
|--------------|----------|----------|
| Weak trainers | `CHECK_BAD_MOVE` | Only avoids obviously bad moves |
| Medium trainers | `CHECK_BAD_MOVE \| TRY_TO_FAINT \| CHECK_VIABILITY` | Smart move selection |
| Gym Leaders | Same as medium | Standard competitive |
| Frontier | `CHECK_BAD_MOVE \| CHECK_VIABILITY \| TRY_TO_FAINT` | Maximum difficulty |
| Wild Pokemon | 0 (no AI) | Completely random |

### 5. Scoring System

- **Base score**: 100 for each usable move
- **Score adjustments**: Range from -30 to +10 typically
- **Minimum score**: 0 (cannot go negative)
- **Random factor**: `simulatedRNG[i] = 100 - (Random() % 16)` provides variance

### 6. Critical Finding: Wild vs Trainer

**Wild Pokemon use NO AI at all!**

```c
// From battle_controller_opponent.c:1594-1611
// Wild Pokemon branch:
u16 move;
do {
    chosenMoveId = MOD(Random(), MAX_MON_MOVES);
    move = moveInfo->moves[chosenMoveId];
} while (move == MOVE_NONE);
```

This means:
- Wild Pokemon select moves purely at random
- They don't consider type effectiveness
- They don't avoid bad moves
- They don't prioritize KO moves

## Quick Reference

### Type Effectiveness Values
```c
#define AI_EFFECTIVENESS_x4     160
#define AI_EFFECTIVENESS_x2     80
#define AI_EFFECTIVENESS_x1     40
#define AI_EFFECTIVENESS_x0_5   20
#define AI_EFFECTIVENESS_x0_25  10
#define AI_EFFECTIVENESS_x0     0
```

### Common Score Adjustments
- **Score -10**: Move is completely useless (immunity, already max stat, etc.)
- **Score -8**: Move is highly discouraged
- **Score -5**: Move is moderately discouraged
- **Score -2/-3**: Minor discouragement
- **Score +2/+3**: Minor encouragement
- **Score +4**: Strong encouragement (can faint target)
- **Score +5/+10**: Very strong encouragement

## Documentation Index

1. [AI Architecture](./01-ai-architecture.md) - Technical deep dive
2. [Move Selection & Scoring](./02-move-selection-scoring.md) - Scoring system details
3. [Trainer vs Wild](./03-trainer-vs-wild.md) - Behavioral differences
4. [AI Scripts Reference](./04-ai-scripts-reference.md) - Complete script documentation
5. [Switch & Item Logic](./05-switch-item-logic.md) - Switching/item decisions
6. [React Implementation](./06-react-implementation.md) - Implementation guide
7. [AI Enhancements](./07-ai-enhancements.md) - Proposed improvements
