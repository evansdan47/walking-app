/**
 * Region grid utilities for the Explore offline-first sync engine.
 *
 * The map is divided into 2°×2° cells. Each public planned route is assigned
 * to the cell containing its centroid. The sync engine fetches routes
 * region-by-region instead of making per-viewport Convex subscriptions.
 *
 * Cell key format: "{cellLat}:{cellLng}"
 * where cellLat = floor(lat / CELL_DEGREES) * CELL_DEGREES
 *       cellLng = floor(lng / CELL_DEGREES) * CELL_DEGREES
 * Example: a route at 51.5°N, -0.1°W → cell "50:-2"
 */

export const CELL_DEGREES = 2.0;

export interface ExploreViewBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/** Return the cell key for a single coordinate. */
export function coordToCell(lat: number, lng: number): string {
  const cellLat = Math.floor(lat / CELL_DEGREES) * CELL_DEGREES;
  const cellLng = Math.floor(lng / CELL_DEGREES) * CELL_DEGREES;
  return `${cellLat}:${cellLng}`;
}

/**
 * Compute the geographic centroid of a route's legs (simple arithmetic mean
 * of all point coordinates). Used to assign a route to a single cell.
 * Returns { lat: 0, lng: 0 } if the route has no points.
 */
export function computeCentroid(
  legs: Array<{ points: Array<{ lat: number; lng: number }> }>,
): { lat: number; lng: number } {
  let totalLat = 0;
  let totalLng = 0;
  let count = 0;
  for (const leg of legs) {
    for (const pt of leg.points) {
      totalLat += pt.lat;
      totalLng += pt.lng;
      count++;
    }
  }
  if (count === 0) return { lat: 0, lng: 0 };
  return { lat: totalLat / count, lng: totalLng / count };
}

/**
 * Return the set of cell keys that overlap the given viewport.
 * All cells that share any area with the bounding box are included.
 */
export function viewportToCells(bounds: ExploreViewBounds): string[] {
  const cells = new Set<string>();
  const startLat = Math.floor(bounds.minLat / CELL_DEGREES) * CELL_DEGREES;
  const startLng = Math.floor(bounds.minLng / CELL_DEGREES) * CELL_DEGREES;

  for (let lat = startLat; lat <= bounds.maxLat; lat += CELL_DEGREES) {
    for (let lng = startLng; lng <= bounds.maxLng; lng += CELL_DEGREES) {
      cells.add(coordToCell(lat, lng));
    }
  }

  return Array.from(cells);
}
