# Diving & Waterfall Systems - Deep Dive Analysis

## Overview

This document provides a comprehensive analysis of how diving and waterfall mechanics work in Pokemon Emerald's decompiled source code (`public/pokeemerald/`) and proposes a modular React implementation for `src/`.

---

## Part 1: DIVING SYSTEM

### 1.1 Diveable Tile Detection

**Source:** `public/pokeemerald/src/metatile_behavior.c:853-860`

```c
bool8 MetatileBehavior_IsDiveable(u8 metatileBehavior)
{
    if (metatileBehavior == MB_INTERIOR_DEEP_WATER      // 17 (0x11)
     || metatileBehavior == MB_DEEP_WATER               // 18 (0x12)
     || metatileBehavior == MB_SOOTOPOLIS_DEEP_WATER)   // 20 (0x14)
        return TRUE;
    else
        return FALSE;
}
```

**Key Point:** Only 3 specific metatile behaviors allow diving:
- `MB_INTERIOR_DEEP_WATER` (17) - Indoor deep water
- `MB_DEEP_WATER` (18) - Standard deep water
- `MB_SOOTOPOLIS_DEEP_WATER` (20) - Special Sootopolis water

### 1.2 Dive Warp Connection System

**Source:** `public/pokeemerald/include/constants/global.h:153-154`

```c
#define CONNECTION_DIVE     5
#define CONNECTION_EMERGE   6
```

Maps define dive connections in their `map.json`:

**Surface Map (Route124):**
```json
{
  "connections": [
    {
      "map": "MAP_UNDERWATER_ROUTE124",
      "offset": 0,
      "direction": "dive"
    }
  ]
}
```

**Underwater Map (Underwater_Route124):**
```json
{
  "connections": [
    {
      "map": "MAP_ROUTE124",
      "offset": 0,
      "direction": "emerge"
    }
  ]
}
```

### 1.3 Dive Warp Resolution

**Source:** `public/pokeemerald/src/overworld.c:756-782`

```c
static bool8 SetDiveWarp(u8 dir, u16 x, u16 y)
{
    const struct MapConnection *connection = GetMapConnection(dir);

    if (connection != NULL)
    {
        // Direct connection found - warp to connected map at same x,y
        SetWarpDestination(connection->mapGroup, connection->mapNum, WARP_ID_NONE, x, y);
    }
    else
    {
        // No direct connection - use script-defined fixed dive warp
        RunOnDiveWarpMapScript();
        if (IsDummyWarp(&sFixedDiveWarp))
            return FALSE;
        SetWarpDestinationToDiveWarp();
    }
    return TRUE;
}

bool8 SetDiveWarpEmerge(u16 x, u16 y)
{
    return SetDiveWarp(CONNECTION_EMERGE, x, y);
}

bool8 SetDiveWarpDive(u16 x, u16 y)
{
    return SetDiveWarp(CONNECTION_DIVE, x, y);
}
```

**Key Point:** The x,y coordinates are preserved across dive transitions - player appears at same relative position.

### 1.4 Cannot Surface Detection

**Source:** `public/pokeemerald/src/metatile_behavior.c`

```c
bool8 MetatileBehavior_IsUnableToEmerge(u8 metatileBehavior)
{
    if (metatileBehavior == MB_NO_SURFACING            // 25 (0x19)
     || metatileBehavior == MB_SEAWEED_NO_SURFACING)   // 42 (0x2A)
        return TRUE;
    else
        return FALSE;
}
```

### 1.5 Dive Field Effect Sequence

**Source:** `public/pokeemerald/src/field_effect.c:1902-1946`

```c
bool8 FldEff_UseDive(void)
{
    u8 taskId;
    taskId = CreateTask(Task_UseDive, 0xff);
    gTasks[taskId].data[15] = gFieldEffectArguments[0];  // Pokemon species
    gTasks[taskId].data[14] = gFieldEffectArguments[1];
    Task_UseDive(taskId);
    return FALSE;
}

// State machine steps:
static bool8 DiveFieldEffect_Init(struct Task *task)
{
    gPlayerAvatar.preventStep = TRUE;
    task->data[0]++;
    return FALSE;
}

static bool8 DiveFieldEffect_ShowMon(struct Task *task)
{
    LockPlayerFieldControls();
    gFieldEffectArguments[0] = task->data[15];
    FieldEffectStart(FLDEFF_FIELD_MOVE_SHOW_MON_INIT);
    task->data[0]++;
    return FALSE;
}

static bool8 DiveFieldEffect_TryWarp(struct Task *task)
{
    struct MapPosition mapPosition;
    PlayerGetDestCoords(&mapPosition.x, &mapPosition.y);

    if (!FieldEffectActiveListContains(FLDEFF_FIELD_MOVE_SHOW_MON))
    {
        TryDoDiveWarp(&mapPosition, gObjectEvents[gPlayerAvatar.objectEventId].currentMetatileBehavior);
        DestroyTask(FindTaskIdByFunc(Task_UseDive));
        FieldEffectActiveListRemove(FLDEFF_USE_DIVE);
    }
    return FALSE;
}
```

