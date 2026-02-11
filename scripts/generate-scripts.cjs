#!/usr/bin/env node
/**
 * Generate Script Data from pokeemerald .inc source files
 *
 * Parses GAS-style assembly scripts from:
 *   - public/pokeemerald/data/maps/{MapName}/scripts.inc
 *   - public/pokeemerald/data/scripts/players_house.inc
 *   - public/pokeemerald/data/scripts/movement.inc
 *
 * Outputs:
 *   - src/data/scripts/{MapName}.gen.ts (one per map)
 *   - src/data/scripts/common.gen.ts (shared scripts/movements)
 *   - src/data/scripts/index.ts (lazy-loading registry)
 *
 * Usage: node scripts/generate-scripts.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MAPS_DIR = path.join(ROOT, 'public/pokeemerald/data/maps');
const SHARED_SCRIPTS_DIR = path.join(ROOT, 'public/pokeemerald/data/scripts');
const SHARED_TEXT_DIR = path.join(ROOT, 'public/pokeemerald/data/text');
const CONSTANTS_DIR = path.join(ROOT, 'public/pokeemerald/include/constants');
const OUTPUT_DIR = path.join(ROOT, 'src/data/scripts');

// All .inc files in data/text/ contain text referenced by map scripts
// (trainer dialogue, berry NPCs, nurse text, etc.)

/**
 * Discover all maps that have a scripts.inc file.
 */
function discoverMaps() {
  const maps = [];
  try {
    const entries = fs.readdirSync(MAPS_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const incPath = path.join(MAPS_DIR, entry.name, 'scripts.inc');
        if (fs.existsSync(incPath)) {
          maps.push(entry.name);
        }
      }
    }
  } catch (e) {
    console.error('Error reading maps directory:', e.message);
  }
  maps.sort();
  return maps;
}

/**
 * Discover all shared .inc script files.
 */
function discoverSharedFiles() {
  const files = [];
  try {
    const entries = fs.readdirSync(SHARED_SCRIPTS_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.inc')) {
        files.push(entry.name);
      }
    }
  } catch (e) {
    console.error('Error reading shared scripts directory:', e.message);
  }
  files.sort();
  return files;
}

// Map folder name → MAP_ constant name
function mapFolderToConstant(folder) {
  // LittlerootTown_BrendansHouse_1F → MAP_LITTLEROOT_TOWN_BRENDANS_HOUSE_1F
  return 'MAP_' + folder
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toUpperCase();
}

/**
 * Build a map of C #define constants from pokeemerald header files.
 * Scans all .h files in include/constants/ and resolves numeric values,
 * including aliases and simple arithmetic expressions.
 */
function buildConstantMap() {
  const constants = new Map();
  const headerFiles = [];

  try {
    const entries = fs.readdirSync(CONSTANTS_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.h')) {
        headerFiles.push(path.join(CONSTANTS_DIR, entry.name));
      }
    }
  } catch (e) {
    console.warn('Warning: Could not read constants directory:', e.message);
    return constants;
  }

  // Collect all raw #define entries: name → raw value string
  const rawDefines = new Map();
  for (const filePath of headerFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*#define\s+(\w+)\s+(.+?)(?:\s*\/\/.*|\s*\/\*.*)?$/);
      if (m) {
        const name = m[1];
        const value = m[2].trim();
        // Skip macro-like defines (those with parenthesized params)
        if (/^\(.*\)$/.test(name) || /\w+\(/.test(value) && !value.startsWith('(')) continue;
        rawDefines.set(name, value);
      }
    }
  }

  // Try to evaluate a raw value string into a number
  function tryEvaluateExpr(expr) {
    // Strip outer parens
    expr = expr.replace(/^\((.+)\)$/, '$1').trim();

    // Simple numeric literal
    if (/^-?\d+$/.test(expr)) return parseInt(expr, 10);
    if (/^0x[0-9a-fA-F]+$/i.test(expr)) return parseInt(expr, 16);

    // Simple alias: just a name
    if (/^\w+$/.test(expr)) {
      return constants.has(expr) ? constants.get(expr) : undefined;
    }

    // Arithmetic expression: substitute known constants, then evaluate
    // Only allow safe tokens: numbers, hex, +, -, *, /, (), <<, >>, |, &, ~, whitespace
    let substituted = expr.replace(/\b([A-Z_][A-Z0-9_]*)\b/g, (match) => {
      if (constants.has(match)) return String(constants.get(match));
      return match;
    });

    // Check if all identifiers are resolved (no remaining uppercase identifiers)
    if (/\b[A-Z_][A-Z0-9_]*\b/.test(substituted)) return undefined;

    // Safety check: only allow numeric expressions
    if (!/^[\d\sx+\-*/().<>&|~^]+$/.test(substituted)) return undefined;

    try {
      const result = Function('"use strict"; return (' + substituted + ')')();
      if (typeof result === 'number' && isFinite(result)) return result | 0;
    } catch {
      // Expression evaluation failed
    }
    return undefined;
  }

  // Multi-pass resolution: iterate until no more progress
  let resolved = 0;
  for (let pass = 0; pass < 10; pass++) {
    let progress = false;
    for (const [name, raw] of rawDefines) {
      if (constants.has(name)) continue;
      const val = tryEvaluateExpr(raw);
      if (val !== undefined) {
        constants.set(name, val);
        progress = true;
        resolved++;
      }
    }
    if (!progress) break;
  }

  console.log(`Parsed ${resolved} numeric constants from ${headerFiles.length} header files`);
  return constants;
}

