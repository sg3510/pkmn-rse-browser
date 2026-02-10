/**
 * Shared timing constants.
 *
 * Use `GBA_FRAME_MS` for systems that should match the handheld vblank cadence
 * and `TICK_60FPS_MS` for systems that intentionally use 60fps tick math.
 */
export const GBA_FPS = 59.7275;
export const GBA_FRAME_MS = 1000 / GBA_FPS;

export const FPS_60 = 60;
export const TICK_60FPS_MS = 1000 / FPS_60;

export function ticksToMs(ticks: number, tickMs: number = TICK_60FPS_MS): number {
  return ticks * tickMs;
}

export function msToTicks(milliseconds: number, tickMs: number = TICK_60FPS_MS): number {
  return milliseconds / tickMs;
}