### 1.6 TryDoDiveWarp Logic

**Source:** `public/pokeemerald/src/field_control_avatar.c:940-960`

```c
bool8 TryDoDiveWarp(struct MapPosition *position, u16 metatileBehavior)
{
    // If underwater and can emerge here
    if (gMapHeader.mapType == MAP_TYPE_UNDERWATER &&
        !MetatileBehavior_IsUnableToEmerge(metatileBehavior))
    {
        if (SetDiveWarpEmerge(position->x - MAP_OFFSET, position->y - MAP_OFFSET))
        {
            StoreInitialPlayerAvatarState();
            DoDiveWarp();
            PlaySE(SE_M_DIVE);
            return TRUE;
        }
    }
    // If on diveable water
    else if (MetatileBehavior_IsDiveable(metatileBehavior) == TRUE)
    {
        if (SetDiveWarpDive(position->x - MAP_OFFSET, position->y - MAP_OFFSET))
        {
            StoreInitialPlayerAvatarState();
            DoDiveWarp();
            PlaySE(SE_M_DIVE);
            return TRUE;
        }
    }
    return FALSE;
}
```

---

## Part 2: UNDERWATER ENVIRONMENT

### 2.1 Map Type Detection

**Source:** `public/pokeemerald/include/constants/map_types.h`

```c
#define MAP_TYPE_UNDERWATER  6
```

Used for:
- Player avatar state (underwater sprite)
- Music selection (`MUS_UNDERWATER`)
- Battle environment
- Weather effects
- Emerge validation

### 2.2 Player Avatar State

**Source:** `public/pokeemerald/src/overworld.c:912-918`

```c
if (mapType == MAP_TYPE_UNDERWATER)
    return PLAYER_AVATAR_FLAG_UNDERWATER;
else if (MetatileBehavior_IsSurfableWaterOrUnderwater(metatileBehavior) == TRUE)
    return PLAYER_AVATAR_FLAG_SURFING;
```

**Underwater Sprites:**
- `public/pokeemerald/graphics/object_events/pics/people/brendan/underwater.png`
- `public/pokeemerald/graphics/object_events/pics/people/may/underwater.png`

### 2.3 Underwater Weather & Bubbles

**Source:** `public/pokeemerald/data/maps/Underwater_Route124/map.json:8`

```json
{
  "weather": "WEATHER_UNDERWATER_BUBBLES"
}
```

**Source:** `public/pokeemerald/src/field_weather_effect.c:2302-2345`

```c
static const u8 sBubbleStartDelays[] = {40, 90, 60, 90, 2, 60, 40, 30};

static const struct Coords16 sBubbleStartCoords[] = {
    { 60, 100}, {180, 100}, {300, 100}, {420, 100},
    {436, 130}, { 60, 160}, {436, 160}, {220, 180},
    {476, 180}, { 10,  90}, {266,  90}, {256, 160},
};

void Bubbles_InitVars(void)
{
    FogHorizontal_InitVars();  // Underwater also has fog layer
    if (!gWeatherPtr->bubblesSpritesCreated)
    {
        LoadSpriteSheet(&sWeatherBubbleSpriteSheet);
        gWeatherPtr->bubblesDelayIndex = 0;
        gWeatherPtr->bubblesDelayCounter = sBubbleStartDelays[0];
        gWeatherPtr->bubblesCoordsIndex = 0;
        gWeatherPtr->bubblesSpriteCount = 0;
    }
}

void Bubbles_Main(void)
{
    FogHorizontal_Main();  // Run fog effect
    if (++gWeatherPtr->bubblesDelayCounter > sBubbleStartDelays[gWeatherPtr->bubblesDelayIndex])
    {
        gWeatherPtr->bubblesDelayCounter = 0;
        if (++gWeatherPtr->bubblesDelayIndex > ARRAY_COUNT(sBubbleStartDelays) - 1)
            gWeatherPtr->bubblesDelayIndex = 0;

        CreateBubbleSprite(gWeatherPtr->bubblesCoordsIndex);
        if (++gWeatherPtr->bubblesCoordsIndex > ARRAY_COUNT(sBubbleStartCoords) - 1)
            gWeatherPtr->bubblesCoordsIndex = 0;
    }
}
```

