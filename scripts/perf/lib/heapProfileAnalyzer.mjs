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

const DEFAULT_HEAPPROFILE = path.resolve(process.cwd(), 'docs/backlog/perf/Heap-20260215T152543.heapprofile');

function simplifyUrl(rawUrl) {
  if (!rawUrl) return '(internal)';

  let url = String(rawUrl);
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const parsed = new URL(url);
      url = parsed.pathname;
      if (url.startsWith('/pkmn-rse-browser/')) {
        url = url.slice('/pkmn-rse-browser/'.length);
      } else if (url.startsWith('/')) {
        url = url.slice(1);
      }
    } catch {
      // Keep original URL if parsing fails.
    }
  }

  const q = url.indexOf('?');
  if (q !== -1) {
    url = url.slice(0, q);
  }
  return url || '(internal)';
}

function frameKey(callFrame) {
  const fn = callFrame.functionName && callFrame.functionName.trim().length > 0
    ? callFrame.functionName.trim()
    : '(anonymous)';
  const url = simplifyUrl(callFrame.url);
  return `${fn}@@${url}:${callFrame.lineNumber}:${callFrame.columnNumber}`;
}

function detectDevMarker(url, functionName) {
  const s = `${url} ${functionName}`;
  return /localhost:5173|\.vite\/deps|jsxDEV|react_jsx-dev-runtime|installHook\.js/.test(s);
}

function pushAccum(map, key, amount) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function traverseHead(node, visitor) {
  visitor(node);
  const children = Array.isArray(node.children) ? node.children : [];
  for (const child of children) {
    traverseHead(child, visitor);
  }
}

