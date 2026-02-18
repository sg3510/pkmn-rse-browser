#!/usr/bin/env node
/**
 * Generate wild encounter tables from pokeemerald source.
 *
 * Parses:
 * - public/pokeemerald/src/data/wild_encounters.json
 * - public/pokeemerald/include/constants/species.h
 *
 * Outputs:
 * - src/data/wildEncounters.gen.ts
 *
 * Usage: node scripts/generate-wild-encounters.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WILD_ENCOUNTERS_FILE = path.join(ROOT, 'public/pokeemerald/src/data/wild_encounters.json');
const SPECIES_FILE = path.join(ROOT, 'public/pokeemerald/include/constants/species.h');
const OUT_FILE = path.join(ROOT, 'src/data/wildEncounters.gen.ts');

const ENCOUNTER_KEY_MAP = {
  land_mons: 'land',
  water_mons: 'water',
  rock_smash_mons: 'rockSmash',
  fishing_mons: 'fishing',
};

function parseSpeciesIds(source) {
  const map = {};
  const re = /^#define\s+(SPECIES_\w+)\s+(\d+)\s*$/gm;
  let match;
  while ((match = re.exec(source)) !== null) {
    map[match[1]] = Number.parseInt(match[2], 10);
  }
  return map;
}

function getMapsGroup(groups) {
  return groups.find((group) => group && group.for_maps === true) ?? null;
}

function toTsObjectLiteral(value, indent = 0) {
  const pad = ' '.repeat(indent);
  const nextPad = ' '.repeat(indent + 2);

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const entries = value.map((entry) => `${nextPad}${toTsObjectLiteral(entry, indent + 2)}`);
    return `[\n${entries.join(',\n')}\n${pad}]`;
  }

  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return '{}';
    const entries = keys.map((key) => `${nextPad}${key}: ${toTsObjectLiteral(value[key], indent + 2)}`);
    return `{\n${entries.join(',\n')}\n${pad}}`;
  }

  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(Math.trunc(value)) : '0';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  return 'null';
}

function main() {
  const wildEncountersRaw = fs.readFileSync(WILD_ENCOUNTERS_FILE, 'utf8');
  const speciesRaw = fs.readFileSync(SPECIES_FILE, 'utf8');

  const speciesIds = parseSpeciesIds(speciesRaw);
  const wildData = JSON.parse(wildEncountersRaw);
  const mapsGroup = getMapsGroup(wildData.wild_encounter_groups ?? []);
  if (!mapsGroup) {
    throw new Error('No for_maps wild encounter group found in wild_encounters.json');
  }

  const slotRates = {
    land: [],
    water: [],
    rockSmash: [],
    fishing: [],
  };

  let fishingGroups = {
    oldRod: [0, 1],
    goodRod: [2, 3, 4],
    superRod: [5, 6, 7, 8, 9],
  };

  for (const field of mapsGroup.fields ?? []) {
    const key = ENCOUNTER_KEY_MAP[field.type];
    if (!key) continue;
    if (Array.isArray(field.encounter_rates)) {
      slotRates[key] = field.encounter_rates.map((n) => Math.max(0, Math.trunc(Number(n) || 0)));
    }
    if (field.type === 'fishing_mons' && field.groups) {
      fishingGroups = {
        oldRod: Array.isArray(field.groups.old_rod) ? field.groups.old_rod.map((n) => Math.trunc(Number(n) || 0)) : [0, 1],
        goodRod: Array.isArray(field.groups.good_rod) ? field.groups.good_rod.map((n) => Math.trunc(Number(n) || 0)) : [2, 3, 4],
        superRod: Array.isArray(field.groups.super_rod) ? field.groups.super_rod.map((n) => Math.trunc(Number(n) || 0)) : [5, 6, 7, 8, 9],
      };
    }
  }

  const mapEntries = {};
  let unresolvedSpecies = 0;

  for (const entry of mapsGroup.encounters ?? []) {
    const mapId = String(entry.map || '').trim();
    if (!mapId) continue;

    const outEntry = { mapId };
    for (const [rawKey, tsKey] of Object.entries(ENCOUNTER_KEY_MAP)) {
      const block = entry[rawKey];
      if (!block || !Array.isArray(block.mons)) continue;

      const slots = [];
      for (const mon of block.mons) {
        const speciesName = String(mon.species || '');
        const species = speciesIds[speciesName] ?? 0;
        if (species === 0) unresolvedSpecies++;
        slots.push({
          species,
          minLevel: Math.max(1, Math.trunc(Number(mon.min_level) || 1)),
          maxLevel: Math.max(1, Math.trunc(Number(mon.max_level) || 1)),
        });
      }

      outEntry[tsKey] = {
        encounterRate: Math.max(0, Math.trunc(Number(block.encounter_rate) || 0)),
        slots,
      };
    }

    mapEntries[mapId] = outEntry;
  }

  const mapIds = Object.keys(mapEntries).sort();
  let out = '';
  out += '// Auto-generated — do not edit\n';
  out += '// Source: public/pokeemerald/src/data/wild_encounters.json\n';
  out += '// Regenerate: node scripts/generate-wild-encounters.cjs\n\n';

  out += "export type WildEncounterType = 'land' | 'water' | 'rockSmash' | 'fishing';\n\n";
  out += 'export interface WildEncounterSlot {\n';
  out += '  species: number;\n';
  out += '  minLevel: number;\n';
  out += '  maxLevel: number;\n';
  out += '}\n\n';
  out += 'export interface WildEncounterTable {\n';
  out += '  encounterRate: number;\n';
  out += '  slots: WildEncounterSlot[];\n';
  out += '}\n\n';
  out += 'export interface MapWildEncounterData {\n';
  out += '  mapId: string;\n';
  out += '  land?: WildEncounterTable;\n';
  out += '  water?: WildEncounterTable;\n';
  out += '  rockSmash?: WildEncounterTable;\n';
  out += '  fishing?: WildEncounterTable;\n';
  out += '}\n\n';
  out += 'export interface FishingSlotGroups {\n';
  out += '  oldRod: number[];\n';
  out += '  goodRod: number[];\n';
  out += '  superRod: number[];\n';
  out += '}\n\n';

  out += '/** Slot-rate distributions (percent weights) from wild_encounters.json fields. */\n';
  out += `export const WILD_ENCOUNTER_SLOT_RATES = ${toTsObjectLiteral(slotRates, 0)} as const;\n\n`;
  out += '/** Fishing rod to slot-index groups from wild_encounters.json fields. */\n';
  out += `export const WILD_FISHING_SLOT_GROUPS: FishingSlotGroups = ${toTsObjectLiteral(fishingGroups, 0)};\n\n`;

  out += '/** Wild encounter tables indexed by map ID. */\n';
  out += 'export const MAP_WILD_ENCOUNTERS: Record<string, MapWildEncounterData> = {\n';
  for (const mapId of mapIds) {
    const literal = toTsObjectLiteral(mapEntries[mapId], 2);
    out += `  ${JSON.stringify(mapId)}: ${literal},\n`;
  }
  out += '};\n\n';

  out += 'export function getMapWildEncounterData(mapId: string): MapWildEncounterData | undefined {\n';
  out += '  return MAP_WILD_ENCOUNTERS[mapId];\n';
  out += '}\n';

  fs.writeFileSync(OUT_FILE, out, 'utf8');
  console.log(`[generate-wild-encounters] Parsed ${mapIds.length} map encounter tables`);
  if (unresolvedSpecies > 0) {
    console.warn(`[generate-wild-encounters] Warning: unresolved species references: ${unresolvedSpecies}`);
  }
  console.log(`[generate-wild-encounters] Wrote ${path.relative(ROOT, OUT_FILE)}`);
}

main();
