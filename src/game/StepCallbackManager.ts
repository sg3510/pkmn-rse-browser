/**
 * Per-step callback manager.
 *
 * In the GBA, per-step callbacks are tasks that run every frame while in the
 * overworld. They check whether the player has moved and, if so, perform
 * tile-specific logic (ice cracking, ash grass, cracked floor, etc.).
 *
 * C reference: public/pokeemerald/src/field_tasks.c
 *
 * Activated by the `setstepcallback` script command, typically in ON_RESUME
 * map scripts so the callback persists across menu/dialog returns.
 */

import { gameVariables } from './GameVariables.ts';
import { bagManager } from './BagManager.ts';
import { ITEMS } from '../data/items.ts';
import { METATILE_LABELS } from '../data/metatileLabels.gen.ts';
import {
  MB_ASHGRASS,
  MB_CRACKED_FLOOR,
  MB_CRACKED_FLOOR_HOLE,
  MB_FORTREE_BRIDGE,
  MB_MUDDY_SLOPE,
  MB_PACIFIDLOG_HORIZONTAL_LOG_LEFT,
  MB_PACIFIDLOG_HORIZONTAL_LOG_RIGHT,
  MB_PACIFIDLOG_VERTICAL_LOG_BOTTOM,
  MB_PACIFIDLOG_VERTICAL_LOG_TOP,
} from '../utils/metatileBehaviors.generated.ts';
import type { FieldEffectType } from './FieldEffectManager.ts';

// Step callback IDs from include/constants/field_tasks.h
const STEP_CB_DUMMY = 0;
const STEP_CB_ASH = 1;
const STEP_CB_FORTREE_BRIDGE = 2;
const STEP_CB_PACIFIDLOG_BRIDGE = 3;
const STEP_CB_SOOTOPOLIS_ICE = 4;
const STEP_CB_TRUCK = 5;
const STEP_CB_SECRET_BASE = 6;
const STEP_CB_CRACKED_FLOOR = 7;

// Metatile behavior constants (from metatileBehaviors.generated.ts)
const MB_THIN_ICE = 38;
const MB_CRACKED_ICE = 39;

// Sootopolis Gym metatile IDs (from metatileLabels.gen.ts)
const METATILE_ICE_CRACKED = 0x20E;
const METATILE_ICE_BROKEN = 0x206;

// Fortree bridge metatiles (field_tasks.c TryRaise/LowerFortreeBridge)
const METATILE_FORTREE_BRIDGE_OVER_GRASS_RAISED = METATILE_LABELS['METATILE_Fortree_BridgeOverGrass_Raised'] ?? 0x24E;
const METATILE_FORTREE_BRIDGE_OVER_GRASS_LOWERED = METATILE_LABELS['METATILE_Fortree_BridgeOverGrass_Lowered'] ?? 0x24F;
const METATILE_FORTREE_BRIDGE_OVER_TREES_RAISED = METATILE_LABELS['METATILE_Fortree_BridgeOverTrees_Raised'] ?? 0x256;
const METATILE_FORTREE_BRIDGE_OVER_TREES_LOWERED = METATILE_LABELS['METATILE_Fortree_BridgeOverTrees_Lowered'] ?? 0x257;

// Pacifidlog bridge metatiles (field_tasks.c s{Half,Fully,Floating}SubmergedBridgeMetatileOffsets)
const METATILE_PACIFIDLOG_HALF_SUBMERGED_VERTICAL_TOP = METATILE_LABELS['METATILE_Pacifidlog_HalfSubmergedLogs_VerticalTop'] ?? 0x259;
const METATILE_PACIFIDLOG_HALF_SUBMERGED_VERTICAL_BOTTOM = METATILE_LABELS['METATILE_Pacifidlog_HalfSubmergedLogs_VerticalBottom'] ?? 0x261;
const METATILE_PACIFIDLOG_HALF_SUBMERGED_HORIZONTAL_LEFT = METATILE_LABELS['METATILE_Pacifidlog_HalfSubmergedLogs_HorizontalLeft'] ?? 0x252;
const METATILE_PACIFIDLOG_HALF_SUBMERGED_HORIZONTAL_RIGHT = METATILE_LABELS['METATILE_Pacifidlog_HalfSubmergedLogs_HorizontalRight'] ?? 0x253;
const METATILE_PACIFIDLOG_SUBMERGED_VERTICAL_TOP = METATILE_LABELS['METATILE_Pacifidlog_SubmergedLogs_VerticalTop'] ?? 0x25A;
const METATILE_PACIFIDLOG_SUBMERGED_VERTICAL_BOTTOM = METATILE_LABELS['METATILE_Pacifidlog_SubmergedLogs_VerticalBottom'] ?? 0x262;
const METATILE_PACIFIDLOG_SUBMERGED_HORIZONTAL_LEFT = METATILE_LABELS['METATILE_Pacifidlog_SubmergedLogs_HorizontalLeft'] ?? 0x254;
const METATILE_PACIFIDLOG_SUBMERGED_HORIZONTAL_RIGHT = METATILE_LABELS['METATILE_Pacifidlog_SubmergedLogs_HorizontalRight'] ?? 0x255;
const METATILE_PACIFIDLOG_FLOATING_VERTICAL_TOP = METATILE_LABELS['METATILE_Pacifidlog_FloatingLogs_VerticalTop'] ?? 0x258;
const METATILE_PACIFIDLOG_FLOATING_VERTICAL_BOTTOM = METATILE_LABELS['METATILE_Pacifidlog_FloatingLogs_VerticalBottom'] ?? 0x260;
const METATILE_PACIFIDLOG_FLOATING_HORIZONTAL_LEFT = METATILE_LABELS['METATILE_Pacifidlog_FloatingLogs_HorizontalLeft'] ?? 0x250;
const METATILE_PACIFIDLOG_FLOATING_HORIZONTAL_RIGHT = METATILE_LABELS['METATILE_Pacifidlog_FloatingLogs_HorizontalRight'] ?? 0x251;

