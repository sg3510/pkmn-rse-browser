/**
 * GBA text-background tilemap helpers.
 *
 * Used by battle/title/intro style screens that decode 16-bit tilemap entries
 * and composite 8x8 tilesets onto a canvas.
 *
 * Entry format (GBA text BG):
 * - bits 0-9: tile index
 * - bit 10: h-flip
 * - bit 11: v-flip
 * - bits 12-15: palette index
 */
import { makeCanvasTransparent, type TransparencyMode } from '../utils/assetLoader';

export interface GbaBgTilemapEntry {
  raw: number;
  tileIndex: number;
  hFlip: boolean;
  vFlip: boolean;
  palette: number;
}

export type GbaTilemapLayoutMode = 'linear' | 'screenblock';

export interface IndexedGbaTilesetSource {
  kind: 'indexed';
  pixels: Uint8Array;
  width: number;
  height: number;
}

export type GbaTilemapSource = CanvasImageSource | IndexedGbaTilesetSource;

export interface DrawGbaTilemapOptions {
  mapWidthTiles: number;
  mapHeightTiles: number;
  tileSize?: number;
  visibleWidthPx?: number;
  visibleHeightPx?: number;
  transparency?: TransparencyMode;
  // If true, entries that are exactly 0x0000 are skipped entirely.
  skipZeroEntries?: boolean;
  // Default is linear row-major indexing for compatibility.
  layoutMode?: GbaTilemapLayoutMode;
  // Palette banks for indexed tilesets, where each bank contains up to 16 colors.
  paletteBanks?: ReadonlyArray<ReadonlyArray<string>>;
  // GBA BG palette base index; battle backgrounds use bank 2 (BG_PLTT_ID(2)).
  paletteBankOffset?: number;
  // Treat color index 0 as transparent when drawing indexed tiles.
  transparentColorIndexZero?: boolean;
}

const DEFAULT_TILE_SIZE = 8;
const SCREENBLOCK_SIZE_TILES = 32;
const TILEMAP_ENTRY_MASK = 0xffff;

interface RgbaColor {
  r: number;
  g: number;
  b: number;
}

function getSourceWidth(source: CanvasImageSource): number {
  if ('width' in source && typeof source.width === 'number') {
    return source.width;
  }
  return 0;
}

function getSourceHeight(source: CanvasImageSource): number {
  if ('height' in source && typeof source.height === 'number') {
    return source.height;
  }
  return 0;
}

function isIndexedTilesetSource(source: GbaTilemapSource): source is IndexedGbaTilesetSource {
  return (
    typeof source === 'object'
    && source !== null
    && 'kind' in source
    && source.kind === 'indexed'
  );
}

function asTransparentSource(
  source: CanvasImageSource,
  transparency?: TransparencyMode,
): CanvasImageSource {
  if (!transparency || transparency.type === 'none') {
    return source;
  }

  const width = getSourceWidth(source);
  const height = getSourceHeight(source);
  if (width <= 0 || height <= 0) {
    return source;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return source;
  }

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0);
  return makeCanvasTransparent(canvas, transparency);
}

function resolveMapEntryIndex(
  tileX: number,
  tileY: number,
  mapWidthTiles: number,
  layoutMode: GbaTilemapLayoutMode,
): number {
  if (layoutMode !== 'screenblock') {
    return tileY * mapWidthTiles + tileX;
  }

  const blockX = Math.floor(tileX / SCREENBLOCK_SIZE_TILES);
  const blockY = Math.floor(tileY / SCREENBLOCK_SIZE_TILES);
  const blocksPerRow = Math.max(1, Math.ceil(mapWidthTiles / SCREENBLOCK_SIZE_TILES));
  const tileInBlockX = tileX % SCREENBLOCK_SIZE_TILES;
  const tileInBlockY = tileY % SCREENBLOCK_SIZE_TILES;
  const blockTileBase = (blockY * blocksPerRow + blockX) * (SCREENBLOCK_SIZE_TILES * SCREENBLOCK_SIZE_TILES);

  return blockTileBase + (tileInBlockY * SCREENBLOCK_SIZE_TILES) + tileInBlockX;
}

