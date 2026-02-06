---
title: Refactor 2.4: Thin MapRenderer Component
status: reference
last_verified: 2026-01-13
---

# Refactor 2.4: Thin MapRenderer Component

## Goal

Reduce `MapRenderer.tsx` from **3,669 lines** to **~200 lines**.

The component should be a thin orchestrator that:
1. Sets up the canvas
2. Initializes the game engine
3. Wires up rendering
4. Handles React lifecycle

All logic lives in extracted modules.

---

## Target: MapRenderer.tsx (~200 lines)

```typescript
/**
 * MapRenderer - Thin React wrapper for the game engine
 *
 * This component orchestrates:
 * - Canvas setup
 * - Game engine initialization
 * - Asset loading
 * - Debug panel integration
 *
 * All game logic lives in src/engine/
 * All rendering logic lives in src/rendering/
 */

import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { useGameEngine } from '../hooks/useGameEngine';
import { useMapAssets } from '../hooks/useMapAssets';
import { useInput } from '../hooks/useInput';
import { RenderPipeline } from '../rendering/RenderPipeline';
import { DebugPanel, useDebugOptions } from './debug';
import { DialogBox, useDialog } from './dialog';
import type { MapRendererProps, MapRendererHandle } from './MapRendererTypes';

const MapRenderer = forwardRef<MapRendererHandle, MapRendererProps>((props, ref) => {
  const { mapId, mapName, width, height, zoom = 2 } = props;

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load map assets (tilesets, sprites, animations)
  const { world, assets, loading, error } = useMapAssets(props);

  // Initialize game engine with loaded world
  const { gameState, engine } = useGameEngine(world, assets);

  // Set up input handling
  useInput(engine?.getPlayerController());

  // Rendering pipeline
  const renderPipelineRef = useRef<RenderPipeline | null>(null);

  // Debug state
  const { debugOptions, setDebugOptions, showDebugPanel, setShowDebugPanel } = useDebugOptions();

  // Dialog state
  const { dialog, showDialog, hideDialog } = useDialog();

  // Expose imperative methods via ref
  useImperativeHandle(ref, () => ({
    saveGame: () => engine?.saveGame() ?? { success: false, error: 'Engine not initialized' },
    loadGame: () => engine?.loadGame() ?? null,
    getPlayerPosition: () => engine?.getPlayerPosition() ?? null,
  }), [engine]);

  // Initialize render pipeline when assets are loaded
  useEffect(() => {
    if (!assets?.tilesetCache) return;

    renderPipelineRef.current = new RenderPipeline(assets.tilesetCache);

    return () => {
      renderPipelineRef.current = null;
    };
  }, [assets]);

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const pipeline = renderPipelineRef.current;

    if (!canvas || !ctx || !pipeline || !gameState) return;

    // Render current frame
    pipeline.render(ctx, gameState, {
      showCollision: debugOptions.showCollisionOverlay,
      showElevation: debugOptions.showElevationOverlay,
    });

  }, [gameState, debugOptions]);

  // Canvas dimensions
  const canvasWidth = width * zoom;
  const canvasHeight = height * zoom;

  // Loading state
  if (loading) {
    return <div className="loading">Loading {mapName}...</div>;
  }

  // Error state
  if (error) {
    return <div className="error">Error loading map: {error.message}</div>;
  }

  return (
    <div className="map-renderer" style={{ position: 'relative' }}>
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        style={{
          width: canvasWidth,
          height: canvasHeight,
          imageRendering: 'pixelated',
        }}
      />

      {/* Debug panel overlay */}
      {showDebugPanel && gameState && (
        <DebugPanel
          state={gameState}
          options={debugOptions}
          onOptionsChange={setDebugOptions}
          onClose={() => setShowDebugPanel(false)}
        />
      )}

      {/* Dialog box overlay */}
      {dialog && (
        <DialogBox
          {...dialog}
          onClose={hideDialog}
        />
      )}
    </div>
  );
});

MapRenderer.displayName = 'MapRenderer';

export default MapRenderer;
export type { MapRendererProps, MapRendererHandle };
```

---

## Supporting Types: `MapRendererTypes.ts`

```typescript
/**
 * Types for MapRenderer component
 */

export interface MapRendererProps {
  mapId: string;
  mapName: string;
  width: number;
  height: number;
  layoutPath: string;
  primaryTilesetPath: string;
  secondaryTilesetPath: string;
  primaryTilesetId: string;
  secondaryTilesetId: string;
  zoom?: number;
}

export interface MapRendererHandle {
  saveGame: () => SaveResult;
  loadGame: () => SaveData | null;
  getPlayerPosition: () => PlayerPosition | null;
}

export interface PlayerPosition {
  tileX: number;
  tileY: number;
  direction: string;
  mapId: string;
}
```

