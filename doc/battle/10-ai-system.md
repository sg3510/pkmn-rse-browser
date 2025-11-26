# Battle AI System

The trainer AI uses a score-based system with bytecode scripts to choose moves.

## AI Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      AI Decision Flow                        │
├─────────────────────────────────────────────────────────────┤
│  1. Initialize scores (100 for each move)                   │
│  2. Run AI scripts based on AI flags                        │
│  3. Adjust scores based on conditions                       │
│  4. Select move with highest score                          │
│  5. Consider switching if score too low                     │
└─────────────────────────────────────────────────────────────┘
```

## AI Thinking Structure

```c
struct AI_ThinkingStruct {
    u8 aiState;
    u8 movesetIndex;         // Current move being evaluated
    u16 moveConsidered;      // The move ID
    s8 score[MAX_MON_MOVES]; // Score for each move (starts at 100)
    u32 funcResult;          // Result from AI functions
    u32 aiFlags;             // Which AI scripts to run
    u8 aiAction;             // Final action decision
    u8 aiLogicId;            // Current AI script
    u8 filler12[6];
    u8 simulatedRNG[MAX_MON_MOVES]; // Predicted random values
};
```

## AI Flags

Trainers can have multiple AI flags that run different evaluation scripts:

```c
// From constants/battle_ai.h
#define AI_FLAG_CHECK_BAD_MOVE       (1 << 0)  // Avoid ineffective moves
#define AI_FLAG_TRY_TO_FAINT         (1 << 1)  // Prioritize KO moves
#define AI_FLAG_CHECK_VIABILITY      (1 << 2)  // Consider move effects
#define AI_FLAG_SETUP_FIRST_TURN     (1 << 3)  // Use setup moves early
#define AI_FLAG_RISKY                (1 << 4)  // Take risky plays
#define AI_FLAG_PREFER_STRONGEST_MOVE (1 << 5) // Highest damage first
#define AI_FLAG_PREFER_BATON_PASS    (1 << 6)  // Prefer Baton Pass
#define AI_FLAG_DOUBLE_BATTLE        (1 << 7)  // Double battle logic
#define AI_FLAG_HP_AWARE             (1 << 8)  // Consider HP levels
#define AI_FLAG_NEGATE_UNAWARE       (1 << 9)  // Ignore Unaware
#define AI_FLAG_WILL_SUICIDE         (1 << 10) // Use Explosion etc.
#define AI_FLAG_HELP_PARTNER         (1 << 11) // Help ally in doubles
// ... more flags
```

## AI Script Commands

The AI uses bytecode scripts with these commands:

```c
// Command table (92 commands, 0x00 - 0x62)
static const BattleAICmdFunc sBattleAICmdTable[] = {
    // Random checks
    Cmd_if_random_less_than,      // 0x00 - Random chance
    Cmd_if_random_greater_than,   // 0x01
    Cmd_if_random_equal,          // 0x02
    Cmd_if_random_not_equal,      // 0x03

    // Score modification
    Cmd_score,                    // 0x04 - Adjust move score

    // HP checks
    Cmd_if_hp_less_than,          // 0x05 - Check HP percentage
    Cmd_if_hp_more_than,          // 0x06
    Cmd_if_hp_equal,              // 0x07
    Cmd_if_hp_not_equal,          // 0x08

    // Status checks
    Cmd_if_status,                // 0x09 - Check status1
    Cmd_if_not_status,            // 0x0A
    Cmd_if_status2,               // 0x0B - Check status2
    Cmd_if_not_status2,           // 0x0C
    Cmd_if_status3,               // 0x0D - Check status3
    Cmd_if_not_status3,           // 0x0E

    // Side conditions
    Cmd_if_side_affecting,        // 0x0F - Reflect, Light Screen, etc.
    Cmd_if_not_side_affecting,    // 0x10

    // Comparisons
    Cmd_if_less_than,             // 0x11
    Cmd_if_more_than,             // 0x12
    Cmd_if_equal,                 // 0x13
    Cmd_if_not_equal,             // 0x14

    // Move checks
    Cmd_if_move,                  // 0x19
    Cmd_if_not_move,              // 0x1A
    Cmd_if_user_has_attacking_move,    // 0x1F
    Cmd_if_user_has_no_attacking_moves,// 0x20

    // Information getters
    Cmd_get_turn_count,           // 0x21
    Cmd_get_type,                 // 0x22 - Get Pokemon type
    Cmd_get_considered_move_power,// 0x23
    Cmd_get_how_powerful_move_is, // 0x24
    Cmd_get_ability,              // 0x2F
    Cmd_get_highest_type_effectiveness, // 0x30
    Cmd_get_weather,              // 0x36

    // Stat checks
    Cmd_if_stat_level_less_than,  // 0x39
    Cmd_if_stat_level_more_than,  // 0x3A
    Cmd_if_stat_level_equal,      // 0x3B

    // Damage prediction
    Cmd_if_can_faint,             // 0x3D - Can KO opponent
    Cmd_if_cant_faint,            // 0x3E

    // Move knowledge
    Cmd_if_has_move,              // 0x3F
    Cmd_if_doesnt_have_move,      // 0x40
    Cmd_if_has_move_with_effect,  // 0x41

    // Safari zone
    Cmd_flee,                     // 0x45
    Cmd_if_random_safari_flee,    // 0x46
    Cmd_watch,                    // 0x47

    // Control flow
    Cmd_call,                     // 0x58
    Cmd_goto,                     // 0x59
    Cmd_end,                      // 0x5A
};
```

## Score Modification

Moves start at score 100. AI scripts adjust scores:

```c
// Score command modifies move's viability
static void Cmd_score(void) {
    AI_THINKING_STRUCT->score[AI_THINKING_STRUCT->movesetIndex] +=
        gAIScriptPtr[1]; // Add/subtract from score
    gAIScriptPtr += 2;
}

