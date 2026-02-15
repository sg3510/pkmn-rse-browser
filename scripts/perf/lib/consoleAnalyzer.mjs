import fs from 'node:fs';
import path from 'node:path';
import {
  fileStatMeta,
  normalizeNumber,
  parseCliArgs,
  relPathFromCwd,
  safeDivide,
  scoreToBucket,
  sortedEntriesByValueDesc,
  toPercent,
  topEntries,
  withRunEnvelope,
  writeJsonFileSync,
} from './common.mjs';

const DEFAULT_CONSOLE_LOG = path.resolve(process.cwd(), 'docs/backlog/perf/console.txt.log');

function makeRiskItem({
  key,
  label,
  evidence,
  score,
  prodLikelihood,
  retainingPlausibility,
  repeatability,
  growthMagnitude,
  category,
}) {
  return {
    key,
    label,
    category,
    score: Number(score.toFixed(3)),
    risk_bucket: scoreToBucket(score),
    factors: {
      growth_magnitude: Number(growthMagnitude.toFixed(3)),
      repeatability: Number(repeatability.toFixed(3)),
      retaining_path_plausibility: Number(retainingPlausibility.toFixed(3)),
      prod_likelihood: Number(prodLikelihood.toFixed(3)),
    },
    evidence,
  };
}

