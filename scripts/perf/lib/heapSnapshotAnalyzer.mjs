import fs from 'node:fs';
import path from 'node:path';
import {
  fileStatMeta,
  formatBytes,
  normalizeNumber,
  parseCliArgs,
  relPathFromCwd,
  scoreToBucket,
  withRunEnvelope,
  writeJsonFileSync,
} from './common.mjs';

const DEFAULT_HEAPSNAPSHOT = path.resolve(process.cwd(), 'docs/backlog/perf/Heap-20260215T151212.heapsnapshot');

const DEV_STRING_PATTERNS = {
  localhost5173: 'localhost:5173',
  viteDeps: '.vite/deps',
  hmrTimestamp: '?t=',
  installHook: 'installHook.js',
  reactDevRuntime: 'react_jsx-dev-runtime',
};

function bucketForBytes(bytes) {
  if (bytes < 64 * 1024) return 'tiny(<64KB)';
  if (bytes < 1 * 1024 * 1024) return 'small(64KB-1MB)';
  if (bytes < 8 * 1024 * 1024) return 'medium(1MB-8MB)';
  if (bytes < 64 * 1024 * 1024) return 'large(8MB-64MB)';
  return 'huge(>=64MB)';
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
    prodLikelihood = 0.65;
  }

  const retainingPlausibility = highRetain ? 0.75 : 0.35;
  return { devNoise, prodLikelihood, retainingPlausibility };
}

function sortedTop(records, sortKey, limit = 25) {
  return [...records].sort((a, b) => b[sortKey] - a[sortKey]).slice(0, limit);
}