**Bubble Behavior:**
- Uses 12 predefined spawn positions across the screen
- Staggered delays (2-90 frames) create natural look
- Bubbles rise upward from spawn point
- Combined with horizontal fog overlay

### 2.4 Underwater Tileset Animations

**Source:** `public/pokeemerald/src/tileset_anims.c`

```c
// Seaweed animation - 4 frames, 16 ticks interval
const u16 *const gTilesetAnims_Underwater_Seaweed[] = {
    gTilesetAnims_Underwater_Seaweed_Frame0,
    gTilesetAnims_Underwater_Seaweed_Frame1,
    gTilesetAnims_Underwater_Seaweed_Frame2,
    gTilesetAnims_Underwater_Seaweed_Frame3
};

static void TilesetAnim_Underwater(u16 timer)
{
    if (timer % 16 == 0)
        QueueAnimTiles_Underwater_Seaweed(timer / 16);
}
```

**Animation Frames:** `data/tilesets/secondary/underwater/anim/seaweed/{0-3}.png`

---

## Part 3: WATERFALL SYSTEM

### 3.1 Waterfall Tile Detection

**Source:** `public/pokeemerald/src/metatile_behavior.c:995-1001`

```c
bool8 MetatileBehavior_IsWaterfall(u8 metatileBehavior)
{
    if (metatileBehavior == MB_WATERFALL)  // 19 (0x13)
        return TRUE;
    else
        return FALSE;
}
```

### 3.2 Waterfall Movement Blocking

**Source:** `public/pokeemerald/src/metatile_behavior.c:924-931`

```c
bool8 MetatileBehavior_IsSurfableAndNotWaterfall(u8 metatileBehavior)
{
    if (MetatileBehavior_IsSurfableWaterOrUnderwater(metatileBehavior)
     && MetatileBehavior_IsWaterfall(metatileBehavior) == FALSE)
        return TRUE;
    else
        return FALSE;
}
```

**Key Point:** Waterfalls block normal surfing movement - player cannot move UP onto waterfall tiles without using the Waterfall HM.

### 3.3 Waterfall Field Effect Sequence

**Source:** `public/pokeemerald/src/field_effect.c:1828-1897`

```c
bool8 FldEff_UseWaterfall(void)
{
    u8 taskId;
    taskId = CreateTask(Task_UseWaterfall, 0xff);
    gTasks[taskId].tMonId = gFieldEffectArguments[0];
    Task_UseWaterfall(taskId);
    return FALSE;
}

static void Task_UseWaterfall(u8 taskId)
{
    while (sWaterfallFieldEffectFuncs[gTasks[taskId].tState](&gTasks[taskId], &gObjectEvents[gPlayerAvatar.objectEventId]));
}

// State 0: Init
static bool8 WaterfallFieldEffect_Init(struct Task *task, struct ObjectEvent *objectEvent)
{
    LockPlayerFieldControls();
    gPlayerAvatar.preventStep = TRUE;
    task->tState++;
    return FALSE;
}

// State 1: Show Pokemon using move
static bool8 WaterfallFieldEffect_ShowMon(struct Task *task, struct ObjectEvent *objectEvent)
{
    LockPlayerFieldControls();
    if (!ObjectEventIsMovementOverridden(objectEvent))
    {
        ObjectEventClearHeldMovementIfFinished(objectEvent);
        gFieldEffectArguments[0] = task->tMonId;
        FieldEffectStart(FLDEFF_FIELD_MOVE_SHOW_MON_INIT);
        task->tState++;
    }
    return FALSE;
}

// State 2: Wait for show mon animation
static bool8 WaterfallFieldEffect_WaitForShowMon(struct Task *task, struct ObjectEvent *objectEvent)
{
    if (FieldEffectActiveListContains(FLDEFF_FIELD_MOVE_SHOW_MON))
        return FALSE;
    task->tState++;
    return TRUE;
}

// State 3: Move up one tile (slow walk)
static bool8 WaterfallFieldEffect_RideUp(struct Task *task, struct ObjectEvent *objectEvent)
{
    ObjectEventSetHeldMovement(objectEvent, GetWalkSlowMovementAction(DIR_NORTH));
    task->tState++;
    return FALSE;
}

// State 4: Continue riding or end
static bool8 WaterfallFieldEffect_ContinueRideOrEnd(struct Task *task, struct ObjectEvent *objectEvent)
{
    if (!ObjectEventClearHeldMovementIfFinished(objectEvent))
        return FALSE;

    // Check if still on waterfall
    if (MetatileBehavior_IsWaterfall(objectEvent->currentMetatileBehavior))
    {
        // Still on waterfall - loop back to RideUp (state 3)
        task->tState = 3;
        return TRUE;
    }

    // Reached top of waterfall - end
    UnlockPlayerFieldControls();
    gPlayerAvatar.preventStep = FALSE;
    DestroyTask(FindTaskIdByFunc(Task_UseWaterfall));
    FieldEffectActiveListRemove(FLDEFF_USE_WATERFALL);
    return FALSE;
}
```

