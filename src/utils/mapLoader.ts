import UPNG from 'upng-js';

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

export interface MapData {
  width: number;
  height: number;
  layout: number[]; // Array of metatile IDs
}

export interface Tileset {
  palettes: Palette[];
  tiles: Uint8Array; // 8-bit indices from the PNG
  metatiles: Metatile[];
}

export const NUM_TILES_PER_METATILE = 8;
export const TILE_SIZE = 8;
export const METATILE_SIZE = 16;
export const TILES_PER_ROW_IN_IMAGE = 16; // 128px / 8px

export async function loadText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${url}`);
  return response.text();
}

export async function loadBinary(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${url}`);
  return response.arrayBuffer();
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

export async function loadTilesetImage(url: string): Promise<Uint8Array> {
  const buffer = await loadBinary(url);
  const img = UPNG.decode(buffer);
  
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
      return unpacked;
    }
    return new Uint8Array(img.data);
  }
  
  console.warn('Tileset image is not indexed (ctype != 3). This might cause issues.', url);
  return new Uint8Array(img.data);
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

export async function loadMapLayout(url: string, width: number, height: number): Promise<MapData> {
  const buffer = await loadBinary(url);
  const view = new DataView(buffer);
  const layout: number[] = [];
  // Map bin is just a sequence of uint16 metatile IDs
  for (let i = 0; i < width * height; i++) {
    layout.push(view.getUint16(i * 2, true));
  }
  return { width, height, layout };
}

// Collision bits from map.bin (bits 10-11)
export function getCollisionFromMapTile(mapTile: number): number {
  return (mapTile >> 10) & 0x3;
}

// Metatile ID from map.bin (bits 0-9)
export function getMetatileIdFromMapTile(mapTile: number): number {
  return mapTile & 0x3FF;
}

// Check if a tile is passable based on collision bits
// In pokeemerald: 0 = passable, 1-3 = impassable
export function isCollisionPassable(collision: number): boolean {
  return collision === 0;
}

// Metatile layer type constants (from pokeemerald)
export const METATILE_LAYER_TYPE_NORMAL = 0;  // Top layer covers player
export const METATILE_LAYER_TYPE_COVERED = 1; // Both layers behind player
export const METATILE_LAYER_TYPE_SPLIT = 2;   // Special rendering

