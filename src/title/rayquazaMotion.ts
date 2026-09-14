/** Back-facing vertical passes followed by the face-visible title spiral. */
export const RAYQUAZA_ENTRANCE_SECONDS = 12;
export const RAYQUAZA_CYCLE_SECONDS = 35;
const smooth = (v: number) => { const t = Math.max(0, Math.min(1, v)); return t * t * (3 - 2 * t); };

export function sampleRayquazaFlight(seconds: number) {
  const t = Math.max(0, seconds) % RAYQUAZA_CYCLE_SECONDS;
  let y = 0;
  let coil = 0;
  let roll = 0;
  const yaw = 0;
  let visible = true;
  let scale = 0.8;
  if (t < 3.5) {
    y = -7 + 14 * t / 3.5;
  } else if (t < 4.5) {
    visible = false;
    y = 7;
  } else if (t < 8) {
    roll = Math.PI;
    y = 7 - 14 * (t - 4.5) / 3.5;
  } else if (t < 9) {
    visible = false;
    y = -7;
  } else if (t < 12) {
    const settle = smooth((t - 9) / 3);
    coil = settle;
    y = -7 * (1 - settle);
    scale = 0.8 + 0.2 * settle;
  } else if (t < 32) {
    coil = 1;
    scale = 1;
  } else {
    const depart = smooth((t - 32) / 3);
    coil = 1 - depart;
    y = 7 * depart;
    scale = 1 - 0.2 * depart;
  }
  return { visible, coil, x: 0, y, scale, roll, yaw,
    glow: 0.5 - 0.5 * Math.cos(seconds * Math.PI * 2 / 4.3) };
}

/** Tangent angle of a wave traveling from the head (0) toward the tail (~180).
 * Longer delay and greater amplitude at the tail produce eel-like propulsion.
 */
export function sampleSwimAngle(distance: number, seconds: number): number {
  const amplitude = 0.16 + 0.48 * Math.min(1, distance / 180);
  return amplitude * Math.sin(2 * Math.PI * (seconds / 1.6 - distance / 115));
}