**Key Mechanics:**
1. Lock player controls
2. Show Pokemon animation (optional in browser)
3. Move player UP one tile at SLOW speed
4. Check if still on waterfall metatile
5. If yes, repeat step 3
6. If no, unlock controls (reached top)

### 3.4 Waterfall Tileset Animation

**Source:** `public/pokeemerald/src/tileset_anims.c:128-138, 670-674`

```c
const u16 *const gTilesetAnims_General_Waterfall[] = {
    gTilesetAnims_General_Waterfall_Frame0,
    gTilesetAnims_General_Waterfall_Frame1,
    gTilesetAnims_General_Waterfall_Frame2,
    gTilesetAnims_General_Waterfall_Frame3
};

static void QueueAnimTiles_General_Waterfall(u16 timer)
{
    u16 i = timer % ARRAY_COUNT(gTilesetAnims_General_Waterfall);  // 4 frames
    AppendTilesetAnimToBuffer(gTilesetAnims_General_Waterfall[i],
        (u16 *)(BG_VRAM + TILE_OFFSET_4BPP(496)),
        6 * TILE_SIZE_4BPP);  // 6 tiles
}

static void TilesetAnim_General(u16 timer)
{
    if (timer % 16 == 3)  // Every 16 frames, offset by 3
        QueueAnimTiles_General_Waterfall(timer / 16);
}
```

**Animation:**
- 4 frames at 16-tick (266ms) intervals
- Located at tile destination 496 in primary tileset
- Graphics: `data/tilesets/primary/general/anim/waterfall/{0-3}.png`

---

## Part 4: PROPOSED REACT IMPLEMENTATION

### 4.1 Module Structure

```
src/game/
├── diving/
│   ├── index.ts              # Module exports
│   ├── types.ts              # Type definitions
│   ├── DivingController.ts   # Core state machine
│   ├── DiveInteractionHandler.ts  # Tile detection & warp logic
│   ├── DiveTransitionRenderer.ts  # Visual transition effects
│   └── UnderwaterEnvironment.ts   # Bubbles, fog, special rendering
│
├── waterfall/
│   ├── index.ts              # Module exports
│   ├── types.ts              # Type definitions
│   ├── WaterfallController.ts    # Core state machine
│   ├── WaterfallInteractionHandler.ts  # Tile detection
│   └── WaterfallAnimationState.ts  # Movement animation
│
├── surfing/                  # (existing)
│   ├── SurfingController.ts
│   ├── SurfBlobRenderer.ts
│   ├── InteractionHandler.ts
│   └── types.ts
│
└── water/                    # Shared water utilities
    ├── index.ts
    ├── WaterBehaviors.ts     # Shared metatile behavior checks
    └── WaterConstants.ts     # Shared constants
```

### 4.2 Type Definitions

```typescript
// src/game/diving/types.ts

export type DiveAnimationPhase =
  | 'IDLE'            // Not diving
  | 'INITIATING'      // Showing Pokemon animation (optional)
  | 'SUBMERGING'      // Screen transition down
  | 'UNDERWATER'      // Active underwater state
  | 'SURFACING'       // Screen transition up
  ;

export interface DivingState {
  phase: DiveAnimationPhase;
  isUnderwater: boolean;

  // Transition animation
  transitionProgress: number;  // 0-1
  transitionStartTime?: number;

  // Warp target
  targetMapId?: string;
  targetX?: number;
  targetY?: number;
}

export interface DiveWarpConnection {
  mapId: string;
  direction: 'dive' | 'emerge';
  offset: number;
}

// Bubble effect for weather
export interface BubbleSprite {
  id: number;
  x: number;
  y: number;
  velocityY: number;
  frame: number;
  alpha: number;
}
```