function parseHexColor(hex: string): RgbaColor | null {
  const normalized = hex.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

function normalizePaletteBanks(
  paletteBanks: ReadonlyArray<ReadonlyArray<string>> | undefined,
): RgbaColor[][] {
  if (!paletteBanks || paletteBanks.length === 0) {
    return [];
  }

  return paletteBanks.map((bank) => {
    const out: RgbaColor[] = new Array(16);
    for (let i = 0; i < 16; i++) {
      const parsed = i < bank.length ? parseHexColor(bank[i]) : null;
      out[i] = parsed ?? { r: 0, g: 0, b: 0 };
    }
    return out;
  });
}

function drawIndexedGbaBgTilemap(
  ctx: CanvasRenderingContext2D,
  tileset: IndexedGbaTilesetSource,
  mapEntries: ArrayLike<number>,
  options: DrawGbaTilemapOptions,
): void {
  const tileSize = options.tileSize ?? DEFAULT_TILE_SIZE;
  const visibleWidthPx = options.visibleWidthPx ?? (options.mapWidthTiles * tileSize);
  const visibleHeightPx = options.visibleHeightPx ?? (options.mapHeightTiles * tileSize);
  const layoutMode = options.layoutMode ?? 'linear';
  const paletteOffset = options.paletteBankOffset ?? 0;
  const transparentColorIndexZero = options.transparentColorIndexZero === true;
  const parsedPaletteBanks = normalizePaletteBanks(options.paletteBanks);
  if (parsedPaletteBanks.length === 0) {
    return;
  }

  const tilesPerRow = Math.floor(tileset.width / tileSize);
  if (tilesPerRow <= 0 || tileset.height <= 0) {
    return;
  }

  const maxTileX = Math.min(options.mapWidthTiles, Math.ceil(visibleWidthPx / tileSize));
  const maxTileY = Math.min(options.mapHeightTiles, Math.ceil(visibleHeightPx / tileSize));
  const outputWidth = Math.max(1, maxTileX * tileSize);
  const outputHeight = Math.max(1, maxTileY * tileSize);

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = outputWidth;
  outputCanvas.height = outputHeight;
  const outputCtx = outputCanvas.getContext('2d', { willReadFrequently: true });
  if (!outputCtx) {
    return;
  }

  const imageData = outputCtx.createImageData(outputWidth, outputHeight);
  const out = imageData.data;

  for (let tileY = 0; tileY < maxTileY; tileY++) {
    for (let tileX = 0; tileX < maxTileX; tileX++) {
      const mapIndex = resolveMapEntryIndex(tileX, tileY, options.mapWidthTiles, layoutMode);
      if (mapIndex >= mapEntries.length) {
        continue;
      }

      const raw = mapEntries[mapIndex] & TILEMAP_ENTRY_MASK;
      if (options.skipZeroEntries && raw === 0) {
        continue;
      }

      const entry = parseGbaBgTilemapEntry(raw);
      const paletteBankIndex = entry.palette - paletteOffset;
      if (paletteBankIndex < 0 || paletteBankIndex >= parsedPaletteBanks.length) {
        continue;
      }

      const srcTileX = (entry.tileIndex % tilesPerRow) * tileSize;
      const srcTileY = Math.floor(entry.tileIndex / tilesPerRow) * tileSize;
      if (srcTileX + tileSize > tileset.width || srcTileY + tileSize > tileset.height) {
        continue;
      }

      const paletteBank = parsedPaletteBanks[paletteBankIndex];
      const destTileX = tileX * tileSize;
      const destTileY = tileY * tileSize;

      for (let py = 0; py < tileSize; py++) {
        const srcLocalY = entry.vFlip ? (tileSize - 1 - py) : py;
        const srcY = srcTileY + srcLocalY;
        const destY = destTileY + py;
        if (destY >= outputHeight) continue;

        for (let px = 0; px < tileSize; px++) {
          const srcLocalX = entry.hFlip ? (tileSize - 1 - px) : px;
          const srcX = srcTileX + srcLocalX;
          const destX = destTileX + px;
          if (destX >= outputWidth) continue;

          const sourceIndex = srcY * tileset.width + srcX;
          if (sourceIndex < 0 || sourceIndex >= tileset.pixels.length) {
            continue;
          }
          const colorIndex = tileset.pixels[sourceIndex] & 0x0f;
          if (transparentColorIndexZero && colorIndex === 0) {
            continue;
          }

          const color = paletteBank[colorIndex];
          const outIndex = (destY * outputWidth + destX) * 4;
          out[outIndex] = color.r;
          out[outIndex + 1] = color.g;
          out[outIndex + 2] = color.b;
          out[outIndex + 3] = 255;
        }
      }
    }
  }

  outputCtx.putImageData(imageData, 0, 0);
  ctx.drawImage(outputCanvas, 0, 0);
}

export function decodeGbaBgTilemap(buffer: ArrayBuffer): Uint16Array {
  const view = new DataView(buffer);
  const count = Math.floor(buffer.byteLength / 2);
  const out = new Uint16Array(count);
  for (let i = 0; i < count; i++) {
    out[i] = view.getUint16(i * 2, true);
  }
  return out;
}

export function parseGbaBgTilemapEntry(raw: number): GbaBgTilemapEntry {
  return {
    raw: raw & TILEMAP_ENTRY_MASK,
    tileIndex: raw & 0x03ff,
    hFlip: (raw & 0x0400) !== 0,
    vFlip: (raw & 0x0800) !== 0,
    palette: (raw >>> 12) & 0x0f,
  };
}

export function drawGbaBgTilemap(
  ctx: CanvasRenderingContext2D,
  tilesetSource: GbaTilemapSource,
  mapEntries: ArrayLike<number>,
  options: DrawGbaTilemapOptions,
): void {
  if (isIndexedTilesetSource(tilesetSource)) {
    drawIndexedGbaBgTilemap(ctx, tilesetSource, mapEntries, options);
    return;
  }

  const tileSize = options.tileSize ?? DEFAULT_TILE_SIZE;
  const visibleWidthPx = options.visibleWidthPx ?? (options.mapWidthTiles * tileSize);
  const visibleHeightPx = options.visibleHeightPx ?? (options.mapHeightTiles * tileSize);
  const layoutMode = options.layoutMode ?? 'linear';

  const tileset = asTransparentSource(tilesetSource, options.transparency);
  const tilesetWidth = getSourceWidth(tileset);
  const tilesetHeight = getSourceHeight(tileset);
  if (tilesetWidth <= 0 || tilesetHeight <= 0) {
    return;
  }

  const tilesPerRow = Math.floor(tilesetWidth / tileSize);
  if (tilesPerRow <= 0) {
    return;
  }

  const maxTileX = Math.min(options.mapWidthTiles, Math.ceil(visibleWidthPx / tileSize));
  const maxTileY = Math.min(options.mapHeightTiles, Math.ceil(visibleHeightPx / tileSize));

  for (let tileY = 0; tileY < maxTileY; tileY++) {
    for (let tileX = 0; tileX < maxTileX; tileX++) {
      const mapIndex = resolveMapEntryIndex(tileX, tileY, options.mapWidthTiles, layoutMode);
      if (mapIndex >= mapEntries.length) {
        continue;
      }

      const raw = mapEntries[mapIndex] & TILEMAP_ENTRY_MASK;
      if (options.skipZeroEntries && raw === 0) {
        continue;
      }

      const entry = parseGbaBgTilemapEntry(raw);
      const srcX = (entry.tileIndex % tilesPerRow) * tileSize;
      const srcY = Math.floor(entry.tileIndex / tilesPerRow) * tileSize;

      if (srcX + tileSize > tilesetWidth || srcY + tileSize > tilesetHeight) {
        continue;
      }

      const destX = tileX * tileSize;
      const destY = tileY * tileSize;

      if (!entry.hFlip && !entry.vFlip) {
        ctx.drawImage(tileset, srcX, srcY, tileSize, tileSize, destX, destY, tileSize, tileSize);
        continue;
      }

      ctx.save();
      ctx.translate(destX + (entry.hFlip ? tileSize : 0), destY + (entry.vFlip ? tileSize : 0));
      ctx.scale(entry.hFlip ? -1 : 1, entry.vFlip ? -1 : 1);
      ctx.drawImage(tileset, srcX, srcY, tileSize, tileSize, 0, 0, tileSize, tileSize);
      ctx.restore();
    }
  }
}
