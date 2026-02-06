---
title: Item Ball (Overworld Objects) Implementation Plan
status: planned
last_verified: 2026-01-13
---

# Item Ball (Overworld Objects) Implementation Plan

## Overview

This document outlines the complete plan for implementing overworld item balls - the Pokeball sprites on maps that players can interact with to pick up items. This is the first step toward full NPC/object event support.

## 1. Data Structures & Source Files

### 1.1 Object Event Structure (from map.json)

Each map's `object_events` array contains entries like:

```json
{
  "graphics_id": "OBJ_EVENT_GFX_ITEM_BALL",
  "x": 11,
  "y": 15,
  "elevation": 3,
  "movement_type": "MOVEMENT_TYPE_FACE_DOWN",
  "movement_range_x": 0,
  "movement_range_y": 0,
  "trainer_type": "TRAINER_TYPE_NONE",
  "trainer_sight_or_berry_tree_id": "0",
  "script": "Route102_EventScript_ItemPotion",
  "flag": "FLAG_ITEM_ROUTE_102_POTION"
}
```

**Key fields for item balls:**
- `graphics_id`: Always `"OBJ_EVENT_GFX_ITEM_BALL"` (constant value 59)
- `x`, `y`: Tile coordinates (local to map)
- `elevation`: Z-level (typically 3 for ground)
- `script`: References item script (e.g., `Route102_EventScript_ItemPotion`)
- `flag`: Flag ID to track if item was picked up (e.g., `FLAG_ITEM_ROUTE_102_POTION`)

### 1.2 Item Script Mapping

Location: `/public/pokeemerald/data/scripts/item_ball_scripts.inc`

```assembly
Route102_EventScript_ItemPotion::
    finditem ITEM_POTION
    end
```

Pattern: `[Location]_EventScript_Item[ItemName]` → `finditem ITEM_[NAME]`

### 1.3 Item Constants

Location: `/public/pokeemerald/include/constants/items.h`

```c
#define ITEM_NONE 0
#define ITEM_MASTER_BALL 1
#define ITEM_POTION 13
#define ITEM_RARE_CANDY 68
// ... 377 items total
```

### 1.4 Pickup Text

Location: `/public/pokeemerald/data/text/obtain_item.inc`

```
gText_PlayerFoundOneItem::
    .string "{PLAYER} found one {STR_VAR_2}!$"

gText_PlayerPutItemInBag::
    .string "{PLAYER} put away the {STR_VAR_2}\n"
    .string "in the BAG.$"
```

### 1.5 Item Ball Sprite

Location: `/public/pokeemerald/graphics/object_events/pics/misc/item_ball.png`

- Single 16x16 sprite (no animation)
- Uses NPC palette 3 (`OBJ_EVENT_PAL_TAG_NPC_3`)

---

## 2. Implementation Phases

### Phase 1: Data Infrastructure

#### 2.1 Create Item Database (`src/data/items.ts`)

Parse and export item data:

```typescript
// Generated from items.h
export const ITEMS: Record<string, number> = {
  ITEM_NONE: 0,
  ITEM_MASTER_BALL: 1,
  ITEM_POTION: 13,
  // ...
};

// Human-readable names (manually curated or parsed)
export const ITEM_NAMES: Record<number, string> = {
  0: "???",
  1: "MASTER BALL",
  13: "POTION",
  68: "RARE CANDY",
  // ...
};

export function getItemName(itemId: number): string {
  return ITEM_NAMES[itemId] ?? `ITEM_${itemId}`;
}
```

#### 2.2 Create Item Script Parser (`src/data/itemScripts.ts`)

Parse `item_ball_scripts.inc` to map script names to item IDs:

```typescript
// Map script name → item constant name
export const SCRIPT_TO_ITEM: Record<string, string> = {
  "Route102_EventScript_ItemPotion": "ITEM_POTION",
  "Route103_EventScript_ItemGuardSpec": "ITEM_GUARD_SPEC",
  // ... generated from parsing item_ball_scripts.inc
};

export function getItemIdFromScript(scriptName: string): number | null {
  const itemConst = SCRIPT_TO_ITEM[scriptName];
  if (!itemConst) return null;
  return ITEMS[itemConst] ?? null;
}
```

