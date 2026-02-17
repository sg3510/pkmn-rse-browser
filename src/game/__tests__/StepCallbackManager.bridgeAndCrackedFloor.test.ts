import assert from 'node:assert/strict';
import test from 'node:test';
import { stepCallbackManager, type StepCallbackContext } from '../StepCallbackManager.ts';
import { METATILE_LABELS } from '../../data/metatileLabels.gen.ts';
import {
  MB_CRACKED_FLOOR,
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
    setMapMetatile: (x, y, metatileId) => {
      gridState.metatileIds.set(key(x, y), metatileId);
      setCalls.push({ x, y, metatileId });
    },
    invalidateView: () => {
      invalidate.count++;
    },
    playerElevation: options?.playerElevation ?? 0,
    isPlayerAtFastestSpeed: options?.isPlayerAtFastestSpeed ?? false,
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

  stepCallbackManager.reset();
});

test('Fortree callback animates bridge bounce over 16-frame window', () => {
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

  // Callback starts while on bridge: lower immediately.
  stepCallbackManager.update(createContext(5, 5, state, setCalls, invalidate, { playerElevation: 0 }));
  assert.equal(state.metatileIds.get(key(5, 5)), METATILE_FORTREE_BRIDGE_OVER_GRASS_LOWERED);

  // Step off bridge: it raises and enters bounce state.
  stepCallbackManager.update(createContext(6, 5, state, setCalls, invalidate, { playerElevation: 0 }));
  assert.equal(state.metatileIds.get(key(5, 5)), METATILE_FORTREE_BRIDGE_OVER_GRASS_RAISED);

  let sawLoweredDuringBounce = false;
  let sawRaisedAfterBounce = false;
  for (let i = 0; i < 24; i++) {
    stepCallbackManager.update(createContext(6, 5, state, setCalls, invalidate, { playerElevation: 0 }));
    const metatileId = state.metatileIds.get(key(5, 5));
    if (metatileId === METATILE_FORTREE_BRIDGE_OVER_GRASS_LOWERED) {
      sawLoweredDuringBounce = true;
    }
    if (sawLoweredDuringBounce && metatileId === METATILE_FORTREE_BRIDGE_OVER_GRASS_RAISED) {
      sawRaisedAfterBounce = true;
    }
  }

  assert.equal(sawLoweredDuringBounce, true);
  assert.equal(sawRaisedAfterBounce, true);
  assert.ok(invalidate.count > 0);

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