// Cracked floor metatiles (field_tasks.c SetCrackedFloorHoleMetatile)
const METATILE_CAVE_CRACKED_FLOOR = METATILE_LABELS['METATILE_Cave_CrackedFloor'] ?? 0x22F;
const METATILE_CAVE_CRACKED_FLOOR_HOLE = METATILE_LABELS['METATILE_Cave_CrackedFloor_Hole'] ?? 0x206;
const METATILE_PACIFIDLOG_SKYPILLAR_CRACKED_FLOOR_HOLE = METATILE_LABELS['METATILE_Pacifidlog_SkyPillar_CrackedFloor_Hole'] ?? 0x237;

// Ash grass metatiles (Route 113 / Lavaridge fallback)
const METATILE_FALLARBOR_ASH_GRASS = METATILE_LABELS['METATILE_Fallarbor_AshGrass'] ?? 0x20A;
const METATILE_FALLARBOR_NORMAL_GRASS = METATILE_LABELS['METATILE_Fallarbor_NormalGrass'] ?? 0x212;
const METATILE_LAVARIDGE_NORMAL_GRASS = METATILE_LABELS['METATILE_Lavaridge_NormalGrass'] ?? 0x206;
const ASH_FIELD_EFFECT_DELAY_FRAMES = 4;
const MAX_ASH_GATHER_COUNT = 9999;

// Muddy slope animation frames (Task_MuddySlope in field_tasks.c)
const METATILE_MUDDY_SLOPE_FRAME0 = METATILE_LABELS['METATILE_General_MuddySlope_Frame0'] ?? 0x0E8;
const METATILE_MUDDY_SLOPE_FRAME1 = METATILE_LABELS['METATILE_General_MuddySlope_Frame1'] ?? 0x0E9;
const METATILE_MUDDY_SLOPE_FRAME2 = METATILE_LABELS['METATILE_General_MuddySlope_Frame2'] ?? 0x0EA;
const METATILE_MUDDY_SLOPE_FRAME3 = METATILE_LABELS['METATILE_General_MuddySlope_Frame3'] ?? 0x0EB;
const MUDDY_SLOPE_ANIM_FRAMES = [
  METATILE_MUDDY_SLOPE_FRAME0,
  METATILE_MUDDY_SLOPE_FRAME3,
  METATILE_MUDDY_SLOPE_FRAME2,
  METATILE_MUDDY_SLOPE_FRAME1,
] as const;
const MUDDY_SLOPE_ANIM_TIME = 32;
const MUDDY_SLOPE_ANIM_STEP_TIME = MUDDY_SLOPE_ANIM_TIME / MUDDY_SLOPE_ANIM_FRAMES.length;
const MAX_ACTIVE_MUDDY_SLOPES = 4;

// Ice puzzle boundaries (map-local tile coordinates)
const ICE_PUZZLE_L = 3;
const ICE_PUZZLE_R = 13;
const ICE_PUZZLE_T = 6;
const ICE_PUZZLE_B = 19;

// Map y-coordinate → temporary variable for visited-tile bit flags.
// One bit per x-coordinate within the puzzle region.
// C reference: field_tasks.c sSootopolisGymIceRowVars[]
const ICE_ROW_VARS: Record<number, string> = {
  6: 'VAR_TEMP_1',
  7: 'VAR_TEMP_2',
  8: 'VAR_TEMP_3',
  9: 'VAR_TEMP_4',
  12: 'VAR_TEMP_5',
  13: 'VAR_TEMP_6',
  14: 'VAR_TEMP_7',
  17: 'VAR_TEMP_8',
  18: 'VAR_TEMP_9',
  19: 'VAR_TEMP_A',
};

type PacifidlogLogOrientation =
  | 'verticalTop'
  | 'verticalBottom'
  | 'horizontalLeft'
  | 'horizontalRight';

interface MetatileOffset {
  x: number;
  y: number;
  metatileId: number;
}

const PACIFIDLOG_HALF_SUBMERGED_OFFSETS: Record<PacifidlogLogOrientation, readonly [MetatileOffset, MetatileOffset]> = {
  verticalTop: [
    { x: 0, y: 0, metatileId: METATILE_PACIFIDLOG_HALF_SUBMERGED_VERTICAL_TOP },
    { x: 0, y: 1, metatileId: METATILE_PACIFIDLOG_HALF_SUBMERGED_VERTICAL_BOTTOM },
  ],
  verticalBottom: [
    { x: 0, y: -1, metatileId: METATILE_PACIFIDLOG_HALF_SUBMERGED_VERTICAL_TOP },
    { x: 0, y: 0, metatileId: METATILE_PACIFIDLOG_HALF_SUBMERGED_VERTICAL_BOTTOM },
  ],
  horizontalLeft: [
    { x: 0, y: 0, metatileId: METATILE_PACIFIDLOG_HALF_SUBMERGED_HORIZONTAL_LEFT },
    { x: 1, y: 0, metatileId: METATILE_PACIFIDLOG_HALF_SUBMERGED_HORIZONTAL_RIGHT },
  ],
  horizontalRight: [
    { x: -1, y: 0, metatileId: METATILE_PACIFIDLOG_HALF_SUBMERGED_HORIZONTAL_LEFT },
    { x: 0, y: 0, metatileId: METATILE_PACIFIDLOG_HALF_SUBMERGED_HORIZONTAL_RIGHT },
  ],
};

const PACIFIDLOG_FULLY_SUBMERGED_OFFSETS: Record<PacifidlogLogOrientation, readonly [MetatileOffset, MetatileOffset]> = {
  verticalTop: [
    { x: 0, y: 0, metatileId: METATILE_PACIFIDLOG_SUBMERGED_VERTICAL_TOP },
    { x: 0, y: 1, metatileId: METATILE_PACIFIDLOG_SUBMERGED_VERTICAL_BOTTOM },
  ],
  verticalBottom: [
    { x: 0, y: -1, metatileId: METATILE_PACIFIDLOG_SUBMERGED_VERTICAL_TOP },
    { x: 0, y: 0, metatileId: METATILE_PACIFIDLOG_SUBMERGED_VERTICAL_BOTTOM },
  ],
  horizontalLeft: [
    { x: 0, y: 0, metatileId: METATILE_PACIFIDLOG_SUBMERGED_HORIZONTAL_LEFT },
    { x: 1, y: 0, metatileId: METATILE_PACIFIDLOG_SUBMERGED_HORIZONTAL_RIGHT },
  ],
  horizontalRight: [
    { x: -1, y: 0, metatileId: METATILE_PACIFIDLOG_SUBMERGED_HORIZONTAL_LEFT },
    { x: 0, y: 0, metatileId: METATILE_PACIFIDLOG_SUBMERGED_HORIZONTAL_RIGHT },
  ],
};

