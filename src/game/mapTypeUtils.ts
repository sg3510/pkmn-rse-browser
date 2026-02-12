/**
 * Shared map-type predicates used by overworld/script systems.
 *
 * C references:
 * - public/pokeemerald/src/overworld.c (IsMapTypeOutdoors, IsMapTypeIndoors)
 */

const OUTDOOR_MAP_TYPES = new Set([
  'MAP_TYPE_ROUTE',
  'MAP_TYPE_TOWN',
  'MAP_TYPE_UNDERWATER',
  'MAP_TYPE_CITY',
  'MAP_TYPE_OCEAN_ROUTE',
]);

export function isOutdoorsMapType(mapType: string | null | undefined): boolean {
  if (!mapType) return false;
  return OUTDOOR_MAP_TYPES.has(mapType);
}

export function isUnderwaterMapType(mapType: string | null | undefined): boolean {
  return mapType === 'MAP_TYPE_UNDERWATER';
}