// Example score adjustments:
// +10 to +30: Encourage this move
// -10 to -30: Discourage this move
// -100: Never use this move
```

## AI Decision Examples

### Avoid Bad Moves (AI_FLAG_CHECK_BAD_MOVE)

```
if target is immune to move type:
    score -= 100  // Don't use
if move has no effect (Dream Eater on non-sleeping):
    score -= 100
if weather cancels move (Fire in rain):
    score -= 50
```

### Try to Faint (AI_FLAG_TRY_TO_FAINT)

```
if move can KO target:
    score += 20
if we're faster and can KO:
    score += 30
if target can KO us:
    prefer fastest KO move
```

### Check Viability (AI_FLAG_CHECK_VIABILITY)

```
if move boosts stats already maxed:
    score -= 100
if move lowers stats already minimized:
    score -= 100
if healing at full HP:
    score -= 100
if setting up weather that's already active:
    score -= 50
```

## Move Selection Flow

```c
u8 ChooseMoveOrAction_Singles(void) {
    u8 currentMoveArray[MAX_MON_MOVES];
    u8 consideredMoveArray[MAX_MON_MOVES];
    u8 numOfBestMoves;
    s32 i;

    // Initialize scores to 100
    for (i = 0; i < MAX_MON_MOVES; i++)
        AI_THINKING_STRUCT->score[i] = 100;

    // Run all enabled AI scripts
    BattleAI_DoAIProcessing();

    // Find best scoring moves
    numOfBestMoves = 1;
    currentMoveArray[0] = 0;
    consideredMoveArray[0] = AI_THINKING_STRUCT->score[0];

    for (i = 1; i < MAX_MON_MOVES; i++) {
        if (IsValidMove(move)) {
            if (AI_THINKING_STRUCT->score[i] > consideredMoveArray[0]) {
                // New best move found
                numOfBestMoves = 1;
                currentMoveArray[0] = i;
                consideredMoveArray[0] = AI_THINKING_STRUCT->score[i];
            } else if (AI_THINKING_STRUCT->score[i] == consideredMoveArray[0]) {
                // Tied score - add to array
                currentMoveArray[numOfBestMoves] = i;
                numOfBestMoves++;
            }
        }
    }

    // Randomly select among tied moves
    return currentMoveArray[Random() % numOfBestMoves];
}
```

## Switching Logic

From `battle_ai_switch_items.c`:

```c
bool8 ShouldSwitch(void) {
    // Consider switching if:
    // 1. Current Pokemon severely disadvantaged
    // 2. Have a Pokemon with type advantage
    // 3. Current Pokemon has very low HP
    // 4. Trapped status is not active

    if (IsTrapped())
        return FALSE;

    // Calculate best switch candidate
    // Compare to current Pokemon's situation
    // Switch if improvement is significant
}
```

## Battle History

The AI tracks battle history for informed decisions:

```c
struct BattleHistory {
    u16 usedMoves[MAX_BATTLERS_COUNT][MAX_MON_MOVES]; // Moves seen
    u8 abilities[MAX_BATTLERS_COUNT];                  // Known abilities
    u8 itemEffects[MAX_BATTLERS_COUNT];               // Known items
    u16 trainerItems[MAX_BATTLERS_COUNT];             // Used items
    u8 itemsNo;                                        // Item count
};
```

## Ignored Move Effects

Certain powerful moves are deprioritized in damage calculations:

```c
static const u16 sIgnoredPowerfulMoveEffects[] = {
    EFFECT_EXPLOSION,     // Self-KO moves
    EFFECT_DREAM_EATER,   // Requires sleeping target
    EFFECT_RAZOR_WIND,    // Two-turn moves
    EFFECT_SKY_ATTACK,
    EFFECT_RECHARGE,      // Hyper Beam recharge
    EFFECT_SKULL_BASH,
    EFFECT_SOLAR_BEAM,
    EFFECT_SPIT_UP,       // Requires Stockpile
    EFFECT_FOCUS_PUNCH,   // Can be interrupted
    EFFECT_SUPERPOWER,    // Stat-lowering
    EFFECT_ERUPTION,      // HP-dependent
    EFFECT_OVERHEAT,      // Stat-lowering
};
```

## React Implementation

```tsx
interface AIConfig {
  flags: number;          // AI_FLAG_* bitmask
  level: 'easy' | 'medium' | 'hard';
}

