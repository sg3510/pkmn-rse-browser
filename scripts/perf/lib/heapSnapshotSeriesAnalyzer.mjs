import path from 'node:path';
import fs from 'node:fs';
import {
  normalizeNumber,
  parseCliArgs,
  relPathFromCwd,
  scoreToBucket,
  withRunEnvelope,
  writeJsonFileSync,
} from './common.mjs';
import { analyzeHeapSnapshotFile } from './heapSnapshotAnalyzer.mjs';

function parseTimestampFromFilename(filePath) {
  const base = path.basename(filePath);
  const m = base.match(/Heap-(\d{8})T(\d{6})\.heapsnapshot$/);
  if (!m) return null;

  const [_, day, time] = m;
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(4, 6));
  const date = Number(day.slice(6, 8));
  const hours = Number(time.slice(0, 2));
  const minutes = Number(time.slice(2, 4));
  const seconds = Number(time.slice(4, 6));
  return new Date(year, month - 1, date, hours, minutes, seconds);
}

function classifyConstructorSignals(name) {
  const text = String(name || '');
  const devNoise = /(localhost:5173|\.vite\/deps|\?t=\d+|installHook\.js|react_jsx-dev-runtime|jsxDEV|PerformanceMeasure)/i.test(text)
    || /^data:application\/json;base64,/i.test(text);
  const highRetain = /(FiberNode|ArrayBuffer|JSArrayBufferData|Detached|EventListener|Map|Set|Context|closure|object|array)/i.test(text);

  let prodLikelihood = 0.5;
  if (devNoise) {
    prodLikelihood = 0.2;
  } else if (/^system\s*\//i.test(text)) {
    prodLikelihood = 0.45;
  } else if (highRetain) {
    prodLikelihood = 0.7;
  }

  const retainingPlausibility = highRetain ? 0.8 : 0.35;
  return { devNoise, prodLikelihood, retainingPlausibility };
}

function discoverSnapshotsFromPerfDir(perfDir) {
  return fs
    .readdirSync(perfDir)
    .filter((name) => name.endsWith('.heapsnapshot'))
    .map((name) => path.resolve(perfDir, name))
    .sort((a, b) => a.localeCompare(b));
}

function toPct(delta, base) {
  if (!Number.isFinite(base) || base === 0) return 0;
  return Number(((delta / base) * 100).toFixed(3));
}

