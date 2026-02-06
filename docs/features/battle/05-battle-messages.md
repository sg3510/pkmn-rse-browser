---
title: Battle Message System
status: reference
last_verified: 2026-01-13
---

# Battle Message System

## Source Files

- **Message Strings**: `src/battle_message.c`
- **String IDs**: `include/constants/battle_string_ids.h`
- **Message Printing**: `src/battle_message.c` (BufferStringBattle)

## Message Placeholder System

Battle messages use placeholder tokens that get replaced at runtime:

| Placeholder | Description |
|-------------|-------------|
| `{B_ATK_NAME_WITH_PREFIX}` | Attacker's name with article |
| `{B_DEF_NAME_WITH_PREFIX}` | Target's name with article |
| `{B_EFF_NAME_WITH_PREFIX}` | Effect target's name |
| `{B_SCR_ACTIVE_NAME_WITH_PREFIX}` | Script active battler |
| `{B_CURRENT_MOVE}` | Name of current move |
| `{B_BUFF1}`, `{B_BUFF2}`, `{B_BUFF3}` | General-purpose buffers |
| `{B_PLAYER_NAME}` | Player's name |
| `{B_TRAINER1_CLASS}` | Trainer's class |
| `{B_TRAINER1_NAME}` | Trainer's name |
| `{B_ATK_ABILITY}` | Attacker's ability name |
| `{B_DEF_ABILITY}` | Defender's ability name |
| `{B_LAST_ITEM}` | Last used item name |

## Core Battle Messages

### Move Usage Messages

```c
// Basic move messages
sText_AttackMissed = "{B_ATK_NAME_WITH_PREFIX}'s\nattack missed!";
sText_ItDoesntAffect = "It doesn't affect\n{B_DEF_NAME_WITH_PREFIX}…";
sText_CriticalHit = "A critical hit!";
sText_OneHitKO = "It's a one-hit KO!";
sText_SuperEffective = "It's super effective!";
sText_NotVeryEffective = "It's not very effective…";
sText_HitXTimes = "Hit {B_BUFF1} time(s)!";
sText_ButItFailed = "But it failed!";
sText_ButNothingHappened = "But nothing happened!";
```

### Status Condition Messages

```c
// Sleep
sText_PkmnFellAsleep = "{B_EFF_NAME_WITH_PREFIX}\nfell asleep!";
sText_PkmnAlreadyAsleep = "{B_DEF_NAME_WITH_PREFIX} is\nalready asleep!";
sText_PkmnFastAsleep = "{B_ATK_NAME_WITH_PREFIX} is fast\nasleep.";
sText_PkmnWokeUp = "{B_ATK_NAME_WITH_PREFIX} woke up!";

// Poison
sText_PkmnWasPoisoned = "{B_EFF_NAME_WITH_PREFIX}\nwas poisoned!";
sText_PkmnBadlyPoisoned = "{B_EFF_NAME_WITH_PREFIX} is badly\npoisoned!";
sText_PkmnHurtByPoison = "{B_ATK_NAME_WITH_PREFIX} is hurt\nby poison!";
sText_PkmnAlreadyPoisoned = "{B_DEF_NAME_WITH_PREFIX} is already\npoisoned.";

// Burn
sText_PkmnWasBurned = "{B_EFF_NAME_WITH_PREFIX} was burned!";
sText_PkmnHurtByBurn = "{B_ATK_NAME_WITH_PREFIX} is hurt\nby its burn!";
sText_PkmnAlreadyHasBurn = "{B_DEF_NAME_WITH_PREFIX} already\nhas a burn.";

// Freeze
sText_PkmnWasFrozen = "{B_EFF_NAME_WITH_PREFIX} was\nfrozen solid!";
sText_PkmnIsFrozen = "{B_ATK_NAME_WITH_PREFIX} is\nfrozen solid!";
sText_PkmnWasDefrosted = "{B_DEF_NAME_WITH_PREFIX} was\ndefrosted!";
sText_PkmnWasDefrostedBy = "{B_ATK_NAME_WITH_PREFIX} was\ndefrosted by {B_CURRENT_MOVE}!";

// Paralysis
sText_PkmnWasParalyzed = "{B_EFF_NAME_WITH_PREFIX} is paralyzed!\nIt may be unable to move!";
sText_PkmnIsParalyzed = "{B_ATK_NAME_WITH_PREFIX} is paralyzed!\nIt can't move!";
sText_PkmnIsAlreadyParalyzed = "{B_DEF_NAME_WITH_PREFIX} is\nalready paralyzed!";
sText_PkmnHealedParalysis = "{B_DEF_NAME_WITH_PREFIX} was\nhealed of paralysis!";

// Confusion
sText_PkmnWasConfused = "{B_EFF_NAME_WITH_PREFIX} became\nconfused!";
sText_PkmnIsConfused = "{B_ATK_NAME_WITH_PREFIX} is\nconfused!";
sText_ItHurtConfusion = "It hurt itself in its\nconfusion!";
sText_PkmnHealedConfusion = "{B_ATK_NAME_WITH_PREFIX} snapped\nout of confusion!";
sText_PkmnAlreadyConfused = "{B_DEF_NAME_WITH_PREFIX} is\nalready confused!";
```

