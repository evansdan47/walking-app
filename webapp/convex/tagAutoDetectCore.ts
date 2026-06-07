/**
 * Pure route/walk tag suggestion engine (Phase 2).
 * @see docs/TaggingSystemRoadmap.md
 */

export type RoutePoint = { lng: number; lat: number };

export type RouteLeg = { points: RoutePoint[] };

export type RouteStats = {
  distanceKm: number;
  elevationGainM: number;
};

export type PoiType =
  | 'landmark'
  | 'viewpoint'
  | 'food_drink'
  | 'parking'
  | 'toilet'
  | 'facility'
  | 'hazard'
  | 'wildlife'
  | 'nature_reserve'
  | 'navigation'
  | 'accommodation';

export type RawTagSuggestion = {
  slug: string;
  confidence: number;
  reason: string;
  rule: string;
};

const EARTH_RADIUS_KM = 6371;

const ROUTE_STYLE_SLUGS = [
  'route_style.circular',
  'route_style.out_and_back',
  'route_style.point_to_point',
  'route_style.linear',
] as const;

const TERRAIN_SLUGS = [
  'terrain.flat',
  'terrain.gentle_rolling',
  'terrain.hilly',
  'terrain.steep',
  'terrain.mountainous',
] as const;

const DIFFICULTY_SLUGS = [
  'difficulty.easy',
  'difficulty.moderate',
  'difficulty.hard',
  'difficulty.challenging',
  'difficulty.expert',
] as const;

export const MIN_SUGGESTION_CONFIDENCE = 0.35;

