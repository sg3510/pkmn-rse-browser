import { useEffect, useCallback, useRef, type RefObject } from 'react';
import type { PlayerController } from '../../game/PlayerController';
import type { WorldSnapshot } from '../../game/WorldManager';
import type { RenderContext } from '../../rendering/types';
import type { CameraController } from '../../game/CameraController';
import { describeTile } from '../../components/map/utils';
import {
  isDiagnosticsEnabled,
  type DebugTileInfo,
  type DebugOptions,
  type PlayerDebugInfo,
} from '../../components/debug';

import type { MutableRef } from './types';

interface UseDebugTileGridDeps {
  debugOptions: DebugOptions;
  playerDebugInfo: PlayerDebugInfo | null;
  playerRef: MutableRef<PlayerController | null>;
  worldSnapshotRef: MutableRef<WorldSnapshot | null>;
  cameraRef: MutableRef<CameraController | null>;
  viewportPixelSizeRef: MutableRef<{ width: number; height: number }>;
  debugCanvasRef: RefObject<HTMLCanvasElement | null>;
  webglCanvasRef: MutableRef<HTMLCanvasElement | null>;
  debugTilesRef: MutableRef<DebugTileInfo[]>;
  getRenderContextFromSnapshot: (snapshot: WorldSnapshot) => RenderContext | null;
}

/**
 * Hook that renders the 3x3 debug tile grid and computes center tile info
 * when the debug panel is open and the player moves.
 */
export function useDebugTileGrid(deps: UseDebugTileGridDeps) {
  const {
    debugOptions,
    playerDebugInfo,
    playerRef,
    worldSnapshotRef,
    cameraRef,
    viewportPixelSizeRef,
    debugCanvasRef,
    webglCanvasRef,
    debugTilesRef,
    getRenderContextFromSnapshot,
  } = deps;

  const centerTileInfoRef = useRef<DebugTileInfo | null>(null);

  useEffect(() => {
    if (!isDiagnosticsEnabled(debugOptions) || !playerDebugInfo) {
      centerTileInfoRef.current = null;
      return;
    }

    const snapshot = worldSnapshotRef.current;
    if (!snapshot) return;

    const renderContext = getRenderContextFromSnapshot(snapshot);
    if (!renderContext) return;

    const player = playerRef.current;
    if (!player) return;

    const info = describeTile(renderContext, player.tileX, player.tileY, player);
    centerTileInfoRef.current = info.inBounds ? info : null;

    // Render 3x3 debug grid
    const dbgCanvas = debugCanvasRef.current;
    const webglCanvas = webglCanvasRef.current;
    if (dbgCanvas && webglCanvas) {
      const CELL_SCALE = 3;
      const CELL_SIZE = 16 * CELL_SCALE;
      const GRID_SIZE = CELL_SIZE * 3;

      dbgCanvas.width = GRID_SIZE;
      dbgCanvas.height = GRID_SIZE;
      const dbgCtx = dbgCanvas.getContext('2d');
      if (dbgCtx) {
        dbgCtx.imageSmoothingEnabled = false;
        dbgCtx.fillStyle = '#111';
        dbgCtx.fillRect(0, 0, GRID_SIZE, GRID_SIZE);

        const viewportPx = viewportPixelSizeRef.current;
        const camera = cameraRef.current;
        const cameraPos = camera?.getPosition();
        const cameraWorldX = cameraPos ? Math.round(cameraPos.x - viewportPx.width / 2) : 0;
        const cameraWorldY = cameraPos ? Math.round(cameraPos.y - viewportPx.height / 2) : 0;
        const collected: DebugTileInfo[] = [];

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const tileX = player.tileX + dx;
            const tileY = player.tileY + dy;
            const tileInfo = describeTile(renderContext, tileX, tileY, player);
            collected.push(tileInfo);

            const destX = (dx + 1) * CELL_SIZE;
            const destY = (dy + 1) * CELL_SIZE;
            const screenX = tileX * 16 - cameraWorldX;
            const screenY = tileY * 16 - cameraWorldY;
            const visible =
              screenX + 16 > 0 && screenY + 16 > 0 &&
              screenX < viewportPx.width && screenY < viewportPx.height;

            if (tileInfo.inBounds && visible) {
              dbgCtx.drawImage(
                webglCanvas,
                screenX, screenY, 16, 16,
                destX, destY, CELL_SIZE, CELL_SIZE
              );
            } else {
              dbgCtx.fillStyle = '#333';
              dbgCtx.fillRect(destX, destY, CELL_SIZE, CELL_SIZE);
            }

            dbgCtx.fillStyle = 'rgba(0,0,0,0.6)';
            dbgCtx.fillRect(destX, destY, CELL_SIZE, 16);
            dbgCtx.strokeStyle = dx === 0 && dy === 0 ? '#ff00aa' : 'rgba(255,255,255,0.3)';
            dbgCtx.lineWidth = 2;
            dbgCtx.strokeRect(destX + 1, destY + 1, CELL_SIZE - 2, CELL_SIZE - 2);
            dbgCtx.fillStyle = '#fff';
            dbgCtx.font = '12px monospace';
            const label = tileInfo.inBounds
              ? `${tileInfo.metatileId ?? '??'}` + (tileInfo.isReflective ? ' R' : '')
              : 'OOB';
            dbgCtx.fillText(label, destX + 4, destY + 12);
          }
        }

        debugTilesRef.current = collected;
      }
    }
  }, [debugOptions.diagnosticsEnabled, debugOptions.enabled, playerDebugInfo]);

  const getCenterTileInfo = useCallback(() => centerTileInfoRef.current, []);

  const handleCopyTileDebug = useCallback(() => {
    const info = centerTileInfoRef.current;
    if (!info) return;
    navigator.clipboard.writeText(JSON.stringify(info, null, 2)).catch(() => { /* noop */ });
  }, []);

  return { getCenterTileInfo, handleCopyTileDebug };
}
