#!/usr/bin/env node
/**
 * Generate Species Data from pokeemerald source
 *
 * Parses:
 *   - public/pokeemerald/include/constants/species.h (SPECIES_* constants)
 *   - public/pokeemerald/src/data/text/species_names.h (display names)
 *   - public/pokeemerald/graphics/pokemon/ (icon folder names)
 *
 * Outputs:
 *   - src/data/species.ts (species constants, names, icon paths)
 *
 * Usage: node scripts/generate-species-data.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SPECIES_CONSTANTS_FILE = path.join(ROOT, 'public/pokeemerald/include/constants/species.h');
const SPECIES_NAMES_FILE = path.join(ROOT, 'public/pokeemerald/src/data/text/species_names.h');
const POKEMON_GRAPHICS_DIR = path.join(ROOT, 'public/pokeemerald/graphics/pokemon');
const OUTPUT_FILE = path.join(ROOT, 'src/data/species.ts');

/**
 * Parse species.h to extract SPECIES_* constants
 * Format: #define SPECIES_NAME 123
 */
function parseSpeciesConstants(content) {
  const constants = new Map();
  const regex = /#define\s+(SPECIES_\w+)\s+(\d+)/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const name = match[1];
    const id = parseInt(match[2], 10);

    // Skip special/internal species
    if (name.startsWith('SPECIES_OLD_UNOWN_') ||
        name === 'SPECIES_EGG' ||
        name === 'NUM_SPECIES') {
      continue;
    }

    constants.set(name, id);
  }

  return constants;
}

/**
 * Parse species_names.h to extract display names
 * Format: [SPECIES_NAME] = _("DISPLAY NAME"),
 */
function parseSpeciesNames(content) {
  const names = new Map();
  const regex = /\[(SPECIES_\w+)\]\s*=\s*_\("([^"]+)"\)/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const speciesKey = match[1];
    const displayName = match[2];
    names.set(speciesKey, displayName);
  }

  return names;
}

/**
 * Get list of Pokemon icon folder names
 */
function getIconFolders() {
  const folders = new Map();

  try {
    const entries = fs.readdirSync(POKEMON_GRAPHICS_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Check if icon.png exists
        const iconPath = path.join(POKEMON_GRAPHICS_DIR, entry.name, 'icon.png');
        if (fs.existsSync(iconPath)) {
          // Normalize folder name to uppercase for matching
          const normalizedName = entry.name.toUpperCase().replace(/_/g, '_');
          folders.set(normalizedName, entry.name);
        }
      }
    }
  } catch (e) {
    console.error('Error reading pokemon graphics directory:', e.message);
  }

  return folders;
}

/**
 * Convert SPECIES_NAME to folder name
 * e.g., SPECIES_BULBASAUR -> bulbasaur
 *       SPECIES_NIDORAN_F -> nidoran_f
 *       SPECIES_MR_MIME -> mr_mime
 */
function speciesKeyToFolderName(speciesKey) {
  // Remove SPECIES_ prefix and convert to lowercase
  return speciesKey.replace('SPECIES_', '').toLowerCase();
}

/**
 * Main generation function
 */
function generate() {
  console.log('Generating species data from pokeemerald source...\n');

  // Read source files
  const constantsContent = fs.readFileSync(SPECIES_CONSTANTS_FILE, 'utf8');
  const namesContent = fs.readFileSync(SPECIES_NAMES_FILE, 'utf8');

  // Parse
  const speciesConstants = parseSpeciesConstants(constantsContent);
  console.log(`Parsed ${speciesConstants.size} species constants`);

  const speciesNames = parseSpeciesNames(namesContent);
  console.log(`Parsed ${speciesNames.size} species names`);

  const iconFolders = getIconFolders();
  console.log(`Found ${iconFolders.size} Pokemon icon folders`);

  // Build species data array
  const speciesData = [];
  let missingIcons = 0;
  let missingNames = 0;

  for (const [speciesKey, id] of speciesConstants) {
    const displayName = speciesNames.get(speciesKey) || speciesKey.replace('SPECIES_', '');
    const folderName = speciesKeyToFolderName(speciesKey);

    // Check if icon folder exists
    const hasIcon = iconFolders.has(folderName.toUpperCase()) ||
                    fs.existsSync(path.join(POKEMON_GRAPHICS_DIR, folderName, 'icon.png'));

    if (!hasIcon && id > 0 && id < 412) {
      missingIcons++;
      // console.warn(`  Missing icon for: ${speciesKey} (${folderName})`);
    }

    if (!speciesNames.has(speciesKey) && id > 0) {
      missingNames++;
    }

    speciesData.push({
      id,
      key: speciesKey,
      name: displayName,
      folder: hasIcon ? folderName : null,
    });
  }

  // Sort by ID
  speciesData.sort((a, b) => a.id - b.id);

  console.log(`\nMatched ${speciesData.length} species`);
  if (missingIcons > 0) console.log(`Missing icons: ${missingIcons}`);
  if (missingNames > 0) console.log(`Missing names: ${missingNames}`);

  // Generate TypeScript output
  const output = `/**
 * Species Data
 *
 * Auto-generated from pokeemerald source files:
 *   - public/pokeemerald/include/constants/species.h
 *   - public/pokeemerald/src/data/text/species_names.h
 *
 * DO NOT EDIT MANUALLY - regenerate with: npm run generate:species
 *
 * Generated: ${new Date().toISOString()}
 */

// Species ID constants
export const SPECIES = {
${speciesData.map(s => `  ${s.key.replace('SPECIES_', '')}: ${s.id},`).join('\n')}
} as const;

export type SpeciesId = typeof SPECIES[keyof typeof SPECIES];

// Total species count (excluding special entries)
export const NUM_SPECIES = 412;

// Species display names (index by species ID)
export const SPECIES_NAMES: Record<number, string> = {
${speciesData.filter(s => s.id <= 411).map(s => `  ${s.id}: ${JSON.stringify(s.name)},`).join('\n')}
};

// Species ID to icon folder mapping
// Returns folder name for /pokeemerald/graphics/pokemon/{folder}/icon.png
const SPECIES_ICON_FOLDERS: Record<number, string> = {
${speciesData.filter(s => s.folder).map(s => `  ${s.id}: ${JSON.stringify(s.folder)},`).join('\n')}
};

/**
 * Get species display name
 */
export function getSpeciesName(speciesId: number): string {
  return SPECIES_NAMES[speciesId] ?? '?????';
}

/**
 * Get Pokemon icon path for a species
 * Icons are 32x64 (2 frames stacked vertically)
 */
export function getPokemonIconPath(speciesId: number): string {
  const folder = SPECIES_ICON_FOLDERS[speciesId];
  if (!folder) {
    return '/pokeemerald/graphics/pokemon/egg/icon.png';
  }
  return \`/pokeemerald/graphics/pokemon/\${folder}/icon.png\`;
}

/**
 * Check if a species has a valid icon
 */
export function hasSpeciesIcon(speciesId: number): boolean {
  return speciesId in SPECIES_ICON_FOLDERS;
}
`;

  // Write output
  fs.writeFileSync(OUTPUT_FILE, output);
  console.log(`\nWrote ${OUTPUT_FILE}`);
}

// Run
generate();
