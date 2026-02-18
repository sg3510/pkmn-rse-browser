/**
 * Trainer Hill runtime helpers.
 *
 * C refs:
 * - public/pokeemerald/src/trainer_hill.c
 * - public/pokeemerald/include/constants/trainer_hill.h
 */

import { TRAINER_HILL_MODES } from '../data/trainerHillData.gen.ts';
import { TRAINER_HILL_PARTIES, type TrainerHillMonTemplate } from '../data/trainerHillParties.gen.ts';
import type { ObjectEventData } from '../types/objectEvents.ts';
import { gameFlags } from './GameFlags.ts';
import { gameVariables } from './GameVariables.ts';

const HILL_MAX_TIME = 215999; // 60 * 60 * 60 - 1 (frames)
const FRAMES_PER_SECOND = 60;
const MODE_EXPERT = 3;

const TRAINER_HILL_FLOOR_MAP_IDS = [
  'MAP_TRAINER_HILL_1F',
  'MAP_TRAINER_HILL_2F',
  'MAP_TRAINER_HILL_3F',
  'MAP_TRAINER_HILL_4F',
] as const;

type TrainerHillFloorMapId = (typeof TRAINER_HILL_FLOOR_MAP_IDS)[number];

const TRAINER_HILL_STATUS = {
  LOST: 0,
  ECARD_SCANNED: 1,
  NORMAL: 2,
} as const;

const OWNER_STATE = {
  ARRIVED: 0,
  GIVE_PRIZE: 1,
  ALREADY_RECEIVED_PRIZE: 2,
} as const;

const FINAL_TIME_RESULT = {
  NEW_RECORD: 0,
  NO_NEW_RECORD: 1,
  ALREADY_CHECKED: 2,
} as const;

const GIVE_PRIZE_RESULT = {
  SUCCESS: 0,
  BAG_FULL: 1,
  SKIP: 2,
} as const;

const PRIZE_LISTS_1 = [
  ['ITEM_RARE_CANDY', 'ITEM_ETHER', 'ITEM_MAX_POTION', 'ITEM_REVIVE', 'ITEM_FLUFFY_TAIL', 'ITEM_GREAT_BALL'],
  ['ITEM_LUXURY_BALL', 'ITEM_ETHER', 'ITEM_MAX_POTION', 'ITEM_REVIVE', 'ITEM_FLUFFY_TAIL', 'ITEM_GREAT_BALL'],
  ['ITEM_MAX_REVIVE', 'ITEM_ETHER', 'ITEM_MAX_POTION', 'ITEM_REVIVE', 'ITEM_FLUFFY_TAIL', 'ITEM_GREAT_BALL'],
  ['ITEM_MAX_ETHER', 'ITEM_ETHER', 'ITEM_MAX_POTION', 'ITEM_REVIVE', 'ITEM_FLUFFY_TAIL', 'ITEM_GREAT_BALL'],
  ['ITEM_ELIXIR', 'ITEM_ETHER', 'ITEM_MAX_POTION', 'ITEM_REVIVE', 'ITEM_FLUFFY_TAIL', 'ITEM_GREAT_BALL'],
  ['ITEM_TM_ROAR', 'ITEM_ETHER', 'ITEM_MAX_POTION', 'ITEM_REVIVE', 'ITEM_FLUFFY_TAIL', 'ITEM_GREAT_BALL'],
  ['ITEM_TM_SLUDGE_BOMB', 'ITEM_ETHER', 'ITEM_MAX_POTION', 'ITEM_REVIVE', 'ITEM_FLUFFY_TAIL', 'ITEM_GREAT_BALL'],
  ['ITEM_TM_TOXIC', 'ITEM_ETHER', 'ITEM_MAX_POTION', 'ITEM_REVIVE', 'ITEM_FLUFFY_TAIL', 'ITEM_GREAT_BALL'],
  ['ITEM_TM_SUNNY_DAY', 'ITEM_ETHER', 'ITEM_MAX_POTION', 'ITEM_REVIVE', 'ITEM_FLUFFY_TAIL', 'ITEM_GREAT_BALL'],
  ['ITEM_TM_EARTHQUAKE', 'ITEM_ETHER', 'ITEM_MAX_POTION', 'ITEM_REVIVE', 'ITEM_FLUFFY_TAIL', 'ITEM_GREAT_BALL'],
] as const;

