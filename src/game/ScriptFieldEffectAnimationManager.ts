/**
 * ScriptFieldEffectAnimationManager
 *
 * Runtime manager for script-triggered field effects that need animation and rendering.
 *
 * C references:
 * - public/pokeemerald/src/field_effect.c
 *   - FldEff_NPCFlyOut
 *   - SpriteCB_NPCFlyOut
 */

import { GBA_FRAME_MS } from '../config/timing.ts';
import { FIELD_EFFECT_REGISTRY } from '../data/fieldEffects.gen.ts';
import type { SpriteInstance, WorldCameraView } from '../rendering/types.ts';
import { calculateSortKey, getFieldEffectAtlasName } from '../rendering/spriteUtils.ts';

export type ScriptFieldEffectArgValue = string | number;
export type ScriptFieldEffectArgs = ReadonlyMap<number, ScriptFieldEffectArgValue>;

export type ScriptFieldEffectOwner =
  | { kind: 'screen' }
  | { kind: 'player' }
  | { kind: 'npc'; mapId: string; localId: string };

export interface ScriptFieldEffectPositionResolvers {
  getPlayerWorldPosition: () => { x: number; y: number } | null;
  getNpcWorldPosition: (mapId: string, localId: string) => { x: number; y: number } | null;
  getPlayerSpriteHeight?: () => number | null;
  getNpcSpriteHeight?: (mapId: string, localId: string) => number | null;
}

interface NpcFlyOutState {
  type: 'npcFlyOut';
  angle: number;
  elapsedFrames: number;
  atlasName: string;
  width: number;
  height: number;
  baseScreenX: number;
  baseScreenY: number;
  radiusX: number;
  radiusY: number;
}

interface SparkleState {
  type: 'sparkle';
  worldTileX: number;
  worldTileY: number;
  frame: number;
  sequenceIndex: number;
  sequenceFrameTicks: number;
  finished: boolean;
  endTimer: number;
  visible: boolean;
  atlasName: string;
  width: number;
  height: number;
  priority: number;
}

interface EmotionIconState {
  type: 'emotionIcon';
  atlasName: string;
  width: number;
  height: number;
  elapsedFrames: number;
  totalFrames: number;
  yVelocity: number;
  yOffset: number;
}

type ScriptFieldEffectState = NpcFlyOutState | SparkleState | EmotionIconState;

interface ScriptFieldEffectInstance {
  id: string;
  effectName: string;
  owner: ScriptFieldEffectOwner;
  state: ScriptFieldEffectState;
  completion: Promise<void>;
  resolveCompletion: () => void;
}

const NPC_FLY_OUT_FRAMES = 32;
const NPC_FLY_OUT_ANGLE_STEP = 4;
const NPC_FLY_OUT_BASE_SCREEN_X = 0x78; // 120
const NPC_FLY_OUT_BASE_SCREEN_Y = 0;
const NPC_FLY_OUT_RADIUS_X = 0x8c; // 140
const NPC_FLY_OUT_RADIUS_Y = 0x48; // 72

const FULL_TRIG_CIRCLE = 256;
const RAD_PER_TRIG_STEP = (Math.PI * 2) / FULL_TRIG_CIRCLE;
const EMOTION_ICON_TOTAL_FRAMES = 60;
const EMOTION_ICON_OWNER_CENTER_Y_OFFSET = -16;
const DEFAULT_OWNER_SPRITE_HEIGHT = 32;

function trigCos(angle: number, amplitude: number): number {
  const radians = (angle & 0xff) * RAD_PER_TRIG_STEP;
  return Math.round(Math.cos(radians) * amplitude);
}

function trigSin(angle: number, amplitude: number): number {
  const radians = (angle & 0xff) * RAD_PER_TRIG_STEP;
  return Math.round(Math.sin(radians) * amplitude);
}

function resolveEmotionRegistryKey(effectName: string): string | null {
  switch (effectName) {
    case 'FLDEFF_EXCLAMATION_MARK_ICON':
      return 'EXCLAMATION_MARK_ICON';
    case 'FLDEFF_QUESTION_MARK_ICON':
      return 'QUESTION_MARK_ICON';
    case 'FLDEFF_HEART_ICON':
      return 'HEART_ICON';
    default:
      return null;
  }
}

