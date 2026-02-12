/**
 * Resolve battle background profile from field context.
 *
 * C refs:
 * - public/pokeemerald/src/battle_setup.c (BattleSetup_GetEnvironmentId)
 * - public/pokeemerald/src/metatile_behavior.c
 */

import { SPECIES } from '../../data/species';
import type { WorldSnapshot } from '../../game/WorldManager';
import { getSnapshotTileBehavior } from '../../game/snapshotUtils';
import type { ScriptWildBattleRequest } from '../../scripting/battleTypes';
import {
  getBattleBridgeTypeFromBehavior,
  isBridgeOverWaterBehavior,
  isDeepOrOceanWaterBehavior,
  isIndoorEncounterBehavior,
  isLongGrassBehavior,
  isMountainBehavior,
  isSandOrDeepSandBehavior,
  isSurfableBehavior,
  isTallGrassBehavior,
} from '../../utils/metatileBehaviors';
import { resolveWeatherName } from '../../weather/registry';
import type { BattleBackgroundProfile, BattleBackgroundVariant, BattleTerrain } from './BattleBackground';

type MapType =
  | 'MAP_TYPE_TOWN'
  | 'MAP_TYPE_CITY'
  | 'MAP_TYPE_ROUTE'
  | 'MAP_TYPE_UNDERGROUND'
  | 'MAP_TYPE_INDOOR'
  | 'MAP_TYPE_SECRET_BASE'
  | 'MAP_TYPE_UNDERWATER'
  | 'MAP_TYPE_OCEAN_ROUTE';

const MAP_TYPE_UNDERGROUND: MapType = 'MAP_TYPE_UNDERGROUND';
const MAP_TYPE_INDOOR: MapType = 'MAP_TYPE_INDOOR';
const MAP_TYPE_SECRET_BASE: MapType = 'MAP_TYPE_SECRET_BASE';
const MAP_TYPE_UNDERWATER: MapType = 'MAP_TYPE_UNDERWATER';
const MAP_TYPE_OCEAN_ROUTE: MapType = 'MAP_TYPE_OCEAN_ROUTE';

const ROUTE_113_MAP_ID = 'MAP_ROUTE113';

export interface ResolveBattleEnvironmentInput {
  snapshot: WorldSnapshot | null | undefined;
  playerTileX: number;
  playerTileY: number;
  mapIdHint?: string;
  playerIsSurfing?: boolean;
  savedWeather?: string | number | null;
  wildBattle?: Pick<ScriptWildBattleRequest, 'source' | 'speciesId'> | null;
}

function resolveSpecialVariant(
  wildBattle: ResolveBattleEnvironmentInput['wildBattle'],
): BattleBackgroundVariant {
  if (!wildBattle || wildBattle.source !== 'special') {
    return 'default';
  }

  if (wildBattle.speciesId === SPECIES.KYOGRE) return 'kyogre';
  if (wildBattle.speciesId === SPECIES.GROUDON) return 'groudon';
  if (wildBattle.speciesId === SPECIES.RAYQUAZA) return 'rayquaza';
  return 'default';
}

function terrainForSpecialVariant(variant: BattleBackgroundVariant): BattleTerrain | null {
  if (variant === 'kyogre') return 'water';
  if (variant === 'groudon') return 'cave';
  if (variant === 'rayquaza') return 'plain';
  return null;
}

function resolveTerrainFromContext(
  mapType: string | null | undefined,
  tileBehavior: number,
  playerIsSurfing: boolean,
  mapId: string | undefined,
  savedWeather: string | number | null | undefined,
): BattleTerrain {
  if (isTallGrassBehavior(tileBehavior)) return 'tall_grass';
  if (isLongGrassBehavior(tileBehavior)) return 'long_grass';
  if (isSandOrDeepSandBehavior(tileBehavior)) return 'sand';

  switch (mapType as MapType | null) {
    case MAP_TYPE_UNDERGROUND:
      if (isIndoorEncounterBehavior(tileBehavior)) return 'building';
      if (isSurfableBehavior(tileBehavior)) return 'pond_water';
      return 'cave';
    case MAP_TYPE_INDOOR:
    case MAP_TYPE_SECRET_BASE:
      return 'building';
    case MAP_TYPE_UNDERWATER:
      return 'underwater';
    case MAP_TYPE_OCEAN_ROUTE:
      if (isSurfableBehavior(tileBehavior)) return 'water';
      return 'plain';
    default:
      break;
  }

  if (isDeepOrOceanWaterBehavior(tileBehavior)) return 'water';
  if (isSurfableBehavior(tileBehavior)) return 'pond_water';
  if (isMountainBehavior(tileBehavior)) return 'rock';

  if (playerIsSurfing) {
    if (getBattleBridgeTypeFromBehavior(tileBehavior) !== 'ocean') {
      return 'pond_water';
    }
    if (isBridgeOverWaterBehavior(tileBehavior)) {
      return 'water';
    }
  }

  if (mapId === ROUTE_113_MAP_ID) {
    return 'sand';
  }
  if (resolveWeatherName(savedWeather ?? '') === 'WEATHER_SANDSTORM') {
    return 'sand';
  }

  return 'plain';
}

export function resolveBattleBackgroundProfile(
  input: ResolveBattleEnvironmentInput,
): BattleBackgroundProfile {
  const variant = resolveSpecialVariant(input.wildBattle);
  const specialTerrain = terrainForSpecialVariant(variant);
  if (specialTerrain) {
    return { terrain: specialTerrain, variant };
  }

  const snapshot = input.snapshot ?? null;
  if (!snapshot || snapshot.maps.length === 0) {
    return { terrain: 'plain', variant: 'default' };
  }

  const { map, behavior } = getSnapshotTileBehavior(
    snapshot,
    input.playerTileX,
    input.playerTileY,
    input.mapIdHint,
  );
  if (!map) {
    return { terrain: 'plain', variant: 'default' };
  }

  const terrain = resolveTerrainFromContext(
    map.entry.mapType,
    behavior,
    input.playerIsSurfing === true,
    map.entry.id,
    input.savedWeather,
  );

  return { terrain, variant: 'default' };
}