export function analyzeHeapProfileJson(profileJson) {
  if (!profileJson || typeof profileJson !== 'object') {
    throw new Error('Heap profile must be an object');
  }

  if (!profileJson.head || typeof profileJson.head !== 'object') {
    throw new Error('Heap profile is missing "head"');
  }

  const byFrame = new Map();
  const byFile = new Map();
  let totalSelfSize = 0;
  let nodeCount = 0;

  traverseHead(profileJson.head, (node) => {
    if (!node || typeof node !== 'object' || !node.callFrame) {
      return;
    }

    nodeCount += 1;
    const selfSize = Number(node.selfSize ?? 0);
    if (!Number.isFinite(selfSize) || selfSize <= 0) {
      return;
    }

    totalSelfSize += selfSize;
    const frame = node.callFrame;
    const key = frameKey(frame);
    const file = simplifyUrl(frame.url);
    const fn = frame.functionName && frame.functionName.trim().length > 0 ? frame.functionName.trim() : '(anonymous)';

    const existing = byFrame.get(key) ?? {
      function_name: fn,
      url: file,
      line: frame.lineNumber,
      column: frame.columnNumber,
      self_size: 0,
      sample_count: 0,
      dev_marker: detectDevMarker(file, fn),
    };

    existing.self_size += selfSize;
    existing.sample_count += 1;
    byFrame.set(key, existing);

    pushAccum(byFile, file, selfSize);
  });

  const topFrames = [...byFrame.values()]
    .sort((a, b) => b.self_size - a.self_size)
    .slice(0, 25)
    .map((frame) => ({
      ...frame,
      self_size_human: formatBytes(frame.self_size),
      self_size_percent: Number(((frame.self_size / Math.max(1, totalSelfSize)) * 100).toFixed(3)),
    }));

  const topFiles = [...byFile.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([file, self_size]) => ({
      file,
      self_size,
      self_size_human: formatBytes(self_size),
      self_size_percent: Number(((self_size / Math.max(1, totalSelfSize)) * 100).toFixed(3)),
      dev_marker: detectDevMarker(file, ''),
    }));

  const riskRankedItems = topFrames.slice(0, 12).map((frame) => {
    const growthMagnitude = normalizeNumber(frame.self_size / Math.max(1, topFrames[0]?.self_size ?? 1));
    const repeatability = normalizeNumber(frame.sample_count / 10);
    const retainingPlausibility = /Map|ArrayBuffer|FiberNode|DebugPanel|cache|render|Tile|Sprite|snapshot/i.test(`${frame.function_name} ${frame.url}`)
      ? 0.75
      : 0.35;
    const prodLikelihood = frame.dev_marker
      ? 0.2
      : /src\//.test(frame.url)
        ? 0.7
        : 0.45;
    const score = (0.4 * growthMagnitude) + (0.2 * repeatability) + (0.2 * retainingPlausibility) + (0.2 * prodLikelihood);

    return {
      key: `frame:${frame.function_name}:${frame.url}:${frame.line}`,
      label: `${frame.function_name} (${frame.url})`,
      category: frame.dev_marker ? 'dev-only-inflation' : 'allocation-hotspot',
      score: Number(score.toFixed(3)),
      risk_bucket: scoreToBucket(score),
      factors: {
        growth_magnitude: Number(growthMagnitude.toFixed(3)),
        repeatability: Number(repeatability.toFixed(3)),
        retaining_path_plausibility: Number(retainingPlausibility.toFixed(3)),
        prod_likelihood: Number(prodLikelihood.toFixed(3)),
      },
      evidence: {
        self_size: frame.self_size,
        self_size_human: frame.self_size_human,
        self_size_percent: frame.self_size_percent,
        sample_count: frame.sample_count,
      },
    };
  }).sort((a, b) => b.score - a.score);

  const devWeightedShare = topFrames
    .filter((f) => f.dev_marker)
    .reduce((acc, f) => acc + f.self_size, 0) / Math.max(1, totalSelfSize);

  const prodConfidenceScore = normalizeNumber(0.62 - (devWeightedShare * 0.35));
  const prodConfidenceLevel = prodConfidenceScore >= 0.67 ? 'high' : prodConfidenceScore >= 0.45 ? 'medium' : 'low';

  return {
    growth: {
      call_tree_nodes: nodeCount,
      total_self_size: totalSelfSize,
      total_self_size_human: formatBytes(totalSelfSize),
      top_frame_self_size: topFrames[0]?.self_size ?? 0,
      top_frame_self_size_human: topFrames[0]?.self_size_human ?? '0 B',
      dev_weighted_share: Number(devWeightedShare.toFixed(4)),
    },
    hotspots: {
      top_frames: topFrames,
      top_files: topFiles,
    },
    risk_ranked_items: riskRankedItems,
    prod_confidence: {
      level: prodConfidenceLevel,
      score: Number(prodConfidenceScore.toFixed(3)),
      rationale: prodConfidenceLevel === 'low'
        ? 'Top allocation frames are dominated by development runtime call paths.'
        : 'Allocation profile contains mixed dev/runtime call paths and needs production-build corroboration.',
    },
    next_profiles_required: [
      'Repeat allocation sampling in production build (vite preview) to confirm hotspot persistence.',
      'Capture one allocation profile with debug panel closed and one with debug panel used heavily.',
    ],
  };
}

export function analyzeHeapProfileFile(filePath = DEFAULT_HEAPPROFILE) {
  const raw = fs.readFileSync(filePath, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse heapprofile JSON at ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }

  const analysis = analyzeHeapProfileJson(parsed);
  return withRunEnvelope({
    analyzer: 'analyze-heapprofile',
    artifactMeta: {
      kind: 'heapprofile',
      ...fileStatMeta(filePath),
    },
    growth: analysis.growth,
    hotspots: analysis.hotspots,
    riskRankedItems: analysis.risk_ranked_items,
    prodConfidence: analysis.prod_confidence,
    nextProfilesRequired: analysis.next_profiles_required,
  });
}

export function runCli(argv = process.argv.slice(2)) {
  const args = parseCliArgs(argv);
  const inputPath = path.resolve(process.cwd(), args.input ? String(args.input) : DEFAULT_HEAPPROFILE);
  const result = analyzeHeapProfileFile(inputPath);

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
