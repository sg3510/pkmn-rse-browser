/**
 * Type Compatibility Tests
 *
 * This file verifies that our shared interfaces are compatible with the actual
 * implementations. If WorldManager's types change, this file will fail to compile.
 *
 * This file is never executed - it only exists for compile-time type checking.
 */

import type {
  LoadedMapInstance as WMLoadedMapInstance,
  WorldSnapshot,
} from '../WorldManager';

import type {
  ILoadedMapInstance,
  IWebGLMapInstance,
  IWorldState,
  IWebGLWorldState,
  WorldBounds,
} from './IWorldState';

// =============================================================================
// Type Compatibility Assertions
// =============================================================================

/**
 * Assert that type A is assignable to type B
 * If this fails, A is missing properties that B requires
 */
type AssertAssignable<A, B> = A extends B ? true : never;

/**
 * Assert that types A and B have the same shape for specified keys
 */
type AssertSameKeys<A, B, Keys extends keyof A & keyof B> = {
  [K in Keys]: A[K] extends B[K] ? (B[K] extends A[K] ? true : never) : never;
};

// =============================================================================
// WorldManager LoadedMapInstance vs ILoadedMapInstance
// =============================================================================

// ILoadedMapInstance should be a subset of WorldManager's LoadedMapInstance
// (WorldManager has extra fields like tilesetPairIndex, which is in IWebGLMapInstance)
type _CheckBaseMapInstance = AssertSameKeys<
  WMLoadedMapInstance,
  ILoadedMapInstance,
  'entry' | 'mapData' | 'offsetX' | 'offsetY' | 'borderMetatiles' | 'warpEvents'
>;

// WorldManager's LoadedMapInstance should be assignable to IWebGLMapInstance
type _CheckWebGLMapInstance = AssertAssignable<WMLoadedMapInstance, IWebGLMapInstance>;

// Verify the assertions pass (will be `true` if types match)
// Using these in an array silences "declared but never used" warnings
const _mapInstanceCheck: _CheckWebGLMapInstance = true;
const _baseMapInstanceCheck: _CheckBaseMapInstance = { entry: true, mapData: true, offsetX: true, offsetY: true, borderMetatiles: true, warpEvents: true };

// =============================================================================
// WorldSnapshot vs IWebGLWorldState
// =============================================================================

// Check that WorldSnapshot's worldBounds matches our WorldBounds
type _CheckWorldBounds = AssertAssignable<WorldSnapshot['worldBounds'], WorldBounds>;
const _worldBoundsCheck: _CheckWorldBounds = true;

// Check core IWorldState fields exist on WorldSnapshot
type _CheckWorldStateFields = AssertSameKeys<
  WorldSnapshot,
  IWorldState,
  'anchorMapId' | 'worldBounds'
>;
const _worldStateFieldsCheck: _CheckWorldStateFields = { anchorMapId: true, worldBounds: true };

// Check WebGL-specific fields
type _CheckWebGLStateFields = AssertSameKeys<
  WorldSnapshot,
  IWebGLWorldState,
  'pairIdToGpuSlot' | 'anchorBorderMetatiles'
>;
const _webglStateFieldsCheck: _CheckWebGLStateFields = { pairIdToGpuSlot: true, anchorBorderMetatiles: true };

// =============================================================================
// Runtime sanity check (never called, just for extra verification)
// =============================================================================

function _verifyWorldSnapshotToIWebGLWorldState(snapshot: WorldSnapshot): IWebGLWorldState {
  // This function verifies we can create an IWebGLWorldState from a WorldSnapshot
  // If this doesn't compile, the interfaces are incompatible
  return {
    maps: snapshot.maps, // LoadedMapInstance[] should be assignable to IWebGLMapInstance[]
    anchorMapId: snapshot.anchorMapId,
    worldBounds: snapshot.worldBounds,
    pairIdToGpuSlot: snapshot.pairIdToGpuSlot,
    anchorBorderMetatiles: snapshot.anchorBorderMetatiles,
  };
}

// Prevent "unused" warnings - these are compile-time only
void _mapInstanceCheck;
void _baseMapInstanceCheck;
void _worldBoundsCheck;
void _worldStateFieldsCheck;
void _webglStateFieldsCheck;
void _verifyWorldSnapshotToIWebGLWorldState;
