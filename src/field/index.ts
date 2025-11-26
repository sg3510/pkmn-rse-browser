/**
 * Field Effects Module Index
 *
 * Exports all field effect systems for use in the game engine.
 *
 * These modules handle:
 * - Door animations and sequencing
 * - Warp detection and state management
 * - Screen fade transitions
 * - Arrow warp indicators
 * - Water/ice reflection effects
 *
 * Usage:
 * ```typescript
 * import {
 *   FadeController,
 *   DoorSequencer,
 *   WarpHandler,
 *   ArrowOverlay,
 * } from './field';
 *
 * // Create instances
 * const fade = new FadeController();
 * const doors = new DoorSequencer();
 * const warps = new WarpHandler();
 * const arrows = new ArrowOverlay();
 * ```
 */

// Core types
export * from './types';

// Controllers and managers
export { FadeController } from './FadeController';
export {
  DoorSequencer,
  isDoorAnimationDone,
  getDoorAnimationFrame,
  type DoorEntryConfig,
  type DoorExitConfig,
  type DoorEntryState,
  type DoorExitState,
  type DoorEntryUpdateResult,
  type DoorExitUpdateResult,
} from './DoorSequencer';
export {
  WarpHandler,
  type WarpRuntimeState,
} from './WarpHandler';
export {
  ArrowOverlay,
  getArrowDirectionFromBehavior,
  ARROW_ANIMATION,
} from './ArrowOverlay';

// Reflection utilities
export {
  type ReflectionType,
  type ReflectionState,
  type SpriteFrameInfo,
  BRIDGE_OFFSETS,
  REFLECTION_TINTS,
  BRIDGE_REFLECTION_TINT,
  REFLECTION_ALPHA,
  REFLECTION_VERTICAL_OFFSET,
  calculateReflectionY,
  getReflectionTint,
  getReflectionAlpha,
  shouldRenderReflection,
  createEmptyReflectionState,
} from './ReflectionRenderer';
