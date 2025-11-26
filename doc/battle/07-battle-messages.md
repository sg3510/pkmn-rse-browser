# Battle Message System

The battle message system handles all text displayed during battles, using a template system with placeholders.

## Message Structure

Messages are stored in `battle_message.c` and use special placeholder tokens:

```c
// Placeholder tokens
#define B_TXT_BUFF1              0xFD  // Buffer 1
#define B_TXT_BUFF2              0xFE  // Buffer 2
#define B_TXT_BUFF3              0xFF  // Buffer 3
#define B_TXT_COPY_VAR           0xFC  // Variable

// Name placeholders
#define B_TXT_ATK_NAME_WITH_PREFIX   // Attacking Pokemon with "The opposing", etc.
#define B_TXT_DEF_NAME_WITH_PREFIX   // Defending Pokemon with prefix
#define B_TXT_PLAYER_NAME            // Player's name
#define B_TXT_TRAINER1_NAME          // Trainer's name
```

## Key Battle Messages

### Intro Messages

```c
// Wild battle
"Wild {B_DEF_NAME} appeared!"

// Trainer battle
"{B_TRAINER1_CLASS} {B_TRAINER1_NAME}\nwould like to battle!"
"{B_TRAINER1_NAME} sent out\n{B_OPPONENT_MON1_NAME}!"

// Player sends out
"Go! {B_PLAYER_MON1_NAME}!"
```

### Attack Messages

```c
// Move used
"{B_ATK_NAME_WITH_PREFIX}\nused {B_CURRENT_MOVE}!"

// Critical hit
"A critical hit!"

// Super effective
"It's super effective!"

// Not very effective
"It's not very effective..."

// No effect
"It doesn't affect\n{B_DEF_NAME_WITH_PREFIX}..."

// Miss
"{B_ATK_NAME_WITH_PREFIX}'s\nattack missed!"
```

### Damage Messages

```c
// Fainted
"{B_DEF_NAME_WITH_PREFIX}\nfainted!"

// Hit multiple times
"Hit {B_BUFF1} time(s)!"

// Recoil
"{B_ATK_NAME_WITH_PREFIX} is hit\nwith recoil!"
```

### Status Messages

```c
// Status inflicted
"{B_EFF_NAME_WITH_PREFIX}\nwas poisoned!"
"{B_EFF_NAME_WITH_PREFIX} was burned!"
"{B_EFF_NAME_WITH_PREFIX} was\nfrozen solid!"
"{B_EFF_NAME_WITH_PREFIX} is paralyzed!\nIt may be unable to move!"
"{B_EFF_NAME_WITH_PREFIX}\nfell asleep!"
"{B_EFF_NAME_WITH_PREFIX} became\nconfused!"

// Status damage
"{B_ATK_NAME_WITH_PREFIX} is hurt\nby poison!"
"{B_ATK_NAME_WITH_PREFIX} is hurt\nby its burn!"

// Status recovery
"{B_ATK_NAME_WITH_PREFIX} woke up!"
"{B_DEF_NAME_WITH_PREFIX} was\ndefrosted!"
"{B_ATK_NAME_WITH_PREFIX} snapped\nout of confusion!"
```

### Stat Changes

```c
// Stat rose
"{B_ATK_NAME_WITH_PREFIX}'s\n{B_BUFF1} rose!"
"{B_ATK_NAME_WITH_PREFIX}'s\n{B_BUFF1} sharply rose!"
"{B_ATK_NAME_WITH_PREFIX}'s\n{B_BUFF1} rose drastically!"

// Stat fell
"{B_DEF_NAME_WITH_PREFIX}'s\n{B_BUFF1} fell!"
"{B_DEF_NAME_WITH_PREFIX}'s\n{B_BUFF1} harshly fell!"
"{B_DEF_NAME_WITH_PREFIX}'s\n{B_BUFF1} severely fell!"

// Can't go higher/lower
"{B_ATK_NAME_WITH_PREFIX}'s {B_BUFF1}\nwon't go higher!"
"{B_DEF_NAME_WITH_PREFIX}'s {B_BUFF1}\nwon't go lower!"
```

### Weather Messages

```c
// Weather started
"Rain began to fall!"
"The sunlight turned harsh!"
"A sandstorm kicked up!"
"It started to hail!"

// Weather continues
"Rain continues to fall."
"The sunlight is strong."
"The sandstorm rages."
"Hail continues to fall."

// Weather damage
"{B_ATK_NAME_WITH_PREFIX} is buffeted\nby the sandstorm!"
"{B_ATK_NAME_WITH_PREFIX} is pelted\nby HAIL!"

// Weather ended
"The rain stopped."
"The sunlight faded."
"The sandstorm subsided."
"The hail stopped."
```

### Experience and Level

```c
// Gained EXP
"{B_BUFF1} gained{B_BUFF2}\n{B_BUFF3} EXP. Points!"

// Level up
"{B_BUFF1} grew to\nLV. {B_BUFF2}!"

// Learning move
"{B_BUFF1} learned\n{B_BUFF2}!"
"{B_BUFF1} is trying to\nlearn {B_BUFF2}."
"But, {B_BUFF1} can't learn\nmore than four moves."
"Delete a move to make\nroom for {B_BUFF2}?"
"{B_BUFF1} forgot\n{B_BUFF2}."
"{B_BUFF1} did not learn\n{B_BUFF2}."
```

### Capture Messages

