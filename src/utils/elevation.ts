/**
 * Check if two elevations are compatible for movement/collision.
 *
 * Reference: public/pokeemerald/src/event_object_movement.c AreElevationsCompatible
 */
export function areElevationsCompatible(elevation1: number, elevation2: number): boolean {
  // Ground level (0) and universal level (15) can interact with all elevations.
  if (elevation1 === 0 || elevation1 === 15) return true;
  if (elevation2 === 0 || elevation2 === 15) return true;

  return elevation1 === elevation2;
}
