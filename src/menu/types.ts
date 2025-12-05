/**
 * Menu System Types
 */

export interface MenuItem {
  id: string;
  label: string | (() => string);
  icon?: string;
  visible: boolean | (() => boolean);
  enabled: boolean | (() => boolean);
  onSelect: () => void | Promise<void>;
  onHover?: () => void;
}

export interface MenuTile {
  id: string;
  label: string | (() => string);
  icon: string;
  visible: boolean | (() => boolean);
  enabled: boolean | (() => boolean);
  onSelect: () => void;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface GridPosition {
  row: number;
  col: number;
}

/**
 * Convert grid position to linear index
 */
export function gridToIndex(pos: GridPosition, cols: number): number {
  return pos.row * cols + pos.col;
}

/**
 * Convert linear index to grid position
 */
export function indexToGrid(index: number, cols: number): GridPosition {
  return {
    row: Math.floor(index / cols),
    col: index % cols,
  };
}

/**
 * Navigate in a grid with wrapping
 */
export function navigateGrid(
  currentIndex: number,
  direction: Direction,
  cols: number,
  totalItems: number,
  wrap: boolean = true
): number {
  const pos = indexToGrid(currentIndex, cols);
  const rows = Math.ceil(totalItems / cols);

  switch (direction) {
    case 'up':
      if (pos.row > 0) {
        pos.row--;
      } else if (wrap) {
        pos.row = rows - 1;
      }
      break;
    case 'down':
      if (pos.row < rows - 1) {
        pos.row++;
      } else if (wrap) {
        pos.row = 0;
      }
      break;
    case 'left':
      if (pos.col > 0) {
        pos.col--;
      } else if (wrap) {
        pos.col = cols - 1;
      }
      break;
    case 'right':
      if (pos.col < cols - 1) {
        pos.col++;
      } else if (wrap) {
        pos.col = 0;
      }
      break;
  }

  const newIndex = gridToIndex(pos, cols);
  // Make sure we don't go past the last item
  return Math.min(newIndex, totalItems - 1);
}
