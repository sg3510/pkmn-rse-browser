/**
 * Rendering Types - Shared types for the modular rendering pipeline
 *
 * This module provides types used across the rendering system:
 * - RenderPipeline
 * - PassRenderer
 * - TileRenderer
 * - ElevationFilter
 * - LayerCompositor
 *
 * Design: These types are React-free and can be used in any context.
 */

import type { Palette, Metatile, MetatileAttributes, MapTileData } from '../utils/mapLoader';
import type { CameraView } from '../utils/camera';
import type { WorldMapInstance, WorldState, TilesetResources } from '../services/MapManager';
import type { TilesetKind } from '../data/tilesetAnimations';
// Import shared tileset types for consistency across the codebase
import type {
  TilesetRuntime as SharedTilesetRuntime,
  ReflectionMeta as SharedReflectionMeta,
  LoadedAnimation as SharedLoadedAnimation,
  TilesetBuffers as SharedTilesetBuffers,
} from '../utils/tilesetUtils';

// Re-export for convenience
export type { Palette, Metatile, MetatileAttributes, MapTileData };
export type { CameraView };
export type { TilesetKind };

// Re-export tileset types from shared module
export type TilesetRuntime = SharedTilesetRuntime;
export type ReflectionMeta = SharedReflectionMeta;
export type LoadedAnimation = SharedLoadedAnimation;
export type TilesetBuffers = SharedTilesetBuffers;

/**
 * Extended camera view with world coordinates
 *
 * Adds world-space tile coordinates to the base CameraView
 * for mapping between screen and world positions.
 */
export interface WorldCameraView extends CameraView {
  /** Starting tile X in world coordinates */
  worldStartTileX: number;
  /** Starting tile Y in world coordinates */
  worldStartTileY: number;
  /** Camera X position in world pixel coordinates */
  cameraWorldX: number;
  /** Camera Y position in world pixel coordinates */
  cameraWorldY: number;
}

/**
 * Parameters for drawing a single 8x8 tile
 *
 * Used by TileRenderer to draw tiles to canvas.
 * Matches the format from MapRenderer's TileDrawCall.
 */
export interface TileDrawCall {
  /** Tile ID in the tileset (0-511 primary, 512+ secondary) */
  tileId: number;
  /** Destination X in pixels on the target canvas */
  destX: number;
  /** Destination Y in pixels on the target canvas */
  destY: number;
  /** 16-color palette to apply */
  palette: Palette;
  /** Horizontal flip flag */
  xflip: boolean;
  /** Vertical flip flag */
  yflip: boolean;
  /** Which tileset the tile comes from */
  source: TilesetKind;
  /** Layer index (0 = bottom, 1 = top) */
  layer: 0 | 1;
}

// TilesetBuffers imported from ../utils/tilesetUtils

/**
 * Render context providing all data needed for rendering
 *
 * This is the main input to the rendering pipeline,
 * containing world state and tileset resources.
 */
export interface RenderContext {
  /** Current world state with all loaded maps */
  world: WorldState;
  /** Map of tileset key to runtime data */
  tilesetRuntimes: Map<string, TilesetRuntime>;
  /** Current anchor map (player's map) */
  anchor: WorldMapInstance;
}

// TilesetRuntime, ReflectionMeta, LoadedAnimation imported from ../utils/tilesetUtils

/**
 * Reflection type for water/ice surfaces
 */
export type ReflectionType = 'water' | 'ice';

/**
 * Resolved tile data at a specific world position
 *
 * Contains all data needed to render a tile, including
 * the source map, metatile, and tileset resources.
 */
export interface ResolvedTile {
  /** The map containing this tile */
  map: WorldMapInstance;
  /** Tileset resources for this tile */
  tileset: TilesetResources;
  /** The metatile data (or null for out-of-bounds) */
  metatile: Metatile | null;
  /** Metatile attributes (behavior, layerType, etc.) */
  attributes: MetatileAttributes | undefined;
  /** Map tile data (elevation, collision) */
  mapTile: MapTileData;
  /** Whether this is from the secondary metatile set */
  isSecondary: boolean;
  /** Whether this is a border tile */
  isBorder: boolean;
}

/**
 * Render pass type
 *
 * - background: Bottom layer (always behind sprites)
 * - top: Top layer (split into below/above based on elevation)
 */
export type RenderPassType = 'background' | 'top';

/**
 * Composite layer type for final rendering
 *
 * - background: BG2 layer, always behind all sprites
 * - topBelow: BG1 tiles that render behind the player
 * - topAbove: BG1 tiles that render above the player
 */
export type CompositeLayerType = 'background' | 'topBelow' | 'topAbove';

/**
 * Elevation filter function type
 *
 * Used to determine which tiles go into topBelow vs topAbove passes.
 *
 * @param mapTile - The map tile data with elevation and collision
 * @param tileX - World tile X coordinate
 * @param tileY - World tile Y coordinate
 * @returns true if the tile should be rendered in this pass
 */
export type ElevationFilterFn = (
  mapTile: MapTileData,
  tileX: number,
  tileY: number
) => boolean;

/**
 * Render options for the pipeline
 */
export interface RenderOptions {
  /** Force full re-render of all passes */
  needsFullRender?: boolean;
  /** Animation frame changed (requires re-render) */
  animationChanged?: boolean;
  /** Player elevation changed (requires top layer re-split) */
  elevationChanged?: boolean;
  /** Skip animated tiles (for static layer caching) */
  skipAnimated?: boolean;
  /** Show debug collision overlay */
  showCollision?: boolean;
  /** Show debug elevation overlay */
  showElevation?: boolean;
}

/**
 * Result from composite layer rendering
 */
export interface LayerRenderResult {
  /** The rendered canvas for this layer */
  canvas: HTMLCanvasElement;
  /** Whether the canvas was reused from cache */
  fromCache: boolean;
}

/**
 * Function type for checking if a tile is a vertical object
 *
 * Vertical objects (trees, poles, etc.) always render above the player
 * regardless of elevation.
 */
export type IsVerticalObjectFn = (tileX: number, tileY: number) => boolean;

/**
 * Function type for resolving tiles at world coordinates
 */
export type TileResolverFn = (tileX: number, tileY: number) => ResolvedTile | null;
