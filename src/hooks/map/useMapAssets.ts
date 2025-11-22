import { useEffect, useState } from 'react';
import { type TilesetResources, type WorldState } from '../../services/MapManager';
import {
  loadBinary,
  type Metatile,
  type Palette,
  type MetatileAttributes,
  METATILE_SIZE,
  TILE_SIZE,
  TILES_PER_ROW_IN_IMAGE,
  SECONDARY_TILE_OFFSET,
} from '../../utils/mapLoader';
import {
  TILESET_ANIMATION_CONFIGS,
  type TilesetAnimationDefinition,
} from '../../data/tilesetAnimations';
import UPNG from 'upng-js';
import { isReflectiveBehavior, isIceBehavior } from '../../utils/metatileBehaviors';

const PROJECT_ROOT = '/pokeemerald';
const TILESET_STRIDE = TILES_PER_ROW_IN_IMAGE * TILE_SIZE; // 128px

export interface AnimationDestination {
  destStart: number;
  phase?: number;
}

export interface LoadedAnimation extends Omit<TilesetAnimationDefinition, 'frames'> {
  frames: Uint8Array[];
  width: number;
  height: number;
  tilesWide: number;
  tilesHigh: number;
  destinations: AnimationDestination[];
  sequence: number[];
}

export interface ReflectionMeta {
  isReflective: boolean;
  reflectionType: 'water' | 'ice' | null;
  pixelMask: Uint8Array; // 16x16 mask where 1 = BG1 transparent (reflection allowed), 0 = opaque
}

export interface TilesetBuffers {
  primary: Uint8Array;
  secondary: Uint8Array;
}

export interface TilesetRuntime {
  resources: TilesetResources;
  primaryTileMasks: Uint8Array[];
  secondaryTileMasks: Uint8Array[];
  primaryReflectionMeta: ReflectionMeta[];
  secondaryReflectionMeta: ReflectionMeta[];
  animations: LoadedAnimation[];
  animatedTileIds: { primary: Set<number>; secondary: Set<number> };
  patchedTiles: TilesetBuffers | null;
  lastPatchedKey: string;
}

// Helper functions extracted from MapRenderer.tsx
function buildTileTransparencyLUT(tiles: Uint8Array): Uint8Array[] {
  const tileCount = Math.floor(tiles.length / (TILE_SIZE * TILE_SIZE));
  const lut: Uint8Array[] = new Array(tileCount);
  for (let tileId = 0; tileId < tileCount; tileId++) {
    const tileX = (tileId % TILES_PER_ROW_IN_IMAGE) * TILE_SIZE;
    const tileY = Math.floor(tileId / TILES_PER_ROW_IN_IMAGE) * TILE_SIZE;
    const mask = new Uint8Array(TILE_SIZE * TILE_SIZE);
    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        const pixel = tiles[(tileY + y) * TILESET_STRIDE + (tileX + x)];
        mask[y * TILE_SIZE + x] = pixel === 0 ? 1 : 0; // 1 = transparent (palette index 0)
      }
    }
    lut[tileId] = mask;
  }
  return lut;
}

type PaletteRgbLUT = Array<Array<[number, number, number]>>;

function buildPaletteRgbLUT(palettes: Palette[]): PaletteRgbLUT {
  return palettes.map((palette) =>
    palette.colors.map((hex) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return [r, g, b] as [number, number, number];
    })
  );
}

function isWaterColor(rgb: [number, number, number]): boolean {
  const [r, g, b] = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 40) return false; // too dark to be a visible reflection surface

  const delta = max - min;
  const saturation = max === 0 ? 0 : delta / max;

  // Hue calculation (0-360)
  let hue = 0;
  if (delta !== 0) {
    if (max === r) hue = ((g - b) / delta) * 60 + 360;
    else if (max === g) hue = ((b - r) / delta) * 60 + 120;
    else hue = ((r - g) / delta) * 60 + 240;
    hue %= 360;
  }

  // Treat blues/cyans (150-260 deg) with even modest saturation as water.
  return hue >= 150 && hue <= 260 && saturation >= 0.05;
}

function isBlueDominantColor(rgb: [number, number, number]): boolean {
  const [r, g, b] = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 40) return false;
  const saturation = max === 0 ? 0 : (max - min) / max;
  if (saturation < 0.05) return false;
  return b >= g && b >= r + 8;
}

function buildPaletteWaterFlags(paletteRgb: PaletteRgbLUT): boolean[] {
  return paletteRgb.map((colors) => colors.some((c, idx) => idx !== 0 && isBlueDominantColor(c)));
}

