#!/usr/bin/env node
/**
 * Validate battle sprite sheet dimensions for runtime compatibility.
 *
 * Rules enforced:
 * - Pokemon front/back sprites: 64px wide, height multiple of 64px
 * - Trainer back sprites: 64px wide, height multiple of 64px
 * - Pokeball strip: 16px wide, height multiple of 16px
 * - Enemy shadow sprite: 32x8
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const POKEMON_DIR = path.join(ROOT, 'public/pokeemerald/graphics/pokemon');
const TRAINER_BACK_DIR = path.join(ROOT, 'public/pokeemerald/graphics/trainers/back_pics');
const POKEBALL_FILE = path.join(ROOT, 'public/pokeemerald/graphics/balls/poke.png');
const ENEMY_SHADOW_FILE = path.join(ROOT, 'public/pokeemerald/graphics/battle_interface/enemy_mon_shadow.png');

let errorCount = 0;
let checkedCount = 0;

function readPngDimensions(filePath) {
  const data = fs.readFileSync(filePath);
  const pngSignature = '89504e470d0a1a0a';
  if (data.length < 24 || data.subarray(0, 8).toString('hex') !== pngSignature) {
    throw new Error(`Not a valid PNG file: ${filePath}`);
  }
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
  };
}

function validateSheet(filePath, expectedWidth, frameHeight, label) {
  const { width, height } = readPngDimensions(filePath);
  checkedCount++;

  if (width !== expectedWidth) {
    console.error(`[ERROR] ${label}: expected width ${expectedWidth}, got ${width} (${filePath})`);
    errorCount++;
  }

  if (height < frameHeight || height % frameHeight !== 0) {
    console.error(
      `[ERROR] ${label}: expected height multiple of ${frameHeight}, got ${height} (${filePath})`,
    );
    errorCount++;
  }
}

function validateExact(filePath, expectedWidth, expectedHeight, label) {
  const { width, height } = readPngDimensions(filePath);
  checkedCount++;
  if (width !== expectedWidth || height !== expectedHeight) {
    console.error(
      `[ERROR] ${label}: expected ${expectedWidth}x${expectedHeight}, got ${width}x${height} (${filePath})`,
    );
    errorCount++;
  }
}

function walkPngFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  return fs.readdirSync(dirPath)
    .filter((entry) => entry.toLowerCase().endsWith('.png'))
    .map((entry) => path.join(dirPath, entry));
}

function validatePokemonSprites() {
  const entries = fs.readdirSync(POKEMON_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(POKEMON_DIR, entry.name);
    const front = path.join(dir, 'front.png');
    const back = path.join(dir, 'back.png');
    if (fs.existsSync(front)) {
      validateSheet(front, 64, 64, `pokemon/${entry.name}/front.png`);
    }
    if (fs.existsSync(back)) {
      validateSheet(back, 64, 64, `pokemon/${entry.name}/back.png`);
    }
  }
}

function main() {
  validatePokemonSprites();

  for (const trainerPng of walkPngFiles(TRAINER_BACK_DIR)) {
    const base = path.basename(trainerPng);
    validateSheet(trainerPng, 64, 64, `trainers/back_pics/${base}`);
  }

  if (fs.existsSync(POKEBALL_FILE)) {
    validateSheet(POKEBALL_FILE, 16, 16, 'balls/poke.png');
  }

  if (fs.existsSync(ENEMY_SHADOW_FILE)) {
    validateExact(ENEMY_SHADOW_FILE, 32, 8, 'battle_interface/enemy_mon_shadow.png');
  }

  if (errorCount === 0) {
    console.log(`[validate:battle-sprites] OK (${checkedCount} files checked)`);
    return;
  }

  console.error(`[validate:battle-sprites] FAILED with ${errorCount} error(s) across ${checkedCount} files.`);
  process.exitCode = 1;
}

main();
