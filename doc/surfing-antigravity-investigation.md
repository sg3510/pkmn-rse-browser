# Surfing Mechanics Investigation & React Implementation Proposal

## Executive Summary

This document provides a comprehensive investigation of Pokémon Emerald's surfing mechanics based on the `pokeemerald` C source code, followed by a concrete proposal for implementing these mechanics in React. The investigation covers surfing tile determination, dialog systems, animations, collision detection, and related features (waterfalls and diving).

---

## Part 1: C Code Investigation (`pokeemerald`)

### 1.1 Surfing Tile Determination

#### Metatile Behavior System

Surfable tiles are determined by the `TILE_FLAG_SURFABLE` flag in [`metatile_behavior.c`](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/src/metatile_behavior.c#L9-L128):

```c
#define TILE_FLAG_SURFABLE (1 << 1)

static const u8 sTileBitAttributes[NUM_METATILE_BEHAVIORS] = {
    [MB_POND_WATER]           = TILE_FLAG_UNUSED | TILE_FLAG_SURFABLE | TILE_FLAG_HAS_ENCOUNTERS,
    [MB_INTERIOR_DEEP_WATER]  = TILE_FLAG_UNUSED | TILE_FLAG_SURFABLE | TILE_FLAG_HAS_ENCOUNTERS,
    [MB_DEEP_WATER]           = TILE_FLAG_UNUSED | TILE_FLAG_SURFABLE | TILE_FLAG_HAS_ENCOUNTERS,
    [MB_WATERFALL]            = TILE_FLAG_UNUSED | TILE_FLAG_SURFABLE,
    [MB_SOOTOPOLIS_DEEP_WATER]= TILE_FLAG_UNUSED | TILE_FLAG_SURFABLE,
    [MB_OCEAN_WATER]          = TILE_FLAG_UNUSED | TILE_FLAG_SURFABLE | TILE_FLAG_HAS_ENCOUNTERS,
    [MB_NO_SURFACING]         = TILE_FLAG_UNUSED | TILE_FLAG_SURFABLE,
    [MB_SEAWEED]              = TILE_FLAG_UNUSED | TILE_FLAG_SURFABLE | TILE_FLAG_HAS_ENCOUNTERS,
    // ... currents, water doors, etc.
};
```

**Key Function:**

```c
bool8 MetatileBehavior_IsSurfableWaterOrUnderwater(u8 metatileBehavior) {
    if ((sTileBitAttributes[metatileBehavior] & TILE_FLAG_SURFABLE))
        return TRUE;
    else
        return FALSE;
}
```

#### Reflective Tiles While Surfing

Separate from surfability, **reflection rendering** is determined by [`MetatileBehavior_IsReflective`](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/src/metatile_behavior.c#L199-L210):

```c
bool8 MetatileBehavior_IsReflective(u8 metatileBehavior) {
    if (metatileBehavior == MB_POND_WATER
     || metatileBehavior == MB_PUDDLE
     || metatileBehavior == MB_UNUSED_SOOTOPOLIS_DEEP_WATER_2
     || metatileBehavior == MB_ICE
     || metatileBehavior == MB_SOOTOPOLIS_DEEP_WATER
     || metatileBehavior == MB_REFLECTION_UNDER_BRIDGE)
        return TRUE;
    else
        return FALSE;
}
```

> **Note:** Not all surfable tiles are reflective! Ocean water and deep water do NOT reflect the player.

---

### 1.2 Elevation System & Collision

#### Elevation Mismatch Check

The game uses **elevation** to determine if the player can surf. From [`field_player_avatar.c`](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/src/field_player_avatar.c#L1318-L1331):

```c
bool8 IsPlayerFacingSurfableFishableWater(void) {
    struct ObjectEvent *playerObjEvent = &gObjectEvents[gPlayerAvatar.objectEventId];
    s16 x = playerObjEvent->currentCoords.x;
    s16 y = playerObjEvent->currentCoords.y;

    MoveCoords(playerObjEvent->facingDirection, &x, &y);
    if (GetCollisionAtCoords(playerObjEvent, x, y, playerObjEvent->facingDirection) == COLLISION_ELEVATION_MISMATCH
     && PlayerGetElevation() == 3  // Player must be at elevation 3 (land)
     && MetatileBehavior_IsSurfableFishableWater(MapGridGetMetatileBehaviorAt(x, y)))
        return TRUE;
    else
        return FALSE;
}
```

**Key Points:**
- Player must be at **elevation 3** (land level)
- Target tile must have **elevation mismatch** (water is elevation 0)
- Target metatile behavior must be **surfable**

---

### 1.3 Dialog System: "Do you want to SURF?"

#### Script Trigger

When the player presses **A** button while facing surfable water, the game triggers [`EventScript_UseSurf`](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/src/field_control_avatar.c#L448-L451):

```c
static const u8 *GetInteractedWaterScript(struct MapPosition *unused1, u8 metatileBehavior, u8 direction) {
    if (FlagGet(FLAG_BADGE05_GET) == TRUE 
        && PartyHasMonWithSurf() == TRUE 
        && IsPlayerFacingSurfableFishableWater() == TRUE)
        return EventScript_UseSurf;
    // ...
}
```

**Requirements:**
1. Player has **5th badge** (FLAG_BADGE05_GET)
2. Party has a Pokémon that knows **Surf**
3. Facing **surfable water**

#### Party Menu & Yes/No Dialog

The surf script opens the party menu with the field move dialog. From [`party_menu.c`](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/src/party_menu.c#L3858-L3867):

```c
static bool8 SetUpFieldMove_Surf(void) {
    if (PartyHasMonWithSurf() == TRUE && IsPlayerFacingSurfableFishableWater() == TRUE) {
        gFieldCallback2 = FieldCallback_PrepareFadeInFromMenu;
        gPostMenuFieldCallback = FieldCallback_Surf;
        return TRUE;
    }
    return FALSE;
}

static void FieldCallback_Surf(void) {
    gFieldEffectArguments[0] = GetCursorSelectionMonId();
    FieldEffectStart(FLDEFF_USE_SURF);
}
```

The party menu shows:
1. Pokémon selection
2. **"[Pokémon] used SURF!"** message (implied by field move system)
3. Field effect starts

---

### 1.4 Surfing Animation Sequence

#### Animation Steps

From [`field_effect.c`](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/src/field_effect.c#L2985-L3074), the surf animation has **5 states**:

```c
static void (*const sSurfFieldEffectFuncs[])(struct Task *) = {
    SurfFieldEffect_Init,               // 0: Lock controls, set surfing flag
    SurfFieldEffect_FieldMovePose,      // 1: Player does "field move" pose
    SurfFieldEffect_ShowMon,            // 2: Show Pokémon animation
    SurfFieldEffect_JumpOnSurfBlob,     // 3: Player jumps onto surf blob
    SurfFieldEffect_End,                // 4: Unlock controls, begin surfing
};
```

**Detailed Breakdown:**

**State 0 - Init:**
```c
static void SurfFieldEffect_Init(struct Task *task) {
    LockPlayerFieldControls();
    FreezeObjectEvents();
    gPlayerAvatar.preventStep = TRUE;
    SetPlayerAvatarStateMask(PLAYER_AVATAR_FLAG_SURFING);  // Set surfing flag
    PlayerGetDestCoords(&task->tDestX, &task->tDestY);
    MoveCoords(gObjectEvents[gPlayerAvatar.objectEventId].movementDirection, &task->tDestX, &task->tDestY);
    task->tState++;
}
```

**State 1 - Field Move Pose:**
```c
static void SurfFieldEffect_FieldMovePose(struct Task *task) {
    struct ObjectEvent *objectEvent = &gObjectEvents[gPlayerAvatar.objectEventId];
    if (!ObjectEventIsMovementOverridden(objectEvent) || ObjectEventClearHeldMovementIfFinished(objectEvent)) {
        SetPlayerAvatarFieldMove();  // Changes to field move sprite
        ObjectEventSetHeldMovement(objectEvent, MOVEMENT_ACTION_START_ANIM_IN_DIRECTION);
        task->tState++;
    }
}
```

**State 2 - Show Mon:**
```c
static void SurfFieldEffect_ShowMon(struct Task *task) {
    struct ObjectEvent *objectEvent = &gObjectEvents[gPlayerAvatar.objectEventId];
    if (ObjectEventCheckHeldMovementStatus(objectEvent)) {
        gFieldEffectArguments[0] = task->tMonId | SHOW_MON_CRY_NO_DUCKING;
        FieldEffectStart(FLDEFF_FIELD_MOVE_SHOW_MON_INIT);  // Shows Pokémon + cry
        task->tState++;
    }
}
```

**State 3 - Jump On Surf Blob:**
```c
static void SurfFieldEffect_JumpOnSurfBlob(struct Task *task) {
    struct ObjectEvent *objectEvent;
    if (!FieldEffectActiveListContains(FLDEFF_FIELD_MOVE_SHOW_MON)) {
        objectEvent = &gObjectEvents[gPlayerAvatar.objectEventId];
        // Change player sprite to SURFING graphic
        ObjectEventSetGraphicsId(objectEvent, GetPlayerAvatarGraphicsIdByStateId(PLAYER_AVATAR_STATE_SURFING));
        ObjectEventClearHeldMovementIfFinished(objectEvent);
        ObjectEventSetHeldMovement(objectEvent, GetJumpSpecialMovementAction(objectEvent->movementDirection));
        
        // Create surf blob sprite
        gFieldEffectArguments[0] = task->tDestX;
        gFieldEffectArguments[1] = task->tDestY;
        gFieldEffectArguments[2] = gPlayerAvatar.objectEventId;
        objectEvent->fieldEffectSpriteId = FieldEffectStart(FLDEFF_SURF_BLOB);
        
        task->tState++;
    }
}
```

**State 4 - End:**
```c
static void SurfFieldEffect_End(struct Task *task) {
    struct ObjectEvent *objectEvent = &gObjectEvents[gPlayerAvatar.objectEventId];
    if (ObjectEventClearHeldMovementIfFinished(objectEvent)) {
        gPlayerAvatar.preventStep = FALSE;
        gPlayerAvatar.flags &= ~PLAYER_AVATAR_FLAG_CONTROLLABLE;
        ObjectEventSetHeldMovement(objectEvent, GetFaceDirectionMovementAction(objectEvent->movementDirection));
        SetSurfBlob_BobState(objectEvent->fieldEffectSpriteId, BOB_PLAYER_AND_MON);
        UnfreezeObjectEvents();
        UnlockPlayerFieldControls();
        FieldEffectActiveListRemove(FLDEFF_USE_SURF);
        DestroyTask(FindTaskIdByFunc(Task_SurfFieldEffect));
    }
}
```

#### Player Surfing Sprites

From graphics directory: - Brendan: [`public/pokeemerald/graphics/object_events/pics/people/brendan/surfing.png`](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/graphics/object_events/pics/people/brendan/surfing.png)
- May: [`public/pokeemerald/graphics/object_events/pics/people/may/surfing.png`](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/graphics/object_events/pics/people/may/surfing.png)

These are **4-directional** sprite sheets showing the player riding a Pokémon.

#### Surf Blob Sprite

- Surf Blob: [`public/pokeemerald/graphics/field_effects/pics/surf_blob.png`](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/graphics/field_effects/pics/surf_blob.png)

This is the **water sprite** that appears under the player while surfing (creates the "bobbing" effect).

---

### 1.5 Collision Detection While Surfing

#### Flag System

The `PLAYER_AVATAR_FLAG_SURFING` flag (bit 3) changes collision behavior:

```c
#define PLAYER_AVATAR_FLAG_SURFING (1 << 3)
```

**Graphics Change:**

From [`field_player_avatar.c`](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/src/field_player_avatar.c#L277):
```c
static const u8 sPlayerAvatarGfxToStateFlag[GENDER_COUNT][7][2] = {
    [MALE] = {
        {OBJ_EVENT_GFX_BRENDAN_SURFING, PLAYER_AVATAR_FLAG_SURFING},
        // ...
    },
    [FEMALE] = {
        {OBJ_EVENT_GFX_MAY_SURFING, PLAYER_AVATAR_FLAG_SURFING},
        // ...
    }
};
```

**Collision Changes:**

While surfing:
- Can only move on **surfable tiles**
- Cannot dismount onto non-walkable tiles
- Elevation is treated as **0** (water level)
- Wild encounters shift to **water encounters**

---

### 1.6 Edge Cases & Special Behaviors

#### Stopping Surfing

From [`field_player_avatar.c`](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/src/field_player_avatar.c#L1643-L1689):

```c
static void CreateStopSurfingTask(u8 direction) {
    LockPlayerFieldControls();
    Overworld_ClearSavedMusic();
    Overworld_ChangeMusicToDefault();
    gPlayerAvatar.flags &= ~PLAYER_AVATAR_FLAG_SURFING;
    gPlayerAvatar.flags |= PLAYER_AVATAR_FLAG_ON_FOOT;
    gPlayerAvatar.preventStep = TRUE;
    taskId = CreateTask(Task_StopSurfingInit, 0xFF);
    gTasks[taskId].data[0] = direction;
    Task_StopSurfingInit(taskId);
}

static void Task_WaitStopSurfing(u8 taskId) {
    struct ObjectEvent *playerObjEvent = &gObjectEvents[gPlayerAvatar.objectEventId];
    
    if (ObjectEventClearHeldMovementIfFinished(playerObjEvent)) {
        ObjectEventSetGraphicsId(playerObjEvent, GetPlayerAvatarGraphicsIdByStateId(PLAYER_AVATAR_STATE_NORMAL));
        ObjectEventSetHeldMovement(playerObjEvent, GetFaceDirectionMovementAction(playerObjEvent->facingDirection));
        gPlayerAvatar.preventStep = FALSE;
        UnlockPlayerFieldControls();
        DestroySprite(&gSprites[playerObjEvent->fieldEffectSpriteId]);  // Destroy surf blob
        DestroyTask(taskId);
    }
}
```

**Key Points:**
- Player **jumps off** surf blob
- Sprite changes back to **normal walking**
- Surf blob sprite is **destroyed**
- Music changes back to **default**

#### Biking While Surfing

**Not allowed.** From [`bike.c`](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/src/bike.c#L955):
```c
if (!(gPlayerAvatar.flags & (PLAYER_AVATAR_FLAG_SURFING | PLAYER_AVATAR_FLAG_UNDERWATER))) {
    // Bike logic only runs if NOT surfing or underwater
}
```

---

### 1.7 Waterfalls

#### Waterfall Mechanics

From [`field_effect.c`](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/src/field_effect.c):

Waterfalls are **scripted upward movement** triggered when:
1. Player is **surfing north**
2. Facing a **waterfall tile** (`MB_WATERFALL`)
3. Has **8th badge** (FLAG_BADGE08_GET)

**Waterfall Animation States:**
```c
static bool8 (*const sWaterfallFieldEffectFuncs[])(struct Task *, struct ObjectEvent *) = {
    WaterfallFieldEffect_Init,           // Lock controls
    WaterfallFieldEffect_ShowMon,        // Show Pokémon + cry
    WaterfallFieldEffect_WaitForShowMon, // Wait for animation
    WaterfallFieldEffect_RideUp,         // Move player upward tile-by-tile
    WaterfallFieldEffect_ContinueRideOrEnd, // Continue if more waterfall tiles, else end
};
```

**Player Control:** 
- Movement is **scripted** (not player-controlled)
- Player automatically moves **upward** until no more waterfall tiles
- Similar to "surfing up stairs"

---

### 1.8 Diving & Underwater

#### Dive Mechanics

**Diving Down:**

From [`field_control_avatar.c`](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/src/field_control_avatar.c#L463-L471):
```c
static bool32 TrySetupDiveDownScript(void) {
    if (FlagGet(FLAG_BADGE07_GET) && TrySetDiveWarp() == 2) {
        ScriptContext_SetupScript(EventScript_UseDive);
        return TRUE;
    }
    return FALSE;
}
```

Requirements:
- 7th badge (FLAG_BADGE07_GET)
- On a **dive warp tile** (special metatile with warp event)
- Triggered by **A button**

**Diving Animation:**

From [`field_effect.c`](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/src/field_effect.c#L1902-L1946):

```c
static bool8 (*const sDiveFieldEffectFuncs[])(struct Task *) = {
    DiveFieldEffect_Init,      // Lock controls
    DiveFieldEffect_ShowMon,   // Show Pokémon + cry
    DiveFieldEffect_TryWarp,   // Trigger warp to underwater map
};
```

**Key Points:**
- Player **warps** to a different map (`MAP_TYPE_UNDERWATER`)
- Uses **dive sprite** (different from surf sprite)
- Water effect animates **"diving down"**
- Underwater has its own collision/reflection rules

**Surfacing:**

Triggered by **B button** while underwater:
```c
if (input->pressedBButton && TrySetupDiveEmergeScript() == TRUE)
    return TRUE;
```

Same animation in reverse.

---

## Part 2: React Implementation Proposal

### 2.1 Architecture Overview

```
PlayerController
  ├─ SurfingState
  │   ├─ initiateSurf()
  │   ├─ updateSurfing()
  │   └─ stopSurfing()
  ├─ WaterfallState
  └─ DivingState

MapRenderer
  ├─ renderSurfBlob()
  └─ renderPlayerOnWater()

DialogManager
  └─ showSurfDialog()

FieldEffectManager
  └─ handleSurfAnimation()
```

---

### 2.2 Surfing Tile Determination

#### Metatile Behavior Map

Create a TypeScript enum based on C code:

```typescript
enum MetatileBehavior {
  MB_NORMAL = 0x00,
  MB_POND_WATER = 0x0E,
  MB_INTERIOR_DEEP_WATER = 0x0F,
  MB_DEEP_WATER = 0x10,
  MB_WATERFALL = 0x11,
  MB_OCEAN_WATER = 0x13,
  MB_PUDDLE = 0x14,
  MB_SHALLOW_WATER = 0x15,
  // ... add remaining behaviors
}

const SURFABLE_BEHAVIORS = new Set([
  MetatileBehavior.MB_POND_WATER,
  MetatileBehavior.MB_INTERIOR_DEEP_WATER,
  MetatileBehavior.MB_DEEP_WATER,
  MetatileBehavior.MB_WATERFALL,
  MetatileBehavior.MB_OCEAN_WATER,
  MetatileBehavior.MB_SEAWEED,
  // ... add all surfable tiles
]);

const REFLECTIVE_BEHAVIORS = new Set([
  MetatileBehavior.MB_POND_WATER,
  MetatileBehavior.MB_PUDDLE,
  MetatileBehavior.MB_SOOTOPOLIS_DEEP_WATER,
  MetatileBehavior.MB_ICE,
  MetatileBehavior.MB_REFLECTION_UNDER_BRIDGE,
]);

function isSurfable(behavior: number): boolean {
  return SURFABLE_BEHAVIORS.has(behavior);
}

function isReflective(behavior: number): boolean {
  return REFLECTIVE_BEHAVIORS.has(behavior);
}
```

#### Collision & Elevation Check

```typescript
interface MapPosition {
  x: number;
  y: number;
  elevation: number;
}

function canInitiateSurf(
  playerPos: MapPosition,
  targetPos: MapPosition,
  targetBehavior: number
): boolean {
  // Must be at elevation 3 (land)
  if (playerPos.elevation !== 3) {
    return false;
  }

  // Target must be surfable water
  if (!isSurfable(targetBehavior)) {
    return false;
  }

  // Target must have elevation mismatch (water = 0)
  if (targetPos.elevation !== 0) {
    return false;
  }

  return true;
}
```

---

### 2.3 Dialog System

#### Dialog Component

```typescript
interface SurfDialogProps {
  pokemonName: string;  // For placeholder: "Lapras"
  onConfirm: () => void;
  onCancel: () => void;
}

function SurfDialog({ pokemonName, onConfirm, onCancel }: SurfDialogProps) {
  const [selectedOption, setSelectedOption] = useState<'yes' | 'no'>('yes');

  const handleClick = () => {
    if (selectedOption === 'yes') {
      onConfirm();
    } else {
      onCancel();
    }
  };

  return (
    <div className="dialog-box">
      <p>The water is clear blue...</p>
      <p>Would you like to SURF?</p>
      <div className="options">
        <div 
          className={selectedOption === 'yes' ? 'selected' : ''}
          onClick={() => setSelectedOption('yes')}
        >
          ▶ YES
        </div>
        <div 
          className={selectedOption === 'no' ? 'selected' : ''}
          onClick={() => setSelectedOption('no')}
        >
          NO
        </div>
      </div>
      <button onClick={handleClick}>Confirm</button>
    </div>
  );
}
```

#### Input Handling

```typescript
function handleAButtonPress(playerController: PlayerController) {
  const facingPos = playerController.getFacingPosition();
  const facingBehavior = map.getMetatileBehavior(facingPos.x, facingPos.y);
  const playerPos = playerController.getPosition();

  if (canInitiateSurf(playerPos, facingPos, facingBehavior)) {
    // Show dialog
    setDialog({
      type: 'surf',
      onConfirm: () => playerController.startSurfSequence(),
      onCancel: () => setDialog(null)
    });
  }
}
```

**Mouse Support:**
- Dialog is **clickable**
- Yes/No options can be clicked directly
- Still support keyboard (X key = A button)

---

### 2.4 Surfing Animation Sequence

#### State Machine

```typescript
enum SurfAnimationState {
  INIT,
  FIELD_MOVE_POSE,
  SHOW_MON,
  JUMP_ON_BLOB,
  END,
  SURFING, // Active surfing state
}

class SurfController {
  private state: SurfAnimationState = SurfAnimationState.INIT;
  private frameCounter: number = 0;
  private targetPos: {x: number, y: number};

  startSurfSequence(targetX: number, targetY: number) {
    this.state = SurfAnimationState.INIT;
    this.targetPos = {x: targetX, y: targetY};
    this.frameCounter = 0;
    lockPlayerInput();
    setPlayerFlag(PlayerFlags.SURFING);
  }

  update() {
    switch (this.state) {
      case SurfAnimationState.INIT:
        this.updateInit();
        break;
      case SurfAnimationState.FIELD_MOVE_POSE:
        this.updateFieldMovePose();
        break;
      case SurfAnimationState.SHOW_MON:
        this.updateShowMon();
        break;
      case SurfAnimationState.JUMP_ON_BLOB:
        this.updateJumpOnBlob();
        break;
      case SurfAnimationState.END:
        this.updateEnd();
        break;
    }
  }

  private updateInit() {
    // Immediate transition
    this.state = SurfAnimationState.FIELD_MOVE_POSE;
  }

  private updateFieldMovePose() {
    // Show "field move" pose for ~30 frames
    if (this.frameCounter++ > 30) {
      this.state = SurfAnimationState.SHOW_MON;
      this.frameCounter = 0;
    }
  }

  private updateShowMon() {
    // Show Lapras animation + cry
    // Wait for animation to complete (~60 frames)
    if (this.frameCounter++ > 60) {
      this.state = SurfAnimationState.JUMP_ON_BLOB;
      this.frameCounter = 0;
    }
  }

  private updateJumpOnBlob() {
    // Player sprite changes to surfing
    playerSprite.changeTo('surfing');
    
    // Create surf blob at target position
    createSurfBlob(this.targetPos.x, this.targetPos.y);
    
    // Jump animation (~20 frames)
    if (this.frameCounter++ > 20) {
      this.state = SurfAnimationState.END;
      this.frameCounter = 0;
    }
  }

  private updateEnd() {
    // Unlock input
    unlockPlayerInput();
    this.state = SurfAnimationState.SURFING;
  }
}
```

---

### 2.5 Player Sprite Management

#### Sprite Loading

```typescript
interface PlayerSpriteSet {
  normal: HTMLImageElement;
  surfing: HTMLImageElement;
  diving: HTMLImageElement;
  fieldMove: HTMLImageElement;
}

async function loadPlayerSprites(gender: 'brendan' | 'may'): Promise<PlayerSpriteSet> {
  const basePath = `/pokeemerald/graphics/object_events/pics/people/${gender}`;
  
  return {
    normal: await loadImage(`${basePath}/normal.png`),
    surfing: await loadImage(`${basePath}/surfing.png`),
    diving: await loadImage(`${basePath}/diving.png`),
    fieldMove: await loadImage(`${basePath}/field_move.png`),
  };
}
```

#### Sprite Rendering

```typescript
function renderPlayer(ctx: CanvasRenderingContext2D, player: PlayerController) {
  const sprite = player.getCurrentSprite();
  const pos = player.getRenderPosition();
  const direction = player.getFacingDirection();

  // Calculate sprite frame based on direction
  const frameX = direction * TILE_SIZE;
  const frameY = 0; // Animation frame (if walking)

  ctx.drawImage(
    sprite.image,
    frameX, frameY, TILE_SIZE, TILE_SIZE,
    pos.x, pos.y, TILE_SIZE, TILE_SIZE
  );

  // Render surf blob if surfing
  if (player.isSurfing()) {
    renderSurfBlob(ctx, pos.x, pos.y);
  }
}
```

---

### 2.6 Surf Blob Rendering

#### Bobbing Animation

```typescript
class SurfBlob {
  private bobPhase: number = 0;
  private bobSpeed: number = 0.1;
  
  update() {
    this.bobPhase += this.bobSpeed;
  }

  render(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const bobOffset = Math.sin(this.bobPhase) * 2; // ±2 pixel bob
    
    ctx.drawImage(
      surfBlobSprite,
      0, 0, TILE_SIZE, TILE_SIZE,
      x, y + bobOffset, TILE_SIZE, TILE_SIZE
    );
  }
}
```

#### Z-Layering

```
Layer 0: Water tile (background)
Layer 1: Surf blob (bobbing water effect)
Layer 2: Player surfing sprite
Layer 3: Player reflection (if on reflective tile)
```

---

### 2.7 Collision Detection While Surfing

```typescript
enum PlayerState {
  WALKING,
  SURFING,
  DIVING,
}

function canMoveTo(
  fromPos: MapPosition,
  toPos: MapPosition,
  playerState: PlayerState
): boolean {
  const toBehavior = map.getMetatileBehavior(toPos.x, toPos.y);

  if (playerState === PlayerState.SURFING) {
    // Can only move to surfable tiles
    if (!isSurfable(toBehavior)) {
      // Exception: Can dismount to land if elevation matches
      if (toPos.elevation === 3 && isWalkable(toBehavior)) {
        // Trigger stop surfing animation
        return true;
      }
      return false;
    }
    return true;
  }

  // Normal walking logic
  return isWalkable(toBehavior);
}
```

---

### 2.8 Waterfall Implementation (Brief)

#### Detection

```typescript
function checkWaterfallTrigger(player: PlayerController): boolean {
  if (!player.isSurfing()) return false;
  if (player.getFacingDirection() !== Direction.NORTH) return false;

  const facingPos = player.getFacingPosition();
  const facingBehavior = map.getMetatileBehavior(facingPos.x, facingPos.y);

  return facingBehavior === MetatileBehavior.MB_WATERFALL;
}
```

#### Scripted Movement

```typescript
async function climbWaterfall(player: PlayerController) {
  lockPlayerInput();
  
  // Play waterfall animation
  playWaterfallSound();

  // Move player upward tile-by-tile
  let currentPos = player.getPosition();
  while (true) {
    const nextPos = {x: currentPos.x, y: currentPos.y - 1, elevation: currentPos.elevation};
    const nextBehavior = map.getMetatileBehavior(nextPos.x, nextPos.y);

    if (nextBehavior !== MetatileBehavior.MB_WATERFALL) {
      break; // No more waterfall tiles
    }

    await player.moveTo(nextPos.x, nextPos.y);
    currentPos = nextPos;
  }

  unlockPlayerInput();
}
```

---

### 2.9 Diving Implementation (Brief)

#### Detection

```typescript
function checkDiveTrigger(player: PlayerController): boolean {
  if (!player.isSurfing()) return false;

  const currentPos = player.getPosition();
  const warp = map.getDiveWarpAt(currentPos.x, currentPos.y);

  return warp !== null;
}
```

#### Warp Transition

```typescript
async function dive(player: PlayerController) {
  const currentPos = player.getPosition();
  const warp = map.getDiveWarpAt(currentPos.x, currentPos.y);

  lockPlayerInput();

  // Play dive animation
  await playDiveAnimation();

  // Warp to underwater map
  await map.loadMap(warp.targetMap);
  player.setPosition(warp.targetX, warp.targetY);
  player.setSprite('diving');

  unlockPlayerInput();
}
```

---

## Part 3: Edge Cases & Special Considerations

### 3.1 Music Changes

```typescript
class MusicController {
  private savedMusic: string | null = null;

  startSurfing() {
    this.savedMusic = getCurrentMusic();
    playMusic('surf_theme.mp3');
  }

  stopSurfing() {
    if (this.savedMusic) {
      playMusic(this.savedMusic);
      this.savedMusic = null;
    }
  }
}
```

### 3.2 Wild Encounters While Surfing

```typescript
function checkWildEncounter(playerState: PlayerState, tileBehavior: number): boolean {
  if (playerState === PlayerState.SURFING) {
    // Use water encounter table
    return rollEncounter(encounterTables.water, tileBehavior);
  } else {
    // Use land encounter table
    return rollEncounter(encounterTables.land, tileBehavior);
  }
}
```

### 3.3 Reflection Rendering While Surfing

```typescript
function renderPlayerReflection(
  ctx: CanvasRenderingContext2D,
  player: PlayerController,
  tile: Tile
) {
  if (!isReflective(tile.behavior)) {
    return; // No reflection on this tile
  }

  const pos = player.getRenderPosition();
  const sprite = player.getCurrentSprite();

  // Render flipped sprite below player
  ctx.save();
  ctx.translate(pos.x, pos.y + TILE_SIZE);
  ctx.scale(1, -1);
  ctx.globalAlpha = 0.5;
  ctx.drawImage(sprite.image, 0, 0, TILE_SIZE, TILE_SIZE);
  ctx.restore();
}
```

---

## Part 4: Placeholder Strategy for Lapras

### 4.1 Hardcoded Surfing Pokémon

**For MVP:** Assume player always has Lapras.

```typescript
const PLACEHOLDER_SURF_POKEMON = {
  species: 'Lapras',
  sprite: '/pokeemerald/graphics/pokemon/lapras/front.png',
  cry: '/pokeemerald/sound/direct_sound_samples/cries/lapras.bin'
};

function getPlayerSurfPokemon(): SurfPokemon {
  // TODO: Later, implement party check for surf move
  return PLACEHOLDER_SURF_POKEMON;
}
```

### 4.2 Future: Party Integration

```typescript
interface PartyPokemon {
  species: string;
  moves: string[];
  sprite: string;
  cry: string;
}

function findSurfPokemon(party: PartyPokemon[]): PartyPokemon | null {
  return party.find(p => p.moves.includes('Surf')) || null;
}
```

---

## Part 5: Testing & Verification

### 5.1 Test Cases

1. **Tile Detection:**
   - Verify all surfable tiles are recognized
   - Verify reflective vs non-reflective tiles

2. **Dialog System:**
   - Test keyboard (X button) and mouse click
   - Test yes/no selection

3. **Animation Sequence:**
   - Verify all 5 states execute correctly
   - Verify sprite changes

4. **Collision:**
   - Cannot surf onto non-surfable tiles
   - Cannot walk onto water while not surfing
   - Can dismount onto land

5. **Edge Cases:**
   - Music changes correctly
   - Reflection renders only on reflective tiles
   - Waterfall/dive triggers work

---

## Part 6: Summary & Next Steps

### Key Findings from C Code:

1. **Tile Determination:** Bitflag system (`TILE_FLAG_SURFABLE`)
2. **Dialog:** Badge + party check → script → yes/no → field effect
3. **Animation:** 5-state sequence with sprite/blob rendering
4. **Collision:** Flag-based state changes elevation & movement rules
5. **Waterfall:** Scripted upward movement on waterfall tiles
6. **Diving:** Warp to underwater map

### Recommended Implementation Order:

1. ✅ Tile determination & collision detection
2. ✅ Dialog system (keyboard + mouse)
3. ✅ Surfing animation state machine
4. ✅ Player sprite management & rendering
5. ✅ Surf blob rendering (with bobbing)
6. ✅ Reflection rendering while surfing
7. ⏭️ Waterfall mechanics (later)
8. ⏭️ Diving mechanics (later)

### Open Questions:

1. Should we implement **seamless tile transitions** or discrete 16×16 jumps?
   - C code uses discrete tile-by-tile movement
2. Should surf blob **bob independently** or sync with player?
   - C code: Independent bobbing
3. How to handle **corner cases** like surfing under bridges?
   - C code: Uses `MB_REFLECTION_UNDER_BRIDGE` behavior

---

**Document Status:** ✅ Complete  
**Date:** 2025-11-23  
**Author:** Antigravity Investigation
