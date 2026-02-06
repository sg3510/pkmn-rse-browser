---
title: Battle System MVP Reference
status: planned
last_verified: 2026-02-06
---

# Battle System MVP Reference

## Scope

The first battle is: **Level 5 Starter vs Level 2 Wild Poochyena**. This is the absolute simplest battle possible — one Pokemon per side, no items, no catching, no weather, no abilities that matter.

## Battle Flow (from C source)

> C ref: `pokeemerald/src/battle_main.c`, `pokeemerald/src/battle_setup.c`

### 1. Battle Initialization
```
BattleSetup_StartWildBattle()
  → CreateBattleStartTask()
  → DoWildBattleTransition()
  → CB2_HandleStartBattle()
    → InitBattleControllers()
    → BeginBattleIntro()
      → BattleStartClearSetData()  // Clear all battle state
      → BattleIntroGetMonsData     // Load Pokemon data
```

### 2. Battle Intro Phase
```
BattleIntroGetMonsData → BattleIntroPrepareBackgroundSlide
  → BattleIntroDrawTrainersOrMonsSprites
  → BattleIntroDrawPartySummaryScreens
  → BattleIntroRecordMonsToDex
  → TryDoEventsBeforeFirstTurn
```

Messages shown:
1. "Wild POOCHYENA appeared!"
2. "Go! TREECKO!" (with pokeball throw animation)

### 3. Turn Loop
```
HandleTurnActionSelectionState()
  → Player chooses action (FIGHT/BAG/POKEMON/RUN)
  → If FIGHT: HandleInputChooseMove()
  → Wild Pokemon: random move selection
  → SetActionsAndBattlersTurnOrder() // Sort by speed
  → For each battler in turn order:
      RunBattleScriptCommands_PopCallbacksStack()
        → Execute move
        → Apply damage/effects
        → Check faint
```

### 4. Battle End
```
HandleEndTurn_FinishBattle()
  → B_OUTCOME_WON: give EXP, return to overworld
  → B_OUTCOME_LOST: white out
  → B_OUTCOME_RAN: return to overworld
```

## Damage Formula

> C ref: `pokeemerald/src/pokemon.c` lines 3106-3340 (`CalculateBaseDamage`)

### Gen 3 Formula (Simplified for First Battle)

```
baseDamage = floor(floor(floor(2 * level / 5 + 2) * power * A / D) / 50) + 2

where:
  level = attacker's level
  power = move base power
  A = attacker's Attack (physical) or SpAtk (special)
  D = defender's Defense (physical) or SpDef (special)

finalDamage = baseDamage * STAB * typeEffectiveness * critical * random / 100

where:
  STAB = 1.5 if move type matches attacker type, else 1.0
  typeEffectiveness = from type chart (0.5, 1.0, 2.0)
  critical = 2.0 if critical hit, else 1.0
  random = random integer 85..100
```

### Physical vs Special (Gen 3 Rule)

Gen 3 does NOT use per-move physical/special. It's determined by TYPE:

**Physical types**: Normal, Fighting, Flying, Poison, Ground, Rock, Bug, Ghost, Steel
**Special types**: Fire, Water, Grass, Electric, Psychic, Ice, Dragon, Dark

### For First Battle Specifically

Moves involved:
| Move | Type | Power | Acc | Category | Effect |
|------|------|-------|-----|----------|--------|
| Tackle | Normal | 35 | 95% | Physical | None |
| Pound | Normal | 40 | 100% | Physical | None |
| Scratch | Normal | 40 | 100% | Physical | None |
| Leer | Normal | - | 100% | Status | Lower Defense 1 stage |
| Growl | Normal | - | 100% | Status | Lower Attack 1 stage |

All moves are Normal type (physical). No STAB for either side (Poochyena is Dark type, Treecko is Grass, Torchic is Fire, Mudkip is Water — none match Normal).

### Stat Stages

```
Stage -6: multiply stat by 2/8
Stage -5: multiply stat by 2/7
Stage -4: multiply stat by 2/6
Stage -3: multiply stat by 2/5
Stage -2: multiply stat by 2/4
Stage -1: multiply stat by 2/3
Stage  0: multiply stat by 2/2 (unchanged)
Stage +1: multiply stat by 3/2
Stage +2: multiply stat by 4/2
Stage +3: multiply stat by 5/2
Stage +4: multiply stat by 6/2
Stage +5: multiply stat by 7/2
Stage +6: multiply stat by 8/2
```

