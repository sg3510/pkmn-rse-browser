/**
 * Mirage Tower special handlers shared by ScriptRunner.
 *
 * C references:
 * - public/pokeemerald/src/mirage_tower.c
 * - public/pokeemerald/data/maps/Route111/scripts.inc
 * - public/pokeemerald/data/maps/MirageTower_4F/scripts.inc
 */

import { METATILE_LABELS } from '../../data/metatileLabels.gen.ts';
import type { StoryScriptContext } from '../../game/NewGameFlow.ts';
import type {
  ScriptCameraShakeRequest,
  ScriptCameraSpecialServices,
} from './legendaryIslandSpecials.ts';

type MirageTowerMetatileLabel = keyof typeof METATILE_LABELS;

interface MirageTowerMetatilePatch {
  x: number;
  y: number;
  metatileLabel: MirageTowerMetatileLabel;
}

const MAP_ROUTE111 = 'MAP_ROUTE111';
const LOCALID_ROUTE111_PLAYER_FALLING = 'LOCALID_ROUTE111_PLAYER_FALLING';
const ROUTE111_FOSSIL_DEFAULT_LOCAL_ID = '44';

const ROUTE111_TOWER_FALL_START = { x: 19, y: 53 };
const ROUTE111_FOSSIL_START = { x: 20, y: 53 };
const ROUTE111_TOWER_FALL_DISTANCE_TILES = 6;
const ROUTE111_COLLISION_PASSABLE = 0;

const ROUTE111_MIRAGE_TOWER_VISIBLE_PATCHES: readonly MirageTowerMetatilePatch[] = [
  { x: 18, y: 53, metatileLabel: 'METATILE_Mauville_MirageTower_Tile0' },
  { x: 19, y: 53, metatileLabel: 'METATILE_Mauville_MirageTower_Tile1' },
  { x: 20, y: 53, metatileLabel: 'METATILE_Mauville_MirageTower_Tile2' },
  { x: 18, y: 54, metatileLabel: 'METATILE_Mauville_MirageTower_Tile3' },
  { x: 19, y: 54, metatileLabel: 'METATILE_Mauville_MirageTower_Tile4' },
  { x: 20, y: 54, metatileLabel: 'METATILE_Mauville_MirageTower_Tile5' },
  { x: 18, y: 55, metatileLabel: 'METATILE_Mauville_MirageTower_Tile6' },
  { x: 19, y: 55, metatileLabel: 'METATILE_Mauville_MirageTower_Tile7' },
  { x: 20, y: 55, metatileLabel: 'METATILE_Mauville_MirageTower_Tile8' },
  { x: 18, y: 56, metatileLabel: 'METATILE_Mauville_MirageTower_Tile9' },
  { x: 19, y: 56, metatileLabel: 'METATILE_Mauville_MirageTower_TileA' },
  { x: 20, y: 56, metatileLabel: 'METATILE_Mauville_MirageTower_TileB' },
  { x: 18, y: 57, metatileLabel: 'METATILE_Mauville_MirageTower_TileC' },
  { x: 19, y: 57, metatileLabel: 'METATILE_Mauville_MirageTower_TileD' },
  { x: 20, y: 57, metatileLabel: 'METATILE_Mauville_MirageTower_TileE' },
  { x: 18, y: 58, metatileLabel: 'METATILE_Mauville_MirageTower_TileF' },
  { x: 19, y: 58, metatileLabel: 'METATILE_Mauville_MirageTower_Tile10' },
  { x: 20, y: 58, metatileLabel: 'METATILE_Mauville_MirageTower_Tile11' },
];

const ROUTE111_MIRAGE_TOWER_INVISIBLE_PATCHES: readonly MirageTowerMetatilePatch[] = [
  { x: 18, y: 53, metatileLabel: 'METATILE_Mauville_DeepSand_Center' },
  { x: 19, y: 53, metatileLabel: 'METATILE_Mauville_DeepSand_Center' },
  { x: 20, y: 53, metatileLabel: 'METATILE_Mauville_DeepSand_Center' },
  { x: 18, y: 54, metatileLabel: 'METATILE_Mauville_DeepSand_Center' },
  { x: 19, y: 54, metatileLabel: 'METATILE_Mauville_DeepSand_Center' },
  { x: 20, y: 54, metatileLabel: 'METATILE_Mauville_DeepSand_Center' },
  { x: 18, y: 55, metatileLabel: 'METATILE_Mauville_DeepSand_Center' },
  { x: 19, y: 55, metatileLabel: 'METATILE_Mauville_DeepSand_Center' },
  { x: 20, y: 55, metatileLabel: 'METATILE_Mauville_DeepSand_Center' },
  { x: 18, y: 56, metatileLabel: 'METATILE_Mauville_DeepSand_Center' },
  { x: 19, y: 56, metatileLabel: 'METATILE_Mauville_DeepSand_Center' },
  { x: 20, y: 56, metatileLabel: 'METATILE_Mauville_DeepSand_Center' },
  { x: 18, y: 57, metatileLabel: 'METATILE_Mauville_DeepSand_BottomMid' },
  { x: 19, y: 57, metatileLabel: 'METATILE_Mauville_DeepSand_BottomMid' },
  { x: 20, y: 57, metatileLabel: 'METATILE_Mauville_DeepSand_BottomMid' },
  { x: 18, y: 58, metatileLabel: 'METATILE_General_SandPit_Center' },
  { x: 19, y: 58, metatileLabel: 'METATILE_General_SandPit_Center' },
  { x: 20, y: 58, metatileLabel: 'METATILE_General_SandPit_Center' },
];