const PACIFIDLOG_FLOATING_OFFSETS: Record<PacifidlogLogOrientation, readonly [MetatileOffset, MetatileOffset]> = {
  verticalTop: [
    { x: 0, y: 0, metatileId: METATILE_PACIFIDLOG_FLOATING_VERTICAL_TOP },
    { x: 0, y: 1, metatileId: METATILE_PACIFIDLOG_FLOATING_VERTICAL_BOTTOM },
  ],
  verticalBottom: [
    { x: 0, y: -1, metatileId: METATILE_PACIFIDLOG_FLOATING_VERTICAL_TOP },
    { x: 0, y: 0, metatileId: METATILE_PACIFIDLOG_FLOATING_VERTICAL_BOTTOM },
  ],
  horizontalLeft: [
    { x: 0, y: 0, metatileId: METATILE_PACIFIDLOG_FLOATING_HORIZONTAL_LEFT },
    { x: 1, y: 0, metatileId: METATILE_PACIFIDLOG_FLOATING_HORIZONTAL_RIGHT },
  ],
  horizontalRight: [
    { x: -1, y: 0, metatileId: METATILE_PACIFIDLOG_FLOATING_HORIZONTAL_LEFT },
    { x: 0, y: 0, metatileId: METATILE_PACIFIDLOG_FLOATING_HORIZONTAL_RIGHT },
  ],
};

export interface StepCallbackContext {
  /** Player's map-local tile X coordinate */
  playerLocalX: number;
  /** Player's map-local tile Y coordinate */
  playerLocalY: number;
  /** Player destination map-local tile X (matches C PlayerGetDestCoords) */
  playerDestLocalX: number;
  /** Player destination map-local tile Y (matches C PlayerGetDestCoords) */
  playerDestLocalY: number;
  /** Current map ID the player is on */
  currentMapId: string;
  /** Get tile behavior at map-local coordinates */
  getTileBehaviorLocal: (localX: number, localY: number) => number | undefined;
  /** Get raw metatile id at map-local coordinates */
  getTileMetatileIdLocal: (localX: number, localY: number) => number | undefined;
  /** Set a metatile at map-local coordinates */
  setMapMetatile: (localX: number, localY: number, metatileId: number) => void;
  /** Spawn a field effect at map-local coordinates */
  startFieldEffectLocal?: (
    localX: number,
    localY: number,
    effectName: FieldEffectType,
    ownerObjectId?: string
  ) => void;
  /** Invalidate the render view (after metatile changes) */
  invalidateView: () => void;
  /** Player render elevation parity (matches PlayerGetElevation for bridge logic). */
  playerElevation?: number;
  /** True when current movement speed is PLAYER_SPEED_FASTEST parity. */
  isPlayerAtFastestSpeed?: boolean;
}

export interface StepCallbackDebugState {
  callbackId: number;
  callbackName:
    | 'STEP_CB_DUMMY'
    | 'STEP_CB_ASH'
    | 'STEP_CB_FORTREE_BRIDGE'
    | 'STEP_CB_PACIFIDLOG_BRIDGE'
    | 'STEP_CB_SOOTOPOLIS_ICE'
    | 'STEP_CB_TRUCK'
    | 'STEP_CB_SECRET_BASE'
    | 'STEP_CB_CRACKED_FLOOR'
    | 'STEP_CB_OTHER';
  iceState: number;
  iceDelay: number;
  iceTileX: number;
  iceTileY: number;
  fortreeState: number;
  fortreeBounceTime: number;
  pacifidlogState: number;
  pacifidlogDelay: number;
  crackedFloorDelayA: number;
  crackedFloorDelayB: number;
}

interface PendingAshFieldEffect {
  mapId: string;
  localX: number;
  localY: number;
  replacementMetatileId: number;
  delayFrames: number;
}

interface PendingMuddySlopeAnimation {
  mapId: string;
  localX: number;
  localY: number;
  remainingFrames: number;
}

interface FortreeBridgeState {
  state: 0 | 1 | 2;
  prevX: number;
  prevY: number;
  oldBridgeX: number;
  oldBridgeY: number;
  bounceTime: number;
}

interface PacifidlogBridgeState {
  state: 0 | 1 | 2;
  prevX: number;
  prevY: number;
  toRaiseX: number;
  toRaiseY: number;
  delay: number;
}

interface CrackedFloorState {
  prevX: number;
  prevY: number;
  floor1Delay: number;
  floor1X: number;
  floor1Y: number;
  floor2Delay: number;
  floor2X: number;
  floor2Y: number;
}

interface PendingFortreeBounceRestore {
  x: number;
  y: number;
  delayFrames: number;
}

class StepCallbackManagerImpl {
  private callbackId: number = STEP_CB_DUMMY;

  // Position tracking (map-local)
  private prevLocalX: number = -1;
  private prevLocalY: number = -1;

  // Ash callback state (field_tasks.c AshGrassPerStepCallback)
  private ashPrevLocalX: number = 0;
  private ashPrevLocalY: number = 0;
  private pendingAshFieldEffects: PendingAshFieldEffect[] = [];

  // Muddy slope task state (field_tasks.c Task_MuddySlope)
  private muddyMapId: string | null = null;
  private muddyPrevLocalX: number = -1;
  private muddyPrevLocalY: number = -1;
  private pendingMuddySlopeAnimations: PendingMuddySlopeAnimation[] = [];

  // Sootopolis ice state machine (field_tasks.c states 0-3)
  private iceState: number = 0;
  private iceDelay: number = 0;
  private iceTileX: number = 0;
  private iceTileY: number = 0;

  // Fortree bridge state (field_tasks.c FortreeBridgePerStepCallback)
  private fortreeBridgeState: FortreeBridgeState = {
    state: 0,
    prevX: 0,
    prevY: 0,
    oldBridgeX: 0,
    oldBridgeY: 0,
    bounceTime: 0,
  };
  private pendingFortreeBounceRestores: PendingFortreeBounceRestore[] = [];

