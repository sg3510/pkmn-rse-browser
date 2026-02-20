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
  hasEnoughMonsForDoubleBattle?: () => boolean;
}

export const TRAINER_BATTLE_MODE = {
  SINGLE: 0,
  CONTINUE_SCRIPT_NO_MUSIC: 1,
  CONTINUE_SCRIPT: 2,
  SINGLE_NO_INTRO_TEXT: 3,
  DOUBLE: 4,
  REMATCH: 5,
  CONTINUE_SCRIPT_DOUBLE: 6,
  REMATCH_DOUBLE: 7,
  CONTINUE_SCRIPT_DOUBLE_NO_MUSIC: 8,
  PYRAMID: 9,
  SET_TRAINER_A: 10,
  SET_TRAINER_B: 11,
  HILL: 12,
} as const;

const TRAINER_BATTLE_DOUBLE_MODES = new Set<number>([
  TRAINER_BATTLE_MODE.DOUBLE,
  TRAINER_BATTLE_MODE.REMATCH_DOUBLE,
  TRAINER_BATTLE_MODE.CONTINUE_SCRIPT_DOUBLE,
  TRAINER_BATTLE_MODE.CONTINUE_SCRIPT_DOUBLE_NO_MUSIC,
]);

const TRAINER_BATTLE_CONTINUE_SCRIPT_MODES = new Set<number>([
  TRAINER_BATTLE_MODE.CONTINUE_SCRIPT,
  TRAINER_BATTLE_MODE.CONTINUE_SCRIPT_NO_MUSIC,
  TRAINER_BATTLE_MODE.CONTINUE_SCRIPT_DOUBLE,
  TRAINER_BATTLE_MODE.CONTINUE_SCRIPT_DOUBLE_NO_MUSIC,
]);

export interface TrainerBattleMetadata {
  battleMode: number;
  trainerId: string;
  introTextLabel: string | null;
  defeatTextLabel: string | null;
  cannotBattleTextLabel: string | null;
  beatenScriptLabel: string | null;
  postBattleCommands: ScriptCommand[];
}

export interface TrainerSightEncounterTrigger {
  npcId: string;
  mapId: string;
  localId: string;
  localIdNumber: number;
  scriptName: string;
  approachDistance: number;
  approachDirection: NPCDirection;
  trainerType?: NPCObject['trainerType'];
  movementTypeRaw?: string;
}

export interface TrainerSightApproachingTrainer extends TrainerSightEncounterTrigger {
  trainerType: NPCObject['trainerType'];
  movementTypeRaw: string;
  battle: TrainerBattleMetadata;
}

export interface TrainerSightEncounterSelection {
  approachingTrainers: TrainerSightApproachingTrainer[];
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

function asScriptArgString(value: string | number | undefined): string | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(Math.trunc(value)) : null;
  }
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized;
}

function asLabelOrNull(value: string | number | undefined): string | null {
  const normalized = asScriptArgString(value);
  if (!normalized) return null;
  if (normalized === 'NULL' || normalized === '0x0') return null;
  return normalized;
}

function resolveTrainerBattleMode(rawMode: string | number | undefined): number {
  if (typeof rawMode === 'number') {
    return Number.isFinite(rawMode) ? Math.trunc(rawMode) : TRAINER_BATTLE_MODE.SINGLE;
  }
  if (typeof rawMode !== 'string') return TRAINER_BATTLE_MODE.SINGLE;

  const normalized = rawMode.trim();
  if (!normalized) return TRAINER_BATTLE_MODE.SINGLE;
  if (/^-?\d+$/.test(normalized)) {
    return Number.parseInt(normalized, 10);
  }

  switch (normalized) {
    case 'TRAINER_BATTLE_SINGLE':
      return TRAINER_BATTLE_MODE.SINGLE;
    case 'TRAINER_BATTLE_CONTINUE_SCRIPT_NO_MUSIC':
      return TRAINER_BATTLE_MODE.CONTINUE_SCRIPT_NO_MUSIC;
    case 'TRAINER_BATTLE_CONTINUE_SCRIPT':
      return TRAINER_BATTLE_MODE.CONTINUE_SCRIPT;
    case 'TRAINER_BATTLE_SINGLE_NO_INTRO_TEXT':
      return TRAINER_BATTLE_MODE.SINGLE_NO_INTRO_TEXT;
    case 'TRAINER_BATTLE_DOUBLE':
      return TRAINER_BATTLE_MODE.DOUBLE;
    case 'TRAINER_BATTLE_REMATCH':
      return TRAINER_BATTLE_MODE.REMATCH;
    case 'TRAINER_BATTLE_CONTINUE_SCRIPT_DOUBLE':
      return TRAINER_BATTLE_MODE.CONTINUE_SCRIPT_DOUBLE;
    case 'TRAINER_BATTLE_REMATCH_DOUBLE':
      return TRAINER_BATTLE_MODE.REMATCH_DOUBLE;
    case 'TRAINER_BATTLE_CONTINUE_SCRIPT_DOUBLE_NO_MUSIC':
      return TRAINER_BATTLE_MODE.CONTINUE_SCRIPT_DOUBLE_NO_MUSIC;
    case 'TRAINER_BATTLE_PYRAMID':
      return TRAINER_BATTLE_MODE.PYRAMID;
    case 'TRAINER_BATTLE_SET_TRAINER_A':
      return TRAINER_BATTLE_MODE.SET_TRAINER_A;
    case 'TRAINER_BATTLE_SET_TRAINER_B':
      return TRAINER_BATTLE_MODE.SET_TRAINER_B;
    case 'TRAINER_BATTLE_HILL':
      return TRAINER_BATTLE_MODE.HILL;
    default:
      return TRAINER_BATTLE_MODE.SINGLE;
  }
}

