/** A fixed 45-degree lens overlays the wheel; the underlying slices never move. */
export const FOCUS_HALF_WIDTH = 22.5;
export const FOCUS_SCALE = 1.75;
export const FOCUS_RADIUS_SCALE = 1.12;
export function angleDistance(angle: number, focus: number): number {
  return ((angle - focus + 540) % 360) - 180;
}
/** Clip a circular slice to the source area seen through the lens, then enlarge
 * it locally. Multiple pieces handle slices crossing the 0/360-degree seam. */
export function lensSlices(start: number, end: number, focus: number): [number, number][] {
  const half = FOCUS_HALF_WIDTH / FOCUS_SCALE;
  const pieces: [number, number][] = [];
  for (const offset of [-360, 0, 360]) {
    const a = Math.max(start + offset, focus - half);
    const b = Math.min(end + offset, focus + half);
    if (b > a) pieces.push([focus + (a - focus) * FOCUS_SCALE, focus + (b - focus) * FOCUS_SCALE]);
  }
  return pieces;
}
