import assert from 'node:assert/strict';
import test from 'node:test';
import { stepCallbackManager, type StepCallbackContext } from '../StepCallbackManager.ts';
import { gameVariables } from '../GameVariables.ts';

// field_tasks.c / metatile behavior constants for Sootopolis Gym ice.
const MB_THIN_ICE = 38;
const MB_CRACKED_ICE = 39;
const METATILE_ICE_CRACKED = 0x20E;
const METATILE_ICE_BROKEN = 0x206;

interface IceGridState {
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
  gridState: IceGridState,
  setCalls: SetCall[],
  invalidate: { count: number },
): StepCallbackContext {
  return {
    playerLocalX: playerX,
    playerLocalY: playerY,
    playerDestLocalX: playerX,
    playerDestLocalY: playerY,
    currentMapId: 'MAP_SOOTOPOLIS_CITY_GYM_1F',
    getTileBehaviorLocal: (x, y) => gridState.behaviors.get(key(x, y)) ?? 0,
    getTileMetatileIdLocal: (x, y) => gridState.metatileIds.get(key(x, y)),
    setMapMetatile: (x, y, metatileId) => {
      gridState.metatileIds.set(key(x, y), metatileId);
      if (metatileId === METATILE_ICE_CRACKED) {
        gridState.behaviors.set(key(x, y), MB_CRACKED_ICE);
      } else if (metatileId === METATILE_ICE_BROKEN) {
        gridState.behaviors.set(key(x, y), 0);
      }
      setCalls.push({ x, y, metatileId });
    },
    invalidateView: () => {
      invalidate.count++;
    },
  };
}

test('Sootopolis ice callback keeps thin/cracked 4-frame delay timing and row bit tracking', () => {
  stepCallbackManager.reset();
  stepCallbackManager.setCallback(4);
  gameVariables.reset();
  gameVariables.setVar('VAR_ICE_STEP_COUNT', 0);

  const state: IceGridState = {
    behaviors: new Map<string, number>([
      [key(3, 6), MB_THIN_ICE],
      [key(4, 6), 0],
    ]),
    metatileIds: new Map<string, number>([
      [key(3, 6), 0x205],
      [key(4, 6), 0x205],
    ]),
  };
  const setCalls: SetCall[] = [];
  const invalidate = { count: 0 };

  // Prime state machine, then step onto thin ice.
  stepCallbackManager.update(createContext(0, 0, state, setCalls, invalidate));
  stepCallbackManager.update(createContext(3, 6, state, setCalls, invalidate));

  let debug = stepCallbackManager.getDebugState();
  assert.equal(debug.iceState, 2);
  assert.equal(debug.iceDelay, 4);
  assert.equal(gameVariables.getVar('VAR_ICE_STEP_COUNT'), 1);

  // Three delay frames: still not cracked.
  for (let i = 0; i < 3; i++) {
    stepCallbackManager.update(createContext(3, 6, state, setCalls, invalidate));
  }
  assert.equal(setCalls.length, 0);

  // Fourth delay frame: thin -> cracked.
  stepCallbackManager.update(createContext(3, 6, state, setCalls, invalidate));
  assert.deepEqual(setCalls, [{ x: 3, y: 6, metatileId: METATILE_ICE_CRACKED }]);
  assert.equal(gameVariables.getVar('VAR_TEMP_1') & 0x1, 0x1);

  // Step off and back on cracked ice to queue break delay.
  stepCallbackManager.update(createContext(4, 6, state, setCalls, invalidate));
  stepCallbackManager.update(createContext(3, 6, state, setCalls, invalidate));
  debug = stepCallbackManager.getDebugState();
  assert.equal(debug.iceState, 3);
  assert.equal(debug.iceDelay, 4);
  assert.equal(gameVariables.getVar('VAR_ICE_STEP_COUNT'), 0);

  for (let i = 0; i < 3; i++) {
    stepCallbackManager.update(createContext(3, 6, state, setCalls, invalidate));
  }
  assert.equal(setCalls.length, 1);

  stepCallbackManager.update(createContext(3, 6, state, setCalls, invalidate));
  assert.equal(setCalls.length, 2);
  assert.deepEqual(setCalls[1], { x: 3, y: 6, metatileId: METATILE_ICE_BROKEN });
  assert.ok(invalidate.count >= 2);

  stepCallbackManager.reset();
});
