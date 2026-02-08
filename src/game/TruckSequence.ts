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

export interface TruckSequenceOutput {
  /** Camera Y offset in pixels (applied to view) */
  shakeOffsetY: number;
  /** Whether player input should be locked */
  playerLocked: boolean;
  /** Whether the entire sequence is complete */
  complete: boolean;
}

export class TruckSequence {
  private frame = 0;
  private phase = 0;
  private _complete = false;

  /** Phase transition frame thresholds */
  private static readonly PHASE_FRAMES = [90, 240, 540, 630, 720, 840];

  /**
   * Call once per game frame. Returns current shake offset and lock state.
   */
  update(): TruckSequenceOutput {
    if (this._complete) {
      return { shakeOffsetY: 0, playerLocked: false, complete: true };
    }

    this.frame++;

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
      return { shakeOffsetY: 0, playerLocked: false, complete: true };
    }

    let shakeOffsetY = 0;

    if (this.phase >= 0 && this.phase <= 2) {
      // Phases 0–2: Full amplitude camera bobbing
      shakeOffsetY = SHAKE_TABLE[this.frame % SHAKE_TABLE.length];
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
