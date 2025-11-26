# Pokemon Capture Mechanics

The capture system is implemented in `Cmd_handleballthrow()` in `battle_script_commands.c:9905`.

## Catch Rate Formula

### Step 1: Calculate Base Odds

```
odds = (catchRate × ballMultiplier / 10) × (maxHP × 3 - currentHP × 2) / (3 × maxHP)
```

Where:
- `catchRate` = Species base catch rate (from `species_info.h`)
- `ballMultiplier` = Ball bonus (see below)
- `maxHP` = Target's maximum HP
- `currentHP` = Target's current HP

### Step 2: Apply Status Modifiers

```c
// Sleep or Freeze: 2× catch rate
if (status1 & (STATUS1_SLEEP | STATUS1_FREEZE))
    odds *= 2;

// Poison, Burn, or Paralysis: 1.5× catch rate
if (status1 & (STATUS1_POISON | STATUS1_BURN | STATUS1_PARALYSIS | STATUS1_TOXIC_POISON))
    odds = (odds * 15) / 10;
```

### Step 3: Determine Capture

```c
if (odds > 254) {
    // Guaranteed catch (3 shakes, success)
    shakes = BALL_3_SHAKES_SUCCESS;
} else {
    // Calculate shake probability
    odds = Sqrt(Sqrt(16711680 / odds));
    odds = 1048560 / odds;

    // Each shake has odds/65536 chance of success
    for (shakes = 0; shakes < BALL_3_SHAKES_SUCCESS && Random() < odds; shakes++);
}
```

## Ball Multipliers

| Ball | Multiplier | Condition |
|------|------------|-----------|
| **Master Ball** | Always catches | — |
| **Ultra Ball** | 20 (2.0×) | — |
| **Great Ball** | 15 (1.5×) | — |
| **Poke Ball** | 10 (1.0×) | — |
| **Safari Ball** | Special | `safariCatchFactor × 1275 / 100` |
| **Net Ball** | 30 (3.0×) | Water or Bug type |
| **Net Ball** | 10 (1.0×) | Other types |
| **Dive Ball** | 35 (3.5×) | Underwater |
| **Dive Ball** | 10 (1.0×) | Not underwater |
| **Nest Ball** | 40 - level (min 10) | Level < 40 |
| **Nest Ball** | 10 (1.0×) | Level ≥ 40 |
| **Repeat Ball** | 30 (3.0×) | Already caught species |
| **Repeat Ball** | 10 (1.0×) | Not caught yet |
| **Timer Ball** | 10 + turns (max 40) | — |
| **Luxury Ball** | 10 (1.0×) | — |
| **Premier Ball** | 10 (1.0×) | — |

## Ball Catch Bonus Table

```c
static const u8 sBallCatchBonuses[] = {
    [ITEM_ULTRA_BALL - ITEM_ULTRA_BALL] = 20,   // 2.0×
    [ITEM_GREAT_BALL - ITEM_ULTRA_BALL] = 15,   // 1.5×
    [ITEM_POKE_BALL - ITEM_ULTRA_BALL] = 10,    // 1.0×
    [ITEM_SAFARI_BALL - ITEM_ULTRA_BALL] = 15,  // (overridden for Safari)
};
```

## Shake Counts and Animations

| Shakes | Result | Animation |
|--------|--------|-----------|
| 0 | Escaped immediately | Ball opens right away |
| 1 | One shake | Ball shakes once, escapes |
| 2 | Two shakes | Ball shakes twice, escapes |
| 3 | Three shakes, success | Ball shakes three times, click sound |
| BALL_TRAINER_BLOCK | Trainer battle | Ball is knocked away |

## Species Catch Rates

Examples from `species_info.h`:

| Pokemon | Catch Rate | Notes |
|---------|------------|-------|
| Magikarp | 255 | Easiest to catch |
| Caterpie | 255 | Very easy |
| Pikachu | 190 | Easy |
| Starter Pokemon | 45 | Harder |
| Pseudo-legendaries | 45 | Harder |
| Legendaries | 3-45 | Very hard |
| Mewtwo | 3 | Hardest |
| Beldum | 3 | Hardest (non-legendary) |

## Safari Zone Mechanics

Safari Zone uses a modified catch system:

```c
void EnterSafariMode(void) {
    gNumSafariBalls = 30;       // Start with 30 Safari Balls
    sSafariZoneStepCounter = 500;  // 500 steps allowed
}

// Initial catch factor based on species catch rate
gBattleStruct->safariCatchFactor = speciesInfo[species].catchRate * 100 / 1275;
gBattleStruct->safariEscapeFactor = 3;
```

### Safari Zone Actions

1. **Throw Ball** - Uses current catch factor
2. **Throw Bait** - Decreases escape factor, decreases catch factor
3. **Throw Rock/Mud** - Increases escape factor, increases catch factor
4. **Run** - End encounter

### Escape Check

```c
// Wild Pokemon may flee
if (Random() % 100 < escapeRate) {
    gBattleOutcome = B_OUTCOME_MON_FLED;
}
```

## Capture Messages