export function analyzeHeapSnapshotSeriesFiles(inputPaths) {
  if (!Array.isArray(inputPaths) || inputPaths.length < 2) {
    throw new Error('Series analysis requires at least 2 heapsnapshot files');
  }

  const snapshotResults = inputPaths.map((filePath) => {
    const result = analyzeHeapSnapshotFile(filePath, {
      includeAllConstructors: true,
      constructorMinBytes: 16 * 1024,
    });

    return {
      file_path: relPathFromCwd(filePath),
      timestamp: parseTimestampFromFilename(filePath)?.toISOString() ?? null,
      node_count: result.growth.node_count,
      edge_count: result.growth.edge_count,
      total_self_size: result.growth.total_self_size,
      extra_native_bytes: result.growth.extra_native_bytes,
      constructor_totals: result.analysis_meta?.constructor_totals ?? {},
      dev_string_hits: result.analysis_meta?.dev_string_hits ?? {},
    };
  });

  const first = snapshotResults[0];
  const last = snapshotResults[snapshotResults.length - 1];
  const stepCount = snapshotResults.length - 1;

  const allConstructorNames = new Set();
  for (const snapshot of snapshotResults) {
    for (const name of Object.keys(snapshot.constructor_totals)) {
      allConstructorNames.add(name);
    }
  }

  const constructorGrowth = [];
  for (const name of allConstructorNames) {
    const sizes = snapshotResults.map((snap) => Number(snap.constructor_totals[name]?.self_size ?? 0));
    const retainedSizes = snapshotResults.map((snap) => Number(snap.constructor_totals[name]?.retained_size_estimate ?? 0));
    const firstSize = sizes[0];
    const lastSize = sizes[sizes.length - 1];
    const delta = lastSize - firstSize;
    if (delta <= 0) continue;

    let positiveSteps = 0;
    for (let i = 1; i < sizes.length; i += 1) {
      if (sizes[i] - sizes[i - 1] > 0) {
        positiveSteps += 1;
      }
    }

    const repeatability = normalizeNumber(positiveSteps / Math.max(1, stepCount));
    const pctDelta = toPct(delta, Math.max(1, firstSize));
    const retainedDelta = retainedSizes[retainedSizes.length - 1] - retainedSizes[0];

    constructorGrowth.push({
      constructor_name: name,
      first_self_size: firstSize,
      last_self_size: lastSize,
      delta_self_size: delta,
      delta_self_size_percent: pctDelta,
      first_retained_size_estimate: retainedSizes[0],
      last_retained_size_estimate: retainedSizes[retainedSizes.length - 1],
      delta_retained_size_estimate: retainedDelta,
      repeatability,
      sizes,
    });
  }

  constructorGrowth.sort((a, b) => b.delta_self_size - a.delta_self_size);
  const maxConstructorDelta = constructorGrowth[0]?.delta_self_size ?? 1;

  const riskRankedItems = constructorGrowth.slice(0, 40).map((entry) => {
    const signals = classifyConstructorSignals(entry.constructor_name);
    const growthMagnitude = normalizeNumber(entry.delta_self_size / Math.max(1, maxConstructorDelta));
    const score = (0.4 * growthMagnitude)
      + (0.2 * entry.repeatability)
      + (0.2 * signals.retainingPlausibility)
      + (0.2 * signals.prodLikelihood);

    return {
      key: `constructor-growth:${entry.constructor_name}`,
      label: entry.constructor_name,
      category: signals.devNoise ? 'dev-only-inflation' : 'constructor-growth',
      score: Number(score.toFixed(3)),
      risk_bucket: scoreToBucket(score),
      factors: {
        growth_magnitude: Number(growthMagnitude.toFixed(3)),
        repeatability: Number(entry.repeatability.toFixed(3)),
        retaining_path_plausibility: Number(signals.retainingPlausibility.toFixed(3)),
        prod_likelihood: Number(signals.prodLikelihood.toFixed(3)),
      },
      evidence: {
        first_self_size: entry.first_self_size,
        last_self_size: entry.last_self_size,
        delta_self_size: entry.delta_self_size,
        delta_self_size_percent: entry.delta_self_size_percent,
        delta_retained_size_estimate: entry.delta_retained_size_estimate,
      },
    };
  }).sort((a, b) => b.score - a.score);

  const devHitTotal = snapshotResults.reduce((acc, snap) => {
    return acc + Object.values(snap.dev_string_hits).reduce((inner, n) => inner + Number(n || 0), 0);
  }, 0);

  const firstTs = first.timestamp ? new Date(first.timestamp) : null;
  const lastTs = last.timestamp ? new Date(last.timestamp) : null;
  const durationMinutes = firstTs && lastTs
    ? Math.max(0.001, (lastTs.getTime() - firstTs.getTime()) / 60000)
    : null;

  const selfDelta = last.total_self_size - first.total_self_size;
  const nodeDelta = last.node_count - first.node_count;
  const edgeDelta = last.edge_count - first.edge_count;

  const selfSlopeMbPerMin = durationMinutes
    ? Number(((selfDelta / (1024 * 1024)) / durationMinutes).toFixed(4))
    : null;

  const growthMagnitude = normalizeNumber(selfDelta / Math.max(1, last.total_self_size));
  const devSignalStrength = normalizeNumber(devHitTotal / Math.max(1, snapshotResults.length * 1000));
  const highRiskCount = riskRankedItems.filter((item) => item.risk_bucket === 'high-risk').length;
  const prodConfidenceScore = normalizeNumber(0.62 - (growthMagnitude * 0.25) - (devSignalStrength * 0.25) - (highRiskCount * 0.03));
  const prodConfidenceLevel = prodConfidenceScore >= 0.67 ? 'high' : prodConfidenceScore >= 0.45 ? 'medium' : 'low';

  return {
    growth: {
      snapshot_count: snapshotResults.length,
      duration_minutes: durationMinutes ? Number(durationMinutes.toFixed(3)) : null,
      node_count_first: first.node_count,
      node_count_last: last.node_count,
      node_count_delta: nodeDelta,
      node_count_delta_percent: toPct(nodeDelta, Math.max(1, first.node_count)),
      edge_count_first: first.edge_count,
      edge_count_last: last.edge_count,
      edge_count_delta: edgeDelta,
      edge_count_delta_percent: toPct(edgeDelta, Math.max(1, first.edge_count)),
      total_self_size_first: first.total_self_size,
      total_self_size_last: last.total_self_size,
      total_self_size_delta: selfDelta,
      total_self_size_delta_percent: toPct(selfDelta, Math.max(1, first.total_self_size)),
      total_self_size_slope_mb_per_min: selfSlopeMbPerMin,
      extra_native_bytes_first: first.extra_native_bytes,
      extra_native_bytes_last: last.extra_native_bytes,
      extra_native_bytes_delta: last.extra_native_bytes - first.extra_native_bytes,
    },
    hotspots: {
      snapshots: snapshotResults.map((snap) => ({
        file_path: snap.file_path,
        timestamp: snap.timestamp,
        node_count: snap.node_count,
        edge_count: snap.edge_count,
        total_self_size: snap.total_self_size,
        extra_native_bytes: snap.extra_native_bytes,
      })),
      top_rising_constructors_by_self_size: constructorGrowth.slice(0, 30),
      top_risk_ranked_items: riskRankedItems.slice(0, 20),
      retained_size_note: 'retained_size_estimate is heuristic; validate exact retained size with DevTools retainers view.',
    },
    risk_ranked_items: riskRankedItems,
    prod_confidence: {
      level: prodConfidenceLevel,
      score: Number(prodConfidenceScore.toFixed(3)),
      rationale: prodConfidenceLevel === 'low'
        ? 'Series growth + development markers indicate low production confidence without production-build captures.'
        : 'Series provides trend signal but still requires production-build and deployed captures for sign-off.',
    },
    next_profiles_required: [
      'Capture set A: local production build (build + preview) snapshots at minute 2, 11, 20 plus allocation sampling.',
      'Capture set B: deployed prod/staging snapshots at minute 2, 11, 20 plus allocation sampling.',
      'Apply 500 MB gate: require plateau under 500 MB and slope <= 2 MB/min after minute 10.',
    ],
    analysis_meta: {
      analyzed_files: inputPaths.map((p) => relPathFromCwd(p)),
      constructor_candidates: constructorGrowth.length,
      dev_hit_total: devHitTotal,
    },
  };
}

