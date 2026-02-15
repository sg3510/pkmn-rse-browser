/**
 * RotatingGateManager
 *
 * C references:
 * - public/pokeemerald/src/rotating_gate.c
 * - public/pokeemerald/include/rotating_gate.h
 */

import { TICK_60FPS_MS } from '../config/timing.ts';

type PuzzleMapId = 'MAP_FORTREE_CITY_GYM' | 'MAP_ROUTE110_TRICK_HOUSE_PUZZLE6';
type RotationDirection = 1 | 2; // 1 = anticlockwise, 2 = clockwise

export type GateDirection = 'up' | 'down' | 'left' | 'right';
export type RotatingGateShapeKey = 'l1' | 'l2' | 'l3' | 'l4' | 't1' | 't2' | 't3' | 't4';

export const ROTATING_GATE_SHAPE_ASSET_PATHS: Record<RotatingGateShapeKey, string> = {
  l1: '/pokeemerald/graphics/rotating_gates/l1.png',
  l2: '/pokeemerald/graphics/rotating_gates/l2.png',
  l3: '/pokeemerald/graphics/rotating_gates/l3.png',
  l4: '/pokeemerald/graphics/rotating_gates/l4.png',
  t1: '/pokeemerald/graphics/rotating_gates/t1.png',
  t2: '/pokeemerald/graphics/rotating_gates/t2.png',
  t3: '/pokeemerald/graphics/rotating_gates/t3.png',
  t4: '/pokeemerald/graphics/rotating_gates/t4.png',
};

interface RotatingGatePuzzleConfig {
  x: number;
  y: number;
  shape: number;
  orientation: number;
}

interface RotatingGateAnimationState {
  fromOrientation: number;
  rotationDirection: RotationDirection;
  startTimeMs: number;
  durationMs: number;
}

interface RotatingGateRuntimeState extends RotatingGatePuzzleConfig {
  animation?: RotatingGateAnimationState;
}

export interface RotatingGateCollisionParams {
  mapId: string;
  localX: number;
  localY: number;
  direction: GateDirection;
  nowMs: number;
  isFast: boolean;
  getCollisionAtLocal: (localX: number, localY: number) => number;
}

export interface RotatingGateRenderSprite {
  shapeKey: RotatingGateShapeKey;
  worldX: number;
  worldY: number;
  width: number;
  height: number;
  rotationDeg: number;
}

const GATE_SHAPE_L1 = 0;
const GATE_SHAPE_L2 = 1;
const GATE_SHAPE_L3 = 2;
const GATE_SHAPE_L4 = 3;
const GATE_SHAPE_T1 = 4;
const GATE_SHAPE_T2 = 5;
const GATE_SHAPE_T3 = 6;
const GATE_SHAPE_T4 = 7;

const GATE_ORIENTATION_270 = 3;
const GATE_ORIENTATION_MAX = 4;

const GATE_ARM_NORTH = 0;
const GATE_ARM_EAST = 1;
const GATE_ARM_SOUTH = 2;
const GATE_ARM_WEST = 3;

const ROTATE_ANTICLOCKWISE: RotationDirection = 1;
const ROTATE_CLOCKWISE: RotationDirection = 2;

const GATE_ROT_NONE = 255;
const GATE_ARM_MAX_LENGTH = 2;

const ROTATING_DURATION_NORMAL_MS = 16 * TICK_60FPS_MS;
const ROTATING_DURATION_FAST_MS = 8 * TICK_60FPS_MS;

const SHAPE_RENDER_INFO: Record<number, { key: RotatingGateShapeKey; size: 32 | 64 }> = {
  [GATE_SHAPE_L1]: { key: 'l1', size: 32 },
  [GATE_SHAPE_L2]: { key: 'l2', size: 64 },
  [GATE_SHAPE_L3]: { key: 'l3', size: 64 },
  [GATE_SHAPE_L4]: { key: 'l4', size: 64 },
  [GATE_SHAPE_T1]: { key: 't1', size: 32 },
  [GATE_SHAPE_T2]: { key: 't2', size: 64 },
  [GATE_SHAPE_T3]: { key: 't3', size: 64 },
  [GATE_SHAPE_T4]: { key: 't4', size: 64 },
};

function gateRot(rotationDirection: RotationDirection, arm: number, longArm: number): number {
  return ((rotationDirection & 15) << 4) | ((arm & 7) << 1) | (longArm & 1);
}

function gateRotCW(arm: number, longArm: number): number {
  return gateRot(ROTATE_CLOCKWISE, arm, longArm);
}

function gateRotACW(arm: number, longArm: number): number {
  return gateRot(ROTATE_ANTICLOCKWISE, arm, longArm);
}

