import assert from 'node:assert/strict';
import test from 'node:test';
import { runStepCallbacks } from '../overworldGameUpdate.ts';
import { stepCallbackManager } from '../../../game/StepCallbackManager.ts';
import { gameVariables } from '../../../game/GameVariables.ts';
import { MB_THIN_ICE } from '../../../utils/metatileBehaviors.generated.ts';
import type { PlayerController } from '../../../game/PlayerController.ts';
import type { WorldManager } from '../../../game/WorldManager.ts';

interface TileState {
  behavior: number;
  metatileId: number;
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}

test('runStepCallbacks still advances callback state while story script is running', () => {
  stepCallbackManager.reset();
  gameVariables.reset();
  stepCallbackManager.setCallback(4); // STEP_CB_SOOTOPOLIS_ICE

  const tiles = new Map<string, TileState>();
  tiles.set(key(5, 6), { behavior: MB_THIN_ICE, metatileId: 0x205 });

  const player = {
    getObjectEventCoords: () => ({
      current: { x: 5, y: 6 },
      previous: { x: 5, y: 6 },
    }),
    getTileResolver: () => (worldX: number, worldY: number) => {
      const tile = tiles.get(key(worldX, worldY));
      if (!tile) return null;
      return {
        attributes: { behavior: tile.behavior, layerType: 0 },
        mapTile: { metatileId: tile.metatileId, collision: 0, elevation: 0 },
      };
    },
    getGrassEffectManager: () => ({ create: () => {} }),
    getElevation: () => 0,
    isAtFastestPlayerSpeed: () => false,
  } as unknown as PlayerController;

  const worldManager = {
    findMapAtPosition: () => ({
      entry: { id: 'MAP_SOOTOPOLIS_CITY_GYM_1F' },
      offsetX: 0,
      offsetY: 0,
    }),
  } as unknown as WorldManager;

  const metatileWrites: Array<{ metatileId: number; collision?: number }> = [];
  const pipelineInvalidations = { count: 0 };

  for (let i = 0; i < 6; i++) {
    runStepCallbacks({
      player,
      worldManager,
      storyScriptRunningRef: { current: true },
      setMapMetatileLocal: (_mapId, localX, localY, metatileId, collision) => {
        const tile = tiles.get(key(localX, localY));
        if (tile) {
          tile.metatileId = metatileId;
        }
        metatileWrites.push({ metatileId, collision });
      },
      pipelineRef: {
        current: {
          invalidate: () => {
            pipelineInvalidations.count++;
          },
        } as any,
      },
      gbaFrame: i,
    });
  }

  assert.ok(metatileWrites.length > 0);
  assert.ok(metatileWrites.every((call) => call.collision === 0));
  assert.ok(pipelineInvalidations.count > 0);

  stepCallbackManager.reset();
});
