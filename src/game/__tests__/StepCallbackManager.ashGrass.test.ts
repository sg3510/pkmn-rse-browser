import assert from 'node:assert/strict';
import test from 'node:test';
import { stepCallbackManager, type StepCallbackContext } from '../StepCallbackManager.ts';
import { METATILE_LABELS } from '../../data/metatileLabels.gen.ts';
import { MB_ASHGRASS } from '../../utils/metatileBehaviors.generated.ts';

const METATILE_FALLARBOR_ASH_GRASS = METATILE_LABELS['METATILE_Fallarbor_AshGrass'] ?? 0x20A;
const METATILE_FALLARBOR_NORMAL_GRASS = METATILE_LABELS['METATILE_Fallarbor_NormalGrass'] ?? 0x212;

function createContext(
  playerLocalX: number,
  playerLocalY: number,
  tileState: { ashMetatileId: number },
  setCalls: number[],
  fieldEffects: Array<{ localX: number; localY: number; effectName: string }>,
  invalidate: { count: number },
): StepCallbackContext {
  return {
    playerLocalX,
    playerLocalY,
    playerDestLocalX: playerLocalX,
    playerDestLocalY: playerLocalY,
    currentMapId: 'MAP_ROUTE113',
    getTileBehaviorLocal: (localX, localY) => (
      localX === 2 && localY === 2 ? MB_ASHGRASS : 0
    ),
    getTileMetatileIdLocal: (localX, localY) => (
      localX === 2 && localY === 2 ? tileState.ashMetatileId : 0
    ),
    setMapMetatile: (localX, localY, metatileId) => {
      if (localX === 2 && localY === 2) {
        tileState.ashMetatileId = metatileId;
        setCalls.push(metatileId);
      }
    },
    startFieldEffectLocal: (localX, localY, effectName) => {
      fieldEffects.push({ localX, localY, effectName });
    },
    invalidateView: () => {
      invalidate.count++;
    },
  };
}

test('Ash step callback keeps delayed field-effect timing parity', () => {
  stepCallbackManager.reset();
  stepCallbackManager.setCallback(1);

  const tileState = { ashMetatileId: METATILE_FALLARBOR_ASH_GRASS };
  const setCalls: number[] = [];
  const fieldEffects: Array<{ localX: number; localY: number; effectName: string }> = [];
  const invalidate = { count: 0 };

  // Prime previous-step tracking.
  stepCallbackManager.update(createContext(0, 0, tileState, setCalls, fieldEffects, invalidate));

  // Step onto ash grass: should queue delayed effect only.
  stepCallbackManager.update(createContext(2, 2, tileState, setCalls, fieldEffects, invalidate));
  assert.equal(setCalls.length, 0);
  assert.equal(fieldEffects.length, 0);

  // Delay parity: three more frames still pending.
  for (let i = 0; i < 3; i++) {
    stepCallbackManager.update(createContext(2, 2, tileState, setCalls, fieldEffects, invalidate));
  }
  assert.equal(setCalls.length, 0);
  assert.equal(fieldEffects.length, 0);

  // Fourth frame applies ash puff + tile replacement.
  stepCallbackManager.update(createContext(2, 2, tileState, setCalls, fieldEffects, invalidate));
  assert.deepEqual(setCalls, [METATILE_FALLARBOR_NORMAL_GRASS]);
  assert.deepEqual(fieldEffects, [{ localX: 2, localY: 2, effectName: 'ASH' }]);
  assert.equal(tileState.ashMetatileId, METATILE_FALLARBOR_NORMAL_GRASS);
  assert.equal(invalidate.count, 1);

  stepCallbackManager.reset();
});