export function haversineKm(a: RoutePoint, b: RoutePoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function totalRouteKm(legs: RouteLeg[]): number {
  let distanceKm = 0;
  for (const leg of legs) {
    for (let i = 1; i < leg.points.length; i++) {
      distanceKm += haversineKm(leg.points[i - 1]!, leg.points[i]!);
    }
  }
  return distanceKm;
}

function flattenPoints(legs: RouteLeg[]): RoutePoint[] {
  const points: RoutePoint[] = [];
  for (const leg of legs) {
    for (const point of leg.points) points.push(point);
  }
  return points;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function addSuggestion(
  out: RawTagSuggestion[],
  slug: string,
  confidence: number,
  reason: string,
  rule: string,
) {
  const existing = out.find((s) => s.slug === slug);
  if (existing) {
    if (confidence > existing.confidence) {
      existing.confidence = clamp01(confidence);
      existing.reason = reason;
      existing.rule = rule;
    }
    return;
  }
  out.push({ slug, confidence: clamp01(confidence), reason, rule });
}

function keepBestInGroup(
  suggestions: RawTagSuggestion[],
  slugs: readonly string[],
): RawTagSuggestion[] {
  const group = suggestions.filter((s) => slugs.includes(s.slug));
  if (group.length <= 1) return suggestions;
  const best = group.sort((a, b) => b.confidence - a.confidence)[0]!;
  return suggestions.filter((s) => !slugs.includes(s.slug) || s.slug === best.slug);
}

function detectRouteStyle(
  legs: RouteLeg[],
  totalKm: number,
  out: RawTagSuggestion[],
) {
  const points = flattenPoints(legs);
  if (points.length < 2 || totalKm < 0.2) return;

  const start = points[0]!;
  const end = points[points.length - 1]!;
  const straightKm = haversineKm(start, end);
  const closeThresholdKm = Math.min(0.15, totalKm * 0.05);

  if (straightKm <= closeThresholdKm) {
    const ratio = totalKm / Math.max(straightKm, 0.01);
    if (ratio >= 1.6) {
      addSuggestion(
        out,
        'route_style.circular',
        clamp01(0.55 + (ratio - 1.6) * 0.15),
        `Start and end are ${Math.round(straightKm * 1000)} m apart over ${totalKm.toFixed(1)} km`,
        'geometry.circular',
      );
    } else {
      addSuggestion(
        out,
        'route_style.out_and_back',
        clamp01(0.6 + (1.6 - ratio) * 0.2),
        `Returns near the start (${Math.round(straightKm * 1000)} m separation)`,
        'geometry.out_and_back',
      );
    }
    return;
  }

  if (straightKm >= 1 || straightKm >= totalKm * 0.35) {
    addSuggestion(
      out,
      'route_style.point_to_point',
      clamp01(0.5 + Math.min(straightKm / totalKm, 1) * 0.4),
      `Start and end are ${straightKm.toFixed(1)} km apart (${Math.round((straightKm / totalKm) * 100)}% of route length)`,
      'geometry.point_to_point',
    );
    return;
  }

  if (legs.length === 1) {
    addSuggestion(
      out,
      'route_style.linear',
      0.45,
      'Single leg with distinct start and end',
      'geometry.linear',
    );
  }
}

function detectTerrain(stats: RouteStats, out: RawTagSuggestion[]) {
  const { distanceKm, elevationGainM } = stats;
  if (distanceKm <= 0) return;

  const avgGrade = elevationGainM / (distanceKm * 1000);

  if (avgGrade < 0.025 && elevationGainM < 80) {
    addSuggestion(
      out,
      'terrain.flat',
      clamp01(0.85 - avgGrade * 10),
      `Gentle profile (${elevationGainM} m gain over ${distanceKm.toFixed(1)} km)`,
      'stats.grade_flat',
    );
  } else if (avgGrade < 0.05) {
    addSuggestion(
      out,
      'terrain.gentle_rolling',
      0.65,
      `Moderate undulation (${(avgGrade * 100).toFixed(1)}% average grade)`,
      'stats.grade_gentle',
    );
  } else if (avgGrade < 0.1) {
    addSuggestion(
      out,
      'terrain.hilly',
      clamp01(0.55 + (avgGrade - 0.05) * 4),
      `Hilly (${elevationGainM} m gain, ${(avgGrade * 100).toFixed(1)}% avg grade)`,
      'stats.grade_hilly',
    );
  } else if (avgGrade < 0.16) {
    addSuggestion(
      out,
      'terrain.steep',
      clamp01(0.6 + (avgGrade - 0.1) * 3),
      `Steep sections (${(avgGrade * 100).toFixed(1)}% average grade)`,
      'stats.grade_steep',
    );
  } else {
    addSuggestion(
      out,
      'terrain.mountainous',
      clamp01(0.65 + (avgGrade - 0.16) * 2),
      `Mountainous (${elevationGainM} m gain over ${distanceKm.toFixed(1)} km)`,
      'stats.grade_mountainous',
    );
  }

  if (elevationGainM >= 600) {
    addSuggestion(
      out,
      'terrain.mountainous',
      0.8,
      `${elevationGainM} m total ascent`,
      'stats.elevation_gain_high',
    );
  }

  if (avgGrade > 0.22 || (elevationGainM > 400 && avgGrade > 0.15)) {
    addSuggestion(
      out,
      'terrain.scrambling',
      0.5,
      `Very steep average grade (${(avgGrade * 100).toFixed(0)}%)`,
      'stats.scrambling_hint',
    );
    addSuggestion(
      out,
      'hazards.scrambling_required',
      0.45,
      'Very steep terrain may require scrambling',
      'stats.scrambling_hint',
    );
  }
}

function detectDifficulty(stats: RouteStats, out: RawTagSuggestion[]) {
  const itraScore = stats.distanceKm + stats.elevationGainM / 100;

  if (itraScore < 15) {
    addSuggestion(
      out,
      'difficulty.easy',
      clamp01(0.9 - itraScore / 20),
      `ITRA effort ~${itraScore.toFixed(0)} (easy)`,
      'stats.grade_easy',
    );
  } else if (itraScore < 30) {
    addSuggestion(
      out,
      'difficulty.moderate',
      clamp01(0.75 - Math.abs(itraScore - 22) / 30),
      `ITRA effort ~${itraScore.toFixed(0)} (moderate)`,
      'stats.grade_moderate',
    );
  } else if (itraScore < 50) {
    addSuggestion(
      out,
      'difficulty.hard',
      0.7,
      `ITRA effort ~${itraScore.toFixed(0)} (hard)`,
      'stats.grade_hard',
    );
  } else if (itraScore < 80) {
    addSuggestion(
      out,
      'difficulty.challenging',
      0.75,
      `ITRA effort ~${itraScore.toFixed(0)} (challenging)`,
      'stats.grade_challenging',
    );
  } else {
    addSuggestion(
      out,
      'difficulty.expert',
      0.8,
      `ITRA effort ~${itraScore.toFixed(0)} (expert)`,
      'stats.grade_expert',
    );
  }
}

const POI_TYPE_TO_TAGS: Record<
  PoiType,
  { slug: string; confidence: number; reason: string }[]
> = {
  parking: [{ slug: 'facilities.parking', confidence: 0.9, reason: 'Parking POI on route' }],
  toilet: [{ slug: 'facilities.toilets', confidence: 0.9, reason: 'Toilet POI on route' }],
  food_drink: [
    { slug: 'facilities.cafe', confidence: 0.75, reason: 'Food & drink stop on route' },
    { slug: 'facilities.pub', confidence: 0.5, reason: 'Food & drink stop on route' },
  ],
  facility: [
    {
      slug: 'facilities.visitor_centre',
      confidence: 0.8,
      reason: 'Visitor facility on route',
    },
  ],
  viewpoint: [
    { slug: 'features.great_views', confidence: 0.55, reason: 'Viewpoint marked on route' },
  ],
  nature_reserve: [
    {
      slug: 'features.nature_reserve',
      confidence: 0.85,
      reason: 'Nature reserve on route',
    },
  ],
  wildlife: [{ slug: 'features.wildlife', confidence: 0.5, reason: 'Wildlife POI on route' }],
  landmark: [
    { slug: 'features.historic_site', confidence: 0.55, reason: 'Landmark on route' },
  ],
  hazard: [{ slug: 'hazards.steep_drops', confidence: 0.4, reason: 'Hazard marked on route' }],
  navigation: [],
  accommodation: [],
};

function detectPois(poiTypes: PoiType[], out: RawTagSuggestion[]) {
  const seen = new Set<string>();
  for (const type of poiTypes) {
    for (const mapping of POI_TYPE_TO_TAGS[type] ?? []) {
      const key = `${type}:${mapping.slug}`;
      if (seen.has(key)) continue;
      seen.add(key);
      addSuggestion(out, mapping.slug, mapping.confidence, mapping.reason, `poi.${type}`);
    }
  }
}

function finalizeSuggestions(
  suggestions: RawTagSuggestion[],
  minConfidence: number,
): RawTagSuggestion[] {
  let filtered = keepBestInGroup(suggestions, ROUTE_STYLE_SLUGS);
  filtered = keepBestInGroup(filtered, TERRAIN_SLUGS);
  filtered = keepBestInGroup(filtered, DIFFICULTY_SLUGS);
  return filtered
    .filter((s) => s.confidence >= minConfidence)
    .sort((a, b) => b.confidence - a.confidence);
}

/** Suggest tags from planner route geometry, stats, and linked POI types. */
export function detectRouteTagSuggestions(args: {
  legs: RouteLeg[];
  stats?: RouteStats;
  poiTypes?: PoiType[];
  minConfidence?: number;
}): RawTagSuggestion[] {
  const legs = args.legs.filter((leg) => leg.points.length >= 2);
  if (legs.length === 0) return [];

  const computedKm = totalRouteKm(legs);
  const stats: RouteStats = {
    distanceKm: args.stats?.distanceKm && args.stats.distanceKm > 0
      ? args.stats.distanceKm
      : computedKm,
    elevationGainM: args.stats?.elevationGainM ?? 0,
  };

  const out: RawTagSuggestion[] = [];
  detectRouteStyle(legs, stats.distanceKm, out);

  if (stats.distanceKm > 0) {
    detectTerrain(stats, out);
    detectDifficulty(stats, out);
  }

  if (args.poiTypes?.length) {
    detectPois(args.poiTypes, out);
  }

  return finalizeSuggestions(out, args.minConfidence ?? MIN_SUGGESTION_CONFIDENCE);
}

/** Suggest tags after a walk — stats-first, optional track geometry and route context. */
export function detectWalkTagSuggestions(args: {
  stats: RouteStats;
  legs?: RouteLeg[];
  poiTypes?: PoiType[];
  inheritedRouteSuggestions?: RawTagSuggestion[];
  minConfidence?: number;
}): RawTagSuggestion[] {
  const out: RawTagSuggestion[] = [];

  if (args.stats.distanceKm > 0) {
    detectTerrain(args.stats, out);
    detectDifficulty(args.stats, out);
  }

  if (args.legs?.length) {
    const trackKm = totalRouteKm(args.legs);
    detectRouteStyle(args.legs, trackKm, out);
  }

  if (args.poiTypes?.length) {
    detectPois(args.poiTypes, out);
  }

  if (args.inheritedRouteSuggestions?.length) {
    const inheritCategories = new Set([
      'landscape',
      'terrain',
      'facilities',
      'features',
      'route_style',
    ]);
    for (const suggestion of args.inheritedRouteSuggestions) {
      const category = suggestion.slug.split('.')[0];
      if (!category || !inheritCategories.has(category)) continue;
      addSuggestion(
        out,
        suggestion.slug,
        suggestion.confidence * 0.6,
        `From planned route: ${suggestion.reason}`,
        `route.${suggestion.rule}`,
      );
    }
  }

  return finalizeSuggestions(out, args.minConfidence ?? MIN_SUGGESTION_CONFIDENCE);
}
