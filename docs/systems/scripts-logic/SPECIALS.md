---
title: Special Functions
status: reference
last_verified: 2026-01-13
---

# Special Functions

Special functions are C functions that can be called from scripts for complex operations.

## Source Files

- `public/pokeemerald/data/specials.inc` - Table definition
- Various `.c` files implementing functions

## How Specials Work

### Script Commands

```asm
@ Call special with no return value
special HealPlayerParty

@ Call special and store result in variable
specialvar VAR_RESULT, HasAllHoennMons
```

### C Implementation

```c
// In data/specials.inc
gSpecials::
    def_special HealPlayerParty         @ Index 0
    def_special SetCableClubWarp        @ Index 1
    def_special DoCableClubWarp         @ Index 2
    // ...

// In scrcmd.c
bool8 ScrCmd_special(struct ScriptContext *ctx)
{
    u16 index = ScriptReadHalfword(ctx);
    gSpecials[index]();  // Call function
    return FALSE;
}

bool8 ScrCmd_specialvar(struct ScriptContext *ctx)
{
    u16 *var = GetVarPointer(ScriptReadHalfword(ctx));
    *var = gSpecials[ScriptReadHalfword(ctx)]();  // Call and store result
    return FALSE;
}
```

## Common Specials

### Party/Pokemon

| Index | Name | Description |
|-------|------|-------------|
| 0 | `HealPlayerParty` | Heal all Pokemon |
| 51 | `SavePlayerParty` | Save party to temp |
| 52 | `LoadPlayerParty` | Load party from temp |
| 53 | `ChooseHalfPartyForBattle` | Multi battle selection |
| 75 | `HasEnoughMonsForDoubleBattle` | Check party size |

### Starter Selection

| Index | Name | Description |
|-------|------|-------------|
| 254 | `ChooseStarter` | Starter selection UI |
| 255 | `GetStarterChoice` | Get selected starter |

### Battle

| Index | Name | Description |
|-------|------|-------------|
| 65 | `GetTrainerBattleMode` | Get battle mode |
| 66 | `ShowTrainerIntroSpeech` | Show trainer text |
| 68 | `GetTrainerFlag` | Check if defeated |
| 69 | `DoTrainerApproach` | Trainer walks up |

### Storage/PC

| Index | Name | Description |
|-------|------|-------------|
| 74 | `ShowPokemonStorageSystemPC` | Open PC |

### Map/Warp

| Index | Name | Description |
|-------|------|-------------|
| 1 | `SetCableClubWarp` | Set link warp |
| 2 | `DoCableClubWarp` | Execute warp |

### Clock/Time

| Index | Name | Description |
|-------|------|-------------|
| 180 | `StartWallClock` | Clock setting UI |

### Sound/Music

| Index | Name | Description |
|-------|------|-------------|
| 70 | `PlayTrainerEncounterMusic` | Battle music |

### Field Effects

| Index | Name | Description |
|-------|------|-------------|
| 31 | `GetObjectEventLocalIdByFlag` | Find object by flag |

## Specials That Yield

Some specials trigger async operations (UI, animations) that require `waitstate`:

```asm
@ Correct usage:
special ChooseStarter
waitstate  @ Wait for selection UI to complete

@ The starter choice is now in VAR_STARTER_CHOICE
```

Common yield specials:
- `ChooseStarter` - Starter selection
- `ShowPokemonStorageSystemPC` - PC interface
- `StartWallClock` - Clock setting

## TypeScript Implementation

### Special Registry

```typescript
type SpecialFunc = () => number | Promise<number>;

const specials: Map<number, SpecialFunc> = new Map([
  // 0: HealPlayerParty
  [0, () => {
    for (const mon of gameState.party) {
      mon.currentHp = mon.stats.hp;
      mon.status = 0;
      for (const pp of mon.movePPs) {
        pp.current = pp.max;
      }
    }
    return 0;
  }],

  // 74: ShowPokemonStorageSystemPC
  [74, async () => {
    await showStorageUI();
    return 0;
  }],

  // 180: StartWallClock
  [180, async () => {
    const time = await showClockSettingUI();
    gameState.gameTime = time;
    return 0;
  }],

  // 254: ChooseStarter
  [254, async () => {
    const choice = await showStarterSelectionUI();
    gameVars.set(VAR_STARTER_CHOICE, choice);
    return choice;
  }],
]);
```

### Command Handler

```typescript
// 0x25: special idx
commands.set(0x25, async (ctx) => {
  const index = readHalfword(ctx);
  const special = specials.get(index);

  if (special) {
    await special();
  } else {
    console.warn(`Unknown special: ${index}`);
  }

  return false;
});

// 0x26: specialvar var, idx
commands.set(0x26, async (ctx) => {
  const varId = readHalfword(ctx);
  const index = readHalfword(ctx);
  const special = specials.get(index);

  if (special) {
    const result = await special();
    gameVars.set(varId, result);
  } else {
    console.warn(`Unknown special: ${index}`);
    gameVars.set(varId, 0);
  }

  return false;
});
```

## Key Specials to Implement

### Priority 1: Core Gameplay

```typescript
const coreSpecials = [
  'HealPlayerParty',        // 0
  'ChooseStarter',          // 254
  'GetStarterChoice',       // 255
  'StartWallClock',         // 180
  'ShowPokemonStorageSystemPC', // 74
];
```

### Priority 2: Battle System

```typescript
const battleSpecials = [
  'GetTrainerBattleMode',
  'ShowTrainerIntroSpeech',
  'GetTrainerFlag',
  'DoTrainerApproach',
  'PlayTrainerEncounterMusic',
];
```

### Priority 3: NPCs/Events

```typescript
const eventSpecials = [
  'GetObjectEventLocalIdByFlag',
  'SetObjectEventXY',
  'TurnObjectEvent',
];
```

## Stubbing Unknown Specials

For specials not yet implemented:

```typescript
function getSpecial(index: number): SpecialFunc {
  const special = specials.get(index);
  if (special) return special;

  // Return stub that logs warning
  return () => {
    console.warn(`[Script] Unimplemented special: ${index}`);
    return 0;
  };
}
```

## Finding Special Index

To find the index of a special in the source:

1. Open `data/specials.inc`
2. Count from 0 at `gSpecials::`
3. Or use the `SPECIAL_` constants

```asm
@ In specials.inc
.set SPECIAL_HealPlayerParty, 0
.set SPECIAL_SetCableClubWarp, 1
...
```

## Cross-Reference with Scripts

Example from starter selection:

```asm
@ In data/maps/Route101/scripts.inc
Route101_EventScript_BirchsBag::
    lock
    faceplayer
    setflag FLAG_SYS_POKEMON_GET
    setflag FLAG_RESCUED_BIRCH
    fadescreen FADE_TO_BLACK
    special ChooseStarter      @ Special 254
    waitstate                  @ Wait for UI
    @ ...
```

Corresponding TypeScript:

```typescript
// When executing this script
async executeSpecial254() {
  // Show selection UI
  const selectedIndex = await starterSelectionUI.show([
    { species: SPECIES_TREECKO, level: 5 },
    { species: SPECIES_TORCHIC, level: 5 },
    { species: SPECIES_MUDKIP, level: 5 },
  ]);

  // Give the Pokemon
  const starter = createPokemon(
    starterSpecies[selectedIndex],
    5
  );
  gameState.party.push(starter);

  return selectedIndex;
}
```
