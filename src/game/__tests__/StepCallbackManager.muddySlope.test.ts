import assert from 'node:assert/strict';
import test from 'node:test';
import { stepCallbackManager, type StepCallbackContext } from '../StepCallbackManager';
import { METATILE_LABELS } from '../../data/metatileLabels.gen';
import { MB_MUDDY_SLOPE } from '../../utils/metatileBehaviors.generated';

const METATILE_MUDDY_SLOPE_FRAME0 = METATILE_LABELS['METATILE_General_MuddySlope_Frame0'] ?? 0x0E8;
const METATILE_MUDDY_SLOPE_FRAME1 = METATILE_LABELS['METATILE_General_MuddySlope_Frame1'] ?? 0x0E9;
const METATILE_MUDDY_SLOPE_FRAME2 = METATILE_LABELS['METATILE_General_MuddySlope_Frame2'] ?? 0x0EA;
const METATILE_MUDDY_SLOPE_FRAME3 = METATILE_LABELS['METATILE_General_MuddySlope_Frame3'] ?? 0x0EB;

function createContext(
  playerLocalX: number,
  playerLocalY: number,
  tileState: { muddyMetatileId: number },
  setCalls: number[],
  invalidate: { count: number }
): StepCallbackContext {
  return {
    playerLocalX,
    playerLocalY,
    playerDestLocalX: playerLocalX,
    playerDestLocalY: playerLocalY,
    currentMapId: 'MAP_ROUTE119',
    getTileBehaviorLocal: (localX, localY) => (
      localX === 1 && localY === 1 ? MB_MUDDY_SLOPE : 0
    ),
    getTileMetatileIdLocal: (localX, localY) => (
      localX === 1 && localY === 1 ? tileState.muddyMetatileId : 0
    ),
    setMapMetatile: (localX, localY, metatileId) => {
      if (localX === 1 && localY === 1) {
        tileState.muddyMetatileId = metatileId;
        setCalls.push(metatileId);
      }
    },
    invalidateView: () => {
      invalidate.count++;
    },
  };
}

test('Task_MuddySlope parity: stepping on muddy slope animates frame sequence and resets to frame0', () => {
  stepCallbackManager.reset();

  const tileState = { muddyMetatileId: METATILE_MUDDY_SLOPE_FRAME0 };
  const setCalls: number[] = [];
  const invalidate = { count: 0 };

  // Initialize task position tracking.
  stepCallbackManager.update(createContext(0, 0, tileState, setCalls, invalidate));

  // Step onto muddy slope.
  stepCallbackManager.update(createContext(1, 1, tileState, setCalls, invalidate));
  assert.equal(setCalls.at(-1), METATILE_MUDDY_SLOPE_FRAME1);

  // Let the muddy slope animation run to completion.
  for (let i = 0; i < 31; i++) {
    stepCallbackManager.update(createContext(1, 1, tileState, setCalls, invalidate));
  }

  assert.equal(tileState.muddyMetatileId, METATILE_MUDDY_SLOPE_FRAME0);
  assert.ok(setCalls.includes(METATILE_MUDDY_SLOPE_FRAME3));
  assert.ok(setCalls.includes(METATILE_MUDDY_SLOPE_FRAME2));
  assert.ok(setCalls.includes(METATILE_MUDDY_SLOPE_FRAME1));
  assert.ok(invalidate.count > 0);

  stepCallbackManager.reset();
});
