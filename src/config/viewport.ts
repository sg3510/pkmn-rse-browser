import { METATILE_SIZE } from '../utils/mapLoader';

export interface ViewportConfig {
  tilesWide: number;
  tilesHigh: number;
}

export const DEFAULT_VIEWPORT_CONFIG: ViewportConfig = {
  tilesWide: 20,
  tilesHigh: 20,
};

export function getViewportPixelSize(config: ViewportConfig = DEFAULT_VIEWPORT_CONFIG) {
  return {
    width: config.tilesWide * METATILE_SIZE,
    height: config.tilesHigh * METATILE_SIZE,
  };
}
