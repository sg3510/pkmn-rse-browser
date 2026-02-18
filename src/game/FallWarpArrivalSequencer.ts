import type { CameraController } from './CameraController';
import type { PlayerController } from './PlayerController';
import type { FieldEffectManager } from './FieldEffectManager';
import type { FadeController } from '../field/FadeController';

type FallWarpStage =
  | 'idle'
  | 'waitFadeIn'
  | 'startFall'
  | 'fall'
  | 'cameraShake';

export interface FallWarpArrivalCallbacks {
  onStartFall?: () => void;
  onLand?: () => void;
  onComplete?: () => void;
}

interface FallWarpState {
  stage: FallWarpStage;
  fallOffset: number;
  totalFall: number;
  setTrigger: boolean;
  vertShake: number;
  numShakes: number;
  lastUpdateTime: number | null;
  callbacks: FallWarpArrivalCallbacks;
}

/**
 * C reference: public/pokeemerald/src/field_effect.c
 * - FieldCB_FallWarpExit
 * - Task_FallWarpFieldEffect and FallWarpEffect_* stages
 */
export class FallWarpArrivalSequencer {
  private state: FallWarpState = this.createIdleState();

  start(callbacks: FallWarpArrivalCallbacks = {}): void {
    this.state = {
      stage: 'waitFadeIn',
      fallOffset: 1,
      totalFall: 0,
      setTrigger: false,
      vertShake: 4,
      numShakes: 0,
      lastUpdateTime: null,
      callbacks,
    };
  }

  isActive(): boolean {
    return this.state.stage !== 'idle';
  }

  reset(player?: PlayerController, camera?: CameraController): void {
    if (player) {
      player.spriteYOffset = 0;
    }
    camera?.resetPanning();
    this.state = this.createIdleState();
  }

  update(params: {
    nowTime: number;
    player: PlayerController;
    camera: CameraController;
    fieldEffects: FieldEffectManager;
    fadeController: FadeController;
  }): void {
    const { nowTime, player, camera, fieldEffects, fadeController } = params;

    if (this.state.stage !== 'idle') {
      this.tickFieldEffects(nowTime, player, fieldEffects);
    }

    switch (this.state.stage) {
      case 'idle':
        return;
      case 'waitFadeIn': {
        if (fadeController.getDirection() === 'in' && fadeController.isComplete(nowTime)) {
          this.state.stage = 'startFall';
        }
        return;
      }
      case 'startFall': {
        const cameraPos = camera.getPosition();
        const frame = player.getFrameInfo();
        const frameTopY = frame ? frame.renderY : player.y;
        const frameHeight = frame?.sh ?? 32;
        const screenTopY = frameTopY - cameraPos.y;

        // Start above the viewport like Task_FallWarpFieldEffect's y2 initialization.
        player.spriteYOffset = -(screenTopY + frameHeight);
        this.state.fallOffset = 1;
        this.state.totalFall = 0;
        this.state.setTrigger = false;
        this.state.callbacks.onStartFall?.();
        this.state.stage = 'fall';
        return;
      }
      case 'fall': {
        player.spriteYOffset += this.state.fallOffset;
        if (this.state.fallOffset < 8) {
          this.state.totalFall += this.state.fallOffset;
          if ((this.state.totalFall & 0xf) !== 0) {
            this.state.fallOffset <<= 1;
          }
        }

        if (!this.state.setTrigger && player.spriteYOffset >= -16) {
          this.state.setTrigger = true;
        }

        if (player.spriteYOffset >= 0) {
          player.spriteYOffset = 0;
          fieldEffects.create(player.tileX, player.tileY, 'GROUND_IMPACT_DUST', false, 'player');
          this.state.callbacks.onLand?.();
          this.state.vertShake = 4;
          this.state.numShakes = 0;
          camera.setPanning(0, 0);
          this.state.stage = 'cameraShake';
        }
        return;
      }
      case 'cameraShake': {
        camera.setPanning(0, this.state.vertShake);
        this.state.vertShake = -this.state.vertShake;
        this.state.numShakes++;

        if ((this.state.numShakes & 3) === 0) {
          // C parity: signed integer halving (>>= 1) so shake converges to 0.
          this.state.vertShake >>= 1;
        }

        if (this.state.vertShake === 0) {
          camera.resetPanning();
          player.spriteYOffset = 0;
          this.state.callbacks.onComplete?.();
          this.state = this.createIdleState();
        }
      }
    }
  }

  private createIdleState(): FallWarpState {
    return {
      stage: 'idle',
      fallOffset: 1,
      totalFall: 0,
      setTrigger: false,
      vertShake: 4,
      numShakes: 0,
      lastUpdateTime: null,
      callbacks: {},
    };
  }

  private tickFieldEffects(
    nowTime: number,
    player: PlayerController,
    fieldEffects: FieldEffectManager
  ): void {
    const manager = fieldEffects as unknown as {
      update?: (deltaMs: number) => void;
      cleanup?: (ownerPositions: Map<string, unknown>) => void;
    };

    const previousTime = this.state.lastUpdateTime;
    this.state.lastUpdateTime = nowTime;

    if (typeof manager.update === 'function' && previousTime !== null) {
      const deltaMs = Math.max(0, Math.min(100, nowTime - previousTime));
      if (deltaMs > 0) {
        manager.update(deltaMs);
      }
    }

    if (typeof manager.cleanup === 'function') {
      const destination = player.getDestinationTile?.() ?? { x: player.tileX, y: player.tileY };
      const previous = player.getPreviousTilePosition?.() ?? { x: player.tileX, y: player.tileY };
      const ownerPositions = new Map<string, unknown>();
      ownerPositions.set('player', {
        tileX: player.tileX,
        tileY: player.tileY,
        destTileX: destination.x,
        destTileY: destination.y,
        prevTileX: previous.x,
        prevTileY: previous.y,
        direction: player.dir,
        isMoving: false,
        isJumping: false,
      });
      manager.cleanup(ownerPositions);
    }
  }
}