const ROUTE111_DISINTEGRATION_ROWS: readonly number[] = [58, 57, 56, 55, 54, 53];

function shuffleInPlace<T>(values: T[]): void {
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
}

function applyRoute111MirageTowerMetatiles(
  ctx: MirageTowerSpecialContext,
  visible: boolean
): void {
  if (ctx.currentMapId !== MAP_ROUTE111 || !ctx.setMapMetatile) {
    return;
  }

  const patches = visible
    ? ROUTE111_MIRAGE_TOWER_VISIBLE_PATCHES
    : ROUTE111_MIRAGE_TOWER_INVISIBLE_PATCHES;

  for (const patch of patches) {
    const metatileId = METATILE_LABELS[patch.metatileLabel];
    if (metatileId === undefined) {
      continue;
    }
    ctx.setMapMetatile(
      MAP_ROUTE111,
      patch.x,
      patch.y,
      metatileId,
      ROUTE111_COLLISION_PASSABLE
    );
  }
}

function resolveRoute111FossilLocalId(ctx: MirageTowerSpecialContext): string {
  if (!ctx.getAllNpcLocalIds || !ctx.getNpcGraphicsId) {
    return ROUTE111_FOSSIL_DEFAULT_LOCAL_ID;
  }

  const localIds = ctx.getAllNpcLocalIds(MAP_ROUTE111);
  for (const localId of localIds) {
    if (ctx.getNpcGraphicsId(MAP_ROUTE111, localId) === 'OBJ_EVENT_GFX_FOSSIL') {
      return localId;
    }
  }

  return ROUTE111_FOSSIL_DEFAULT_LOCAL_ID;
}

export interface ScriptMirageTowerSpecialServices {
  startShake?: () => void | Promise<void>;
  startPlayerDescend?: () => void | Promise<void>;
  startDisintegration?: () => void | Promise<void>;
  clear?: () => void | Promise<void>;
}

export interface MirageTowerSpecialContext {
  currentMapId: string;
  getVar: (varName: string) => number;
  isFlagSet: (flagName: string) => boolean;
  setFlag: (flagName: string) => void;
  clearFlag: (flagName: string) => void;
  setMapMetatile?: (
    mapId: string,
    tileX: number,
    tileY: number,
    metatileId: number,
    collision?: number
  ) => void;
  delayFrames: StoryScriptContext['delayFrames'];
  moveNpc: StoryScriptContext['moveNpc'];
  setNpcPosition: StoryScriptContext['setNpcPosition'];
  setNpcVisible: StoryScriptContext['setNpcVisible'];
  setSpriteHidden?: StoryScriptContext['setSpriteHidden'];
  getAllNpcLocalIds?: StoryScriptContext['getAllNpcLocalIds'];
  getNpcGraphicsId?: StoryScriptContext['getNpcGraphicsId'];
  camera?: ScriptCameraSpecialServices;
  mirageTower?: ScriptMirageTowerSpecialServices;
}

export interface MirageTowerSpecialExecutionResult {
  handled: boolean;
  waitState?: Promise<void>;
}