> C ref: `pokeemerald/src/data/battle_moves.h` for `gStatStageRatios`

### Critical Hit

```
critChance = speed / 2  (where speed is base Speed species stat)
if random(0..255) < critChance: critical hit!

Stage 0: 1/16 chance (~6.25%)
```

### Accuracy Check

```
if random(1..100) <= moveAccuracy: hit
else: miss
```

## Pokemon Data Needed

### Poochyena (Level 2)
> C ref: `pokeemerald/src/data/pokemon/species_info.h`

```
Species: SPECIES_POOCHYENA (261)
Type: Dark
Base Stats: HP 35, Atk 55, Def 35, SpA 30, SpD 30, Spe 35
Level 2 Moves: Tackle (only)
Ability: Run Away (irrelevant for battle)
Base EXP Yield: 55
```

### Starters (Level 5)

**Treecko (252):**
```
Type: Grass
Base Stats: HP 40, Atk 45, Def 35, SpA 65, SpD 55, Spe 70
Level 5 Moves: Pound (40 power, Normal, 100% acc), Leer (status, -1 Def)
Ability: Overgrow
```

**Torchic (255):**
```
Type: Fire
Base Stats: HP 45, Atk 60, Def 40, SpA 70, SpD 50, Spe 45
Level 5 Moves: Scratch (40 power, Normal, 100% acc), Growl (status, -1 Atk)
Ability: Blaze
```

**Mudkip (258):**
```
Type: Water
Base Stats: HP 50, Atk 70, Def 50, SpA 50, SpD 50, Spe 40
Level 5 Moves: Tackle (35 power, Normal, 95% acc), Growl (status, -1 Atk)
Ability: Torrent
```

## EXP Calculation

> C ref: `pokeemerald/src/battle_util2.c`

```
expGained = (baseExpYield * wildLevel) / 7

For Poochyena level 2:
  expGained = (55 * 2) / 7 = 15 EXP

Level 5 → Level 6 requires different EXP per growth rate:
  Medium Slow (Treecko, Torchic, Mudkip): 135 total EXP for level 6
  At level 5: 125 total EXP
  Need: 10 more EXP to level up (will level up from this battle)
```

## Battle UI Layout

> C ref: `pokeemerald/src/battle_interface.c`

```
┌──────────────────────────────────┐
│                                  │
│    [Wild Poochyena sprite]       │  ← front sprite, right side
│    POOCHYENA ♂ Lv2              │  ← name/level display
│    ████████████░░░  HP           │  ← HP bar (green/yellow/red)
│                                  │
│                                  │
│         [Player's Pokemon]       │  ← back sprite, left side
│    TREECKO         Lv5          │
│    ████████████████  HP 20/20   │  ← shows exact HP for player's mon
│                                  │
├──────────────────────────────────┤
│ What will TREECKO do?            │
│                                  │
│  FIGHT    BAG                    │
│  POKEMON  RUN                    │
└──────────────────────────────────┘
```

### Move Selection

```
┌──────────────────────────────────┐
│ [move display area]              │
│                                  │
│  POUND       PP 35/35           │
│  LEER        PP 30/30           │
│  -                               │
│  -                               │
├──────────────────────────────────┤
│ TYPE/NORMAL                      │
└──────────────────────────────────┘
```

## Implementation Approach

1. **BattleState** — new GameState, accepts `{ playerParty, wildSpecies, wildLevel }`
2. **BattleEngine** — turn-based state machine (INTRO → ACTION_SELECT → MOVE_EXECUTE → CHECK_END → repeat)
3. **BattleUI** — React component with sprite display, HP bars, text box, menus
4. **DamageCalc** — pure function: `calculateDamage(attacker, defender, move) → number`
5. **BattlePokemon** — runtime battle data (current HP, stat stages, status)

Keep it simple. The first battle doesn't need:
- Weather effects
- Abilities (Overgrow/Blaze/Torrent only trigger at 1/3 HP)
- Held items
- Status conditions (burn, poison, etc.)
- Multi-hit moves
- Priority moves
- Double battles
