/**
 * Route thumbnail helpers — ported from the Expo SessionMemoryCard logic.
 * Normalises GPS coords into an SVG polyline `points` string.
 */

export function routeDifficultyColor(distanceMetres: number, elevationGainMetres = 0): string {
  const distKm = distanceMetres / 1000;
  const grade = elevationGainMetres / (distanceMetres || 1);
  if (grade > 0.06 || distKm > 15 || elevationGainMetres > 500) return '#c0392b';
  if (grade > 0.025 || distKm > 8 || elevationGainMetres > 150) return '#d97706';
  return '#16a34a';
}

export function buildRoutePolyline(
  coords: Array<[number, number]>,
  size: number,
  padding = 6,
): string {
  if (coords.length < 2) return '';
  const lons = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const dLon = maxLon - minLon || 0.0001;
  const dLat = maxLat - minLat || 0.0001;
  const drawSize = size - padding * 2;
  const scale = drawSize / Math.max(dLon, dLat);
  return coords
    .map((c) => {
      const x = padding + (c[0] - minLon) * scale;
      const y = padding + (maxLat - c[1]) * scale;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}