#### 2.3 Create Game Flags System (`src/game/GameFlags.ts`)

```typescript
const STORAGE_KEY = 'pokemon-rse-browser-flags';

class GameFlagsManager {
  private flags: Set<string> = new Set();

  constructor() {
    this.load();
  }

  private load(): void {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      this.flags = new Set(JSON.parse(stored));
    }
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.flags]));
  }

  isSet(flag: string): boolean {
    return this.flags.has(flag);
  }

  set(flag: string): void {
    this.flags.add(flag);
    this.save();
  }

  clear(flag: string): void {
    this.flags.delete(flag);
    this.save();
  }

  reset(): void {
    this.flags.clear();
    this.save();
  }
}

export const gameFlags = new GameFlagsManager();
```

---

### Phase 2: Object Event Types & Parsing

#### 2.4 Create Object Event Types (`src/types/objectEvents.ts`)

```typescript
export interface ObjectEvent {
  graphics_id: string;
  x: number;
  y: number;
  elevation: number;
  movement_type: string;
  movement_range_x: number;
  movement_range_y: number;
  trainer_type: string;
  trainer_sight_or_berry_tree_id: string;
  script: string;
  flag: string;
}

export interface ItemBallObject {
  id: string;              // Unique ID for React keys
  tileX: number;           // World tile X (map offset + local x)
  tileY: number;           // World tile Y (map offset + local y)
  elevation: number;
  itemId: number;          // Resolved item ID
  itemName: string;        // Human-readable name
  flag: string;            // Flag to check/set
  script: string;          // Original script name
  collected: boolean;      // Derived from flag state
}
```

#### 2.5 Object Event Parser (`src/game/ObjectEventManager.ts`)

```typescript
export class ObjectEventManager {
  private itemBalls: Map<string, ItemBallObject> = new Map();

  parseMapObjects(
    mapId: string,
    objectEvents: ObjectEvent[],
    mapOffsetX: number,
    mapOffsetY: number
  ): void {
    for (const obj of objectEvents) {
      if (obj.graphics_id === 'OBJ_EVENT_GFX_ITEM_BALL') {
        const itemId = getItemIdFromScript(obj.script);
        if (itemId === null) continue;

        const worldX = mapOffsetX + obj.x;
        const worldY = mapOffsetY + obj.y;
        const id = `${mapId}_item_${worldX}_${worldY}`;

        this.itemBalls.set(id, {
          id,
          tileX: worldX,
          tileY: worldY,
          elevation: obj.elevation,
          itemId,
          itemName: getItemName(itemId),
          flag: obj.flag,
          script: obj.script,
          collected: gameFlags.isSet(obj.flag),
        });
      }
    }
  }

  getVisibleItemBalls(): ItemBallObject[] {
    return [...this.itemBalls.values()].filter(ball => !ball.collected);
  }

  collectItem(id: string): ItemBallObject | null {
    const ball = this.itemBalls.get(id);
    if (!ball || ball.collected) return null;

    ball.collected = true;
    if (ball.flag && ball.flag !== '0') {
      gameFlags.set(ball.flag);
    }
    return ball;
  }

  getItemBallAt(tileX: number, tileY: number): ItemBallObject | null {
    for (const ball of this.itemBalls.values()) {
      if (ball.tileX === tileX && ball.tileY === tileY && !ball.collected) {
        return ball;
      }
    }
    return null;
  }
}
```

---

### Phase 3: Rendering

#### 2.6 Item Ball Sprite Loading

Add to `MapRenderer.tsx`:

