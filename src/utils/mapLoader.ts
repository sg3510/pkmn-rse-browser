import UPNG from 'upng-js';
import { loadBinaryAsset, loadTextAsset } from './assetLoader';

export interface Palette {
  colors: string[]; // 16 hex strings: "#RRGGBB"
}

export interface Tile {
  tileId: number;
  xflip: boolean;
  yflip: boolean;
  palette: number;
}

export interface MetatileAttributes {
  behavior: number; // MB_* constants (bits 0-7)
  layerType: number; // bits 12-15
}

export interface Metatile {
  id: number;
  tiles: Tile[]; // 8 tiles
  attributes?: MetatileAttributes;
}

/**
 * Represents a single map tile with all its data from map.bin
 * 
 * Reference: public/pokeemerald/include/global.fieldmap.h:4-19
 * Map grid blocks consist of:
 * - 10 bit metatile id (bits 0-9)
 * - 2 bit collision value (bits 10-11)
 * - 4 bit elevation value (bits 12-15)
 */
export interface MapTileData {
  metatileId: number;   // Bits 0-9
  collision: number;    // Bits 10-11
  elevation: number;    // Bits 12-15
}

export interface MapData {
  width: number;
  height: number;
  layout: MapTileData[]; // CHANGED: was number[], now MapTileData[]
}

export interface Tileset {
  palettes: Palette[];
  tiles: Uint8Array; // 8-bit indices from the PNG
  metatiles: Metatile[];
}

/**
 * Tileset image data with dimensions
 * Used when WebGL needs to know the tileset size for texture upload
 */
export interface TilesetImageData {
  data: Uint8Array;
  width: number;
  height: number;
}

export const NUM_TILES_PER_METATILE = 8;
export const TILE_SIZE = 8;
export const METATILE_SIZE = 16;
export const TILES_PER_ROW_IN_IMAGE = 16; // 128px / 8px
export const SECONDARY_TILE_OFFSET = TILES_PER_ROW_IN_IMAGE * 32; // 512 tiles
export const NUM_PRIMARY_METATILES = 512;

/**
 * Bit masks and shifts for map.bin tile data
 * Reference: public/pokeemerald/include/global.fieldmap.h:7-12
 */
const MAPGRID_METATILE_ID_MASK = 0x03FF;  // Bits 0-9
const MAPGRID_COLLISION_MASK = 0x0C00;    // Bits 10-11
const MAPGRID_ELEVATION_MASK = 0xF000;    // Bits 12-15

const MAPGRID_METATILE_ID_SHIFT = 0;
const MAPGRID_COLLISION_SHIFT = 10;
const MAPGRID_ELEVATION_SHIFT = 12;

export async function loadText(url: string): Promise<string> {
  return loadTextAsset(url);
}

export async function loadBinary(url: string): Promise<ArrayBuffer> {
  return loadBinaryAsset(url);
}

export function parsePalette(text: string): Palette {
  const lines = text.split(/\r?\n/);
  // JASC-PAL
  // 0100
  // 16
  // colors...
  if (lines[0] !== 'JASC-PAL') throw new Error('Invalid palette format');
  const colors: string[] = [];
  for (let i = 3; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(' ').map(Number);
    if (parts.length >= 3) {
      const [r, g, b] = parts;
      colors.push(`#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`);
    }
  }
  return { colors };
}

/**
 * Load a tileset image and return indexed pixel data
 *
 * @param url - Path to the PNG file
 * @param withDimensions - If true, returns TilesetImageData with width/height
 * @returns Uint8Array of palette indices, or TilesetImageData if withDimensions is true
 */
export async function loadTilesetImage(url: string, withDimensions: true): Promise<TilesetImageData>;
export async function loadTilesetImage(url: string, withDimensions?: false): Promise<Uint8Array>;
export async function loadTilesetImage(url: string, withDimensions?: boolean): Promise<Uint8Array | TilesetImageData> {
  const buffer = await loadBinary(url);
  const img = UPNG.decode(buffer);

  let data: Uint8Array;

  if (img.ctype === 3) {
    if (img.depth === 4) {
      // 4bpp: 2 pixels per byte
      const packed = new Uint8Array(img.data);
      const unpacked = new Uint8Array(packed.length * 2);
      for (let i = 0; i < packed.length; i++) {
        const byte = packed[i];
        // High nybble is first pixel, Low nybble is second pixel
        unpacked[i * 2] = (byte >> 4) & 0xF;
        unpacked[i * 2 + 1] = byte & 0xF;
      }
      data = unpacked;
    } else {
      data = new Uint8Array(img.data);
    }
  } else {
    // Only warn if debug mode is enabled
    if ((window as unknown as Record<string, boolean>)['DEBUG_MODE']) {
      console.warn('Tileset image is not indexed (ctype != 3). This might cause issues.', url);
    }
    data = new Uint8Array(img.data);
  }

  if (withDimensions) {
    return {
      data,
      width: img.width,
      height: img.height,
    };
  }

  return data;
}

