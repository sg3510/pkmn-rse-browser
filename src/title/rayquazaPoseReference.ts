/** Screen-space centerline traced from the supplied 256×256 GBA reference.
 * Shared by the comparison overlay and the skeletal pose; never fitted to the model.
 */
export type Point2 = readonly [number, number];
export type Cubic2 = readonly [Point2, Point2, Point2, Point2];
export const FACE_POINT: Point2 = [136, 128];
export const UPPER_COIL: readonly Cubic2[] = [
  [FACE_POINT, [140, 109], [142, 85], [119, 77]],
  [[119, 77], [99, 65], [78, 70], [61, 86]],
  [[61, 86], [38, 108], [41, 139], [53, 159]],
];
export const LOWER_COIL: readonly Cubic2[] = [
  [[53, 159], [80, 196], [135, 221], [190, 212]],
  [[190, 212], [230, 206], [249, 177], [240, 143]],
  [[240, 143], [237, 120], [225, 105], [204, 99]],
];
export const POSE_GUIDE_PATH = `M${FACE_POINT.join(' ')} ` + [...UPPER_COIL, ...LOWER_COIL]
  .map(([, a, b, end]) => `C${a.join(' ')} ${b.join(' ')} ${end.join(' ')}`).join(' ');

/** The tail's local forward runs away from the head, opposite the neck's.
 * Reverse its axial turn so adjacent skinning transforms agree at the hips.
 */
export function markingRollForJoint(name: string): number {
  if (name === 'Head') return 0;
  return (name === 'Hips' || name.startsWith('Tail') ? -1 : 1) * Math.PI / 2;
}