```typescript
const itemBallSpriteRef = useRef<HTMLCanvasElement | null>(null);

const ensureItemBallSprite = useCallback(async () => {
  if (itemBallSpriteRef.current) return itemBallSpriteRef.current;

  const img = new Image();
  img.src = '/pokeemerald/graphics/object_events/pics/misc/item_ball.png';
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  // Apply transparency (cyan background)
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const bgColor = { r: imageData.data[0], g: imageData.data[1], b: imageData.data[2] };

  for (let i = 0; i < imageData.data.length; i += 4) {
    if (imageData.data[i] === bgColor.r &&
        imageData.data[i+1] === bgColor.g &&
        imageData.data[i+2] === bgColor.b) {
      imageData.data[i+3] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  itemBallSpriteRef.current = canvas;
  return canvas;
}, []);
```

#### 2.7 Item Ball Rendering

Add to `ObjectRenderer.ts`:

```typescript
static renderItemBalls(
  ctx: CanvasRenderingContext2D,
  itemBalls: ItemBallObject[],
  sprite: HTMLCanvasElement,
  view: WorldCameraView,
  playerY: number,
  layer: 'bottom' | 'top'
): void {
  const SPRITE_SIZE = 16;

  for (const ball of itemBalls) {
    // World position (center of tile)
    const worldX = ball.tileX * 16 + 8;
    const worldY = ball.tileY * 16 + 8;

    // Y-sorting: render behind player if ball is above player's Y
    const isInFront = worldY >= playerY;
    if (layer === 'bottom' && isInFront) continue;
    if (layer === 'top' && !isInFront) continue;

    // Screen position (top-left of sprite)
    const screenX = Math.round(worldX - view.cameraWorldX - SPRITE_SIZE / 2);
    const screenY = Math.round(worldY - view.cameraWorldY - SPRITE_SIZE / 2);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite, screenX, screenY);
  }
}
```

---

### Phase 4: Interaction System

#### 2.8 Interaction Detection

Add to `PlayerController.ts`:

```typescript
private objectEventManager: ObjectEventManager | null = null;

setObjectEventManager(manager: ObjectEventManager): void {
  this.objectEventManager = manager;
}

// Called when player presses A button
tryInteract(): ItemBallObject | null {
  if (!this.objectEventManager) return null;

  // Check tile player is facing
  const facingX = this.tileX + this.getDeltaX();
  const facingY = this.tileY + this.getDeltaY();

  return this.objectEventManager.getItemBallAt(facingX, facingY);
}

private getDeltaX(): number {
  switch (this.direction) {
    case 'left': return -1;
    case 'right': return 1;
    default: return 0;
  }
}

private getDeltaY(): number {
  switch (this.direction) {
    case 'up': return -1;
    case 'down': return 1;
    default: return 0;
  }
}
```

#### 2.9 Item Pickup Flow

Add interaction handler in `MapRenderer.tsx`:

```typescript
const handleItemPickup = useCallback(async (ball: ItemBallObject) => {
  // Lock player input during dialog
  player.lockInput();

  // Show "Player found one [ITEM]!" message
  await showMessage(`${playerName} found one ${ball.itemName}!`);

  // Show "Player put away the [ITEM] in the BAG."
  await showMessage(`${playerName} put away the ${ball.itemName}\nin the BAG.`);

  // Mark item as collected
  objectEventManager.collectItem(ball.id);

  // Unlock player input
  player.unlockInput();
}, [player, showMessage, objectEventManager]);

// In the keyboard handler for A button (KeyX):
useEffect(() => {
  const handleInteraction = async (e: KeyboardEvent) => {
    if (e.code !== 'KeyX') return;
    if (dialogIsOpen) return;
    if (!player || player.isMoving) return;

    const itemBall = player.tryInteract();
    if (itemBall) {
      e.preventDefault();
      await handleItemPickup(itemBall);
    }
  };

  window.addEventListener('keydown', handleInteraction);
  return () => window.removeEventListener('keydown', handleInteraction);
}, [player, dialogIsOpen, handleItemPickup]);
```

---

### Phase 5: Integration

#### 2.10 MapRenderer Integration

1. Initialize `ObjectEventManager` when map loads
2. Parse object events from map data
3. Pass item balls to render pipeline
4. Handle Y-sorting with player

