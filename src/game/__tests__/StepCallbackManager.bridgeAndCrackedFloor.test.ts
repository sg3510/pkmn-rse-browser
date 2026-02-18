import assert from 'node:assert/strict';
import test from 'node:test';
import { stepCallbackManager, type StepCallbackContext } from '../StepCallbackManager.ts';
import { METATILE_LABELS } from '../../data/metatileLabels.gen.ts';
import {
  MB_CRACKED_FLOOR,
  MB_CRACKED_FLOOR_HOLE,
  MB_FORTREE_BRIDGE,
  MB_PACIFIDLOG_HORIZONTAL_LOG_LEFT,
  MB_PACIFIDLOG_HORIZONTAL_LOG_RIGHT,
} from '../../utils/metatileBehaviors.generated.ts';
import { gameVariables } from '../GameVariables.ts';

const METATILE_FORTREE_BRIDGE_OVER_GRASS_RAISED = METATILE_LABELS['METATILE_Fortree_BridgeOverGrass_Raised'] ?? 0x24E;
const METATILE_FORTREE_BRIDGE_OVER_GRASS_LOWERED = METATILE_LABELS['METATILE_Fortree_BridgeOverGrass_Lowered'] ?? 0x24F;
const METATILE_PACIFIDLOG_HALF_SUBMERGED_HORIZONTAL_LEFT = METATILE_LABELS['METATILE_Pacifidlog_HalfSubmergedLogs_HorizontalLeft'] ?? 0x252;
const METATILE_PACIFIDLOG_HALF_SUBMERGED_HORIZONTAL_RIGHT = METATILE_LABELS['METATILE_Pacifidlog_HalfSubmergedLogs_HorizontalRight'] ?? 0x253;
const METATILE_PACIFIDLOG_SUBMERGED_HORIZONTAL_LEFT = METATILE_LABELS['METATILE_Pacifidlog_SubmergedLogs_HorizontalLeft'] ?? 0x254;
const METATILE_PACIFIDLOG_SUBMERGED_HORIZONTAL_RIGHT = METATILE_LABELS['METATILE_Pacifidlog_SubmergedLogs_HorizontalRight'] ?? 0x255;
const METATILE_PACIFIDLOG_FLOATING_HORIZONTAL_LEFT = METATILE_LABELS['METATILE_Pacifidlog_FloatingLogs_HorizontalLeft'] ?? 0x250;
const METATILE_PACIFIDLOG_FLOATING_HORIZONTAL_RIGHT = METATILE_LABELS['METATILE_Pacifidlog_FloatingLogs_HorizontalRight'] ?? 0x251;
const METATILE_CAVE_CRACKED_FLOOR = METATILE_LABELS['METATILE_Cave_CrackedFloor'] ?? 0x22F;
const METATILE_CAVE_CRACKED_FLOOR_HOLE = METATILE_LABELS['METATILE_Cave_CrackedFloor_Hole'] ?? 0x206;
const METATILE_PACIFIDLOG_SKYPILLAR_CRACKED_FLOOR_HOLE = METATILE_LABELS['METATILE_Pacifidlog_SkyPillar_CrackedFloor_Hole'] ?? 0x237;

interface GridState {
  behaviors: Map<string, number>;
  metatileIds: Map<string, number>;
}

interface SetCall {
  x: number;
  y: number;
  metatileId: number;
  collision?: number;
}

interface PulseCall {
  x: number;
  y: number;
  metatileId: number;
  frames: number;
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}

function createContext(
  playerX: number,
  playerY: number,
  gridState: GridState,
  setCalls: SetCall[],
  invalidate: { count: number },
  options?: {
    playerElevation?: number;
    isPlayerAtFastestSpeed?: boolean;
    playerMoveSpeedPxPerMs?: number;
    playerIsMoving?: boolean;
    drawPulses?: PulseCall[];
  },
): StepCallbackContext {
  return {
    playerLocalX: playerX,
    playerLocalY: playerY,
    playerDestLocalX: playerX,
    playerDestLocalY: playerY,
    currentMapId: 'MAP_TEST',
    getTileBehaviorLocal: (x, y) => gridState.behaviors.get(key(x, y)) ?? 0,
    getTileMetatileIdLocal: (x, y) => gridState.metatileIds.get(key(x, y)),
    setMapMetatile: (x, y, metatileId, collision) => {
      gridState.metatileIds.set(key(x, y), metatileId);
      setCalls.push({ x, y, metatileId, collision });
    },
    drawMetatilePulseLocal: options?.drawPulses
      ? (x, y, metatileId, frames) => {
          options.drawPulses!.push({ x, y, metatileId, frames: frames ?? 1 });
        }
      : undefined,
    invalidateView: () => {
      invalidate.count++;
    },
    playerElevation: options?.playerElevation ?? 0,
    isPlayerAtFastestSpeed: options?.isPlayerAtFastestSpeed ?? false,
    playerMoveSpeedPxPerMs: options?.playerMoveSpeedPxPerMs ?? 0,
    playerIsMoving: options?.playerIsMoving ?? false,
  };
}

