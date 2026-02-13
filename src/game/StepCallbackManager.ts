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

import { gameVariables } from './GameVariables';
import { bagManager } from './BagManager';
import { ITEMS } from '../data/items';
import { METATILE_LABELS } from '../data/metatileLabels.gen';
import { MB_ASHGRASS } from '../utils/metatileBehaviors.generated';
import type { FieldEffectType } from './FieldEffectManager';

// Step callback IDs from include/constants/field_tasks.h
const STEP_CB_DUMMY = 0;
const STEP_CB_ASH = 1;
const STEP_CB_SOOTOPOLIS_ICE = 4;

// Metatile behavior constants (from metatileBehaviors.generated.ts)
const MB_THIN_ICE = 38;
const MB_CRACKED_ICE = 39;

// Sootopolis Gym metatile IDs (from metatileLabels.gen.ts)
const METATILE_ICE_CRACKED = 0x20E;
const METATILE_ICE_BROKEN = 0x206;

// Ash grass metatiles (Route 113 / Lavaridge fallback)
const METATILE_FALLARBOR_ASH_GRASS = METATILE_LABELS['METATILE_Fallarbor_AshGrass'] ?? 0x20A;
const METATILE_FALLARBOR_NORMAL_GRASS = METATILE_LABELS['METATILE_Fallarbor_NormalGrass'] ?? 0x212;
const METATILE_LAVARIDGE_NORMAL_GRASS = METATILE_LABELS['METATILE_Lavaridge_NormalGrass'] ?? 0x206;
const ASH_FIELD_EFFECT_DELAY_FRAMES = 4;
const MAX_ASH_GATHER_COUNT = 9999;

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
}

interface PendingAshFieldEffect {
  mapId: string;
  localX: number;
  localY: number;
  replacementMetatileId: number;
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

  // Sootopolis ice state machine (field_tasks.c states 0-3)
  private iceState: number = 0;
  private iceDelay: number = 0;
  private iceTileX: number = 0;
  private iceTileY: number = 0;

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
    this.prevStepMapId = null;
    this.prevStepDestLocalX = null;
    this.prevStepDestLocalY = null;
  }

  getCallbackId(): number {
    return this.callbackId;
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
    this.prevStepMapId = null;
    this.prevStepDestLocalX = null;
    this.prevStepDestLocalY = null;
  }

  /**
   * Run the active callback for one frame.
   * Called from the game loop each GBA frame tick.
   */
  update(ctx: StepCallbackContext): void {
    this.updateLegendaryIslandStepCounters(ctx);

    if (this.callbackId === STEP_CB_DUMMY) return;

    if (this.callbackId === STEP_CB_ASH) {
      this.updatePendingAshFieldEffects(ctx);
    }

    switch (this.callbackId) {
      case STEP_CB_ASH:
        this.updateAshGrass(ctx);
        break;
      case STEP_CB_SOOTOPOLIS_ICE:
        this.updateSootopolisIce(ctx);
        break;
      // Other callbacks (bridge, cracked floor, etc.) can be added here
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