```c
// Success messages
static const u8 sText_GotchaMonCaught[] = _("Gotcha!\n{B_DEF_NAME} was caught!{WAIT_SE}\p");

// Failure messages (based on shake count)
static const u8 sText_ShakeBallThrow0[] = _("Oh, no!\nThe POKéMON broke free!");
static const u8 sText_ShakeBallThrow1[] = _("Aww!\nIt appeared to be caught!");
static const u8 sText_ShakeBallThrow2[] = _("Aargh!\nAlmost had it!");
static const u8 sText_ShakeBallThrow3[] = _("Shoot!\nIt was so close, too!");
```

## Post-Capture Processing

```c
static void Cmd_givecaughtmon(void) {
    // Add to player's party or PC
    if (GiveMonToPlayer(&gEnemyParty[0]) != MON_GIVEN_TO_PARTY) {
        // Sent to PC
        StringCopy(gStringVar1, GetBoxNamePtr(VarGet(VAR_PC_BOX_TO_SEND_MON)));
    }

    // Record in battle results
    gBattleResults.caughtMonSpecies = GetMonData(&gEnemyParty[0], MON_DATA_SPECIES);
    GetMonData(&gEnemyParty[0], MON_DATA_NICKNAME, gBattleResults.caughtMonNick);
    gBattleResults.caughtMonBall = GetMonData(&gEnemyParty[0], MON_DATA_POKEBALL);
}

// Set Pokedex flags
static void Cmd_trysetcaughtmondexflags(void) {
    if (!GetSetPokedexFlag(nationalDexNum, FLAG_GET_CAUGHT)) {
        HandleSetPokedexFlag(nationalDexNum, FLAG_SET_CAUGHT, personality);
    }
}
```

## Cannot Catch Conditions

```c
// Trainer battle - cannot throw ball
if (gBattleTypeFlags & BATTLE_TYPE_TRAINER) {
    BtlController_EmitBallThrowAnim(BALL_TRAINER_BLOCK);
    gBattlescriptCurrInstr = BattleScript_TrainerBallBlock;
    // Message: "The TRAINER blocked the BALL!"
}
```

## Implementation Notes for React

```typescript
interface CaptureResult {
  success: boolean;
  shakes: number;
  message: string;
}

function attemptCapture(
  species: number,
  currentHp: number,
  maxHp: number,
  status: number,
  ballType: number,
  turnCount: number,
  isUnderwater: boolean,
  alreadyCaught: boolean
): CaptureResult {
  // Get base catch rate
  const catchRate = SPECIES_INFO[species].catchRate;

  // Get ball multiplier
  let ballMultiplier = getBallMultiplier(ballType, species, turnCount, isUnderwater, alreadyCaught);

  // Master Ball always catches
  if (ballType === ITEM_MASTER_BALL) {
    return { success: true, shakes: 3, message: 'Gotcha!' };
  }

  // Calculate base odds
  let odds = (catchRate * ballMultiplier / 10) * (maxHp * 3 - currentHp * 2) / (3 * maxHp);

  // Apply status bonus
  if (status & (STATUS1_SLEEP | STATUS1_FREEZE)) {
    odds *= 2;
  } else if (status & (STATUS1_POISON | STATUS1_BURN | STATUS1_PARALYSIS | STATUS1_TOXIC_POISON)) {
    odds = Math.floor((odds * 15) / 10);
  }

  // Check for guaranteed catch
  if (odds > 254) {
    return { success: true, shakes: 3, message: 'Gotcha!' };
  }

  // Calculate shake probability
  const shakeOdds = Math.floor(1048560 / Math.sqrt(Math.sqrt(16711680 / odds)));

  // Perform shake checks
  let shakes = 0;
  for (shakes = 0; shakes < 3; shakes++) {
    if (Math.random() * 65536 >= shakeOdds) {
      break;
    }
  }

  if (shakes === 3) {
    return { success: true, shakes: 3, message: 'Gotcha!' };
  }

  const messages = [
    'Oh, no! The POKéMON broke free!',
    'Aww! It appeared to be caught!',
    'Aargh! Almost had it!',
  ];

  return { success: false, shakes, message: messages[shakes] };
}

function getBallMultiplier(
  ballType: number,
  species: number,
  turnCount: number,
  isUnderwater: boolean,
  alreadyCaught: boolean
): number {
  switch (ballType) {
    case ITEM_ULTRA_BALL:
      return 20;
    case ITEM_GREAT_BALL:
      return 15;
    case ITEM_POKE_BALL:
      return 10;
    case ITEM_NET_BALL:
      const types = SPECIES_INFO[species].types;
      return (types[0] === TYPE_WATER || types[0] === TYPE_BUG ||
              types[1] === TYPE_WATER || types[1] === TYPE_BUG) ? 30 : 10;
    case ITEM_DIVE_BALL:
      return isUnderwater ? 35 : 10;
    case ITEM_NEST_BALL:
      // Would need level - not passed in this example
      return 10;
    case ITEM_REPEAT_BALL:
      return alreadyCaught ? 30 : 10;
    case ITEM_TIMER_BALL:
      return Math.min(10 + turnCount, 40);
    default:
      return 10;
  }
}
```
