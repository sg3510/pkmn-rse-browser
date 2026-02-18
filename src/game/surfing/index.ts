/**
 * Surfing system module exports
 */

export { SurfingController } from './SurfingController.ts';
export { SurfBlobRenderer } from './SurfBlobRenderer.ts';
export { InteractionHandler } from './InteractionHandler.ts';
export type {
  SurfingState,
  SurfBlobDirection,
  SurfAnimationPhase,
  BlobBobState,
  SurfableCheckResult,
} from './types.ts';
export {
  JUMP_Y_HIGH,
  JUMP_DURATION_FRAMES,
  JUMP_DISTANCE_PIXELS,
  createInitialSurfingState,
} from './types.ts';