```typescript
// In useEffect that handles map loading:
useEffect(() => {
  if (!mapData) return;

  objectEventManagerRef.current = new ObjectEventManager();
  objectEventManagerRef.current.parseMapObjects(
    mapData.id,
    mapData.object_events,
    mapData.offsetX,
    mapData.offsetY
  );

  if (player) {
    player.setObjectEventManager(objectEventManagerRef.current);
  }
}, [mapData, player]);

// In render loop:
const itemBalls = objectEventManagerRef.current?.getVisibleItemBalls() ?? [];

// Render item balls with Y-sorting
if (itemBallSpriteRef.current) {
  ObjectRenderer.renderItemBalls(
    mainCtx, itemBalls, itemBallSpriteRef.current, view, playerY, 'bottom'
  );
}

// ... render player ...

if (itemBallSpriteRef.current) {
  ObjectRenderer.renderItemBalls(
    mainCtx, itemBalls, itemBallSpriteRef.current, view, playerY, 'top'
  );
}
```

---

## 3. File Changes Summary

### New Files
- `src/data/items.ts` - Item ID constants and names
- `src/data/itemScripts.ts` - Script-to-item mapping
- `src/game/GameFlags.ts` - Flag persistence system
- `src/game/ObjectEventManager.ts` - Object event parsing/management
- `src/types/objectEvents.ts` - TypeScript interfaces

### Modified Files
- `src/components/MapRenderer.tsx` - Item ball rendering, interaction handling
- `src/components/map/renderers/ObjectRenderer.ts` - Add `renderItemBalls` method
- `src/game/PlayerController.ts` - Add `tryInteract` method

---

## 4. Data Generation Scripts

### 4.1 Generate Items Database

```bash
# Parse items.h to generate items.ts
node scripts/generateItems.js
```

### 4.2 Generate Script Mapping

```bash
# Parse item_ball_scripts.inc to generate itemScripts.ts
node scripts/generateItemScripts.js
```

---

## 5. Testing Checklist

- [ ] Item balls render at correct positions
- [ ] Item balls Y-sort correctly with player
- [ ] Item balls use correct transparency (no cyan background)
- [ ] Pressing A while facing item ball triggers pickup
- [ ] Pickup shows correct item name in dialog
- [ ] Flag is set after pickup (item doesn't reappear)
- [ ] Flags persist across page reloads (localStorage)
- [ ] Items on different elevations handled correctly
- [ ] Multiple item balls on same map work correctly
- [ ] Flag reset function works for testing

---

## 6. Future Enhancements

### 6.1 Hidden Items
Some items use `OBJ_EVENT_GFX_ITEM_BALL` but are hidden until revealed with Itemfinder. These use different flags.

### 6.2 TMs/HMs
TMs have special text: "Player found TM01!" followed by "It contained FOCUS PUNCH!"

### 6.3 Key Items
Key items go to a different pocket and may have special handling.

### 6.4 Berry Trees
Use `OBJ_EVENT_GFX_BERRY_TREE` with growth stages - separate implementation needed.

### 6.5 Full NPC System
This same infrastructure can be extended for NPCs:
- Different graphics IDs for NPC sprites
- Movement patterns (wander, look around, etc.)
- Dialog scripts
- Trainer battles

---

## 7. C Code Reference

### Item Ball Graphics Info
```c
// src/data/object_events/object_event_graphics_info.h:1141
const struct ObjectEventGraphicsInfo gObjectEventGraphicsInfo_ItemBall = {
    .tileTag = TAG_NONE,
    .paletteTag = OBJ_EVENT_PAL_TAG_NPC_3,
    .reflectionPaletteTag = OBJ_EVENT_PAL_TAG_NONE,
    .size = 16,  // 16x16 sprite
    .width = 16,
    .height = 16,
    // ...
};
```

### Finding Items (scripting)
```c
// src/scrcmd.c - finditem command implementation
bool8 ScrCmd_finditem(struct ScriptContext *ctx) {
    u16 itemId = VarGet(ScriptReadHalfword(ctx));
    u32 quantity = VarGet(ScriptReadHalfword(ctx));
    // Shows message and adds to bag
}
```