### Stat Change Messages

```c
// Stat changes
sText_StatsWontIncrease = "{B_ATK_NAME_WITH_PREFIX}'s {B_BUFF1}\nwon't go higher!";
sText_StatsWontDecrease = "{B_DEF_NAME_WITH_PREFIX}'s {B_BUFF1}\nwon't go lower!";
sText_AttackersStatRose = "{B_ATK_NAME_WITH_PREFIX}'s {B_BUFF1}\n{B_BUFF2}";
sText_DefendersStatFell = "{B_DEF_NAME_WITH_PREFIX}'s {B_BUFF1}\n{B_BUFF2}";

// Stat modifiers
sText_StatSharply = "sharply ";
gText_StatRose = "rose!";
sText_StatHarshly = "harshly ";
sText_StatFell = "fell!";
```

### Fainting Messages

```c
sText_AttackerFainted = "{B_ATK_NAME_WITH_PREFIX}\nfainted!\p";
sText_TargetFainted = "{B_DEF_NAME_WITH_PREFIX}\nfainted!\p";
sText_PlayerWhiteout = "{B_PLAYER_NAME} is out of\nusable POKéMON!\p";
sText_PlayerWhiteout2 = "{B_PLAYER_NAME} whited out!{PAUSE_UNTIL_PRESS}";
```

### Battle Start/End Messages

```c
sText_WildPkmnAppeared = "Wild {B_OPPONENT_MON1_NAME} appeared!\p";
sText_TwoWildPkmnAppeared = "Wild {B_OPPONENT_MON1_NAME} and\n{B_OPPONENT_MON2_NAME} appeared!\p";
sText_Trainer1WantsToBattle = "{B_TRAINER1_CLASS} {B_TRAINER1_NAME}\nwould like to battle!\p";
sText_Trainer1SentOutPkmn = "{B_TRAINER1_CLASS} {B_TRAINER1_NAME} sent\nout {B_OPPONENT_MON1_NAME}!";
sText_GoPkmn = "Go! {B_PLAYER_MON1_NAME}!";
sText_GoTwoPkmn = "Go! {B_PLAYER_MON1_NAME} and\n{B_PLAYER_MON2_NAME}!";
sText_PlayerGotMoney = "{B_PLAYER_NAME} got ¥{B_BUFF1}\nfor winning!\p";
sText_PlayerDefeatedLinkTrainer = "Player defeated\n{B_LINK_OPPONENT1_NAME}!";
```

### Weather Messages

```c
// Rain
sText_StartedToRain = "It started to rain!";
sText_RainContinues = "Rain continues to fall.";
sText_RainStopped = "The rain stopped.";

// Sandstorm
sText_SandstormBrewed = "A sandstorm brewed!";
sText_SandstormRages = "The sandstorm rages.";
sText_SandstormSubsided = "The sandstorm subsided.";
sText_PkmnBuffetedBySandstorm = "{B_ATK_NAME_WITH_PREFIX} is buffeted\nby the sandstorm!";

// Sun
sText_SunlightGotBright = "The sunlight got bright!";
sText_SunlightStrong = "The sunlight is strong.";
sText_SunlightFaded = "The sunlight faded.";

// Hail
sText_StartedHail = "It started to hail!";
sText_HailContinues = "Hail continues to fall.";
sText_HailStopped = "The hail stopped.";
sText_PkmnPeltedByHail = "{B_ATK_NAME_WITH_PREFIX} is pelted\nby HAIL!";
```