```typescript
// src/game/waterfall/types.ts

export type WaterfallPhase =
  | 'IDLE'
  | 'INITIATING'      // Showing Pokemon animation
  | 'ASCENDING'       // Moving up waterfall
  | 'COMPLETED'       // Reached top
  ;

export interface WaterfallState {
  phase: WaterfallPhase;
  isOnWaterfall: boolean;

  // Ascent tracking
  currentTileY: number;
  targetTileY: number;  // Top of waterfall
  ascentProgress: number;  // 0-16 pixels within current tile
}
```

### 4.3 DivingController

```typescript
// src/game/diving/DivingController.ts

import type { TileResolver } from '../PlayerController';
import type { DivingState, DiveAnimationPhase } from './types';
import { DiveInteractionHandler } from './DiveInteractionHandler';

export class DivingController {
  private state: DivingState;
  private interactionHandler: DiveInteractionHandler;
  private isAnimating: boolean = false;

  // Transition duration in ms (screen fade)
  private readonly TRANSITION_DURATION = 500;

  constructor() {
    this.state = this.createInitialState();
    this.interactionHandler = new DiveInteractionHandler();
  }

  private createInitialState(): DivingState {
    return {
      phase: 'IDLE',
      isUnderwater: false,
      transitionProgress: 0,
    };
  }

  /**
   * Check if player can dive at current position
   */
  public canDive(
    playerTileX: number,
    playerTileY: number,
    currentMapType: string,
    tileResolver?: TileResolver
  ): { canDive: boolean; targetMap?: string } {
    return this.interactionHandler.checkCanDive(
      playerTileX,
      playerTileY,
      currentMapType,
      tileResolver
    );
  }

  /**
   * Check if player can surface at current position
   */
  public canSurface(
    playerTileX: number,
    playerTileY: number,
    tileResolver?: TileResolver
  ): { canSurface: boolean; targetMap?: string } {
    if (!this.state.isUnderwater) {
      return { canSurface: false };
    }
    return this.interactionHandler.checkCanSurface(
      playerTileX,
      playerTileY,
      tileResolver
    );
  }

  /**
   * Start dive sequence
   */
  public startDive(targetMapId: string, x: number, y: number): void {
    this.isAnimating = true;
    this.state = {
      ...this.state,
      phase: 'SUBMERGING',
      transitionProgress: 0,
      transitionStartTime: Date.now(),
      targetMapId,
      targetX: x,
      targetY: y,
    };
  }

  /**
   * Start surface sequence
   */
  public startSurface(targetMapId: string, x: number, y: number): void {
    this.isAnimating = true;
    this.state = {
      ...this.state,
      phase: 'SURFACING',
      transitionProgress: 0,
      transitionStartTime: Date.now(),
      targetMapId,
      targetX: x,
      targetY: y,
    };
  }

  /**
   * Update dive/surface animation
   */
  public update(): {
    transitionComplete: boolean;
    warpReady: boolean;
    targetMapId?: string;
    targetX?: number;
    targetY?: number;
  } {
    if (this.state.phase === 'IDLE' || this.state.phase === 'UNDERWATER') {
      return { transitionComplete: false, warpReady: false };
    }

    const elapsed = Date.now() - (this.state.transitionStartTime || 0);
    const progress = Math.min(1, elapsed / this.TRANSITION_DURATION);

    this.state.transitionProgress = progress;

    if (progress >= 1) {
      const warpInfo = {
        transitionComplete: true,
        warpReady: true,
        targetMapId: this.state.targetMapId,
        targetX: this.state.targetX,
        targetY: this.state.targetY,
      };

      // Update state after transition
      if (this.state.phase === 'SUBMERGING') {
        this.state = {
          ...this.state,
          phase: 'UNDERWATER',
          isUnderwater: true,
        };
      } else if (this.state.phase === 'SURFACING') {
        this.state = this.createInitialState();
      }

      this.isAnimating = false;
      return warpInfo;
    }

    return { transitionComplete: false, warpReady: false };
  }

  /**
   * Set underwater state (for map load)
   */
  public setUnderwater(isUnderwater: boolean): void {
    this.state.isUnderwater = isUnderwater;
    this.state.phase = isUnderwater ? 'UNDERWATER' : 'IDLE';
  }

  public isUnderwater(): boolean {
    return this.state.isUnderwater;
  }

  public isLocked(): boolean {
    return this.isAnimating;
  }

  public getTransitionProgress(): number {
    return this.state.transitionProgress;
  }

  public getPhase(): DiveAnimationPhase {
    return this.state.phase;
  }
}
```

