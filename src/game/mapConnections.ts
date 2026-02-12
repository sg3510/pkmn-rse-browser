/**
 * Shared map connection helpers.
 *
 * C references:
 * - public/pokeemerald/src/overworld.c
 * - public/pokeemerald/src/fieldmap.c
 */

import type { MapConnection } from '../types/maps';

export type SpatialConnectionDirection = 'up' | 'down' | 'left' | 'right';

const SPATIAL_CONNECTION_ALIASES: Readonly<Record<string, SpatialConnectionDirection>> = {
  up: 'up',
  north: 'up',
  down: 'down',
  south: 'down',
  left: 'left',
  west: 'left',
  right: 'right',
  east: 'right',
};

const NON_SPATIAL_CONNECTION_DIRECTIONS = new Set(['dive', 'emerge']);

export function normalizeSpatialConnectionDirection(
  direction: string
): SpatialConnectionDirection | null {
  const normalized = SPATIAL_CONNECTION_ALIASES[direction.toLowerCase()];
  return normalized ?? null;
}

export function isSpatialConnectionDirection(direction: string): boolean {
  return normalizeSpatialConnectionDirection(direction) !== null;
}

export function isNonSpatialConnectionDirection(direction: string): boolean {
  return NON_SPATIAL_CONNECTION_DIRECTIONS.has(direction.toLowerCase());
}

export function findConnectionByDirection(
  connections: MapConnection[] | undefined,
  direction: 'dive' | 'emerge'
): MapConnection | null {
  if (!connections || connections.length === 0) return null;
  const target = direction.toLowerCase();
  for (const connection of connections) {
    if (connection.direction.toLowerCase() === target) {
      return connection;
    }
  }
  return null;
}

export function computeSpatialConnectionOffset(
  base: { width: number; height: number },
  neighbor: { width: number; height: number },
  connection: { direction: string; offset: number },
  baseOffsetX: number,
  baseOffsetY: number
): { offsetX: number; offsetY: number } | null {
  const direction = normalizeSpatialConnectionDirection(connection.direction);
  if (!direction) return null;

  if (direction === 'up') {
    return {
      offsetX: baseOffsetX + connection.offset,
      offsetY: baseOffsetY - neighbor.height,
    };
  }

  if (direction === 'down') {
    return {
      offsetX: baseOffsetX + connection.offset,
      offsetY: baseOffsetY + base.height,
    };
  }

  if (direction === 'left') {
    return {
      offsetX: baseOffsetX - neighbor.width,
      offsetY: baseOffsetY + connection.offset,
    };
  }

  return {
    offsetX: baseOffsetX + base.width,
    offsetY: baseOffsetY + connection.offset,
  };
}