function parseLegacyTrainerBattleCommand(
  commands: ScriptCommand[],
  index: number
): TrainerBattleMetadata | null {
  const args = commands[index].args ?? [];
  const battleMode = resolveTrainerBattleMode(args[0]);
  const trainerId = asScriptArgString(args[1]);
  if (!trainerId) return null;

  let introTextLabel = asLabelOrNull(args[3]);
  let defeatTextLabel = asLabelOrNull(args[4]);
  let cannotBattleTextLabel: string | null = null;
  let beatenScriptLabel: string | null = null;

  if (battleMode === TRAINER_BATTLE_MODE.SINGLE_NO_INTRO_TEXT) {
    introTextLabel = null;
    defeatTextLabel = asLabelOrNull(args[3]);
  }

  if (TRAINER_BATTLE_DOUBLE_MODES.has(battleMode)) {
    cannotBattleTextLabel = asLabelOrNull(args[5]);
  }

  if (
    battleMode === TRAINER_BATTLE_MODE.CONTINUE_SCRIPT
    || battleMode === TRAINER_BATTLE_MODE.CONTINUE_SCRIPT_NO_MUSIC
  ) {
    beatenScriptLabel = asLabelOrNull(args[5]);
  } else if (
    battleMode === TRAINER_BATTLE_MODE.CONTINUE_SCRIPT_DOUBLE
    || battleMode === TRAINER_BATTLE_MODE.CONTINUE_SCRIPT_DOUBLE_NO_MUSIC
  ) {
    beatenScriptLabel = asLabelOrNull(args[6]);
  }

  return {
    battleMode,
    trainerId,
    introTextLabel,
    defeatTextLabel,
    cannotBattleTextLabel,
    beatenScriptLabel,
    postBattleCommands: commands.slice(index + 1),
  };
}

export function extractTrainerBattleMetadata(commands: ScriptCommand[]): TrainerBattleMetadata | null {
  for (let index = 0; index < commands.length; index++) {
    const command = commands[index];
    const args = command.args ?? [];

    switch (command.cmd) {
      case 'trainerbattle_single': {
        const trainerId = asScriptArgString(args[0]);
        if (!trainerId) return null;

        const continuation = asLabelOrNull(args[3]);
        const noMusic = asScriptArgString(args[4]) === 'NO_MUSIC'
          || asScriptArgString(args[3]) === 'NO_MUSIC';
        let battleMode: number = TRAINER_BATTLE_MODE.SINGLE;
        if (continuation) {
          battleMode = TRAINER_BATTLE_MODE.CONTINUE_SCRIPT;
        } else if (noMusic) {
          battleMode = TRAINER_BATTLE_MODE.CONTINUE_SCRIPT_NO_MUSIC;
        }

        return {
          battleMode,
          trainerId,
          introTextLabel: asLabelOrNull(args[1]),
          defeatTextLabel: asLabelOrNull(args[2]),
          cannotBattleTextLabel: null,
          beatenScriptLabel: continuation,
          postBattleCommands: commands.slice(index + 1),
        };
      }
      case 'trainerbattle_double': {
        const trainerId = asScriptArgString(args[0]);
        if (!trainerId) return null;

        const continuation = asLabelOrNull(args[4]);
        const noMusic = asScriptArgString(args[5]) === 'NO_MUSIC'
          || asScriptArgString(args[4]) === 'NO_MUSIC';
        let battleMode: number = TRAINER_BATTLE_MODE.DOUBLE;
        if (continuation) {
          battleMode = TRAINER_BATTLE_MODE.CONTINUE_SCRIPT_DOUBLE;
        } else if (noMusic) {
          battleMode = TRAINER_BATTLE_MODE.CONTINUE_SCRIPT_DOUBLE_NO_MUSIC;
        }

        return {
          battleMode,
          trainerId,
          introTextLabel: asLabelOrNull(args[1]),
          defeatTextLabel: asLabelOrNull(args[2]),
          cannotBattleTextLabel: asLabelOrNull(args[3]),
          beatenScriptLabel: continuation,
          postBattleCommands: commands.slice(index + 1),
        };
      }
      case 'trainerbattle_rematch': {
        const trainerId = asScriptArgString(args[0]);
        if (!trainerId) return null;
        return {
          battleMode: TRAINER_BATTLE_MODE.REMATCH,
          trainerId,
          introTextLabel: asLabelOrNull(args[1]),
          defeatTextLabel: asLabelOrNull(args[2]),
          cannotBattleTextLabel: null,
          beatenScriptLabel: null,
          postBattleCommands: commands.slice(index + 1),
        };
      }
      case 'trainerbattle_rematch_double': {
        const trainerId = asScriptArgString(args[0]);
        if (!trainerId) return null;
        return {
          battleMode: TRAINER_BATTLE_MODE.REMATCH_DOUBLE,
          trainerId,
          introTextLabel: asLabelOrNull(args[1]),
          defeatTextLabel: asLabelOrNull(args[2]),
          cannotBattleTextLabel: asLabelOrNull(args[3]),
          beatenScriptLabel: null,
          postBattleCommands: commands.slice(index + 1),
        };
      }
      case 'trainerbattle_no_intro': {
        const trainerId = asScriptArgString(args[0]);
        if (!trainerId) return null;
        return {
          battleMode: TRAINER_BATTLE_MODE.SINGLE_NO_INTRO_TEXT,
          trainerId,
          introTextLabel: null,
          defeatTextLabel: asLabelOrNull(args[1]),
          cannotBattleTextLabel: null,
          beatenScriptLabel: null,
          postBattleCommands: commands.slice(index + 1),
        };
      }
      case 'trainerbattle':
        return parseLegacyTrainerBattleCommand(commands, index);
      case 'return':
      case 'end':
        return null;
      default:
        break;
    }
  }

  return null;
}

