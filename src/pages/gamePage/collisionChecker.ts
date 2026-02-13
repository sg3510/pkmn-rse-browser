/**
 * Creates a dynamic collision checker for rotating gates.
 *
 * Extracted from GamePage.tsx to reduce file size.
 * The returned function is passed to player.setDynamicCollisionChecker().
 */
import type { PlayerController, DynamicCollisionChecker } from '../../game/PlayerController';
import type { WorldManager, WorldSnapshot } from '../../game/WorldManager';
import type { RotatingGateManager } from '../../game/RotatingGateManager';

interface MutableRef<T> {
  current: T;
}

export function createRotatingGateCollisionChecker(
  playerRef: MutableRef<PlayerController | null>,
  worldManagerRef: MutableRef<WorldManager | null>,
  worldSnapshotRef: MutableRef<WorldSnapshot | null>,
  rotatingGateManager: RotatingGateManager
): DynamicCollisionChecker {
  return (targetTileX, targetTileY, direction) => {
    const worldManager = worldManagerRef.current;
    const snapshot = worldSnapshotRef.current;
    const mapAtTarget = worldManager?.findMapAtPosition(targetTileX, targetTileY)
      ?? snapshot?.maps.find((map) =>
        targetTileX >= map.offsetX
        && targetTileX < map.offsetX + map.entry.width
        && targetTileY >= map.offsetY
        && targetTileY < map.offsetY + map.entry.height
      );

    if (!mapAtTarget) return false;

    const player = playerRef.current;
    const localX = targetTileX - mapAtTarget.offsetX;
    const localY = targetTileY - mapAtTarget.offsetY;
    const tileResolver = player?.getTileResolver();
    if (!tileResolver) return false;

    return rotatingGateManager.checkCollision({
      mapId: mapAtTarget.entry.id,
      localX,
      localY,
      direction,
      nowMs: performance.now(),
      isFast: player!.isRunning() || player!.isSurfing(),
      getCollisionAtLocal: (gateLocalX, gateLocalY) => {
        const resolved = tileResolver(
          mapAtTarget.offsetX + gateLocalX,
          mapAtTarget.offsetY + gateLocalY
        );
        return resolved?.mapTile.collision ?? 1;
      },
    });
  };
}
