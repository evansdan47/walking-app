# Database Refactor — Architecture Questions & Answers

> Photo blob data lives in Convex file storage only. Only photo metadata
> (timestamp, coordinates, caption, storage ID) is synced locally. Photos
> will not be available offline. This is a known and accepted limitation.

---

## Q: What is the true source of truth?

> During recording, it should be SQLite. After sync, Convex becomes the shared/server
> copy, but the local copy still needs to remain usable offline. Be very clear when
> data is local-only, synced, failed, or stale.

**A:** Every walk and its associated data has an explicit sync lifecycle. The device is
always the origin; Convex is the destination. The rule is:

- **During recording:** SQLite is the only truth. No Convex writes happen until the
  walk is completed and explicitly synced.
- **After a successful sync:** Convex holds the canonical shared copy. The local row
  remains and is the source for all local reads (review, replay, follow). The
  `convex_id` field links the two.
- **If sync is in progress or failed:** Local data is used for all reads. The
  `syncJobs` table tracks the state.

Every walk row should carry a derivable sync status, readable from `syncJobs`:

| Status | Meaning |
|---|---|
| `local-only` | No sync job exists yet (in-progress recording) |
| `pending` | Sync job created, not yet started |
| `in-progress` | Actively uploading |
| `synced` | Convex ID confirmed, all data uploaded |
| `failed` | Last attempt errored — will retry |

The UI should surface this status on walk cards so the user knows which walks are
cloud-backed.

---

## Q: Are raw GPS points immutable?

> I would treat raw trackPoints as append-only. Cleaning, simplification, stats, and
> replay routes should be derived from them, not replace them.

**A:** Agreed. Raw track points are **append-only and never mutated**. The `isClean`
flag is an annotation added during post-processing — it marks a point as having passed
accuracy and outlier filters but does not alter the point itself.

Consequences of this rule:
- Re-running the cleaning algorithm is always safe (just re-set `isClean` flags).
- If the algorithm improves, all historical walks can be reprocessed without data loss.
- Deleted or overwritten points are gone forever — this rule prevents that.

The only legitimate write to a track point row after initial insert is setting
`isClean` (once, during post-processing). Everything else is read-only.

---

## Q: Should `isClean` be enough, or do you need a derived route table?

> For MVP, isClean is probably fine. But later you may want a derived representation
> so review and replay don't always depend on thousands of track points.

**A:** `isClean` is sufficient for MVP. However, one lightweight addition is
worthwhile now: add a `display_polyline_json` text field to the `walks` table (and
the Convex `walks` schema).

This field stores a simplified/decimated version of the clean track — perhaps 100–300
points rather than the full 2,000–10,000 raw points — computed once during
post-processing using the Ramer-Douglas-Peucker algorithm.

Benefits:
- Review and map rendering read from `display_polyline_json` (fast, small)
- Replay still reads from full clean track points (accurate)
- The field is nullable — absent means "not yet computed, fall back to clean points"
- No new table required; no foreign keys; no join
- Recomputable at any time from raw points

This is **not** a new table; it is a stored derived value. Add it now before the walk
count grows, because backfilling it on historical data is straightforward when the
algorithm is applied during the next sync or post-processing pass.

---

## Q: How will sync be idempotent?

> Retried uploads must not create duplicate walks, duplicate points, or duplicate
> photos. Local IDs, deviceId, convex_id, and maybe client-generated stable IDs need
> a clear strategy.

**A:** Every entity gets a **stable client-generated UUID at creation time** that
travels with it through the entire sync lifecycle. The Convex mutation always uses
upsert semantics keyed on this ID.

| Entity | Stable key | Convex upsert strategy |
|---|---|---|
| Walk | `deviceId + localUUID` stored in `walks.device_id + walks.id` | `createOrReturnExisting(deviceId, localId)` — if a walk with this device+id pair exists, return its Convex ID, do not create a duplicate |
| Track point | `(walkConvexId, timestamp)` | Batch insert ignores duplicates: `INSERT OR IGNORE` keyed on `(walkId, timestamp)` |
| Photo | `(walkConvexId, timestamp)` | Same pattern — `(walkId, timestamp)` is the natural unique key |

The sync job stores the Convex walk ID once walk creation succeeds, so subsequent
retries of point or photo upload use the known ID rather than attempting walk creation
again.

The Convex `createWalk` mutation should return the existing walk document if the
`(deviceId, localId)` pair is already present — this is the single idempotency gate
for the entire sync chain.

---

## Q: What happens to failed or partial syncs?

> If walk creation succeeds, points partly upload, then photos fail, can the next sync
> safely resume?

**A:** Yes, because the sync job tracks phase completion and all operations are
idempotent. The recommended approach is **phased resumable upload**:

```
Phase 1: Create walk record on Convex  →  store convex_id locally
Phase 2: Upload track points in batches  →  store uploaded_points_count locally
Phase 3: Upload photo metadata (storage IDs from separate blob upload)
Phase 4: Mark sync job completed
```

Each phase is independently retryable because:
- Phase 1 is idempotent (upsert on deviceId+localId)
- Phase 2 is idempotent (INSERT OR IGNORE on walkId+timestamp)
- Phase 3 is idempotent (same)

The `syncJobs` table should add `phase` (int 1–4) and `uploaded_points_count` fields
so an interrupted job resumes from the right phase and batch offset without
re-uploading what already landed.

