#!/usr/bin/env node
/**
 * Audit script-label resolution parity.
 *
 * Verifies:
 * - Cross-map script label ownership collisions (ambiguous owner) are zero.
 * - Script references from map JSON events resolve via:
 *   1) local map scripts
 *   2) common scripts
 *   3) generated cross-map owner fallback
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MAPS_DIR = path.join(ROOT, 'public/pokeemerald/data/maps');
const GENERATED_SCRIPTS_DIR = path.join(ROOT, 'src/data/scripts');

function mapFolderToConstant(folder) {
  return 'MAP_' + folder
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toUpperCase();
}

function parseGeneratedScriptLabels(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const scriptsBlock = content.match(/scripts:\s*\{([\s\S]*?)\n\s*},\n\s*movements:/m);
  if (!scriptsBlock) return new Set();

  const labels = new Set();
  const regex = /"([^"]+)":\s*\[/g;
  let match;
  while ((match = regex.exec(scriptsBlock[1])) !== null) {
    labels.add(match[1]);
  }
  return labels;
}

function normalizeScriptLabel(rawValue) {
  if (typeof rawValue !== 'string') return null;
  const label = rawValue.trim();
  if (!label) return null;
  if (label === '0' || label === '0x0' || label === 'NULL') return null;
  return label;
}

function collectScriptRefsFromMapJson(folderName, mapJson) {
  const refs = [];
  const mapId = mapFolderToConstant(folderName);
  const eventsRoot = mapJson.events ?? mapJson;

  const objectEvents = Array.isArray(eventsRoot.object_events) ? eventsRoot.object_events : [];
  for (const event of objectEvents) {
    const label = normalizeScriptLabel(event?.script);
    if (!label) continue;
    refs.push({
      mapId,
      label,
      source: 'object_event',
    });
  }

  const coordEvents = Array.isArray(eventsRoot.coord_events) ? eventsRoot.coord_events : [];
  for (const event of coordEvents) {
    const label = normalizeScriptLabel(event?.script);
    if (!label) continue;
    refs.push({
      mapId,
      label,
      source: 'coord_event',
    });
  }

  const bgEvents = Array.isArray(eventsRoot.bg_events) ? eventsRoot.bg_events : [];
  for (const event of bgEvents) {
    const label = normalizeScriptLabel(event?.script);
    if (!label) continue;
    refs.push({
      mapId,
      label,
      source: 'bg_event',
    });
  }

  return refs;
}

function readMapFolders() {
  return fs.readdirSync(MAPS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function buildGeneratedLabelIndexes(mapFolders) {
  const labelsByMap = new Map();
  const ownerByLabel = new Map();
  const collisionsByLabel = new Map();

  for (const folder of mapFolders) {
    const mapId = mapFolderToConstant(folder);
    const genPath = path.join(GENERATED_SCRIPTS_DIR, `${folder}.gen.ts`);
    if (!fs.existsSync(genPath)) {
      labelsByMap.set(mapId, new Set());
      continue;
    }

    const labels = parseGeneratedScriptLabels(genPath);
    labelsByMap.set(mapId, labels);

    for (const label of labels) {
      const existingOwner = ownerByLabel.get(label);
      if (!existingOwner) {
        ownerByLabel.set(label, mapId);
        continue;
      }
      if (existingOwner === mapId) continue;

      if (!collisionsByLabel.has(label)) {
        collisionsByLabel.set(label, new Set([existingOwner]));
      }
      collisionsByLabel.get(label).add(mapId);
    }
  }

  return { labelsByMap, ownerByLabel, collisionsByLabel };
}

function main() {
  const mapFolders = readMapFolders();
  const { labelsByMap, ownerByLabel, collisionsByLabel } = buildGeneratedLabelIndexes(mapFolders);
  const commonLabels = parseGeneratedScriptLabels(path.join(GENERATED_SCRIPTS_DIR, 'common.gen.ts'));

  const refs = [];
  for (const folder of mapFolders) {
    const mapJsonPath = path.join(MAPS_DIR, folder, 'map.json');
    if (!fs.existsSync(mapJsonPath)) continue;
    const mapJson = JSON.parse(fs.readFileSync(mapJsonPath, 'utf8'));
    refs.push(...collectScriptRefsFromMapJson(folder, mapJson));
  }

  const unresolved = [];
  for (const ref of refs) {
    const localLabels = labelsByMap.get(ref.mapId) ?? new Set();
    if (localLabels.has(ref.label)) continue;
    if (commonLabels.has(ref.label)) continue;
    if (ownerByLabel.has(ref.label)) continue;
    unresolved.push(ref);
  }

  const collisions = [...collisionsByLabel.entries()]
    .map(([label, owners]) => ({ label, owners: [...owners].sort() }))
    .sort((a, b) => a.label.localeCompare(b.label));

  console.log('[audit:scripts:resolution] summary');
  console.log(`  maps scanned: ${mapFolders.length}`);
  console.log(`  map event refs checked: ${refs.length}`);
  console.log(`  unique owner labels: ${ownerByLabel.size}`);
  console.log(`  owner collisions: ${collisions.length}`);
  console.log(`  unresolved refs: ${unresolved.length}`);

  if (collisions.length > 0) {
    console.error('\n[audit:scripts:resolution] label owner collisions detected (first 25):');
    for (const collision of collisions.slice(0, 25)) {
      console.error(`  ${collision.label} -> ${collision.owners.join(', ')}`);
    }
  }

  if (unresolved.length > 0) {
    console.error('\n[audit:scripts:resolution] unresolved map event script refs (first 50):');
    for (const ref of unresolved.slice(0, 50)) {
      console.error(`  ${ref.mapId} [${ref.source}] -> ${ref.label}`);
    }
  }

  if (collisions.length > 0 || unresolved.length > 0) {
    process.exit(1);
  }
}

main();
