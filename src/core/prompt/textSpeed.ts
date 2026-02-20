import type { GameOptions } from '../../save/types';

export const BATTLE_TEXT_SPEED_DELAY_FRAMES: Record<'slow' | 'mid' | 'fast', number> = {
  slow: 8,
  mid: 4,
  fast: 1,
};

export type DialogTextSpeed = 'slow' | 'medium' | 'fast' | 'instant';

export function mapSaveTextSpeedToDialog(textSpeed: GameOptions['textSpeed'] | undefined): Exclude<DialogTextSpeed, 'instant'> {
  switch (textSpeed) {
    case 'slow':
      return 'slow';
    case 'fast':
      return 'fast';
    case 'mid':
    default:
      return 'medium';
  }
}

export function getBattlePromptDelayMs(
  textSpeed: GameOptions['textSpeed'] | undefined,
  frameMs: number,
): number {
  const speed = textSpeed ?? 'mid';
  const frames = BATTLE_TEXT_SPEED_DELAY_FRAMES[speed] ?? BATTLE_TEXT_SPEED_DELAY_FRAMES.mid;
  return frames * frameMs;
}