export function extractHeapSnapshotMetrics(snapshotJson, options = {}) {
  if (!snapshotJson || typeof snapshotJson !== 'object') {
    throw new Error('Heap snapshot input must be an object');
  }

  const snapshotMeta = snapshotJson.snapshot;
  const meta = snapshotMeta?.meta;
  const nodes = snapshotJson.nodes;
  const edges = snapshotJson.edges;
  const strings = snapshotJson.strings;

  if (!snapshotMeta || !meta || !Array.isArray(nodes) || !Array.isArray(edges) || !Array.isArray(strings)) {
    throw new Error('Invalid heapsnapshot format: missing snapshot/meta/nodes/edges/strings');
  }

  const nodeFields = meta.node_fields;
  const edgeFields = meta.edge_fields;
  const nodeTypesByField = meta.node_types;

  if (!Array.isArray(nodeFields) || !Array.isArray(edgeFields) || !Array.isArray(nodeTypesByField)) {
    throw new Error('Invalid heapsnapshot format: missing node_fields/edge_fields/node_types');
  }

  const nodeFieldCount = nodeFields.length;
  const edgeFieldCount = edgeFields.length;

  const typeFieldIndex = nodeFields.indexOf('type');
  const nameFieldIndex = nodeFields.indexOf('name');
  const selfSizeFieldIndex = nodeFields.indexOf('self_size');
  const edgeCountFieldIndex = nodeFields.indexOf('edge_count');
  const edgeToNodeFieldIndex = edgeFields.indexOf('to_node');

  if ([typeFieldIndex, nameFieldIndex, selfSizeFieldIndex, edgeCountFieldIndex, edgeToNodeFieldIndex].some((idx) => idx < 0)) {
    throw new Error('Invalid heapsnapshot format: missing required fields');
  }

  const nodeTypeNames = nodeTypesByField[typeFieldIndex];
  const totalNodeCount = Number(snapshotMeta.node_count ?? Math.floor(nodes.length / nodeFieldCount));
  const totalEdgeCount = Number(snapshotMeta.edge_count ?? Math.floor(edges.length / edgeFieldCount));
  const extraNativeBytes = Number(snapshotMeta.extra_native_bytes ?? 0);

  const nodeSelfSizes = new Float64Array(totalNodeCount);
  const constructorSelf = new Map();
  const constructorRetainedEstimate = new Map();
  const typeSelf = new Map();

  let totalSelfSize = 0;

  for (let nodeOrdinal = 0; nodeOrdinal < totalNodeCount; nodeOrdinal += 1) {
    const base = nodeOrdinal * nodeFieldCount;
    const typeIndex = nodes[base + typeFieldIndex];
    const typeName = nodeTypeNames?.[typeIndex] ?? String(typeIndex);
    const nameIndex = nodes[base + nameFieldIndex];
    const constructorName = strings[nameIndex] || '(empty)';
    const selfSize = Number(nodes[base + selfSizeFieldIndex] ?? 0);

    nodeSelfSizes[nodeOrdinal] = selfSize;
    totalSelfSize += selfSize;

    constructorSelf.set(constructorName, (constructorSelf.get(constructorName) ?? 0) + selfSize);
    typeSelf.set(typeName, (typeSelf.get(typeName) ?? 0) + selfSize);
  }

  let edgePos = 0;
  for (let nodeOrdinal = 0; nodeOrdinal < totalNodeCount; nodeOrdinal += 1) {
    const base = nodeOrdinal * nodeFieldCount;
    const nameIndex = nodes[base + nameFieldIndex];
    const constructorName = strings[nameIndex] || '(empty)';
    const selfSize = nodeSelfSizes[nodeOrdinal];
    const edgeCount = Number(nodes[base + edgeCountFieldIndex] ?? 0);

    let outboundSelfSum = 0;
    for (let i = 0; i < edgeCount; i += 1) {
      const edgeBase = edgePos + (i * edgeFieldCount);
      const toNodeOffset = Number(edges[edgeBase + edgeToNodeFieldIndex] ?? 0);
      const targetNodeOrdinal = Math.floor(toNodeOffset / nodeFieldCount);
      outboundSelfSum += nodeSelfSizes[targetNodeOrdinal] ?? 0;
    }

    edgePos += edgeCount * edgeFieldCount;

    const retainedEstimate = selfSize + outboundSelfSum;
    constructorRetainedEstimate.set(
      constructorName,
      (constructorRetainedEstimate.get(constructorName) ?? 0) + retainedEstimate,
    );
  }

  const constructorRecords = [...constructorSelf.entries()].map(([constructor_name, self_size]) => {
    const retained_estimate = constructorRetainedEstimate.get(constructor_name) ?? self_size;
    return {
      constructor_name,
      self_size,
      self_size_human: formatBytes(self_size),
      self_percent: Number(((self_size / Math.max(1, totalSelfSize)) * 100).toFixed(4)),
      retained_size_estimate: retained_estimate,
      retained_size_estimate_human: formatBytes(retained_estimate),
      self_bucket: bucketForBytes(self_size),
      retained_estimate_bucket: bucketForBytes(retained_estimate),
    };
  });

  const topConstructorsBySelf = sortedTop(constructorRecords, 'self_size', 30);
  const topConstructorsByRetainedEstimate = sortedTop(constructorRecords, 'retained_size_estimate', 30);
  const topTypes = [...typeSelf.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type_name, self_size]) => ({
      type_name,
      self_size,
      self_size_human: formatBytes(self_size),
      self_percent: Number(((self_size / Math.max(1, totalSelfSize)) * 100).toFixed(4)),
    }));

  const devStringHits = {};
  for (const key of Object.keys(DEV_STRING_PATTERNS)) {
    devStringHits[key] = 0;
  }
  for (const s of strings) {
    const stringValue = String(s);
    for (const [key, needle] of Object.entries(DEV_STRING_PATTERNS)) {
      if (stringValue.includes(needle)) {
        devStringHits[key] += 1;
      }
    }
  }

  const maxSelf = topConstructorsBySelf[0]?.self_size ?? 1;
  const riskRankedItems = topConstructorsBySelf.slice(0, 15).map((entry) => {
    const { devNoise, prodLikelihood, retainingPlausibility } = classifyConstructorSignals(entry.constructor_name);
    const growthMagnitude = normalizeNumber(entry.self_size / Math.max(1, maxSelf));
    const repeatability = 0.5;
    const score = (0.4 * growthMagnitude) + (0.2 * repeatability) + (0.2 * retainingPlausibility) + (0.2 * prodLikelihood);

    return {
      key: `constructor:${entry.constructor_name}`,
      label: entry.constructor_name,
      category: devNoise ? 'dev-only-inflation' : 'constructor-memory-hotspot',
      score: Number(score.toFixed(3)),
      risk_bucket: scoreToBucket(score),
      factors: {
        growth_magnitude: Number(growthMagnitude.toFixed(3)),
        repeatability: Number(repeatability.toFixed(3)),
        retaining_path_plausibility: Number(retainingPlausibility.toFixed(3)),
        prod_likelihood: Number(prodLikelihood.toFixed(3)),
      },
      evidence: {
        self_size: entry.self_size,
        self_size_human: entry.self_size_human,
        retained_size_estimate: entry.retained_size_estimate,
        retained_size_estimate_human: entry.retained_size_estimate_human,
      },
    };
  }).sort((a, b) => b.score - a.score);

  const devSignalStrength = normalizeNumber(
    Object.values(devStringHits).reduce((acc, n) => acc + Number(n || 0), 0) / Math.max(1, strings.length),
  );
  const prodConfidenceScore = normalizeNumber(0.58 - (devSignalStrength * 0.45));
  const prodConfidenceLevel = prodConfidenceScore >= 0.67 ? 'high' : prodConfidenceScore >= 0.45 ? 'medium' : 'low';

  const constructorTotals = {};
  const constructorMinBytes = Number.isFinite(options.constructorMinBytes)
    ? Math.max(0, Number(options.constructorMinBytes))
    : 0;
  if (options.includeAllConstructors) {
    for (const [name, self_size] of constructorSelf.entries()) {
      if (self_size < constructorMinBytes) continue;
      constructorTotals[name] = {
        self_size,
        retained_size_estimate: constructorRetainedEstimate.get(name) ?? self_size,
      };
    }
  }

  return {
    growth: {
      node_count: totalNodeCount,
      edge_count: totalEdgeCount,
      total_self_size: totalSelfSize,
      total_self_size_human: formatBytes(totalSelfSize),
      extra_native_bytes: extraNativeBytes,
      extra_native_bytes_human: formatBytes(extraNativeBytes),
    },
    hotspots: {
      top_types_by_self_size: topTypes.slice(0, 20),
      top_constructors_by_self_size: topConstructorsBySelf,
      top_constructors_by_retained_size_estimate: topConstructorsByRetainedEstimate,
      retained_size_note: 'retained_size_estimate is an over-approximation from outbound-edge target self sizes; use DevTools retained size for exact values.',
    },
    risk_ranked_items: riskRankedItems,
    prod_confidence: {
      level: prodConfidenceLevel,
      score: Number(prodConfidenceScore.toFixed(3)),
      rationale: prodConfidenceLevel === 'low'
        ? 'Snapshot includes strong development-session markers; not sufficient for production certainty.'
        : 'Snapshot provides useful hotspots but must be compared with production-build captures.',
    },
    next_profiles_required: [
      'Run same path on production build and compare constructor deltas against this baseline.',
      'Use DevTools retained-size view for top constructors from this report to confirm true retainers.',
    ],
    analysis_meta: {
      strings_count: strings.length,
      dev_string_hits: devStringHits,
      constructor_count: constructorSelf.size,
      constructor_totals: constructorTotals,
    },
  };
}

export function analyzeHeapSnapshotFile(filePath = DEFAULT_HEAPSNAPSHOT, options = {}) {
  const raw = fs.readFileSync(filePath, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse heapsnapshot JSON at ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }

  const analysis = extractHeapSnapshotMetrics(parsed, options);
  return withRunEnvelope({
    analyzer: 'analyze-heapsnapshot',
    artifactMeta: {
      kind: 'heapsnapshot',
      ...fileStatMeta(filePath),
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
  const inputPath = path.resolve(process.cwd(), args.input ? String(args.input) : DEFAULT_HEAPSNAPSHOT);
  const includeAllConstructors = Boolean(args['include-all-constructors']);
  const constructorMinBytes = args['constructor-min-bytes'] ? Number(args['constructor-min-bytes']) : 0;
  const result = analyzeHeapSnapshotFile(inputPath, { includeAllConstructors, constructorMinBytes });

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
