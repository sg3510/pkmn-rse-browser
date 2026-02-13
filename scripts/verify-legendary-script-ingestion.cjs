#!/usr/bin/env node
/**
 * Verifies that critical legendary encounter script labels are present in generated script outputs.
 *
 * This is a non-mutating parity gate for script ingestion.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const REQUIRED_LABELS = [
  {
    file: 'src/data/scripts/BirthIsland_Exterior.gen.ts',
    label: 'BirthIsland_Exterior_EventScript_Triangle',
  },
  {
    file: 'src/data/scripts/FarawayIsland_Interior.gen.ts',
    label: 'FarawayIsland_Interior_EventScript_Mew',
  },
  {
    file: 'src/data/scripts/NavelRock_Top.gen.ts',
    label: 'NavelRock_Top_EventScript_HoOh',
  },
  {
    file: 'src/data/scripts/NavelRock_Bottom.gen.ts',
    label: 'NavelRock_Bottom_EventScript_Lugia',
  },
  {
    file: 'src/data/scripts/SouthernIsland_Interior.gen.ts',
    label: 'SouthernIsland_Interior_EventScript_Lati',
  },
  {
    file: 'src/data/scripts/common.gen.ts',
    label: 'Common_EventScript_LegendaryFlewAway',
  },
];

let hasFailure = false;

for (const entry of REQUIRED_LABELS) {
  const filePath = path.join(ROOT, entry.file);
  if (!fs.existsSync(filePath)) {
    console.error(`[LegendaryScriptGate] Missing generated file: ${entry.file}`);
    hasFailure = true;
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const labelToken = `"${entry.label}": [`;
  if (!content.includes(labelToken)) {
    console.error(`[LegendaryScriptGate] Missing label ${entry.label} in ${entry.file}`);
    hasFailure = true;
    continue;
  }

  console.log(`[LegendaryScriptGate] OK ${entry.label} (${entry.file})`);
}

if (hasFailure) {
  process.exit(1);
}

console.log('[LegendaryScriptGate] All required legendary script labels are present.');

