import { type Metatile, type MapTileData } from '../../utils/mapLoader';
import { type TilesetKind } from '../../data/tilesetAnimations';
import type { RenderContext, ResolvedTile } from '../../rendering/types';
import type {
  LoadedAnimation,
  ReflectionMeta,
  TilesetBuffers,
  TilesetRuntime,
} from '../../utils/tilesetUtils';
import { type WarpKind } from '../../field/types';
export { type LoadedAnimation, type TilesetKind };
export type { RenderContext, ResolvedTile, ReflectionMeta, TilesetBuffers, TilesetRuntime };

export type ReflectionType = 'water' | 'ice';
export type { WarpKind } from '../../field/types';

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
