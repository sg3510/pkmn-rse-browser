# Battle Flow

This document describes the complete flow of a battle from initialization to conclusion.

## Battle Initialization

### 1. Battle Setup (`battle_setup.c`)

```c
// Wild battle entry point
void DoStandardWildBattle(void) {
    gBattleTypeFlags = 0;
    CreateBattleStartTask(GetWildBattleTransition(), MUS_VS_WILD);
}

// Trainer battle entry point
void DoTrainerBattle(void) {
    gBattleTypeFlags = BATTLE_TYPE_TRAINER;
    CreateNPCTrainerParty(&gEnemyParty[0], gTrainerBattleOpponent_A, TRUE);
    CreateBattleStartTask(GetTrainerBattleTransition(), GetTrainerBattleMusic());
}
```

### 2. Battle Resources Allocation (`battle_main.c`)

```c
void CB2_InitBattle(void) {
    MoveSaveBlocks_ResetHeap();
    AllocateBattleResources();    // Allocate battle memory
    AllocateBattleSpritesData();  // Sprite data
    AllocateMonSpritesGfx();      // Pokemon graphics

    // Load enemy party for trainer battles
    if (!(gBattleTypeFlags & BATTLE_TYPE_LINK)) {
        CreateNPCTrainerParty(&gEnemyParty[0], gTrainerBattleOpponent_A, TRUE);
    }

    gMain.inBattle = TRUE;
}
```

### 3. Battle Data Reset

```c
static void BattleStartClearSetData(void) {
    // Reset turn values
    TurnValuesCleanUp(FALSE);
    SpecialStatusesClear();

    // Clear all battler data
    for (i = 0; i < MAX_BATTLERS_COUNT; i++) {
        gStatuses3[i] = 0;
        gDisableStructs[i] = {0};
        gLastMoves[i] = MOVE_NONE;
        gLastLandedMoves[i] = MOVE_NONE;
        // ... etc
    }

    // Clear side effects
    for (i = 0; i < 2; i++) {
        gSideStatuses[i] = 0;
        gSideTimers[i] = {0};
    }

    // Clear weather
    gBattleWeather = 0;

    // Initialize battle results
    gBattleResults = {0};

    // Safari Zone setup
    gBattleStruct->safariCatchFactor = speciesInfo[species].catchRate * 100 / 1275;
    gBattleStruct->safariEscapeFactor = 3;
}
```

## Battle Introduction Sequence

### 1. Intro Animation

```c
void BeginBattleIntro(void) {
    BattleStartClearSetData();
    gBattleCommunication[1] = 0;
    gBattleMainFunc = BattleIntroGetMonsData;
}
```

### 2. Load Pokemon Data

```c
static void BattleIntroGetMonsData(void) {
    // Load player Pokemon data into gBattleMons[0]
    // Load enemy Pokemon data into gBattleMons[1]
    // For doubles, also load positions 2 and 3

    gBattleMainFunc = BattleIntroPrepareBackgroundSlide;
}
```

### 3. Send Out Pokemon

```c
// Trainer throws ball
static void BattleIntroOpponentSendsOutMonAnimation(void) {
    BtlController_EmitIntroTrainerBallThrow(B_COMM_TO_CONTROLLER);
    gBattleMainFunc = BattleIntroRecordMonsToDex;
}

// Wild Pokemon appears
static void BattleIntroRecordMonsToDex(void) {
    // Record wild Pokemon as seen in Pokedex
    HandleSetPokedexFlag(nationalDexNum, FLAG_SET_SEEN, personality);
    gBattleMainFunc = BattleIntroPrintWildMonAttacked;
}
```

### 4. Intro Messages

```c
// Wild battle: "Wild PIKACHU appeared!"
// Trainer battle: "TRAINER wants to battle!"
// Then: "TRAINER sent out POKEMON!"
// Finally: "Go! POKEMON!"
```

## Main Battle Loop

### 1. Turn Start

