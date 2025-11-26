# Move Selection & Scoring System

## Scoring Overview

The AI evaluates each move by running it through multiple scoring scripts. The scoring system works as follows:

1. **Initial Score**: Each usable move starts at **100 points**
2. **Score Adjustments**: Scripts add or subtract points based on conditions
3. **Minimum Score**: Scores cannot go below **0**
4. **Random Variance**: Each move has `simulatedRNG[i] = 100 - (Random() % 16)` applied
5. **Selection**: Highest scored move is chosen (random among ties)

## Score Calculation

```
Final Score = max(0, 100 + Σ(all script adjustments))
```

### Example Calculation

```
Move: Thunderbolt (Electric, 95 power)
Target: Gyarados (Water/Flying)

Starting Score: 100

AI_CheckBadMove:
  - Not immune: +0
  - No ability blocks: +0

AI_TryToFaint:
  - Can faint target: +4
  - Is most powerful move: +0

AI_CheckViability:
  - Super effective (x4): +2

Final Score: 100 + 0 + 4 + 2 = 106
```

## AI Script Order & Effects

Scripts are executed in bit order (0, 1, 2, ...). Multiple scripts can be enabled simultaneously.

### AI_CheckBadMove (Bit 0)

**Purpose**: Penalize obviously bad moves

| Condition | Score Change |
|-----------|--------------|
| Type immunity (x0 effectiveness) | -10 |
| Ability blocks move (Volt Absorb vs Electric, etc.) | -12 |
| Soundproof blocks sound move | -10 |
| Sleep move vs Insomnia/Vital Spirit | -10 |
| Stat already at max/min | -10 |
| Redundant status (already poisoned, etc.) | -10 |
| Explosion when user is last Pokemon | -10 |
| High-risk moves vs Wonder Guard (not SE) | -10 |

**Key Move Effect Checks:**

```assembly
@ Status moves blocked by existing status
if_status AI_TARGET, STATUS1_ANY, Score_Minus10

@ Stat moves at maximum
if_stat_level_equal AI_USER, STAT_ATK, MAX_STAT_STAGE, Score_Minus10

@ Type immunity
if_type_effectiveness AI_EFFECTIVENESS_x0, Score_Minus10

@ Ability immunity
get_ability AI_TARGET
if_equal ABILITY_VOLT_ABSORB, CheckIfVoltAbsorbCancelsElectric
```

### AI_TryToFaint (Bit 1)

**Purpose**: Prioritize moves that can KO the target