  // Pacifidlog bridge state (field_tasks.c PacifidlogBridgePerStepCallback)
  private pacifidlogBridgeState: PacifidlogBridgeState = {
    state: 0,
    prevX: 0,
    prevY: 0,
    toRaiseX: -1,
    toRaiseY: -1,
    delay: 0,
  };

  // Cracked floor state (field_tasks.c CrackedFloorPerStepCallback)
  private crackedFloorState: CrackedFloorState = {
    prevX: 0,
    prevY: 0,
    floor1Delay: 0,
    floor1X: 0,
    floor1Y: 0,
    floor2Delay: 0,
    floor2X: 0,
    floor2Y: 0,
  };

  // Map-agnostic step edge detector used for island-specific counters.
  private prevStepMapId: string | null = null;
  private prevStepDestLocalX: number | null = null;
  private prevStepDestLocalY: number | null = null;

  /**
   * Activate a per-step callback.
   * Called by the `setstepcallback` script command.
   */
  setCallback(id: number): void {
    this.callbackId = id;
    this.iceState = 0;
    this.iceDelay = 0;
    this.prevLocalX = -1;
    this.prevLocalY = -1;
    this.ashPrevLocalX = 0;
    this.ashPrevLocalY = 0;
    this.pendingAshFieldEffects = [];
    this.muddyMapId = null;
    this.muddyPrevLocalX = -1;
    this.muddyPrevLocalY = -1;
    this.pendingMuddySlopeAnimations = [];
    this.prevStepMapId = null;
    this.prevStepDestLocalX = null;
    this.prevStepDestLocalY = null;
    this.resetFortreeBridgeState();
    this.resetPacifidlogBridgeState();
    this.resetCrackedFloorState();
  }

  getCallbackId(): number {
    return this.callbackId;
  }

  getDebugState(): StepCallbackDebugState {
    const callbackName = this.callbackId === STEP_CB_DUMMY
      ? 'STEP_CB_DUMMY'
      : this.callbackId === STEP_CB_ASH
        ? 'STEP_CB_ASH'
        : this.callbackId === STEP_CB_FORTREE_BRIDGE
          ? 'STEP_CB_FORTREE_BRIDGE'
          : this.callbackId === STEP_CB_PACIFIDLOG_BRIDGE
            ? 'STEP_CB_PACIFIDLOG_BRIDGE'
        : this.callbackId === STEP_CB_SOOTOPOLIS_ICE
          ? 'STEP_CB_SOOTOPOLIS_ICE'
          : this.callbackId === STEP_CB_TRUCK
            ? 'STEP_CB_TRUCK'
            : this.callbackId === STEP_CB_SECRET_BASE
              ? 'STEP_CB_SECRET_BASE'
              : this.callbackId === STEP_CB_CRACKED_FLOOR
                ? 'STEP_CB_CRACKED_FLOOR'
          : 'STEP_CB_OTHER';

    return {
      callbackId: this.callbackId,
      callbackName,
      iceState: this.iceState,
      iceDelay: this.iceDelay,
      iceTileX: this.iceTileX,
      iceTileY: this.iceTileY,
      fortreeState: this.fortreeBridgeState.state,
      fortreeBounceTime: this.fortreeBridgeState.bounceTime,
      pacifidlogState: this.pacifidlogBridgeState.state,
      pacifidlogDelay: this.pacifidlogBridgeState.delay,
      crackedFloorDelayA: this.crackedFloorState.floor1Delay,
      crackedFloorDelayB: this.crackedFloorState.floor2Delay,
    };
  }

  /** Reset to no active callback (e.g. on map change without ON_RESUME). */
  reset(): void {
    this.callbackId = STEP_CB_DUMMY;
    this.iceState = 0;
    this.iceDelay = 0;
    this.prevLocalX = -1;
    this.prevLocalY = -1;
    this.ashPrevLocalX = 0;
    this.ashPrevLocalY = 0;
    this.pendingAshFieldEffects = [];
    this.muddyMapId = null;
    this.muddyPrevLocalX = -1;
    this.muddyPrevLocalY = -1;
    this.pendingMuddySlopeAnimations = [];
    this.prevStepMapId = null;
    this.prevStepDestLocalX = null;
    this.prevStepDestLocalY = null;
    this.resetFortreeBridgeState();
    this.resetPacifidlogBridgeState();
    this.resetCrackedFloorState();
  }

  /**
   * Run the active callback for one frame.
   * Called from the game loop each GBA frame tick.
   */
  update(ctx: StepCallbackContext): void {
    this.updateLegendaryIslandStepCounters(ctx);
    this.updateMuddySlopeTask(ctx);

    if (this.callbackId === STEP_CB_DUMMY) return;

    if (this.callbackId === STEP_CB_ASH) {
      this.updatePendingAshFieldEffects(ctx);
    }

    switch (this.callbackId) {
      case STEP_CB_ASH:
        this.updateAshGrass(ctx);
        break;
      case STEP_CB_FORTREE_BRIDGE:
        this.updateFortreeBridge(ctx);
        break;
      case STEP_CB_PACIFIDLOG_BRIDGE:
        this.updatePacifidlogBridge(ctx);
        break;
      case STEP_CB_SOOTOPOLIS_ICE:
        this.updateSootopolisIce(ctx);
        break;
      case STEP_CB_TRUCK:
      case STEP_CB_SECRET_BASE:
        // C callbacks delegate to truck/secret-base modules.
        // Runtime parity is handled elsewhere in this project.
        break;
      case STEP_CB_CRACKED_FLOOR:
        this.updateCrackedFloor(ctx);
        break;
      default:
        break;
    }
  }

  private didPlayerAdvanceStep(ctx: StepCallbackContext): boolean {
    if (this.prevStepMapId !== ctx.currentMapId) {
      this.prevStepMapId = ctx.currentMapId;
      this.prevStepDestLocalX = ctx.playerDestLocalX;
      this.prevStepDestLocalY = ctx.playerDestLocalY;
      return false;
    }

    if (this.prevStepDestLocalX === ctx.playerDestLocalX && this.prevStepDestLocalY === ctx.playerDestLocalY) {
      return false;
    }

    this.prevStepDestLocalX = ctx.playerDestLocalX;
    this.prevStepDestLocalY = ctx.playerDestLocalY;
    return true;
  }