const FORTREE_PUZZLE_CONFIG: readonly RotatingGatePuzzleConfig[] = [
  { x: 6, y: 7, shape: GATE_SHAPE_T2, orientation: 1 },
  { x: 9, y: 15, shape: GATE_SHAPE_T2, orientation: 2 },
  { x: 3, y: 19, shape: GATE_SHAPE_T2, orientation: 1 },
  { x: 2, y: 6, shape: GATE_SHAPE_T1, orientation: 1 },
  { x: 9, y: 12, shape: GATE_SHAPE_T1, orientation: 0 },
  { x: 6, y: 23, shape: GATE_SHAPE_T1, orientation: 0 },
  { x: 12, y: 22, shape: GATE_SHAPE_T1, orientation: 0 },
  { x: 6, y: 3, shape: GATE_SHAPE_L4, orientation: 2 },
];

const TRICK_HOUSE_PUZZLE_CONFIG: readonly RotatingGatePuzzleConfig[] = [
  { x: 14, y: 5, shape: GATE_SHAPE_T1, orientation: 1 },
  { x: 10, y: 6, shape: GATE_SHAPE_L2, orientation: 2 },
  { x: 6, y: 6, shape: GATE_SHAPE_L4, orientation: 1 },
  { x: 14, y: 8, shape: GATE_SHAPE_T1, orientation: 1 },
  { x: 3, y: 10, shape: GATE_SHAPE_L3, orientation: 3 },
  { x: 9, y: 14, shape: GATE_SHAPE_L1, orientation: 1 },
  { x: 3, y: 15, shape: GATE_SHAPE_T3, orientation: 0 },
  { x: 2, y: 17, shape: GATE_SHAPE_L2, orientation: 2 },
  { x: 12, y: 18, shape: GATE_SHAPE_T3, orientation: 3 },
  { x: 5, y: 18, shape: GATE_SHAPE_L4, orientation: 1 },
  { x: 10, y: 19, shape: GATE_SHAPE_L3, orientation: 2 },
];

const PUZZLE_CONFIGS: Record<PuzzleMapId, readonly RotatingGatePuzzleConfig[]> = {
  MAP_FORTREE_CITY_GYM: FORTREE_PUZZLE_CONFIG,
  MAP_ROUTE110_TRICK_HOUSE_PUZZLE6: TRICK_HOUSE_PUZZLE_CONFIG,
};

const ROTATION_INFO_NORTH = [
  GATE_ROT_NONE, GATE_ROT_NONE, GATE_ROT_NONE, GATE_ROT_NONE,
  gateRotCW(GATE_ARM_WEST, 1), gateRotCW(GATE_ARM_WEST, 0), gateRotACW(GATE_ARM_EAST, 0), gateRotACW(GATE_ARM_EAST, 1),
  GATE_ROT_NONE, GATE_ROT_NONE, GATE_ROT_NONE, GATE_ROT_NONE,
  GATE_ROT_NONE, GATE_ROT_NONE, GATE_ROT_NONE, GATE_ROT_NONE,
] as const;

const ROTATION_INFO_SOUTH = [
  GATE_ROT_NONE, GATE_ROT_NONE, GATE_ROT_NONE, GATE_ROT_NONE,
  GATE_ROT_NONE, GATE_ROT_NONE, GATE_ROT_NONE, GATE_ROT_NONE,
  gateRotACW(GATE_ARM_WEST, 1), gateRotACW(GATE_ARM_WEST, 0), gateRotCW(GATE_ARM_EAST, 0), gateRotCW(GATE_ARM_EAST, 1),
  GATE_ROT_NONE, GATE_ROT_NONE, GATE_ROT_NONE, GATE_ROT_NONE,
] as const;

const ROTATION_INFO_WEST = [
  GATE_ROT_NONE, gateRotACW(GATE_ARM_NORTH, 1), GATE_ROT_NONE, GATE_ROT_NONE,
  GATE_ROT_NONE, gateRotACW(GATE_ARM_NORTH, 0), GATE_ROT_NONE, GATE_ROT_NONE,
  GATE_ROT_NONE, gateRotCW(GATE_ARM_SOUTH, 0), GATE_ROT_NONE, GATE_ROT_NONE,
  GATE_ROT_NONE, gateRotCW(GATE_ARM_SOUTH, 1), GATE_ROT_NONE, GATE_ROT_NONE,
] as const;

