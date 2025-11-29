/**
 * Game Types Module
 *
 * Shared type definitions for world management, rendering, and game logic.
 */

export type {
  // Base interfaces
  WorldBounds,
  ILoadedMapInstance,
  IWorldState,
  IWorldProvider,
  // WebGL extensions
  IWebGLMapInstance,
  IWebGLWorldState,
  IWebGLWorldProvider,
  // Canvas2D extensions
  ICanvas2DMapInstance,
} from './IWorldState';
