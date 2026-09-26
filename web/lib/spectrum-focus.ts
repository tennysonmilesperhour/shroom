/** Circular fisheye: widen a small neighborhood, keeping its center and the
 * opposite point fixed. Potency radii are deliberately unaffected. */
export const FOCUS_HALF_WIDTH = 18;
export const FOCUS_SCALE = 2;
export function angleDistance(angle: number, focus: number): number {
  return ((angle - focus + 540) % 360) - 180;
}
export function magnifyAngle(angle: number, focus: number | null): number {
  if (focus == null) return angle;
  const delta = angleDistance(angle, focus);
  const distance = Math.abs(delta);
  const mapped = distance <= FOCUS_HALF_WIDTH
    ? distance * FOCUS_SCALE
    : FOCUS_HALF_WIDTH * FOCUS_SCALE + (distance - FOCUS_HALF_WIDTH) *
      (180 - FOCUS_HALF_WIDTH * FOCUS_SCALE) / (180 - FOCUS_HALF_WIDTH);
  return angle + Math.sign(delta) * (mapped - distance);
}