const ROTATION_INFO_EAST = [
  GATE_ROT_NONE, GATE_ROT_NONE, gateRotCW(GATE_ARM_NORTH, 1), GATE_ROT_NONE,
  GATE_ROT_NONE, GATE_ROT_NONE, gateRotCW(GATE_ARM_NORTH, 0), GATE_ROT_NONE,
  GATE_ROT_NONE, GATE_ROT_NONE, gateRotACW(GATE_ARM_SOUTH, 0), GATE_ROT_NONE,
  GATE_ROT_NONE, GATE_ROT_NONE, gateRotACW(GATE_ARM_SOUTH, 1), GATE_ROT_NONE,
] as const;

const ARM_POSITIONS_CLOCKWISE = [
  { x: 0, y: -1 }, { x: 1, y: -2 }, { x: 0, y: 0 }, { x: 1, y: 0 },
  { x: -1, y: 0 }, { x: -1, y: 1 }, { x: -1, y: -1 }, { x: -2, y: -1 },
] as const;

const ARM_POSITIONS_ANTICLOCKWISE = [
  { x: -1, y: -1 }, { x: -1, y: -2 }, { x: 0, y: -1 }, { x: 1, y: -1 },
  { x: 0, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: -2, y: 0 },
] as const;

const ARM_LAYOUT = [
  // L1
  [1, 0, 1, 0, 0, 0, 0, 0],
  // L2
  [1, 1, 1, 0, 0, 0, 0, 0],
  // L3
  [1, 0, 1, 1, 0, 0, 0, 0],
  // L4
  [1, 1, 1, 1, 0, 0, 0, 0],
  // T1
  [1, 0, 1, 0, 1, 0, 0, 0],
  // T2
  [1, 1, 1, 0, 1, 0, 0, 0],
  // T3
  [1, 0, 1, 1, 1, 0, 0, 0],
  // T4
  [1, 0, 1, 0, 1, 1, 0, 0],
  // Unused T1
  [1, 1, 1, 1, 1, 0, 0, 0],
  // Unused T2
  [1, 1, 1, 0, 1, 1, 0, 0],
  // Unused T3
  [1, 0, 1, 1, 1, 1, 0, 0],
  // Unused T4
  [1, 1, 1, 1, 1, 1, 0, 0],
] as const;

function getRotationInfo(direction: GateDirection, x: number, y: number): number {
  const idx = y * 4 + x;
  if (idx < 0 || idx >= 16) return GATE_ROT_NONE;
  if (direction === 'up') return ROTATION_INFO_NORTH[idx];
  if (direction === 'down') return ROTATION_INFO_SOUTH[idx];
  if (direction === 'left') return ROTATION_INFO_WEST[idx];
  return ROTATION_INFO_EAST[idx];
}

function toPuzzleMapId(mapId: string): PuzzleMapId | null {
  if (mapId === 'MAP_FORTREE_CITY_GYM') return mapId;
  if (mapId === 'MAP_ROUTE110_TRICK_HOUSE_PUZZLE6') return mapId;
  return null;
}

export class RotatingGateManager {
  private activeMapId: PuzzleMapId | null = null;
  private gates: RotatingGateRuntimeState[] = [];
  private graphicsEnabled = false;

  initPuzzle(mapId: string): void {
    const puzzleMapId = toPuzzleMapId(mapId);
    if (!puzzleMapId) {
      this.reset();
      return;
    }

    this.activeMapId = puzzleMapId;
    this.graphicsEnabled = false;
    this.gates = PUZZLE_CONFIGS[puzzleMapId].map((gate) => ({ ...gate }));
  }

  initPuzzleAndGraphics(mapId: string): void {
    const puzzleMapId = toPuzzleMapId(mapId);
    if (!puzzleMapId) {
      this.reset();
      return;
    }

    if (this.activeMapId !== puzzleMapId || this.gates.length === 0) {
      this.initPuzzle(puzzleMapId);
    }
    this.graphicsEnabled = true;
  }

  reset(): void {
    this.activeMapId = null;
    this.gates = [];
    this.graphicsEnabled = false;
  }

  update(nowMs: number): void {
    for (const gate of this.gates) {
      if (!gate.animation) continue;
      if (nowMs >= gate.animation.startTimeMs + gate.animation.durationMs) {
        gate.animation = undefined;
      }
    }
  }