export function analyzeConsoleLogText(text) {
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('Console log input is empty');
  }

  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  const tagCounts = {};
  const tilesetPairCounts = {};
  const destinationMapCounts = {};
  const sourceMapCounts = {};

  let warpStarts = 0;
  let warpCompletes = 0;
  let uploadStarts = 0;
  let uploadCompletes = 0;
  let uploadStartsInsideWarp = 0;
  let uploadStartsOutsideWarp = 0;
  let lockInputCalls = 0;
  let unlockInputCalls = 0;
  let stackishLines = 0;
  let devMarkerLines = 0;
  let inWarpWindow = false;

  const devMarkers = {
    localhost5173: 0,
    viteDeps: 0,
    hmrTimestamp: 0,
    installHook: 0,
    reactDevRuntime: 0,
  };

  const devRegexes = {
    localhost5173: /localhost:5173/,
    viteDeps: /\.vite\/deps/,
    hmrTimestamp: /\?t=\d+/,
    installHook: /installHook\.js/,
    reactDevRuntime: /react_jsx-dev-runtime|jsx-dev-runtime|jsxDEV/i,
  };

  for (const line of lines) {
    const tagMatch = line.match(/\[([A-Z_]+)\]/);
    if (tagMatch) {
      const tag = tagMatch[1];
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    }

    if (/\s@\s|^requestAnimationFrame$|^renderLoop\s@\s|^overrideMethod\s@\s/.test(line)) {
      stackishLines += 1;
    }

    for (const [markerName, regex] of Object.entries(devRegexes)) {
      if (regex.test(line)) {
        devMarkers[markerName] += 1;
      }
    }

    if (Object.values(devRegexes).some((regex) => regex.test(line))) {
      devMarkerLines += 1;
    }

    if (line.includes('[WARP] ========== WARP START ==========')) {
      warpStarts += 1;
      inWarpWindow = true;
    }

    if (line.includes('[WARP] Warp complete')) {
      warpCompletes += 1;
      inWarpWindow = false;
    }

    if (line.includes('[TILESET_UPLOAD] ========== UPLOADING TILESETS ==========')) {
      uploadStarts += 1;
      if (inWarpWindow) {
        uploadStartsInsideWarp += 1;
      } else {
        uploadStartsOutsideWarp += 1;
      }
    }

    if (line.includes('[TILESET_UPLOAD] ========== UPLOAD COMPLETE ==========')) {
      uploadCompletes += 1;
    }

    if (line.includes('[INPUT] lockInput() called')) {
      lockInputCalls += 1;
    }

    if (line.includes('[INPUT] unlockInput() called')) {
      unlockInputCalls += 1;
    }

    const pairMatch = line.match(/\[TILESET_UPLOAD\] Pair ([^:]+):/);
    if (pairMatch) {
      const pairId = pairMatch[1];
      tilesetPairCounts[pairId] = (tilesetPairCounts[pairId] ?? 0) + 1;
    }

    const destinationMatch = line.match(/\[WARP\] Destination map: ([A-Z0-9_]+)/);
    if (destinationMatch) {
      const mapId = destinationMatch[1];
      destinationMapCounts[mapId] = (destinationMapCounts[mapId] ?? 0) + 1;
    }

    const sourceMatch = line.match(/\[WARP\] Source map: ([A-Z0-9_]+)/);
    if (sourceMatch) {
      const mapId = sourceMatch[1];
      sourceMapCounts[mapId] = (sourceMapCounts[mapId] ?? 0) + 1;
    }
  }

  const totalLines = lines.length;
  const warpBalanceDelta = warpStarts - warpCompletes;
  const uploadBalanceDelta = uploadStarts - uploadCompletes;
  const uploadPerWarp = safeDivide(uploadStarts, Math.max(1, warpStarts));
  const stackNoiseRatio = safeDivide(stackishLines, Math.max(1, totalLines));
  const devMarkerRatio = safeDivide(devMarkerLines, Math.max(1, totalLines));

  const highUploadChurnMagnitude = normalizeNumber((uploadPerWarp - 1) / 3);
  const lockUnlockImbalanceMagnitude = normalizeNumber(Math.abs(lockInputCalls - unlockInputCalls) / Math.max(1, lockInputCalls + unlockInputCalls));
  const warpImbalanceMagnitude = normalizeNumber(Math.abs(warpBalanceDelta));
  const devNoiseMagnitude = normalizeNumber((stackNoiseRatio + devMarkerRatio) / 2);

  const riskRankedItems = [];

  const warpImbalanceScore = (0.4 * warpImbalanceMagnitude) + (0.2 * 1) + (0.2 * 0.8) + (0.2 * 0.7);
  riskRankedItems.push(makeRiskItem({
    key: 'warp-lifecycle-balance',
    label: 'Warp start/complete lifecycle balance',
    category: 'warp-lifecycle',
    evidence: {
      warp_starts: warpStarts,
      warp_completes: warpCompletes,
      delta: warpBalanceDelta,
    },
    score: warpImbalanceScore,
    growthMagnitude: warpImbalanceMagnitude,
    repeatability: 1,
    retainingPlausibility: 0.8,
    prodLikelihood: 0.7,
  }));

  const uploadChurnScore = (0.4 * highUploadChurnMagnitude) + (0.2 * 0.8) + (0.2 * 0.7) + (0.2 * 0.45);
  riskRankedItems.push(makeRiskItem({
    key: 'tileset-upload-churn',
    label: 'Tileset upload churn outside explicit warp windows',
    category: 'gpu-upload-churn',
    evidence: {
      upload_starts: uploadStarts,
      upload_starts_inside_warp: uploadStartsInsideWarp,
      upload_starts_outside_warp: uploadStartsOutsideWarp,
      upload_per_warp: Number(uploadPerWarp.toFixed(3)),
      unique_tileset_pairs: Object.keys(tilesetPairCounts).length,
    },
    score: uploadChurnScore,
    growthMagnitude: highUploadChurnMagnitude,
    repeatability: 0.8,
    retainingPlausibility: 0.7,
    prodLikelihood: 0.45,
  }));

  const lockUnlockScore = (0.4 * lockUnlockImbalanceMagnitude) + (0.2 * 0.8) + (0.2 * 0.35) + (0.2 * 0.4);
  riskRankedItems.push(makeRiskItem({
    key: 'input-lock-unlock-balance',
    label: 'Input lock/unlock lifecycle balance',
    category: 'input-lifecycle',
    evidence: {
      lock_input_calls: lockInputCalls,
      unlock_input_calls: unlockInputCalls,
      delta: lockInputCalls - unlockInputCalls,
    },
    score: lockUnlockScore,
    growthMagnitude: lockUnlockImbalanceMagnitude,
    repeatability: 0.8,
    retainingPlausibility: 0.35,
    prodLikelihood: 0.4,
  }));

  const devNoiseScore = (0.4 * devNoiseMagnitude) + (0.2 * 1) + (0.2 * 0.25) + (0.2 * 0.2);
  riskRankedItems.push(makeRiskItem({
    key: 'dev-trace-noise',
    label: 'Dev trace noise dominates console artifact',
    category: 'dev-only-inflation',
    evidence: {
      stackish_line_ratio: Number(stackNoiseRatio.toFixed(4)),
      dev_marker_line_ratio: Number(devMarkerRatio.toFixed(4)),
      dev_markers: devMarkers,
    },
    score: devNoiseScore,
    growthMagnitude: devNoiseMagnitude,
    repeatability: 1,
    retainingPlausibility: 0.25,
    prodLikelihood: 0.2,
  }));

  riskRankedItems.sort((a, b) => b.score - a.score);

  const prodConfidenceScore = normalizeNumber(0.6 - (devNoiseMagnitude * 0.35) - (highUploadChurnMagnitude * 0.2) - (warpImbalanceMagnitude * 0.2));
  const prodConfidenceLevel = prodConfidenceScore >= 0.67 ? 'high' : prodConfidenceScore >= 0.45 ? 'medium' : 'low';

  const hotspots = {
    top_tags: topEntries(tagCounts, 20).map(([name, count]) => ({ name, count })),
    top_tileset_pairs: topEntries(tilesetPairCounts, 20).map(([pair_id, count]) => ({ pair_id, count })),
    warp_destination_counts: sortedEntriesByValueDesc(destinationMapCounts).map(([map_id, count]) => ({ map_id, count })),
    warp_source_counts: sortedEntriesByValueDesc(sourceMapCounts).map(([map_id, count]) => ({ map_id, count })),
  };

  const growth = {
    warp_starts: warpStarts,
    warp_completes: warpCompletes,
    warp_balance_delta: warpBalanceDelta,
    tileset_upload_starts: uploadStarts,
    tileset_upload_completes: uploadCompletes,
    tileset_upload_balance_delta: uploadBalanceDelta,
    tileset_upload_starts_inside_warp: uploadStartsInsideWarp,
    tileset_upload_starts_outside_warp: uploadStartsOutsideWarp,
    tileset_uploads_per_warp: Number(uploadPerWarp.toFixed(3)),
    lock_input_calls: lockInputCalls,
    unlock_input_calls: unlockInputCalls,
    input_balance_delta: lockInputCalls - unlockInputCalls,
    stack_trace_noise_ratio: Number(stackNoiseRatio.toFixed(4)),
    stack_trace_noise_percent: toPercent(stackNoiseRatio),
    dev_marker_ratio: Number(devMarkerRatio.toFixed(4)),
    dev_marker_percent: toPercent(devMarkerRatio),
  };

  return {
    growth,
    hotspots,
    risk_ranked_items: riskRankedItems,
    prod_confidence: {
      level: prodConfidenceLevel,
      score: Number(prodConfidenceScore.toFixed(3)),
      rationale: prodConfidenceLevel === 'low'
        ? 'Console artifact appears dominated by development instrumentation and is insufficient for production confidence.'
        : 'Console artifact has partial signal but still requires production-like captures for confidence.',
    },
    next_profiles_required: [
      'Capture production-build (vite preview) memory snapshots at minutes 2, 11, and 20 for the same route.',
      'Capture deployed prod/staging memory snapshots with the same timeline and compare against 500 MB gate.',
      'Repeat run with DevTools console closed to reduce console-retainer inflation in diagnostics.',
    ],
    analysis_meta: {
      total_lines: totalLines,
      tag_count: Object.keys(tagCounts).length,
    },
  };
}

export function analyzeConsoleLogFile(filePath = DEFAULT_CONSOLE_LOG) {
  const text = fs.readFileSync(filePath, 'utf8');
  const analysis = analyzeConsoleLogText(text);
  return withRunEnvelope({
    analyzer: 'analyze-console-log',
    artifactMeta: {
      kind: 'console_log',
      ...fileStatMeta(filePath),
      line_count: analysis.analysis_meta.total_lines,
    },
    growth: analysis.growth,
    hotspots: analysis.hotspots,
    riskRankedItems: analysis.risk_ranked_items,
    prodConfidence: analysis.prod_confidence,
    nextProfilesRequired: analysis.next_profiles_required,
    extra: {
      dev_markers: analysis.growth.dev_marker_ratio,
    },
  });
}

export function runCli(argv = process.argv.slice(2)) {
  const args = parseCliArgs(argv);
  const inputPath = path.resolve(process.cwd(), args.input ? String(args.input) : DEFAULT_CONSOLE_LOG);
  const result = analyzeConsoleLogFile(inputPath);

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