const PRIZE_LISTS_2 = [
  ['ITEM_RARE_CANDY', 'ITEM_ETHER', 'ITEM_MAX_POTION', 'ITEM_REVIVE', 'ITEM_FLUFFY_TAIL', 'ITEM_GREAT_BALL'],
  ['ITEM_LUXURY_BALL', 'ITEM_ETHER', 'ITEM_MAX_POTION', 'ITEM_REVIVE', 'ITEM_FLUFFY_TAIL', 'ITEM_GREAT_BALL'],
  ['ITEM_MAX_REVIVE', 'ITEM_ETHER', 'ITEM_MAX_POTION', 'ITEM_REVIVE', 'ITEM_FLUFFY_TAIL', 'ITEM_GREAT_BALL'],
  ['ITEM_MAX_ETHER', 'ITEM_ETHER', 'ITEM_MAX_POTION', 'ITEM_REVIVE', 'ITEM_FLUFFY_TAIL', 'ITEM_GREAT_BALL'],
  ['ITEM_ELIXIR', 'ITEM_ETHER', 'ITEM_MAX_POTION', 'ITEM_REVIVE', 'ITEM_FLUFFY_TAIL', 'ITEM_GREAT_BALL'],
  ['ITEM_TM_BRICK_BREAK', 'ITEM_ETHER', 'ITEM_MAX_POTION', 'ITEM_REVIVE', 'ITEM_FLUFFY_TAIL', 'ITEM_GREAT_BALL'],
  ['ITEM_TM_TORMENT', 'ITEM_ETHER', 'ITEM_MAX_POTION', 'ITEM_REVIVE', 'ITEM_FLUFFY_TAIL', 'ITEM_GREAT_BALL'],
  ['ITEM_TM_SKILL_SWAP', 'ITEM_ETHER', 'ITEM_MAX_POTION', 'ITEM_REVIVE', 'ITEM_FLUFFY_TAIL', 'ITEM_GREAT_BALL'],
  ['ITEM_TM_GIGA_DRAIN', 'ITEM_ETHER', 'ITEM_MAX_POTION', 'ITEM_REVIVE', 'ITEM_FLUFFY_TAIL', 'ITEM_GREAT_BALL'],
  ['ITEM_TM_ATTRACT', 'ITEM_ETHER', 'ITEM_MAX_POTION', 'ITEM_REVIVE', 'ITEM_FLUFFY_TAIL', 'ITEM_GREAT_BALL'],
] as const;

const PRIZE_LIST_SETS = [PRIZE_LISTS_1, PRIZE_LISTS_2] as const;

interface TrainerHillRuntimeState {
  mode: number;
  timerFrames: number;
  timerRunning: boolean;
  timerResumedAtMs: number;
  spokeToOwner: boolean;
  checkedFinalTime: boolean;
  hasLost: boolean;
  receivedPrize: boolean;
  maybeECardScanDuringChallenge: boolean;
  savedGame: boolean;
  bestTime: number;
  modeTimes: [number, number, number, number];
}

export interface TrainerHillBattleTrainerData {
  floorIndex: number;
  trainerIndex: 0 | 1;
  localId: number;
  name: string;
  facilityClass: string;
  party: [TrainerHillMonTemplate, TrainerHillMonTemplate, TrainerHillMonTemplate];
}

function createDefaultState(): TrainerHillRuntimeState {
  const modeTimes: [number, number, number, number] = [
    HILL_MAX_TIME,
    HILL_MAX_TIME,
    HILL_MAX_TIME,
    HILL_MAX_TIME,
  ];
  return {
    mode: 0,
    timerFrames: 0,
    timerRunning: false,
    timerResumedAtMs: 0,
    spokeToOwner: false,
    checkedFinalTime: false,
    hasLost: false,
    receivedPrize: false,
    maybeECardScanDuringChallenge: false,
    savedGame: false,
    bestTime: modeTimes[0],
    modeTimes,
  };
}

let trainerHillState = createDefaultState();

function getNowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function syncTimer(): void {
  if (!trainerHillState.timerRunning) return;
  const elapsedMs = Math.max(0, getNowMs() - trainerHillState.timerResumedAtMs);
  const elapsedFrames = Math.floor((elapsedMs * FRAMES_PER_SECOND) / 1000);
  if (elapsedFrames <= 0) return;

  trainerHillState.timerFrames = Math.min(HILL_MAX_TIME, trainerHillState.timerFrames + elapsedFrames);
  trainerHillState.timerResumedAtMs = getNowMs();
  if (trainerHillState.timerFrames >= HILL_MAX_TIME) {
    trainerHillState.timerRunning = false;
  }
}

function startTimer(): void {
  syncTimer();
  if (trainerHillState.timerFrames >= HILL_MAX_TIME) {
    trainerHillState.timerFrames = HILL_MAX_TIME;
    trainerHillState.timerRunning = false;
    return;
  }
  trainerHillState.timerRunning = true;
  trainerHillState.timerResumedAtMs = getNowMs();
}

function stopTimer(): void {
  syncTimer();
  trainerHillState.timerRunning = false;
}

function normalizeMode(mode: number): number {
  const intMode = Number.isFinite(mode) ? Math.trunc(mode) : 0;
  if (intMode in TRAINER_HILL_MODES) return intMode;
  return 0;
}

function defeatedTrainerFlagName(floorIndex: number, trainerIndex: number): string {
  return `FLAG_TRAINER_HILL_DEFEATED_${floorIndex + 1}_${trainerIndex + 1}`;
}

function clearAllDefeatedTrainerFlags(): void {
  for (let floor = 0; floor < TRAINER_HILL_FLOOR_MAP_IDS.length; floor++) {
    for (let trainer = 0; trainer < 2; trainer++) {
      gameFlags.clear(defeatedTrainerFlagName(floor, trainer));
    }
  }
}

export function resetTrainerHillRuntimeState(): void {
  trainerHillState = createDefaultState();
  clearAllDefeatedTrainerFlags();
}

export function isTrainerHillFloorMapId(mapId: string): mapId is TrainerHillFloorMapId {
  return (TRAINER_HILL_FLOOR_MAP_IDS as readonly string[]).includes(mapId);
}

export function getTrainerHillFloorIndexFromMapId(mapId: string): number | null {
  const idx = TRAINER_HILL_FLOOR_MAP_IDS.indexOf(mapId as TrainerHillFloorMapId);
  return idx >= 0 ? idx : null;
}

function directionToMovementType(direction: string): string {
  switch (direction) {
    case 'DIR_NORTH':
      return 'MOVEMENT_TYPE_FACE_UP';
    case 'DIR_SOUTH':
      return 'MOVEMENT_TYPE_FACE_DOWN';
    case 'DIR_WEST':
      return 'MOVEMENT_TYPE_FACE_LEFT';
    case 'DIR_EAST':
      return 'MOVEMENT_TYPE_FACE_RIGHT';
    default:
      return 'MOVEMENT_TYPE_FACE_DOWN';
  }
}

function getModeData() {
  const mode = getTrainerHillMode();
  return TRAINER_HILL_MODES[mode] ?? TRAINER_HILL_MODES[0];
}

export function getTrainerHillMode(): number {
  const mode = normalizeMode(gameVariables.getVar('VAR_TRAINER_HILL_MODE'));
  if (trainerHillState.mode !== mode) {
    trainerHillState.mode = mode;
    trainerHillState.bestTime = trainerHillState.modeTimes[mode];
  }
  return mode;
}

export function trainerHillSetMode(mode: number): void {
  const normalized = normalizeMode(mode);
  trainerHillState.mode = normalized;
  trainerHillState.bestTime = trainerHillState.modeTimes[normalized];
  gameVariables.setVar('VAR_TRAINER_HILL_MODE', normalized);
}

export function trainerHillStartChallenge(): void {
  trainerHillState.timerFrames = 0;
  trainerHillState.timerRunning = false;
  trainerHillState.spokeToOwner = false;
  trainerHillState.checkedFinalTime = false;
  trainerHillState.receivedPrize = false;
  trainerHillState.hasLost = false;
  trainerHillState.maybeECardScanDuringChallenge = false;
  clearAllDefeatedTrainerFlags();
  startTimer();
}

export function trainerHillResumeTimer(): void {
  if (trainerHillState.spokeToOwner) return;
  syncTimer();
  if (trainerHillState.timerFrames >= HILL_MAX_TIME) {
    trainerHillState.timerFrames = HILL_MAX_TIME;
    trainerHillState.timerRunning = false;
    return;
  }
  startTimer();
}

