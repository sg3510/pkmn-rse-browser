# Game Initialization & Save System

## Source Files
- `src/new_game.c` - New game initialization
- `src/load_save.c` - Save data loading
- `src/save.c` - Save system core
- `include/global.h` - Save block structures
- `include/save.h` - Save constants

## Save Data Structure

Pokemon Emerald uses a multi-block save system stored in Flash memory.

### Save Blocks Overview

```c
// Two main save blocks plus Pokemon storage
struct SaveBlock1;      // Main game state (3968 bytes x 4 sectors)
struct SaveBlock2;      // Player options and Pokedex (3968 bytes x 1 sector)
struct PokemonStorage;  // PC boxes (3968 bytes x 9 sectors)
```

### Sector Layout

```c
#define SECTOR_DATA_SIZE 3968
#define SECTOR_SIZE 4096   // 4KB per sector
#define NUM_SECTORS_PER_SLOT 14

// Sector assignments:
#define SECTOR_ID_SAVEBLOCK2          0    // Player info, options
#define SECTOR_ID_SAVEBLOCK1_START    1    // Main game state...
#define SECTOR_ID_SAVEBLOCK1_END      4    // ...across 4 sectors
#define SECTOR_ID_PKMN_STORAGE_START  5    // Pokemon boxes...
#define SECTOR_ID_PKMN_STORAGE_END   13    // ...across 9 sectors

// Special sectors (outside save slots)
#define SECTOR_ID_HOF_1              28    // Hall of Fame 1
#define SECTOR_ID_HOF_2              29    // Hall of Fame 2
#define SECTOR_ID_TRAINER_HILL       30    // Trainer Hill
#define SECTOR_ID_RECORDED_BATTLE    31    // Battle recording
```

### Sector Structure

```c
struct SaveSector {
    u8 data[SECTOR_DATA_SIZE];     // 3968 bytes of actual data
    u8 unused[116];                 // Padding
    u16 id;                         // Sector ID (0-13)
    u16 checksum;                   // Data integrity check
    u32 signature;                  // Must be 0x08012025
    u32 counter;                    // Save counter for slot detection
}; // Total: 4096 bytes
```

### Save Status Values

```c
#define SAVE_STATUS_EMPTY    0    // No save data
#define SAVE_STATUS_OK       1    // Valid save found
#define SAVE_STATUS_CORRUPT  2    // Checksum failed
#define SAVE_STATUS_NO_FLASH 4    // Flash memory error
#define SAVE_STATUS_ERROR    0xFF // General error
```

## SaveBlock2 Structure (Player/Options)

```c
// Key fields in SaveBlock2
struct SaveBlock2 {
    u8 playerName[PLAYER_NAME_LENGTH + 1];  // 8 bytes
    u8 playerGender;                         // MALE or FEMALE
    u8 specialSaveWarpFlags;
    u8 playerTrainerId[TRAINER_ID_LENGTH];  // 4 bytes

    u16 playTimeHours;
    u8 playTimeMinutes;
    u8 playTimeSeconds;
    u8 playTimeVBlankCounter;

    // Options
    u8 optionsButtonMode;
    u8 optionsTextSpeed;
    u8 optionsWindowFrameType;
    u8 optionsSound;              // Mono/Stereo
    u8 optionsBattleStyle;        // Set/Shift
    u8 optionsBattleSceneOff;
    u8 regionMapZoom;

    struct Pokedex pokedex;
    // ... more fields
};
```

## SaveBlock1 Structure (Game State)

```c
// Key fields in SaveBlock1
struct SaveBlock1 {
    struct Coords16 pos;              // Player position
    struct WarpData location;         // Current map
    struct WarpData continueGameWarp;
    struct WarpData dynamicWarp;
    struct WarpData lastHealLocation;
    struct WarpData escapeWarp;

    u16 savedMusic;
    u8 weather;
    u8 weatherCycleStage;
    u8 flashLevel;

    u16 mapLayoutId;
    u16 mapView[0x100];
    u8 playerPartyCount;
    struct Pokemon playerParty[PARTY_SIZE];

    u32 money;
    u16 coins;

    struct ItemSlot pcItems[PC_ITEMS_COUNT];
    struct ItemSlot bagPocket_Items[BAG_ITEMS_COUNT];
    struct ItemSlot bagPocket_KeyItems[BAG_KEYITEMS_COUNT];
    struct ItemSlot bagPocket_PokeBalls[BAG_POKEBALLS_COUNT];
    struct ItemSlot bagPocket_TMHM[BAG_TMHM_COUNT];
    struct ItemSlot bagPocket_Berries[BAG_BERRIES_COUNT];

    // Event state
    u8 flags[NUM_FLAG_BYTES];
    u16 vars[VARS_COUNT];

    // ... many more fields
};
```

