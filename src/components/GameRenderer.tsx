/**
 * GameRenderer - Unified game rendering component
 *
 * Automatically selects WebGL or Canvas2D backend based on browser capabilities.
 * Uses shared game logic for both backends.
 */

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { createRenderers, detectRendererType, getRendererTypeFromURL, type RendererSet, type RendererType } from '../rendering/RendererFactory';
import { WorldManager, type WorldSnapshot } from '../game/WorldManager';
import { PlayerController } from '../game/PlayerController';
import { CameraController, createWebGLCameraController } from '../game/CameraController';
import { ObjectEventManager } from '../game/ObjectEventManager';
import { WarpHandler } from '../field/WarpHandler';
import { FadeController } from '../field/FadeController';
import { TileResolverFactory } from '../game/TileResolverFactory';
import { useGameLoop, type GameFrameState } from '../hooks/useGameLoop';
import { useDoorAnimations } from '../hooks/useDoorAnimations';
import { useArrowOverlay } from '../hooks/useArrowOverlay';
import { useDoorSequencer } from '../hooks/useDoorSequencer';
import { useFieldSprites } from '../hooks/useFieldSprites';
import { useWebGLSpriteBuilder } from '../hooks/useWebGLSpriteBuilder';
import { compositeWebGLFrame } from '../rendering/compositeWebGLFrame';
import { uploadTilesetsFromSnapshot } from '../rendering/webgl/TilesetUploader';
import { buildWorldCameraView } from '../game/buildWorldCameraView';
import { findPlayerSpawnPosition } from '../game/findPlayerSpawnPosition';
import { loadObjectEventsFromSnapshot as loadObjectEventsFromSnapshotUtil } from '../game/loadObjectEventsFromSnapshot';
import { setupObjectCollisionChecker } from '../game/setupObjectCollisionChecker';
import { processWarpTrigger, updateWarpHandlerTile } from '../game/WarpTriggerProcessor';
import { getPlayerAtlasName, getFieldEffectAtlasName } from '../rendering/spriteUtils';
import { computeReflectionState, type ReflectionMetaProvider } from '../field/ReflectionRenderer';
import { getReflectionMetaFromSnapshot, buildTilesetRuntimesForSnapshot, createRenderContextFromSnapshot } from '../game/snapshotUtils';
import { npcSpriteCache } from '../game/npc/NPCSpriteLoader';
import { resolveTileAt } from '../components/map/utils';
import { DEFAULT_VIEWPORT_CONFIG, getViewportPixelSize } from '../config/viewport';
import { METATILE_SIZE } from '../utils/mapLoader';
import { DebugPanel, DEFAULT_DEBUG_OPTIONS, type DebugOptions, type DebugState } from './debug';
import { DialogBox, useDialog } from './dialog';
import type { ReflectionState } from './map/types';
import type { TilesetRuntime as TilesetRuntimeType } from '../utils/tilesetUtils';
import type { WebGLSpriteRenderer } from '../rendering/webgl/WebGLSpriteRenderer';
import type { CardinalDirection } from '../field/types';
import type { RenderContext } from '../rendering/types';

export interface GameRendererProps {
  mapId: string;
  mapName?: string;
  zoom?: number;
  forceRenderer?: RendererType;
}

export interface GameRendererHandle {
  getPlayerPosition: () => { tileX: number; tileY: number; direction: string; mapId: string } | null;
  getRendererType: () => RendererType;
}

const VIEWPORT_CONFIG = DEFAULT_VIEWPORT_CONFIG;
const VIEWPORT_PIXEL_SIZE = getViewportPixelSize(VIEWPORT_CONFIG);

