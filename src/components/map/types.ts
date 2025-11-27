import { type WorldMapInstance, type WorldState, type TilesetResources } from '../../services/MapManager';
import { type Metatile, type MetatileAttributes, type MapTileData } from '../../utils/mapLoader';
import { type LoadedAnimation } from '../../hooks/map/useMapAssets';
import { type TilesetKind } from '../../data/tilesetAnimations';
import { type PrerenderedAnimations } from '../../rendering/PrerenderedAnimations';
export { type LoadedAnimation, type TilesetKind };

export type ReflectionType = 'water' | 'ice';
export type WarpKind = 'door' | 'teleport' | 'arrow';

export interface ReflectionMeta {
  isReflective: boolean;
  reflectionType: ReflectionType | null;
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
  /** Pre-rendered animation frames (optional, for optimized rendering) */
  prerenderedAnimations: PrerenderedAnimations | null;
}

export interface RenderContext {
  world: WorldState;
  tilesetRuntimes: Map<string, TilesetRuntime>;
  anchor: WorldMapInstance;
}

export interface ResolvedTile {
  map: WorldMapInstance;
  tileset: TilesetResources;
  metatile: Metatile | null;
  attributes: MetatileAttributes | undefined;
  mapTile: MapTileData;
  isSecondary: boolean;
  isBorder: boolean;
}

export interface DebugTileInfo {
  inBounds: boolean;
  tileX: number;
  tileY: number;
  mapTile?: MapTileData;
  metatileId?: number;
  isSecondary?: boolean;
  behavior?: number;
  layerType?: number;
  layerTypeLabel?: string;
  isReflective?: boolean;
  reflectionType?: ReflectionType | null;
  reflectionMaskAllow?: number;
  reflectionMaskTotal?: number;
  bottomTiles?: Metatile['tiles'];
  topTiles?: Metatile['tiles'];
  // Additional debug info
  mapId?: string;
  mapName?: string;
  localX?: number;
  localY?: number;
  paletteIndex?: number;
  warpEvent?: any; // WarpEvent is not exported from types/maps yet, using any for now or import it
  warpKind?: WarpKind | null;
  primaryTilesetId?: string;
  secondaryTilesetId?: string;
  // Elevation and collision info
  elevation?: number;
  collision?: number;
  collisionPassable?: boolean;
  // Rendering debug info
  playerElevation?: number;
  isLedge?: boolean;
  ledgeDirection?: string;
  bottomLayerTransparency?: number;
  topLayerTransparency?: number;
  renderedInBackgroundPass?: boolean;
  renderedInTopBelowPass?: boolean;
  renderedInTopAbovePass?: boolean;
  topBelowPassReason?: string;
  topAbovePassReason?: string;
  // Detailed tile info
  bottomTileDetails?: string[];
  topTileDetails?: string[];
  adjacentTileInfo?: {
    north?: { metatileId: number; layerType: number; layerTypeLabel: string };
    south?: { metatileId: number; layerType: number; layerTypeLabel: string };
    east?: { metatileId: number; layerType: number; layerTypeLabel: string };
    west?: { metatileId: number; layerType: number; layerTypeLabel: string };
  };
}

import { type BridgeType } from '../../utils/metatileBehaviors';

export interface ReflectionState {
  hasReflection: boolean;
  reflectionType: ReflectionType | null;
  bridgeType: BridgeType;
}
