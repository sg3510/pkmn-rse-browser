/**
 * Surfing system module exports
 */

export { SurfingController } from './SurfingController';
export { SurfBlobRenderer } from './SurfBlobRenderer';
export { InteractionHandler } from './InteractionHandler';
export type {
  SurfingState,
  SurfBlobDirection,
  SurfAnimationPhase,
  BlobBobState,
  SurfableCheckResult,
} from './types';
export {
  JUMP_Y_HIGH,
  JUMP_DURATION_FRAMES,
  JUMP_DISTANCE_PIXELS,
  createInitialSurfingState,
} from './types';
