/**
 * Movement Type Handler Registry
 *
 * Registers all movement type handlers with the NPCMovementEngine.
 */

import type { NPCMovementType } from '../../../types/objectEvents';
import type { MovementTypeHandler } from '../NPCMovementEngine';
import { npcMovementEngine } from '../NPCMovementEngine';

// Import handlers
import { faceDirectionHandler } from './faceDirection';
import { lookAroundHandler } from './lookAround';
import { wanderAroundHandler } from './wanderAround';
import { wanderUpAndDownHandler, wanderLeftAndRightHandler } from './wanderDirectional';
import {
  faceDownAndUpHandler,
  faceLeftAndRightHandler,
  faceUpAndLeftHandler,
  faceUpAndRightHandler,
  faceDownAndLeftHandler,
  faceDownAndRightHandler,
  faceDownUpAndLeftHandler,
  faceDownUpAndRightHandler,
  faceUpLeftAndRightHandler,
  faceDownLeftAndRightHandler,
} from './faceDirectional';

/**
 * Handler map for reference
 */
export const movementHandlers: Record<NPCMovementType, MovementTypeHandler | null> = {
  // Static types
  none: faceDirectionHandler, // Does nothing, same as face
  face_up: faceDirectionHandler,
  face_down: faceDirectionHandler,
  face_left: faceDirectionHandler,
  face_right: faceDirectionHandler,
  invisible: null, // No movement needed

  // Looking types
  look_around: lookAroundHandler,

  // 2-direction face types (look in 2 directions)
  face_down_and_up: faceDownAndUpHandler,
  face_left_and_right: faceLeftAndRightHandler,
  face_up_and_left: faceUpAndLeftHandler,
  face_up_and_right: faceUpAndRightHandler,
  face_down_and_left: faceDownAndLeftHandler,
  face_down_and_right: faceDownAndRightHandler,

  // 3-direction face types (look in 3 directions)
  face_down_up_and_left: faceDownUpAndLeftHandler,
  face_down_up_and_right: faceDownUpAndRightHandler,
  face_up_left_and_right: faceUpLeftAndRightHandler,
  face_down_left_and_right: faceDownLeftAndRightHandler,

  // Wander types
  wander_around: wanderAroundHandler,
  wander_up_and_down: wanderUpAndDownHandler,
  wander_left_and_right: wanderLeftAndRightHandler,

  // Walk in place - TODO: implement walk animation while stationary
  walk_in_place: faceDirectionHandler, // For now, just face

  // Copy player - TODO: requires player position tracking
  copy_player: faceDirectionHandler, // For now, just face

  // Other/unrecognized
  other: faceDirectionHandler, // Default to static
};

/**
 * Register all handlers with the movement engine
 */
export function registerMovementHandlers(): void {
  for (const [type, handler] of Object.entries(movementHandlers)) {
    if (handler) {
      npcMovementEngine.registerHandler(type as NPCMovementType, handler);
    }
  }
}

// Export individual handlers for testing
export {
  faceDirectionHandler,
  lookAroundHandler,
  wanderAroundHandler,
  wanderUpAndDownHandler,
  wanderLeftAndRightHandler,
  faceDownAndUpHandler,
  faceLeftAndRightHandler,
  faceUpAndLeftHandler,
  faceUpAndRightHandler,
  faceDownAndLeftHandler,
  faceDownAndRightHandler,
  faceDownUpAndLeftHandler,
  faceDownUpAndRightHandler,
  faceUpLeftAndRightHandler,
  faceDownLeftAndRightHandler,
};
