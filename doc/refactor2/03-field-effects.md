# Refactor 2.3: Extract Field Effects and Sequences

## Current State

MapRenderer.tsx contains several complex state machines:
- Door entry/exit sequences (lines ~330-380, ~2700-3000)
- Warp handling (lines ~130-180, ~2650-2700)
- Fade transitions (lines ~180-200)
- Arrow overlays (lines ~180-190)

These are deeply entangled with the render loop and React state.

---

## Target Architecture

```
src/field/
├── DoorSequencer.ts       # Door open/close state machine (~200 lines)
├── WarpHandler.ts         # Warp detection and execution (~150 lines)
├── FadeController.ts      # Screen fade transitions (~80 lines)
├── ArrowOverlay.ts        # Arrow warp indicator (~60 lines)
├── ReflectionRenderer.ts  # Water/ice reflections (~120 lines)
└── FieldEffectManager.ts  # (existing) Grass/sand effects
```

---

## New Module: `DoorSequencer.ts`

State machine for door animations.

```typescript
/**
 * DoorSequencer - Manages door entry/exit animation sequences
 *
 * Based on pokeemerald's door system:
 * - src/field_door.c: Door animation timing
 * - sDoorAnimGraphicsTable: Door graphics mapping
 *
 * Door Entry Sequence:
 * 1. 'opening' - Door opens (3 frames @ 90ms each)
 * 2. 'stepping' - Player walks into doorway
 * 3. 'closing' - Door closes behind player
 * 4. 'waitingBeforeFade' - Brief pause
 * 5. 'fadingOut' - Screen fades to black
 * 6. 'warping' - Execute warp to destination
 *
 * Door Exit Sequence:
 * 1. 'opening' - Door opens from inside
 * 2. 'stepping' - Player walks out
 * 3. 'closing' - Door closes behind player
 * 4. 'done' - Sequence complete
 */

export type DoorEntryStage =
  | 'idle'
  | 'opening'
  | 'stepping'
  | 'closing'
  | 'waitingBeforeFade'
  | 'fadingOut'
  | 'warping';

export type DoorExitStage = 'idle' | 'opening' | 'stepping' | 'closing' | 'done';

export interface DoorSequenceState {
  type: 'entry' | 'exit';
  stage: DoorEntryStage | DoorExitStage;
  doorWorldX: number;
  doorWorldY: number;
  metatileId: number;
  isAnimatedDoor: boolean;
  animationStartTime: number;
  targetTileX?: number;
  targetTileY?: number;
  entryDirection?: Direction;
  warpTrigger?: WarpTrigger;
}

const DOOR_FRAME_DURATION_MS = 90;
const DOOR_FRAME_COUNT = 3;
const DOOR_FADE_DURATION_MS = 500;
const WAIT_BEFORE_FADE_MS = 200;

export class DoorSequencer {
  private state: DoorSequenceState | null = null;
  private doorAssets: Map<number, HTMLImageElement> = new Map();

  /**
   * Start door entry sequence (player entering a building)
   */
  startEntry(
    trigger: WarpTrigger,
    doorX: number,
    doorY: number,
    metatileId: number,
    currentTime: number
  ): void {
    const asset = this.getDoorAsset(metatileId);

    this.state = {
      type: 'entry',
      stage: 'opening',
      doorWorldX: doorX,
      doorWorldY: doorY,
      metatileId,
      isAnimatedDoor: !!asset,
      animationStartTime: currentTime,
      warpTrigger: trigger,
      entryDirection: trigger.facing,
    };
  }

  /**
   * Start door exit sequence (player exiting a building)
   */
  startExit(
    doorX: number,
    doorY: number,
    metatileId: number,
    exitDirection: Direction,
    currentTime: number
  ): void {
    const asset = this.getDoorAsset(metatileId);

    this.state = {
      type: 'exit',
      stage: 'opening',
      doorWorldX: doorX,
      doorWorldY: doorY,
      metatileId,
      isAnimatedDoor: !!asset,
      animationStartTime: currentTime,
      entryDirection: exitDirection,
    };
  }

  /**
   * Update sequence state
   */
  update(currentTime: number, playerController: PlayerController): DoorSequenceResult {
    if (!this.state) return { done: true };

    const elapsed = currentTime - this.state.animationStartTime;

    if (this.state.type === 'entry') {
      return this.updateEntry(elapsed, currentTime, playerController);
    } else {
      return this.updateExit(elapsed, currentTime, playerController);
    }
  }

  private updateEntry(
    elapsed: number,
    currentTime: number,
    player: PlayerController
  ): DoorSequenceResult {
    const state = this.state!;
    const doorAnimDuration = DOOR_FRAME_DURATION_MS * DOOR_FRAME_COUNT;

    switch (state.stage) {
      case 'opening':
        if (elapsed >= doorAnimDuration || !state.isAnimatedDoor) {
          state.stage = 'stepping';
          state.animationStartTime = currentTime;
          // Start player step movement
          return { action: 'startPlayerStep', direction: state.entryDirection };
        }
        break;

      case 'stepping':
        // Wait for player to finish step
        if (!player.isMoving()) {
          state.stage = 'closing';
          state.animationStartTime = currentTime;
          return { action: 'hidePlayer' };
        }
        break;

      case 'closing':
        if (elapsed >= doorAnimDuration || !state.isAnimatedDoor) {
          state.stage = 'waitingBeforeFade';
          state.animationStartTime = currentTime;
        }
        break;

      case 'waitingBeforeFade':
        if (elapsed >= WAIT_BEFORE_FADE_MS) {
          state.stage = 'fadingOut';
          state.animationStartTime = currentTime;
          return { action: 'startFadeOut', duration: DOOR_FADE_DURATION_MS };
        }
        break;

      case 'fadingOut':
        if (elapsed >= DOOR_FADE_DURATION_MS) {
          state.stage = 'warping';
          return { action: 'executeWarp', trigger: state.warpTrigger };
        }
        break;

      case 'warping':
        this.state = null;
        return { done: true };
    }

    return { done: false };
  }

  /**
   * Get current door animation frame for rendering
   */
  getDoorFrame(currentTime: number): DoorRenderData | null {
    if (!this.state || !this.state.isAnimatedDoor) return null;

    const elapsed = currentTime - this.state.animationStartTime;
    const frameIndex = Math.min(
      Math.floor(elapsed / DOOR_FRAME_DURATION_MS),
      DOOR_FRAME_COUNT - 1
    );

    // Reverse frames for closing animation
    const isClosing = this.state.stage === 'closing';
    const displayFrame = isClosing ? DOOR_FRAME_COUNT - 1 - frameIndex : frameIndex;

    return {
      image: this.doorAssets.get(this.state.metatileId) ?? null,
      frameIndex: displayFrame,
      worldX: this.state.doorWorldX,
      worldY: this.state.doorWorldY,
    };
  }

  isActive(): boolean {
    return this.state !== null;
  }

  getState(): DoorSequenceState | null {
    return this.state;
  }
}

export interface DoorSequenceResult {
  done?: boolean;
  action?: 'startPlayerStep' | 'hidePlayer' | 'startFadeOut' | 'executeWarp';
  direction?: Direction;
  duration?: number;
  trigger?: WarpTrigger;
}

export interface DoorRenderData {
  image: HTMLImageElement | null;
  frameIndex: number;
  worldX: number;
  worldY: number;
}
```