export const GameRenderer = forwardRef<GameRendererHandle, GameRendererProps>(({
  mapId,
  mapName = 'Unknown Map',
  zoom = 1,
  forceRenderer,
}, ref) => {
  // Canvas ref
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Renderer state
  const [rendererType, setRendererType] = useState<RendererType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const renderersRef = useRef<RendererSet | null>(null);

  // Game state refs
  const worldManagerRef = useRef<WorldManager | null>(null);
  const worldSnapshotRef = useRef<WorldSnapshot | null>(null);
  const worldBoundsRef = useRef<{ width: number; height: number; minX: number; minY: number }>({ width: 0, height: 0, minX: 0, minY: 0 });
  const playerRef = useRef<PlayerController | null>(null);
  const cameraRef = useRef<CameraController | null>(null);
  const objectEventManagerRef = useRef<ObjectEventManager>(new ObjectEventManager());
  const warpHandlerRef = useRef<WarpHandler>(new WarpHandler());
  const fadeControllerRef = useRef<FadeController>(new FadeController());
  const tilesetRuntimesRef = useRef<Map<string, TilesetRuntimeType>>(new Map());
  const playerLoadedRef = useRef(false);
  const playerHiddenRef = useRef(false);
  const tilesetsUploadedRef = useRef(false);
  const fieldSpritesLoadedRef = useRef(false);
  const doorSpritesUploadedRef = useRef<Set<string>>(new Set());
  const arrowSpriteUploadedRef = useRef(false);

  // Debug state
  const [debugOptions, setDebugOptions] = useState<DebugOptions>(DEFAULT_DEBUG_OPTIONS);
  const [debugState] = useState<DebugState>({
    player: null,
    tile: null,
    objectsAtPlayerTile: null,
    objectsAtFacingTile: null,
    adjacentObjects: null,
    allVisibleNPCs: [],
    allVisibleItems: [],
    totalNPCCount: 0,
    totalItemCount: 0,
  });

  // Hooks
  const doorAnimations = useDoorAnimations();
  const arrowOverlay = useArrowOverlay();
  const fieldSprites = useFieldSprites();
  const doorSequencer = useDoorSequencer({ warpHandler: warpHandlerRef.current });
  useDialog();
  const { buildSprites } = useWebGLSpriteBuilder();

  // Expose handle
  useImperativeHandle(ref, () => ({
    getPlayerPosition: () => {
      const player = playerRef.current;
      const snapshot = worldSnapshotRef.current;
      if (!player || !snapshot) return null;
      return {
        tileX: player.tileX,
        tileY: player.tileY,
        direction: player.dir,
        mapId: snapshot.anchorMapId,
      };
    },
    getRendererType: () => rendererType ?? 'canvas2d',
  }), [rendererType]);

  // Get RenderContext from snapshot for tile resolution
  const getRenderContextFromSnapshot = useCallback((snapshot: WorldSnapshot): RenderContext | null => {
    return createRenderContextFromSnapshot(snapshot, tilesetRuntimesRef.current);
  }, []);

  // Compute reflection state from snapshot
  const computeReflectionStateFromSnapshot = useCallback((
    snapshot: WorldSnapshot,
    tileX: number,
    tileY: number,
    prevTileX: number,
    prevTileY: number,
    spriteWidth: number = 16,
    spriteHeight: number = 32
  ): ReflectionState => {
    const metaProvider: ReflectionMetaProvider = (x, y) =>
      getReflectionMetaFromSnapshot(snapshot, tilesetRuntimesRef.current, x, y);

    return computeReflectionState(metaProvider, tileX, tileY, prevTileX, prevTileY, spriteWidth, spriteHeight);
  }, []);

  // Load object events from snapshot
  const loadObjectEventsFromSnapshot = useCallback(async (snapshot: WorldSnapshot, spriteRenderer: WebGLSpriteRenderer | null): Promise<void> => {
    await loadObjectEventsFromSnapshotUtil({
      snapshot,
      objectEventManager: objectEventManagerRef.current,
      spriteCache: npcSpriteCache,
      spriteRenderer,
    });
  }, []);

  // Initialize renderers and game
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;

    const init = async () => {
      try {
        // Determine renderer type preference
        const urlType = getRendererTypeFromURL();
        const preferredType = forceRenderer ?? urlType ?? detectRendererType();

        // Create renderers (may fallback to Canvas2D if WebGL fails)
        const renderers = createRenderers({
          viewportWidth: VIEWPORT_PIXEL_SIZE.width,
          viewportHeight: VIEWPORT_PIXEL_SIZE.height,
          forceType: preferredType,
        });
        if (disposed) return;
        renderersRef.current = renderers;

        // Set actual renderer type (may differ from preferred if WebGL failed)
        setRendererType(renderers.type);

        // Create world manager
        const worldManager = new WorldManager();
        worldManagerRef.current = worldManager;

        // Initialize world
        const snapshot = await worldManager.initialize(mapId);
        if (disposed) return;
        worldSnapshotRef.current = snapshot;

        // Update world bounds
        const bounds = snapshot.worldBounds;
        worldBoundsRef.current = {
          width: bounds.width * METATILE_SIZE,
          height: bounds.height * METATILE_SIZE,
          minX: bounds.minX,
          minY: bounds.minY,
        };

        // Build tileset runtimes for reflection detection
        buildTilesetRuntimesForSnapshot(snapshot, tilesetRuntimesRef.current);

        // Upload tilesets for WebGL
        if (renderers.type === 'webgl' && renderers.getWebGLPipeline) {
          const pipeline = renderers.getWebGLPipeline();
          const resolver = TileResolverFactory.fromSnapshot(snapshot);
          pipeline.setTileResolver(resolver);
          uploadTilesetsFromSnapshot(pipeline, snapshot);
          tilesetsUploadedRef.current = true;
        }

        // Create player
        const player = new PlayerController();
        playerRef.current = player;

        // Set up tile resolver for player collision
        const playerResolver = TileResolverFactory.createPlayerResolver(snapshot);
        player.setTileResolver(playerResolver);

        // Set up object collision checker
        setupObjectCollisionChecker(player, objectEventManagerRef.current);

        // Create camera
        const camera = createWebGLCameraController(
          VIEWPORT_CONFIG.tilesWide,
          VIEWPORT_CONFIG.tilesHigh
        );
        cameraRef.current = camera;

        // Find spawn position
        const anchorMap = snapshot.maps.find(m => m.entry.id === mapId);
        if (anchorMap) {
          // Build behavior provider
          const renderContext = getRenderContextFromSnapshot(snapshot);
          const getBehavior = (x: number, y: number): number => {
            if (!renderContext) return 0;
            const resolved = resolveTileAt(renderContext, anchorMap.offsetX + x, anchorMap.offsetY + y);
            return resolved?.attributes?.behavior ?? 0;
          };

          const spawnResult = findPlayerSpawnPosition(
            anchorMap.mapData,
            anchorMap.warpEvents,
            getBehavior
          );

          const spawnX = anchorMap.offsetX + spawnResult.x;
          const spawnY = anchorMap.offsetY + spawnResult.y;
          player.setPosition(spawnX * METATILE_SIZE, spawnY * METATILE_SIZE);
        }

        // Load player sprites
        await player.loadSprite('walking', '/pokeemerald/graphics/object_events/pics/people/brendan/walking.png');
        await player.loadSprite('running', '/pokeemerald/graphics/object_events/pics/people/brendan/running.png');
        await player.loadSprite('surfing', '/pokeemerald/graphics/object_events/pics/people/brendan/surfing.png');
        await player.loadSprite('shadow', '/pokeemerald/graphics/field_effects/pics/shadow_medium.png');
        if (disposed) return;

        // Upload player sprites for WebGL
        if (renderers.type === 'webgl') {
          const spriteRenderer = renderers.spriteRenderer as WebGLSpriteRenderer;

          // Upload all loaded player sprite sheets
          const spriteSheets = player.getSpriteSheets();
          for (const [key, canvas] of spriteSheets) {
            const atlasName = getPlayerAtlasName(key);
            spriteRenderer.uploadSpriteSheet(atlasName, canvas);
          }

          // Load and upload object events (NPCs)
          await loadObjectEventsFromSnapshot(snapshot, spriteRenderer);
        }

        // Load field sprites
        await fieldSprites.loadAll();
        if (disposed) return;

        // Upload field sprites for WebGL
        if (renderers.type === 'webgl') {
          const spriteRenderer = renderers.spriteRenderer as WebGLSpriteRenderer;
          const fieldSpriteKeys = ['grass', 'longGrass', 'sand', 'splash', 'ripple'] as const;
          for (const key of fieldSpriteKeys) {
            const canvas = fieldSprites.sprites[key];
            if (canvas) {
              const atlasName = getFieldEffectAtlasName(key);
              spriteRenderer.uploadSpriteSheet(atlasName, canvas);
            }
          }
          fieldSpritesLoadedRef.current = true;
        }

        playerLoadedRef.current = true;
        setLoading(false);
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : 'Failed to initialize game');
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      disposed = true;
      renderersRef.current?.dispose();
      renderersRef.current = null;
      worldManagerRef.current?.dispose();
      worldManagerRef.current = null;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [mapId, forceRenderer, fieldSprites, getRenderContextFromSnapshot, loadObjectEventsFromSnapshot]);

  // Game update function
  const handleUpdate = useCallback((deltaMs: number, timestamp: number) => {
    const player = playerRef.current;
    const snapshot = worldSnapshotRef.current;
    if (!player || !playerLoadedRef.current || !snapshot) return;

    // Update player
    player.update(deltaMs);

    // Update warp handler cooldown
    warpHandlerRef.current.update(deltaMs);

    // Prune door animations
    doorAnimations.prune(timestamp);

    // Update camera to follow player
    const camera = cameraRef.current;
    if (camera) {
      const { minX, minY } = worldBoundsRef.current;
      const bounds = snapshot.worldBounds;
      camera.setBounds({
        minX: minX * METATILE_SIZE,
        minY: minY * METATILE_SIZE,
        width: bounds.width * METATILE_SIZE,
        height: bounds.height * METATILE_SIZE,
      });
      camera.followTarget(player);
    }

    // Check for warps
    const renderContext = getRenderContextFromSnapshot(snapshot);
    if (renderContext) {
      const warpResult = processWarpTrigger({
        player,
        renderContext,
        warpHandler: warpHandlerRef.current,
        isDoorSequencerActive: doorSequencer.isActive(),
      });

      if (warpResult.tileChanged) {
        updateWarpHandlerTile(warpHandlerRef.current, warpResult);
      }

      // Update arrow overlay based on current tile behavior
      if (!warpHandlerRef.current.isInProgress()) {
        const resolved = resolveTileAt(renderContext, player.tileX, player.tileY);
        const behavior = resolved?.attributes?.behavior ?? 0;
        arrowOverlay.update(
          player.dir as CardinalDirection,
          player.tileX,
          player.tileY,
          behavior,
          timestamp,
          doorSequencer.isActive()
        );
      }
    }
  }, [doorAnimations, arrowOverlay, doorSequencer, getRenderContextFromSnapshot]);

  // Game render function
  const handleRender = useCallback((state: GameFrameState) => {
    const canvas = canvasRef.current;
    const renderers = renderersRef.current;
    const player = playerRef.current;
    const snapshot = worldSnapshotRef.current;

    if (!canvas || !renderers || !player || !snapshot || !playerLoadedRef.current) {
      return;
    }

    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    // Build camera view
    const camera = cameraRef.current;
    if (!camera) return;

    const camView = camera.getView(1); // +1 tile for sub-tile scrolling

    // Build world camera view using shared utility
    const view = buildWorldCameraView({
      cameraX: camView.x,
      cameraY: camView.y,
      startTileX: camView.startTileX,
      startTileY: camView.startTileY,
      subTileOffsetX: camView.subTileOffsetX,
      subTileOffsetY: camView.subTileOffsetY,
      tilesWide: camView.tilesWide,
      tilesHigh: camView.tilesHigh,
      pixelWidth: camView.tilesWide * METATILE_SIZE,
      pixelHeight: camView.tilesHigh * METATILE_SIZE,
    });

    // Get player elevation
    const playerElevation = player.getElevation();

    if (renderers.type === 'webgl' && renderers.getWebGLPipeline) {
      // WebGL rendering path
      const pipeline = renderers.getWebGLPipeline();
      const spriteRenderer = renderers.spriteRenderer as WebGLSpriteRenderer;
      const webglCanvas = renderers.webglCanvas;

      if (!webglCanvas || !tilesetsUploadedRef.current) {
        return;
      }

      // Ensure display canvas is sized to viewport
      if (canvas.width !== VIEWPORT_PIXEL_SIZE.width || canvas.height !== VIEWPORT_PIXEL_SIZE.height) {
        canvas.width = VIEWPORT_PIXEL_SIZE.width;
        canvas.height = VIEWPORT_PIXEL_SIZE.height;
      }

      // Render tiles using pipeline with proper dirty tracking
      // The pipeline internally tracks view changes and elevation changes
      // needsFullRender: false allows the pipeline to use its internal dirty tracking
      // animationChanged: provided by useGameLoop, true every 10 GBA frames (~167ms)
      pipeline.render(
        null as any, // RenderContext not used by WebGL pipeline
        view,
        playerElevation,
        { gameFrame: state.gbaFrame, needsFullRender: false, animationChanged: state.animationFrameChanged }
      );

      // Get NPCs, items, large objects, and field effects
      const npcs = objectEventManagerRef.current.getVisibleNPCs();
      const items = objectEventManagerRef.current.getVisibleItemBalls();
      const largeObjects = objectEventManagerRef.current.getVisibleLargeObjects();
      const fieldEffects = fieldSpritesLoadedRef.current
        ? player.getGrassEffectManager().getEffectsForRendering()
        : [];

      // Build sprites using extracted hook
      const spriteBuildResult = buildSprites({
        player,
        playerLoaded: playerLoadedRef.current,
        playerHidden: playerHiddenRef.current,
        snapshot,
        tilesetRuntimes: tilesetRuntimesRef.current,
        npcs,
        items,
        largeObjects,
        fieldEffects,
        spriteRenderer,
        doorAnimations,
        arrowOverlay,
        doorSequencer,
        doorSpritesUploaded: doorSpritesUploadedRef.current,
        arrowSpriteUploaded: arrowSpriteUploadedRef.current,
        nowTime: state.timestamp,
        computeReflectionState: computeReflectionStateFromSnapshot,
      });

      // Track uploaded sprites
      for (const atlasName of spriteBuildResult.newDoorSpritesUploaded) {
        doorSpritesUploadedRef.current.add(atlasName);
      }
      if (spriteBuildResult.arrowSpriteWasUploaded) {
        arrowSpriteUploadedRef.current = true;
      }

      // Get fade alpha
      const fadeAlpha = fadeControllerRef.current.isActive()
        ? fadeControllerRef.current.getAlpha(state.timestamp)
        : 0;

      // Composite frame
      compositeWebGLFrame(
        {
          pipeline,
          spriteRenderer,
          fadeRenderer: renderers.fadeRenderer as any,
          scanlineRenderer: null, // Scanlines only used in GamePage when menu is open
          ctx2d,
          webglCanvas,
          view,
          snapshot,
          tilesetRuntimes: tilesetRuntimesRef.current,
        },
        {
          lowPrioritySprites: spriteBuildResult.lowPrioritySprites,
          allSprites: spriteBuildResult.allSprites,
          priority0Sprites: spriteBuildResult.priority0Sprites,
          doorSprites: spriteBuildResult.doorSprites,
          arrowSprite: spriteBuildResult.arrowSprite,
        },
        { fadeAlpha }
      );
    } else {
      // Canvas2D fallback - simplified rendering
      ctx2d.fillStyle = '#000';
      ctx2d.fillRect(0, 0, canvas.width, canvas.height);

      ctx2d.fillStyle = '#fff';
      ctx2d.font = '14px monospace';
      ctx2d.textAlign = 'center';
      ctx2d.fillText(
        `Canvas2D mode - ${mapName}`,
        canvas.width / 2,
        canvas.height / 2 - 20
      );
      ctx2d.fillText(
        `Frame: ${state.gbaFrame} | Player: (${player.tileX}, ${player.tileY})`,
        canvas.width / 2,
        canvas.height / 2 + 20
      );
      ctx2d.fillText(
        'Canvas2D full implementation pending',
        canvas.width / 2,
        canvas.height / 2 + 60
      );
    }
  }, [mapName, buildSprites, computeReflectionStateFromSnapshot, doorAnimations, arrowOverlay, doorSequencer]);

  // Run game loop
  useGameLoop(handleUpdate, handleRender, { running: !loading && !error });

  if (error) {
    return <div style={{ color: 'red' }}>Error: {error}</div>;
  }

  return (
    <div>
      {loading && <div>Loading {mapName}...</div>}
      <div style={{
        position: 'relative',
        width: VIEWPORT_PIXEL_SIZE.width * zoom,
        height: VIEWPORT_PIXEL_SIZE.height * zoom,
      }}>
        <canvas
          ref={canvasRef}
          width={VIEWPORT_PIXEL_SIZE.width}
          height={VIEWPORT_PIXEL_SIZE.height}
          style={{
            border: '1px solid #ccc',
            imageRendering: 'pixelated',
            width: VIEWPORT_PIXEL_SIZE.width * zoom,
            height: VIEWPORT_PIXEL_SIZE.height * zoom,
          }}
        />
        <DialogBox
          viewportWidth={VIEWPORT_PIXEL_SIZE.width * zoom}
          viewportHeight={VIEWPORT_PIXEL_SIZE.height * zoom}
        />
      </div>

      {rendererType && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
          Renderer: {rendererType.toUpperCase()}
        </div>
      )}

      <DebugPanel
        options={debugOptions}
        onChange={setDebugOptions}
        state={debugState}
      />
    </div>
  );
});

GameRenderer.displayName = 'GameRenderer';
