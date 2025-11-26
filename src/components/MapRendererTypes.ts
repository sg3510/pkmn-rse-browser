/**
 * MapRendererTypes - Type definitions for MapRenderer component
 *
 * This module contains the public types for the MapRenderer component:
 * - Props interface
 * - Handle interface (for ref)
 * - Related helper types
 *
 * These types are extracted to enable:
 * - Cleaner imports in consuming components
 * - Type reuse without importing the full component
 * - Better code organization
 */

import type { SaveResult, SaveData } from '../save';

/**
 * Props for the MapRenderer component
 *
 * Required props define the map to render, optional props configure display.
 */
export interface MapRendererProps {
  /** Unique map identifier (e.g., 'MAP_LITTLEROOT_TOWN') */
  mapId: string;
  /** Display name for the map */
  mapName: string;
  /** Viewport width in pixels (before zoom) */
  width: number;
  /** Viewport height in pixels (before zoom) */
  height: number;
  /** Path to map layout data */
  layoutPath: string;
  /** Path to primary tileset */
  primaryTilesetPath: string;
  /** Path to secondary tileset */
  secondaryTilesetPath: string;
  /** Primary tileset identifier */
  primaryTilesetId: string;
  /** Secondary tileset identifier */
  secondaryTilesetId: string;
  /** Display zoom multiplier (default: 2) */
  zoom?: number;
}

/**
 * Handle for imperative methods exposed via ref
 *
 * Use with React.useRef<MapRendererHandle>() to access
 * these methods from a parent component.
 *
 * @example
 * ```tsx
 * const mapRef = useRef<MapRendererHandle>(null);
 *
 * const handleSave = () => {
 *   const result = mapRef.current?.saveGame();
 *   if (result?.success) {
 *     console.log('Game saved!');
 *   }
 * };
 *
 * return <MapRenderer ref={mapRef} {...props} />;
 * ```
 */
export interface MapRendererHandle {
  /** Save current game state to local storage */
  saveGame: () => SaveResult;
  /** Load game from save slot 0 */
  loadGame: () => SaveData | null;
  /** Get current player position and state */
  getPlayerPosition: () => PlayerPosition | null;
}

/**
 * Player position and state information
 *
 * Returned by MapRendererHandle.getPlayerPosition()
 */
export interface PlayerPosition {
  /** Player's tile X coordinate */
  tileX: number;
  /** Player's tile Y coordinate */
  tileY: number;
  /** Player's facing direction ('up', 'down', 'left', 'right') */
  direction: string;
  /** Current map ID */
  mapId: string;
}

/**
 * Debug overlay options
 *
 * Controls which debug visualizations are displayed.
 */
export interface MapDebugOptions {
  /** Show collision overlay (red = blocked, green = passable) */
  showCollisionOverlay?: boolean;
  /** Show elevation values on tiles */
  showElevationOverlay?: boolean;
  /** Show tile grid lines */
  showGridOverlay?: boolean;
  /** Show warp event markers */
  showWarpMarkers?: boolean;
  /** Show NPC debug info */
  showNpcDebug?: boolean;
}
