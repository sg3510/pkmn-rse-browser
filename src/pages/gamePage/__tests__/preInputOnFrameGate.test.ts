import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluatePreInputOnFrameGate } from '../preInputOnFrameGate.ts';

test('blocks player movement while map-entry gate is active and ON_FRAME prerequisites are not ready', () => {
  const result = evaluatePreInputOnFrameGate({
    mapEntryGateActive: true,
    storyScriptRunning: false,
    mapObjectsReady: false,
    mapScriptCacheReady: false,
  });

  assert.equal(result.shouldClearGate, false);
  assert.equal(result.shouldBlockPlayerUpdate, true);
});

test('clears map-entry gate immediately when a story script has already started', () => {
  const result = evaluatePreInputOnFrameGate({
    mapEntryGateActive: true,
    storyScriptRunning: true,
    mapObjectsReady: false,
    mapScriptCacheReady: false,
  });

  assert.equal(result.shouldClearGate, true);
  assert.equal(result.shouldBlockPlayerUpdate, false);
});

test('clears map-entry gate once map objects and script cache are both ready', () => {
  const result = evaluatePreInputOnFrameGate({
    mapEntryGateActive: true,
    storyScriptRunning: false,
    mapObjectsReady: true,
    mapScriptCacheReady: true,
  });

  assert.equal(result.shouldClearGate, true);
  assert.equal(result.shouldBlockPlayerUpdate, false);
});