export function executeMirageTowerSpecial(
  name: string,
  ctx: MirageTowerSpecialContext
): MirageTowerSpecialExecutionResult {
  switch (name) {
    case 'SetMirageTowerVisibility': {
      if (ctx.getVar('VAR_MIRAGE_TOWER_STATE') !== 0) {
        ctx.clearFlag('FLAG_MIRAGE_TOWER_VISIBLE');
        applyRoute111MirageTowerMetatiles(ctx, false);
        void ctx.mirageTower?.clear?.();
        return { handled: true };
      }

      let visible = (((Math.random() * 0x10000) | 0) & 1) === 1;
      if (ctx.isFlagSet('FLAG_FORCE_MIRAGE_TOWER_VISIBLE')) {
        visible = true;
      }

      if (visible) {
        ctx.setFlag('FLAG_MIRAGE_TOWER_VISIBLE');
      } else {
        ctx.clearFlag('FLAG_MIRAGE_TOWER_VISIBLE');
        void ctx.mirageTower?.clear?.();
      }

      applyRoute111MirageTowerMetatiles(ctx, visible);
      return { handled: true };
    }

    case 'StartMirageTowerShake': {
      const waitState = (async () => {
        applyRoute111MirageTowerMetatiles(ctx, false);

        if (ctx.mirageTower?.startShake) {
          await ctx.mirageTower.startShake();
          return;
        }

        const fallbackShake: ScriptCameraShakeRequest = {
          verticalPan: 0,
          horizontalPan: 2,
          numShakes: 64,
          delayFrames: 2,
        };
        void ctx.camera?.shake?.(fallbackShake);
        await ctx.delayFrames(6);
      })();

      return { handled: true, waitState };
    }

    case 'StartPlayerDescendMirageTower': {
      const waitState = (async () => {
        if (ctx.mirageTower?.startPlayerDescend) {
          await ctx.mirageTower.startPlayerDescend();
          return;
        }

        ctx.setNpcPosition(
          MAP_ROUTE111,
          LOCALID_ROUTE111_PLAYER_FALLING,
          ROUTE111_TOWER_FALL_START.x,
          ROUTE111_TOWER_FALL_START.y
        );
        for (let i = 0; i < ROUTE111_TOWER_FALL_DISTANCE_TILES; i++) {
          await ctx.moveNpc(
            MAP_ROUTE111,
            LOCALID_ROUTE111_PLAYER_FALLING,
            'down',
            'walk_faster'
          );
        }
      })();

      return { handled: true, waitState };
    }

    case 'StartMirageTowerDisintegration': {
      const waitState = (async () => {
        if (ctx.mirageTower?.startDisintegration) {
          await ctx.mirageTower.startDisintegration();
          return;
        }

        const shakeRequest: ScriptCameraShakeRequest = {
          verticalPan: 0,
          horizontalPan: 2,
          numShakes: 24,
          delayFrames: 2,
        };
        const shakePromise = Promise.resolve(ctx.camera?.shake?.(shakeRequest));

        if (ctx.currentMapId === MAP_ROUTE111 && ctx.setMapMetatile) {
          for (const rowY of ROUTE111_DISINTEGRATION_ROWS) {
            const rowPatches = ROUTE111_MIRAGE_TOWER_INVISIBLE_PATCHES
              .filter((patch) => patch.y === rowY)
              .slice();
            shuffleInPlace(rowPatches);

            for (const patch of rowPatches) {
              const metatileId = METATILE_LABELS[patch.metatileLabel];
              if (metatileId === undefined) {
                continue;
              }
              ctx.setMapMetatile(
                MAP_ROUTE111,
                patch.x,
                patch.y,
                metatileId,
                ROUTE111_COLLISION_PASSABLE
              );
              await ctx.delayFrames(2);
            }
          }
        } else {
          await ctx.delayFrames(36);
        }

        await shakePromise;
        await ctx.delayFrames(2);
      })();

      return { handled: true, waitState };
    }

    case 'StartMirageTowerFossilFallAndSink': {
      const waitState = (async () => {
        const fossilLocalId = resolveRoute111FossilLocalId(ctx);
        ctx.setNpcPosition(
          MAP_ROUTE111,
          fossilLocalId,
          ROUTE111_FOSSIL_START.x,
          ROUTE111_FOSSIL_START.y
        );
        ctx.setNpcVisible(MAP_ROUTE111, fossilLocalId, true, false);

        for (let i = 0; i < ROUTE111_TOWER_FALL_DISTANCE_TILES; i++) {
          await ctx.moveNpc(MAP_ROUTE111, fossilLocalId, 'down', 'walk_faster');
        }

        for (let i = 0; i < 8; i++) {
          ctx.setSpriteHidden?.(MAP_ROUTE111, fossilLocalId, i % 2 === 0);
          await ctx.delayFrames(2);
        }
        ctx.setSpriteHidden?.(MAP_ROUTE111, fossilLocalId, false);

        ctx.setNpcVisible(MAP_ROUTE111, fossilLocalId, false, true);
        ctx.setFlag('FLAG_HIDE_ROUTE_111_DESERT_FOSSIL');
      })();

      return { handled: true, waitState };
    }

    case 'DoMirageTowerCeilingCrumble': {
      const waitState = (async () => {
        const shakeRequest: ScriptCameraShakeRequest = {
          verticalPan: 2,
          horizontalPan: 1,
          numShakes: 16,
          delayFrames: 3,
        };
        if (ctx.camera?.shake) {
          await ctx.camera.shake(shakeRequest);
          await ctx.delayFrames(24);
        } else {
          await ctx.delayFrames(72);
        }
      })();

      return { handled: true, waitState };
    }

    default:
      return { handled: false };
  }
}
