/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as appRelease from "../appRelease.js";
import type * as appReleaseCore from "../appReleaseCore.js";
import type * as authHelpers from "../authHelpers.js";
import type * as device_logs from "../device_logs.js";
import type * as experimentCore from "../experimentCore.js";
import type * as experimentDefinitions from "../experimentDefinitions.js";
import type * as experimentService from "../experimentService.js";
import type * as experimentValidators from "../experimentValidators.js";
import type * as experiments from "../experiments.js";
import type * as explore_routes from "../explore_routes.js";
import type * as places from "../places.js";
import type * as planned_routes from "../planned_routes.js";
import type * as tagAggregationCore from "../tagAggregationCore.js";
import type * as tagAutoDetectCore from "../tagAutoDetectCore.js";
import type * as tagAutoDetectValidators from "../tagAutoDetectValidators.js";
import type * as tagTaxonomy from "../tagTaxonomy.js";
import type * as tagValidators from "../tagValidators.js";
import type * as tags from "../tags.js";
import type * as track_points from "../track_points.js";
import type * as userSessionCore from "../userSessionCore.js";
import type * as users from "../users.js";
import type * as waitlist from "../waitlist.js";
import type * as walk_photos from "../walk_photos.js";
import type * as walks from "../walks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  appRelease: typeof appRelease;
  appReleaseCore: typeof appReleaseCore;
  authHelpers: typeof authHelpers;
  device_logs: typeof device_logs;
  experimentCore: typeof experimentCore;
  experimentDefinitions: typeof experimentDefinitions;
  experimentService: typeof experimentService;
  experimentValidators: typeof experimentValidators;
  experiments: typeof experiments;
  explore_routes: typeof explore_routes;
  places: typeof places;
  planned_routes: typeof planned_routes;
  tagAggregationCore: typeof tagAggregationCore;
  tagAutoDetectCore: typeof tagAutoDetectCore;
  tagAutoDetectValidators: typeof tagAutoDetectValidators;
  tagTaxonomy: typeof tagTaxonomy;
  tagValidators: typeof tagValidators;
  tags: typeof tags;
  track_points: typeof track_points;
  userSessionCore: typeof userSessionCore;
  users: typeof users;
  waitlist: typeof waitlist;
  walk_photos: typeof walk_photos;
  walks: typeof walks;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
