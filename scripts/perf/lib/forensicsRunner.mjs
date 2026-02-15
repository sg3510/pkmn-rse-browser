import fs from 'node:fs';
import path from 'node:path';
import {
  ensureDirSync,
  findDefaultPerfDir,
  findDefaultReportsDir,
  normalizeNumber,
  parseCliArgs,
  relPathFromCwd,
  withRunEnvelope,
  writeJsonFileSync,
  writeTextFileSync,
} from './common.mjs';
import { analyzeConsoleLogFile } from './consoleAnalyzer.mjs';
import { analyzeHeapProfileFile } from './heapProfileAnalyzer.mjs';
import { analyzeHeapSnapshotFile } from './heapSnapshotAnalyzer.mjs';
import { analyzeHeapSnapshotSeries } from './heapSnapshotSeriesAnalyzer.mjs';

function discoverArtifacts(perfDir) {
  const entries = fs.readdirSync(perfDir);

  const consoleLogCandidates = entries
    .filter((name) => name.endsWith('.log'))
    .map((name) => path.resolve(perfDir, name))
    .sort((a, b) => a.localeCompare(b));

  const heapProfileCandidates = entries
    .filter((name) => name.endsWith('.heapprofile'))
    .map((name) => path.resolve(perfDir, name))
    .sort((a, b) => a.localeCompare(b));

  const heapSnapshotCandidates = entries
    .filter((name) => name.endsWith('.heapsnapshot'))
    .map((name) => path.resolve(perfDir, name))
    .sort((a, b) => a.localeCompare(b));

  return {
    console_log: consoleLogCandidates[0] ?? null,
    heap_profile: heapProfileCandidates[heapProfileCandidates.length - 1] ?? null,
    heap_snapshots: heapSnapshotCandidates,
  };
}

function withSource(items, source) {
  return items.map((item) => ({ ...item, source }));
}

function aggregateRiskItems(resultsByAnalyzer) {
  const all = [];
  for (const [name, result] of Object.entries(resultsByAnalyzer)) {
    const items = Array.isArray(result?.risk_ranked_items) ? result.risk_ranked_items : [];
    all.push(...withSource(items, name));
  }

  all.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return String(a.label).localeCompare(String(b.label));
  });
  return all;
}

function computeProdConfidence({ consoleResult, profileResult, latestSnapshotResult, seriesResult, rankedItems }) {
  const lowSignals = [consoleResult, profileResult, latestSnapshotResult, seriesResult]
    .filter(Boolean)
    .map((result) => {
      const level = result.prod_confidence?.level;
      if (level === 'low') return 1;
      if (level === 'medium') return 0.5;
      return 0;
    })
    .reduce((acc, n) => acc + n, 0);

  const highRiskCount = rankedItems.filter((item) => item.risk_bucket === 'high-risk').length;
  const devOnlyTopCount = rankedItems.slice(0, 15).filter((item) => item.category === 'dev-only-inflation' || item.risk_bucket === 'likely-dev-noise').length;

  const score = normalizeNumber(0.64 - (lowSignals * 0.12) - (highRiskCount * 0.03) - (devOnlyTopCount * 0.01));
  const level = score >= 0.67 ? 'high' : score >= 0.45 ? 'medium' : 'low';

  return {
    level,
    score: Number(score.toFixed(3)),
    rationale: level === 'low'
      ? 'Current artifacts are development-session captures with mixed signal; production confidence is low until production-build captures are compared to the 500 MB gate.'
      : 'Artifact analysis provides direction, but production-build captures are still required for final sign-off.',
  };
}