function sampleTilePixel(
  tileId: number,
  x: number,
  y: number,
  tilesPrimary: Uint8Array,
  tilesSecondary: Uint8Array,
  useSecondarySheet: boolean
): number {
  const localId = tileId >= SECONDARY_TILE_OFFSET ? tileId - SECONDARY_TILE_OFFSET : tileId;
  const tiles = useSecondarySheet ? tilesSecondary : tilesPrimary;
  const tileX = (localId % TILES_PER_ROW_IN_IMAGE) * TILE_SIZE;
  const tileY = Math.floor(localId / TILES_PER_ROW_IN_IMAGE) * TILE_SIZE;
  return tiles[(tileY + y) * TILESET_STRIDE + (tileX + x)];
}

function applyWaterMaskToMetatile(
  destMask: Uint8Array,
  tile: Metatile['tiles'][number],
  tileIndex: number,
  tilesPrimary: Uint8Array,
  tilesSecondary: Uint8Array,
  paletteRgb: PaletteRgbLUT,
  useSecondarySheet: boolean
) {
  if (!tile) return;
  const palette = paletteRgb[tile.palette];
  if (!palette) return;

  const localIndex = tileIndex; // 0..3 bottom layer
  const baseX = (localIndex % 2) * TILE_SIZE;
  const baseY = Math.floor(localIndex / 2) * TILE_SIZE;

  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const srcX = tile.xflip ? TILE_SIZE - 1 - x : x;
      const srcY = tile.yflip ? TILE_SIZE - 1 - y : y;
      const pixelIndex = sampleTilePixel(
        tile.tileId,
        srcX,
        srcY,
        tilesPrimary,
        tilesSecondary,
        useSecondarySheet
      );
      if (pixelIndex === 0) continue; // treat palette index 0 as non-water / background
      const color = palette[pixelIndex];
      if (!color) continue;
      if (!isWaterColor(color)) continue;
      const destX = baseX + x;
      const destY = baseY + y;
      destMask[destY * METATILE_SIZE + destX] = 1;
    }
  }
}

function applyTileMaskToMetatile(
  destMask: Uint8Array,
  tileMask: Uint8Array | undefined,
  tileIndex: number,
  xflip: boolean,
  yflip: boolean
) {
  if (!tileMask) return;
  const localIndex = tileIndex - 4; // 0..3 within top layer
  const baseX = (localIndex % 2) * TILE_SIZE;
  const baseY = Math.floor(localIndex / 2) * TILE_SIZE;
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const srcX = xflip ? TILE_SIZE - 1 - x : x;
      const srcY = yflip ? TILE_SIZE - 1 - y : y;
      const allow = tileMask[srcY * TILE_SIZE + srcX];
      if (allow === 0) {
        const destX = baseX + x;
        const destY = baseY + y;
        destMask[destY * METATILE_SIZE + destX] = 0;
      }
    }
  }
}

// Re-implement buildReflectionMeta with correct imports
function buildReflectionMeta(
  metatiles: Metatile[],
  attributes: MetatileAttributes[],
  primaryTileMasks: Uint8Array[],
  secondaryTileMasks: Uint8Array[],
  primaryPalettes: Palette[],
  secondaryPalettes: Palette[],
  primaryTilesImage: Uint8Array,
  secondaryTilesImage: Uint8Array
): ReflectionMeta[] {
  const paletteRgbPrimary = buildPaletteRgbLUT(primaryPalettes);
  const paletteRgbSecondary = buildPaletteRgbLUT(secondaryPalettes);
  const paletteWaterFlagsPrimary = buildPaletteWaterFlags(paletteRgbPrimary);
  const paletteWaterFlagsSecondary = buildPaletteWaterFlags(paletteRgbSecondary);

  return metatiles.map((metatile, index) => {
    const attr = attributes[index];
    const behavior = attr?.behavior ?? -1;
    const isReflective = isReflectiveBehavior(behavior);
    const reflectionType = isReflective
      ? isIceBehavior(behavior)
        ? 'ice'
        : 'water'
      : null;
    const pixelMask = new Uint8Array(METATILE_SIZE * METATILE_SIZE);
    if (!isReflective) {
      return { isReflective, reflectionType, pixelMask };
    }

    // Step 1: mark where the bottom layer visually looks like water (blue/teal pixels).
    for (let i = 0; i < 4; i++) {
      const tile = metatile.tiles[i];
      if (!tile) continue;
      const useSecondarySheet = tile.tileId >= SECONDARY_TILE_OFFSET;
      const paletteIndex = tile.palette;
      const paletteWaterFlags = useSecondarySheet
        ? paletteWaterFlagsSecondary
        : paletteWaterFlagsPrimary;
      if (!paletteWaterFlags[paletteIndex]) continue;
      applyWaterMaskToMetatile(
        pixelMask,
        tile,
        i,
        primaryTilesImage,
        secondaryTilesImage,
        useSecondarySheet ? paletteRgbSecondary : paletteRgbPrimary,
        useSecondarySheet
      );
    }

    // Step 2: remove any pixels covered by opaque top-layer tiles.
    for (let i = 4; i < 8; i++) {
      const tile = metatile.tiles[i];
      if (!tile) continue;
      const tileId = tile.tileId;
      const useSecondarySheet = tileId >= SECONDARY_TILE_OFFSET;
      const localId = useSecondarySheet ? tileId - SECONDARY_TILE_OFFSET : tileId;
      const lut = useSecondarySheet
        ? secondaryTileMasks[localId]
        : primaryTileMasks[localId];
      applyTileMaskToMetatile(pixelMask, lut, i, tile.xflip, tile.yflip);
    }

    return { isReflective, reflectionType: reflectionType as 'water' | 'ice' | null, pixelMask };
  });
}