| Condition | Score Change |
|-----------|--------------|
| Move can faint target | +4 |
| Move is Quick Attack and can faint | +2 (additional) |
| Move is Explosion and can faint | +0 (excluded) |
| Not most powerful move (can't faint) | -1 |
| x4 super effective (can't faint) | +2 |

```assembly
AI_TryToFaint:
    if_can_faint AI_TryToFaint_TryToEncourageQuickAttack
    get_how_powerful_move_is
    if_equal MOVE_NOT_MOST_POWERFUL, Score_Minus1
    if_type_effectiveness AI_EFFECTIVENESS_x4, AI_TryToFaint_DoubleSuperEffective
    end

AI_TryToFaint_TryToEncourageQuickAttack:
    if_effect EFFECT_EXPLOSION, AI_TryToFaint_End
    if_not_effect EFFECT_QUICK_ATTACK, AI_TryToFaint_ScoreUp4
    score +2
AI_TryToFaint_ScoreUp4:
    score +4
```

### AI_CheckViability (Bit 2)

**Purpose**: Comprehensive move viability evaluation

This is the most complex script (~500 lines) covering nearly every move effect. Key scoring patterns:

#### Healing Moves

| Condition | Score Change |
|-----------|--------------|
| HP = 100% | -8 |
| User slower, HP > 80% | -3 |
| User slower, HP 50-70% | +0 |
| HP < 40% | +2 |

#### Stat Boost Moves

| Condition | Score Change |
|-----------|--------------|
| HP = 100% and turn 0 | +2 |
| HP < 40% | -2 |
| HP < 70% | -2 (maybe) |
| Stat already at +3 | -1 |

#### Status Moves

| Condition | Score Change |
|-----------|--------------|
| Toxic + has Protect | +2 |
| Target HP < 50% | -3 |
| User HP < 50% | -3 |

#### Speed Control (Speed Up/Down)

| Condition | Score Change |
|-----------|--------------|
| Already faster (Speed Up) | -3 |
| Already slower (Speed Down) | -3 |
| Target faster (Speed Down) | +2 |
| Target faster (Speed Up) | +3 |

### AI_SetupFirstTurn (Bit 3)

**Purpose**: Encourage setup moves on turn 0

| Condition | Score Change |
|-----------|--------------|
| Turn 0 + setup move (random 68%) | +2 |

**Setup moves include:**
- All stat boost moves (+1, +2)
- All stat drop moves (-1, -2)
- Conversion, Light Screen, Reflect
- Substitute, Leech Seed, Minimize
- Curse, Swagger, Yawn, Dragon Dance
- Torment, Will-O-Wisp, Calm Mind
- Bulk Up, Cosmic Power

### AI_Risky (Bit 4)

**Purpose**: Encourage high-risk/high-reward moves

| Condition | Score Change |
|-----------|--------------|
| Risky move effect (random 50%) | +2 |

**Risky moves include:**
- Sleep, Explosion, Mirror Move, OHKO
- High Critical, Confuse, Metronome
- Psywave, Counter, Destiny Bond
- Swagger, Attract, Present
- Belly Drum, Mirror Coat, Focus Punch

### AI_PreferPowerExtremes (Bit 5)

**Purpose**: Prefer very weak or very strong moves

| Condition | Score Change |
|-----------|--------------|
| Move classified as "other" power (random 60%) | +2 |

"Other" power means moves with 0-1 base power or in ignored effects list.

### AI_PreferBatonPass (Bit 6)

**Purpose**: Baton Pass strategy support

Complex logic based on:
- Party Pokemon remaining
- Current stat boosts
- HP levels
- Whether user has Baton Pass

| Condition | Score Change |
|-----------|--------------|
| Has stats to pass + low HP | +2 |
| Swords Dance/Dragon Dance/Calm Mind on turn 0 | +5 |
| Baton Pass with +3 or higher stats | +3 |

### AI_DoubleBattle (Bit 7)

**Purpose**: Double battle awareness

| Condition | Score Change |
|-----------|--------------|
| Targeting ally (attacking move) | -30 |
| Earthquake with Levitate partner | +2 |
| Earthquake with weak partner | -10 |
| Electric move vs Lightning Rod | -2 to -10 |
| Fire move on Flash Fire ally | +3 |
| Helping Hand on ally | +2 |
| Skill Swap Truant to ally | +10 |

### AI_HPAware (Bit 8)

**Purpose**: Adjust strategy based on HP levels

**When User HP > 70% (High HP):**
Discouraged moves:
- Explosion, Rest, Healing moves
- Destiny Bond, Flail, Endure
- Memento, Grudge, Overheat

**When User HP 30-70% (Medium HP):**
Discouraged moves:
- Explosion, all stat moves
- Bide, Conversion, screens

**When User HP < 30% (Low HP):**
Discouraged moves:
- All stat moves, setup moves
- Lock On, Safeguard, Belly Drum
- Eruption, Dragon Dance

**Similar logic for target's HP:**
- High HP target: Fewer restrictions
- Medium HP target: Discourage setup
- Low HP target: Discourage status, overkill

### AI_TrySunnyDayStart (Bit 9)

**Purpose**: Weather setup

Limited implementation - mainly checks if already sunny.

## Special Scripts

### AI_Roaming (Bit 29)

Roaming Pokemon (Latios, Latias, etc.) flee battle.

```assembly
AI_Roaming:
    if_random_less_than 128, AI_Roaming_End
    flee
AI_Roaming_End:
    end
```

### AI_Safari (Bit 30)

Safari Zone behavior - Pokemon can flee or watch.

```assembly
AI_Safari:
    if_random_safari_flee AI_Safari_Pokemon_Flee
    watch
AI_Safari_Pokemon_Flee:
    flee
```

### AI_FirstBattle (Bit 31)

Tutorial battle (Birch saving from Zigzagoon) - uses basic AI.

## Detailed Move Scoring Examples

### Example 1: Swords Dance

```
Turn 0, User HP = 100%, Attack at +0

AI_CheckBadMove:
  - Attack not at max: +0

AI_CheckViability:
  - HP = 100% (random 50%): +2
  - HP > 70%: +0

AI_SetupFirstTurn:
  - Turn 0 + stat boost (random 68%): +2

Expected Score: 100 + 2 + 2 = 104
```

### Example 2: Earthquake vs Levitating Partner

```
Double battle, targeting enemy, partner has Levitate

AI_CheckBadMove:
  - Enemy not immune: +0

AI_DoubleBattle:
  - Partner has Levitate: +2

Score: 102
```

### Example 3: Thunder Wave vs Paralyzed Target

```
AI_CheckBadMove:
  - Target already has status: -10

Score: 90 (highly discouraged)
```

## Score Adjustment Summary Table

| Adjustment | Meaning | Common Uses |
|------------|---------|-------------|
| +10 | Very strong encourage | Sleep Talk when asleep |
| +5 | Strong encourage | Baton Pass setup, first turn setup |
| +4 | KO potential | Can faint target |
| +3 | Good choice | Speed up when slower, paralysis on faster |
| +2 | Minor encourage | Super effective x4, stat boost at full HP |
| +1 | Slight encourage | Various situational bonuses |
| -1 | Minor discourage | Not most powerful, minor inefficiency |
| -2 | Moderate discourage | Healing at high HP, setup at low HP |
| -3 | Significant discourage | Speed up when faster |
| -5 | Strong discourage | Sleep Talk when not asleep |
| -8 | Very strong discourage | Heal at 100% HP |
| -10 | Avoid if possible | Move blocked/immune/useless |
| -12 | Never use | Ability completely negates move |
| -30 | Never use | Attacking ally in doubles |
