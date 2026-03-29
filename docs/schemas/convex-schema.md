# Walking App – Convex Data Schema

This document describes the server-side data model stored in Convex. It covers all three stages of the app: **recording**, **reviewing**, and **replaying** (following) walks.

The app is offline-first. Walks are written to local device storage during recording and synced to Convex once the walk completes and connectivity is available. The tables below represent the canonical server-side schema; the local device store mirrors the same structure using local IDs prior to sync.

The authoritative schema definition lives in [`convex/schema.ts`](../convex/schema.ts).

---

## Tables

### `users`

Registered users. A row is created on first sign-in via the auth provider. `tokenIdentifier` maps directly to the `tokenIdentifier` value returned by `ctx.auth.getUserIdentity()`.

| Field             | Type     | Notes                                      |
|-------------------|----------|--------------------------------------------|
| `tokenIdentifier` | string   | Stable auth identity key. Indexed.         |
| `name`            | string?  | Display name from auth provider.           |
| `email`           | string?  | Email from auth provider.                  |

**Indexes**
- `by_tokenIdentifier` — fast user lookup on every authenticated request.

---

### `walks`

The master record for a walk, spanning all three stages. Created when recording begins, updated as the session progresses, and read during both review and replay.

| Field       | Type     | Notes                                                                 |
|-------------|----------|-----------------------------------------------------------------------|
| `userId`    | Id       | Owner of the walk.                                                    |
| `title`     | string?  | Optional user-supplied name.                                          |
| `status`    | union    | `"recording"` → `"paused"` ↔ `"recording"` → `"completed"`           |
| `startedAt` | number   | Unix ms timestamp when recording began.                               |
| `endedAt`   | number?  | Unix ms timestamp when the walk was finalised.                        |
| `deviceId`  | string   | Identifies the originating device for sync de-duplication.            |
| `stats`     | object?  | Computed after the walk completes (see sub-fields below). `null` during recording. |

**`stats` sub-fields** (all set during post-processing after stop)

| Field                  | Type     | Notes                                             |
|------------------------|----------|---------------------------------------------------|
| `distanceMetres`       | number   | Total distance over accepted (clean) points.      |
| `durationSeconds`      | number   | Total elapsed time including pauses.              |
| `movingTimeSeconds`    | number   | Inferred from point clustering.                   |
| `stoppedTimeSeconds`   | number   | `duration - movingTime`.                          |
| `avgPaceSecsPerKm`     | number?  | Average pace over moving time.                    |
| `elevationGainMetres`  | number?  | Smoothed cumulative ascent. May be absent if unreliable. |
| `elevationLossMetres`  | number?  | Smoothed cumulative descent.                      |
| `pointCount`           | number   | Count of clean track points used in stats.        |

**Indexes**
- `by_userId` — list a user's walks.
- `by_userId_and_status` — filter by status (e.g. active recording, completed library).
- `by_deviceId` — identify all walks from a specific device during sync.

---

### `trackPoints`

Individual GPS fixes captured during recording. Stored in a separate table because the point count is unbounded and grows continuously during a walk.

Raw points are persisted as delivered by the OS. After the walk completes, a post-processing step marks each point with `isClean = true` if it passes accuracy and outlier filters. Only clean points are used for the review polyline and route deviation checking during replay.

| Field            | Type     | Notes                                                         |
|------------------|----------|---------------------------------------------------------------|
| `walkId`         | Id       | Parent walk.                                                  |
| `timestamp`      | number   | Unix ms — the instant the OS delivered the fix.               |
| `latitude`       | number   | WGS-84 decimal degrees.                                       |
| `longitude`      | number   | WGS-84 decimal degrees.                                       |
| `altitudeMetres` | number?  | Present when the OS provides it. Can be noisy — treat with caution. |
| `speedMps`       | number?  | Instantaneous speed from the OS, if available.                |
| `accuracyMetres` | number   | Horizontal accuracy reported by the OS. Used for filtering.   |
| `isClean`        | boolean? | Set to `true` after post-processing. `null`/absent during recording. |

**Indexes**
- `by_walkId` — fetch all points for a walk.
- `by_walkId_and_timestamp` — fetch points in time order (used for route reconstruction and review polyline).

---

### `walkPhotos`

Photos taken inside the app during a recording session. Treated as **timeline events** — each photo is anchored to both a timestamp and a coordinate so it can be positioned along the route during review.

Photos are uploaded to Convex file storage during sync; `storageId` is the Convex `_storage` handle returned after upload. On the device, the local file path is used until sync completes.

| Field                 | Type     | Notes                                                              |
|-----------------------|----------|--------------------------------------------------------------------|
| `walkId`              | Id       | Walk the photo belongs to.                                         |
| `userId`              | Id       | Owner.                                                             |
| `timestamp`           | number   | Unix ms — when the photo was taken.                                |
| `latitude`            | number   | Location at capture time (current GPS fix or nearest track point). |
| `longitude`           | number   | Location at capture time.                                          |
| `nearestTrackPointId` | Id?      | Resolved on save or post-sync for timeline positioning.            |
| `storageId`           | Id       | Convex `_storage` file handle.                                     |
| `caption`             | string?  | Optional user-supplied caption.                                    |