## New Game Initialization

### Entry Point

```c
// Called from CB2_NewGame (after Birch speech)
void NewGameInitData(void)
```

### Full Initialization Sequence

```c
void NewGameInitData(void)
{
    // 1. Reset RTC if save was empty/corrupt
    if (gSaveFileStatus == SAVE_STATUS_EMPTY || gSaveFileStatus == SAVE_STATUS_CORRUPT)
        RtcReset();

    // 2. Mark as new save file
    gDifferentSaveFile = TRUE;
    gSaveBlock2Ptr->encryptionKey = 0;

    // 3. Clear party data
    ZeroPlayerPartyMons();
    ZeroEnemyPartyMons();

    // 4. Reset Pokedex
    ResetPokedex();
    ClearPokedexFlags();

    // 5. Clear Battle Frontier records
    ClearFrontierRecord();

    // 6. Clear SaveBlock1 and mail
    ClearSav1();
    ClearAllMail();

    // 7. Initialize player
    gSaveBlock2Ptr->specialSaveWarpFlags = 0;
    gSaveBlock2Ptr->gcnLinkFlags = 0;
    InitPlayerTrainerId();       // Generate random trainer ID
    PlayTimeCounter_Reset();

    // 8. Initialize event system
    InitEventData();

    // 9. Clear TV data
    ClearTVShowData();
    ResetGabbyAndTy();

    // 10. Clear secret bases
    ClearSecretBases();

    // 11. Clear berry trees
    ClearBerryTrees();

    // 12. Set starting money ($3000)
    SetMoney(&gSaveBlock1Ptr->money, 3000);
    SetCoins(0);

    // 13. Reset contest data
    ResetLinkContestBoolean();

    // 14. Clear game stats
    ResetGameStats();

    // 15. Clear contest winner pictures
    ClearAllContestWinnerPics();

    // 16. Clear battle records
    ClearPlayerLinkBattleRecords();

    // 17. Initialize size records
    InitSeedotSizeRecord();
    InitLotadSizeRecord();

    // 18. Clear party
    gPlayerPartyCount = 0;
    ZeroPlayerPartyMons();

    // 19. Reset PC storage
    ResetPokemonStorageSystem();

    // 20. Clear roamer data
    ClearRoamerData();
    ClearRoamerLocationData();

    // 21. Clear bag
    gSaveBlock1Ptr->registeredItem = ITEM_NONE;
    ClearBag();

    // 22. Initialize PC items (includes Potion)
    NewGameInitPCItems();

    // 23. Clear Pokeblocks
    ClearPokeblocks();

    // 24. Clear decorations
    ClearDecorationInventories();

    // 25. Initialize Easy Chat
    InitEasyChatPhrases();

    // 26. Set Mauville Old Man
    SetMauvilleOldMan();

    // 27. Initialize Dewford trend
    InitDewfordTrend();

    // 28. Reset Fan Club
    ResetFanClub();

    // 29. Reset Lottery Corner
    ResetLotteryCorner();

    // 30. WARP TO TRUCK
    WarpToTruck();

    // 31. Reset all map flags via script
    RunScriptImmediately(EventScript_ResetAllMapFlags);

    // 32. Reset minigames
    ResetMiniGamesRecords();

    // 33. Initialize Union Room chat
    InitUnionRoomChatRegisteredTexts();

    // 34. Initialize Lilycove Lady
    InitLilycoveLady();

    // 35. Reset Apprentice data
    ResetAllApprenticeData();

    // 36. Clear ranking hall
    ClearRankingHallRecords();

    // 37. Initialize Match Call
    InitMatchCallCounters();

    // 38. Clear Mystery Gift
    ClearMysteryGift();

    // 39. Wipe trainer name records
    WipeTrainerNameRecords();

    // 40. Reset Trainer Hill
    ResetTrainerHillResults();

    // 41. Reset contest link results
    ResetContestLinkResults();
}
```

### Trainer ID Generation

```c
static void InitPlayerTrainerId(void)
{
    // Generate random 32-bit trainer ID
    u32 trainerId = (Random() << 16) | GetGeneratedTrainerIdLower();
    SetTrainerId(trainerId, gSaveBlock2Ptr->playerTrainerId);
}

void SetTrainerId(u32 trainerId, u8 *dst)
{
    // Store as little-endian bytes
    dst[0] = trainerId;
    dst[1] = trainerId >> 8;
    dst[2] = trainerId >> 16;
    dst[3] = trainerId >> 24;
}
```

### Default Options

