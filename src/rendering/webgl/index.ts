/**
 * WebGL rendering module
 *
 * Exports all WebGL-related classes for tile rendering.
 */

// Phase 2: Foundation
export { WebGLContext, isWebGL2Supported } from './WebGLContext';
export {
  WebGLShaders,
  TILE_VERTEX_SHADER,
  TILE_FRAGMENT_SHADER,
  COMPOSITE_VERTEX_SHADER,
  COMPOSITE_FRAGMENT_SHADER,
  SIMPLE_QUAD_VERTEX_SHADER,
  SIMPLE_QUAD_FRAGMENT_SHADER,
} from './WebGLShaders';
export { WebGLQuadRenderer } from './WebGLQuadRenderer';

// Phase 3: Instanced Rendering
export { WebGLBufferManager } from './WebGLBufferManager';
export { WebGLTextureManager } from './WebGLTextureManager';
export { WebGLTileRenderer } from './WebGLTileRenderer';
export type { Viewport, ScrollOffset } from './WebGLTileRenderer';
export { TileInstanceBuilder, packTileInstances } from './TileInstanceBuilder';

// Phase 5: 3-Pass System
export { WebGLFramebufferManager } from './WebGLFramebufferManager';
export { WebGLCompositor } from './WebGLCompositor';
export { WebGLPassRenderer } from './WebGLPassRenderer';
export type { PassRenderOptions } from './WebGLPassRenderer';
export { WebGLRenderPipeline } from './WebGLRenderPipeline';

// Phase 6: Tileset Upload Helpers
export { uploadTilesetsFromSnapshot, combineTilesetPalettes } from './TilesetUploader';

// Phase 7: Sprite Rendering
export { WebGLSpriteRenderer } from './WebGLSpriteRenderer';

// Test component
export { WebGLTest } from './WebGLTest';

// Types
export type {
  WebGLCapabilities,
  WebGLExtensions,
  TileInstance,
  PackedTileInstance,
  TileShaderUniforms,
  TileShaderAttributes,
  CompositeShaderUniforms,
  ShaderProgram,
} from './types';

export { packTileInstance } from './types';