  private resetFortreeBridgeState(): void {
    this.fortreeBridgeState = {
      state: 0,
      prevX: 0,
      prevY: 0,
      oldBridgeX: 0,
      oldBridgeY: 0,
      bounceTime: 0,
    };
    this.pendingFortreeBounceRestores = [];
  }

  private resetPacifidlogBridgeState(): void {
    this.pacifidlogBridgeState = {
      state: 0,
      prevX: 0,
      prevY: 0,
      toRaiseX: -1,
      toRaiseY: -1,
      delay: 0,
    };
  }

  private resetCrackedFloorState(): void {
    this.crackedFloorState = {
      prevX: 0,
      prevY: 0,
      floor1Delay: 0,
      floor1X: 0,
      floor1Y: 0,
      floor2Delay: 0,
      floor2X: 0,
      floor2Y: 0,
    };
  }

  private getPacifidlogLogOrientation(behavior: number | undefined): PacifidlogLogOrientation | null {
    if (behavior === MB_PACIFIDLOG_VERTICAL_LOG_TOP) return 'verticalTop';
    if (behavior === MB_PACIFIDLOG_VERTICAL_LOG_BOTTOM) return 'verticalBottom';
    if (behavior === MB_PACIFIDLOG_HORIZONTAL_LOG_LEFT) return 'horizontalLeft';
    if (behavior === MB_PACIFIDLOG_HORIZONTAL_LOG_RIGHT) return 'horizontalRight';
    return null;
  }

  private isPacifidlogLogBehavior(behavior: number | undefined): boolean {
    return this.getPacifidlogLogOrientation(behavior) !== null;
  }

  private trySetPacifidlogBridgeMetatiles(
    offsetsByOrientation: Record<PacifidlogLogOrientation, readonly [MetatileOffset, MetatileOffset]>,
    x: number,
    y: number,
    ctx: StepCallbackContext
  ): boolean {
    const orientation = this.getPacifidlogLogOrientation(ctx.getTileBehaviorLocal(x, y));
    if (!orientation) {
      return false;
    }

    let changed = false;
    const offsets = offsetsByOrientation[orientation];
    for (const offset of offsets) {
      const targetX = x + offset.x;
      const targetY = y + offset.y;
      if (ctx.getTileMetatileIdLocal(targetX, targetY) !== offset.metatileId) {
        ctx.setMapMetatile(targetX, targetY, offset.metatileId);
        changed = true;
      }
    }

    return changed;
  }

  private shouldRaisePacifidlogLogs(newX: number, newY: number, oldX: number, oldY: number, ctx: StepCallbackContext): boolean {
    const oldOrientation = this.getPacifidlogLogOrientation(ctx.getTileBehaviorLocal(oldX, oldY));
    if (oldOrientation === 'verticalTop' && newY > oldY) return false;
    if (oldOrientation === 'verticalBottom' && newY < oldY) return false;
    if (oldOrientation === 'horizontalLeft' && newX > oldX) return false;
    if (oldOrientation === 'horizontalRight' && newX < oldX) return false;
    return true;
  }

  private shouldSinkPacifidlogLogs(newX: number, newY: number, oldX: number, oldY: number, ctx: StepCallbackContext): boolean {
    const newOrientation = this.getPacifidlogLogOrientation(ctx.getTileBehaviorLocal(newX, newY));
    if (newOrientation === 'verticalTop' && newY < oldY) return false;
    if (newOrientation === 'verticalBottom' && newY > oldY) return false;
    if (newOrientation === 'horizontalLeft' && newX < oldX) return false;
    if (newOrientation === 'horizontalRight' && newX > oldX) return false;
    return true;
  }

  private isFortreeBridgeBehavior(behavior: number | undefined): boolean {
    return behavior === MB_FORTREE_BRIDGE;
  }

  private canModifyFortreeBridgeForElevation(ctx: StepCallbackContext): boolean {
    const elevation = ctx.playerElevation ?? 0;
    return (elevation & 1) === 0;
  }

  private tryLowerFortreeBridge(x: number, y: number, ctx: StepCallbackContext): boolean {
    if (!this.canModifyFortreeBridgeForElevation(ctx)) {
      return false;
    }

    const metatileId = ctx.getTileMetatileIdLocal(x, y);
    if (metatileId === METATILE_FORTREE_BRIDGE_OVER_GRASS_RAISED) {
      ctx.setMapMetatile(x, y, METATILE_FORTREE_BRIDGE_OVER_GRASS_LOWERED);
      return true;
    }
    if (metatileId === METATILE_FORTREE_BRIDGE_OVER_TREES_RAISED) {
      ctx.setMapMetatile(x, y, METATILE_FORTREE_BRIDGE_OVER_TREES_LOWERED);
      return true;
    }
    return false;
  }

  private tryRaiseFortreeBridge(x: number, y: number, ctx: StepCallbackContext): boolean {
    if (!this.canModifyFortreeBridgeForElevation(ctx)) {
      return false;
    }

    const metatileId = ctx.getTileMetatileIdLocal(x, y);
    if (metatileId === METATILE_FORTREE_BRIDGE_OVER_GRASS_LOWERED) {
      ctx.setMapMetatile(x, y, METATILE_FORTREE_BRIDGE_OVER_GRASS_RAISED);
      return true;
    }
    if (metatileId === METATILE_FORTREE_BRIDGE_OVER_TREES_LOWERED) {
      ctx.setMapMetatile(x, y, METATILE_FORTREE_BRIDGE_OVER_TREES_RAISED);
      return true;
    }
    return false;
  }

  private updatePendingFortreeBounceRestores(ctx: StepCallbackContext): boolean {
    if (this.pendingFortreeBounceRestores.length === 0) {
      return false;
    }

    let changed = false;
    const remaining: PendingFortreeBounceRestore[] = [];
    for (const entry of this.pendingFortreeBounceRestores) {
      entry.delayFrames--;
      if (entry.delayFrames <= 0) {
        changed = this.tryRaiseFortreeBridge(entry.x, entry.y, ctx) || changed;
      } else {
        remaining.push(entry);
      }
    }

    this.pendingFortreeBounceRestores = remaining;
    return changed;
  }

