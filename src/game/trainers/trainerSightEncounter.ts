/**
 * Trainer sight encounter detection.
 *
 * C references:
 * - public/pokeemerald/src/field_control_avatar.c (CheckForTrainersWantingBattle call site)
 * - public/pokeemerald/src/trainer_see.c (CheckForTrainersWantingBattle, GetTrainerApproachDistance, CheckPathBetweenTrainerAndPlayer)
 */

import type { ScriptCommand } from '../../data/scripts/types.ts';
import type { NPCDirection, NPCObject } from '../../types/objectEvents.ts';
import {
  MB_DEEP_SAND,
  MB_IMPASSABLE_EAST,
  MB_IMPASSABLE_SOUTH_AND_NORTH,
  MB_IMPASSABLE_WEST_AND_EAST,
  MB_JUMP_SOUTHWEST,
  MB_SAND,
  MB_SECRET_BASE_WALL,
  isDoorBehavior,
  isSurfableBehavior,
} from '../../utils/metatileBehaviors.ts';
import { areElevationsCompatible } from '../../utils/elevation.ts';

type TrainerCollisionResult =
  | 'none'
  | 'outside_range'
  | 'impassable'
  | 'elevation_mismatch'
  | 'object_event';

interface ResolvedTile {
  attributes?: {
    behavior?: number;
  } | null;
  mapTile?: {
    collision: number;
    elevation?: number;
  } | null;
}

export interface ViewportTileBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface TrainerSightEncounterParams {
  npcs: NPCObject[];
  playerTileX: number;
  playerTileY: number;
  viewport: ViewportTileBounds;
  resolveTile: (tileX: number, tileY: number) => ResolvedTile | undefined;
  hasBlockingObjectAt: (tileX: number, tileY: number, trainerElevation: number) => boolean;
  getTrainerScriptCommands: (mapId: string, scriptName: string) => ScriptCommand[] | null;
  isTrainerDefeated?: (trainerId: string) => boolean;
}

export interface TrainerSightEncounterTrigger {
  npcId: string;
  mapId: string;
  localId: string;
  localIdNumber: number;
  scriptName: string;
  approachDistance: number;
  approachDirection: NPCDirection;
}

const SEE_ALL_DIRECTIONS: readonly NPCDirection[] = ['down', 'up', 'left', 'right'];

function isCollisionPassable(collision: number): boolean {
  return collision === 0;
}

function getDirectionDelta(direction: NPCDirection): { dx: number; dy: number } {
  if (direction === 'up') return { dx: 0, dy: -1 };
  if (direction === 'down') return { dx: 0, dy: 1 };
  if (direction === 'left') return { dx: -1, dy: 0 };
  return { dx: 1, dy: 0 };
}

function getMapIdFromNpcObjectId(id: string): string | null {
  const marker = '_npc_';
  const idx = id.indexOf(marker);
  if (idx <= 0) return null;
  return id.slice(0, idx);
}

function isTrainerTypeSupportedForSight(npc: NPCObject): boolean {
  return npc.trainerType === 'normal' || npc.trainerType === 'buried';
}

function isTileWalkableForTrainerSight(resolved: ResolvedTile): boolean {
  const behavior = resolved.attributes?.behavior;
  const collision = resolved.mapTile?.collision;

  if (behavior === undefined || collision === undefined) {
    return true;
  }

  if (behavior === MB_SAND || behavior === MB_DEEP_SAND) return true;
  if (!isCollisionPassable(collision) && !isDoorBehavior(behavior)) return false;
  if (behavior === MB_SECRET_BASE_WALL) return false;
  if (isSurfableBehavior(behavior)) return false;
  if (behavior >= MB_IMPASSABLE_EAST && behavior <= MB_JUMP_SOUTHWEST) return false;
  if (behavior === MB_IMPASSABLE_SOUTH_AND_NORTH || behavior === MB_IMPASSABLE_WEST_AND_EAST) return false;
  return true;
}

function getApproachDistanceForDirection(
  npc: NPCObject,
  direction: NPCDirection,
  playerTileX: number,
  playerTileY: number
): number {
  const range = Math.max(0, npc.trainerSightRange | 0);
  if (range <= 0) return 0;

  if (direction === 'down') {
    if (npc.tileX === playerTileX && playerTileY > npc.tileY && playerTileY <= npc.tileY + range) {
      return playerTileY - npc.tileY;
    }
    return 0;
  }

  if (direction === 'up') {
    if (npc.tileX === playerTileX && playerTileY < npc.tileY && playerTileY >= npc.tileY - range) {
      return npc.tileY - playerTileY;
    }
    return 0;
  }

  if (direction === 'left') {
    if (npc.tileY === playerTileY && playerTileX < npc.tileX && playerTileX >= npc.tileX - range) {
      return npc.tileX - playerTileX;
    }
    return 0;
  }

  if (npc.tileY === playerTileY && playerTileX > npc.tileX && playerTileX <= npc.tileX + range) {
    return playerTileX - npc.tileX;
  }
  return 0;
}

