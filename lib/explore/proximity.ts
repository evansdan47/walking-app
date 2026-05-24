import type { PlannedRoute } from '@/components/explore/explore-map-layer';

// ── Haversine ──────────────────────────────────────────────────────────────────

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Returns the total walking distance of the route in metres by summing all
 * consecutive haversine distances across every leg.
 */
function totalRouteLengthM(route: PlannedRoute): number {
  let total = 0;
  for (const leg of route.legs) {
    for (let i = 1; i < leg.points.length; i++) {
      const a = leg.points[i - 1]!;
      const b = leg.points[i]!;
      total += haversineM(a.lat, a.lng, b.lat, b.lng);
    }
  }
  return total;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Returns true when the route loops back close to its start point (i.e. is
 * effectively circular).  The threshold is 15% of the total route length —
 * a 5 km route is considered circular if the end is within ~750 m of the start.
 */
export function isCircularRoute(route: PlannedRoute): boolean {
  const firstLeg = route.legs[0];
  const lastLeg = route.legs[route.legs.length - 1];
  if (!firstLeg || !lastLeg) return false;

  const start = firstLeg.points[0];
  const end = lastLeg.points[lastLeg.points.length - 1];
  if (!start || !end) return false;

  const endToStartM = haversineM(start.lat, start.lng, end.lat, end.lng);
  const totalM = totalRouteLengthM(route);
  if (totalM < 1) return false;

  return endToStartM / totalM < 0.15;
}

/**
 * Distance in metres from the user to the first point of the route
 * (legs[0].points[0]).  Returns Infinity when the route has no points.
 */
export function distanceToRouteStartM(
  userLat: number,
  userLng: number,
  route: PlannedRoute,
): number {
  const start = route.legs[0]?.points[0];
  if (!start) return Infinity;
  return haversineM(userLat, userLng, start.lat, start.lng);
}

/**
 * Minimum distance in metres from the user to any point on the route.
 * Used for circular routes where the walk can be started from any entry point.
 */
export function distanceToNearestRoutePointM(
  userLat: number,
  userLng: number,
  route: PlannedRoute,
): number {
  let minDist = Infinity;
  for (const leg of route.legs) {
    for (const pt of leg.points) {
      const d = haversineM(userLat, userLng, pt.lat, pt.lng);
      if (d < minDist) minDist = d;
    }
  }
  return minDist;
}

/**
 * Returns true when the user is within `thresholdM` metres of the appropriate
 * start point.  For circular routes the nearest point on the whole route is
 * used; for linear routes only the first point is checked.
 */
export function isWithinStartThreshold(
  userLat: number,
  userLng: number,
  route: PlannedRoute,
  thresholdM: number,
): boolean {
  const circular = isCircularRoute(route);
  const dist = circular
    ? distanceToNearestRoutePointM(userLat, userLng, route)
    : distanceToRouteStartM(userLat, userLng, route);
  return dist <= thresholdM;
}
