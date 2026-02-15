/**
 * Overworld object-event affine animation manager.
 *
 * C references:
 * - public/pokeemerald/src/event_object_movement.c
 *   - MovementAction_InitAffineAnim_Step0
 *   - MovementAction_ClearAffineAnim_Step0
 *   - MovementAction_WalkDownStartAffine_Step0/1
 *   - MovementAction_WalkDownAffine_Step0/1
 *   - MovementAction_WalkLeftAffine_Step0/1
 *   - MovementAction_WalkRightAffine_Step0/1
 * - public/pokeemerald/src/sprite.c
 *   - BeginAffineAnim / ContinueAffineAnim
 *   - AffineAnimCmd_frame / loop / jump / end
 *   - StartSpriteAffineAnimIfDifferent / ChangeSpriteAffineAnimIfDifferent
 */

import { GBA_FRAME_MS } from '../../config/timing.ts';
import {
  getSpriteAffineAnimationCommands,
  type AffineAnimCommand,
} from '../../data/spriteMetadata.ts';
import type { NPCObject } from '../../types/objectEvents.ts';

const IDENTITY_SCALE_PARAM = 0x0100;

export interface ObjectEventAffineTransform {
  rotationDeg: number;
  scaleX: number;
  scaleY: number;
}

interface ObjectEventAffineState {
  graphicsId: string;
  animNum: number;
  animCmdIndex: number;
  delayCounter: number;
  loopCounter: number;
  xScaleParam: number;
  yScaleParam: number;
  rotationParam: number;
  affineAnimBeginning: boolean;
  affineAnimEnded: boolean;
  affineAnimPaused: boolean;
  affineEnabled: boolean;
}

function wrapSigned16(value: number): number {
  const wrapped = value & 0xffff;
  return wrapped >= 0x8000 ? wrapped - 0x10000 : wrapped;
}

function toSigned16(value: number): number {
  return wrapSigned16(value);
}

function wrapUnsigned16(value: number): number {
  return value & 0xffff;
}

function rotationByte(value: number): number {
  return value & 0xff;
}

function getObjectEventId(mapId: string, localId: string): string {
  return `${mapId}_npc_${localId}`;
}

class ObjectEventAffineManager {
  private states = new Map<string, ObjectEventAffineState>();
  private graphicsByObjectId = new Map<string, string>();
  private frameAccumulatorMs = 0;

  syncNPCs(npcs: NPCObject[]): void {
    const activeIds = new Set<string>();
    for (const npc of npcs) {
      activeIds.add(npc.id);
      this.graphicsByObjectId.set(npc.id, npc.graphicsId);

      const existing = this.states.get(npc.id);
      if (existing && existing.graphicsId !== npc.graphicsId) {
        this.states.delete(npc.id);
      }
    }

    for (const objectEventId of this.graphicsByObjectId.keys()) {
      if (!activeIds.has(objectEventId)) {
        this.graphicsByObjectId.delete(objectEventId);
      }
    }

    for (const objectEventId of this.states.keys()) {
      if (!activeIds.has(objectEventId)) {
        this.states.delete(objectEventId);
      }
    }
  }

  clear(): void {
    this.states.clear();
    this.graphicsByObjectId.clear();
    this.frameAccumulatorMs = 0;
  }

  registerObjectEventGraphics(objectEventId: string, graphicsId: string): void {
    this.graphicsByObjectId.set(objectEventId, graphicsId);

    const state = this.states.get(objectEventId);
    if (state && state.graphicsId !== graphicsId) {
      this.states.delete(objectEventId);
    }
  }

  initAffineAnimByLocalId(mapId: string, localId: string): void {
    this.initAffineAnim(getObjectEventId(mapId, localId));
  }

  clearAffineAnimByLocalId(mapId: string, localId: string): void {
    this.clearAffineAnim(getObjectEventId(mapId, localId));
  }

  startAffineAnimIfDifferentByLocalId(mapId: string, localId: string, animNum: number): void {
    this.startAffineAnimIfDifferent(getObjectEventId(mapId, localId), animNum);
  }

  changeAffineAnimIfDifferentByLocalId(mapId: string, localId: string, animNum: number): void {
    this.changeAffineAnimIfDifferent(getObjectEventId(mapId, localId), animNum);
  }

  setAffineAnimPausedByLocalId(mapId: string, localId: string, paused: boolean): void {
    this.setAffineAnimPaused(getObjectEventId(mapId, localId), paused);
  }

  initAffineAnim(objectEventId: string): void {
    const state = this.getOrCreateState(objectEventId);
    if (!state) return;

    state.affineEnabled = true;
    state.affineAnimPaused = true;
    state.affineAnimBeginning = true;
    state.affineAnimEnded = false;
    this.affineAnimStateReset(state);
  }

  clearAffineAnim(objectEventId: string): void {
    const state = this.getOrCreateState(objectEventId);
    if (!state) return;

    state.affineEnabled = false;
    state.affineAnimPaused = true;
    state.affineAnimBeginning = false;
    state.affineAnimEnded = false;
    this.affineAnimStateReset(state);
  }