```c
static void SetDefaultOptions(void)
{
    gSaveBlock2Ptr->optionsTextSpeed = OPTIONS_TEXT_SPEED_MID;
    gSaveBlock2Ptr->optionsWindowFrameType = 0;
    gSaveBlock2Ptr->optionsSound = OPTIONS_SOUND_MONO;
    gSaveBlock2Ptr->optionsBattleStyle = OPTIONS_BATTLE_STYLE_SHIFT;
    gSaveBlock2Ptr->optionsBattleSceneOff = FALSE;
    gSaveBlock2Ptr->regionMapZoom = FALSE;
}
```

### PC Starting Items

```c
// Player's PC starts with 1 Potion
void NewGameInitPCItems(void)
{
    AddPCItem(ITEM_POTION, 1);
}
```

## Save Loading

### Load Process

```c
u8 LoadGameSave(u8 saveType)
{
    // 1. Determine which save slot is more recent
    //    (uses counter field in sector footer)

    // 2. Read sectors and verify checksums

    // 3. Load into RAM save blocks:
    //    - gSaveBlock1Ptr
    //    - gSaveBlock2Ptr
    //    - gPokemonStoragePtr

    // 4. Return status
    return gSaveFileStatus;
}
```

### Continue Game Flow

```c
// Called when player selects CONTINUE
void CB2_ContinueSavedGame(void)
{
    // 1. Load saved position and map
    // 2. Initialize overworld
    // 3. Resume gameplay at saved location
}
```

## Browser Implementation

### Save Data Interface

```typescript
interface SaveBlock2 {
  playerName: string;
  playerGender: 'male' | 'female';
  trainerId: number;
  secretId: number;

  playTime: {
    hours: number;
    minutes: number;
    seconds: number;
  };

  options: {
    textSpeed: 'slow' | 'mid' | 'fast';
    windowFrame: number;
    sound: 'mono' | 'stereo';
    battleStyle: 'shift' | 'set';
    battleScene: boolean;
    buttonMode: 'normal' | 'lr' | 'l_equals_a';
  };

  pokedex: {
    owned: boolean[];   // 386+ entries
    seen: boolean[];
    nationalMode: boolean;
  };
}

interface SaveBlock1 {
  location: {
    mapGroup: number;
    mapNum: number;
    x: number;
    y: number;
  };

  respawnLocation: HealLocation;

  party: Pokemon[];
  partyCount: number;

  money: number;
  coins: number;

  bag: {
    items: ItemSlot[];
    keyItems: ItemSlot[];
    pokeBalls: ItemSlot[];
    tmhm: ItemSlot[];
    berries: ItemSlot[];
  };

  pcItems: ItemSlot[];

  flags: boolean[];   // Event flags
  vars: number[];     // Event variables
}

interface PokemonStorage {
  currentBox: number;
  boxes: PokemonBox[];
  boxNames: string[];
  boxWallpapers: number[];
}

interface GameSave {
  block1: SaveBlock1;
  block2: SaveBlock2;
  storage: PokemonStorage;
  checksum: number;
  timestamp: number;
}
```

### LocalStorage Save Manager

```typescript
const SAVE_KEY = 'pokemon_emerald_save';
const SAVE_VERSION = 1;

class SaveManager {
  static async save(data: GameSave): Promise<boolean> {
    try {
      const saveData = {
        version: SAVE_VERSION,
        data: data,
        checksum: this.calculateChecksum(data),
        timestamp: Date.now(),
      };

      localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
      return true;
    } catch (e) {
      console.error('Save failed:', e);
      return false;
    }
  }

  static async load(): Promise<{ status: SaveStatus; data?: GameSave }> {
    try {
      const raw = localStorage.getItem(SAVE_KEY);

      if (!raw) {
        return { status: 'empty' };
      }

      const saveData = JSON.parse(raw);

      // Verify version
      if (saveData.version !== SAVE_VERSION) {
        return { status: 'corrupt' };
      }

      // Verify checksum
      if (this.calculateChecksum(saveData.data) !== saveData.checksum) {
        return { status: 'corrupt' };
      }

      return { status: 'ok', data: saveData.data };
    } catch (e) {
      return { status: 'error' };
    }
  }

  static clear(): void {
    localStorage.removeItem(SAVE_KEY);
  }

  private static calculateChecksum(data: GameSave): number {
    // Simple checksum implementation
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return hash;
  }
}

type SaveStatus = 'empty' | 'ok' | 'corrupt' | 'error';
```

### New Game Initialization

