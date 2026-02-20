/**
 * Flash/darkness runtime state controller.
 *
 * C references:
 * - public/pokeemerald/src/overworld.c (SetDefaultFlashLevel / SetFlashLevel)
 * - public/pokeemerald/src/field_screen_effect.c (sFlashLevelToRadius / AnimateFlash)
 */

export const FLASH_LEVEL_TO_RADIUS = [200, 72, 64, 56, 48, 40, 32, 24, 0] as const;
export const MAX_FLASH_LEVEL = FLASH_LEVEL_TO_RADIUS.length - 1;

export interface FlashDefaultInput {
  mapRequiresFlash: boolean;
  hasFlashFlag: boolean;
}

export function clampFlashLevel(level: number): number {
  if (!Number.isFinite(level)) return 0;
  return Math.max(0, Math.min(MAX_FLASH_LEVEL, Math.trunc(level)));
}

export function getFlashRadiusForLevel(level: number): number {
  return FLASH_LEVEL_TO_RADIUS[clampFlashLevel(level)];
}

export class FlashController {
  private readonly delayFrames: (frames: number) => Promise<void>;
  private flashLevel = 0;
  private renderRadius = getFlashRadiusForLevel(0);
  private animationNonce = 0;
  private readonly animateStepFrames: number;

  constructor(delayFrames: (frames: number) => Promise<void>, animateStepFrames = 1) {
    this.delayFrames = delayFrames;
    this.animateStepFrames = Math.max(1, Math.trunc(animateStepFrames));
  }

  getFlashLevel(): number {
    return this.flashLevel;
  }

  getRenderRadius(): number {
    return this.renderRadius;
  }

  setFlashLevel(level: number): number {
    const clamped = clampFlashLevel(level);
    this.animationNonce++;
    this.flashLevel = clamped;
    this.renderRadius = getFlashRadiusForLevel(clamped);
    return clamped;
  }

  setDefaultFlashLevel(input: FlashDefaultInput): number {
    const nextLevel = !input.mapRequiresFlash
      ? 0
      : input.hasFlashFlag
        ? 1
        : 7;
    return this.setFlashLevel(nextLevel);
  }

  async animateFlashLevel(level: number, delayFrames = this.animateStepFrames): Promise<void> {
    const targetRadius = getFlashRadiusForLevel(level);
    const stepDelayFrames = Math.max(1, Math.trunc(delayFrames));
    const runNonce = ++this.animationNonce;

    while (this.renderRadius !== targetRadius) {
      this.renderRadius += this.renderRadius < targetRadius ? 1 : -1;
      await this.delayFrames(stepDelayFrames);
      if (this.animationNonce !== runNonce) {
        return;
      }
    }
  }
}
