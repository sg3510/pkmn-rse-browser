import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { analyzeConsoleLogText, analyzeConsoleLogFile } from '../lib/consoleAnalyzer.mjs';
import { analyzeHeapProfileFile, analyzeHeapProfileJson } from '../lib/heapProfileAnalyzer.mjs';
import { analyzeHeapSnapshotFile, extractHeapSnapshotMetrics } from '../lib/heapSnapshotAnalyzer.mjs';
import { analyzeHeapSnapshotSeries } from '../lib/heapSnapshotSeriesAnalyzer.mjs';
import { runArtifactForensics } from '../lib/forensicsRunner.mjs';

const WORKSPACE = process.cwd();
const PERF_DIR = path.resolve(WORKSPACE, 'docs/backlog/perf');
const CONSOLE_LOG_PATH = path.resolve(PERF_DIR, 'console.txt.log');
const HEAP_PROFILE_PATH = path.resolve(PERF_DIR, 'Heap-20260215T152543.heapprofile');
const HEAP_SNAPSHOT_PATH = path.resolve(PERF_DIR, 'Heap-20260215T151212.heapsnapshot');
const HEAP_SNAPSHOT_PATH_2 = path.resolve(PERF_DIR, 'Heap-20260215T151402.heapsnapshot');

const GOLDEN_SUBSET_PATH = path.resolve(WORKSPACE, 'scripts/perf/__tests__/fixtures/forensics-summary-golden-subset.json');

function stripRunMeta(result) {
  const clone = JSON.parse(JSON.stringify(result));
  if (clone.run_meta) {
    delete clone.run_meta.generated_at;
  }
  return clone;
}

function fileExists(p) {
  try {
    fs.accessSync(p, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

test('console analyzer is deterministic on existing log fixture', () => {
  assert.equal(fileExists(CONSOLE_LOG_PATH), true, 'console fixture missing');
  const text = fs.readFileSync(CONSOLE_LOG_PATH, 'utf8');
  const a = analyzeConsoleLogText(text);
  const b = analyzeConsoleLogText(text);
  assert.deepEqual(a, b);

  const wrapped = stripRunMeta(analyzeConsoleLogFile(CONSOLE_LOG_PATH));
  assert.equal(wrapped.artifact_meta.kind, 'console_log');
  assert.ok(wrapped.growth.tileset_upload_starts >= 1);
});

test('heapprofile analyzer is deterministic on existing profile fixture', () => {
  assert.equal(fileExists(HEAP_PROFILE_PATH), true, 'heapprofile fixture missing');
  const a = stripRunMeta(analyzeHeapProfileFile(HEAP_PROFILE_PATH));
  const b = stripRunMeta(analyzeHeapProfileFile(HEAP_PROFILE_PATH));
  assert.deepEqual(a, b);
  assert.equal(a.artifact_meta.kind, 'heapprofile');
  assert.ok(a.growth.total_self_size > 0);
});

test('heapsnapshot analyzer returns expected structural metrics', () => {
  assert.equal(fileExists(HEAP_SNAPSHOT_PATH), true, 'heapsnapshot fixture missing');
  const result = analyzeHeapSnapshotFile(HEAP_SNAPSHOT_PATH);
  assert.equal(result.artifact_meta.kind, 'heapsnapshot');
  assert.ok(result.growth.node_count > 1_000_000);
  assert.ok(result.growth.edge_count > 1_000_000);
  assert.ok(Array.isArray(result.hotspots.top_constructors_by_self_size));
  assert.ok(result.hotspots.top_constructors_by_self_size.length > 0);
});

test('heapsnapshot series analyzer emits growth deltas and risk ranking', () => {
  assert.equal(fileExists(HEAP_SNAPSHOT_PATH), true, 'heapsnapshot fixture missing');
  assert.equal(fileExists(HEAP_SNAPSHOT_PATH_2), true, 'heapsnapshot fixture 2 missing');
  const result = analyzeHeapSnapshotSeries([HEAP_SNAPSHOT_PATH, HEAP_SNAPSHOT_PATH_2]);
  assert.equal(result.artifact_meta.kind, 'heapsnapshot_series');
  assert.equal(result.growth.snapshot_count, 2);
  assert.ok(Array.isArray(result.risk_ranked_items));
});

test('analyzers reject malformed inputs', () => {
  assert.throws(() => analyzeConsoleLogText(''), /empty/i);
  assert.throws(() => analyzeHeapProfileJson({}), /missing/i);
  assert.throws(() => extractHeapSnapshotMetrics({}), /Invalid heapsnapshot format|must be an object/i);
});

test('forensics summary golden subset is stable for current artifacts', () => {
  assert.equal(fileExists(GOLDEN_SUBSET_PATH), true, 'golden subset fixture missing');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forensics-test-'));
  const reportsDir = path.join(tmpDir, 'reports');
  const result = runArtifactForensics({ perfDir: PERF_DIR, reportsDir });

  const subset = {
    snapshot_count: result.summary.artifact_meta.snapshot_count,
    node_delta: result.summary.growth.heapsnapshot_node_count_delta,
    edge_delta: result.summary.growth.heapsnapshot_edge_count_delta,
    self_size_delta_mb: result.summary.growth.heapsnapshot_self_size_delta_mb,
    uploads_per_warp: result.summary.growth.console_tileset_uploads_per_warp,
    top_5_risk_labels: result.summary.risk_ranked_items.slice(0, 5).map((item) => item.label),
    prod_confidence_level: result.summary.prod_confidence.level,
    memory_gate_target_mb: result.summary.memory_gate_target_mb,
  };

  const golden = JSON.parse(fs.readFileSync(GOLDEN_SUBSET_PATH, 'utf8'));
  assert.deepEqual(subset, golden);
});
