import type { CardinalDirection } from './metatileBehaviors';

export interface DirectionOffset {
  dx: number;
  dy: number;
}

const DIRECTION_TO_OFFSET: Record<CardinalDirection, DirectionOffset> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export function directionToOffset(direction: CardinalDirection): DirectionOffset {
  return DIRECTION_TO_OFFSET[direction];
}

export function offsetToDirection(dx: number, dy: number): CardinalDirection | null {
  if (dx === 0 && dy === -1) return 'up';
  if (dx === 0 && dy === 1) return 'down';
  if (dx === -1 && dy === 0) return 'left';
  if (dx === 1 && dy === 0) return 'right';
  return null;
}

export function oppositeDirection(direction: CardinalDirection): CardinalDirection {
  switch (direction) {
    case 'up':
      return 'down';
    case 'down':
      return 'up';
    case 'left':
      return 'right';
    case 'right':
      return 'left';
  }
}
