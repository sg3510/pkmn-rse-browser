import type { CameraController } from '../CameraController';

export type OrbEffectColor = 'red' | 'blue';

type OrbEffectPhase = 'idle' | 'expanding' | 'shaking' | 'fading';

export interface OrbEffectRenderState {
  active: boolean;
  phase: Exclude<OrbEffectPhase, 'idle'>;
  color: OrbEffectColor;
  centerX: number;
  centerY: number;
  radius: number;
  fadeAlpha: number;
}

const ORB_CENTER_Y = 80;
const ORB_MAX_RADIUS = 160;
const ORB_RADIUS_STEP = 2;
const ORB_SHAKE_DELAY = 4;
const ORB_FADE_DELAY = 8;
const ORB_SHAKE_PAN = 4;

function resolveOrbVariant(resultVar: number): { color: OrbEffectColor; centerX: number } {
  if (resultVar === 0) return { color: 'red', centerX: 104 };
  if (resultVar === 1) return { color: 'blue', centerX: 136 };
  if (resultVar === 2) return { color: 'red', centerX: 120 };
  return { color: 'blue', centerX: 120 };
}

export class OrbEffectRuntime {
  private phase: OrbEffectPhase = 'idle';
  private color: OrbEffectColor = 'blue';
  private centerX = 120;
  private centerY = ORB_CENTER_Y;
  private radius = 0;
  private shakeDelay = ORB_SHAKE_DELAY;
  private shakeDir = 0;
  private blendLo = 12;
  private blendHi = 7;
  private panY = 0;

  private expansionWaiters = new Set<() => void>();
  private fadeWaiters = new Set<() => void>();

  start(resultVar: number): Promise<void> {
    this.resolveExpansionWaiters();
    this.resolveFadeWaiters();

    const variant = resolveOrbVariant(resultVar);
    this.phase = 'expanding';
    this.color = variant.color;
    this.centerX = variant.centerX;
    this.centerY = ORB_CENTER_Y;
    this.radius = 1;
    this.shakeDelay = ORB_SHAKE_DELAY;
    this.shakeDir = 0;
    this.blendLo = 12;
    this.blendHi = 7;
    this.panY = 0;

    return new Promise<void>((resolve) => {
      this.expansionWaiters.add(resolve);
    });
  }

  fadeOut(): Promise<void> {
    if (this.phase === 'idle') {
      return Promise.resolve();
    }

    if (this.phase !== 'fading') {
      this.phase = 'fading';
      this.shakeDelay = ORB_FADE_DELAY;
      this.panY = 0;
    }

    return new Promise<void>((resolve) => {
      this.fadeWaiters.add(resolve);
    });
  }

  update(frames: number, camera: CameraController | null): void {
    if (frames <= 0 || this.phase === 'idle') {
      return;
    }

    for (let i = 0; i < frames; i++) {
      if (this.phase === 'expanding') {
        this.radius += ORB_RADIUS_STEP;
        if (this.radius > ORB_MAX_RADIUS) {
          this.radius = ORB_MAX_RADIUS;
          this.phase = 'shaking';
          this.shakeDelay = ORB_SHAKE_DELAY;
          this.resolveExpansionWaiters();
        }
        continue;
      }

      if (this.phase === 'shaking') {
        this.shakeDelay--;
        if (this.shakeDelay <= 0) {
          this.shakeDelay = ORB_SHAKE_DELAY;
          this.shakeDir ^= 1;
          this.panY = this.shakeDir ? ORB_SHAKE_PAN : -ORB_SHAKE_PAN;
          camera?.setPanning(0, this.panY);
        }
        continue;
      }

      if (this.phase === 'fading') {
        this.shakeDelay--;
        if (this.shakeDelay <= 0) {
          this.shakeDelay = ORB_FADE_DELAY;
          this.shakeDir ^= 1;
          if (this.shakeDir !== 0) {
            if (this.blendLo > 0) this.blendLo--;
          } else {
            if (this.blendHi < 16) this.blendHi++;
          }
          if (this.blendLo === 0 && this.blendHi === 16) {
            this.phase = 'idle';
            this.panY = 0;
            camera?.resetPanning();
            this.resolveFadeWaiters();
            break;
          }
        }
      }
    }

    if (this.phase !== 'shaking') {
      camera?.setPanning(0, 0);
    }
  }

  clear(camera: CameraController | null = null): void {
    this.phase = 'idle';
    this.panY = 0;
    camera?.resetPanning();
    this.resolveExpansionWaiters();
    this.resolveFadeWaiters();
  }

  getRenderState(): OrbEffectRenderState | null {
    if (this.phase === 'idle') return null;
    return {
      active: true,
      phase: this.phase,
      color: this.color,
      centerX: this.centerX,
      centerY: this.centerY,
      radius: this.radius,
      fadeAlpha: this.blendHi / 16,
    };
  }

  private resolveExpansionWaiters(): void {
    if (this.expansionWaiters.size === 0) return;
    for (const resolve of this.expansionWaiters) {
      resolve();
    }
    this.expansionWaiters.clear();
  }

  private resolveFadeWaiters(): void {
    if (this.fadeWaiters.size === 0) return;
    for (const resolve of this.fadeWaiters) {
      resolve();
    }
    this.fadeWaiters.clear();
  }
}