// Pre-built constant map from C headers
const CONSTANT_MAP = buildConstantMap();

/**
 * Build the set of known movement commands by parsing the canonical
 * movement.inc macro file from pokeemerald.
 * This replaces a previously hand-curated list that was incomplete (missing
 * ~90 commands) and contained phantom entries.
 */
function buildMovementCommandSet() {
  const movementIncPath = path.join(ROOT, 'public/pokeemerald/asm/macros/movement.inc');
  const content = fs.readFileSync(movementIncPath, 'utf8');
  const names = new Set();
  for (const line of content.split('\n')) {
    const match = line.match(/create_movement_action\s+(\w+),/);
    if (match) {
      names.add(match[1]);
    }
  }
  console.log(`Parsed ${names.size} movement commands from movement.inc`);
  return names;
}

// Known movement commands — auto-parsed from public/pokeemerald/asm/macros/movement.inc
const MOVEMENT_COMMANDS = buildMovementCommandSet();

// Map script type strings → our header keys
const MAP_SCRIPT_TYPES = {
  'MAP_SCRIPT_ON_LOAD': 'onLoad',
  'MAP_SCRIPT_ON_TRANSITION': 'onTransition',
  'MAP_SCRIPT_ON_RESUME': 'onResume',
  'MAP_SCRIPT_ON_FRAME_TABLE': 'onFrame',
  'MAP_SCRIPT_ON_WARP_INTO_MAP_TABLE': 'onWarpInto',
};

/**
 * Parse a single .inc file into structured data.
 * Returns { scripts, movements, text, mapScriptsLabel, mapScriptEntries }
 */