export function extractTrainerIdFromScript(commands: ScriptCommand[]): string | null {
  return extractTrainerBattleMetadata(commands)?.trainerId ?? null;
}

export function isTrainerContinueScriptMode(battleMode: number): boolean {
  return TRAINER_BATTLE_CONTINUE_SCRIPT_MODES.has(battleMode);
}

export function isTrainerDoubleBattleMode(battleMode: number): boolean {
  return TRAINER_BATTLE_DOUBLE_MODES.has(battleMode);
}

function buildApproachingTrainerCandidate(
  npc: NPCObject,
  mapId: string,
  approach: { distance: number; direction: NPCDirection },
  battle: TrainerBattleMetadata
): TrainerSightApproachingTrainer {
  return {
    npcId: npc.id,
    mapId,
    localId: npc.localId ?? String(npc.localIdNumber),
    localIdNumber: npc.localIdNumber,
    scriptName: npc.script,
    approachDistance: approach.distance,
    approachDirection: approach.direction,
    trainerType: npc.trainerType,
    movementTypeRaw: npc.movementTypeRaw,
    battle,
  };
}

export function findTrainerSightEncounterSelection(
  params: TrainerSightEncounterParams
): TrainerSightEncounterSelection | null {
  const approachingTrainers: TrainerSightApproachingTrainer[] = [];
  const hasEnoughMonsForDoubleBattle = params.hasEnoughMonsForDoubleBattle ?? (() => true);

  for (const npc of params.npcs) {
    if (!npc.visible || npc.scriptRemoved) continue;
    if (!isTrainerTypeSupportedForSight(npc)) continue;
    if (npc.trainerSightRange <= 0) continue;
    if (!npc.script || npc.script === '0x0') continue;

    const mapId = getMapIdFromNpcObjectId(npc.id);
    if (!mapId) continue;

    const commands = params.getTrainerScriptCommands(mapId, npc.script);
    if (!commands) continue;

    const battleMetadata = extractTrainerBattleMetadata(commands);
    if (!battleMetadata) continue;
    if (params.isTrainerDefeated?.(battleMetadata.trainerId)) continue;

    const approach = getTrainerApproachResult(npc, params);
    if (!approach) continue;

    const isDoubleBattleTrainer = isTrainerDoubleBattleMode(battleMetadata.battleMode);
    if (isDoubleBattleTrainer && !hasEnoughMonsForDoubleBattle()) {
      continue;
    }

    approachingTrainers.push(
      buildApproachingTrainerCandidate(npc, mapId, approach, battleMetadata)
    );

    const numTrainers = isDoubleBattleTrainer ? 2 : 1;
    if (numTrainers === 2) {
      break;
    }

    if (approachingTrainers.length > 1) {
      break;
    }

    if (!hasEnoughMonsForDoubleBattle()) {
      break;
    }
  }

  if (approachingTrainers.length === 0) {
    return null;
  }

  return {
    approachingTrainers: approachingTrainers.slice(0, 2),
  };
}

/**
 * Legacy single-trainer helper retained for code paths/tests not yet migrated
 * to the C-style multi-approacher selection result.
 */
export function findTrainerSightEncounterTrigger(
  params: TrainerSightEncounterParams
): TrainerSightEncounterTrigger | null {
  const selection = findTrainerSightEncounterSelection(params);
  return selection?.approachingTrainers[0] ?? null;
}