```c
static void HandleTurnActionSelectionState(void) {
    gBattleCommunication[ACTIONS_CONFIRMED_COUNT] = 0;

    for (gActiveBattler = 0; gActiveBattler < gBattlersCount; gActiveBattler++) {
        switch (gBattleCommunication[gActiveBattler]) {
            case STATE_BEFORE_ACTION_CHOSEN:
                // Present action menu to player
                BtlController_EmitChooseAction(B_COMM_TO_CONTROLLER, ...);
                break;
            // ... handle action selection states
        }
    }
}
```

### 2. Action Selection

Player options:
- **Fight** - Choose a move
- **Bag** - Use an item
- **Pokemon** - Switch Pokemon
- **Run** - Attempt to flee (wild only)

```c
// Action constants
#define B_ACTION_USE_MOVE         0
#define B_ACTION_USE_ITEM         1
#define B_ACTION_SWITCH           2
#define B_ACTION_RUN              3
#define B_ACTION_SAFARI_ZONE_BALL 4
#define B_ACTION_SAFARI_ZONE_BAIT 5
#define B_ACTION_SAFARI_ZONE_ROCK 6
#define B_ACTION_SAFARI_ZONE_RUN  7
#define B_ACTION_WALLY_THROW      8
#define B_ACTION_EXEC_SCRIPT      9
#define B_ACTION_CANCEL_PARTNER   10
#define B_ACTION_NOTHING_FAINTED  13
```

### 3. Move Selection

```c
// Player selects move
case B_ACTION_USE_MOVE:
    if (gBattleBufferB[gActiveBattler][1] == ACTION_USE_MOVE) {
        gChosenMoveByBattler[gActiveBattler] =
            gBattleMons[gActiveBattler].moves[gBattleBufferB[gActiveBattler][2]];
        gBattleCommunication[gActiveBattler]++;
    }
    break;
```

### 4. Turn Order Determination

```c
static void SetActionsAndBattlersTurnOrder(void) {
    // Determine order based on:
    // 1. Action priority (switching always goes first)
    // 2. Move priority (Quick Attack > normal moves > Counter)
    // 3. Speed (higher speed goes first)
    // 4. Random tie-breaker

    // Sort battlers by these criteria
    for (i = 0; i < gBattlersCount - 1; i++) {
        for (j = i + 1; j < gBattlersCount; j++) {
            if (GetWhoStrikesFirst(gBattlerByTurnOrder[i], gBattlerByTurnOrder[j], FALSE))
                SwapTurnOrder(i, j);
        }
    }
}
```

### 5. Action Execution

```c
void RunBattleScriptCommands(void) {
    // Execute actions in order
    while (gBattlerByTurnOrder[gCurrentTurnActionNumber] != 0xFF) {
        gActiveBattler = gBattlerByTurnOrder[gCurrentTurnActionNumber];

        switch (gChosenActionByBattler[gActiveBattler]) {
            case B_ACTION_USE_MOVE:
                gBattlescriptCurrInstr = BattleScript_ExecuteMove;
                break;
            case B_ACTION_USE_ITEM:
                gBattlescriptCurrInstr = BattleScript_UseItem;
                break;
            case B_ACTION_SWITCH:
                gBattlescriptCurrInstr = BattleScript_SwitchIn;
                break;
            case B_ACTION_RUN:
                gBattlescriptCurrInstr = BattleScript_Run;
                break;
        }

        // Execute battle script
        while (gBattlescriptCurrInstr != NULL)
            gBattleScriptingCommandsTable[*gBattlescriptCurrInstr]();

        gCurrentTurnActionNumber++;
    }
}
```

### 6. Move Execution Flow

```
1. Check if attacker can move (flinch, paralysis, sleep, confusion)
2. Check if move can be used (PP, Disable, Taunt, etc.)
3. Decrement PP
4. Play move animation
5. Check accuracy
6. If hit:
   a. Calculate damage
   b. Apply type effectiveness
   c. Apply STAB
   d. Apply random factor
   e. Apply damage
   f. Display message
   g. Apply secondary effects
7. If miss:
   a. Display miss message
   b. Handle crash damage for Jump Kick/Hi Jump Kick
```

### 7. End-of-Turn Effects