interface MoveScore {
  moveIndex: number;
  score: number;
  reasons: string[];      // For debugging
}

function calculateAIMove(
  battle: BattleState,
  aiConfig: AIConfig
): number {
  const scores: MoveScore[] = [];

  for (let i = 0; i < 4; i++) {
    const move = battle.enemy.moves[i];
    if (!move) continue;

    let score = 100;
    const reasons: string[] = [];

    // Check type effectiveness
    const effectiveness = getTypeEffectiveness(
      move.type,
      battle.player.pokemon.types
    );

    if (effectiveness === 0) {
      score -= 100;
      reasons.push('Immune');
    } else if (effectiveness < 1) {
      score -= 20;
      reasons.push('Not very effective');
    } else if (effectiveness > 1) {
      score += 20;
      reasons.push('Super effective');
    }

    // Check if can faint
    if (aiConfig.flags & AI_FLAG_TRY_TO_FAINT) {
      const damage = calculateDamage(battle, move);
      if (damage >= battle.player.pokemon.hp) {
        score += 30;
        reasons.push('Can KO');
      }
    }

    // Check move viability
    if (aiConfig.flags & AI_FLAG_CHECK_VIABILITY) {
      // Status moves on already-statused Pokemon
      if (move.effect === EFFECT_POISON && battle.player.pokemon.status) {
        score -= 100;
        reasons.push('Already statused');
      }
      // Stat boosts at max
      // Healing at full HP
      // etc.
    }

    scores.push({ moveIndex: i, score, reasons });
  }

  // Find highest score
  scores.sort((a, b) => b.score - a.score);

  // Return best move (or random among ties)
  const bestScore = scores[0].score;
  const tiedMoves = scores.filter(s => s.score === bestScore);

  return tiedMoves[Math.floor(Math.random() * tiedMoves.length)].moveIndex;
}
```

## AI Difficulty Levels

For implementation, consider these difficulty presets:

| Level | AI Flags | Description |
|-------|----------|-------------|
| Easy | CHECK_BAD_MOVE only | Avoids useless moves |
| Medium | + TRY_TO_FAINT, CHECK_VIABILITY | Smarter targeting |
| Hard | + HP_AWARE, PREFER_STRONGEST | Optimal plays |
| Expert | All flags | Tournament-level AI |

## Key Source Files

| File | Purpose |
|------|---------|
| `battle_ai_script_commands.c` | AI bytecode interpreter |
| `battle_ai_switch_items.c` | Switch and item decision logic |
| `constants/battle_ai.h` | AI flag definitions |
| `data/battle_ai_scripts.s` | AI evaluation scripts |
