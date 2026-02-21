import assert from 'node:assert/strict';
import test from 'node:test';
import { ScriptRunner } from '../ScriptRunner.ts';
import { data as petalburgCityData } from '../../data/scripts/PetalburgCity.gen.ts';
import type { MapScriptData } from '../../data/scripts/types.ts';
import type { StoryScriptContext } from '../../game/NewGameFlow.ts';
import { gameVariables } from '../../game/GameVariables.ts';

type Direction = 'up' | 'down' | 'left' | 'right';
type ScriptMoveMode =
  | 'walk'
  | 'walk_slow'
  | 'walk_fast'
  | 'walk_faster'
  | 'walk_fastest'
  | 'ride_water_current'
  | 'run'
  | 'walk_in_place'
  | 'walk_in_place_slow'
  | 'walk_in_place_fast'
  | 'walk_in_place_faster'
  | 'jump'
  | 'jump_in_place'
  | 'face';

interface Position {
  x: number;
  y: number;
}

function isInPlaceMode(mode: ScriptMoveMode): boolean {
  return mode === 'walk_in_place'
    || mode === 'walk_in_place_slow'
    || mode === 'walk_in_place_fast'
    || mode === 'walk_in_place_faster'
    || mode === 'jump_in_place'
    || mode === 'face';
}

function applyStep(position: Position, direction: Direction, mode: ScriptMoveMode): void {
  if (isInPlaceMode(mode)) {
    return;
  }
  if (direction === 'up') {
    position.y -= 1;
  } else if (direction === 'down') {
    position.y += 1;
  } else if (direction === 'left') {
    position.x -= 1;
  } else {
    position.x += 1;
  }
}

function createCommonData(): MapScriptData {
  return {
    mapScripts: {},
    scripts: {},
    movements: {
      Common_Movement_WalkInPlaceFasterLeft: ['walk_in_place_faster_left'],
    },
    text: {},
  };
}

test('Petalburg Wally tutorial preserves C-script relative endpoint (-1,-1 player to Wally)', async () => {
  gameVariables.reset();

  const playerPosition: Position = { x: 15, y: 8 };
  const wallyPosition: Position = { x: 15, y: 10 };
  const queueWarpCalls: Array<{ mapId: string; x: number; y: number; direction: Direction }> = [];

  const ctx: StoryScriptContext = {
    showMessage: async () => {},
    showChoice: async () => null,
    getPlayerGender: () => 0,
    getPlayerName: () => 'PLAYER',
    hasPartyPokemon: () => true,
    setParty: () => {},
    startFirstBattle: async () => {},
    queueWarp: async (mapId, x, y, direction) => {
      queueWarpCalls.push({ mapId, x, y, direction });
    },
    forcePlayerStep: () => {},
    delayFrames: async () => {},
    movePlayer: async (direction, mode = 'walk') => {
      applyStep(playerPosition, direction, mode);
    },
    moveNpc: async (mapId, localId, direction, mode = 'walk') => {
      if (mapId === 'MAP_PETALBURG_CITY' && localId === 'LOCALID_PETALBURG_WALLY') {
        applyStep(wallyPosition, direction, mode);
      }
    },
    faceNpcToPlayer: () => {},
    setNpcPosition: () => {},
    setNpcVisible: () => {},
    playDoorAnimation: async () => {},
    setPlayerVisible: () => {},
    hasNpc: (mapId, localId) => mapId === 'MAP_PETALBURG_CITY' && localId === 'LOCALID_PETALBURG_WALLY',
    findNpcMapId: (localId) => (localId === 'LOCALID_PETALBURG_WALLY' ? 'MAP_PETALBURG_CITY' : null),
  };

  const runner = new ScriptRunner(
    { mapData: petalburgCityData, commonData: createCommonData() },
    ctx,
    'MAP_PETALBURG_CITY'
  );

  const handled = await runner.execute('PetalburgCity_EventScript_WallyTutorial');
  assert.equal(handled, true);

  assert.deepEqual(playerPosition, { x: 35, y: 14 });
  assert.deepEqual(wallyPosition, { x: 36, y: 15 });
  assert.deepEqual(
    { dx: playerPosition.x - wallyPosition.x, dy: playerPosition.y - wallyPosition.y },
    { dx: -1, dy: -1 }
  );

  assert.deepEqual(queueWarpCalls, [
    { mapId: 'MAP_PETALBURG_CITY_GYM', x: 4, y: 108, direction: 'down' },
  ]);
});