  checkCollision(params: RotatingGateCollisionParams): boolean {
    const { mapId, localX, localY, direction, nowMs, isFast, getCollisionAtLocal } = params;
    if (this.activeMapId !== mapId) {
      return false;
    }

    for (const gate of this.gates) {
      const gateX = gate.x;
      const gateY = gate.y;

      if (gateX - 2 > localX || localX > gateX + 1 || gateY - 2 > localY || localY > gateY + 1) {
        continue;
      }

      const centerX = localX - gateX + 2;
      const centerY = localY - gateY + 2;
      const rotationInfo = getRotationInfo(direction, centerX, centerY);
      if (rotationInfo === GATE_ROT_NONE) {
        continue;
      }

      const rotationDirection = ((rotationInfo & 0xf0) >> 4) as RotationDirection;
      const armInfo = rotationInfo & 0x0f;

      if (!this.hasArm(gate, armInfo)) {
        continue;
      }

      if (this.canRotate(gate, rotationDirection, getCollisionAtLocal)) {
        this.triggerRotationAnimation(gate, rotationDirection, nowMs, isFast);
        this.rotateInDirection(gate, rotationDirection);
        return false;
      }

      return true;
    }

    return false;
  }

  getSpritesForRendering(mapId: string, mapOffsetX: number, mapOffsetY: number, nowMs: number): RotatingGateRenderSprite[] {
    if (!this.graphicsEnabled || this.activeMapId !== mapId) {
      return [];
    }

    this.update(nowMs);

    const sprites: RotatingGateRenderSprite[] = [];
    for (const gate of this.gates) {
      const renderInfo = SHAPE_RENDER_INFO[gate.shape];
      if (!renderInfo) continue;

      const size = renderInfo.size;
      const worldPivotX = mapOffsetX + gate.x * 16;
      const worldPivotY = mapOffsetY + gate.y * 16;
      const rotationDeg = this.getCurrentRotationDegrees(gate, nowMs);

      sprites.push({
        shapeKey: renderInfo.key,
        worldX: worldPivotX - size / 2,
        worldY: worldPivotY - size / 2,
        width: size,
        height: size,
        rotationDeg,
      });
    }

    return sprites;
  }

  private hasArm(gate: RotatingGateRuntimeState, armInfo: number): boolean {
    const arm = Math.floor(armInfo / 2);
    const isLongArm = armInfo % 2;

    const armOrientation = (arm - gate.orientation + 4) % 4;
    const shapeLayout = ARM_LAYOUT[gate.shape];
    return shapeLayout[armOrientation * 2 + isLongArm] === 1;
  }

  private canRotate(
    gate: RotatingGateRuntimeState,
    rotationDirection: RotationDirection,
    getCollisionAtLocal: (localX: number, localY: number) => number
  ): boolean {
    const armPositions = rotationDirection === ROTATE_ANTICLOCKWISE
      ? ARM_POSITIONS_ANTICLOCKWISE
      : ARM_POSITIONS_CLOCKWISE;
    const shapeLayout = ARM_LAYOUT[gate.shape];

    for (let i = GATE_ARM_NORTH; i <= GATE_ARM_WEST; i++) {
      for (let j = 0; j < GATE_ARM_MAX_LENGTH; j++) {
        const armIndex = 2 * ((gate.orientation + i) % 4) + j;
        if (shapeLayout[2 * i + j] !== 1) continue;

        const x = gate.x + armPositions[armIndex].x;
        const y = gate.y + armPositions[armIndex].y;
        if (getCollisionAtLocal(x, y) !== 0) {
          return false;
        }
      }
    }

    return true;
  }

  private triggerRotationAnimation(
    gate: RotatingGateRuntimeState,
    rotationDirection: RotationDirection,
    nowMs: number,
    isFast: boolean
  ): void {
    gate.animation = {
      fromOrientation: gate.orientation,
      rotationDirection,
      startTimeMs: nowMs,
      durationMs: isFast ? ROTATING_DURATION_FAST_MS : ROTATING_DURATION_NORMAL_MS,
    };
  }

  private rotateInDirection(gate: RotatingGateRuntimeState, rotationDirection: RotationDirection): void {
    if (rotationDirection === ROTATE_ANTICLOCKWISE) {
      if (gate.orientation > 0) gate.orientation -= 1;
      else gate.orientation = GATE_ORIENTATION_270;
      return;
    }

    gate.orientation = (gate.orientation + 1) % GATE_ORIENTATION_MAX;
  }

  private getCurrentRotationDegrees(gate: RotatingGateRuntimeState, nowMs: number): number {
    if (!gate.animation) {
      return gate.orientation * 90;
    }

    const { fromOrientation, rotationDirection, startTimeMs, durationMs } = gate.animation;
    const elapsed = nowMs - startTimeMs;
    const progress = Math.max(0, Math.min(1, elapsed / durationMs));
    const baseDeg = fromOrientation * 90;
    const deltaDeg = progress * 90;

    if (rotationDirection === ROTATE_CLOCKWISE) {
      return baseDeg + deltaDeg;
    }

    return baseDeg - deltaDeg;
  }
}

export const rotatingGateManager = new RotatingGateManager();