  private enqueueFortreeBounceRestore(x: number, y: number): void {
    const existing = this.pendingFortreeBounceRestores.find((entry) => entry.x === x && entry.y === y);
    if (existing) {
      existing.delayFrames = 1;
      return;
    }
    this.pendingFortreeBounceRestores.push({ x, y, delayFrames: 1 });
  }

  private updateFortreeBridgeBounceFrame(ctx: StepCallbackContext): boolean {
    const state = this.fortreeBridgeState;
    if (state.state !== 2) {
      return false;
    }

    let changed = false;
    state.bounceTime = Math.max(0, state.bounceTime - 1);
    if (state.bounceTime % 7 === 4) {
      if (this.tryLowerFortreeBridge(state.oldBridgeX, state.oldBridgeY, ctx)) {
        changed = true;
        this.enqueueFortreeBounceRestore(state.oldBridgeX, state.oldBridgeY);
      }
    }
    if (state.bounceTime === 0) {
      state.state = 1;
    }
    return changed;
  }

  // --- Fortree Bridge Step Callback ---
  // C reference: field_tasks.c FortreeBridgePerStepCallback.
  private updateFortreeBridge(ctx: StepCallbackContext): void {
    let changed = this.updatePendingFortreeBounceRestores(ctx);
    const state = this.fortreeBridgeState;
    const x = ctx.playerDestLocalX;
    const y = ctx.playerDestLocalY;

    switch (state.state) {
      case 0:
        state.prevX = x;
        state.prevY = y;
        if (this.isFortreeBridgeBehavior(ctx.getTileBehaviorLocal(x, y))) {
          changed = this.tryLowerFortreeBridge(x, y, ctx) || changed;
        }
        state.state = 1;
        break;
      case 1: {
        const prevX = state.prevX;
        const prevY = state.prevY;
        if (x === prevX && y === prevY) {
          break;
        }

        const isBridgeCurrent = this.isFortreeBridgeBehavior(ctx.getTileBehaviorLocal(x, y));
        const isBridgePrevious = this.isFortreeBridgeBehavior(ctx.getTileBehaviorLocal(prevX, prevY));

        // Emerald parity keeps the original behavior (without BUGFIX define):
        // only transitions when stepping off an existing bridge section.
        if (isBridgePrevious) {
          changed = this.tryRaiseFortreeBridge(prevX, prevY, ctx) || changed;
          changed = this.tryLowerFortreeBridge(x, y, ctx) || changed;
        }

        void isBridgeCurrent; // kept for parity readability; SFX is handled elsewhere.

        state.oldBridgeX = prevX;
        state.oldBridgeY = prevY;
        state.prevX = x;
        state.prevY = y;
        if (!isBridgePrevious) {
          break;
        }

        state.bounceTime = 16;
        state.state = 2;
        changed = this.updateFortreeBridgeBounceFrame(ctx) || changed;
        break;
      }
      case 2: {
        changed = this.updateFortreeBridgeBounceFrame(ctx) || changed;
        break;
      }
      default:
        state.state = 0;
        break;
    }

    if (changed) {
      ctx.invalidateView();
    }
  }

  // --- Pacifidlog Bridge Step Callback ---
  // C reference: field_tasks.c PacifidlogBridgePerStepCallback.
  private updatePacifidlogBridge(ctx: StepCallbackContext): void {
    let changed = false;
    const state = this.pacifidlogBridgeState;
    const x = ctx.playerDestLocalX;
    const y = ctx.playerDestLocalY;

    switch (state.state) {
      case 0:
        state.prevX = x;
        state.prevY = y;
        changed = this.trySetPacifidlogBridgeMetatiles(PACIFIDLOG_FULLY_SUBMERGED_OFFSETS, x, y, ctx) || changed;
        state.state = 1;
        break;
      case 1:
        if (x === state.prevX && y === state.prevY) {
          break;
        }

        if (this.shouldRaisePacifidlogLogs(x, y, state.prevX, state.prevY, ctx)) {
          changed = this.trySetPacifidlogBridgeMetatiles(
            PACIFIDLOG_HALF_SUBMERGED_OFFSETS,
            state.prevX,
            state.prevY,
            ctx
          ) || changed;
          // C sets floating metatiles here without redraw; in this renderer map edits
          // are immediately visible, so we defer floating to the delayed state.
          state.toRaiseX = state.prevX;
          state.toRaiseY = state.prevY;
          state.state = 2;
          state.delay = 8;
        } else {
          state.toRaiseX = -1;
          state.toRaiseY = -1;
        }

        if (this.shouldSinkPacifidlogLogs(x, y, state.prevX, state.prevY, ctx)) {
          changed = this.trySetPacifidlogBridgeMetatiles(PACIFIDLOG_HALF_SUBMERGED_OFFSETS, x, y, ctx) || changed;
          state.state = 2;
          state.delay = 8;
        }

        state.prevX = x;
        state.prevY = y;

        // SFX parity omitted here (SE_PUDDLE), handled by other audio paths.
        void this.isPacifidlogLogBehavior(ctx.getTileBehaviorLocal(x, y));
        break;
      case 2:
        if (state.delay > 0) {
          state.delay--;
        }
        if (state.delay === 0) {
          changed = this.trySetPacifidlogBridgeMetatiles(PACIFIDLOG_FULLY_SUBMERGED_OFFSETS, x, y, ctx) || changed;
          if (state.toRaiseX !== -1 && state.toRaiseY !== -1) {
            changed = this.trySetPacifidlogBridgeMetatiles(
              PACIFIDLOG_FLOATING_OFFSETS,
              state.toRaiseX,
              state.toRaiseY,
              ctx
            ) || changed;
          }
          state.state = 1;
        }
        break;
      default:
        state.state = 0;
        break;
    }

    if (changed) {
      ctx.invalidateView();
    }
  }

  private setCrackedFloorHoleMetatile(x: number, y: number, ctx: StepCallbackContext): boolean {
    const metatileId = ctx.getTileMetatileIdLocal(x, y);
    if (metatileId === undefined) {
      return false;
    }

    const holeMetatileId = metatileId === METATILE_CAVE_CRACKED_FLOOR
      ? METATILE_CAVE_CRACKED_FLOOR_HOLE
      : METATILE_PACIFIDLOG_SKYPILLAR_CRACKED_FLOOR_HOLE;
    if (metatileId !== holeMetatileId) {
      ctx.setMapMetatile(x, y, holeMetatileId);
      return true;
    }
    return false;
  }