function resolveOwnerFromArgs(args: ScriptFieldEffectArgs): ScriptFieldEffectOwner {
  const arg0 = args.get(0);
  const arg1 = args.get(1);

  const localIdFromValue = (value: ScriptFieldEffectArgValue | undefined): string | null => {
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(Math.trunc(value));
    }
    return null;
  };

  const localId0 = localIdFromValue(arg0);
  const localId1 = localIdFromValue(arg1);

  if (localId0 === 'LOCALID_PLAYER' || localId0 === '255') {
    return { kind: 'player' };
  }

  const isResolvableLocalId = (value: string | null): boolean => {
    if (!value) return false;
    return value.startsWith('LOCALID_') || /^\d+$/.test(value);
  };

  if (localId0 && isResolvableLocalId(localId0) && typeof arg1 === 'string' && arg1.startsWith('MAP_')) {
    return { kind: 'npc', mapId: arg1, localId: localId0 };
  }

  if (localId1 && typeof arg0 === 'string' && arg0.startsWith('MAP_') && isResolvableLocalId(localId1)) {
    return { kind: 'npc', mapId: arg0, localId: localId1 };
  }

  return { kind: 'screen' };
}

export class ScriptFieldEffectAnimationManager {
  private readonly positionResolvers: ScriptFieldEffectPositionResolvers;
  private readonly instances = new Map<string, ScriptFieldEffectInstance>();
  private readonly activeByEffectName = new Map<string, Set<string>>();
  private readonly waitersByEffectName = new Map<string, Set<() => void>>();
  private frameAccumulatorMs = 0;
  private nextInstanceId = 0;

  constructor(positionResolvers: ScriptFieldEffectPositionResolvers) {
    this.positionResolvers = positionResolvers;
  }

  clear(): void {
    const pending = [...this.instances.values()];
    const pendingWaiters = [...this.waitersByEffectName.values()];
    this.instances.clear();
    this.activeByEffectName.clear();
    this.waitersByEffectName.clear();
    this.frameAccumulatorMs = 0;

    for (const instance of pending) {
      instance.resolveCompletion();
    }

    for (const waiters of pendingWaiters) {
      for (const resolve of waiters) {
        resolve();
      }
    }
  }

  start(effectName: string, args: ScriptFieldEffectArgs = new Map()): Promise<void> {
    switch (effectName) {
      case 'FLDEFF_NPCFLY_OUT':
        return this.startNpcFlyOut(effectName, args);
      case 'FLDEFF_SPARKLE':
        return this.startSparkle(effectName, args);
      case 'FLDEFF_EXCLAMATION_MARK_ICON':
      case 'FLDEFF_QUESTION_MARK_ICON':
      case 'FLDEFF_HEART_ICON':
        return this.startEmotionIcon(effectName, args);
      default:
        return Promise.resolve();
    }
  }