test('Pacifidlog callback applies 8-frame sink and raise delays', () => {
  stepCallbackManager.reset();
  stepCallbackManager.setCallback(3);

  const state: GridState = {
    behaviors: new Map<string, number>([
      [key(10, 5), MB_PACIFIDLOG_HORIZONTAL_LOG_LEFT],
      [key(11, 5), MB_PACIFIDLOG_HORIZONTAL_LOG_RIGHT],
    ]),
    metatileIds: new Map<string, number>([
      [key(10, 5), METATILE_PACIFIDLOG_FLOATING_HORIZONTAL_LEFT],
      [key(11, 5), METATILE_PACIFIDLOG_FLOATING_HORIZONTAL_RIGHT],
    ]),
  };
  const setCalls: SetCall[] = [];
  const invalidate = { count: 0 };

  // Initialize callback, then step onto a log.
  stepCallbackManager.update(createContext(0, 0, state, setCalls, invalidate));
  stepCallbackManager.update(createContext(10, 5, state, setCalls, invalidate));
  assert.equal(state.metatileIds.get(key(10, 5)), METATILE_PACIFIDLOG_HALF_SUBMERGED_HORIZONTAL_LEFT);
  assert.equal(state.metatileIds.get(key(11, 5)), METATILE_PACIFIDLOG_HALF_SUBMERGED_HORIZONTAL_RIGHT);

  for (let i = 0; i < 8; i++) {
    stepCallbackManager.update(createContext(10, 5, state, setCalls, invalidate));
  }
  assert.equal(state.metatileIds.get(key(10, 5)), METATILE_PACIFIDLOG_SUBMERGED_HORIZONTAL_LEFT);
  assert.equal(state.metatileIds.get(key(11, 5)), METATILE_PACIFIDLOG_SUBMERGED_HORIZONTAL_RIGHT);

  // Move across the same log section first (left -> right), then step off.
  // Pacifidlog callbacks evaluate one-tile transitions like the GBA.
  stepCallbackManager.update(createContext(11, 5, state, setCalls, invalidate));
  stepCallbackManager.update(createContext(12, 5, state, setCalls, invalidate));
  assert.equal(state.metatileIds.get(key(10, 5)), METATILE_PACIFIDLOG_HALF_SUBMERGED_HORIZONTAL_LEFT);
  assert.equal(state.metatileIds.get(key(11, 5)), METATILE_PACIFIDLOG_HALF_SUBMERGED_HORIZONTAL_RIGHT);

  for (let i = 0; i < 8; i++) {
    stepCallbackManager.update(createContext(12, 5, state, setCalls, invalidate));
  }
  assert.equal(state.metatileIds.get(key(10, 5)), METATILE_PACIFIDLOG_FLOATING_HORIZONTAL_LEFT);
  assert.equal(state.metatileIds.get(key(11, 5)), METATILE_PACIFIDLOG_FLOATING_HORIZONTAL_RIGHT);
  assert.ok(setCalls.length > 0);
  assert.ok(setCalls.every((call) => call.collision === 0));

  stepCallbackManager.reset();
});

