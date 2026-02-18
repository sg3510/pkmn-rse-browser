/**
 * Trainer Hill dynamic floor-layout injection.
 *
 * C refs:
 * - public/pokeemerald/src/trainer_hill.c (GenerateTrainerHillFloorLayout, GetMapDataForFloor)
 * - public/pokeemerald/graphics/trainer_hill/maps_{mode}/floor_{n}/{metatiles,collision}.bin
 */

import { loadBinaryAsset } from '../utils/assetLoader.ts';
import type { MapData } from '../utils/mapLoader.ts';
import { gameVariables } from './GameVariables.ts';
import {
  applyTrainerHillLayoutBlock,
  TRAINER_HILL_EXPECTED_COLLISION_ROWS,
  TRAINER_HILL_EXPECTED_METATILE_BYTES,
} from './trainerHillFloorLayoutBlock.ts';

const TRAINER_HILL_MAP_ID_TO_FLOOR_INDEX: Record<string, number> = {
  MAP_TRAINER_HILL_1F: 0,
  MAP_TRAINER_HILL_2F: 1,
  MAP_TRAINER_HILL_3F: 2,
  MAP_TRAINER_HILL_4F: 3,
};

const TRAINER_HILL_MODE_FOLDERS = ['normal', 'variety', 'unique', 'expert'] as const;

const EXPECTED_COLLISION_BYTES = TRAINER_HILL_EXPECTED_COLLISION_ROWS * 2;

interface TrainerHillFloorLayoutData {
  metatiles: Uint8Array;
  collisionRows: Uint16Array;
}

const floorLayoutCache = new Map<string, Promise<TrainerHillFloorLayoutData>>();

function normalizeTrainerHillMode(rawMode: number): number {
  const mode = Number.isFinite(rawMode) ? Math.trunc(rawMode) : 0;
  if (mode >= 0 && mode < TRAINER_HILL_MODE_FOLDERS.length) {
    return mode;
  }
  return 0;
}

function getTrainerHillFloorIndex(mapId: string): number | null {
  const floorIndex = TRAINER_HILL_MAP_ID_TO_FLOOR_INDEX[mapId];
  return floorIndex === undefined ? null : floorIndex;
}

function loadFloorLayout(mode: number, floorIndex: number): Promise<TrainerHillFloorLayoutData> {
  const key = `${mode}:${floorIndex}`;
  const cached = floorLayoutCache.get(key);
  if (cached) {
    return cached;
  }

  const folder = TRAINER_HILL_MODE_FOLDERS[mode] ?? TRAINER_HILL_MODE_FOLDERS[0];
  const basePath = `/pokeemerald/graphics/trainer_hill/maps_${folder}/floor_${floorIndex}`;
  const promise = (async () => {
    const [metatileBuffer, collisionBuffer] = await Promise.all([
      loadBinaryAsset(`${basePath}/metatiles.bin`),
      loadBinaryAsset(`${basePath}/collision.bin`),
    ]);

    const metatiles = new Uint8Array(metatileBuffer);
    if (metatiles.length !== TRAINER_HILL_EXPECTED_METATILE_BYTES) {
      throw new Error(
        `Unexpected Trainer Hill metatile data length for mode=${mode}, floor=${floorIndex}: `
        + `${metatiles.length} (expected ${TRAINER_HILL_EXPECTED_METATILE_BYTES})`
      );
    }

    const collisionBytes = new Uint8Array(collisionBuffer);
    if (collisionBytes.length !== EXPECTED_COLLISION_BYTES) {
      throw new Error(
        `Unexpected Trainer Hill collision data length for mode=${mode}, floor=${floorIndex}: `
        + `${collisionBytes.length} (expected ${EXPECTED_COLLISION_BYTES})`
      );
    }

    const collisionView = new DataView(collisionBuffer);
    const collisionRows = new Uint16Array(TRAINER_HILL_EXPECTED_COLLISION_ROWS);
    for (let row = 0; row < TRAINER_HILL_EXPECTED_COLLISION_ROWS; row++) {
      collisionRows[row] = collisionView.getUint16(row * 2, true);
    }

    return { metatiles, collisionRows };
  })().catch((error) => {
    // Do not pin transient fetch failures in cache; allow later retries.
    floorLayoutCache.delete(key);
    throw error;
  });

  floorLayoutCache.set(key, promise);
  return promise;
}
export async function applyTrainerHillDynamicFloorLayout(
  mapId: string,
  mapData: MapData
): Promise<boolean> {
  const floorIndex = getTrainerHillFloorIndex(mapId);
  if (floorIndex === null) {
    return false;
  }

  const mode = normalizeTrainerHillMode(gameVariables.getVar('VAR_TRAINER_HILL_MODE'));
  try {
    const floorLayout = await loadFloorLayout(mode, floorIndex);
    return applyTrainerHillLayoutBlock(mapData, floorLayout.metatiles, floorLayout.collisionRows);
  } catch (error) {
    console.warn('[TrainerHill] Failed to apply dynamic floor layout:', {
      mapId,
      mode,
      floorIndex,
      error,
    });
    return false;
  }
}