```c
static void HandleEndTurnEffects(void) {
    // Weather damage
    if (gBattleWeather & B_WEATHER_SANDSTORM)
        ApplySandstormDamage();
    if (gBattleWeather & B_WEATHER_HAIL)
        ApplyHailDamage();

    // Status damage
    ApplyBurnDamage();
    ApplyPoisonDamage();

    // Other effects
    ApplyLeechSeedDamage();
    ApplyWrapDamage();
    DecrementPerishSongCounters();
    DecrementWeatherTurns();
    DecrementReflectLightScreenTurns();
    // ... etc
}
```

## Battle End Conditions

### Win Conditions

```c
// Player wins if:
// - All enemy Pokemon faint
// - Wild Pokemon is caught
// - Enemy trainer has no usable Pokemon

// Player loses if:
// - All player Pokemon faint

// Draw if:
// - Last Pokemon on each side faints simultaneously
```

### Wild Battle Specific

```c
// Can flee if:
// - Not trapped by Mean Look, Block, Spider Web
// - Run odds: (playerSpeed * 128 / enemySpeed + 30 * runAttempts) / 256
// - Higher speed = easier escape
// - Each failed attempt increases odds

// Can catch Pokemon with Poke Balls
```

### Trainer Battle Specific

```c
// Cannot flee (except Teleport, Roar, etc.)
// Cannot catch Pokemon
// Money awarded on win
// 1.5× experience multiplier
```

## Post-Battle Processing

### 1. Experience Distribution

```c
static void Cmd_getexp(void) {
    // Base exp = (baseExpYield × enemyLevel) / 7

    // Split among participants
    for (i = 0; i < PARTY_SIZE; i++) {
        if (gBattleStruct->sentInPokes & (1 << i)) {
            monExp = calculatedExp / viaSentIn;
        }
        if (holdEffect == HOLD_EFFECT_EXP_SHARE) {
            monExp += gExpShareExp;
        }
    }

    // Apply multipliers
    if (holdEffect == HOLD_EFFECT_LUCKY_EGG)
        monExp = (monExp * 150) / 100;
    if (gBattleTypeFlags & BATTLE_TYPE_TRAINER)
        monExp = (monExp * 150) / 100;  // Trainer bonus
    if (IsMonTradedOT(mon))
        monExp = (monExp * 150) / 100;  // Traded bonus
}
```

### 2. Money Calculation

```c
// Money = baseMoneyValue × highestLevel × badgeMultiplier
// Badge multipliers: 1, 2, 3, 4, 5, 6, 7, 8 badges

// Amulet Coin / Luck Incense doubles money
if (HasHeldEffect(HOLD_EFFECT_DOUBLE_PRIZE))
    gBattleStruct->moneyMultiplier *= 2;

// Pay Day adds money
money += gPaydayMoney;
```

### 3. Level Up Processing

```c
if (mon->experience >= gExperienceTables[growthRate][level + 1]) {
    level++;
    // Recalculate all stats
    // Check for evolution
    // Check for new moves
}
```

## Wild vs Trainer Battle Differences

| Aspect | Wild Battle | Trainer Battle |
|--------|-------------|----------------|
| Can Run | Yes | No |
| Can Catch | Yes | No |
| Money Reward | No | Yes |
| Experience | Base | 1.5× |
| Intro Message | "Wild X appeared!" | "TRAINER wants to battle!" |
| End Message | Various | "Player defeated TRAINER!" |
| Defeat | Whiteout | Whiteout + pay money |
| AI | Simple | Script-based |

## Battle Script System

The battle system uses a bytecode interpreter:

```c
// Script command execution
while (gBattlescriptCurrInstr != NULL) {
    // Read command byte
    u8 command = *gBattlescriptCurrInstr;

    // Execute command
    gBattleScriptingCommandsTable[command]();

    // Many commands increment gBattlescriptCurrInstr themselves
}
```

Key script commands:
- `attackcanceler` - Check if attack can proceed
- `accuracycheck` - Roll accuracy
- `damagecalc` - Calculate damage
- `typecalc` - Apply type effectiveness
- `adjustdamage` - Apply STAB, random factor
- `healthbarupdate` - Animate HP bar
- `printstring` - Display battle text
