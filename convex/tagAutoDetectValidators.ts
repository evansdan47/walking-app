import { v } from 'convex/values';

export const routePointValidator = v.object({
  lng: v.number(),
  lat: v.number(),
});

export const routeLegValidator = v.object({
  id: v.optional(v.string()),
  name: v.optional(v.string()),
  color: v.optional(v.string()),
  points: v.array(routePointValidator),
});

export const routeStatsValidator = v.object({
  distanceKm: v.number(),
  elevationGainM: v.number(),
});

export const poiTypeValidator = v.union(
  v.literal('landmark'),
  v.literal('viewpoint'),
  v.literal('food_drink'),
  v.literal('parking'),
  v.literal('toilet'),
  v.literal('facility'),
  v.literal('hazard'),
  v.literal('wildlife'),
  v.literal('nature_reserve'),
  v.literal('navigation'),
  v.literal('accommodation'),
);
