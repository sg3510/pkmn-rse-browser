/**
 * Hooks Module Index
 *
 * Exports all custom React hooks for the game engine.
 *
 * Core hooks:
 * - useInput: Keyboard input tracking
 * - useGameEngine: Game loop lifecycle
 *
 * Map-specific hooks are in ./map/
 */

// Core hooks
export { useInput, type UseInputOptions } from './useInput';
export { useGameEngine, type UseGameEngineOptions } from './useGameEngine';
export { useDoorSequencer, type UseDoorSequencerOptions, type UseDoorSequencerReturn } from './useDoorSequencer';
export { useFieldSprites, type FieldSprites, type FieldSpriteKey, type UseFieldSpritesReturn } from './useFieldSprites';

// Map hooks
export { useMapAssets, type TilesetRuntime, type LoadedAnimation, type ReflectionMeta } from './map/useMapAssets';
export { useMapLogic, resolveTileAt, type ResolvedTile, type RenderContext } from './map/useMapLogic';