### 4.4 DiveInteractionHandler

```typescript
// src/game/diving/DiveInteractionHandler.ts

import type { TileResolver } from '../PlayerController';
import {
  MB_INTERIOR_DEEP_WATER,
  MB_DEEP_WATER,
  MB_SOOTOPOLIS_DEEP_WATER,
  MB_NO_SURFACING,
  MB_SEAWEED_NO_SURFACING
} from '../../utils/metatileBehaviors';

export class DiveInteractionHandler {
  /**
   * Check if tile behavior allows diving
   */
  public isDiveableBehavior(behavior: number): boolean {
    return (
      behavior === MB_INTERIOR_DEEP_WATER ||
      behavior === MB_DEEP_WATER ||
      behavior === MB_SOOTOPOLIS_DEEP_WATER
    );
  }

  /**
   * Check if tile behavior blocks surfacing
   */
  public isNoSurfacingBehavior(behavior: number): boolean {
    return (
      behavior === MB_NO_SURFACING ||
      behavior === MB_SEAWEED_NO_SURFACING
    );
  }

  /**
   * Check if player can dive at position
   */
  public checkCanDive(
    tileX: number,
    tileY: number,
    currentMapType: string,
    tileResolver?: TileResolver
  ): { canDive: boolean; targetMap?: string } {
    // Already underwater? Can't dive further
    if (currentMapType === 'MAP_TYPE_UNDERWATER') {
      return { canDive: false };
    }

    if (!tileResolver) {
      return { canDive: false };
    }

    const tile = tileResolver(tileX, tileY);
    if (!tile) {
      return { canDive: false };
    }

    const behavior = tile.attributes?.behavior ?? 0;

    if (!this.isDiveableBehavior(behavior)) {
      return { canDive: false };
    }

    // TODO: Get dive connection from map data
    // For now, return generic success
    return { canDive: true };
  }

  /**
   * Check if player can surface at position
   */
  public checkCanSurface(
    tileX: number,
    tileY: number,
    tileResolver?: TileResolver
  ): { canSurface: boolean; targetMap?: string } {
    if (!tileResolver) {
      return { canSurface: false };
    }

    const tile = tileResolver(tileX, tileY);
    if (!tile) {
      return { canSurface: false };
    }

    const behavior = tile.attributes?.behavior ?? 0;

    // Check if this tile blocks surfacing
    if (this.isNoSurfacingBehavior(behavior)) {
      return { canSurface: false };
    }

    // TODO: Get emerge connection from map data
    return { canSurface: true };
  }
}
```

### 4.5 UnderwaterEnvironment (Bubbles)