---

## New Module: `WarpHandler.ts`

Handles warp detection and triggering.

```typescript
/**
 * WarpHandler - Detects and executes map warps
 *
 * Warp types (from pokeemerald):
 * - Door warps: Require door animation sequence
 * - Arrow warps: Force player to walk in direction
 * - Teleport warps: Instant transition (cave entrances, etc.)
 *
 * Reference: pokeemerald/src/event_data.c, WarpEvent struct
 */

export type WarpKind = 'door' | 'arrow' | 'teleport';

export interface WarpTrigger {
  kind: WarpKind;
  sourceMap: WorldMapInstance;
  warpEvent: WarpEvent;
  behavior: number;
  facing: Direction;
}

export class WarpHandler {
  private pendingWarp: WarpTrigger | null = null;
  private cooldownMs = 0;
  private lastCheckedTile: { mapId: string; x: number; y: number } | null = null;

  /**
   * Check if player is on a warp tile
   */
  checkTrigger(
    world: WorldState,
    playerTileX: number,
    playerTileY: number,
    playerDirection: Direction,
    isMoving: boolean
  ): WarpTrigger | null {
    // Skip if on cooldown or already have pending warp
    if (this.cooldownMs > 0 || this.pendingWarp) return null;

    // Skip if moving (check when arriving at tile)
    if (isMoving) return null;

    // Find warp event at current tile
    const resolved = resolveTileAt(world, playerTileX, playerTileY);
    if (!resolved || resolved.isBorder) return null;

    const warpEvent = findWarpEventAt(resolved.map, playerTileX, playerTileY);
    if (!warpEvent) return null;

    // Avoid re-triggering same warp
    const tileKey = { mapId: resolved.map.entry.id, x: playerTileX, y: playerTileY };
    if (this.isSameTile(tileKey, this.lastCheckedTile)) return null;
    this.lastCheckedTile = tileKey;

    const behavior = resolved.attributes?.behavior ?? -1;
    const kind = this.classifyWarpKind(behavior);

    // Arrow warps need special handling (forced movement)
    if (kind === 'arrow') {
      // TODO: Implement arrow warp forced movement
      return null;
    }

    const trigger: WarpTrigger = {
      kind: kind ?? 'teleport',
      sourceMap: resolved.map,
      warpEvent,
      behavior,
      facing: playerDirection,
    };

    this.pendingWarp = trigger;
    return trigger;
  }

  /**
   * Execute pending warp
   */
  async executeWarp(
    mapManager: MapManager,
    trigger: WarpTrigger
  ): Promise<{ world: WorldState; spawnPos: Position }> {
    const dest = trigger.warpEvent;

    // Load destination map
    const newWorld = await mapManager.loadWorld(dest.destMap);
    if (!newWorld) throw new Error(`Failed to load destination map: ${dest.destMap}`);

    // Find spawn position from warp ID
    const destMap = newWorld.maps.find(m => m.entry.id === dest.destMap);
    const spawnWarp = destMap?.warpEvents?.find(w => w.id === dest.destWarpId);

    const spawnPos: Position = {
      tileX: spawnWarp?.x ?? dest.x ?? 0,
      tileY: spawnWarp?.y ?? dest.y ?? 0,
      x: 0,
      y: 0,
    };
    spawnPos.x = spawnPos.tileX * 16;
    spawnPos.y = spawnPos.tileY * 16;

    // Set cooldown to prevent immediate re-warp
    this.cooldownMs = 500;
    this.pendingWarp = null;
    this.lastCheckedTile = null;

    return { world: newWorld, spawnPos };
  }

  /**
   * Update cooldown timer
   */
  update(deltaMs: number): void {
    if (this.cooldownMs > 0) {
      this.cooldownMs = Math.max(0, this.cooldownMs - deltaMs);
    }
  }

  private classifyWarpKind(behavior: number): WarpKind | null {
    if (isArrowWarpBehavior(behavior)) return 'arrow';
    if (requiresDoorExitSequence(behavior)) return 'door';
    if (isTeleportWarpBehavior(behavior)) return 'teleport';
    return null;
  }

  private isSameTile(
    a: { mapId: string; x: number; y: number } | null,
    b: { mapId: string; x: number; y: number } | null
  ): boolean {
    if (!a || !b) return false;
    return a.mapId === b.mapId && a.x === b.x && a.y === b.y;
  }
}
```