export function trainerHillSetLost(): void {
  trainerHillState.hasLost = true;
}

export function trainerHillGetChallengeStatus(): number {
  if (trainerHillState.hasLost) {
    trainerHillState.hasLost = false;
    return TRAINER_HILL_STATUS.LOST;
  }
  if (trainerHillState.maybeECardScanDuringChallenge) {
    trainerHillState.maybeECardScanDuringChallenge = false;
    return TRAINER_HILL_STATUS.ECARD_SCANNED;
  }
  return TRAINER_HILL_STATUS.NORMAL;
}

export function trainerHillGetTimerFrames(): number {
  syncTimer();
  return Math.min(HILL_MAX_TIME, Math.max(0, trainerHillState.timerFrames | 0));
}

export function trainerHillGetAllFloorsUsed(): { allFloorsUsed: boolean; numFloors: number } {
  const modeData = getModeData();
  const numFloors = modeData.numFloors;
  return {
    allFloorsUsed: numFloors === 4,
    numFloors,
  };
}

export function trainerHillGetUsingEReader(): boolean {
  return false;
}

export function trainerHillInChallenge(currentMapId: string): boolean {
  if (gameVariables.getVar('VAR_TRAINER_HILL_IS_ACTIVE') === 0) return false;
  if (trainerHillState.spokeToOwner) return false;
  return currentMapId.startsWith('MAP_TRAINER_HILL_');
}

export function trainerHillGetOwnerState(): number {
  stopTimer();

  let result = OWNER_STATE.ARRIVED;
  if (trainerHillState.spokeToOwner) {
    result += 1;
  }
  if (trainerHillState.receivedPrize && trainerHillState.checkedFinalTime) {
    result += 1;
  }
  trainerHillState.spokeToOwner = true;
  return result;
}

export function trainerHillCheckFinalTime(): number {
  if (trainerHillState.checkedFinalTime) {
    return FINAL_TIME_RESULT.ALREADY_CHECKED;
  }

  const timerFrames = trainerHillGetTimerFrames();
  if (trainerHillState.bestTime > timerFrames) {
    trainerHillState.bestTime = timerFrames;
    const mode = getTrainerHillMode();
    trainerHillState.modeTimes[mode] = timerFrames;
    trainerHillState.checkedFinalTime = true;
    return FINAL_TIME_RESULT.NEW_RECORD;
  }

  trainerHillState.checkedFinalTime = true;
  return FINAL_TIME_RESULT.NO_NEW_RECORD;
}

export function trainerHillGetWon(): boolean {
  return !trainerHillState.hasLost;
}

export function trainerHillGetSavedGame(): boolean {
  return trainerHillState.savedGame;
}

export function trainerHillSetSavedGame(): void {
  trainerHillState.savedGame = true;
}

export function trainerHillClearSavedGame(): void {
  trainerHillState.savedGame = false;
}

export function trainerHillSetAllTrainerFlags(): void {
  for (let floor = 0; floor < TRAINER_HILL_FLOOR_MAP_IDS.length; floor++) {
    for (let trainer = 0; trainer < 2; trainer++) {
      gameFlags.set(defeatedTrainerFlagName(floor, trainer));
    }
  }
}

export function trainerHillIsTrainerDefeated(mapId: string, localId: number): boolean {
  const floorIndex = getTrainerHillFloorIndexFromMapId(mapId);
  if (floorIndex === null) return false;
  const trainerIndex = localId - 1;
  if (trainerIndex < 0 || trainerIndex > 1) return false;
  return gameFlags.isSet(defeatedTrainerFlagName(floorIndex, trainerIndex));
}

export function trainerHillMarkTrainerDefeated(mapId: string, localId: number): void {
  const floorIndex = getTrainerHillFloorIndexFromMapId(mapId);
  if (floorIndex === null) return;
  const trainerIndex = localId - 1;
  if (trainerIndex < 0 || trainerIndex > 1) return;
  gameFlags.set(defeatedTrainerFlagName(floorIndex, trainerIndex));
}