test('Fortree callback animates bridge bounce over 16-frame window using draw pulse when available', () => {
  stepCallbackManager.reset();
  stepCallbackManager.setCallback(2);

  const state: GridState = {
    behaviors: new Map<string, number>([
      [key(5, 5), MB_FORTREE_BRIDGE],
    ]),
    metatileIds: new Map<string, number>([
      [key(5, 5), METATILE_FORTREE_BRIDGE_OVER_GRASS_RAISED],
    ]),
  };
  const setCalls: SetCall[] = [];
  const drawPulses: PulseCall[] = [];
  const invalidate = { count: 0 };

  // Callback starts while on bridge: lower immediately.
  stepCallbackManager.update(createContext(5, 5, state, setCalls, invalidate, { playerElevation: 0, drawPulses }));
  assert.equal(state.metatileIds.get(key(5, 5)), METATILE_FORTREE_BRIDGE_OVER_GRASS_LOWERED);

  // Step off bridge: it raises and enters bounce state.
  stepCallbackManager.update(createContext(6, 5, state, setCalls, invalidate, { playerElevation: 0, drawPulses }));
  assert.equal(state.metatileIds.get(key(5, 5)), METATILE_FORTREE_BRIDGE_OVER_GRASS_RAISED);

  const preBounceCallCount = setCalls.length;
  const preBouncePulseCount = drawPulses.length;
  for (let i = 0; i < 24; i++) {
    stepCallbackManager.update(createContext(6, 5, state, setCalls, invalidate, { playerElevation: 0, drawPulses }));
  }

  const bounceCalls = setCalls.slice(preBounceCallCount).filter((c) => c.x === 5 && c.y === 5);
  const bouncePulses = drawPulses
    .slice(preBouncePulseCount)
    .filter((pulse) => pulse.x === 5 && pulse.y === 5);
  const loweredWrites = bounceCalls.filter((c) => c.metatileId === METATILE_FORTREE_BRIDGE_OVER_GRASS_LOWERED).length;

  // C parity: phase-4 bounce lowers for draw-only pulse while persistent map-grid stays raised.
  assert.ok(bouncePulses.some((pulse) => pulse.metatileId === METATILE_FORTREE_BRIDGE_OVER_GRASS_LOWERED));
  assert.equal(loweredWrites, 0);
  assert.equal(state.metatileIds.get(key(5, 5)), METATILE_FORTREE_BRIDGE_OVER_GRASS_RAISED);
  assert.ok(invalidate.count > 0);
  assert.ok(setCalls.length > 0);
  assert.ok(setCalls.every((call) => call.collision === 0));

  stepCallbackManager.reset();
});

test('Fortree callback falls back to lower+raise writes when pulse hook is unavailable', () => {
  stepCallbackManager.reset();
  stepCallbackManager.setCallback(2);

  const state: GridState = {
    behaviors: new Map<string, number>([
      [key(5, 5), MB_FORTREE_BRIDGE],
    ]),
    metatileIds: new Map<string, number>([
      [key(5, 5), METATILE_FORTREE_BRIDGE_OVER_GRASS_RAISED],
    ]),
  };
  const setCalls: SetCall[] = [];
  const invalidate = { count: 0 };

  stepCallbackManager.update(createContext(5, 5, state, setCalls, invalidate, { playerElevation: 0 }));
  stepCallbackManager.update(createContext(6, 5, state, setCalls, invalidate, { playerElevation: 0 }));

  const preBounceCallCount = setCalls.length;
  for (let i = 0; i < 24; i++) {
    stepCallbackManager.update(createContext(6, 5, state, setCalls, invalidate, { playerElevation: 0 }));
  }

  const bounceCalls = setCalls.slice(preBounceCallCount).filter((c) => c.x === 5 && c.y === 5);
  const loweredWrites = bounceCalls.filter((c) => c.metatileId === METATILE_FORTREE_BRIDGE_OVER_GRASS_LOWERED).length;
  const raisedWrites = bounceCalls.filter((c) => c.metatileId === METATILE_FORTREE_BRIDGE_OVER_GRASS_RAISED).length;
  assert.ok(loweredWrites >= 1);
  assert.ok(raisedWrites >= loweredWrites);
  assert.equal(state.metatileIds.get(key(5, 5)), METATILE_FORTREE_BRIDGE_OVER_GRASS_RAISED);
  assert.ok(invalidate.count > 0);
  assert.ok(setCalls.length > 0);
  assert.ok(setCalls.every((call) => call.collision === 0));

  stepCallbackManager.reset();
});

