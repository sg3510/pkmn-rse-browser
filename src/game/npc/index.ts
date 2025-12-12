/**
 * NPC Module
 *
 * Exports all NPC-related functionality:
 * - Sprite loading and caching
 * - Rendering with direction-based frames
 * - Frame info utilities
 * - Animation engine
 */

// Sprite loading
export {
  npcSpriteCache,
  getNPCSpritePath,
  getNPCFrameInfo,
  getNPCFrameRect,
  type SpriteDimensions,
} from './NPCSpriteLoader';

// Rendering
export { renderNPCs, renderSingleNPC, renderNPCReflections, renderNPCGrassEffects, type NPCRenderView } from './NPCRenderer';

// Animation
export { npcAnimationManager, shouldAnimate } from './NPCAnimationEngine';
