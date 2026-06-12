/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as admin from "../admin.js";
import type * as appRelease from "../appRelease.js";
import type * as appReleaseCore from "../appReleaseCore.js";
import type * as authHelpers from "../authHelpers.js";
import type * as badgeAdmin from "../badgeAdmin.js";
import type * as badgeCategoriesSeed from "../badgeCategoriesSeed.js";
import type * as badgeDefinitionsSeed from "../badgeDefinitionsSeed.js";
import type * as badgeEngine_contextHelpers from "../badgeEngine/contextHelpers.js";
import type * as badgeEngine_evaluate from "../badgeEngine/evaluate.js";
import type * as badgeEngine_progressChains from "../badgeEngine/progressChains.js";
import type * as badgeEngine_resolveDefinition from "../badgeEngine/resolveDefinition.js";
import type * as badgeEngine_ruleEvaluators from "../badgeEngine/ruleEvaluators.js";
import type * as badgeEngine_types from "../badgeEngine/types.js";
import type * as badgeEngine_userContext from "../badgeEngine/userContext.js";
import type * as badgeRuleValidators from "../badgeRuleValidators.js";
import type * as badgeUiSettings from "../badgeUiSettings.js";
import type * as badges from "../badges.js";
import type * as device_logs from "../device_logs.js";
import type * as experimentCore from "../experimentCore.js";
import type * as experimentDefinitions from "../experimentDefinitions.js";
import type * as experimentService from "../experimentService.js";
import type * as experimentValidators from "../experimentValidators.js";
import type * as experiments from "../experiments.js";
import type * as explore_routes from "../explore_routes.js";
import type * as followSessions from "../followSessions.js";
import type * as goalCatalog from "../goalCatalog.js";
import type * as places from "../places.js";
import type * as planned_routes from "../planned_routes.js";
import type * as tagAggregationCore from "../tagAggregationCore.js";
import type * as tagAutoDetectCore from "../tagAutoDetectCore.js";
import type * as tagAutoDetectValidators from "../tagAutoDetectValidators.js";
import type * as tagTaxonomy from "../tagTaxonomy.js";
import type * as tagValidators from "../tagValidators.js";
import type * as tags from "../tags.js";
import type * as track_points from "../track_points.js";
import type * as userAccountCore from "../userAccountCore.js";
import type * as userGoals from "../userGoals.js";
import type * as userGoalsCore from "../userGoalsCore.js";
import type * as userSessionCore from "../userSessionCore.js";
import type * as userValidators from "../userValidators.js";
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
  account: typeof account;
  admin: typeof admin;
  appRelease: typeof appRelease;
  appReleaseCore: typeof appReleaseCore;
  authHelpers: typeof authHelpers;
  badgeAdmin: typeof badgeAdmin;
  badgeCategoriesSeed: typeof badgeCategoriesSeed;
  badgeDefinitionsSeed: typeof badgeDefinitionsSeed;
  "badgeEngine/contextHelpers": typeof badgeEngine_contextHelpers;
  "badgeEngine/evaluate": typeof badgeEngine_evaluate;
  "badgeEngine/progressChains": typeof badgeEngine_progressChains;
  "badgeEngine/resolveDefinition": typeof badgeEngine_resolveDefinition;
  "badgeEngine/ruleEvaluators": typeof badgeEngine_ruleEvaluators;
  "badgeEngine/types": typeof badgeEngine_types;
  "badgeEngine/userContext": typeof badgeEngine_userContext;
  badgeRuleValidators: typeof badgeRuleValidators;
  badgeUiSettings: typeof badgeUiSettings;
  badges: typeof badges;
  device_logs: typeof device_logs;
  experimentCore: typeof experimentCore;
  experimentDefinitions: typeof experimentDefinitions;
  experimentService: typeof experimentService;
  experimentValidators: typeof experimentValidators;
  experiments: typeof experiments;
  explore_routes: typeof explore_routes;
  followSessions: typeof followSessions;
  goalCatalog: typeof goalCatalog;
  places: typeof places;
  planned_routes: typeof planned_routes;
  tagAggregationCore: typeof tagAggregationCore;
  tagAutoDetectCore: typeof tagAutoDetectCore;
  tagAutoDetectValidators: typeof tagAutoDetectValidators;
  tagTaxonomy: typeof tagTaxonomy;
  tagValidators: typeof tagValidators;
  tags: typeof tags;
  track_points: typeof track_points;
  userAccountCore: typeof userAccountCore;
  userGoals: typeof userGoals;
  userGoalsCore: typeof userGoalsCore;
  userSessionCore: typeof userSessionCore;
  userValidators: typeof userValidators;
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
