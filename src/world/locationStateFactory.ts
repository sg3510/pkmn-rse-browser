import type { LocationState, WarpData } from '../save/types';

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
  bikeMode?: LocationState['bikeMode'];
  isRidingBike?: boolean;
  lastHealLocation?: WarpData;
  escapeWarp?: WarpData;
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

  return {
    pos: { x: input.x, y: input.y },
    location: mapWarp,
    continueGameWarp: continueWarp,
    lastHealLocation: input.lastHealLocation ?? DEFAULT_LITTLEROOT_HEAL_WARP,
    escapeWarp: input.escapeWarp ?? DEFAULT_LITTLEROOT_HEAL_WARP,
    direction: input.direction,
    elevation: input.elevation,
    isSurfing: input.isSurfing ?? false,
    isUnderwater: input.isUnderwater ?? false,
    bikeMode: input.bikeMode ?? 'none',
    isRidingBike: input.isRidingBike ?? false,
  };
}