export function analyzeHeapSnapshotSeries(inputPaths) {
  const analysis = analyzeHeapSnapshotSeriesFiles(inputPaths);
  return withRunEnvelope({
    analyzer: 'compare-heapsnapshot-series',
    artifactMeta: {
      kind: 'heapsnapshot_series',
      files: inputPaths.map((p) => relPathFromCwd(p)),
      file_count: inputPaths.length,
    },
    growth: analysis.growth,
    hotspots: analysis.hotspots,
    riskRankedItems: analysis.risk_ranked_items,
    prodConfidence: analysis.prod_confidence,
    nextProfilesRequired: analysis.next_profiles_required,
    extra: {
      analysis_meta: analysis.analysis_meta,
    },
  });
}

export function runCli(argv = process.argv.slice(2)) {
  const args = parseCliArgs(argv);
  let inputPaths = [];

  if (args.inputs) {
    inputPaths = String(args.inputs)
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => path.resolve(process.cwd(), p));
  } else if (args['perf-dir']) {
    const perfDir = path.resolve(process.cwd(), String(args['perf-dir']));
    inputPaths = discoverSnapshotsFromPerfDir(perfDir);
  } else {
    const defaultPerfDir = path.resolve(process.cwd(), 'docs/backlog/perf');
    inputPaths = discoverSnapshotsFromPerfDir(defaultPerfDir);
  }

  if (inputPaths.length < 2) {
    throw new Error('Need at least 2 heapsnapshot files. Use --inputs file1,file2,... or --perf-dir docs/backlog/perf');
  }

  const result = analyzeHeapSnapshotSeries(inputPaths);

  if (args.output) {
    const outPath = path.resolve(process.cwd(), String(args.output));
    writeJsonFileSync(outPath, result);
    if (!args.quiet) {
      process.stdout.write(`Wrote ${relPathFromCwd(outPath)}\n`);
    }
    return;
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