export function getTrainerHillDynamicObjectEvents(mapId: string): ObjectEventData[] | null {
  const floorIndex = getTrainerHillFloorIndexFromMapId(mapId);
  if (floorIndex === null) {
    return null;
  }

  const modeData = getModeData();
  const floorData = modeData.floors[floorIndex];
  if (!floorData) {
    return [];
  }

  return floorData.trainers.map((trainer, idx) => ({
    local_id: String(idx + 1),
    graphics_id: trainer.graphicsId,
    x: floorData.map.trainerCoords[idx][0],
    y: floorData.map.trainerCoords[idx][1] + 5, // HILL_FLOOR_HEIGHT_MARGIN
    elevation: 3,
    movement_type: directionToMovementType(floorData.map.trainerDirections[idx]),
    movement_range_x: 1,
    movement_range_y: 1,
    trainer_type: 'TRAINER_TYPE_NORMAL',
    trainer_sight_or_berry_tree_id: String(floorData.map.trainerRanges[idx]),
    script: 'TrainerHill_EventScript_TrainerBattle',
    flag: '0',
  }));
}

export function getTrainerHillBattleTrainer(
  mapId: string,
  localId: number
): TrainerHillBattleTrainerData | null {
  const floorIndex = getTrainerHillFloorIndexFromMapId(mapId);
  if (floorIndex === null) return null;

  const trainerIndex = localId - 1;
  if (trainerIndex !== 0 && trainerIndex !== 1) return null;

  const mode = getTrainerHillMode();
  const modeData = TRAINER_HILL_MODES[mode];
  const floorData = modeData?.floors[floorIndex];
  const partyData = TRAINER_HILL_PARTIES[mode]?.[floorIndex]?.[trainerIndex];
  const trainer = floorData?.trainers[trainerIndex];

  if (!modeData || !floorData || !partyData || !trainer) {
    return null;
  }

  return {
    floorIndex,
    trainerIndex,
    localId,
    name: trainer.name,
    facilityClass: trainer.facilityClass,
    party: partyData,
  };
}

function getPrizeListId(allowTms: boolean): number {
  const modeData = getModeData();
  let prizeListId = 0;
  for (let i = 0; i < 4 && i < modeData.floors.length; i++) {
    const floor = modeData.floors[i];
    prizeListId ^= floor.trainerNums[0] & 0x1f;
    prizeListId ^= floor.trainerNums[1] & 0x1f;
  }
  const modBy = allowTms ? 10 : 5;
  return prizeListId % modBy;
}

export function trainerHillSelectPrizeItem(): string | null {
  const modeData = getModeData();
  let trainerNumSum = 0;
  for (let i = 0; i < 4 && i < modeData.floors.length; i++) {
    trainerNumSum += modeData.floors[i].trainerNums[0];
    trainerNumSum += modeData.floors[i].trainerNums[1];
  }

  const prizeListSetId = Math.trunc(trainerNumSum / 256) % PRIZE_LIST_SETS.length;
  const allowTms = gameFlags.isSet('FLAG_SYS_GAME_CLEAR') && modeData.numTrainers === 8;
  let listId = getPrizeListId(allowTms);
  if (getTrainerHillMode() === MODE_EXPERT) {
    listId = (listId + 1) % 10;
  }

  const list = PRIZE_LIST_SETS[prizeListSetId]?.[listId];
  if (!list) return null;

  const minutes = Math.trunc(trainerHillGetTimerFrames() / (FRAMES_PER_SECOND * 60));
  let tier = 5;
  if (minutes < 12) tier = 0;
  else if (minutes < 13) tier = 1;
  else if (minutes < 14) tier = 2;
  else if (minutes < 16) tier = 3;
  else if (minutes < 18) tier = 4;

  return list[tier] ?? null;
}

export function trainerHillPreparePrizeResult(): { result: number; itemConst: string | null } {
  const modeData = getModeData();
  if (modeData.numFloors !== 4 || trainerHillState.receivedPrize) {
    return { result: GIVE_PRIZE_RESULT.SKIP, itemConst: null };
  }
  return { result: GIVE_PRIZE_RESULT.SUCCESS, itemConst: trainerHillSelectPrizeItem() };
}

export function trainerHillMarkPrizeReceived(): void {
  trainerHillState.receivedPrize = true;
}

export const TRAINER_HILL_CONSTANTS = {
  HILL_MAX_TIME,
  TRAINER_HILL_STATUS,
  OWNER_STATE,
  FINAL_TIME_RESULT,
  GIVE_PRIZE_RESULT,
};
