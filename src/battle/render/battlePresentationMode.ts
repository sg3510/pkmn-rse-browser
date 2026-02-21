import type { ViewportConfig } from '../../config/viewport';

export type BattlePresentationMode = 'dedicated' | 'overlay';

/** GBA native viewport dimensions in tiles (15x10 => 240x160). */
export const GBA_VIEWPORT_TILES_WIDE = 15;
export const GBA_VIEWPORT_TILES_HIGH = 10;
/** Overlay engages only when BOTH axes are strictly larger than GBA + 2 tiles. */
export const BATTLE_OVERLAY_PADDING_TILES = 2;
export const BATTLE_OVERLAY_MIN_TILES_WIDE = GBA_VIEWPORT_TILES_WIDE + BATTLE_OVERLAY_PADDING_TILES;
export const BATTLE_OVERLAY_MIN_TILES_HIGH = GBA_VIEWPORT_TILES_HIGH + BATTLE_OVERLAY_PADDING_TILES;

export function isBattleOverlayViewport(viewportConfig: ViewportConfig): boolean {
  return (
    viewportConfig.tilesWide > BATTLE_OVERLAY_MIN_TILES_WIDE
    && viewportConfig.tilesHigh > BATTLE_OVERLAY_MIN_TILES_HIGH
  );
}

export function getBattlePresentationMode(viewportConfig: ViewportConfig): BattlePresentationMode {
  return isBattleOverlayViewport(viewportConfig) ? 'overlay' : 'dedicated';
}