**Indexes**
- `by_walkId` — fetch all photos for a walk.
- `by_walkId_and_timestamp` — display photos in chronological order along the route.
- `by_userId` — list all photos taken by a user.

---

### `syncJobs`

Tracks the upload state of each completed walk from the device to Convex. Kept separate from `walks` because sync status changes frequently while the walk document itself is stable after completion.

One sync job per walk. Failed jobs are retried by resetting `status` to `"pending"`.

| Field          | Type     | Notes                                            |
|----------------|----------|--------------------------------------------------|
| `walkId`       | Id       | The walk being synced.                           |
| `deviceId`     | string   | The originating device.                          |
| `status`       | union    | `"pending"` → `"in_progress"` → `"completed"` / `"failed"` |
| `attemptedAt`  | number?  | Unix ms of the most recent attempt.              |
| `errorMessage` | string?  | Last error, if status is `"failed"`.             |

**Indexes**
- `by_walkId` — check sync state for a specific walk.
- `by_status` — find all pending jobs to process.
- `by_deviceId_and_status` — find pending or failed jobs for a specific device.

---

### `followSessions`

A session where the user follows a previously recorded walk as a route guide. Links live GPS tracking to a stored walk's clean track points.

Summary fields (`finalDistanceCoveredMetres`, `finalProgressPercent`) are set when the session transitions to `"completed"` or `"abandoned"`.

| Field                         | Type   | Notes                                                    |
|-------------------------------|--------|----------------------------------------------------------|
| `userId`                      | Id     | The user following the route.                            |
| `walkId`                      | Id     | The source walk being followed.                          |
| `status`                      | union  | `"active"` → `"completed"` / `"abandoned"`               |
| `startedAt`                   | number | Unix ms.                                                 |
| `endedAt`                     | number? | Unix ms — set on completion or abandonment.             |
| `finalDistanceCoveredMetres`  | number? | Total distance covered during this follow session.      |
| `finalProgressPercent`        | number? | 0–100. Approximate % of the route the user completed.  |

**Indexes**
- `by_userId` — list a user's follow history.
- `by_walkId` — see all sessions that followed a given walk.
- `by_userId_and_status` — find the currently active follow session for a user.

---

### `offRouteEvents`

Individual deviation events detected during a follow session. Written when the user's position exceeds the off-route distance threshold for the required duration.

Kept separate from `followSessions` to prevent unbounded document growth and to allow efficient querying of deviation history.

| Field                    | Type     | Notes                                                      |
|--------------------------|----------|------------------------------------------------------------|
| `followSessionId`        | Id       | Parent follow session.                                     |
| `timestamp`              | number   | Unix ms — when the deviation was first detected.           |
| `latitude`               | number   | User's position at time of detection.                      |
| `longitude`              | number   | User's position at time of detection.                      |
| `distanceFromRouteMetres`| number   | How far off-route at the moment detection triggered.       |
| `returnedToRouteAt`      | number?  | Unix ms — set when the user returns within threshold.      |

**Indexes**
- `by_followSessionId` — fetch all deviation events for a session.
- `by_followSessionId_and_timestamp` — events in chronological order.

---

## Stage Coverage Summary

| Stage         | Primary Tables                                      |
|---------------|-----------------------------------------------------|
| **Recording** | `walks`, `trackPoints`, `walkPhotos`, `syncJobs`    |
| **Reviewing** | `walks`, `trackPoints` (clean), `walkPhotos`        |
| **Replaying** | `walks`, `trackPoints` (clean), `followSessions`, `offRouteEvents` |

---

## Design Notes

**Offline-first:** walks, track points, and photos are written to local device storage during recording. Convex receives this data only after the walk completes and the device has connectivity. The `syncJobs` table tracks this pipeline. The `deviceId` field on `walks` enables de-duplication if a sync is retried.

**Separation of concerns:** high-churn data (`trackPoints`, `offRouteEvents`) lives in dedicated tables with foreign keys. This prevents large documents and keeps the `walks` document small and stable.

**Raw vs clean points:** all track points are stored as received from the OS. The `isClean` flag is set during post-processing. Review and replay logic filters to `isClean = true` to avoid GPS jitter and bad outliers affecting the displayed route or deviation calculations.

**Stats computed after recording:** `walks.stats` is intentionally `null` during active recording. It is populated in a single pass after the user taps Stop, using the cleaned point set. This keeps the recording hot path minimal (write point, return) and allows the stat algorithm to be improved without affecting captured data.

**Elevation:** altitude data is stored per point when the OS provides it, but marked as optional at the stats level because it is frequently noisy. Post-processing should smooth elevation before computing gain/loss.

**Photos as timeline events:** `walkPhotos.timestamp` and the walk's `trackPoints` share the same time axis. This makes photo placement along the route straightforward — find track points whose timestamp brackets the photo's timestamp, interpolate position, render marker.

**Follow session purity:** a `followSession` never mutates the source `walk`. The source walk is read-only from the replay stage's perspective.