function parseIncFile(content) {
  const lines = content.split('\n');
  const scripts = {};    // label → ScriptCommand[]
  const movements = {};  // label → string[]
  const text = {};       // label → string

  // Intermediate: collect raw lines per label, then classify
  const entities = []; // { label, global, lines[] }
  let current = null;

  // Also collect map_script entries for header parsing
  let mapScriptsLabel = null;
  const mapScriptEntries = []; // { type, label } or { type, var, value, label }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // Skip empty lines
    if (line.trim() === '') continue;

    // Skip pure comments
    if (line.trim().startsWith('@')) continue;

    // Check for label line
    const labelMatch = line.match(/^(\w+)(::?)$/);
    if (labelMatch) {
      const label = labelMatch[1];
      const isGlobal = labelMatch[2] === '::';

      // Detect MapScripts label
      if (label.endsWith('_MapScripts')) {
        mapScriptsLabel = label;
      }

      current = { label, global: isGlobal, lines: [] };
      entities.push(current);
      continue;
    }

    // Indented content line — belongs to current entity
    if (current && (line.startsWith('\t') || line.startsWith('  '))) {
      const trimmed = line.trim();

      // Skip inline comments
      if (trimmed.startsWith('@')) continue;

      // Strip trailing inline comments
      const commentIdx = trimmed.indexOf(' @');
      const clean = commentIdx >= 0 ? trimmed.substring(0, commentIdx).trim() : trimmed;

      if (clean) {
        current.lines.push(clean);
      }
    }
  }

  // First pass: extract map_script entries from the MapScripts entity
  for (const entity of entities) {
    if (entity.label === mapScriptsLabel) {
      for (const line of entity.lines) {
        // map_script TYPE, label
        const msMatch = line.match(/^map_script\s+(\w+),\s*(\w+)$/);
        if (msMatch) {
          mapScriptEntries.push({ type: msMatch[1], label: msMatch[2] });
        }
      }
      continue;
    }

    // Check for frame table / warp-into table entities
    // These contain map_script_2 entries
    const hasMapScript2 = entity.lines.some(l => l.startsWith('map_script_2'));
    if (hasMapScript2) {
      for (const line of entity.lines) {
        const ms2Match = line.match(/^map_script_2\s+(\w+),\s*(\w+),\s*(\w+)$/);
        if (ms2Match) {
          mapScriptEntries.push({
            type: '__table__',
            tableLabel: entity.label,
            var: ms2Match[1],
            value: ms2Match[2],
            script: ms2Match[3],
          });
        }
      }
      continue;
    }
  }

  // Second pass: classify each entity by its first content line
  for (const entity of entities) {
    if (entity.label === mapScriptsLabel) continue;
    if (entity.lines.length === 0) continue;

    // Skip table entities (already processed above)
    if (entity.lines.some(l => l.startsWith('map_script_2'))) continue;

    const firstLine = entity.lines[0];

    if (firstLine.startsWith('.string')) {
      // Text entity — concatenate all .string lines
      const parts = [];
      for (const line of entity.lines) {
        const strMatch = line.match(/^\.string\s+"(.*)"\s*$/);
        if (strMatch) {
          parts.push(strMatch[1]);
        }
      }
      // Join and strip trailing $ (end of string marker)
      let combined = parts.join('');
      if (combined.endsWith('$')) {
        combined = combined.slice(0, -1);
      }
      text[entity.label] = combined;
    } else if (MOVEMENT_COMMANDS.has(firstLine)) {
      // Movement entity — collect movement commands (excluding step_end)
      const steps = [];
      for (const line of entity.lines) {
        if (line === 'step_end') break;
        if (MOVEMENT_COMMANDS.has(line)) {
          steps.push(line);
        }
      }
      movements[entity.label] = steps;
    } else {
      // Script entity — parse commands
      const commands = [];
      for (const line of entity.lines) {
        // Skip terminators
        if (line === '.byte 0' || line === '.2byte 0') continue;

        const parsed = parseCommand(line);
        if (parsed) {
          commands.push(parsed);
        }
      }
      if (commands.length > 0) {
        scripts[entity.label] = commands;
      }
    }
  }

  return { scripts, movements, text, mapScriptsLabel, mapScriptEntries };
}

/**
 * Parse a single command line into { cmd, args }
 * Example: "msgbox PlayersHouse_1F_Text_GoSetTheClock, MSGBOX_DEFAULT"
 *       → { cmd: "msgbox", args: ["PlayersHouse_1F_Text_GoSetTheClock", "MSGBOX_DEFAULT"] }
 */
function parseCommand(line) {
  // Split into command and rest
  const spaceIdx = line.indexOf(' ');
  if (spaceIdx < 0) {
    // No args command (e.g., "end", "lockall", "releaseall")
    return { cmd: line };
  }

  const cmd = line.substring(0, spaceIdx);
  const rest = line.substring(spaceIdx + 1).trim();

  // Split args on comma, respecting that some args may contain spaces
  const args = rest.split(',').map(a => a.trim()).filter(a => a.length > 0);

  // Try to convert numeric args
  const parsedArgs = args.map(a => {
    // Pure integer
    if (/^-?\d+$/.test(a)) return parseInt(a, 10);
    // Hex integer
    if (/^0x[0-9a-fA-F]+$/i.test(a)) return parseInt(a, 16);
    // Boolean-like
    if (a === 'TRUE') return 'TRUE';
    if (a === 'FALSE') return 'FALSE';
    // Keep as string (labels, constants)
    return a;
  });

  return { cmd, args: parsedArgs };
}

