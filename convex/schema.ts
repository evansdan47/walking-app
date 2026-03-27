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
});