### Ability Messages

```c
sText_PkmnMakesGroundMiss = "{B_DEF_NAME_WITH_PREFIX} makes GROUND\nmoves miss with {B_DEF_ABILITY}!";
sText_AvoidedDamage = "{B_DEF_NAME_WITH_PREFIX} avoided\ndamage with {B_DEF_ABILITY}!";
sText_PkmnProtectedBy = "{B_DEF_NAME_WITH_PREFIX} was protected\nby {B_DEF_ABILITY}!";
sText_PkmnHurtsWith = "{B_DEF_NAME_WITH_PREFIX}'s {B_DEF_ABILITY}\nhurt {B_ATK_NAME_WITH_PREFIX}!";
sText_PkmnTraced = "{B_SCR_ACTIVE_NAME_WITH_PREFIX} TRACED\n{B_BUFF1}'s {B_BUFF2}!";
sText_PkmnsXMadeYUseless = "{B_DEF_NAME_WITH_PREFIX}'s {B_DEF_ABILITY}\nmade {B_CURRENT_MOVE} useless!";
sText_PkmnCutsAttackWith = "{B_SCR_ACTIVE_NAME_WITH_PREFIX}'s {B_SCR_ACTIVE_ABILITY}\ncuts {B_DEF_NAME_WITH_PREFIX}'s ATTACK!";
```

### Move-Specific Messages

```c
// Two-turn moves
sText_PkmnWhippedWhirlwind = "{B_ATK_NAME_WITH_PREFIX} whipped\nup a whirlwind!";
sText_PkmnTookSunlight = "{B_ATK_NAME_WITH_PREFIX} took\nin sunlight!";
sText_PkmnLoweredHead = "{B_ATK_NAME_WITH_PREFIX} lowered\nits head!";
sText_PkmnIsGlowing = "{B_ATK_NAME_WITH_PREFIX} is glowing!";
sText_PkmnFlewHigh = "{B_ATK_NAME_WITH_PREFIX} flew\nup high!";
sText_PkmnDugHole = "{B_ATK_NAME_WITH_PREFIX} dug a hole!";
sText_PkmnHidUnderwater = "{B_ATK_NAME_WITH_PREFIX} hid\nunderwater!";
sText_PkmnSprangUp = "{B_ATK_NAME_WITH_PREFIX} sprang up!";

// Entry hazards
sText_SpikesScattered = "SPIKES were scattered all around\nthe opponent's side!";
sText_PkmnHurtBySpikes = "{B_SCR_ACTIVE_NAME_WITH_PREFIX} is hurt\nby SPIKES!";

// Substitute
sText_PkmnMadeSubstitute = "{B_ATK_NAME_WITH_PREFIX} made\na SUBSTITUTE!";
sText_PkmnHasSubstitute = "{B_ATK_NAME_WITH_PREFIX} already\nhas a SUBSTITUTE!";
sText_SubstituteDamaged = "The SUBSTITUTE took damage\nfor {B_DEF_NAME_WITH_PREFIX}!\p";
sText_PkmnSubstituteFaded = "{B_DEF_NAME_WITH_PREFIX}'s\nSUBSTITUTE faded!\p";
sText_TooWeakForSubstitute = "It was too weak to make\na SUBSTITUTE!";

// Trapping moves
sText_PkmnSqueezedByBind = "{B_DEF_NAME_WITH_PREFIX} was squeezed by\n{B_ATK_NAME_WITH_PREFIX}'s BIND!";
sText_PkmnTrappedInVortex = "{B_DEF_NAME_WITH_PREFIX} was trapped\nin the vortex!";
sText_PkmnTrappedBySandTomb = "{B_DEF_NAME_WITH_PREFIX} was trapped\nby SAND TOMB!";
sText_PkmnWrappedBy = "{B_DEF_NAME_WITH_PREFIX} was WRAPPED by\n{B_ATK_NAME_WITH_PREFIX}!";
sText_PkmnClamped = "{B_ATK_NAME_WITH_PREFIX} CLAMPED\n{B_DEF_NAME_WITH_PREFIX}!";
sText_PkmnHurtBy = "{B_ATK_NAME_WITH_PREFIX} is hurt\nby {B_BUFF1}!";
sText_PkmnFreedFrom = "{B_ATK_NAME_WITH_PREFIX} was freed\nfrom {B_BUFF1}!";

// Recoil
sText_PkmnHitWithRecoil = "{B_ATK_NAME_WITH_PREFIX} is hit\nwith recoil!";
sText_PkmnCrashed = "{B_ATK_NAME_WITH_PREFIX} kept going\nand crashed!";
```