/**
 * Build the MapScriptHeader from parsed map_script entries.
 */
function buildMapScriptHeader(mapScriptEntries) {
  const header = {};

  // Simple map_script entries (onLoad, onTransition, etc.)
  for (const entry of mapScriptEntries) {
    if (entry.type === '__table__') continue;

    const key = MAP_SCRIPT_TYPES[entry.type];
    if (key && (key === 'onLoad' || key === 'onTransition' || key === 'onResume')) {
      header[key] = entry.label;
    }
    // Frame tables and warp-into tables are resolved from __table__ entries
    if (key === 'onFrame' || key === 'onWarpInto') {
      // Find the table label for this type
      if (!header[key]) header[key] = [];
    }
  }

  // Table entries (onFrame / onWarpInto)
  // Group by tableLabel, then figure out which header key they belong to
  const tableLabelToKey = {};
  for (const entry of mapScriptEntries) {
    if (entry.type !== '__table__') continue;
    // Find which map_script entry points to this table
    if (!tableLabelToKey[entry.tableLabel]) {
      for (const ms of mapScriptEntries) {
        if (ms.type === '__table__') continue;
        if (ms.label === entry.tableLabel) {
          tableLabelToKey[entry.tableLabel] = MAP_SCRIPT_TYPES[ms.type];
          break;
        }
      }
    }

    const key = tableLabelToKey[entry.tableLabel];
    if (key) {
      if (!header[key]) header[key] = [];
      header[key].push({
        var: entry.var,
        value: tryParseInt(entry.value),
        script: entry.script,
      });
    }
  }

  return header;
}

function tryParseInt(val) {
  if (typeof val === 'number') return val;
  if (/^-?\d+$/.test(val)) return parseInt(val, 10);
  if (/^0x[0-9a-fA-F]+$/i.test(val)) return parseInt(val, 16);
  // Try resolving as a C constant
  if (CONSTANT_MAP.has(val)) return CONSTANT_MAP.get(val);
  // Return as number if it looks numeric, otherwise keep as string
  const n = parseInt(val, 10);
  if (!isNaN(n)) return n;
  console.warn(`  Warning: unresolved constant in map_script_2: ${val}`);
  return val;
}

/**
 * Generate TypeScript source for a MapScriptData object.
 */
