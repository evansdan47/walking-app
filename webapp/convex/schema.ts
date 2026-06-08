import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { experimentAssignmentMethodValidator } from "./experimentValidators";
import {
  tagCategoryValidator,
  tagContributionSourceValidator,
  tagEntityTypeValidator,
  tagKindValidator,
  taggingExperimentVariantValidator,
} from "./tagValidators";
import {
  badgeCategoryValidator,
  badgeCriteriaTypeValidator,
  goalCategoryValidator,
  goalPeriodValidator,
  userGoalStatusValidator,
  userGoalTypeValidator,
  userGoalUnitValidator,
  userPreferencesValidator,
  userStatsCacheValidator,
  userSubscriptionValidator,
} from "./userValidators";

export default defineSchema({
  /**
   * Registered users. Created on first sign-in via auth.
   */
  users: defineTable({
    tokenIdentifier: v.string(), // from ctx.auth.getUserIdentity().tokenIdentifier
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    /** @deprecated Prefer `preferences.profile.weightKg`. Kept for migration reads. */
    weightKg: v.optional(v.number()),
    /** Account hub: units, weight, display, privacy. */
    preferences: v.optional(userPreferencesValidator),
    /** Subscription plan display (billing integration later). */
    subscription: v.optional(userSubscriptionValidator),
    /** Denormalised lifetime stats for account overview (optional cache). */
    statsCache: v.optional(userStatsCacheValidator),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    /** Set via the Convex dashboard to grant admin privileges. */
    isAdmin: v.optional(v.boolean()),
    /** 3D map view — 45° isometric pitch. */
    map3d: v.optional(v.boolean()),
    /** Compass needle overlay in the map button strip. */
    mapCompass: v.optional(v.boolean()),
    /** Floating location info panel (lat/lng, OS grid ref, postcode). */
    mapLocationInfo: v.optional(v.boolean()),
    /** Sticky A/B/C assignment for walk tagging UI experiments. */
    taggingExperimentVariant: v.optional(taggingExperimentVariantValidator),
    taggingExperimentAssignedAt: v.optional(v.number()),
    /** Last successful session sync from the web app (ms epoch). */
    lastLoginAtWeb: v.optional(v.number()),
    /** Last successful session sync from the mobile app (ms epoch). */
    lastLoginAtMobile: v.optional(v.number()),
    /** Native build number from the most recent mobile session sync. */
    lastMobileBuild: v.optional(v.number()),
    /** Semver from the most recent mobile session sync (display only). */
    lastMobileVersion: v.optional(v.string()),
    lastMobilePlatform: v.optional(v.union(v.literal("ios"), v.literal("android"))),
    /** Web app version string from the most recent web session sync. */
    lastWebAppVersion: v.optional(v.string()),
  }).index("by_tokenIdentifier", ["tokenIdentifier"]),

  // ------------------------------------------------------------------
  // Account hub — goals & badges (@see docs/UserMenuRoadmap.md)
  // ------------------------------------------------------------------

  /** User-created walking goals with time windows and progress. */
  userGoals: defineTable({
    userId: v.id("users"),
    goalType: userGoalTypeValidator,
    /** Data-driven category (@see convex/goalCatalog.ts). */
    category: goalCategoryValidator,
    metric: v.string(),
    period: goalPeriodValidator,
    title: v.string(),
    status: userGoalStatusValidator,
    /** Target amount in `unit` (e.g. 100 km, 3 walks, 18000 seconds). */
    targetValue: v.number(),
    unit: userGoalUnitValidator,
    /** Optional label for virtual journeys / famous climbs. */
    challengeLabel: v.optional(v.string()),
    /** Stable id from goal catalog challenge preset, if any. */
    challengeId: v.optional(v.string()),
    windowStart: v.number(),
    windowEnd: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
    /** Cached progress for list views; recomputed from walks/routes. */
    progressValue: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_status", ["userId", "status"])
    .index("by_userId_and_windowEnd", ["userId", "windowEnd"]),

  /** Data-driven badge catalogue (seeded from badgeDefinitionsSeed.ts). */
  badgeDefinitions: defineTable({
    slug: v.string(),
    category: badgeCategoryValidator,
    label: v.string(),
    description: v.string(),
    sortOrder: v.number(),
    /** UI icon key (web/mobile map to assets). */
    iconKey: v.optional(v.string()),
    criteriaType: badgeCriteriaTypeValidator,
    criteriaThreshold: v.optional(v.number()),
    isActive: v.boolean(),
  })
    .index("by_slug", ["slug"])
    .index("by_category_and_sortOrder", ["category", "sortOrder"])
    .index("by_isActive", ["isActive"]),

  /** Badges unlocked by a user. */
  userBadges: defineTable({
    userId: v.id("users"),
    badgeId: v.id("badgeDefinitions"),
    unlockedAt: v.number(),
    metadata: v.optional(v.any()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_badgeId", ["userId", "badgeId"])
    .index("by_userId_and_unlockedAt", ["userId", "unlockedAt"])
    .index("by_badgeId", ["badgeId"]),

  /**
   * A single walk session — covers recording, review and replay source.
   *
   * Status machine: recording -> paused -> recording -> completed
   *
   * `stats` is populated after the walk is finalised (post-processing).
   * Raw track points are stored separately in `trackPoints`.
   *
   * `deviceId` is set by the originating device so locally-recorded
   * walks can be identified and de-duplicated during sync.
   */
  walks: defineTable({
    userId: v.id("users"),
    title: v.optional(v.string()),
    status: v.union(
      v.literal("recording"),
      v.literal("paused"),
      v.literal("completed"),
    ),
    startedAt: v.number(), // Unix ms
    endedAt: v.optional(v.number()), // Unix ms — set when status -> completed
    deviceId: v.string(),
    /**
     * Set to true when a walk is actively recording and the device is online.
     * Reserved for future real-time friend-location features — a subscription
     * on `by_userId_and_status` filtered by isLive will surface live walks
     * without any schema changes.
     * Flipped to false (or left unset) when the walk completes.
     */
    isLive: v.optional(v.boolean()),
    stats: v.optional(
      v.object({
        distanceMetres: v.number(),
        durationSeconds: v.number(), // total elapsed (inc. pauses)
        movingTimeSeconds: v.number(),
        stoppedTimeSeconds: v.number(),
        avgPaceSecsPerKm: v.optional(v.number()),
        elevationGainMetres: v.optional(v.number()),
        elevationLossMetres: v.optional(v.number()),
        pointCount: v.number(), // count of accepted (clean) track points
      }),
    ),
    /** Planned route this walk relates to (for tag aggregation). */
    plannedRouteId: v.optional(v.id("plannedRoutes")),
    /** Set when the user completes the post-walk tagging flow. */
    taggingCompletedAt: v.optional(v.number()),
    /** User dismissed tagging — optional re-prompt later. */
    taggingSkipped: v.optional(v.boolean()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_status", ["userId", "status"])
    .index("by_deviceId", ["deviceId"])
    .index("by_plannedRouteId", ["plannedRouteId"]),

  /**
   * Individual GPS fixes captured during recording.
   *
   * One row per location update delivered by the OS. Kept separate from
   * `walks` because the point count is unbounded and grows continuously.
   *
   * `isClean` is set to true during post-processing once the point has
   * passed accuracy and outlier filtering. Only clean points are used
   * when rendering the review polyline and for follow-session deviation
   * checks.
   */
  trackPoints: defineTable({
    walkId: v.id("walks"),
    timestamp: v.number(), // Unix ms — the instant the fix was captured
    latitude: v.number(),
    longitude: v.number(),
    altitudeMetres: v.optional(v.number()),
    speedMps: v.optional(v.number()),
    accuracyMetres: v.number(), // horizontal accuracy from the OS
    isClean: v.optional(v.boolean()), // set after post-processing
  })
    .index("by_walkId", ["walkId"])
    .index("by_walkId_and_timestamp", ["walkId", "timestamp"]),

  /**
   * Photos taken inside the app during a recording session.
   *
   * Treated as timeline events: each photo is anchored to a timestamp
   * and a coordinate so it can be positioned along the route during
   * review. `nearestTrackPointId` is resolved on save (or post-sync).
   *
   * Files are stored in Convex file storage; `storageId` is the handle
   * returned after upload.
   */
  walkPhotos: defineTable({
    walkId: v.id("walks"),
    userId: v.id("users"),
    timestamp: v.number(), // Unix ms — when the photo was taken
    latitude: v.number(),
    longitude: v.number(),
    nearestTrackPointId: v.optional(v.id("trackPoints")),
    storageId: v.id("_storage"),
    caption: v.optional(v.string()),
  })
    .index("by_walkId", ["walkId"])
    .index("by_walkId_and_timestamp", ["walkId", "timestamp"])
    .index("by_userId", ["userId"]),

  /**
   * Tracks the upload state of a completed walk from device to Convex.
   *
   * Kept separate from `walks` because sync state changes frequently
   * (pending -> in_progress -> completed/failed) while the walk document
   * itself is stable after completion.
   *
   * One sync job per walk. Failed jobs can be retried by resetting
   * status back to "pending".
   */
  syncJobs: defineTable({
    walkId: v.id("walks"),
    deviceId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    attemptedAt: v.optional(v.number()), // Unix ms of last attempt
    errorMessage: v.optional(v.string()),
  })
    .index("by_walkId", ["walkId"])
    .index("by_status", ["status"])
    .index("by_deviceId_and_status", ["deviceId", "status"]),

  /**
   * A session where the user follows a previously recorded walk.
   *
   * `walkId` is the source walk being followed. Stats are finalised
   * when status transitions to "completed" or "abandoned".
   */
  followSessions: defineTable({
    userId: v.id("users"),
    walkId: v.id("walks"), // the route being followed
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("abandoned"),
    ),
    startedAt: v.number(), // Unix ms
    endedAt: v.optional(v.number()), // Unix ms
    finalDistanceCoveredMetres: v.optional(v.number()),
    finalProgressPercent: v.optional(v.number()), // 0-100, % of route completed
    /** Planned route being followed (when source is a planned route). */
    plannedRouteId: v.optional(v.id("plannedRoutes")),
    taggingCompletedAt: v.optional(v.number()),
    taggingSkipped: v.optional(v.boolean()),
  })
    .index("by_userId", ["userId"])
    .index("by_walkId", ["walkId"])
    .index("by_userId_and_status", ["userId", "status"])
    .index("by_plannedRouteId", ["plannedRouteId"]),

  /**
   * Individual off-route deviation events detected during a follow session.
   *
   * A new row is written when the user exceeds the deviation threshold.
   * `returnedToRouteAt` is set when they come back within threshold.
   *
   * Keeping these separate from `followSessions` avoids unbounded document
   * growth and allows efficient event replay and analytics later.
   */
  offRouteEvents: defineTable({
    followSessionId: v.id("followSessions"),
    timestamp: v.number(), // Unix ms — when deviation was detected
    latitude: v.number(), // user's position at time of detection
    longitude: v.number(),
    distanceFromRouteMetres: v.number(), // how far off-route at detection
    returnedToRouteAt: v.optional(v.number()), // Unix ms — when resolved
  })
    .index("by_followSessionId", ["followSessionId"])
    .index("by_followSessionId_and_timestamp", ["followSessionId", "timestamp"]),

  /**
   * Custom planned routes created in the route planner.
   *
   * Legs and their points are stored inline (each leg is small and bounded).
   * Stats are computed client-side and stored for quick listing without
   * re-processing points on every query.
   *
   * `visibility`:
   *   "private"  – only the author can see it (default for new routes)
   *   "shared"   – placeholder for future group/friend sharing
   *   "public"   – visible to all users in the Explore view
   *
   * `authorId` mirrors `userId` and is set on creation for fast joins.
   * Both fields are optional to remain compatible with pre-existing rows.
   */
  plannedRoutes: defineTable({
    userId: v.id("users"),
    /** The creating user — identical to userId, kept for explicit join clarity. */
    authorId: v.optional(v.id("users")),
    /** Visibility level; absent on legacy rows treated as "public" for back-compat. */
    visibility: v.optional(
      v.union(v.literal("private"), v.literal("shared"), v.literal("public")),
    ),
    title: v.string(),
    description: v.optional(v.string()),
    createdAt: v.number(), // Unix ms
    legs: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        color: v.string(),
        points: v.array(
          v.object({
            lng: v.number(),
            lat: v.number(),
            isControlPoint: v.optional(v.boolean()),
            isSnapped: v.optional(v.boolean()),
          }),
        ),
      }),
    ),
    stats: v.optional(
      v.object({
        distanceKm: v.number(),
        elevationGainM: v.number(),
      }),
    ),
    /** Creator-selected tags at save time (controlled vocabulary ids). */
    creatorTagIds: v.optional(v.array(v.id("tagDefinitions"))),
    /** Denormalised count of completed walks linked to this route. */
    linkedWalkCount: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_createdAt", ["userId", "createdAt"])
    .index("by_visibility", ["visibility"]),

  // ------------------------------------------------------------------
  // Places / POIs
  //
  // Reusable points of interest: car parks, toilets, cafés, landmarks,
  // viewpoints, hazards, wildlife spots and nature reserves.
  //
  // `details` is v.any() so community submissions can freely store
  // type-specific fields without a rigid schema.
  // ------------------------------------------------------------------

  places: defineTable({
    // Optional on fast-path community submissions (type alone is sufficient).
    name: v.optional(v.string()),

    type: v.union(
      v.literal("landmark"),
      v.literal("viewpoint"),
      v.literal("food_drink"),
      v.literal("parking"),
      v.literal("toilet"),
      v.literal("facility"),
      v.literal("hazard"),
      v.literal("wildlife"),
      v.literal("nature_reserve"),
      v.literal("navigation"),
      v.literal("accommodation"),
    ),

    status: v.union(
      v.literal("draft"),
      v.literal("published"),
      v.literal("archived"),
    ),

    // Who created this POI and how it entered the system.
    source: v.union(
      v.literal("planner_user"),
      v.literal("admin"),
      v.literal("import"),
      v.literal("system"),
    ),

    // Who can see it.
    visibility: v.union(
      v.literal("private"),   // only the creating user
      v.literal("community"), // all users; subject to confirmation
      v.literal("public"),    // fully trusted / admin-approved
    ),

    latitude: v.number(),
    longitude: v.number(),

    shortDescription: v.optional(v.string()),
    description: v.optional(v.string()),

    tags: v.optional(v.array(v.string())),

    // e.g. "National Trust", "Cornwall Wildlife Trust", "User submitted"
    sourceName: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),

    // Community confidence tracking.
    verificationStatus: v.union(
      v.literal("unverified"),
      v.literal("community_reported"),
      v.literal("community_confirmed"),
      v.literal("system_enriched"),
      v.literal("admin_verified"),
      v.literal("rejected"),
    ),
    confirmationCount: v.number(),
    rejectionCount: v.number(),
    // confirmationCount / (confirmationCount + rejectionCount); 0 when no votes
    confidenceScore: v.number(),

    createdByUserId: v.optional(v.id("users")),
    createdAt: v.number(), // Unix ms
    updatedAt: v.number(), // Unix ms

    // Flexible per-type data. Use v.any() so community submissions can
    // freely include type-specific fields (details.dogFriendly,
    // details.species, details.hazardSeverity, etc.)
    details: v.optional(v.any()),
  })
    .index("by_type", ["type"])
    .index("by_status", ["status"])
    .index("by_visibility", ["visibility"])
    .index("by_verificationStatus", ["verificationStatus"])
    .index("by_createdByUserId", ["createdByUserId"]),

  // ------------------------------------------------------------------
  // Photos / images for POIs
  // ------------------------------------------------------------------

  placePhotos: defineTable({
    placeId: v.id("places"),
    storageId: v.id("_storage"),

    caption: v.optional(v.string()),
    credit: v.optional(v.string()),

    createdByUserId: v.optional(v.id("users")),
    createdAt: v.number(), // Unix ms
  })
    .index("by_placeId", ["placeId"])
    .index("by_createdByUserId", ["createdByUserId"]),

  // ------------------------------------------------------------------
  // Link POIs to planned routes
  //
  // Key for planning and replay prompts:
  //   "toilet in 800m", "seal viewpoint coming up", "hazard near this section"
  //
  // Note: recorded walks (walks table) do not own POIs directly.
  // POIs belong to the *planned route*; a recorded walk inherits them
  // through the planned route it follows.
  // ------------------------------------------------------------------

  plannedRoutePlaces: defineTable({
    plannedRouteId: v.id("plannedRoutes"),
    placeId: v.id("places"),

    // Where it appears along the route.
    order: v.optional(v.number()),
    distanceFromStartMetres: v.optional(v.number()),

    // How the POI relates to this route.
    role: v.optional(
      v.union(
        v.literal("start"),
        v.literal("end"),
        v.literal("nearby"),
        v.literal("highlight"),
        v.literal("refreshment_stop"),
        v.literal("warning"),
        v.literal("navigation_cue"),
      ),
    ),

    note: v.optional(v.string()),

    createdAt: v.number(), // Unix ms
  })
    .index("by_plannedRouteId", ["plannedRouteId"])
    .index("by_placeId", ["placeId"])
    .index("by_plannedRouteId_and_order", ["plannedRouteId", "order"]),

  // ------------------------------------------------------------------
  // Community validation of POIs
  //
  // One row per (place, user) response. The by_placeId_and_userId index
  // enforces uniqueness at query time so the same user cannot keep
  // confirming the same POI.
  // ------------------------------------------------------------------

  placeConfirmations: defineTable({
    placeId: v.id("places"),
    userId: v.id("users"),

    response: v.union(
      v.literal("confirmed"),
      v.literal("not_found"),
      v.literal("wrong_type"),
      v.literal("duplicate"),
      v.literal("closed"),
      v.literal("unsafe"),
      v.literal("spam"),
    ),

    note: v.optional(v.string()),

    createdAt: v.number(), // Unix ms
  })
    .index("by_placeId", ["placeId"])
    .index("by_userId", ["userId"])
    .index("by_placeId_and_userId", ["placeId", "userId"]),

  // ------------------------------------------------------------------
  // Device diagnostic logs
  //
  // Submitted manually by the user via the Stats & State debug panel.
  // Each row is a batch of SQLite app_log entries from one device at one
  // point in time. userId is stored as tokenIdentifier (optional — kept
  // even when the user is signed out so anonymous submissions are still
  // tied to a device).
  // ------------------------------------------------------------------

  deviceLogs: defineTable({
    userId: v.optional(v.string()), // tokenIdentifier, null if unauthenticated
    deviceId: v.string(),
    appVersion: v.string(),
    submittedAt: v.number(), // Unix ms
    entries: v.array(
      v.object({
        ts: v.number(),
        level: v.string(),
        tag: v.string(),
        message: v.string(),
        stack: v.optional(v.string()),
        context: v.optional(v.string()),
      }),
    ),
  })
    .index("by_userId", ["userId"])
    .index("by_submittedAt", ["submittedAt"]),

  // ------------------------------------------------------------------
  // Waitlist / closed-beta interest registrations
  //
  // Submitted via the public waitlist page before account creation.
  // All questionnaire fields are optional — only name + email required.
  // ------------------------------------------------------------------

  waitlist: defineTable({
    name: v.string(),
    email: v.string(), // lower-cased before insert

    // Q1: How often do you go walking or hiking?
    walkingFrequency: v.optional(v.string()),

    // Q2: What type of walking do you do most often? (multi-select)
    walkingTypes: v.optional(v.array(v.string())),

    // Q3: Which apps / tools do you currently use? (multi-select)
    appsUsed: v.optional(v.array(v.string())),

    // Q4: What do you mainly use walking apps for? (up to 3, multi-select)
    mainUses: v.optional(v.array(v.string())),

    // Q5: What frustrates you most about current walking apps? (multi-select)
    frustrations: v.optional(v.array(v.string())),

    // Q6: Would you be interested in helping test new features?
    testingInterest: v.optional(v.string()),

    // Bonus: What device do you normally walk with? (multi-select)
    deviceTypes: v.optional(v.array(v.string())),

    submittedAt: v.number(), // Unix ms
  })
    .index("by_email", ["email"])
    .index("by_submittedAt", ["submittedAt"]),

  // ------------------------------------------------------------------
  // Walk tagging — controlled vocabulary & contributions
  // @see docs/taggingsystem.md, docs/TaggingSystemRoadmap.md
  // ------------------------------------------------------------------

  /**
   * Canonical tag taxonomy. Users select from these slugs only.
   */
  tagDefinitions: defineTable({
    slug: v.string(),
    category: tagCategoryValidator,
    kind: tagKindValidator,
    label: v.string(),
    description: v.optional(v.string()),
    sortOrder: v.number(),
    isActive: v.boolean(),
    seasonalMonths: v.optional(v.array(v.number())),
    autoDetectRule: v.optional(v.string()),
  })
    .index("by_slug", ["slug"])
    .index("by_category_and_sortOrder", ["category", "sortOrder"])
    .index("by_isActive", ["isActive"]),

  /**
   * One row per user assertion (creator, walker, or auto-detect confirm).
   * Walk tags feed routeTagSummaries — they do not patch plannedRoutes directly.
   */
  tagContributions: defineTable({
    tagId: v.id("tagDefinitions"),
    userId: v.id("users"),
    entityType: tagEntityTypeValidator,
    entityId: v.string(),
    plannedRouteId: v.optional(v.id("plannedRoutes")),
    source: tagContributionSourceValidator,
    reportedAt: v.number(),
    experimentVariant: v.optional(taggingExperimentVariantValidator),
    questionnaireAnswers: v.optional(v.any()),
  })
    .index("by_entityType_and_entityId", ["entityType", "entityId"])
    .index("by_plannedRouteId", ["plannedRouteId"])
    .index("by_plannedRouteId_and_tagId", ["plannedRouteId", "tagId"])
    .index("by_userId_and_entityType_and_entityId_and_tagId", [
      "userId",
      "entityType",
      "entityId",
      "tagId",
    ]),

  /**
   * Denormalised rollups for planned route discovery and detail views.
   */
  routeTagSummaries: defineTable({
    plannedRouteId: v.id("plannedRoutes"),
    tagId: v.id("tagDefinitions"),
    confirmationCount: v.number(),
    creatorConfirmed: v.boolean(),
    autoSuggested: v.boolean(),
    lastReportedAt: v.number(),
    confidenceScore: v.number(),
  })
    .index("by_plannedRouteId", ["plannedRouteId"])
    .index("by_plannedRouteId_and_tagId", ["plannedRouteId", "tagId"]),

  // ------------------------------------------------------------------
  // Mobile release policy — minimum / latest native build per platform
  // ------------------------------------------------------------------

  mobileReleasePolicies: defineTable({
    platform: v.union(v.literal("ios"), v.literal("android")),
    /** Builds below this are blocked from using the app. 0 = no minimum enforced. */
    minimumBuild: v.number(),
    /** Builds below this see an optional update prompt. 0 = no nudge. */
    latestBuild: v.number(),
    storeUrl: v.string(),
    optionalUpdateMessage: v.optional(v.string()),
    requiredUpdateMessage: v.optional(v.string()),
    updatedAt: v.number(),
    updatedByUserId: v.optional(v.id("users")),
  }).index("by_platform", ["platform"]),

  // ------------------------------------------------------------------
  // Feature experiments — reusable A/B/C (or arbitrary variant) framework
  // @see docs/experiments.md
  // ------------------------------------------------------------------

  /**
   * Per-experiment runtime config: enable flag, variant weights, UI config blob.
   */
  experimentConfigs: defineTable({
    key: v.string(),
    label: v.string(),
    description: v.optional(v.string()),
    enabled: v.boolean(),
    variants: v.array(
      v.object({
        id: v.string(),
        weight: v.number(),
      }),
    ),
    config: v.optional(v.any()),
    /** When set to "false", disables this experiment regardless of `enabled`. */
    envKillSwitch: v.optional(v.string()),
    updatedAt: v.number(),
    updatedByUserId: v.optional(v.id("users")),
  }).index("by_key", ["key"]),

  /**
   * Sticky per-user variant assignment. Source of truth for experiment arms.
   */
  experimentAssignments: defineTable({
    userId: v.id("users"),
    experimentKey: v.string(),
    variant: v.string(),
    assignedAt: v.number(),
    method: experimentAssignmentMethodValidator,
    assignedByUserId: v.optional(v.id("users")),
  })
    .index("by_userId_and_experimentKey", ["userId", "experimentKey"])
    .index("by_experimentKey", ["experimentKey"]),

  /**
   * Funnel / interaction events for experiment analysis.
   */
  experimentEvents: defineTable({
    userId: v.id("users"),
    experimentKey: v.string(),
    eventType: v.string(),
    variant: v.optional(v.string()),
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    metadata: v.optional(v.any()),
    recordedAt: v.number(),
  })
    .index("by_experimentKey_and_recordedAt", ["experimentKey", "recordedAt"])
    .index("by_userId_and_experimentKey", ["userId", "experimentKey"])
    .index("by_experimentKey_and_eventType", ["experimentKey", "eventType"]),
});
