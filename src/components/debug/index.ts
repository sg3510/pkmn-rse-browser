/**
 * Debug Module
 *
 * Provides debugging tools for the game:
 * - DebugPanel: Slide-out sidebar with debug controls
 * - Debug overlay rendering
 * - Debug state management
 */

export { DebugPanel } from './DebugPanel';
export type {
  DebugOptions,
  DebugState,
  DebugTileInfo,
  PlayerDebugInfo,
  TileDebugInfo,
  ObjectsAtTileInfo,
  ObjectDebugInfo,
  // WebGL-specific types
  LoadedMapDebugInfo,
  ConnectionDebugInfo,
  TilesetBoundaryDebugInfo,
  MapStitchingDebugInfo,
  WarpDebugInfo,
  RenderStatsDebugInfo,
  WebGLDebugState,
} from './types';
export { DEFAULT_DEBUG_OPTIONS } from './types';
