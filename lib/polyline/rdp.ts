/** [latitude, longitude] coordinate pair. */
export type LatLng = [number, number];

/**
 * Perpendicular distance from `point` to the line defined by `start`→`end`,
 * calculated in the lat/lng plane (treats coordinates as a flat 2-D space).
 * Acceptable for track segments up to ~50 km.
 */
function perpendicularDistance(point: LatLng, start: LatLng, end: LatLng): number {
  const [px, py] = point;
  const [x1, y1] = start;
  const [x2, y2] = end;
  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) {
    return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  }

  const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  return Math.sqrt((px - x1 - t * dx) ** 2 + (py - y1 - t * dy) ** 2);
}

/**
 * Ramer-Douglas-Peucker polyline simplification.
 *
 * @param points  Array of [latitude, longitude] pairs.
 * @param epsilon Tolerance in degrees. `0.00005` ≈ 5 m at the equator —
 *                a good default for a display polyline targeting ~100–300 pts.
 * @returns       Decimated subset preserving shape within the given tolerance.
 */
export function rdpSimplify(points: LatLng[], epsilon: number): LatLng[] {
  if (points.length <= 2) return points.slice();

  let maxDist = 0;
  let maxIdx = 0;

  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], first, last);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = rdpSimplify(points.slice(0, maxIdx + 1), epsilon);
    const right = rdpSimplify(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}