```typescript
function initializeNewGame(playerName: string, playerGender: 'male' | 'female'): GameSave {
  const trainerId = Math.floor(Math.random() * 65536);
  const secretId = Math.floor(Math.random() * 65536);

  const block2: SaveBlock2 = {
    playerName,
    playerGender,
    trainerId,
    secretId,
    playTime: { hours: 0, minutes: 0, seconds: 0 },
    options: {
      textSpeed: 'mid',
      windowFrame: 0,
      sound: 'mono',
      battleStyle: 'shift',
      battleScene: true,
      buttonMode: 'normal',
    },
    pokedex: {
      owned: new Array(387).fill(false),
      seen: new Array(387).fill(false),
      nationalMode: false,
    },
  };

  const block1: SaveBlock1 = {
    location: {
      mapGroup: MAP_GROUPS.INSIDE_OF_TRUCK,
      mapNum: MAP_NUMS.INSIDE_OF_TRUCK,
      x: -1,  // Will be set by warp
      y: -1,
    },
    respawnLocation: playerGender === 'male'
      ? HEAL_LOCATIONS.LITTLEROOT_TOWN_BRENDANS_HOUSE_2F
      : HEAL_LOCATIONS.LITTLEROOT_TOWN_MAYS_HOUSE_2F,
    party: [],
    partyCount: 0,
    money: 3000,
    coins: 0,
    bag: {
      items: [],
      keyItems: [],
      pokeBalls: [],
      tmhm: [],
      berries: [],
    },
    pcItems: [{ itemId: ITEMS.POTION, quantity: 1 }],
    flags: new Array(FLAGS_COUNT).fill(false),
    vars: new Array(VARS_COUNT).fill(0),
  };

  const storage: PokemonStorage = {
    currentBox: 0,
    boxes: Array.from({ length: 14 }, () => ({
      pokemon: new Array(30).fill(null),
    })),
    boxNames: [
      'BOX 1', 'BOX 2', 'BOX 3', 'BOX 4', 'BOX 5',
      'BOX 6', 'BOX 7', 'BOX 8', 'BOX 9', 'BOX 10',
      'BOX 11', 'BOX 12', 'BOX 13', 'BOX 14',
    ],
    boxWallpapers: new Array(14).fill(0),
  };

  return {
    block1,
    block2,
    storage,
    checksum: 0,
    timestamp: Date.now(),
  };
}
```

### Event Flag/Variable System

```typescript
class EventDataManager {
  private flags: boolean[];
  private vars: number[];

  constructor(flags: boolean[], vars: number[]) {
    this.flags = flags;
    this.vars = vars;
  }

  // Flags
  setFlag(flagId: number): void {
    if (flagId < this.flags.length) {
      this.flags[flagId] = true;
    }
  }

  clearFlag(flagId: number): void {
    if (flagId < this.flags.length) {
      this.flags[flagId] = false;
    }
  }

  checkFlag(flagId: number): boolean {
    return flagId < this.flags.length ? this.flags[flagId] : false;
  }

  // Variables
  setVar(varId: number, value: number): void {
    if (varId < this.vars.length) {
      this.vars[varId] = value & 0xFFFF;  // 16-bit values
    }
  }

  getVar(varId: number): number {
    return varId < this.vars.length ? this.vars[varId] : 0;
  }

  addVar(varId: number, delta: number): void {
    this.setVar(varId, this.getVar(varId) + delta);
  }

  // Special vars (dynamically calculated)
  getSpecialVar(varId: number): number {
    switch (varId) {
      case SPECIAL_VARS.FACING:
        return getPlayerFacingDirection();
      case SPECIAL_VARS.RESULT:
        return this.vars[SPECIAL_VARS.RESULT];
      // ... other special vars
      default:
        return this.getVar(varId);
    }
  }
}
```

### Continue Info Display

```typescript
interface ContinueInfo {
  playerName: string;
  playerGender: 'male' | 'female';
  playTimeHours: number;
  playTimeMinutes: number;
  pokedexCount: number;
  badgeCount: number;
}

function getContinueInfo(save: GameSave): ContinueInfo {
  const pokedexCount = save.block2.pokedex.owned.filter(Boolean).length;

  const badgeFlags = [
    FLAGS.BADGE01_GET, FLAGS.BADGE02_GET, FLAGS.BADGE03_GET, FLAGS.BADGE04_GET,
    FLAGS.BADGE05_GET, FLAGS.BADGE06_GET, FLAGS.BADGE07_GET, FLAGS.BADGE08_GET,
  ];
  const badgeCount = badgeFlags.filter(f => save.block1.flags[f]).length;

  return {
    playerName: save.block2.playerName,
    playerGender: save.block2.playerGender,
    playTimeHours: save.block2.playTime.hours,
    playTimeMinutes: save.block2.playTime.minutes,
    pokedexCount,
    badgeCount,
  };
}
```
