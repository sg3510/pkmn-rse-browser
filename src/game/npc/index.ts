/**
 * NPC Module
 *
 * Exports all NPC-related functionality:
 * - Sprite loading and caching
 * - Rendering with direction-based frames
 * - Frame info utilities
 * - Animation engine
 * - Movement engine
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

// Object-event affine animation manager
export { objectEventAffineManager, type ObjectEventAffineTransform } from './ObjectEventAffineManager';

// Movement engine
export {
  npcMovementEngine,
  type NPCMovementState,
  type MovementContext,
  type NPCPositionUpdate,
  type CollisionResult,
  gbaToDirection,
  directionToGBA,
} from './NPCMovementEngine';

// Collision detection
export {
  getCollisionInDirection,
  isOutsideMovementRange,
  createCollisionContext,
  type CollisionContext,
} from './NPCCollision';

// Movement type handlers
export { registerMovementHandlers } from './movementTypes';