```c
// Success
"Gotcha!\n{B_DEF_NAME} was caught!"

// Failure (by shake count)
"Oh, no!\nThe POKéMON broke free!"      // 0 shakes
"Aww!\nIt appeared to be caught!"        // 1 shake
"Aargh!\nAlmost had it!"                 // 2 shakes
"Shoot!\nIt was so close, too!"          // 3 shakes but fail

// PC sent
"{B_DEF_NAME} was sent to\n{B_PC_BOX_NAME} in PC."

// Trainer block
"The TRAINER blocked the BALL!\nDon't be a thief!"
```

### Battle End Messages

```c
// Player wins
"{B_PLAYER_NAME} defeated\n{B_TRAINER1_CLASS} {B_TRAINER1_NAME}!"
"{B_PLAYER_NAME} got ¥{B_BUFF1}\nfor winning!"

// Player loses
"{B_PLAYER_NAME} is out of\nusable POKéMON!"
"{B_PLAYER_NAME} whited out!"

// Wild Pokemon fled
"Wild {B_ATK_NAME} fled!"

// Player ran
"Got away safely!"
"Can't escape!"
```

## Message String IDs

Located in `constants/battle_string_ids.h`:

```c
#define STRINGID_INTROMSG           0
#define STRINGID_INTROSENDOUT       1
#define STRINGID_RETURNMON          2
#define STRINGID_SWITCHINMON        3
#define STRINGID_USEDMOVE           4
#define STRINGID_ATTACKMISSED       23
#define STRINGID_PKMNPROTECTEDITSELF 24
#define STRINGID_ITDOESNTAFFECT     27
#define STRINGID_ATTACKERFAINTED    28
#define STRINGID_TARGETFAINTED      29
#define STRINGID_PLAYERGOTMONEY     30
// ... 300+ string IDs
```

## Buffer System

The message system uses three buffers for dynamic content:

```c
EWRAM_DATA u8 gBattleTextBuff1[TEXT_BUFF_ARRAY_COUNT] = {0};
EWRAM_DATA u8 gBattleTextBuff2[TEXT_BUFF_ARRAY_COUNT] = {0};
EWRAM_DATA u8 gBattleTextBuff3[TEXT_BUFF_ARRAY_COUNT] = {0};

// Buffer commands
#define B_BUFF_STRING              0  // Copy string
#define B_BUFF_NUMBER              1  // Number to string
#define B_BUFF_MON_NICK_NO_NAME    2  // Pokemon nickname (no species name)
#define B_BUFF_MON_NICK_WITH_NAME  3  // Pokemon nickname + species
#define B_BUFF_MOVE                4  // Move name
#define B_BUFF_TYPE                5  // Type name
#define B_BUFF_MON_NICK_PREFIX     6  // With "the opposing" prefix
#define B_BUFF_STAT                7  // Stat name
#define B_BUFF_SPECIES             8  // Species name
#define B_BUFF_ITEM                9  // Item name
#define B_BUFF_ABILITY             10 // Ability name
```

## Printing Messages

```c
// Queue a message for display
void PrepareStringBattle(u16 stringId, u8 battler) {
    gActiveBattler = battler;
    BtlController_EmitPrintString(stringId, CONTROLLER_COMMAND);
    MarkBattlerForControllerExec(gActiveBattler);
}

// Print directly
void BattlePutTextOnWindow(const u8 *text, u8 windowId) {
    // ... text rendering
}
```

## Speed and Timing

Message display speed is controlled by player settings:

```c
// Text speed options
#define OPTIONS_TEXT_SPEED_SLOW   0  // Slow
#define OPTIONS_TEXT_SPEED_MID    1  // Normal
#define OPTIONS_TEXT_SPEED_FAST   2  // Fast
```

## Implementation Notes for React

```typescript
// Message template system
interface BattleMessage {
  stringId: number;
  template: string;
}

const BATTLE_MESSAGES: Map<number, string> = new Map([
  [STRINGID_USEDMOVE, '{ATK_NAME} used {MOVE}!'],
  [STRINGID_CRITICALHIT, 'A critical hit!'],
  [STRINGID_SUPEREFFECTIVE, "It's super effective!"],
  [STRINGID_NOTVERYEFFECTIVE, "It's not very effective..."],
  // ... all messages
]);

interface MessageContext {
  attackerName: string;
  defenderName: string;
  playerName: string;
  trainerName: string;
  moveName: string;
  typeName: string;
  statName: string;
  itemName: string;
  abilityName: string;
  number1: number;
  number2: number;
  number3: number;
}

function formatBattleMessage(
  stringId: number,
  context: MessageContext
): string {
  const template = BATTLE_MESSAGES.get(stringId);
  if (!template) return '';

  return template
    .replace('{ATK_NAME}', context.attackerName)
    .replace('{DEF_NAME}', context.defenderName)
    .replace('{PLAYER_NAME}', context.playerName)
    .replace('{MOVE}', context.moveName)
    .replace('{TYPE}', context.typeName)
    .replace('{STAT}', context.statName)
    .replace('{ITEM}', context.itemName)
    .replace('{NUM1}', String(context.number1))
    .replace('{NUM2}', String(context.number2))
    .replace('{NUM3}', String(context.number3));
}

// Message queue for sequential display
class BattleMessageQueue {
  private messages: string[] = [];
  private currentIndex = 0;

  add(message: string) {
    this.messages.push(message);
  }

  getNext(): string | null {
    if (this.currentIndex >= this.messages.length) return null;
    return this.messages[this.currentIndex++];
  }

  hasMore(): boolean {
    return this.currentIndex < this.messages.length;
  }

  clear() {
    this.messages = [];
    this.currentIndex = 0;
  }
}
```
