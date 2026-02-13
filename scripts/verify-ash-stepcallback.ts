/**
 * Verify Route 113 ash-step callback behavior.
 *
 * Usage:
 *   node_modules/.bin/esbuild scripts/verify-ash-stepcallback.ts --bundle --platform=node --format=esm --outfile=/tmp/verify-ash-stepcallback.mjs
 *   node /tmp/verify-ash-stepcallback.mjs
 */

import { stepCallbackManager } from '../src/game/StepCallbackManager.ts';
import { bagManager } from '../src/game/BagManager.ts';
import { gameVariables } from '../src/game/GameVariables.ts';
import { ITEMS } from '../src/data/items.ts';
import { METATILE_LABELS } from '../src/data/metatileLabels.gen.ts';
import { MB_ASHGRASS } from '../src/utils/metatileBehaviors.generated.ts';

interface SimTile {
  behavior: number;
  metatileId: number;
}

interface FieldEffectCall {
  x: number;
  y: number;
  effectName: string;
  ownerObjectId: string;
}

interface TickInput {
  localX: number;
  localY: number;
  destX: number;
  destY: number;
}

const METATILE_FALLARBOR_ASH_GRASS = METATILE_LABELS['METATILE_Fallarbor_AshGrass'];
const METATILE_FALLARBOR_NORMAL_GRASS = METATILE_LABELS['METATILE_Fallarbor_NormalGrass'];
const METATILE_LAVARIDGE_ASH_GRASS = METATILE_LABELS['METATILE_Lavaridge_AshGrass'];
const METATILE_LAVARIDGE_NORMAL_GRASS = METATILE_LABELS['METATILE_Lavaridge_NormalGrass'];

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message} (expected=${String(expected)}, actual=${String(actual)})`);
  }
}

function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

class AshCallbackHarness {
  private readonly tiles = new Map<string, SimTile>();
  private readonly mapId: string;
  public readonly effects: FieldEffectCall[] = [];
  public invalidateCount = 0;

  constructor(mapId: string) {
    this.mapId = mapId;
  }

  setAshTile(x: number, y: number, metatileId: number): void {
    this.tiles.set(tileKey(x, y), { behavior: MB_ASHGRASS, metatileId });
  }

  getMetatileId(x: number, y: number): number | undefined {
    return this.tiles.get(tileKey(x, y))?.metatileId;
  }

  tick(input: TickInput): void {
    stepCallbackManager.update({
      playerLocalX: input.localX,
      playerLocalY: input.localY,
      playerDestLocalX: input.destX,
      playerDestLocalY: input.destY,
      currentMapId: this.mapId,
      getTileBehaviorLocal: (x, y) => this.tiles.get(tileKey(x, y))?.behavior ?? 0,
      getTileMetatileIdLocal: (x, y) => this.tiles.get(tileKey(x, y))?.metatileId,
      setMapMetatile: (x, y, metatileId) => {
        const current = this.tiles.get(tileKey(x, y));
        if (!current) return;
        current.metatileId = metatileId;
      },
      startFieldEffectLocal: (x, y, effectName, ownerObjectId = 'player') => {
        this.effects.push({ x, y, effectName: String(effectName), ownerObjectId });
      },
      invalidateView: () => {
        this.invalidateCount++;
      },
    });
  }
}

function resetRuntimeState(): void {
  stepCallbackManager.reset();
  bagManager.reset();
  gameVariables.reset();
}

function runAshDelayFrames(harness: AshCallbackHarness, frames: number, localX: number, localY: number): void {
  for (let i = 0; i < frames; i++) {
    harness.tick({ localX, localY, destX: localX, destY: localY });
  }
}

function testAshWithoutSootSack(): void {
  resetRuntimeState();
  stepCallbackManager.setCallback(1);

  const harness = new AshCallbackHarness('MAP_ROUTE113');
  harness.setAshTile(5, 5, METATILE_FALLARBOR_ASH_GRASS);

  // Initial frame on non-ash tile.
  harness.tick({ localX: 0, localY: 0, destX: 0, destY: 0 });

  // Simulate stepping toward ash: local tile still old, destination is ash tile.
  harness.tick({ localX: 0, localY: 0, destX: 5, destY: 5 });

  assertEqual(gameVariables.getVar('VAR_ASH_GATHER_COUNT'), 0, 'Ash should not gather without Soot Sack');
  assertEqual(harness.getMetatileId(5, 5), METATILE_FALLARBOR_ASH_GRASS, 'Ash tile should not swap immediately');
  assertEqual(harness.effects.length, 0, 'Ash effect should not spawn immediately');

  // Field effect delay is 4 frames.
  runAshDelayFrames(harness, 4, 5, 5);

  assertEqual(harness.getMetatileId(5, 5), METATILE_FALLARBOR_NORMAL_GRASS, 'Ash tile should swap after delay');
  assertEqual(harness.effects.length, 1, 'Ash effect should spawn exactly once');
  assertEqual(harness.effects[0].effectName, 'ASH', 'Expected ASH field effect');
  assertEqual(harness.invalidateCount, 1, 'Map invalidation should occur once for ash swap');
}

function testSootSackGatherAndCap(): void {
  resetRuntimeState();
  bagManager.addItem(ITEMS.ITEM_SOOT_SACK, 1);
  gameVariables.setVar('VAR_ASH_GATHER_COUNT', 9998);
  stepCallbackManager.setCallback(1);

  const harness = new AshCallbackHarness('MAP_ROUTE113');
  harness.setAshTile(1, 0, METATILE_FALLARBOR_ASH_GRASS);
  harness.setAshTile(2, 0, METATILE_LAVARIDGE_ASH_GRASS);

  harness.tick({ localX: 0, localY: 0, destX: 0, destY: 0 });

  // Step onto first ash tile -> gather to 9999.
  harness.tick({ localX: 0, localY: 0, destX: 1, destY: 0 });
  assertEqual(gameVariables.getVar('VAR_ASH_GATHER_COUNT'), 9999, 'Ash gather count should increment with Soot Sack');

  // Step onto second ash tile -> remain capped at 9999.
  harness.tick({ localX: 1, localY: 0, destX: 2, destY: 0 });
  assertEqual(gameVariables.getVar('VAR_ASH_GATHER_COUNT'), 9999, 'Ash gather count should cap at 9999');

  // Advance enough frames for both delayed swaps to complete.
  runAshDelayFrames(harness, 5, 2, 0);

  assertEqual(harness.getMetatileId(1, 0), METATILE_FALLARBOR_NORMAL_GRASS, 'Fallarbor ash should become normal grass');
  assertEqual(harness.getMetatileId(2, 0), METATILE_LAVARIDGE_NORMAL_GRASS, 'Lavaridge ash should become normal grass');
  assertEqual(harness.effects.length, 2, 'Two ash effects should spawn for two ash steps');
  assertEqual(harness.effects[0].effectName, 'ASH', 'First effect should be ASH');
  assertEqual(harness.effects[1].effectName, 'ASH', 'Second effect should be ASH');
}

function main(): void {
  testAshWithoutSootSack();
  testSootSackGatherAndCap();
  console.log('PASS: STEP_CB_ASH verified (delay, metatile swap, soot sack gather/cap).');
}

main();