  wait(effectName: string): Promise<void> {
    const active = this.activeByEffectName.get(effectName);
    if (!active || active.size === 0) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      let waiters = this.waitersByEffectName.get(effectName);
      if (!waiters) {
        waiters = new Set();
        this.waitersByEffectName.set(effectName, waiters);
      }
      waiters.add(resolve);
    });
  }

  update(deltaMs: number): void {
    if (deltaMs <= 0) return;

    this.frameAccumulatorMs += deltaMs;
    let framesToAdvance = Math.floor(this.frameAccumulatorMs / GBA_FRAME_MS);
    if (framesToAdvance <= 0) {
      return;
    }

    this.frameAccumulatorMs -= framesToAdvance * GBA_FRAME_MS;
    while (framesToAdvance > 0) {
      this.advanceOneFrame();
      framesToAdvance--;
    }
  }

  buildSprites(
    view: WorldCameraView,
    hasAtlas: (atlasName: string) => boolean
  ): SpriteInstance[] {
    const sprites: SpriteInstance[] = [];

    for (const instance of this.instances.values()) {
      if (instance.state.type === 'npcFlyOut') {
        if (!hasAtlas(instance.state.atlasName)) continue;

        const center = this.resolveOwnerWorldPosition(instance, view);
        if (!center) continue;

        const { width, height, atlasName } = instance.state;
        const worldX = Math.round(center.x - width / 2);
        const worldY = Math.round(center.y - height / 2);
        sprites.push({
          worldX,
          worldY,
          width,
          height,
          atlasName,
          atlasX: 0,
          atlasY: 0,
          atlasWidth: width,
          atlasHeight: height,
          flipX: false,
          flipY: false,
          alpha: 1.0,
          tintR: 1.0,
          tintG: 1.0,
          tintB: 1.0,
          sortKey: calculateSortKey(center.y + height / 2, 192),
          isReflection: false,
        });
        continue;
      }

      if (instance.state.type === 'emotionIcon') {
        const state = instance.state;
        if (!hasAtlas(state.atlasName)) {
          continue;
        }

        const center = this.resolveOwnerWorldPosition(instance, view);
        if (!center) {
          continue;
        }

        const ownerSpriteHeight = this.resolveOwnerSpriteHeight(instance);
        // trainer_see.c SpriteCB_TrainerIcons parity:
        // icon center Y = owner sprite center Y - 16 + bounce offset.
        const ownerCenterY = center.y - ownerSpriteHeight / 2;
        const iconCenterY = ownerCenterY + EMOTION_ICON_OWNER_CENTER_Y_OFFSET + state.yOffset;

        sprites.push({
          worldX: Math.round(center.x - state.width / 2),
          worldY: Math.round(iconCenterY - state.height / 2),
          width: state.width,
          height: state.height,
          atlasName: state.atlasName,
          atlasX: 0,
          atlasY: 0,
          atlasWidth: state.width,
          atlasHeight: state.height,
          flipX: false,
          flipY: false,
          alpha: 1.0,
          tintR: 1.0,
          tintG: 1.0,
          tintB: 1.0,
          sortKey: calculateSortKey(center.y, 255),
          isReflection: false,
        });
        continue;
      }

      if (instance.state.type === 'sparkle') {
        const state = instance.state;
        if (!state.visible || !hasAtlas(state.atlasName)) {
          continue;
        }

        const worldX = state.worldTileX * 16;
        const worldY = state.worldTileY * 16;
        const subpriority = 128 + Math.max(0, Math.min(3, state.priority)) * 8;
        sprites.push({
          worldX,
          worldY,
          width: state.width,
          height: state.height,
          atlasName: state.atlasName,
          atlasX: state.frame * state.width,
          atlasY: 0,
          atlasWidth: state.width,
          atlasHeight: state.height,
          flipX: false,
          flipY: false,
          alpha: 1.0,
          tintR: 1.0,
          tintG: 1.0,
          tintB: 1.0,
          sortKey: calculateSortKey(worldY + state.height, subpriority),
          isReflection: false,
        });
      }
    }

    sprites.sort((a, b) => a.sortKey - b.sortKey);
    return sprites;
  }

  private startNpcFlyOut(effectName: string, args: ScriptFieldEffectArgs): Promise<void> {
    const bird = FIELD_EFFECT_REGISTRY.BIRD;
    if (!bird) {
      return Promise.resolve();
    }

    let resolveCompletion = () => {};
    const completion = new Promise<void>((resolve) => {
      resolveCompletion = resolve;
    });

    const instanceId = `script_field_effect_${this.nextInstanceId++}`;
    const instance: ScriptFieldEffectInstance = {
      id: instanceId,
      effectName,
      owner: resolveOwnerFromArgs(args),
      state: {
        type: 'npcFlyOut',
        angle: 0,
        elapsedFrames: 0,
        atlasName: getFieldEffectAtlasName('BIRD'),
        width: bird.width,
        height: bird.height,
        baseScreenX: NPC_FLY_OUT_BASE_SCREEN_X,
        baseScreenY: NPC_FLY_OUT_BASE_SCREEN_Y,
        radiusX: NPC_FLY_OUT_RADIUS_X,
        radiusY: NPC_FLY_OUT_RADIUS_Y,
      },
      completion,
      resolveCompletion,
    };

    this.instances.set(instanceId, instance);
    this.markActive(effectName, instanceId);

    return completion;
  }

  private startSparkle(effectName: string, args: ScriptFieldEffectArgs): Promise<void> {
    const metadata = FIELD_EFFECT_REGISTRY.SMALL_SPARKLE;
    if (!metadata) {
      return Promise.resolve();
    }

    const worldTileX = Number(args.get(0));
    const worldTileY = Number(args.get(1));
    const priority = Number(args.get(2) ?? 0);
    if (!Number.isFinite(worldTileX) || !Number.isFinite(worldTileY)) {
      return Promise.resolve();
    }

    let resolveCompletion = () => {};
    const completion = new Promise<void>((resolve) => {
      resolveCompletion = resolve;
    });

    const instanceId = `script_field_effect_${this.nextInstanceId++}`;
    const instance: ScriptFieldEffectInstance = {
      id: instanceId,
      effectName,
      owner: { kind: 'screen' },
      state: {
        type: 'sparkle',
        worldTileX: Math.trunc(worldTileX),
        worldTileY: Math.trunc(worldTileY),
        frame: 0,
        sequenceIndex: 0,
        sequenceFrameTicks: 0,
        finished: false,
        endTimer: 0,
        visible: true,
        atlasName: getFieldEffectAtlasName('SMALL_SPARKLE'),
        width: metadata.width,
        height: metadata.height,
        priority: Number.isFinite(priority) ? Math.trunc(priority) : 0,
      },
      completion,
      resolveCompletion,
    };

    this.instances.set(instanceId, instance);
    this.markActive(effectName, instanceId);
    return completion;
  }

  private startEmotionIcon(effectName: string, args: ScriptFieldEffectArgs): Promise<void> {
    const registryKey = resolveEmotionRegistryKey(effectName);
    if (!registryKey) {
      return Promise.resolve();
    }

    const metadata = FIELD_EFFECT_REGISTRY[registryKey];
    if (!metadata) {
      return Promise.resolve();
    }

    let resolveCompletion = () => {};
    const completion = new Promise<void>((resolve) => {
      resolveCompletion = resolve;
    });

    const instanceId = `script_field_effect_${this.nextInstanceId++}`;
    const instance: ScriptFieldEffectInstance = {
      id: instanceId,
      effectName,
      owner: resolveOwnerFromArgs(args),
      state: {
        type: 'emotionIcon',
        atlasName: getFieldEffectAtlasName(registryKey),
        width: metadata.width,
        height: metadata.height,
        elapsedFrames: 0,
        totalFrames: EMOTION_ICON_TOTAL_FRAMES,
        yVelocity: -5,
        yOffset: 0,
      },
      completion,
      resolveCompletion,
    };

    this.instances.set(instanceId, instance);
    this.markActive(effectName, instanceId);
    return completion;
  }

  private advanceOneFrame(): void {
    if (this.instances.size === 0) return;

    const ids = [...this.instances.keys()];
    for (const id of ids) {
      const instance = this.instances.get(id);
      if (!instance) continue;

      switch (instance.state.type) {
        case 'npcFlyOut':
          this.advanceNpcFlyOut(instance);
          break;
        case 'emotionIcon':
          this.advanceEmotionIcon(instance);
          break;
        case 'sparkle':
          this.advanceSparkle(instance);
          break;
        default:
          break;
      }
    }
  }

  private advanceNpcFlyOut(instance: ScriptFieldEffectInstance): void {
    const state = instance.state;
    if (state.type !== 'npcFlyOut') return;

    state.angle = (state.angle + NPC_FLY_OUT_ANGLE_STEP) & 0xff;
    state.elapsedFrames++;
    if (state.elapsedFrames >= NPC_FLY_OUT_FRAMES) {
      this.finishInstance(instance);
    }
  }

  private advanceEmotionIcon(instance: ScriptFieldEffectInstance): void {
    const state = instance.state;
    if (state.type !== 'emotionIcon') return;

    if (!this.resolveOwnerWorldPosition(instance, null)) {
      this.finishInstance(instance);
      return;
    }

    state.yOffset += state.yVelocity;
    if (state.yOffset !== 0) {
      state.yVelocity++;
    } else {
      state.yVelocity = 0;
    }

    state.elapsedFrames++;
    if (state.elapsedFrames >= state.totalFrames) {
      this.finishInstance(instance);
    }
  }

  private advanceSparkle(instance: ScriptFieldEffectInstance): void {
    const state = instance.state;
    if (state.type !== 'sparkle') return;

    if (!state.finished) {
      const animation = FIELD_EFFECT_REGISTRY.SMALL_SPARKLE?.animation ?? [];
      const sequence = animation[state.sequenceIndex];
      if (!sequence) {
        state.finished = true;
        state.visible = false;
      } else {
        state.frame = sequence.frame;
        state.sequenceFrameTicks++;
        if (state.sequenceFrameTicks >= sequence.duration) {
          state.sequenceFrameTicks = 0;
          state.sequenceIndex++;
          if (state.sequenceIndex >= animation.length) {
            state.finished = true;
            state.visible = false;
          }
        }
      }
      return;
    }

    state.endTimer++;
    if (state.endTimer > 34) {
      this.finishInstance(instance);
    }
  }

  private resolveOwnerWorldPosition(
    instance: ScriptFieldEffectInstance,
    view: WorldCameraView | null
  ): { x: number; y: number } | null {
    let offsetX = 0;
    let offsetY = 0;
    if (instance.state.type === 'npcFlyOut') {
      offsetX = trigCos(instance.state.angle, instance.state.radiusX);
      offsetY = trigSin(instance.state.angle, instance.state.radiusY);
    }

    switch (instance.owner.kind) {
      case 'screen':
        if (!view || instance.state.type !== 'npcFlyOut') return null;
        return {
          x: view.cameraWorldX + instance.state.baseScreenX + offsetX,
          y: view.cameraWorldY + instance.state.baseScreenY + offsetY,
        };
      case 'player': {
        const playerPos = this.positionResolvers.getPlayerWorldPosition();
        if (!playerPos) return null;
        return {
          x: playerPos.x + offsetX,
          y: playerPos.y + offsetY,
        };
      }
      case 'npc': {
        const npcPos = this.positionResolvers.getNpcWorldPosition(
          instance.owner.mapId,
          instance.owner.localId
        );
        if (!npcPos) return null;
        return {
          x: npcPos.x + offsetX,
          y: npcPos.y + offsetY,
        };
      }
      default:
        return null;
    }
  }

  private resolveOwnerSpriteHeight(instance: ScriptFieldEffectInstance): number {
    let height: number | null = null;

    if (instance.owner.kind === 'player') {
      height = this.positionResolvers.getPlayerSpriteHeight?.() ?? null;
    } else if (instance.owner.kind === 'npc') {
      height = this.positionResolvers.getNpcSpriteHeight?.(
        instance.owner.mapId,
        instance.owner.localId
      ) ?? null;
    }

    if (typeof height !== 'number' || !Number.isFinite(height) || height <= 0) {
      return DEFAULT_OWNER_SPRITE_HEIGHT;
    }
    return Math.max(1, Math.round(height));
  }

  private finishInstance(instance: ScriptFieldEffectInstance): void {
    this.instances.delete(instance.id);
    this.markInactive(instance.effectName, instance.id);
    instance.resolveCompletion();
  }

  private markActive(effectName: string, instanceId: string): void {
    let active = this.activeByEffectName.get(effectName);
    if (!active) {
      active = new Set();
      this.activeByEffectName.set(effectName, active);
    }
    active.add(instanceId);
  }

  private markInactive(effectName: string, instanceId: string): void {
    const active = this.activeByEffectName.get(effectName);
    if (!active) return;

    active.delete(instanceId);
    if (active.size > 0) {
      return;
    }

    this.activeByEffectName.delete(effectName);
    const waiters = this.waitersByEffectName.get(effectName);
    if (!waiters) return;
    this.waitersByEffectName.delete(effectName);
    for (const resolve of waiters) {
      resolve();
    }
  }
}
