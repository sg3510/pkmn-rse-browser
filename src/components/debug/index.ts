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
  ShimmerDebugInfo,
  WebGLDebugState,
  // Reflection tile debug types
  ReflectionTileDebugInfo,
  ReflectionTileGridDebugInfo,
  // Priority debug types
  SpriteSortDebugInfo,
  PriorityDebugInfo,
} from './types';
export { DEFAULT_DEBUG_OPTIONS, isDiagnosticsEnabled } from './types';

// WebGL debug utilities
export {
  BEHAVIOR_NAMES,
  getBehaviorName,
  getTileDebugInfo,
  getReflectionTileGridDebug,
} from './webglDebugUtils';