## String ID Constants

From `include/constants/battle_string_ids.h`:

```c
#define STRINGID_USEDMOVE               4
#define STRINGID_ATTACKMISSED           23
#define STRINGID_ITDOESNTAFFECT         27
#define STRINGID_ATTACKERFAINTED        28
#define STRINGID_TARGETFAINTED          29
#define STRINGID_CRITICALHIT            217
#define STRINGID_ONEHITKO               218
#define STRINGID_NOTVERYEFFECTIVE       221
#define STRINGID_SUPEREFFECTIVE         222
#define STRINGID_HITXTIMES              34
#define STRINGID_BUTITFAILED            229
#define STRINGID_BUTNOTHINGHAPPENED     228
#define STRINGID_ITHURTCONFUSION        230
#define STRINGID_PKMNFELLASLEEP         35
#define STRINGID_PKMNWOKEUP             108
#define STRINGID_PKMNWASPOISONED        40
#define STRINGID_PKMNWASBURNED          46
#define STRINGID_PKMNWASFROZEN          49
#define STRINGID_PKMNWASPARALYZED       55
#define STRINGID_PKMNWASCONFUSED        67
// ... many more
```

## Message Buffer Function

From `src/battle_message.c`:

```c
void BufferStringBattle(u16 stringID)
{
    s32 i;
    const u8 *stringPtr = NULL;

    // Look up string by ID
    stringPtr = gBattleStringsTable[stringID - BATTLESTRINGS_TABLE_START];

    // Expand placeholders
    ExpandBattleTextBuffPlaceholders(stringPtr, gBattleTextBuff1);
}

static void ExpandBattleTextBuffPlaceholders(const u8 *src, u8 *dst)
{
    u8 c;
    while (*src != EOS) {
        c = *src++;
        if (c == PLACEHOLDER_BEGIN) {
            switch (*src++) {
            case B_TXT_BUFF1:
                StringCopy(dst, gBattleTextBuff1);
                break;
            case B_TXT_ATK_NAME_WITH_PREFIX:
                GetBattlerNickname(gBattlerAttacker, dst);
                break;
            case B_TXT_DEF_NAME_WITH_PREFIX:
                GetBattlerNickname(gBattlerTarget, dst);
                break;
            case B_TXT_CURRENT_MOVE:
                StringCopy(dst, gMoveNames[gCurrentMove]);
                break;
            // ... many more cases
            }
        } else {
            *dst++ = c;
        }
    }
    *dst = EOS;
}
```

## TypeScript Message Interface

```typescript
interface BattleMessageContext {
  attacker: BattlePokemon;
  defender: BattlePokemon;
  move?: Move;
  damage?: number;
  effectiveness?: 'immune' | 'not_effective' | 'neutral' | 'super_effective';
  isCritical?: boolean;
  hitCount?: number;
}

const MESSAGES = {
  used_move: (ctx: BattleMessageContext) =>
    `${ctx.attacker.name} used ${ctx.move!.name}!`,

  attack_missed: (ctx: BattleMessageContext) =>
    `${ctx.attacker.name}'s attack missed!`,

  doesnt_affect: (ctx: BattleMessageContext) =>
    `It doesn't affect ${ctx.defender.name}...`,

  critical_hit: () => "A critical hit!",

  super_effective: () => "It's super effective!",

  not_very_effective: () => "It's not very effective...",

  fainted: (ctx: BattleMessageContext) =>
    `${ctx.defender.name} fainted!`,

  fell_asleep: (ctx: BattleMessageContext) =>
    `${ctx.defender.name} fell asleep!`,

  // ... etc
};

function formatBattleMessage(
  messageKey: keyof typeof MESSAGES,
  context: BattleMessageContext
): string {
  return MESSAGES[messageKey](context);
}
```
