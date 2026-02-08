/**
 * TruckSequence - State machine for the inside-of-truck intro cutscene.
 *
 * C reference: public/pokeemerald/src/field_special_scene.c
 *   - ExecuteTruckSequence() → Task_HandleTruckSequence (6 phases)
 *   - Task_Truck1/2/3 for camera bobbing and panning
 *
 * Simplified for browser: we skip palette fades and box bouncing,
 * focusing on the camera shake that the player actually notices.
 *
 * Phase timing (at ~60 fps):
 *   0: 0–90f     Lock player, fade-in period
 *   1: 90–240f   Vertical camera bobbing (truck in motion)
 *   2: 240–540f  Continue bobbing
 *   3: 540–630f  Deceleration — shake amplitude fades to 0
 *   4: 630–720f  Stopped. Play unload sound (conceptual)
 *   5: 720–840f  Door opens. Unlock player after this
 */

/** Vertical shake table for camera bobbing during truck motion */
const SHAKE_TABLE = [0, 0, 0, 1, 1, 2, 2, 2, 2, 2, 1, 1, 0, 0, -1, -1] as const;

export interface TruckBoxOffsets {
  box1X: number;  // top box X: resting 3
  box1Y: number;  // top box Y: resting 3 + bounce(timer+30) * 4
  box2X: number;  // bottom-left X: resting 0
  box2Y: number;  // bottom-left Y: resting -3 + bounce(timer) * 2
  box3X: number;  // bottom-right X: resting -3
  box3Y: number;  // bottom-right Y: resting 0 + bounce(timer) * 4
}

export interface TruckSequenceOutput {
  /** Camera Y offset in pixels (applied to view) */
  shakeOffsetY: number;
  /** Whether player input should be locked */
  playerLocked: boolean;
  /** Whether the entire sequence is complete */
  complete: boolean;
  /** Y offsets for the three moving boxes inside the truck */
  boxOffsets: TruckBoxOffsets;
}

export class TruckSequence {
  private frame = 0;
  private phase = 0;
  private _complete = false;

  /** Phase transition frame thresholds */
  private static readonly PHASE_FRAMES = [90, 240, 540, 630, 720, 840];

  /** Resting offsets (no bounce) — boxes return to these when truck stops */
  private static readonly RESTING_BOX_OFFSETS: TruckBoxOffsets = {
    box1X: 3,  box1Y: 3,
    box2X: 0,  box2Y: -3,
    box3X: -3, box3Y: 0,
  };

  /**
   * Port of GetTruckBoxYMovement from field_special_scene.c
   * Returns -1 every 180 frames (with offset), else 0.
   */
  private static getTruckBoxBounce(time: number): number {
    return ((time + 120) % 180) === 0 ? -1 : 0;
  }

  /**
   * Advance by one or more GBA logic frames.
   */
  update(frames: number = 1): TruckSequenceOutput {
    if (this._complete) {
      return { shakeOffsetY: 0, playerLocked: false, complete: true, boxOffsets: TruckSequence.RESTING_BOX_OFFSETS };
    }

    const frameSteps = Math.max(1, Math.floor(frames));
    this.frame += frameSteps;

    // Advance phase based on frame count
    while (
      this.phase < TruckSequence.PHASE_FRAMES.length &&
      this.frame >= TruckSequence.PHASE_FRAMES[this.phase]
    ) {
      this.phase++;
    }

    // Phase 5+ = complete
    if (this.phase >= 6) {
      this._complete = true;
      return { shakeOffsetY: 0, playerLocked: false, complete: true, boxOffsets: TruckSequence.RESTING_BOX_OFFSETS };
    }

    let shakeOffsetY = 0;
    let boxOffsets = TruckSequence.RESTING_BOX_OFFSETS;

    if (this.phase >= 0 && this.phase <= 2) {
      // Phases 0–2: Full amplitude camera bobbing
      shakeOffsetY = SHAKE_TABLE[this.frame % SHAKE_TABLE.length];
      // Box bouncing: resting offsets + staggered bounce from C source
      boxOffsets = {
        box1X: 3,  box1Y: 3 + TruckSequence.getTruckBoxBounce(this.frame + 30) * 4,
        box2X: 0,  box2Y: -3 + TruckSequence.getTruckBoxBounce(this.frame) * 2,
        box3X: -3, box3Y: 0 + TruckSequence.getTruckBoxBounce(this.frame) * 4,
      };
    } else if (this.phase === 3) {
      // Phase 3: Deceleration — fade amplitude to 0
      const phaseStart = TruckSequence.PHASE_FRAMES[2]; // 540
      const phaseEnd = TruckSequence.PHASE_FRAMES[3]; // 630
      const progress = (this.frame - phaseStart) / (phaseEnd - phaseStart);
      const amplitude = 1 - progress;
      const rawShake = SHAKE_TABLE[this.frame % SHAKE_TABLE.length];
      shakeOffsetY = Math.round(rawShake * amplitude);
    }
    // Phases 4–5: No shake (truck stopped, door opening)

    return {
      shakeOffsetY,
      playerLocked: true,
      complete: false,
      boxOffsets,
    };
  }

  isComplete(): boolean {
    return this._complete;
  }

  reset(): void {
    this.frame = 0;
    this.phase = 0;
    this._complete = false;
  }
}