function getPathCollisionAtCoords(
  npc: NPCObject,
  tileX: number,
  tileY: number,
  params: TrainerSightEncounterParams
): TrainerCollisionResult {
  const resolved = params.resolveTile(tileX, tileY);
  if (!resolved) return 'outside_range';
  if (!isTileWalkableForTrainerSight(resolved)) return 'impassable';

  const tileElevation = resolved.mapTile?.elevation ?? 0;
  if (!areElevationsCompatible(npc.elevation, tileElevation)) {
    return 'elevation_mismatch';
  }

  if (tileX === params.playerTileX && tileY === params.playerTileY) {
    return 'object_event';
  }

  if (params.hasBlockingObjectAt(tileX, tileY, npc.elevation)) {
    return 'object_event';
  }

  return 'none';
}

function checkPathBetweenTrainerAndPlayer(
  npc: NPCObject,
  approachDistance: number,
  direction: NPCDirection,
  params: TrainerSightEncounterParams
): number {
  if (approachDistance <= 0) return 0;

  const { dx, dy } = getDirectionDelta(direction);
  let x = npc.tileX + dx;
  let y = npc.tileY + dy;

  for (let i = 0; i < approachDistance - 1; i++) {
    const collision = getPathCollisionAtCoords(npc, x, y, params);
    if (collision !== 'none' && collision !== 'outside_range') {
      return 0;
    }
    x += dx;
    y += dy;
  }

  const finalCollision = getPathCollisionAtCoords(npc, x, y, params);
  return finalCollision === 'object_event' ? approachDistance : 0;
}

function getTrainerApproachResult(
  npc: NPCObject,
  params: TrainerSightEncounterParams
): { distance: number; direction: NPCDirection } | null {
  const directions: readonly NPCDirection[] = npc.trainerType === 'normal'
    ? [npc.direction]
    : SEE_ALL_DIRECTIONS;

  for (const direction of directions) {
    const rawDistance = getApproachDistanceForDirection(
      npc,
      direction,
      params.playerTileX,
      params.playerTileY
    );
    if (rawDistance <= 0) continue;
    const checkedDistance = checkPathBetweenTrainerAndPlayer(npc, rawDistance, direction, params);
    if (checkedDistance > 0) {
      return { distance: checkedDistance, direction };
    }
  }

  return null;
}

export function extractTrainerIdFromScript(commands: ScriptCommand[]): string | null {
  for (const command of commands) {
    const args = command.args ?? [];
    switch (command.cmd) {
      case 'trainerbattle_single':
      case 'trainerbattle_double':
      case 'trainerbattle_rematch':
      case 'trainerbattle_rematch_double':
      case 'trainerbattle_no_intro':
        return typeof args[0] === 'string' ? args[0] : null;
      case 'trainerbattle':
        return typeof args[1] === 'string' ? args[1] : null;
      case 'return':
      case 'end':
        return null;
      default:
        break;
    }
  }

  return null;
}

export function findTrainerSightEncounterTrigger(
  params: TrainerSightEncounterParams
): TrainerSightEncounterTrigger | null {
  for (const npc of params.npcs) {
    if (!npc.visible || npc.scriptRemoved) continue;
    if (!isTrainerTypeSupportedForSight(npc)) continue;
    if (npc.trainerSightRange <= 0) continue;
    if (!npc.script || npc.script === '0x0') continue;

    const mapId = getMapIdFromNpcObjectId(npc.id);
    if (!mapId) continue;

    const commands = params.getTrainerScriptCommands(mapId, npc.script);
    const trainerId = commands ? extractTrainerIdFromScript(commands) : null;
    if (trainerId && params.isTrainerDefeated?.(trainerId)) continue;

    const approach = getTrainerApproachResult(npc, params);
    if (!approach) continue;

    const localId = npc.localId ?? String(npc.localIdNumber);
    return {
      npcId: npc.id,
      mapId,
      localId,
      localIdNumber: npc.localIdNumber,
      scriptName: npc.script,
      approachDistance: approach.distance,
      approachDirection: approach.direction,
    };
  }

  return null;
}
