import type { LocationState, WarpData } from '../save/types';
import { getDynamicWarpTarget } from '../game/DynamicWarp.ts';
import { getFixedEscapeWarpTarget } from '../game/FixedEscapeWarp.ts';

const DEFAULT_LITTLEROOT_HEAL_WARP: WarpData = {
  mapId: 'MAP_LITTLEROOT_TOWN',
  warpId: 0,
  x: 5,
  y: 3,
};

export interface BuildLocationStateInput {
  mapId: string;
  x: number;
  y: number;
  direction: LocationState['direction'];
  elevation: number;
  warpId?: number;
  isSurfing?: boolean;
  isUnderwater?: boolean;
  flashLevel?: number;
  bikeMode?: LocationState['bikeMode'];
  isRidingBike?: boolean;
  lastHealLocation?: WarpData;
  escapeWarp?: WarpData;
  dynamicWarp?: WarpData;
}

export function buildLocationState(input: BuildLocationStateInput): LocationState {
  const warpId = input.warpId ?? 0;
  const mapWarp: WarpData = {
    mapId: input.mapId,
    warpId,
    x: input.x,
    y: input.y,
  };
  const continueWarp: WarpData = {
    mapId: input.mapId,
    warpId,
    x: input.x,
    y: input.y,
  };
  const runtimeDynamicWarp = getDynamicWarpTarget();
  const runtimeEscapeWarp = getFixedEscapeWarpTarget();

  return {
    pos: { x: input.x, y: input.y },
    location: mapWarp,
    continueGameWarp: continueWarp,
    dynamicWarp: input.dynamicWarp
      ?? (runtimeDynamicWarp
        ? {
            mapId: runtimeDynamicWarp.mapId,
            warpId: runtimeDynamicWarp.warpId,
            x: runtimeDynamicWarp.x,
            y: runtimeDynamicWarp.y,
          }
        : continueWarp),
    lastHealLocation: input.lastHealLocation ?? DEFAULT_LITTLEROOT_HEAL_WARP,
    escapeWarp: input.escapeWarp
      ?? (runtimeEscapeWarp
        ? {
            mapId: runtimeEscapeWarp.mapId,
            warpId: runtimeEscapeWarp.warpId,
            x: runtimeEscapeWarp.x,
            y: runtimeEscapeWarp.y,
          }
        : DEFAULT_LITTLEROOT_HEAL_WARP),
    direction: input.direction,
    elevation: input.elevation,
    isSurfing: input.isSurfing ?? false,
    isUnderwater: input.isUnderwater ?? false,
    flashLevel: input.flashLevel ?? 0,
    bikeMode: input.bikeMode ?? 'none',
    isRidingBike: input.isRidingBike ?? false,
  };
}
