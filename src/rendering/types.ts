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
  AnimationDestination as SharedAnimationDestination,
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
export type AnimationDestination = SharedAnimationDestination;

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
  /** Optional O(1) tile-to-map lookup for hot-path resolution */
  tileLookup?: Map<string, WorldMapInstance>;
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
  /** Which tileset pair this tile belongs to (0 or 1) for multi-tileset worlds */
  tilesetPairIndex?: number;
  /** True when resolver used a temporary in-GPU fallback pair to avoid black output. */
  usedGpuFallback?: boolean;
  /** Pair ID selected as fallback when true. */
  gpuFallbackPairId?: string;
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
 * A rectangular region that needs re-rendering (from DirtyRegionTracker)
 */
export interface DirtyRegion {
  /** X position in pixels on the pass canvas */
  x: number;
  /** Y position in pixels on the pass canvas */
  y: number;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** World tile X (for debugging) */
  worldTileX?: number;
  /** World tile Y (for debugging) */
  worldTileY?: number;
}

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
  /** Current game frame (for animation timing) */
  gameFrame?: number;
  /** Dirty regions to re-render (optimization for animations) */
  dirtyRegions?: DirtyRegion[] | null;
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

// =============================================================================
// Sprite Rendering Types (Renderer-Agnostic)
// =============================================================================

/**
 * Sprite instance data for rendering
 *
 * This type is renderer-agnostic - it contains all information needed
 * to render a sprite without any WebGL/Canvas2D specifics. Both
 * WebGLSpriteRenderer and Canvas2DSpriteRenderer use this same type.
 *
 * Coordinates are in WORLD pixels (not screen pixels). The renderer
 * converts to screen coordinates using the camera view.
 */
export interface SpriteInstance {
  // === Position (world pixels) ===
  /** X position in world pixel coordinates */
  worldX: number;
  /** Y position in world pixel coordinates */
  worldY: number;

  // === Dimensions ===
  /** Sprite width in pixels */
  width: number;
  /** Sprite height in pixels */
  height: number;

  // === Atlas region ===
  /** Name of the sprite sheet (for texture lookup) */
  atlasName: string;
  /** X offset within the atlas texture (pixels) */
  atlasX: number;
  /** Y offset within the atlas texture (pixels) */
  atlasY: number;
  /** Width of sprite region in atlas (pixels) */
  atlasWidth: number;
  /** Height of sprite region in atlas (pixels) */
  atlasHeight: number;

  // === Transform ===
  /** Horizontal flip (east-facing sprites) */
  flipX: boolean;
  /** Vertical flip (reflections) */
  flipY: boolean;
  /** Optional clockwise rotation in degrees around sprite center */
  rotationDeg?: number;
  /** Optional X scale around sprite center (1 = no scale) */
  scaleX?: number;
  /** Optional Y scale around sprite center (1 = no scale) */
  scaleY?: number;

  // === Appearance ===
  /** Overall opacity (0-1) */
  alpha: number;
  /** Tint red component (0-1, 1 = no tint) */
  tintR: number;
  /** Tint green component (0-1, 1 = no tint) */
  tintG: number;
  /** Tint blue component (0-1, 1 = no tint) */
  tintB: number;

  // === Sorting ===
  /**
   * Sort key for Y-ordering
   * Higher values render later (on top)
   * Typically: (worldY << 8) | subpriority
   */
  sortKey: number;

  // === Reflection-specific ===
  /** Whether this is a reflection sprite (needs water mask + shimmer) */
  isReflection: boolean;
  /**
   * Shimmer X-scale for water reflections (0.984-1.016)
   * Only used when isReflection=true, undefined for ice/normal sprites
   */
  shimmerScale?: number;

  // === Water layer effects ===
  /**
   * Whether this sprite renders in the reflection layer (between BG0 and BG1).
   * Used for water surface effects like puddle splash and ripples.
   * These render with water mask clipping but NO shimmer or vertical flip.
   * GBA renders these at OAM priority 3 like reflections.
   */
  isReflectionLayer?: boolean;
}

/**
 * Sprite sheet metadata
 *
 * Describes a sprite sheet uploaded to the renderer.
 * Used for looking up atlas regions.
 */
export interface SpriteSheetInfo {
  /** Unique name for this sprite sheet */
  name: string;
  /** Width of the full sheet in pixels */
  width: number;
  /** Height of the full sheet in pixels */
  height: number;
  /** Width of a single frame (for animated sprites) */
  frameWidth?: number;
  /** Height of a single frame (for animated sprites) */
  frameHeight?: number;
  /** Number of frames in the sheet */
  frameCount?: number;
}
