import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  /**
   * Registered users. Created on first sign-in via auth.
   */
  users: defineTable({
    tokenIdentifier: v.string(), // from ctx.auth.getUserIdentity().tokenIdentifier
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    weightKg: v.optional(v.number()),
    /** Set via the Convex dashboard to grant admin privileges. */
    isAdmin: v.optional(v.boolean()),
  }).index("by_tokenIdentifier", ["tokenIdentifier"]),

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
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_status", ["userId", "status"])
    .index("by_deviceId", ["deviceId"]),

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
  })
    .index("by_userId", ["userId"])
    .index("by_walkId", ["walkId"])
    .index("by_userId_and_status", ["userId", "status"]),

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
});