  startAffineAnimIfDifferent(objectEventId: string, animNum: number): void {
    const state = this.getOrCreateState(objectEventId);
    if (!state) return;

    if (state.animNum !== animNum) {
      this.affineAnimStateStartAnim(state, animNum);
      state.affineAnimBeginning = true;
      state.affineAnimEnded = false;
    }
  }

  changeAffineAnimIfDifferent(objectEventId: string, animNum: number): void {
    const state = this.getOrCreateState(objectEventId);
    if (!state) return;

    if (state.animNum !== animNum) {
      state.animNum = animNum;
      state.affineAnimBeginning = true;
      state.affineAnimEnded = false;
    }
  }

  setAffineAnimPaused(objectEventId: string, paused: boolean): void {
    const state = this.getOrCreateState(objectEventId);
    if (!state) return;
    state.affineAnimPaused = paused;
  }

  update(deltaMs: number): void {
    if (deltaMs <= 0) return;

    this.frameAccumulatorMs += deltaMs;
    let framesToProcess = Math.floor(this.frameAccumulatorMs / GBA_FRAME_MS);
    if (framesToProcess <= 0) return;

    this.frameAccumulatorMs -= framesToProcess * GBA_FRAME_MS;

    for (const state of this.states.values()) {
      if (!state.affineEnabled) continue;
      for (let frame = 0; frame < framesToProcess; frame++) {
        if (state.affineAnimBeginning) {
          this.beginAffineAnim(state);
        } else {
          this.continueAffineAnim(state);
        }
      }
    }
  }

  getRenderTransform(objectEventId: string): ObjectEventAffineTransform | null {
    const state = this.states.get(objectEventId);
    if (!state || !state.affineEnabled) return null;

    // Keep zero/invalid params safe.
    const safeXScale = state.xScaleParam === 0 ? IDENTITY_SCALE_PARAM : state.xScaleParam;
    const safeYScale = state.yScaleParam === 0 ? IDENTITY_SCALE_PARAM : state.yScaleParam;

    const scaleX = safeXScale / IDENTITY_SCALE_PARAM;
    const scaleY = safeYScale / IDENTITY_SCALE_PARAM;

    const signedRotation = wrapSigned16(state.rotationParam);
    const rotationDeg = signedRotation / IDENTITY_SCALE_PARAM;

    if (scaleX === 1 && scaleY === 1 && rotationDeg === 0) {
      return null;
    }

    return { rotationDeg, scaleX, scaleY };
  }

  private getOrCreateState(objectEventId: string): ObjectEventAffineState | null {
    const graphicsId = this.graphicsByObjectId.get(objectEventId);
    if (!graphicsId) return null;

    const existing = this.states.get(objectEventId);
    if (existing) {
      return existing;
    }

    const state: ObjectEventAffineState = {
      graphicsId,
      animNum: 0,
      animCmdIndex: 0,
      delayCounter: 0,
      loopCounter: 0,
      xScaleParam: IDENTITY_SCALE_PARAM,
      yScaleParam: IDENTITY_SCALE_PARAM,
      rotationParam: 0,
      affineAnimBeginning: true,
      affineAnimEnded: false,
      affineAnimPaused: true,
      affineEnabled: false,
    };

    this.states.set(objectEventId, state);
    return state;
  }

  private getCurrentAnimCommands(state: ObjectEventAffineState): AffineAnimCommand[] {
    return getSpriteAffineAnimationCommands(state.graphicsId, state.animNum);
  }

  private getCurrentFrameCommand(
    state: ObjectEventAffineState
  ): Extract<AffineAnimCommand, { type: 'FRAME' }> | null {
    const commands = this.getCurrentAnimCommands(state);
    const cmd = commands[state.animCmdIndex];
    if (!cmd || cmd.type !== 'FRAME') {
      return null;
    }
    return cmd;
  }

  private beginAffineAnim(state: ObjectEventAffineState): void {
    const firstAnim = getSpriteAffineAnimationCommands(state.graphicsId, 0);
    if (firstAnim.length === 0 || firstAnim[0].type === 'END') {
      return;
    }

    this.affineAnimStateRestartAnim(state);
    const frameCmd = this.getCurrentFrameCommand(state);
    if (!frameCmd) return;

    state.affineAnimBeginning = false;
    state.affineAnimEnded = false;
    state.delayCounter = this.applyAffineAnimFrame(state, frameCmd);
  }

  private continueAffineAnim(state: ObjectEventAffineState): void {
    if (state.delayCounter > 0) {
      this.affineAnimDelay(state);
      return;
    }
    if (state.affineAnimPaused) {
      return;
    }

    const commands = this.getCurrentAnimCommands(state);
    if (commands.length === 0) return;

    state.animCmdIndex++;
    const cmd = commands[state.animCmdIndex];
    if (!cmd) {
      this.affineAnimCmdEnd(state);
      return;
    }

    switch (cmd.type) {
      case 'LOOP':
        this.affineAnimCmdLoop(state, cmd.count);
        break;
      case 'JUMP':
        this.affineAnimCmdJump(state, cmd.target);
        break;
      case 'END':
        this.affineAnimCmdEnd(state);
        break;
      case 'FRAME':
        this.affineAnimCmdFrame(state, cmd);
        break;
      default:
        break;
    }
  }

