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

export interface DrawGbaTilemapOptions {
  mapWidthTiles: number;
  mapHeightTiles: number;
  tileSize?: number;
  visibleWidthPx?: number;
  visibleHeightPx?: number;
  transparency?: TransparencyMode;
  // If true, entries that are exactly 0x0000 are skipped entirely.
  skipZeroEntries?: boolean;
}

const DEFAULT_TILE_SIZE = 8;

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
    raw: raw & 0xffff,
    tileIndex: raw & 0x03ff,
    hFlip: (raw & 0x0400) !== 0,
    vFlip: (raw & 0x0800) !== 0,
    palette: (raw >>> 12) & 0x0f,
  };
}

export function drawGbaBgTilemap(
  ctx: CanvasRenderingContext2D,
  tilesetSource: CanvasImageSource,
  mapEntries: ArrayLike<number>,
  options: DrawGbaTilemapOptions,
): void {
  const tileSize = options.tileSize ?? DEFAULT_TILE_SIZE;
  const visibleWidthPx = options.visibleWidthPx ?? (options.mapWidthTiles * tileSize);
  const visibleHeightPx = options.visibleHeightPx ?? (options.mapHeightTiles * tileSize);

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
      const mapIndex = tileY * options.mapWidthTiles + tileX;
      if (mapIndex >= mapEntries.length) {
        continue;
      }

      const raw = mapEntries[mapIndex] & 0xffff;
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
