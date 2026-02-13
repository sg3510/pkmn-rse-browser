/**
 * Deoxys rock scripted palette runtime.
 *
 * C references:
 * - public/pokeemerald/src/field_specials.c (sDeoxysRockPalettes / SetDeoxysRockPalette)
 * - public/pokeemerald/graphics/field_effects/palettes/deoxys_rock_*.pal
 */

import UPNG from 'upng-js';
import { loadBinary, loadText, parsePalette } from '../../utils/mapLoader';

const DEOXYS_ROCK_LEVEL_COUNT = 11;
const DEOXYS_ROCK_SPRITE_PATH = '/pokeemerald/graphics/object_events/pics/misc/birth_island_stone.png';
const DEOXYS_ROCK_PALETTE_PATH_PREFIX = '/pokeemerald/graphics/field_effects/palettes/deoxys_rock_';

let cachedVariantsPromise: Promise<ReadonlyArray<HTMLCanvasElement>> | null = null;

function clampRockLevel(level: number): number {
  const normalized = Number.isFinite(level) ? Math.trunc(level) : 0;
  return Math.max(0, Math.min(DEOXYS_ROCK_LEVEL_COUNT - 1, normalized));
}

function toUint8Array(data: ArrayBufferLike | Uint8Array): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  return new Uint8Array(data);
}

function unpackIndexedPixels(
  packedPixels: Uint8Array,
  width: number,
  height: number,
  depth: number
): Uint8Array {
  const pixelCount = width * height;
  if (depth === 8) {
    if (packedPixels.length >= pixelCount) {
      return packedPixels.subarray(0, pixelCount);
    }
    throw new Error('Indexed PNG has fewer pixels than expected');
  }

  if (depth === 4) {
    const unpacked = new Uint8Array(pixelCount);
    let out = 0;
    for (let i = 0; i < packedPixels.length && out < pixelCount; i++) {
      const byte = packedPixels[i];
      unpacked[out++] = (byte >> 4) & 0x0f;
      if (out < pixelCount) {
        unpacked[out++] = byte & 0x0f;
      }
    }
    if (out < pixelCount) {
      throw new Error('4bpp indexed PNG decode underflow');
    }
    return unpacked;
  }

  throw new Error(`Unsupported indexed PNG bit depth: ${depth}`);
}

function parseHexColor(color: string): { r: number; g: number; b: number } {
  const hex = color.startsWith('#') ? color.slice(1) : color;
  const normalized = hex.length === 6 ? hex : '000000';
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function renderIndexedSpriteWithPalette(
  indexedPixels: Uint8Array,
  width: number,
  height: number,
  paletteColors: readonly string[]
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) {
    throw new Error('Failed to create canvas context for Deoxys rock palette render');
  }

  const imageData = ctx.createImageData(width, height);
  const output = imageData.data;
  for (let i = 0; i < indexedPixels.length; i++) {
    const paletteIndex = indexedPixels[i];
    const outOffset = i * 4;
    if (paletteIndex === 0) {
      output[outOffset + 3] = 0;
      continue;
    }

    const color = parseHexColor(paletteColors[paletteIndex] ?? '#000000');
    output[outOffset] = color.r;
    output[outOffset + 1] = color.g;
    output[outOffset + 2] = color.b;
    output[outOffset + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

async function loadDeoxysRockPalettes(): Promise<ReadonlyArray<readonly string[]>> {
  const palettes: string[][] = [];
  for (let level = 1; level <= DEOXYS_ROCK_LEVEL_COUNT; level++) {
    const text = await loadText(`${DEOXYS_ROCK_PALETTE_PATH_PREFIX}${level}.pal`);
    const parsed = parsePalette(text);
    const colors = Array.from({ length: 16 }, (_, i) => parsed.colors[i] ?? '#000000');
    palettes.push(colors);
  }
  return palettes;
}

async function buildDeoxysRockVariants(): Promise<ReadonlyArray<HTMLCanvasElement>> {
  const [spriteBuffer, palettes] = await Promise.all([
    loadBinary(DEOXYS_ROCK_SPRITE_PATH),
    loadDeoxysRockPalettes(),
  ]);

  const decoded = UPNG.decode(spriteBuffer);
  if (decoded.ctype !== 3) {
    throw new Error('Deoxys rock sprite must be indexed-color PNG for exact palette parity');
  }
  const packedPixels = toUint8Array(decoded.data);
  const indexedPixels = unpackIndexedPixels(packedPixels, decoded.width, decoded.height, decoded.depth);

  const variants: HTMLCanvasElement[] = [];
  for (let level = 0; level < DEOXYS_ROCK_LEVEL_COUNT; level++) {
    const palette = palettes[level];
    variants.push(renderIndexedSpriteWithPalette(indexedPixels, decoded.width, decoded.height, palette));
  }
  return variants;
}

export async function getDeoxysRockPaletteCanvas(level: number): Promise<HTMLCanvasElement | null> {
  try {
    if (!cachedVariantsPromise) {
      cachedVariantsPromise = buildDeoxysRockVariants();
    }
    const variants = await cachedVariantsPromise;
    return variants[clampRockLevel(level)] ?? null;
  } catch (error) {
    console.warn('[DeoxysRockPalette] Failed to build exact palette variants:', error);
    cachedVariantsPromise = null;
    return null;
  }
}