  // --- Cracked Floor Step Callback ---
  // C reference: field_tasks.c CrackedFloorPerStepCallback.
  private updateCrackedFloor(ctx: StepCallbackContext): void {
    const state = this.crackedFloorState;
    const x = ctx.playerDestLocalX;
    const y = ctx.playerDestLocalY;
    const behavior = ctx.getTileBehaviorLocal(x, y);
    let changed = false;

    if (state.floor1Delay !== 0 && --state.floor1Delay === 0) {
      changed = this.setCrackedFloorHoleMetatile(state.floor1X, state.floor1Y, ctx) || changed;
    }
    if (state.floor2Delay !== 0 && --state.floor2Delay === 0) {
      changed = this.setCrackedFloorHoleMetatile(state.floor2X, state.floor2Y, ctx) || changed;
    }

    if (behavior === MB_CRACKED_FLOOR_HOLE) {
      gameVariables.setVar('VAR_ICE_STEP_COUNT', 0);
    }

    if (x === state.prevX && y === state.prevY) {
      if (changed) {
        ctx.invalidateView();
      }
      return;
    }

    state.prevX = x;
    state.prevY = y;
    if (behavior === MB_CRACKED_FLOOR) {
      if (!ctx.isPlayerAtFastestSpeed) {
        gameVariables.setVar('VAR_ICE_STEP_COUNT', 0);
      }

      if (state.floor1Delay === 0) {
        state.floor1Delay = 3;
        state.floor1X = x;
        state.floor1Y = y;
      } else if (state.floor2Delay === 0) {
        state.floor2Delay = 3;
        state.floor2X = x;
        state.floor2Y = y;
      }
    }

    if (changed) {
      ctx.invalidateView();
    }
  }

  /**
   * C refs:
   * - public/pokeemerald/src/field_control_avatar.c
   *   - IncrementBirthIslandRockStepCount()
   *   - UpdateFarawayIslandStepCounter()
   * - public/pokeemerald/src/field_specials.c (IncrementBirthIslandRockStepCount)
   * - public/pokeemerald/src/faraway_island.c (UpdateFarawayIslandStepCounter)
   */
  private updateLegendaryIslandStepCounters(ctx: StepCallbackContext): void {
    if (!this.didPlayerAdvanceStep(ctx)) return;

    if (ctx.currentMapId === 'MAP_BIRTH_ISLAND_EXTERIOR') {
      const next = gameVariables.getVar('VAR_DEOXYS_ROCK_STEP_COUNT') + 1;
      gameVariables.setVar('VAR_DEOXYS_ROCK_STEP_COUNT', next > 99 ? 0 : next);
    }

    if (ctx.currentMapId === 'MAP_FARAWAY_ISLAND_INTERIOR') {
      const next = gameVariables.getVar('VAR_FARAWAY_ISLAND_STEP_COUNTER') + 1;
      gameVariables.setVar('VAR_FARAWAY_ISLAND_STEP_COUNTER', next >= 9999 ? 0 : next);
    }
  }

  // --- Muddy Slope Task ---
  // C reference: field_tasks.c Task_MuddySlope + SetMuddySlopeMetatile.
  // This task is always active in overworld regardless of step callback selection.

  private updateMuddySlopeTask(ctx: StepCallbackContext): void {
    if (this.muddyMapId !== ctx.currentMapId) {
      this.muddyMapId = ctx.currentMapId;
      this.muddyPrevLocalX = ctx.playerDestLocalX;
      this.muddyPrevLocalY = ctx.playerDestLocalY;
      this.pendingMuddySlopeAnimations = [];
    }

    if (ctx.playerDestLocalX !== this.muddyPrevLocalX || ctx.playerDestLocalY !== this.muddyPrevLocalY) {
      this.muddyPrevLocalX = ctx.playerDestLocalX;
      this.muddyPrevLocalY = ctx.playerDestLocalY;

      const behavior = ctx.getTileBehaviorLocal(ctx.playerDestLocalX, ctx.playerDestLocalY);
      if (
        behavior === MB_MUDDY_SLOPE
        && this.pendingMuddySlopeAnimations.length < MAX_ACTIVE_MUDDY_SLOPES
      ) {
        this.pendingMuddySlopeAnimations.push({
          mapId: ctx.currentMapId,
          localX: ctx.playerDestLocalX,
          localY: ctx.playerDestLocalY,
          remainingFrames: MUDDY_SLOPE_ANIM_TIME,
        });
      }
    }

    if (this.pendingMuddySlopeAnimations.length === 0) {
      return;
    }

    let changedMetatile = false;
    const remaining: PendingMuddySlopeAnimation[] = [];

    for (const entry of this.pendingMuddySlopeAnimations) {
      if (entry.mapId !== ctx.currentMapId) {
        continue;
      }

      entry.remainingFrames--;

      const metatileId = entry.remainingFrames <= 0
        ? METATILE_MUDDY_SLOPE_FRAME0
        : MUDDY_SLOPE_ANIM_FRAMES[
          Math.max(
            0,
            Math.min(
              MUDDY_SLOPE_ANIM_FRAMES.length - 1,
              Math.floor(entry.remainingFrames / MUDDY_SLOPE_ANIM_STEP_TIME)
            )
          )
        ];

      ctx.setMapMetatile(entry.localX, entry.localY, metatileId);
      changedMetatile = true;

      if (entry.remainingFrames > 0) {
        remaining.push(entry);
      }
    }

    this.pendingMuddySlopeAnimations = remaining;

    if (changedMetatile) {
      ctx.invalidateView();
    }
  }