---

## Hook: `useMapAssets.ts` (~150 lines)

Handles all asset loading.

```typescript
/**
 * useMapAssets - Load all assets needed for a map
 *
 * Loads:
 * - Tileset images and palettes
 * - Tileset animations
 * - Sprite sheets (player, NPCs, effects)
 * - Map layout data
 */

export function useMapAssets(props: MapRendererProps) {
  const [world, setWorld] = useState<WorldState | null>(null);
  const [assets, setAssets] = useState<GameAssets | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const mapManagerRef = useRef(new MapManager());
  const tilesetCacheRef = useRef(new TilesetCanvasCache());

  useEffect(() => {
    let cancelled = false;

    async function loadAssets() {
      try {
        setLoading(true);

        // Load world (map + connections)
        const loadedWorld = await mapManagerRef.current.loadWorld(props.mapId);
        if (cancelled) return;

        // Load tileset runtimes
        const tilesetRuntimes = await loadTilesetRuntimes(loadedWorld, tilesetCacheRef.current);
        if (cancelled) return;

        // Load sprite assets
        const sprites = await loadSprites();
        if (cancelled) return;

        setWorld(loadedWorld);
        setAssets({
          tilesetCache: tilesetCacheRef.current,
          tilesetRuntimes,
          sprites,
        });
        setLoading(false);

      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
          setLoading(false);
        }
      }
    }

    loadAssets();

    return () => {
      cancelled = true;
    };
  }, [props.mapId]);

  return { world, assets, loading, error };
}
```

---

## Hook: `useGameEngine.ts` (~100 lines)

```typescript
/**
 * useGameEngine - Initialize and run the game engine
 */

export function useGameEngine(world: WorldState | null, assets: GameAssets | null) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  useEffect(() => {
    if (!world || !assets) return;

    // Create engine
    const engine = new GameEngine(world, assets);
    engineRef.current = engine;

    // Start game loop with state callback
    engine.start((state) => {
      setGameState(state);
    });

    return () => {
      engine.stop();
      engineRef.current = null;
    };
  }, [world, assets]);

  return {
    gameState,
    engine: engineRef.current,
  };
}
```

---

## Hook: `useInput.ts` (~80 lines)

```typescript
/**
 * useInput - Handle keyboard and gamepad input
 */

export function useInput(playerController: PlayerController | null) {
  useEffect(() => {
    if (!playerController) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
          playerController.startMove('up');
          break;
        case 'ArrowDown':
        case 's':
          playerController.startMove('down');
          break;
        case 'ArrowLeft':
        case 'a':
          playerController.startMove('left');
          break;
        case 'ArrowRight':
        case 'd':
          playerController.startMove('right');
          break;
        case ' ':
        case 'Enter':
          playerController.interact();
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const directions = ['ArrowUp', 'w', 'ArrowDown', 's', 'ArrowLeft', 'a', 'ArrowRight', 'd'];
      if (directions.includes(e.key)) {
        playerController.stopMove();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [playerController]);
}
```

---

## File Size Summary

| File | Target Lines | Purpose |
|------|--------------|---------|
| MapRenderer.tsx | ~120 | Main component |
| MapRendererTypes.ts | ~30 | Type definitions |
| useMapAssets.ts | ~150 | Asset loading |
| useGameEngine.ts | ~100 | Engine lifecycle |
| useInput.ts | ~80 | Input handling |
| **Total** | **~480** | Split across 5 files |

Compare to current: **3,669 lines in one file**!

---

## Migration Steps

1. **Create types file** `MapRendererTypes.ts`
2. **Extract useMapAssets** from current asset loading code
3. **Extract useInput** from current input handling
4. **Create useGameEngine** hook
5. **Rewrite MapRenderer** to use hooks
6. **Delete old code** from MapRenderer
7. **Test thoroughly** - all features must work

---

## What Stays in MapRenderer

Only React-specific orchestration:
- Canvas ref setup
- Hook composition
- Debug panel toggle
- Dialog overlay
- Error/loading states

---

## What Moves Out

Everything else:
- Game loop → `GameEngine`
- Rendering → `RenderPipeline`
- Input → `useInput`
- Assets → `useMapAssets`
- Door/warp logic → `field/` modules
- NPC handling → `objects/` modules
- Effects → `FieldEffectManager`