---

## New Module: `FadeController.ts`

Simple fade transition controller.

```typescript
/**
 * FadeController - Screen fade in/out transitions
 *
 * Used for:
 * - Map transitions (fade out, load, fade in)
 * - Door entries (fade out after closing)
 *
 * Reference: pokeemerald/src/field_screen_effect.c
 */

export type FadeDirection = 'in' | 'out';

export interface FadeState {
  direction: FadeDirection;
  startTime: number;
  duration: number;
}

export class FadeController {
  private state: FadeState | null = null;

  /**
   * Start fade out (to black)
   */
  startFadeOut(duration: number, currentTime: number): void {
    this.state = {
      direction: 'out',
      startTime: currentTime,
      duration,
    };
  }

  /**
   * Start fade in (from black)
   */
  startFadeIn(duration: number, currentTime: number): void {
    this.state = {
      direction: 'in',
      startTime: currentTime,
      duration,
    };
  }

  /**
   * Get current fade alpha (0 = transparent, 1 = black)
   */
  getAlpha(currentTime: number): number {
    if (!this.state) return 0;

    const elapsed = currentTime - this.state.startTime;
    const progress = Math.min(1, elapsed / this.state.duration);

    if (this.state.direction === 'out') {
      return progress; // 0 -> 1 (fade to black)
    } else {
      return 1 - progress; // 1 -> 0 (fade from black)
    }
  }

  /**
   * Check if fade is complete
   */
  isComplete(currentTime: number): boolean {
    if (!this.state) return true;
    return currentTime - this.state.startTime >= this.state.duration;
  }

  /**
   * Render fade overlay
   */
  render(ctx: CanvasRenderingContext2D, width: number, height: number, currentTime: number): void {
    const alpha = this.getAlpha(currentTime);
    if (alpha <= 0) return;

    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.fillRect(0, 0, width, height);
  }

  isActive(): boolean {
    return this.state !== null;
  }

  clear(): void {
    this.state = null;
  }
}
```

