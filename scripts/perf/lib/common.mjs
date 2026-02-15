import fs from 'node:fs';
import path from 'node:path';

export function nowIso() {
  return new Date().toISOString();
}

export function toPosixPath(p) {
  return p.replace(/\\/g, '/');
}

export function relPathFromCwd(p) {
  return toPosixPath(path.relative(process.cwd(), p) || '.');
}

export function ensureDirSync(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function readTextFileSync(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

export function readJsonFileSync(filePath) {
  const raw = readTextFileSync(filePath);
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse JSON at ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function writeJsonFileSync(filePath, data) {
  ensureDirSync(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export function writeTextFileSync(filePath, data) {
  ensureDirSync(path.dirname(filePath));
  fs.writeFileSync(filePath, data, 'utf8');
}

export function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = Math.max(0, Number(bytes) || 0);
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 100 || unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

export function toPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Number((n * 100).toFixed(2));
}

export function safeDivide(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return 0;
  return a / b;
}

export function sortedEntriesByValueDesc(record) {
  return Object.entries(record).sort((a, b) => Number(b[1]) - Number(a[1]));
}

export function topEntries(record, limit = 10) {
  return sortedEntriesByValueDesc(record).slice(0, limit);
}

export function parseCliArgs(argv) {
  const args = {
    _: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }

    const eqIndex = token.indexOf('=');
    if (eqIndex !== -1) {
      const key = token.slice(2, eqIndex);
      const value = token.slice(eqIndex + 1);
      args[key] = value;
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }

  return args;
}

export function withRunEnvelope({
  analyzer,
  artifactMeta,
  growth = {},
  hotspots = {},
  riskRankedItems = [],
  prodConfidence,
  nextProfilesRequired = [],
  extra = {},
}) {
  return {
    run_meta: {
      analyzer,
      generated_at: nowIso(),
      cwd: relPathFromCwd(process.cwd()),
    },
    artifact_meta: artifactMeta,
    growth,
    hotspots,
    risk_ranked_items: riskRankedItems,
    prod_confidence: prodConfidence,
    next_profiles_required: nextProfilesRequired,
    ...extra,
  };
}

export function fileStatMeta(filePath) {
  const stat = fs.statSync(filePath);
  return {
    path: relPathFromCwd(filePath),
    bytes: stat.size,
    mtime_iso: stat.mtime.toISOString(),
  };
}

export function normalizeNumber(value, min = 0, max = 1) {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function scoreToBucket(score, { high = 0.7, low = 0.45 } = {}) {
  if (score >= high) return 'high-risk';
  if (score <= low) return 'likely-dev-noise';
  return 'possible-prod-risk';
}

export function findDefaultPerfDir() {
  return path.resolve(process.cwd(), 'docs/backlog/perf');
}

export function findDefaultReportsDir() {
  return path.resolve(findDefaultPerfDir(), 'reports');
}