export async function loadMetatileDefinitions(url: string): Promise<Metatile[]> {
  const buffer = await loadBinary(url);
  const view = new DataView(buffer);
  const metatiles: Metatile[] = [];
  const numMetatiles = view.byteLength / 16; // 16 bytes per metatile

  for (let i = 0; i < numMetatiles; i++) {
    const offset = i * 16;
    const tiles: Tile[] = [];
    for (let j = 0; j < 8; j++) {
      const raw = view.getUint16(offset + j * 2, true); // Little Endian
      tiles.push({
        tileId: raw & 0x3FF,
        xflip: !!(raw & 0x400),
        yflip: !!(raw & 0x800),
        palette: (raw >> 12) & 0xF
      });
    }
    metatiles.push({ id: i, tiles });
  }
  return metatiles;
}

export async function loadMetatileAttributes(url: string): Promise<MetatileAttributes[]> {
  const buffer = await loadBinary(url);
  const view = new DataView(buffer);
  const attributes: MetatileAttributes[] = [];
  const numMetatiles = view.byteLength / 2; // 2 bytes per metatile

  for (let i = 0; i < numMetatiles; i++) {
    const raw = view.getUint16(i * 2, true); // Little Endian
    attributes.push({
      behavior: raw & 0xFF,        // bits 0-7
      layerType: (raw >> 12) & 0xF // bits 12-15
    });
  }
  return attributes;
}

/**
 * Parse a single 16-bit map tile value into its components
 * 
 * Reference: public/pokeemerald/include/global.fieldmap.h:17-19
 */
export function parseMapTile(value: number): MapTileData {
  return {
    metatileId: (value & MAPGRID_METATILE_ID_MASK) >>> MAPGRID_METATILE_ID_SHIFT,
    collision: (value & MAPGRID_COLLISION_MASK) >>> MAPGRID_COLLISION_SHIFT,
    elevation: (value & MAPGRID_ELEVATION_MASK) >>> MAPGRID_ELEVATION_SHIFT,
  };
}

export async function loadMapLayout(url: string, width: number, height: number): Promise<MapData> {
  const buffer = await loadBinary(url);
  const view = new DataView(buffer);
  const layout: MapTileData[] = [];
  
  // Parse each 16-bit value into structured tile data
  for (let i = 0; i < width * height; i++) {
    const value = view.getUint16(i * 2, true);
    layout.push(parseMapTile(value));
  }
  
  return { width, height, layout };
}

// Border.bin stores four uint16 metatile IDs forming a 2x2 repeating pattern.
export async function loadBorderMetatiles(url: string): Promise<number[]> {
  const buffer = await loadBinary(url);
  const view = new DataView(buffer);
  const metatiles: number[] = [];
  for (let i = 0; i < view.byteLength; i += 2) {
    metatiles.push(view.getUint16(i, true));
  }
  return metatiles;
}

// Check if a tile is passable based on collision bits
// In pokeemerald: 0 = passable, 1-3 = impassable
export function isCollisionPassable(collision: number): boolean {
  return collision === 0;
}

// Helper for backward compatibility - extracts collision from MapTileData
export function getCollisionFromMapTile(mapTileData: MapTileData): number {
  return mapTileData.collision;
}

// Helper for backward compatibility - extracts metatileId from MapTileData
export function getMetatileIdFromMapTile(mapTileData: MapTileData): number {
  return mapTileData.metatileId;
}

// Metatile layer type constants (from pokeemerald)
export const METATILE_LAYER_TYPE_NORMAL = 0;  // Top layer covers player
export const METATILE_LAYER_TYPE_COVERED = 1; // Both layers behind player
export const METATILE_LAYER_TYPE_SPLIT = 2;   // Special rendering