function generateTsFile(mapName, data) {
  const { mapScripts, scripts, movements, text } = data;

  const lines = [];
  lines.push('// Auto-generated from pokeemerald source. DO NOT EDIT.');
  lines.push('// Regenerate with: npm run generate:scripts');
  lines.push("import type { MapScriptData } from './types';");
  lines.push('');
  lines.push('export const data: MapScriptData = {');

  // mapScripts
  lines.push('  mapScripts: {');
  if (mapScripts.onLoad) {
    lines.push(`    onLoad: ${JSON.stringify(mapScripts.onLoad)},`);
  }
  if (mapScripts.onTransition) {
    lines.push(`    onTransition: ${JSON.stringify(mapScripts.onTransition)},`);
  }
  if (mapScripts.onResume) {
    lines.push(`    onResume: ${JSON.stringify(mapScripts.onResume)},`);
  }
  if (mapScripts.onFrame && mapScripts.onFrame.length > 0) {
    lines.push('    onFrame: [');
    for (const entry of mapScripts.onFrame) {
      lines.push(`      { var: ${JSON.stringify(entry.var)}, value: ${JSON.stringify(entry.value)}, script: ${JSON.stringify(entry.script)} },`);
    }
    lines.push('    ],');
  }
  if (mapScripts.onWarpInto && mapScripts.onWarpInto.length > 0) {
    lines.push('    onWarpInto: [');
    for (const entry of mapScripts.onWarpInto) {
      lines.push(`      { var: ${JSON.stringify(entry.var)}, value: ${JSON.stringify(entry.value)}, script: ${JSON.stringify(entry.script)} },`);
    }
    lines.push('    ],');
  }
  lines.push('  },');

  // scripts
  lines.push('  scripts: {');
  for (const [label, commands] of Object.entries(scripts)) {
    lines.push(`    ${JSON.stringify(label)}: [`);
    for (const cmd of commands) {
      if (cmd.args && cmd.args.length > 0) {
        const argsStr = cmd.args.map(a => JSON.stringify(a)).join(', ');
        lines.push(`      { cmd: ${JSON.stringify(cmd.cmd)}, args: [${argsStr}] },`);
      } else {
        lines.push(`      { cmd: ${JSON.stringify(cmd.cmd)} },`);
      }
    }
    lines.push('    ],');
  }
  lines.push('  },');

  // movements
  lines.push('  movements: {');
  for (const [label, steps] of Object.entries(movements)) {
    const stepsStr = steps.map(s => JSON.stringify(s)).join(', ');
    lines.push(`    ${JSON.stringify(label)}: [${stepsStr}],`);
  }
  lines.push('  },');

  // text
  lines.push('  text: {');
  for (const [label, str] of Object.entries(text)) {
    lines.push(`    ${JSON.stringify(label)}: ${JSON.stringify(str)},`);
  }
  lines.push('  },');

  lines.push('};');
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate the index.ts registry file.
 */
function generateIndexFile(mapNames) {
  const lines = [];
  lines.push('// Auto-generated script registry. DO NOT EDIT.');
  lines.push('// Regenerate with: npm run generate:scripts');
  lines.push("import type { MapScriptData } from './types';");
  lines.push('');
  lines.push('type ScriptModule = { data: MapScriptData };');
  lines.push('');
  lines.push('const scriptModules: Record<string, () => Promise<ScriptModule>> = {');
  for (const name of mapNames) {
    const constName = mapFolderToConstant(name);
    lines.push(`  ${JSON.stringify(constName)}: () => import('./${name}.gen'),`);
  }
  lines.push('};');
  lines.push('');
  lines.push('// Common scripts (shared across maps)');
  lines.push("const commonModule = () => import('./common.gen');");
  lines.push('');
  lines.push('// Cache loaded modules');
  lines.push('const cache = new Map<string, MapScriptData>();');
  lines.push('');
  lines.push('/**');
  lines.push(' * Load script data for a map. Returns null if no scripts exist.');
  lines.push(' */');
  lines.push('export async function getMapScripts(mapId: string): Promise<MapScriptData | null> {');
  lines.push('  if (cache.has(mapId)) return cache.get(mapId)!;');
  lines.push('  const loader = scriptModules[mapId];');
  lines.push('  if (!loader) return null;');
  lines.push('  const mod = await loader();');
  lines.push('  cache.set(mapId, mod.data);');
  lines.push('  return mod.data;');
  lines.push('}');
  lines.push('');
  lines.push('/**');
  lines.push(' * Load common/shared script data (movements, shared scripts).');
  lines.push(' */');
  lines.push('let commonCache: MapScriptData | null = null;');
  lines.push('export async function getCommonScripts(): Promise<MapScriptData> {');
  lines.push('  if (commonCache) return commonCache;');
  lines.push('  const mod = await commonModule();');
  lines.push('  commonCache = mod.data;');
  lines.push('  return mod.data;');
  lines.push('}');
  lines.push('');
  lines.push('/**');
  lines.push(' * Resolve a script label to its commands, searching map data then common.');
  lines.push(' */');
  lines.push('export async function resolveScript(');
  lines.push('  label: string,');
  lines.push('  mapId?: string');
  lines.push('): Promise<{ scripts: MapScriptData[\"scripts\"]; movements: MapScriptData[\"movements\"]; text: MapScriptData[\"text\"] } | null> {');
  lines.push('  const sources: MapScriptData[] = [];');
  lines.push('  if (mapId) {');
  lines.push('    const mapData = await getMapScripts(mapId);');
  lines.push('    if (mapData) sources.push(mapData);');
  lines.push('  }');
  lines.push('  sources.push(await getCommonScripts());');
  lines.push('');
  lines.push('  for (const src of sources) {');
  lines.push('    if (label in src.scripts) return src;');
  lines.push('  }');
  lines.push('  return null;');
  lines.push('}');
  lines.push('');
  lines.push('/** List of all registered map IDs */');
  lines.push('export const registeredMapIds = Object.keys(scriptModules);');
  lines.push('');

  return lines.join('\n');
}

/**
 * Main generation function.
 */
function generate() {
  console.log('Generating script data from pokeemerald .inc files...\n');

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const generatedMaps = [];
  let totalScripts = 0;
  let totalMovements = 0;
  let totalText = 0;

  // Discover all maps with scripts.inc
  const allMaps = discoverMaps();
  console.log(`Found ${allMaps.length} maps with scripts.inc\n`);

  // Process each map
  for (const mapName of allMaps) {
    const incPath = path.join(MAPS_DIR, mapName, 'scripts.inc');

    const content = fs.readFileSync(incPath, 'utf8');
    const parsed = parseIncFile(content);
    const mapScripts = buildMapScriptHeader(parsed.mapScriptEntries);

    const data = {
      mapScripts,
      scripts: parsed.scripts,
      movements: parsed.movements,
      text: parsed.text,
    };

    const scriptCount = Object.keys(data.scripts).length;
    const movementCount = Object.keys(data.movements).length;
    const textCount = Object.keys(data.text).length;
    totalScripts += scriptCount;
    totalMovements += movementCount;
    totalText += textCount;

    const tsContent = generateTsFile(mapName, data);
    const outPath = path.join(OUTPUT_DIR, `${mapName}.gen.ts`);
    fs.writeFileSync(outPath, tsContent);

    console.log(`  ${mapName}: ${scriptCount} scripts, ${movementCount} movements, ${textCount} text`);
    generatedMaps.push(mapName);
  }

  // Process all shared script files into common.gen.ts
  const sharedFiles = discoverSharedFiles();
  console.log(`\nProcessing ${sharedFiles.length} shared script files...`);
  const commonScripts = {};
  const commonMovements = {};
  const commonText = {};

  for (const fileName of sharedFiles) {
    const filePath = path.join(SHARED_SCRIPTS_DIR, fileName);

    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = parseIncFile(content);

    Object.assign(commonScripts, parsed.scripts);
    Object.assign(commonMovements, parsed.movements);
    Object.assign(commonText, parsed.text);

    const scriptCount = Object.keys(parsed.scripts).length;
    const movementCount = Object.keys(parsed.movements).length;
    const textCount = Object.keys(parsed.text).length;
    if (scriptCount + movementCount + textCount > 0) {
      console.log(`  ${fileName}: ${scriptCount} scripts, ${movementCount} movements, ${textCount} text`);
    }
  }

  // Parse all .inc files in data/text/ (trainer dialogue, berry NPCs, etc.)
  try {
    const textFiles = fs.readdirSync(SHARED_TEXT_DIR, { withFileTypes: true })
      .filter(e => e.isFile() && e.name.endsWith('.inc'))
      .map(e => e.name)
      .sort();
    console.log(`\nProcessing ${textFiles.length} text files from data/text/...`);
    for (const textFile of textFiles) {
      const textPath = path.join(SHARED_TEXT_DIR, textFile);
      const content = fs.readFileSync(textPath, 'utf8');
      const parsed = parseIncFile(content);
      const textCount = Object.keys(parsed.text).length;
      Object.assign(commonText, parsed.text);
      if (textCount > 0) {
        console.log(`  ${textFile}: ${textCount} text entries`);
      }
    }
  } catch (e) {
    console.warn('Warning: Could not read text directory:', e.message);
  }

  const commonData = {
    mapScripts: {},
    scripts: commonScripts,
    movements: commonMovements,
    text: commonText,
  };

  totalScripts += Object.keys(commonScripts).length;
  totalMovements += Object.keys(commonMovements).length;
  totalText += Object.keys(commonText).length;

  const commonTs = generateTsFile('common', commonData);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'common.gen.ts'), commonTs);

  // Generate index.ts
  const indexTs = generateIndexFile(generatedMaps);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.ts'), indexTs);

  console.log(`\nTotals: ${totalScripts} scripts, ${totalMovements} movements, ${totalText} text entries`);
  console.log(`Generated ${generatedMaps.length} map files + common.gen.ts + index.ts`);
  console.log(`Output: ${OUTPUT_DIR}`);
}

// Run
generate();