On app launch: any `syncJobs` row with status `in_progress` is reset to `pending`
(it means the app crashed mid-upload). `failed` jobs are retried with exponential
backoff.

---

## Q: Are photos anchored strongly enough?

> A photo should keep timestamp, coordinate, local URI, storage ID after sync, and
> ideally nearest/interpolated track position.

**A:** The current local SQLite `walk_photos` table is missing `nearest_track_point_id`
— it exists in the Convex schema but was not carried into the local schema. This
should be added.

Full set of fields a photo row needs:

| Field | Purpose |
|---|---|
| `timestamp` | Primary temporal anchor for replay timeline |
| `latitude / longitude` | Spatial anchor (captured at shot time by GPS) |
| `local_uri` | File path on device for offline thumbnail display |
| `convex_id` | Links to Convex document after sync |
| `storage_id` | Convex file storage handle for full-res download |
| `nearest_track_point_id` | Pre-computed index into track for fast replay positioning |
| `caption` | User annotation |

`nearest_track_point_id` is computed during post-processing by finding the track
point whose timestamp is closest to the photo's timestamp. Storing it avoids a linear
search through thousands of points every time the review timeline renders.

Photo blobs are **never stored locally** beyond the original capture URI. If the
device photo library is cleared, the preview disappears offline. This is the accepted
limitation stated at the top of this document.

---

## Q: Do you need privacy controls baked into the model now?

> Walks can reveal home locations. Consider start/end trimming or private visibility
> without refactoring later.

**A:** Yes — add three fields to `walks` now, before any sharing features exist:

```sql
visibility      TEXT    NOT NULL DEFAULT 'private'  -- 'private' | 'shared' | 'public'
trim_start_m    INTEGER NOT NULL DEFAULT 0           -- metres to hide from start
trim_end_m      INTEGER NOT NULL DEFAULT 0           -- metres to hide from end
```

- `visibility` defaults to `'private'` — a walk is never public unless the user
  explicitly changes it. Safer than the `plannedRoutes` default.
- `trim_start_m` / `trim_end_m` allow the user to hide the first and last N metres
  before sharing, preventing home address leakage. These are display-layer hints: raw
  points remain intact, but review, replay, and any public rendering clip the visible
  polyline.
- No privacy feature needs to be built now; these fields just reserve the space so
  adding privacy UI later is a non-breaking change.

---

## Q: Should follow sessions mutate the source walk?

> No. Follow session purity principle: replay/follow activity should never alter the
> original recorded walk.

**A:** Correct. The principle stands. A `followSession` holds its own `startedAt`,
`endedAt`, stats, and off-route events. The source walk (`walkId` foreign key) is
read-only from the follow session's perspective.

One clarification: the source of truth for a follow session's route geometry is the
source walk's clean track points. If `display_polyline_json` is present it is used
for rendering the reference line; otherwise clean track points are queried directly.
Neither is mutated by the follow session.

---

## Q: Where do derived stats live, and can they be recalculated?

> Store stats on walks, but include versioning to know which algorithm produced them.

**A:** Stats live in the `stats` JSON blob on the `walks` row (current approach is
correct). Add one integer field alongside it:

```sql
stats_version   INTEGER   -- NULL = not yet computed; increment when algorithm changes
```

When the stats calculation improves (better elevation smoothing, more accurate
moving-time detection), increment the version constant in the app. A background job
can then find all walks where `stats_version < CURRENT_STATS_VERSION` and recompute
from raw points.

This costs one integer column today and saves a potentially painful migration later
when there are thousands of walks with inconsistent stats.

---

## Q: Are you optimising for MVP or future scale too early?

> Avoid overbuilding. The current core tables are a good MVP boundary.

**A:** The right line is: **add cheap forward-looking fields now; defer new tables
until there is a concrete need.**

Cheap fields to add now (one-line schema additions, zero behavioural change):
- `display_polyline_json` on `walks` — derived display route
- `stats_version` on `walks` — algorithm versioning
- `trim_start_m` / `trim_end_m` / `visibility` on `walks` — privacy
- `nearest_track_point_id` on `walk_photos` — replay positioning
- `phase` / `uploaded_points_count` on `syncJobs` — resumable upload

**Defer** until there is a real use case:
- A separate `displayRoutes` or `routeSegments` table
- Delta sync for track points
- Multi-device conflict resolution
- Real-time follow features

The core table set — `walks`, `trackPoints`, `walkPhotos`, `syncJobs`,
`followSessions`, `offRouteEvents`, `plannedRoutes`, `explore_routes`,
`explore_region_cache` — is the right MVP boundary.

---

## Biggest Recommendation

Keep the **four conceptual layers** clearly named in code even though storage is flat:

| Layer | What it is | Where it lives |
|---|---|---|
| **Raw walk** | Everything the GPS recorded | `trackPoints` (all rows for a walk) |
| **Clean walk** | Filtered, accuracy-checked points | `trackPoints WHERE isClean = 1` |
| **Display route** | Decimated polyline for fast rendering | `walks.display_polyline_json` |
| **Planned route** | User-designed route for Explore/Follow | `plannedRoutes` / `explore_routes` |

These four things should never share a variable name or be silently substituted for
each other in code. Clear naming now prevents subtle bugs when the app gains features
that depend on the distinction (e.g. showing the planned route alongside the actual
walked route in a post-walk review screen).