---

## New Module: `ReflectionRenderer.ts`

Handles water and ice reflections.

```typescript
/**
 * ReflectionRenderer - Renders object reflections on water/ice
 *
 * pokeemerald reflection system:
 * - Water: Blue-tinted, slightly transparent
 * - Ice: Mirror reflection, no tint
 *
 * Reflection position is offset based on sprite size
 * (reflection appears below the object)
 *
 * Reference: pokeemerald/src/field_effect_helpers.c UpdateObjectReflectionSprite
 */

export type ReflectionType = 'water' | 'ice';

export class ReflectionRenderer {
  /**
   * Render reflection for player or NPC
   */
  render(
    ctx: CanvasRenderingContext2D,
    sprite: SpriteData,
    reflectionType: ReflectionType,
    worldX: number,
    worldY: number,
    cameraX: number,
    cameraY: number,
    reflectionMask?: Uint8Array
  ): void {
    const screenX = Math.round(worldX - cameraX);
    const screenY = Math.round(worldY - cameraY);

    // Reflection appears below sprite
    const reflectY = screenY + sprite.height;

    ctx.save();

    // Apply reflection style
    if (reflectionType === 'water') {
      ctx.globalAlpha = 0.5;
      // Blue tint via composite operation
      ctx.filter = 'hue-rotate(200deg) saturate(1.5)';
    }

    // Flip vertically for reflection
    ctx.translate(screenX, reflectY + sprite.height);
    ctx.scale(1, -1);

    // Draw reflected sprite
    ctx.drawImage(
      sprite.image,
      sprite.srcX,
      sprite.srcY,
      sprite.width,
      sprite.height,
      0,
      0,
      sprite.width,
      sprite.height
    );

    ctx.restore();
  }

  /**
   * Check if tile has reflective surface
   */
  getReflectionType(world: WorldState, tileX: number, tileY: number): ReflectionType | null {
    const resolved = resolveTileAt(world, tileX, tileY);
    if (!resolved) return null;

    const behavior = resolved.attributes?.behavior ?? -1;

    if (isIceBehavior(behavior)) return 'ice';
    if (isReflectiveBehavior(behavior)) return 'water';

    return null;
  }
}
```

---

## Migration Steps

1. **Create field modules** in `src/field/`
2. **Extract DoorSequencer** - Move door state machine from MapRenderer
3. **Extract WarpHandler** - Move warp detection logic
4. **Extract FadeController** - Move fade state
5. **Extract ReflectionRenderer** - Move reflection rendering
6. **Update MapRenderer** to use extracted modules
7. **Test all warp types** - door, teleport, ensure identical behavior

---

## Testing Strategy

```typescript
describe('DoorSequencer', () => {
  it('progresses through entry stages correctly', () => {
    const sequencer = new DoorSequencer();
    const mockTrigger = createMockWarpTrigger();

    sequencer.startEntry(mockTrigger, 100, 100, 0x021, 0);

    expect(sequencer.getState()?.stage).toBe('opening');

    // Simulate time passing
    const result = sequencer.update(300, mockPlayerController); // 3 frames
    expect(sequencer.getState()?.stage).toBe('stepping');
  });
});
```