  /**
   * Restore cracked ice metatiles from saved state on map load.
   * Called by the `SetSootopolisGymCrackedIceMetatiles` special in ON_LOAD.
   *
   * Iterates the ice puzzle region and sets any previously-visited thin ice
   * tiles to cracked state (using bit flags stored in temporary variables).
   */
  setSootopolisGymCrackedIceMetatiles(
    ctx: Pick<StepCallbackContext, 'setMapMetatile' | 'invalidateView'>,
  ): void {
    let changed = false;
    for (let y = ICE_PUZZLE_T; y <= ICE_PUZZLE_B; y++) {
      const rowVar = ICE_ROW_VARS[y];
      if (!rowVar) continue;

      const bits = gameVariables.getVar(rowVar);
      if (bits === 0) continue;

      for (let x = ICE_PUZZLE_L; x <= ICE_PUZZLE_R; x++) {
        const bit = 1 << (x - ICE_PUZZLE_L);
        if (bits & bit) {
          ctx.setMapMetatile(x, y, METATILE_ICE_CRACKED);
          changed = true;
        }
      }
    }
    if (changed) {
      ctx.invalidateView();
    }
  }

  // --- Ash Grass Step Callback ---
  // C reference: field_tasks.c AshGrassPerStepCallback + StartAshFieldEffect in field_effect_helpers.c

  private updateAshGrass(ctx: StepCallbackContext): void {
    const x = ctx.playerDestLocalX;
    const y = ctx.playerDestLocalY;

    // End if player hasn't moved (matches tPrevX/tPrevY gate in C).
    if (x === this.ashPrevLocalX && y === this.ashPrevLocalY) {
      return;
    }

    this.ashPrevLocalX = x;
    this.ashPrevLocalY = y;

    if (ctx.getTileBehaviorLocal(x, y) !== MB_ASHGRASS) {
      return;
    }

    const metatileId = ctx.getTileMetatileIdLocal(x, y);
    const replacementMetatileId = metatileId === METATILE_FALLARBOR_ASH_GRASS
      ? METATILE_FALLARBOR_NORMAL_GRASS
      : METATILE_LAVARIDGE_NORMAL_GRASS;

    this.pendingAshFieldEffects.push({
      mapId: ctx.currentMapId,
      localX: x,
      localY: y,
      replacementMetatileId,
      delayFrames: ASH_FIELD_EFFECT_DELAY_FRAMES,
    });

    // Try to gather ash if player has Soot Sack.
    if (bagManager.hasItem(ITEMS.ITEM_SOOT_SACK)) {
      const gathered = gameVariables.getVar('VAR_ASH_GATHER_COUNT');
      if (gathered < MAX_ASH_GATHER_COUNT) {
        gameVariables.setVar('VAR_ASH_GATHER_COUNT', gathered + 1);
      }
    }
  }

  private updatePendingAshFieldEffects(ctx: StepCallbackContext): void {
    if (this.pendingAshFieldEffects.length === 0) {
      return;
    }

    let changedMetatile = false;
    const remaining: PendingAshFieldEffect[] = [];

    for (const effect of this.pendingAshFieldEffects) {
      // Drop delayed effects when leaving the map they were queued on.
      if (effect.mapId !== ctx.currentMapId) {
        continue;
      }

      effect.delayFrames--;
      if (effect.delayFrames > 0) {
        remaining.push(effect);
        continue;
      }

      ctx.startFieldEffectLocal?.(effect.localX, effect.localY, 'ASH', 'player');
      ctx.setMapMetatile(effect.localX, effect.localY, effect.replacementMetatileId);
      changedMetatile = true;
    }

    this.pendingAshFieldEffects = remaining;

    if (changedMetatile) {
      ctx.invalidateView();
    }
  }

  // --- Sootopolis Gym Ice Step Callback ---
  // C reference: field_tasks.c SootopolisGymIcePerStepCallback (lines 659-736)

  private updateSootopolisIce(ctx: StepCallbackContext): void {
    switch (this.iceState) {
      case 0:
        // State 0: Initialize — record starting position
        this.prevLocalX = ctx.playerDestLocalX;
        this.prevLocalY = ctx.playerDestLocalY;
        this.iceState = 1;
        break;

      case 1: {
        // State 1: Wait for movement
        if (ctx.playerDestLocalX === this.prevLocalX && ctx.playerDestLocalY === this.prevLocalY) {
          break; // Player hasn't moved
        }

        // Player moved to a new tile
        const newX = ctx.playerDestLocalX;
        const newY = ctx.playerDestLocalY;
        this.prevLocalX = newX;
        this.prevLocalY = newY;

        const behavior = ctx.getTileBehaviorLocal(newX, newY);

        if (behavior === MB_THIN_ICE) {
          // Stepped on thin ice → crack it after delay
          gameVariables.addVar('VAR_ICE_STEP_COUNT', 1);
          this.iceDelay = 4;
          this.iceTileX = newX;
          this.iceTileY = newY;
          this.iceState = 2;
        } else if (behavior === MB_CRACKED_ICE) {
          // Stepped on cracked ice → break it after delay (triggers fall via ON_FRAME)
          gameVariables.setVar('VAR_ICE_STEP_COUNT', 0);
          this.iceDelay = 4;
          this.iceTileX = newX;
          this.iceTileY = newY;
          this.iceState = 3;
        }
        break;
      }

      case 2:
        // State 2: Cracking delay (4 frames)
        this.iceDelay--;
        if (this.iceDelay <= 0) {
          // SE_ICE_CRACK would play here (audio not yet implemented)
          ctx.setMapMetatile(this.iceTileX, this.iceTileY, METATILE_ICE_CRACKED);
          ctx.invalidateView();
          this.markIceVisited(this.iceTileX, this.iceTileY);
          this.iceState = 1;
        }
        break;

      case 3:
        // State 3: Breaking delay (4 frames)
        this.iceDelay--;
        if (this.iceDelay <= 0) {
          // SE_ICE_BREAK would play here (audio not yet implemented)
          ctx.setMapMetatile(this.iceTileX, this.iceTileY, METATILE_ICE_BROKEN);
          ctx.invalidateView();
          this.iceState = 1;
        }
        break;
    }
  }

  /** Mark a tile as visited by setting its bit in the row's temporary variable. */
  private markIceVisited(x: number, y: number): void {
    const rowVar = ICE_ROW_VARS[y];
    if (!rowVar) return;
    const bits = gameVariables.getVar(rowVar);
    gameVariables.setVar(rowVar, bits | (1 << (x - ICE_PUZZLE_L)));
  }
}

export const stepCallbackManager = new StepCallbackManagerImpl();
