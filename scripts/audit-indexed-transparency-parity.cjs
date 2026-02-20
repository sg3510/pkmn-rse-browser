#!/usr/bin/env node
/**
 * Audit indexed transparency parity for overworld sprite assets.
 *
 * Reports assets where top-left palette index != 0 (these break with pure top-left keying)
 * and verifies critical loaders are configured to use indexed-zero transparency.
 */

const fs = require('fs');
const path = require('path');
const UPNG = require('upng-js');

const ROOT = path.resolve(__dirname, '..');

const CRITICAL_ASSET_DIRS = [
  'public/pokeemerald/graphics/field_effects/pics',
  'public/pokeemerald/graphics/weather',
  'public/pokeemerald/graphics/object_events/pics/people',
  'public/pokeemerald/graphics/object_events/pics/misc',
];

const REQUIRED_INDEXED_ZERO_LOADERS = [
  'src/hooks/useFieldSprites.ts',
  'src/weather/assets.ts',
  'src/game/PlayerController.ts',
  'src/game/npc/NPCSpriteLoader.ts',
  'src/pages/gamePage/overworldAssets.ts',
  'src/utils/assetLoader.ts',
];

function listPngFilesRecursive(dirPath) {
  const out = [];
  if (!fs.existsSync(dirPath)) return out;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      out.push(...listPngFilesRecursive(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
      out.push(fullPath);
    }
  }
  return out;
}

function getTopLeftPaletteIndex(image) {
  const packed = image.data instanceof Uint8Array ? image.data : new Uint8Array(image.data);
  if (packed.length === 0) return null;

  switch (image.depth) {
    case 8:
      return packed[0];
    case 4:
      return (packed[0] >> 4) & 0x0f;
    case 2:
      return (packed[0] >> 6) & 0x03;
    case 1:
      return (packed[0] >> 7) & 0x01;
    default:
      return null;
  }
}

function auditAssetMismatches() {
  const mismatches = [];
  const scanned = [];

  for (const relativeDir of CRITICAL_ASSET_DIRS) {
    const absDir = path.join(ROOT, relativeDir);
    for (const filePath of listPngFilesRecursive(absDir)) {
      const relPath = path.relative(ROOT, filePath);
      scanned.push(relPath);
      const buffer = fs.readFileSync(filePath);
      const decoded = UPNG.decode(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
      if (decoded.ctype !== 3) continue;
      const topLeftIndex = getTopLeftPaletteIndex(decoded);
      if (topLeftIndex == null) continue;
      if (topLeftIndex !== 0) {
        mismatches.push({
          path: relPath,
          depth: decoded.depth,
          topLeftIndex,
        });
      }
    }
  }

  mismatches.sort((a, b) => a.path.localeCompare(b.path));
  scanned.sort((a, b) => a.localeCompare(b));

  return { scanned, mismatches };
}

function auditLoaderConfig() {
  const missing = [];
  for (const relativePath of REQUIRED_INDEXED_ZERO_LOADERS) {
    const absPath = path.join(ROOT, relativePath);
    if (!fs.existsSync(absPath)) {
      missing.push(`${relativePath} (missing file)`);
      continue;
    }
    const content = fs.readFileSync(absPath, 'utf8');
    if (!content.includes('indexed-zero')) {
      missing.push(relativePath);
    }
  }
  return missing;
}

function main() {
  const { scanned, mismatches } = auditAssetMismatches();
  const missingLoaderConfig = auditLoaderConfig();

  console.log('[audit:transparency:indexed] summary');
  console.log(`  critical PNG assets scanned: ${scanned.length}`);
  console.log(`  top-left-index!=0 mismatches: ${mismatches.length}`);
  console.log(`  loaders missing indexed-zero mode: ${missingLoaderConfig.length}`);

  if (mismatches.length > 0) {
    console.log('\n[audit:transparency:indexed] top-left vs index-0 mismatches (first 60):');
    for (const mismatch of mismatches.slice(0, 60)) {
      console.log(`  ${mismatch.path} (depth=${mismatch.depth}, topLeftIndex=${mismatch.topLeftIndex})`);
    }
  }

  if (missingLoaderConfig.length > 0) {
    console.error('\n[audit:transparency:indexed] loaders without indexed-zero configuration:');
    for (const file of missingLoaderConfig) {
      console.error(`  ${file}`);
    }
    process.exit(1);
  }
}

main();