  private affineAnimDelay(state: ObjectEventAffineState): void {
    if (state.affineAnimPaused) {
      return;
    }

    state.delayCounter = Math.max(0, state.delayCounter - 1);
    const currentFrame = this.getCurrentFrameCommand(state);
    if (currentFrame) {
      this.applyAffineAnimFrameRelative(state, currentFrame.xScale, currentFrame.yScale, currentFrame.rotation);
    }
  }

  private affineAnimCmdLoop(state: ObjectEventAffineState, count: number): void {
    if (state.loopCounter > 0) {
      this.continueAffineAnimLoop(state);
      return;
    }
    this.beginAffineAnimLoop(state, count);
  }

  private beginAffineAnimLoop(state: ObjectEventAffineState, count: number): void {
    state.loopCounter = count;
    this.jumpToTopOfAffineAnimLoop(state);
    this.continueAffineAnim(state);
  }

  private continueAffineAnimLoop(state: ObjectEventAffineState): void {
    state.loopCounter = Math.max(0, state.loopCounter - 1);
    this.jumpToTopOfAffineAnimLoop(state);
    this.continueAffineAnim(state);
  }

  private jumpToTopOfAffineAnimLoop(state: ObjectEventAffineState): void {
    if (state.loopCounter === 0) {
      return;
    }

    const commands = this.getCurrentAnimCommands(state);
    let cursor = state.animCmdIndex - 1;
    while (cursor > 0) {
      if (commands[cursor - 1]?.type === 'LOOP') {
        break;
      }
      cursor--;
    }
    state.animCmdIndex = cursor - 1;
  }

  private affineAnimCmdJump(state: ObjectEventAffineState, target: number): void {
    state.animCmdIndex = target;
    const frameCmd = this.getCurrentFrameCommand(state);
    if (!frameCmd) {
      state.delayCounter = 0;
      return;
    }
    state.delayCounter = this.applyAffineAnimFrame(state, frameCmd);
  }

  private affineAnimCmdEnd(state: ObjectEventAffineState): void {
    state.affineAnimEnded = true;
    state.animCmdIndex--;
    this.applyAffineAnimFrameRelative(state, 0, 0, 0);
  }

  private affineAnimCmdFrame(state: ObjectEventAffineState, frame: Extract<AffineAnimCommand, { type: 'FRAME' }>): void {
    state.delayCounter = this.applyAffineAnimFrame(state, frame);
  }

  private applyAffineAnimFrame(
    state: ObjectEventAffineState,
    frame: Extract<AffineAnimCommand, { type: 'FRAME' }>
  ): number {
    if (frame.duration !== 0) {
      this.applyAffineAnimFrameRelative(state, frame.xScale, frame.yScale, frame.rotation);
      return Math.max(0, frame.duration - 1);
    }

    this.applyAffineAnimFrameAbsolute(state, frame.xScale, frame.yScale, frame.rotation);
    this.applyAffineAnimFrameRelative(state, 0, 0, 0);
    return 0;
  }

  private applyAffineAnimFrameAbsolute(state: ObjectEventAffineState, xScale: number, yScale: number, rotation: number): void {
    state.xScaleParam = toSigned16(xScale);
    state.yScaleParam = toSigned16(yScale);
    state.rotationParam = wrapUnsigned16(rotationByte(rotation) << 8);
  }

  private applyAffineAnimFrameRelative(state: ObjectEventAffineState, xScale: number, yScale: number, rotation: number): void {
    state.xScaleParam = toSigned16(state.xScaleParam + xScale);
    state.yScaleParam = toSigned16(state.yScaleParam + yScale);

    const rotationDelta = wrapUnsigned16(rotationByte(rotation) << 8);
    const nextRotation = wrapUnsigned16(state.rotationParam + rotationDelta);
    state.rotationParam = nextRotation & 0xff00;
  }

  private affineAnimStateStartAnim(state: ObjectEventAffineState, animNum: number): void {
    state.animNum = animNum;
    state.animCmdIndex = 0;
    state.delayCounter = 0;
    state.loopCounter = 0;
    state.xScaleParam = IDENTITY_SCALE_PARAM;
    state.yScaleParam = IDENTITY_SCALE_PARAM;
    state.rotationParam = 0;
  }

  private affineAnimStateRestartAnim(state: ObjectEventAffineState): void {
    state.animCmdIndex = 0;
    state.delayCounter = 0;
    state.loopCounter = 0;
  }

  private affineAnimStateReset(state: ObjectEventAffineState): void {
    state.animNum = 0;
    state.animCmdIndex = 0;
    state.delayCounter = 0;
    state.loopCounter = 0;
    state.xScaleParam = IDENTITY_SCALE_PARAM;
    state.yScaleParam = IDENTITY_SCALE_PARAM;
    state.rotationParam = 0;
  }
}

export const objectEventAffineManager = new ObjectEventAffineManager();