function classifyPriorities(rankedItems) {
  const devOnly = [];
  const likelyReal = [];
  const unknown = [];

  for (const item of rankedItems) {
    const prodLikelihood = Number(item.factors?.prod_likelihood ?? 0);

    if (item.risk_bucket === 'likely-dev-noise' || item.category === 'dev-only-inflation') {
      devOnly.push(item);
      continue;
    }

    if (item.risk_bucket === 'high-risk' && prodLikelihood >= 0.55) {
      likelyReal.push(item);
      continue;
    }

    unknown.push(item);
  }

  return {
    dev_only_inflation: devOnly,
    likely_real_leak_or_bloat: likelyReal,
    unknown_needs_targeted_profiling: unknown,
  };
}

function toMarkdownSummary({ artifacts, summary }) {
  const lines = [];
  lines.push('# Artifact Forensics Summary');
  lines.push('');
  lines.push('## Scope');
  lines.push(`- Perf directory: \`${summary.artifact_meta.perf_dir}\``);
  lines.push(`- 500 MB gate target: **enabled**`);
  lines.push(`- Console log: \`${artifacts.console_log ? relPathFromCwd(artifacts.console_log) : 'missing'}\``);
  lines.push(`- Heap profile: \`${artifacts.heap_profile ? relPathFromCwd(artifacts.heap_profile) : 'missing'}\``);
  lines.push(`- Heap snapshots: ${artifacts.heap_snapshots.length}`);
  lines.push('');

  lines.push('## Growth Signals');
  const growth = summary.growth;
  lines.push(`- Snapshot node delta: ${growth.heapsnapshot_node_count_delta} (${growth.heapsnapshot_node_count_delta_percent}%)`);
  lines.push(`- Snapshot edge delta: ${growth.heapsnapshot_edge_count_delta} (${growth.heapsnapshot_edge_count_delta_percent}%)`);
  lines.push(`- Snapshot total self-size delta: ${growth.heapsnapshot_self_size_delta_mb} MB`);
  lines.push(`- Uploads per warp (console): ${growth.console_tileset_uploads_per_warp}`);
  lines.push(`- Console dev-marker ratio: ${growth.console_dev_marker_ratio}`);
  lines.push('');

  lines.push('## Top Risk Items');
  for (const item of summary.risk_ranked_items.slice(0, 12)) {
    lines.push(`- [${item.risk_bucket}] ${item.label} (score=${item.score}, source=${item.source})`);
  }
  lines.push('');

  lines.push('## Production Confidence');
  lines.push(`- Level: **${summary.prod_confidence.level}**`);
  lines.push(`- Score: ${summary.prod_confidence.score}`);
  lines.push(`- Rationale: ${summary.prod_confidence.rationale}`);
  lines.push('');

  lines.push('## Next Profiles Required');
  for (const entry of summary.next_profiles_required) {
    lines.push(`- ${entry}`);
  }
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function deriveActionsForItem(item) {
  const label = String(item.label || 'Unknown hotspot');
  const source = String(item.source || 'unknown');

  if (/tileset upload|tileset-upload-churn/i.test(label)) {
    return 'Investigate repeated tileset uploads per transition and validate expected vs redundant upload paths (analysis-only in Phase 1).';
  }
  if (/debug panel|DebugPanel/i.test(label)) {
    return 'Profile with debug panel closed/open to isolate debug UI memory inflation and separate production-critical impact.';
  }
  if (/PerformanceMeasure|installHook|\.vite\/deps|jsxDEV|localhost:5173/i.test(label)) {
    return 'Treat as dev-only inflation candidate; re-check persistence in production-build captures.';
  }
  if (/FiberNode|JSArrayBufferData|ArrayBuffer|ExternalStringData|object|array/i.test(label)) {
    return 'Capture retained-size/retainer paths in production build to confirm owner chain and leak plausibility.';
  }

  return `Follow up from ${source}: validate persistence in production-build and deployed captures before runtime changes.`;
}

function toMarkdownPriorities({ classified, rankedItems }) {
  const lines = [];
  lines.push('# Prioritized Memory Actions (Phase 1)');
  lines.push('');
  lines.push('## Method');
  lines.push('- Score factors: growth magnitude, repeatability, retaining-path plausibility, and prod-likelihood.');
  lines.push('- Classification: `Dev-only inflation`, `Likely real leak/bloat`, `Unknown - needs targeted profiling`.');
  lines.push('');

  lines.push('## Ranked Actions');
  rankedItems.slice(0, 20).forEach((item, index) => {
    const action = deriveActionsForItem(item);
    lines.push(`${index + 1}. ${item.label} [${item.risk_bucket}] (score=${item.score}, source=${item.source})`);
    lines.push(`   Action: ${action}`);
  });
  lines.push('');

  const sections = [
    ['Dev-only inflation', classified.dev_only_inflation],
    ['Likely real leak/bloat', classified.likely_real_leak_or_bloat],
    ['Unknown - needs targeted profiling', classified.unknown_needs_targeted_profiling],
  ];

  for (const [title, items] of sections) {
    lines.push(`## ${title}`);
    if (items.length === 0) {
      lines.push('- None currently ranked in this bucket.');
      lines.push('');
      continue;
    }

    for (const item of items.slice(0, 15)) {
      lines.push(`- ${item.label} (score=${item.score}, source=${item.source})`);
    }
    lines.push('');
  }

  lines.push('## Production Follow-up (Required)');
  lines.push('- Capture set A: local production build (`build + preview`) snapshots at minute 2, 11, and 20 + allocation sampling.');
  lines.push('- Capture set B: deployed prod/staging snapshots at minute 2, 11, and 20 + allocation sampling.');
  lines.push('- Gate: pass only if memory plateaus under **500 MB** and post-minute-10 slope is <= 2 MB/min.');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

export function runArtifactForensics({ perfDir = findDefaultPerfDir(), reportsDir = findDefaultReportsDir() } = {}) {
  const resolvedPerfDir = path.resolve(process.cwd(), perfDir);
  const resolvedReportsDir = path.resolve(process.cwd(), reportsDir);

  const artifacts = discoverArtifacts(resolvedPerfDir);
  if (!artifacts.console_log) {
    throw new Error(`No .log file found in ${resolvedPerfDir}`);
  }
  if (!artifacts.heap_profile) {
    throw new Error(`No .heapprofile file found in ${resolvedPerfDir}`);
  }
  if (artifacts.heap_snapshots.length < 2) {
    throw new Error(`Need at least two .heapsnapshot files in ${resolvedPerfDir}`);
  }

  const consoleResult = analyzeConsoleLogFile(artifacts.console_log);
  const heapProfileResult = analyzeHeapProfileFile(artifacts.heap_profile);
  const latestSnapshotResult = analyzeHeapSnapshotFile(artifacts.heap_snapshots[artifacts.heap_snapshots.length - 1]);
  const seriesResult = analyzeHeapSnapshotSeries(artifacts.heap_snapshots);

  const rankedItems = aggregateRiskItems({
    console: consoleResult,
    heapprofile: heapProfileResult,
    latest_heapsnapshot: latestSnapshotResult,
    heapsnapshot_series: seriesResult,
  });

  const classified = classifyPriorities(rankedItems);
  const prodConfidence = computeProdConfidence({
    consoleResult,
    profileResult: heapProfileResult,
    latestSnapshotResult,
    seriesResult,
    rankedItems,
  });

  const growth = {
    heapsnapshot_node_count_delta: seriesResult.growth.node_count_delta,
    heapsnapshot_node_count_delta_percent: seriesResult.growth.node_count_delta_percent,
    heapsnapshot_edge_count_delta: seriesResult.growth.edge_count_delta,
    heapsnapshot_edge_count_delta_percent: seriesResult.growth.edge_count_delta_percent,
    heapsnapshot_self_size_delta_mb: Number((seriesResult.growth.total_self_size_delta / (1024 * 1024)).toFixed(3)),
    heapsnapshot_self_size_slope_mb_per_min: seriesResult.growth.total_self_size_slope_mb_per_min,
    console_tileset_uploads_per_warp: consoleResult.growth.tileset_uploads_per_warp,
    console_dev_marker_ratio: consoleResult.growth.dev_marker_ratio,
    heapprofile_total_self_size: heapProfileResult.growth.total_self_size,
  };

  const hotspots = {
    console_top_tags: consoleResult.hotspots.top_tags,
    console_top_tileset_pairs: consoleResult.hotspots.top_tileset_pairs,
    heapprofile_top_frames: heapProfileResult.hotspots.top_frames.slice(0, 15),
    heapsnapshot_series_top_rising_constructors: seriesResult.hotspots.top_rising_constructors_by_self_size.slice(0, 20),
    latest_heapsnapshot_top_constructors: latestSnapshotResult.hotspots.top_constructors_by_self_size.slice(0, 20),
  };

  const nextProfilesRequired = [
    'Capture set A: local production build (`build + preview`) snapshots at minute 2, 11, and 20 + allocation sampling.',
    'Capture set B: deployed prod/staging snapshots at minute 2, 11, and 20 + allocation sampling.',
    'Compare both sets with this same artifact-forensics script set and enforce the 500 MB gate.',
    'Require post-minute-10 slope <= 2 MB/min for production sign-off.',
  ];

  const summary = withRunEnvelope({
    analyzer: 'run-artifact-forensics',
    artifactMeta: {
      kind: 'artifact_bundle',
      perf_dir: relPathFromCwd(resolvedPerfDir),
      console_log: relPathFromCwd(artifacts.console_log),
      heap_profile: relPathFromCwd(artifacts.heap_profile),
      heap_snapshots: artifacts.heap_snapshots.map((p) => relPathFromCwd(p)),
      snapshot_count: artifacts.heap_snapshots.length,
    },
    growth,
    hotspots,
    riskRankedItems: rankedItems,
    prodConfidence,
    nextProfilesRequired,
    extra: {
      analyzers: {
        console: consoleResult,
        heapprofile: heapProfileResult,
        latest_heapsnapshot: latestSnapshotResult,
        heapsnapshot_series: seriesResult,
      },
      classification: classified,
      memory_gate_target_mb: 500,
    },
  });

  ensureDirSync(resolvedReportsDir);
  const summaryJsonPath = path.resolve(resolvedReportsDir, 'artifact-forensics-summary.json');
  const summaryMdPath = path.resolve(resolvedReportsDir, 'artifact-forensics-summary.md');
  const prioritiesMdPath = path.resolve(resolvedReportsDir, 'prioritized-memory-actions-phase1.md');

  writeJsonFileSync(summaryJsonPath, summary);
  writeTextFileSync(summaryMdPath, toMarkdownSummary({ artifacts, summary }));
  writeTextFileSync(prioritiesMdPath, toMarkdownPriorities({ classified, rankedItems }));

  return {
    summary,
    outputs: {
      summary_json: summaryJsonPath,
      summary_md: summaryMdPath,
      priorities_md: prioritiesMdPath,
    },
  };
}

export function runCli(argv = process.argv.slice(2)) {
  const args = parseCliArgs(argv);
  const perfDir = args['perf-dir'] ? String(args['perf-dir']) : findDefaultPerfDir();
  const reportsDir = args['reports-dir'] ? String(args['reports-dir']) : findDefaultReportsDir();

  const result = runArtifactForensics({ perfDir, reportsDir });
  process.stdout.write(`${JSON.stringify({
    outputs: {
      summary_json: relPathFromCwd(result.outputs.summary_json),
      summary_md: relPathFromCwd(result.outputs.summary_md),
      priorities_md: relPathFromCwd(result.outputs.priorities_md),
    },
    prod_confidence: result.summary.prod_confidence,
    top_risk_items: result.summary.risk_ranked_items.slice(0, 5),
  }, null, 2)}\n`);
}
