import type { PlayerController } from './PlayerController';
import type { CameraController } from './CameraController';
import type { FieldEffectManager } from './FieldEffectManager';
import type { FadeController } from '../field/FadeController';

/**
 * Lavaridge Gym warp effects.
 *
 * C references:
 * - public/pokeemerald/src/field_effect.c
 *   - LavaridgeGymB1FWarpEffect_*
 *   - LavaridgeGymB1FWarpExitEffect_*
 *   - LavaridgeGym1FWarpEffect_*
 */
export type LavaridgeWarpStage =
  | 'idle'
  | 'b1fPreShake'
  | 'b1fPreRise'
  | 'oneFPreShuffle'
  | 'b1fPostRise'
  | 'b1fPostJump';

export interface LavaridgeWarpState {
  stage: LavaridgeWarpStage;
  startTime: number;
  duration: number;
  tileX: number;
  tileY: number;
  behavior: number;
  effectSpawned: boolean;
  jumpStarted: boolean;
}

export class LavaridgeWarpSequencer {
  private state: LavaridgeWarpState = {
    stage: 'idle',
    startTime: 0,
    duration: 0,
    tileX: 0,
    tileY: 0,
    behavior: 0,
    effectSpawned: false,
    jumpStarted: false,
  };

  private static readonly B1F_PRE_SHAKE_DURATION = 180;
  private static readonly B1F_PRE_RISE_DURATION = 420;
  private static readonly ONEF_PRE_SHUFFLE_DURATION = 360;
  private static readonly B1F_POST_RISE_DURATION = 420;
  private static readonly B1F_POST_JUMP_TIMEOUT = 700;
  private static readonly SHAKE_INTENSITY = 2;

  isActive(): boolean {
    return this.state.stage !== 'idle';
  }

  startB1FWarpOut(tileX: number, tileY: number, behavior: number, now: number): void {
    this.state = {
      stage: 'b1fPreShake',
      startTime: now,
      duration: LavaridgeWarpSequencer.B1F_PRE_SHAKE_DURATION,
      tileX,
      tileY,
      behavior,
      effectSpawned: false,
      jumpStarted: false,
    };
  }

  start1FWarpOut(tileX: number, tileY: number, behavior: number, now: number): void {
    this.state = {
      stage: 'oneFPreShuffle',
      startTime: now,
      duration: LavaridgeWarpSequencer.ONEF_PRE_SHUFFLE_DURATION,
      tileX,
      tileY,
      behavior,
      effectSpawned: false,
      jumpStarted: false,
    };
  }

  startB1FWarpArrival(tileX: number, tileY: number, behavior: number, now: number): void {
    this.state = {
      stage: 'b1fPostRise',
      startTime: now,
      duration: LavaridgeWarpSequencer.B1F_POST_RISE_DURATION,
      tileX,
      tileY,
      behavior,
      effectSpawned: false,
      jumpStarted: false,
    };
  }

  // Backward-compatible names for existing call sites.
  startPopOut(tileX: number, tileY: number, behavior: number, now: number): void {
    this.startB1FWarpOut(tileX, tileY, behavior, now);
  }

  startPopIn(tileX: number, tileY: number, behavior: number, now: number): void {
    this.startB1FWarpArrival(tileX, tileY, behavior, now);
  }

  update(
    now: number,
    player: PlayerController,
    camera: CameraController,
    fieldEffects: FieldEffectManager,
    _fade: FadeController,
    onExecuteWarp: () => void,
    onRevealPlayer?: () => void
  ): void {
    if (this.state.stage === 'idle') return;

    const elapsed = now - this.state.startTime;
    const progress = Math.min(1, elapsed / this.state.duration);

    if (this.state.stage === 'b1fPreShake') {
      const shakeY = (Math.floor(elapsed / 45) % 2 === 0 ? 1 : -1) * LavaridgeWarpSequencer.SHAKE_INTENSITY;
      camera.setPanning(0, shakeY);
      player.spriteYOffset = 0;

      if (progress >= 1) {
        if (!this.state.effectSpawned) {
          fieldEffects.create(this.state.tileX, this.state.tileY, 'ash_launch', false, 'player');
          this.state.effectSpawned = true;
        }
        this.state.stage = 'b1fPreRise';
        this.state.startTime = now;
        this.state.duration = LavaridgeWarpSequencer.B1F_PRE_RISE_DURATION;
      }
      return;
    }

    if (this.state.stage === 'b1fPreRise') {
      const intensity = Math.max(0, 1 - progress);
      const shakeY = (Math.floor(elapsed / 50) % 2 === 0 ? 1 : -1)
        * LavaridgeWarpSequencer.SHAKE_INTENSITY
        * intensity;
      camera.setPanning(0, shakeY);

      // B1F warp launches the player upward before fading out.
      player.spriteYOffset = -(progress * 20);

      if (progress >= 1) {
        camera.resetPanning();
        player.spriteYOffset = 0;
        this.reset();
        onExecuteWarp();
      }
      return;
    }

    if (this.state.stage === 'oneFPreShuffle') {
      const shakeX = (Math.floor(elapsed / 50) % 2 === 0 ? 1 : -1);
      camera.setPanning(shakeX, 0);
      player.spriteYOffset = 0;

      if (!this.state.effectSpawned && progress >= 0.55) {
        fieldEffects.create(this.state.tileX, this.state.tileY, 'ash_puff', false, 'player');
        this.state.effectSpawned = true;
      }

      if (progress >= 1) {
        camera.resetPanning();
        this.reset();
        onExecuteWarp();
      }
      return;
    }

    if (this.state.stage === 'b1fPostRise') {
      const intensity = Math.max(0, 1 - progress);
      const shakeY = (Math.floor(elapsed / 55) % 2 === 0 ? 1 : -1)
        * LavaridgeWarpSequencer.SHAKE_INTENSITY
        * intensity;
      camera.setPanning(0, shakeY);

      if (!this.state.effectSpawned) {
        fieldEffects.create(this.state.tileX, this.state.tileY, 'ash_puff', false, 'player');
        this.state.effectSpawned = true;
      }

      // Pop up from the ash tile.
      player.spriteYOffset = 16 - (progress * 16);

      if (progress >= 1) {
        camera.resetPanning();
        player.spriteYOffset = 0;
        this.state.stage = 'b1fPostJump';
        this.state.startTime = now;
        this.state.duration = LavaridgeWarpSequencer.B1F_POST_JUMP_TIMEOUT;
      }
      return;
    }

    if (this.state.stage === 'b1fPostJump') {
      if (!this.state.jumpStarted) {
        this.state.jumpStarted = true;
        onRevealPlayer?.();
        player.forceMove('right', true);
      }

      const timedOut = elapsed >= this.state.duration;
      if (!player.isMoving || timedOut) {
        player.spriteYOffset = 0;
        this.reset();
        player.unlockInput();
      }
      return;
    }
  }

  reset(): void {
    this.state = {
      stage: 'idle',
      startTime: 0,
      duration: 0,
      tileX: 0,
      tileY: 0,
      behavior: 0,
      effectSpawned: false,
      jumpStarted: false,
    };
  }
}