test('Cracked floor callback supports dual 3-frame hole timers and speed gating', () => {
  stepCallbackManager.reset();
  stepCallbackManager.setCallback(7);
  gameVariables.reset();
  gameVariables.setVar('VAR_ICE_STEP_COUNT', 9);

  const state: GridState = {
    behaviors: new Map<string, number>([
      [key(1, 1), MB_CRACKED_FLOOR],
      [key(2, 1), MB_CRACKED_FLOOR],
    ]),
    metatileIds: new Map<string, number>([
      [key(1, 1), METATILE_CAVE_CRACKED_FLOOR],
      [key(2, 1), 0x777],
    ]),
  };
  const setCalls: SetCall[] = [];
  const invalidate = { count: 0 };

  stepCallbackManager.update(createContext(0, 0, state, setCalls, invalidate, { isPlayerAtFastestSpeed: false }));
  stepCallbackManager.update(createContext(1, 1, state, setCalls, invalidate, { isPlayerAtFastestSpeed: false }));
  stepCallbackManager.update(createContext(2, 1, state, setCalls, invalidate, { isPlayerAtFastestSpeed: false }));

  // Two more frames: first tile should hole.
  stepCallbackManager.update(createContext(2, 1, state, setCalls, invalidate, { isPlayerAtFastestSpeed: false }));
  stepCallbackManager.update(createContext(2, 1, state, setCalls, invalidate, { isPlayerAtFastestSpeed: false }));

  // Third frame: second tile should hole.
  stepCallbackManager.update(createContext(2, 1, state, setCalls, invalidate, { isPlayerAtFastestSpeed: false }));

  assert.equal(state.metatileIds.get(key(1, 1)), METATILE_CAVE_CRACKED_FLOOR_HOLE);
  assert.equal(state.metatileIds.get(key(2, 1)), METATILE_PACIFIDLOG_SKYPILLAR_CRACKED_FLOOR_HOLE);
  assert.equal(gameVariables.getVar('VAR_ICE_STEP_COUNT'), 0);
  assert.ok(invalidate.count > 0);
  assert.ok(setCalls.some((call) => call.metatileId === METATILE_CAVE_CRACKED_FLOOR_HOLE && call.collision === 0));
  assert.ok(setCalls.some((call) => call.metatileId === METATILE_PACIFIDLOG_SKYPILLAR_CRACKED_FLOOR_HOLE && call.collision === 0));

  stepCallbackManager.reset();
});

test('Cracked floor preserves VAR_ICE_STEP_COUNT when moving at fastest speed', () => {
  stepCallbackManager.reset();
  stepCallbackManager.setCallback(7);
  gameVariables.reset();
  gameVariables.setVar('VAR_ICE_STEP_COUNT', 7);

  const state: GridState = {
    behaviors: new Map<string, number>([
      [key(1, 1), MB_CRACKED_FLOOR],
    ]),
    metatileIds: new Map<string, number>([
      [key(1, 1), METATILE_CAVE_CRACKED_FLOOR],
    ]),
  };
  const setCalls: SetCall[] = [];
  const invalidate = { count: 0 };

  stepCallbackManager.update(createContext(0, 0, state, setCalls, invalidate, { isPlayerAtFastestSpeed: true }));
  stepCallbackManager.update(createContext(1, 1, state, setCalls, invalidate, { isPlayerAtFastestSpeed: true }));

  assert.equal(gameVariables.getVar('VAR_ICE_STEP_COUNT'), 7);
  stepCallbackManager.reset();
});

test('Cracked floor uses movement-speed fallback for fastest parity when boolean is stale', () => {
  stepCallbackManager.reset();
  stepCallbackManager.setCallback(7);
  gameVariables.reset();
  gameVariables.setVar('VAR_ICE_STEP_COUNT', 7);

  const state: GridState = {
    behaviors: new Map<string, number>([
      [key(1, 1), MB_CRACKED_FLOOR],
    ]),
    metatileIds: new Map<string, number>([
      [key(1, 1), METATILE_CAVE_CRACKED_FLOOR],
    ]),
  };
  const setCalls: SetCall[] = [];
  const invalidate = { count: 0 };

  stepCallbackManager.update(createContext(0, 0, state, setCalls, invalidate, {
    isPlayerAtFastestSpeed: false,
    playerMoveSpeedPxPerMs: 0,
  }));
  stepCallbackManager.update(createContext(1, 1, state, setCalls, invalidate, {
    isPlayerAtFastestSpeed: false,
    playerMoveSpeedPxPerMs: 0.24,
  }));

  assert.equal(gameVariables.getVar('VAR_ICE_STEP_COUNT'), 7);
  stepCallbackManager.reset();
});

test('Cracked floor hole always resets fall flag (C parity)', () => {
  stepCallbackManager.reset();
  stepCallbackManager.setCallback(7);
  gameVariables.reset();
  gameVariables.setVar('VAR_ICE_STEP_COUNT', 7);

  const state: GridState = {
    behaviors: new Map<string, number>([
      [key(1, 1), MB_CRACKED_FLOOR_HOLE],
    ]),
    metatileIds: new Map<string, number>([
      [key(1, 1), METATILE_PACIFIDLOG_SKYPILLAR_CRACKED_FLOOR_HOLE],
    ]),
  };
  const setCalls: SetCall[] = [];
  const invalidate = { count: 0 };

  stepCallbackManager.update(createContext(1, 1, state, setCalls, invalidate, {
    isPlayerAtFastestSpeed: true,
    playerMoveSpeedPxPerMs: 0.24,
    playerIsMoving: true,
  }));
  assert.equal(gameVariables.getVar('VAR_ICE_STEP_COUNT'), 0);
  stepCallbackManager.reset();
});
