import assert from 'node:assert/strict';
import test from 'node:test';
import { berryManager } from '../BerryManager.ts';
import { BERRY_STAGE } from '../berryConstants.ts';

const TREE_ID = 12;
const ORAN_BERRY_TYPE = 7;
const ORAN_STAGE_DURATION_MINUTES = 180;

test('berry growth advances stages, tracks watering, and regrows after harvest stage', () => {
  berryManager.reset(0);
  berryManager.setBerryTree(TREE_ID, ORAN_BERRY_TYPE, BERRY_STAGE.PLANTED, true);
  berryManager.setActiveInteraction({ mapId: 'MAP_ROUTE102', localId: 10, treeId: TREE_ID });

  assert.equal(berryManager.objectInteractionWaterBerryTree(), true);
  berryManager.applyElapsedMinutes(ORAN_STAGE_DURATION_MINUTES);
  assert.equal(berryManager.getTreeSnapshot(TREE_ID).stage, BERRY_STAGE.SPROUTED);

  assert.equal(berryManager.objectInteractionWaterBerryTree(), true);
  berryManager.applyElapsedMinutes(ORAN_STAGE_DURATION_MINUTES);
  assert.equal(berryManager.getTreeSnapshot(TREE_ID).stage, BERRY_STAGE.TALLER);

  assert.equal(berryManager.objectInteractionWaterBerryTree(), true);
  berryManager.applyElapsedMinutes(ORAN_STAGE_DURATION_MINUTES);
  assert.equal(berryManager.getTreeSnapshot(TREE_ID).stage, BERRY_STAGE.FLOWERING);

  assert.equal(berryManager.objectInteractionWaterBerryTree(), true);
  berryManager.applyElapsedMinutes(ORAN_STAGE_DURATION_MINUTES);

  const grown = berryManager.getTreeSnapshot(TREE_ID);
  assert.equal(grown.stage, BERRY_STAGE.BERRIES);
  assert.ok(grown.berryYield >= 2 && grown.berryYield <= 3);
  assert.equal(grown.watered1, true);
  assert.equal(grown.watered2, true);
  assert.equal(grown.watered3, true);
  assert.equal(grown.watered4, true);

  berryManager.applyElapsedMinutes(ORAN_STAGE_DURATION_MINUTES * 4);
  const regrown = berryManager.getTreeSnapshot(TREE_ID);
  assert.equal(regrown.stage, BERRY_STAGE.SPROUTED);
  assert.equal(regrown.regrowthCount, 1);
  assert.equal(regrown.berryYield, 0);
  assert.equal(regrown.watered1, false);
  assert.equal(regrown.watered2, false);
  assert.equal(regrown.watered3, false);
  assert.equal(regrown.watered4, false);
});

test('berry trees reset when elapsed time exceeds Emerald max window', () => {
  berryManager.reset(0);
  berryManager.setBerryTree(TREE_ID, ORAN_BERRY_TYPE, BERRY_STAGE.PLANTED, true);

  berryManager.applyElapsedMinutes(ORAN_STAGE_DURATION_MINUTES * 71);
  const tree = berryManager.getTreeSnapshot(TREE_ID);
  assert.equal(tree.stage, BERRY_STAGE.NO_BERRY);
  assert.equal(tree.berry, 0);
});

test('legacy monotonic berry timestamps are rebased without wiping planted trees', () => {
  berryManager.reset(Date.now());
  berryManager.setBerryTree(TREE_ID, ORAN_BERRY_TYPE, BERRY_STAGE.PLANTED, true);

  const state = berryManager.getStateForSave();
  state.lastUpdateTimestamp = 81234;
  state.lastUpdateTimestampDomain = 'legacy-monotonic';
  berryManager.loadState(state);

  const elapsedMinutes = berryManager.applyElapsedSinceLastUpdate(Date.now());
  const tree = berryManager.getTreeSnapshot(TREE_ID);

  assert.equal(elapsedMinutes, 0);
  assert.equal(tree.stage, BERRY_STAGE.PLANTED);
  assert.equal(tree.berry, ORAN_BERRY_TYPE);
});

test('sparkling state is returned exactly once after removing a tree', () => {
  berryManager.reset(0);
  berryManager.setBerryTree(TREE_ID, ORAN_BERRY_TYPE, BERRY_STAGE.BERRIES, true);
  berryManager.setActiveInteraction({ mapId: 'MAP_ROUTE102', localId: 8, treeId: TREE_ID });

  berryManager.objectInteractionRemoveBerryTree();

  const first = berryManager.objectInteractionGetBerryTreeData();
  const second = berryManager.objectInteractionGetBerryTreeData();

  assert.equal(first.stage, BERRY_STAGE.SPARKLING);
  assert.equal(second.stage, BERRY_STAGE.NO_BERRY);
});

test('missing interaction context is handled safely', () => {
  berryManager.reset(0);
  berryManager.clearActiveInteraction();

  assert.equal(berryManager.objectInteractionWaterBerryTree(), false);
  const interactionData = berryManager.objectInteractionGetBerryTreeData();
  assert.equal(interactionData.stage, BERRY_STAGE.NO_BERRY);
  assert.equal(interactionData.berryCount, 0);
});
