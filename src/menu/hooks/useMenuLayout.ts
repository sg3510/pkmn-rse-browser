/**
 * useMenuLayout - Responsive menu sizing hook
 *
 * Calculates menu dimensions based on viewport size:
 * - GBA viewport (15×10 tiles = 240×160px): Fullscreen, no padding
 * - Larger viewports: Menu grows up to max size with padding
 *
 * Design constraints:
 * - Tile size: 16px
 * - GBA native: 240×160px (15×10 tiles)
 * - Max menu size: 336×256px (21×16 tiles)
 * - Target padding: ~2 tiles (32px) on each side when viewport allows
 */

/** Tile size in pixels */
const TILE_SIZE = 16;

/** GBA native viewport in tiles */
const GBA_TILES_WIDE = 15;
const GBA_TILES_HIGH = 10;

/** Maximum menu size in tiles (when viewport is large enough) */
const MAX_MENU_TILES_WIDE = 21;
const MAX_MENU_TILES_HIGH = 16;

/** Target padding in tiles (on each side) when viewport allows */
const TARGET_PADDING_TILES = 2;

export interface MenuLayoutConfig {
  /** Viewport dimensions in pixels (at 1x scale) */
  viewport: { width: number; height: number };
  /** Current zoom factor */
  zoom: number;
}

export interface MenuLayout {
  /** Menu width in pixels (at 1x scale, before zoom) */
  menuWidth: number;
  /** Menu height in pixels (at 1x scale, before zoom) */
  menuHeight: number;
  /** Whether menu fills entire viewport (GBA mode) */
  isFullscreen: boolean;
  /** Horizontal padding in pixels (at 1x scale) */
  paddingX: number;
  /** Vertical padding in pixels (at 1x scale) */
  paddingY: number;
  /** Menu width in tiles */
  menuTilesWide: number;
  /** Menu height in tiles */
  menuTilesHigh: number;
}

/**
 * Calculate responsive menu layout based on viewport size
 */
export function calculateMenuLayout(config: MenuLayoutConfig): MenuLayout {
  const { viewport } = config;

  // Convert viewport to tiles
  const viewportTilesWide = Math.floor(viewport.width / TILE_SIZE);
  const viewportTilesHigh = Math.floor(viewport.height / TILE_SIZE);

  // Check if we're at or below GBA size
  const isGBASize =
    viewportTilesWide <= GBA_TILES_WIDE && viewportTilesHigh <= GBA_TILES_HIGH;

  if (isGBASize) {
    // Fullscreen mode: menu fills entire viewport
    return {
      menuWidth: viewport.width,
      menuHeight: viewport.height,
      isFullscreen: true,
      paddingX: 0,
      paddingY: 0,
      menuTilesWide: viewportTilesWide,
      menuTilesHigh: viewportTilesHigh,
    };
  }

  // Calculate available space for menu (viewport minus target padding on both sides)
  const availableTilesWide = viewportTilesWide - TARGET_PADDING_TILES * 2;
  const availableTilesHigh = viewportTilesHigh - TARGET_PADDING_TILES * 2;

  // Menu size is min(available, max)
  const menuTilesWide = Math.min(
    Math.max(availableTilesWide, GBA_TILES_WIDE), // At least GBA size
    MAX_MENU_TILES_WIDE
  );
  const menuTilesHigh = Math.min(
    Math.max(availableTilesHigh, GBA_TILES_HIGH), // At least GBA size
    MAX_MENU_TILES_HIGH
  );

  // Convert to pixels
  const menuWidth = menuTilesWide * TILE_SIZE;
  const menuHeight = menuTilesHigh * TILE_SIZE;

  // Calculate actual padding (may differ from target if viewport is smaller)
  const paddingX = Math.max(0, (viewport.width - menuWidth) / 2);
  const paddingY = Math.max(0, (viewport.height - menuHeight) / 2);

  return {
    menuWidth,
    menuHeight,
    isFullscreen: false,
    paddingX,
    paddingY,
    menuTilesWide,
    menuTilesHigh,
  };
}

/**
 * React hook for menu layout calculations
 */
export function useMenuLayout(config: MenuLayoutConfig): MenuLayout {
  return calculateMenuLayout(config);
}

// Export constants for use in other components
export const MENU_LAYOUT_CONSTANTS = {
  TILE_SIZE,
  GBA_TILES_WIDE,
  GBA_TILES_HIGH,
  MAX_MENU_TILES_WIDE,
  MAX_MENU_TILES_HIGH,
  TARGET_PADDING_TILES,
  GBA_WIDTH: GBA_TILES_WIDE * TILE_SIZE,
  GBA_HEIGHT: GBA_TILES_HIGH * TILE_SIZE,
  MAX_MENU_WIDTH: MAX_MENU_TILES_WIDE * TILE_SIZE,
  MAX_MENU_HEIGHT: MAX_MENU_TILES_HIGH * TILE_SIZE,
};
