/**
 * Save layout audit utility.
 *
 * Usage:
 *   node --experimental-strip-types scripts/audit-save-layouts.ts
 *   node --experimental-strip-types scripts/audit-save-layouts.ts --profiles docs/systems/save/layout-profiles/emerald-legacy-604.overrides.json
 *   node --experimental-strip-types scripts/audit-save-layouts.ts --profiles <path> --markdown-out docs/systems/save/layout-profiles/sample-save-audit.md
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGen3Save } from '../src/save/native/Gen3SaveParser.ts';
import {
  BUILTIN_SAVE_LAYOUT_PROFILES,
  buildSaveLayoutProfiles,
  type SaveLayoutProfile,
  type SaveLayoutProfileOverride,
} from '../src/save/native/Gen3LayoutProfiles.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const SAMPLE_SAVE_DIR = path.join(WORKSPACE_ROOT, 'public/sample_save');

interface CliOptions {
  profilesPath?: string;
  markdownOutPath?: string;
}

interface OverrideBundle {
  profiles: SaveLayoutProfileOverride[];
}

interface AuditRow {
  file: string;
  parseSuccess: boolean;
  selectedProfile: string;
  confidence: number;
  supported: boolean;
  sanity: string;
  issues: number;
  flagsSet: number;
  nonZeroVars: number;
  partyCount: number;
  sourceFormat: string;
  error?: string;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--profiles') {
      options.profilesPath = argv[i + 1];
      i++;
    } else if (token === '--markdown-out') {
      options.markdownOutPath = argv[i + 1];
      i++;
    }
  }
  return options;
}

function validateOverrideBundle(raw: unknown): OverrideBundle {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { profiles?: unknown }).profiles)) {
    throw new Error('Invalid profile override file: expected object with "profiles" array');
  }

  const profiles = (raw as { profiles: unknown[] }).profiles.map((entry, idx) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`Invalid profile override at index ${idx}: expected object`);
    }
    const override = entry as Partial<SaveLayoutProfileOverride>;
    if (typeof override.id !== 'string' || override.id.length === 0) {
      throw new Error(`Invalid profile override at index ${idx}: missing "id"`);
    }
    if (typeof override.baseProfileId !== 'string' || override.baseProfileId.length === 0) {
      throw new Error(`Invalid profile override at index ${idx}: missing "baseProfileId"`);
    }
    return override as SaveLayoutProfileOverride;
  });

  return { profiles };
}

function loadProfiles(options: CliOptions): SaveLayoutProfile[] {
  if (!options.profilesPath) {
    return [...BUILTIN_SAVE_LAYOUT_PROFILES];
  }

  const resolvedPath = path.resolve(WORKSPACE_ROOT, options.profilesPath);
  const text = readFileSync(resolvedPath, 'utf8');
  const parsed = JSON.parse(text) as unknown;
  const bundle = validateOverrideBundle(parsed);
  return buildSaveLayoutProfiles(bundle.profiles, BUILTIN_SAVE_LAYOUT_PROFILES);
}

function readSampleBuffer(filename: string): ArrayBuffer {
  const filePath = path.join(SAMPLE_SAVE_DIR, filename);
  const data = readFileSync(filePath);
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
}

function auditFile(filename: string, layoutProfiles: SaveLayoutProfile[]): AuditRow {
  const buffer = readSampleBuffer(filename);
  const result = parseGen3Save(buffer, filename, { layoutProfiles });

  if (!result.success || !result.nativeMetadata) {
    return {
      file: filename,
      parseSuccess: false,
      selectedProfile: '-',
      confidence: 0,
      supported: false,
      sanity: '-',
      issues: 0,
      flagsSet: 0,
      nonZeroVars: 0,
      partyCount: 0,
      sourceFormat: '-',
      error: result.error ?? 'Unknown parser failure',
    };
  }

  const metadata = result.nativeMetadata;
  return {
    file: filename,
    parseSuccess: true,
    selectedProfile: metadata.layoutProfileId,
    confidence: metadata.layoutConfidence,
    supported: metadata.layoutSupported,
    sanity: metadata.sanity.level,
    issues: metadata.sanity.issues.length,
    flagsSet: metadata.sanity.flagsSetCount,
    nonZeroVars: metadata.sanity.nonZeroVarCount,
    partyCount: metadata.sanity.rawPartyCount,
    sourceFormat: metadata.sourceFormat,
  };
}

function formatConsoleRows(rows: AuditRow[]): string {
  const header = [
    'file',
    'status',
    'profile',
    'confidence',
    'sanity',
    'flags',
    'vars',
    'party',
    'source',
    'error',
  ];

  const lines = [header.join('\t')];
  for (const row of rows) {
    const status = row.parseSuccess ? (row.supported ? 'supported' : 'unsupported') : 'parse_error';
    lines.push([
      row.file,
      status,
      row.selectedProfile,
      String(row.confidence),
      row.sanity,
      String(row.flagsSet),
      String(row.nonZeroVars),
      String(row.partyCount),
      row.sourceFormat,
      row.error ?? '',
    ].join('\t'));
  }
  return lines.join('\n');
}

function formatMarkdown(rows: AuditRow[], layoutProfiles: SaveLayoutProfile[], options: CliOptions): string {
  const now = new Date().toISOString().slice(0, 10);
  const profileSource = options.profilesPath
    ? `Built-ins + overrides from \`${options.profilesPath}\``
    : 'Built-in profiles only';
  const profileList = layoutProfiles.map((p) => `\`${p.id}\``).join(', ');

  const lines: string[] = [];
  lines.push('---');
  lines.push(`title: Sample Save Layout Audit (${now})`);
  lines.push('status: in_progress');
  lines.push(`last_verified: ${now}`);
  lines.push('---');
  lines.push('');
  lines.push('# Sample Save Layout Audit');
  lines.push('');
  lines.push(`- Date: ${now}`);
  lines.push(`- Profile set: ${profileSource}`);
  lines.push(`- Active candidates: ${profileList}`);
  lines.push('');
  lines.push('| File | Result | Selected Profile | Confidence | Sanity | Issues | Flags Set | Non-zero Vars | Party Count | Source Format | Error |');
  lines.push('|------|--------|------------------|------------|--------|--------|-----------|---------------|-------------|---------------|-------|');
  for (const row of rows) {
    const status = row.parseSuccess ? (row.supported ? 'supported' : 'unsupported') : 'parse_error';
    lines.push(
      `| \`${row.file}\` | ${status} | \`${row.selectedProfile}\` | ${row.confidence} | ${row.sanity} | ${row.issues} | ${row.flagsSet} | ${row.nonZeroVars} | ${row.partyCount} | ${row.sourceFormat} | ${row.error ?? ''} |`
    );
  }

  return lines.join('\n');
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const layoutProfiles = loadProfiles(options);

  const files = readdirSync(SAMPLE_SAVE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const rows = files.map((file) => auditFile(file, layoutProfiles));
  const consoleOutput = formatConsoleRows(rows);
  console.log(consoleOutput);

  if (options.markdownOutPath) {
    const markdown = formatMarkdown(rows, layoutProfiles, options);
    const outPath = path.resolve(WORKSPACE_ROOT, options.markdownOutPath);
    writeFileSync(outPath, markdown, 'utf8');
    console.log(`\nWrote markdown report to ${outPath}`);
  }
}

main();