function buildTilesetRuntime(resources: TilesetResources): TilesetRuntime {
  const primaryTileMasks = buildTileTransparencyLUT(resources.primaryTilesImage);
  const secondaryTileMasks = buildTileTransparencyLUT(resources.secondaryTilesImage);

  const primaryReflectionMeta = buildReflectionMeta(
    resources.primaryMetatiles,
    resources.primaryAttributes,
    primaryTileMasks,
    secondaryTileMasks,
    resources.primaryPalettes,
    resources.secondaryPalettes,
    resources.primaryTilesImage,
    resources.secondaryTilesImage
  );

  const secondaryReflectionMeta = buildReflectionMeta(
    resources.secondaryMetatiles,
    resources.secondaryAttributes,
    primaryTileMasks,
    secondaryTileMasks,
    resources.primaryPalettes,
    resources.secondaryPalettes,
    resources.primaryTilesImage,
    resources.secondaryTilesImage
  );

  return {
    resources,
    primaryTileMasks,
    secondaryTileMasks,
    primaryReflectionMeta,
    secondaryReflectionMeta,
    animations: [],
    animatedTileIds: { primary: new Set(), secondary: new Set() },
    patchedTiles: null,
    lastPatchedKey: '',
  };
}

export function useMapAssets(world: WorldState) {
  const [tilesetRuntimes, setTilesetRuntimes] = useState<Map<string, TilesetRuntime>>(new Map());

  useEffect(() => {
    let active = true;
    const loadAll = async () => {
      const neededKeys = new Set<string>();
      // Add anchor
      neededKeys.add(world.maps.find(m => m.entry.id === world.anchorId)?.tilesets.key ?? '');
      // Add neighbors
      for (const map of world.maps) {
        neededKeys.add(map.tilesets.key);
      }
      neededKeys.delete('');

      const newRuntimes = new Map(tilesetRuntimes);
      let changed = false;

      for (const key of neededKeys) {
        if (newRuntimes.has(key)) continue;

        // Find resources for this key
        const map = world.maps.find(m => m.tilesets.key === key);
        if (!map) continue;

        const runtime = buildTilesetRuntime(map.tilesets);
        
        // Load animations
        const animConfig = TILESET_ANIMATION_CONFIGS[map.tilesets.primaryTilesetId];
        if (animConfig) {
          const loadedAnims: LoadedAnimation[] = [];
          for (const def of animConfig) {
            try {
              const frames: Uint8Array[] = [];
              let width = 0;
              let height = 0;

              for (const framePath of def.frames) {
                const path = `${PROJECT_ROOT}/${framePath}`;
                const buffer = await loadBinary(path);
                const img = UPNG.decode(buffer);
                
                if (width === 0) {
                  width = img.width;
                  height = img.height;
                }

                let frameData: Uint8Array;
                if (img.ctype === 3) {
                   frameData = new Uint8Array(img.data);
                } else {
                   // If not indexed, we might need to convert or warn.
                   // For now, let's assume all anims are indexed as they should be.
                   console.warn(`Animation frame ${framePath} is not indexed color`);
                   continue;
                }
                frames.push(frameData);
              }

              if (frames.length === 0) continue;
              
              loadedAnims.push({
                ...def,
                frames,
                width,
                height,
                tilesWide: width / 8,
                tilesHigh: height / 8,
                destinations: def.destinations, 
                sequence: def.sequence ?? [], 
              });
            } catch (e) {
              console.error(`Failed to load animation ${def.id}`, e);
            }
          }
          runtime.animations = loadedAnims;
          
          // Populate destinations (placeholder logic)
          for (const anim of runtime.animations) {
             const firstFrame = anim.frames[0];
             if (!firstFrame) continue;
             // Logic to find destinations would go here
          }
        }

        newRuntimes.set(key, runtime);
        changed = true;
      }

      if (changed && active) {
        setTilesetRuntimes(newRuntimes);
      }
    };

    loadAll();
    return () => { active = false; };
  }, [world, tilesetRuntimes]);

  return tilesetRuntimes;
}
