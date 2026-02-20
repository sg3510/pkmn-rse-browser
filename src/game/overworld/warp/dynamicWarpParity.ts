import { setDynamicWarpTarget } from '../../DynamicWarp.ts';

/**
 * C parity: SetupWarp primes dynamic warp when entering a map whose arrival
 * warp points back to MAP_DYNAMIC (e.g. Marine/Terra Cave entrances).
 * Reference: public/pokeemerald/src/field_control_avatar.c (SetupWarp)
 */
export function maybePrimeDynamicWarpReturn(
  sourceMapId: string,
  sourceWarpEvent: { x: number; y: number; destMap: string; destWarpId: number },
  sourceMapWarpEvents: ReadonlyArray<{ x: number; y: number; destMap: string; destWarpId: number }>,
  sourcePlayerLocalPosition: { x: number; y: number },
  destinationWarpEvents: ReadonlyArray<{ destMap: string }>
): void {
  const destinationWarpId = sourceWarpEvent.destWarpId;
  if (!Number.isInteger(destinationWarpId) || destinationWarpId < 0) {
    return;
  }

  if (destinationWarpId >= destinationWarpEvents.length) {
    return;
  }

  const destinationArrivalWarp = destinationWarpEvents[destinationWarpId];
  if (!destinationArrivalWarp || destinationArrivalWarp.destMap !== 'MAP_DYNAMIC') {
    return;
  }

  const sourceWarpId = sourceMapWarpEvents.findIndex((warpEvent) =>
    warpEvent.x === sourceWarpEvent.x
    && warpEvent.y === sourceWarpEvent.y
    && warpEvent.destMap === sourceWarpEvent.destMap
    && warpEvent.destWarpId === sourceWarpEvent.destWarpId
  );

  setDynamicWarpTarget(
    sourceMapId,
    sourcePlayerLocalPosition.x,
    sourcePlayerLocalPosition.y,
    sourceWarpId >= 0 ? sourceWarpId : 0
  );
}