```typescript
// src/game/diving/UnderwaterEnvironment.ts

import type { BubbleSprite } from './types';

// Bubble spawn positions (screen coordinates)
const BUBBLE_SPAWN_COORDS = [
  { x: 60, y: 100 }, { x: 180, y: 100 }, { x: 300, y: 100 }, { x: 420, y: 100 },
  { x: 436, y: 130 }, { x: 60, y: 160 }, { x: 436, y: 160 }, { x: 220, y: 180 },
  { x: 476, y: 180 }, { x: 10, y: 90 }, { x: 266, y: 90 }, { x: 256, y: 160 },
];

// Staggered delays between bubble spawns (frames)
const BUBBLE_DELAYS = [40, 90, 60, 90, 2, 60, 40, 30];

const MS_PER_FRAME = 1000 / 60;

export class UnderwaterEnvironment {
  private bubbles: BubbleSprite[] = [];
  private nextBubbleId = 0;
  private delayIndex = 0;
  private delayCounter = 0;
  private coordsIndex = 0;
  private bubbleSpriteLoaded = false;
  private bubbleSprite: HTMLCanvasElement | null = null;

  constructor() {
    this.loadBubbleSprite();
  }

  private loadBubbleSprite(): void {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        // Remove background color
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const bgR = data[0], bgG = data[1], bgB = data[2];
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] === bgR && data[i+1] === bgG && data[i+2] === bgB) {
            data[i+3] = 0;
          }
        }
        ctx.putImageData(imageData, 0, 0);
        this.bubbleSprite = canvas;
        this.bubbleSpriteLoaded = true;
      }
    };
    img.src = '/pokeemerald/graphics/field_effects/pics/bubbles.png';
  }

  /**
   * Update bubble spawning and movement
   */
  public update(deltaMs: number): void {
    const frames = deltaMs / MS_PER_FRAME;

    // Spawn new bubbles
    this.delayCounter += frames;
    if (this.delayCounter >= BUBBLE_DELAYS[this.delayIndex]) {
      this.delayCounter = 0;
      this.delayIndex = (this.delayIndex + 1) % BUBBLE_DELAYS.length;

      this.spawnBubble();
      this.coordsIndex = (this.coordsIndex + 1) % BUBBLE_SPAWN_COORDS.length;
    }

    // Update existing bubbles
    for (const bubble of this.bubbles) {
      // Rise upward (1 pixel every 2 frames)
      bubble.y -= (frames * 0.5);

      // Slight wobble
      bubble.x += Math.sin(bubble.y * 0.05) * 0.3;
    }

    // Remove bubbles that have risen off screen
    this.bubbles = this.bubbles.filter(b => b.y > -32);
  }

  private spawnBubble(): void {
    const coords = BUBBLE_SPAWN_COORDS[this.coordsIndex];
    this.bubbles.push({
      id: this.nextBubbleId++,
      x: coords.x,
      y: coords.y,
      velocityY: -0.5,
      frame: 0,
      alpha: 0.7 + Math.random() * 0.3,
    });
  }

  /**
   * Render bubbles to canvas
   */
  public render(ctx: CanvasRenderingContext2D): void {
    if (!this.bubbleSpriteLoaded || !this.bubbleSprite) return;

    for (const bubble of this.bubbles) {
      ctx.globalAlpha = bubble.alpha;
      ctx.drawImage(
        this.bubbleSprite,
        0, 0, 16, 32,  // Source (first frame, 16x32)
        Math.round(bubble.x), Math.round(bubble.y),
        16, 32
      );
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Clear all bubbles (for map transition)
   */
  public clear(): void {
    this.bubbles = [];
    this.delayCounter = 0;
    this.coordsIndex = 0;
  }
}
```

### 4.6 WaterfallController

```typescript
// src/game/waterfall/WaterfallController.ts

import type { TileResolver } from '../PlayerController';
import type { WaterfallState, WaterfallPhase } from './types';
import { MB_WATERFALL } from '../../utils/metatileBehaviors';

export class WaterfallController {
  private state: WaterfallState;
  private isAnimating: boolean = false;

  // Movement speed (slow walk = 1 pixel per 2 frames)
  private readonly ASCENT_SPEED = 0.03; // pixels per ms

  constructor() {
    this.state = this.createInitialState();
  }

  private createInitialState(): WaterfallState {
    return {
      phase: 'IDLE',
      isOnWaterfall: false,
      currentTileY: 0,
      targetTileY: 0,
      ascentProgress: 0,
    };
  }

  /**
   * Check if player is facing a waterfall
   */
  public isAtWaterfall(
    playerTileX: number,
    playerTileY: number,
    facingDirection: 'up' | 'down' | 'left' | 'right',
    tileResolver?: TileResolver
  ): boolean {
    // Only check UP direction
    if (facingDirection !== 'up') return false;

    if (!tileResolver) return false;

    const aboveTile = tileResolver(playerTileX, playerTileY - 1);
    if (!aboveTile) return false;

    const behavior = aboveTile.attributes?.behavior ?? 0;
    return behavior === MB_WATERFALL;
  }

  /**
   * Check if current tile is waterfall
   */
  public isWaterfallTile(behavior: number): boolean {
    return behavior === MB_WATERFALL;
  }

  /**
   * Start ascending waterfall
   */
  public startAscent(startTileX: number, startTileY: number): void {
    this.isAnimating = true;
    this.state = {
      phase: 'ASCENDING',
      isOnWaterfall: true,
      currentTileY: startTileY,
      targetTileY: startTileY - 1, // Move up one tile
      ascentProgress: 0,
    };
  }

  /**
   * Update waterfall ascent
   * @returns Movement info for player position update
   */
  public update(
    deltaMs: number,
    tileResolver?: TileResolver,
    playerTileX?: number
  ): {
    moving: boolean;
    yOffset: number;
    reachedNextTile: boolean;
    reachedTop: boolean;
    newTileY?: number;
  } {
    if (this.state.phase !== 'ASCENDING') {
      return { moving: false, yOffset: 0, reachedNextTile: false, reachedTop: false };
    }

    // Move upward
    this.state.ascentProgress += this.ASCENT_SPEED * deltaMs;

    const yOffset = -this.state.ascentProgress;

    // Check if reached next tile
    if (this.state.ascentProgress >= 16) {
      const newTileY = this.state.currentTileY - 1;

      // Check if still on waterfall
      if (tileResolver && playerTileX !== undefined) {
        const nextTile = tileResolver(playerTileX, newTileY);
        const behavior = nextTile?.attributes?.behavior ?? 0;

        if (this.isWaterfallTile(behavior)) {
          // Still on waterfall - continue ascending
          this.state.currentTileY = newTileY;
          this.state.targetTileY = newTileY - 1;
          this.state.ascentProgress = 0;

          return {
            moving: true,
            yOffset: 0,
            reachedNextTile: true,
            reachedTop: false,
            newTileY,
          };
        } else {
          // Reached top of waterfall
          this.state = this.createInitialState();
          this.isAnimating = false;

          return {
            moving: false,
            yOffset: 0,
            reachedNextTile: true,
            reachedTop: true,
            newTileY,
          };
        }
      }
    }

    return {
      moving: true,
      yOffset,
      reachedNextTile: false,
      reachedTop: false,
    };
  }

  public isLocked(): boolean {
    return this.isAnimating;
  }

  public getPhase(): WaterfallPhase {
    return this.state.phase;
  }

  public reset(): void {
    this.state = this.createInitialState();
    this.isAnimating = false;
  }
}
```

