import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluatePreInputOnFrameGate } from '../preInputOnFrameGate.ts';

test('blocks player movement while map-entry gate is active and ON_FRAME prerequisites are not ready', () => {
  const result = evaluatePreInputOnFrameGate({
    mapEntryGateActive: true,
    preInputOnFrameEvaluated: false,
    preInputOnFrameTriggered: false,
    mapObjectsReady: false,
    mapScriptCacheReady: false,
  });

  assert.equal(result.shouldClearGate, false);
  assert.equal(result.shouldBlockPlayerUpdate, true);
});

test('keeps gate locked until pre-input ON_FRAME evaluation has run', () => {
  const result = evaluatePreInputOnFrameGate({
    mapEntryGateActive: true,
    preInputOnFrameEvaluated: false,
    preInputOnFrameTriggered: false,
    mapObjectsReady: true,
    mapScriptCacheReady: true,
  });

  assert.equal(result.shouldClearGate, false);
  assert.equal(result.shouldBlockPlayerUpdate, true);
});

test('clears map-entry gate immediately when pre-input checks trigger a script', () => {
  const result = evaluatePreInputOnFrameGate({
    mapEntryGateActive: true,
    preInputOnFrameEvaluated: true,
    preInputOnFrameTriggered: true,
    mapObjectsReady: false,
    mapScriptCacheReady: false,
  });

  assert.equal(result.shouldClearGate, true);
  assert.equal(result.shouldBlockPlayerUpdate, false);
});

test('clears map-entry gate after a completed pre-input evaluation when no script fired', () => {
  const result = evaluatePreInputOnFrameGate({
    mapEntryGateActive: true,
    preInputOnFrameEvaluated: true,
    preInputOnFrameTriggered: false,
    mapObjectsReady: true,
    mapScriptCacheReady: true,
  });

  assert.equal(result.shouldClearGate, true);
  assert.equal(result.shouldBlockPlayerUpdate, false);
});