### 4.7 Integration with PlayerController

```typescript
// Updates to src/game/PlayerController.ts

import { DivingController } from './diving';
import { WaterfallController } from './waterfall';

export class PlayerController {
  private divingController: DivingController;
  private waterfallController: WaterfallController;

  constructor() {
    // ... existing code ...
    this.divingController = new DivingController();
    this.waterfallController = new WaterfallController();
  }

  // Add new player states:
  // - UnderwaterState (uses underwater sprite, different movement)
  // - WaterfallAscentState (auto-ascends waterfall)
  // - DiveTransitionState (handles screen transition)
}
```

### 4.8 Metatile Behaviors Update

```typescript
// Add to src/utils/metatileBehaviors.ts

// Diving behaviors
export const MB_NO_SURFACING = 25;
export const MB_SEAWEED_NO_SURFACING = 42;

export function isDiveableBehavior(behavior: number): boolean {
  return (
    behavior === MB_INTERIOR_DEEP_WATER ||
    behavior === MB_DEEP_WATER ||
    behavior === MB_SOOTOPOLIS_DEEP_WATER
  );
}

export function isNoSurfacingBehavior(behavior: number): boolean {
  return (
    behavior === MB_NO_SURFACING ||
    behavior === MB_SEAWEED_NO_SURFACING
  );
}

export function isWaterfallBehavior(behavior: number): boolean {
  return behavior === MB_WATERFALL;
}
```

---

## Part 5: KEY IMPLEMENTATION NOTES

### 5.1 Dive Warp Coordinate Mapping

When diving/surfacing, the player maintains the **same x,y coordinates** in the target map. This is possible because:

1. Surface and underwater maps have the **same dimensions**
2. The `dive` connection has `offset: 0`
3. Map coordinate space is consistent

```typescript
// Example: Route124 (surface) -> Underwater_Route124
// Player at (42, 51) on surface
// After dive: Player at (42, 51) underwater
```

### 5.2 Screen Transition Effect

The original game uses a fade-to-black transition. For React:

```typescript
// Simple CSS transition approach
.dive-transition {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: black;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.5s;
}

.dive-transition.active {
  opacity: 1;
}
```

### 5.3 Waterfall Detection Edge Cases

- Player can surf ONTO waterfall from below (blocked)
- Player can surf OFF waterfall going down (allowed, uses normal movement)
- HM Waterfall only needed for ascending
- Multiple waterfall tiles in a column = continuous ascent

### 5.4 Underwater Player Sprite

Different sprite sheet is used underwater:
- `graphics/object_events/pics/people/brendan/underwater.png`
- Animation is swimming motion, not walking
- All 4 directions have swimming frames

---

## Summary

This implementation follows the existing `surfing/` module pattern:
- **Controller** - State machine with phases
- **InteractionHandler** - Tile detection and validation
- **Renderer** - Visual effects (bubbles, transitions)
- **Types** - TypeScript interfaces

The diving system is more complex than surfing due to:
1. Map warping (not just movement mode change)
2. Weather/environment effects (bubbles, fog)
3. Different player sprite entirely

The waterfall system is simpler:
1. Single-direction forced movement
2. No map warping
3. Loops until reaching non-waterfall tile
