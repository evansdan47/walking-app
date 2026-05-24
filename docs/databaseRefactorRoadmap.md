# Database Refactor — Implementation Roadmap

> Consolidated from `databaseRefactor.md`, `databaseRefactorQuestions.md`, and
> `additionalQuestions.md`. This is the authoritative implementation plan.
> Written May 2026.

---

## Guiding Principles

1. **SQLite is the primary read path.** Convex is the write destination and shared
   copy. The app never waits for a Convex response to show the user their own data.

2. **Four conceptual layers — never conflate them in code:**

   | Layer | What | Storage |
   |---|---|---|
   | **Raw walk** | Every GPS point as recorded | `track_points` (all rows) |
   | **Clean walk** | Accuracy-filtered points | `track_points WHERE is_clean = 1` |
   | **Display route** | Decimated polyline for rendering | `walks.display_polyline_json` |
   | **Planned route** | User-designed route for Explore/Follow | `planned_routes` / `explore_routes` |

3. **Photo failure must never block anything.** Walk sync, review, replay, and follow
   work regardless of photo upload state.

4. **Prefer camera roll as user-owned storage.** If MediaLibrary permission is
   unavailable, use the app's temp cache as best-effort pending-upload storage.
   The app never permanently manages its own blob copy on device.

5. **All writes are idempotent.** Every entity has a stable client-generated UUID.
   Retried uploads never create duplicates.

---

## Naming Decisions

| Old name | New name | Reason |
|---|---|---|
| `local_uri` on `walk_photos` | `local_asset_uri` | Distinguishes OS asset URI from an app-managed file path |
| `status` on `sync_jobs` | `core_sync_status` | Separates walk core sync from photo sync |
| *(new)* | `photo_sync_status` on `sync_jobs` | Explicit photo upload lifecycle |
| *(implicit (walkId, timestamp) photo key)* | `id` UUID (`photo_local_id` in logic) | Stable, collision-free, idempotent upload key |

---

## Schema Changes

### 1. Existing table: `walk_photos`

Migrations to add via `ALTER TABLE ... ADD COLUMN` (idempotent try/catch pattern):

```sql
-- Rename handled by adding new column and deprecating old one
-- (SQLite has no RENAME COLUMN before 3.25; use ADD + copy on first read)
ALTER TABLE walk_photos ADD COLUMN local_asset_uri TEXT;
ALTER TABLE walk_photos ADD COLUMN photo_status TEXT NOT NULL DEFAULT 'local_only';
  -- CHECK: 'local_only' | 'upload_pending' | 'uploaded' | 'upload_failed' | 'upload_skipped'
ALTER TABLE walk_photos ADD COLUMN nearest_track_point_id TEXT;
```

`local_asset_uri` should be populated from `local_uri` on first read until the column
is fully migrated. Once all app versions that write `local_uri` are retired, drop the
old column (future).

### 2. Existing table: `sync_jobs`

```sql
ALTER TABLE sync_jobs ADD COLUMN core_sync_status TEXT NOT NULL DEFAULT 'pending';
  -- CHECK: 'pending' | 'in_progress' | 'synced' | 'failed'
ALTER TABLE sync_jobs ADD COLUMN photo_sync_status TEXT NOT NULL DEFAULT 'none';
  -- CHECK: 'none' | 'pending' | 'partial' | 'synced' | 'failed'
ALTER TABLE sync_jobs ADD COLUMN phase INTEGER NOT NULL DEFAULT 1;
  -- 1 = create walk, 2 = upload points, 3 = upload photos, 4 = complete
```

The existing `status` column is kept for backwards compatibility during the transition.
New code reads `core_sync_status`; old code reading `status` continues to work until
all paths are updated.

### 3. Existing table: `walks`

```sql
ALTER TABLE walks ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private';
  -- CHECK: 'private' | 'shared' | 'public'
ALTER TABLE walks ADD COLUMN trim_start_m INTEGER NOT NULL DEFAULT 0;
ALTER TABLE walks ADD COLUMN trim_end_m INTEGER NOT NULL DEFAULT 0;
ALTER TABLE walks ADD COLUMN stats_version INTEGER;
  -- NULL = not yet computed; increment app constant to trigger recompute
ALTER TABLE walks ADD COLUMN display_polyline_json TEXT;
  -- Nullable; decimated clean polyline (~100-300 pts); recomputable from track_points
ALTER TABLE walks ADD COLUMN display_polyline_version INTEGER;
  -- NULL = not yet computed; increment app constant to trigger recompute
```

### 4. New table: `explore_routes`

Cached public routes for the Explore tab. Keyed by region so stale regions can be
invalidated without touching unrelated data.

```sql
CREATE TABLE IF NOT EXISTS explore_routes (
  id              TEXT PRIMARY KEY NOT NULL,   -- Convex document _id
  region_key      TEXT NOT NULL,               -- "{floor(lat/2)*2}:{floor(lng/2)*2}"
  title           TEXT NOT NULL,
  description     TEXT,
  author_id       TEXT NOT NULL,
  visibility      TEXT NOT NULL,
  distance_km     REAL,
  elevation_gain_m REAL,
  centroid_lat    REAL NOT NULL,
  centroid_lng    REAL NOT NULL,
  legs_json       TEXT NOT NULL,               -- full route geometry
  created_at      INTEGER NOT NULL,
  cached_at       INTEGER NOT NULL             -- local epoch ms; used for TTL checks
);

CREATE INDEX IF NOT EXISTS idx_explore_routes_region ON explore_routes(region_key);
CREATE INDEX IF NOT EXISTS idx_explore_routes_centroid ON explore_routes(centroid_lat, centroid_lng);
```

### 5. New table: `explore_region_cache`

Tracks which regions have been synced and when, so the sync engine knows whether to
re-fetch a region without scanning `explore_routes`.

```sql
CREATE TABLE IF NOT EXISTS explore_region_cache (
  region_key      TEXT PRIMARY KEY NOT NULL,
  route_count     INTEGER NOT NULL DEFAULT 0,
  content_hash    TEXT,                        -- "{count}_{maxCreatedAt}" from Convex; NULL = never fetched
  last_checked_at INTEGER,                     -- epoch ms of last hash check; NULL = never checked
  last_synced_at  INTEGER                      -- epoch ms of last full region fetch; NULL = never synced
);
```

---

## Implementation Phases

### Phase 1 — Schema migrations (no behaviour change)

Apply all `ALTER TABLE` additions above to `lib/db/client.ts` using the existing
try/catch idempotent pattern. No logic changes; no UI changes.

**Files:** `lib/db/client.ts`

**Done when:** App launches without error; all new columns present.

---

### Phase 2 — Explore offline-first sync engine

> **Priority:** This is the urgent fix. The 175+ Convex calls/min happen here.

Build the new local-first infrastructure for the Explore tab, backed by
`explore_routes` / `explore_region_cache`.

#### 2a — Region utilities

`lib/explore/region.ts` — pure functions, no I/O:

```ts
const CELL_DEGREES = 2.0;

// Cell key for a coordinate: "{floor(lat/2)*2}:{floor(lng/2)*2}"
function coordToCell(lat: number, lng: number): string

// Centroid of a route's legs
function computeCentroid(legs: Leg[]): { lat: number; lng: number }

// All cell keys covered by a viewport
function viewportToCells(bounds: ExploreViewBounds): string[]
```

#### 2b — New Convex functions

`convex/explore_routes.ts`:

```ts
// Returns { regionKey: string, hash: string }[] for requested region keys
export const getRegionHashes = query(...)

// Returns full route documents for a single region key
export const listPublicByRegion = query(...)
```

#### 2c — Sync engine

`lib/explore/sync-engine.ts`:

```
For each cell key in viewport:
  1. Check explore_region_cache — if last_checked_at < now - 1hr, call getRegionHashes
  2. Compare returned hash to stored content_hash
  3. If hash changed (or no cache row): call listPublicByRegion, upsert into explore_routes,
     update explore_region_cache
  4. If hash unchanged: mark last_checked_at = now (no fetch needed)
```

Hash format: `"{count}_{maxCreatedAt}"` — cheap to compute on Convex, detects most
insert/delete changes. Known blind spots: (1) a simultaneous delete + insert of a
route whose `createdAt` is equal to or older than the deleted one; (2) edits to a
route's title, description, or geometry do not change count or `maxCreatedAt`.
Edited routes may not appear updated until a forced refresh or full re-sync, unless
the hash strategy is upgraded. Good enough for MVP — do not overclaim in code comments.

#### 2d — Hook

`hooks/use-explore-data.ts`:

```ts
function useExploreData(bounds: ExploreViewBounds | null): {
  routes: PlannedRoute[];
  isSyncing: boolean;
  lastSyncedAt: number | null;
}
```

Reads from `explore_routes` SQLite only. Triggers sync engine in the background when
bounds change. No Convex `useQuery` calls.

**Done when (2a–2d):** `useExploreData` hook exists and reads from SQLite correctly
in isolation (can be tested with manually seeded `explore_routes` rows).

---

### Phase 3 — Remove Explore Convex subscriptions

With the new hook in place, update `ExploreSheetContent`:

- Replace both `useQuery(listWithinBounds)` and `useQuery(listNearest)` with
  `useExploreData(viewBounds)`.
- Remove the `committedMode` state machine entirely — the hook always has local data.
- Delete `convex/planned_routes.ts` `listWithinBounds` and `listNearest` once no
  other callers remain.

**Files:** `components/explore/explore-sheet-content.tsx`, `convex/planned_routes.ts`

**Done when:** Explore tab shows routes from SQLite; Convex function call rate drops
to ~1 hash check per region per hour; no skeleton flash on pan/zoom.

---

### Phase 4 — `syncJobs` status separation

Migrate sync engine to write `core_sync_status` and `photo_sync_status` separately:

- Walk is surfaced to the user as `synced` when `core_sync_status = 'synced'`
- UI shows **"photos pending"** badge when `photo_sync_status IN ('pending', 'partial')`
- UI shows **"photo upload issue"** badge when `photo_sync_status = 'failed'`

Phased upload sequence:
```
phase 1: createWalk mutation → store convex_id → core_sync_status = 'in_progress'
phase 2: batch upload track_points (idempotent — INSERT OR IGNORE on walkId+timestamp)
phase 3: upload photos → update photo_sync_status per result
phase 4: finalise → core_sync_status = 'synced'
```

All phases are idempotent. Resumption re-runs from the stored `phase` value; batch
upload re-sends all points for the walk and the server discards duplicates. No
count-based bookkeeping is relied upon for correctness.

**Files:** `lib/sync/` (sync engine), walk card UI.

**Done when:** Walk card shows correct sync status; photo failure leaves walk accessible.

---

### Phase 5 — Photo layer cleanup

Update the photo capture flow:

1. **Camera permission** — required to open the camera. If refused, the photo button
   is disabled. Recording continues unaffected.

2. **MediaLibrary permission** — required to save to the camera roll. If refused,
   photos can still be captured but are stored only in the app's temp cache (not the
   gallery). Show an in-context explanation; do not block recording.

3. Write `local_asset_uri` (not `local_uri`) on capture.

4. Set `photo_status = 'local_only'` on capture.

5. After Convex upload: set `photo_status = 'uploaded'`, populate `storage_id`.

6. On asset-not-found during upload: set `photo_status = 'upload_skipped'`, continue sync.

7. On upload network error: set `photo_status = 'upload_failed'`, schedule retry.

**Files:** Photo capture component, sync engine photo phase, review photo renderer.

**Done when:** Review correctly shows local thumbnail / network fallback / placeholder
based on `photo_status`; neither permission refusal nor upload failure blocks
`core_sync_status`.

---

### Phase 6 — `display_polyline_json` backfill

After recording + sync flows are stable, add a background job that:

1. Finds walks where `display_polyline_json IS NULL` or `display_polyline_version < CURRENT_DISPLAY_VERSION`
2. Reads clean track points for each walk
3. Runs Ramer-Douglas-Peucker decimation
4. Writes result to `walks.display_polyline_json` and sets `display_polyline_version`

This is a one-time background pass triggered on app resume, not a blocking operation.

**CURRENT_STATS_VERSION** and **CURRENT_DISPLAY_VERSION** are app-level constants.
Increment them independently to trigger targeted reprocessing.

---

### Phase 7 — Own routes in Explore

**Scope:** Public *planned routes* (the `planned_routes` table) first. Public recorded
walks appearing in Explore is a separate, later feature — the conceptual layers are
different and should not be conflated.

For planned routes: own public planned routes are upserted into `explore_routes` via
two triggers:

1. **Immediately on planner save/publish** — when the user saves or publishes a
   planned route, write it directly to `explore_routes` locally. Do not wait for the
   next region sync. This ensures the user sees their own route appear in Explore
   without a delay.

2. **During region sync** — the sync engine also upserts own routes for the checked
   regions, so the local cache stays consistent even if trigger 1 was missed (e.g.
   after reinstall).

Both paths write idempotently (upsert on `id`). Own routes appear alongside community
routes with no special treatment in the hook.

For recorded public walks in Explore: defer until planned routes are stable. When
built, join `walks WHERE visibility = 'public'` at read time in `useExploreData`
rather than duplicating walk rows into `explore_routes`.

---

## What Gets Removed

| Thing | Replaced by |
|---|---|
| `useQuery(listWithinBounds)` in ExploreSheetContent | `useExploreData` hook reading SQLite |
| `useQuery(listNearest)` in ExploreSheetContent | Same |
| `committedMode` state machine | No longer needed — hook always has local data |
| `convex/planned_routes.ts` `listWithinBounds` function | `convex/explore_routes.ts` `listPublicByRegion` |
| `convex/planned_routes.ts` `listNearest` function | `convex/explore_routes.ts` `getRegionHashes` + batch fetch |

---

## Convex Cost Model (after Phase 3)

| Scenario | Current calls/hr | After refactor calls/hr |
|---|---|---|
| User browses Explore for 1 hr | ~5,000–10,000 | ~4–12 (one hash check per visible cell, refreshed at most hourly) |
| User pans map 50 times | 50 × 2 subscriptions = 100 | 0 additional (served from SQLite cache) |
| Route added by another user | Picked up at next hash check (≤1 hr) | — |

Estimated reduction: **~100–200×** fewer Convex function calls.

---

## Migration Safety Rules

- Every `ALTER TABLE` is wrapped in try/catch. Idempotent on re-run.
- New columns always have a `DEFAULT` value so existing rows are valid immediately.
- `local_uri` is not dropped until all app versions that write it are retired.
- `status` on `sync_jobs` is not dropped until all read paths use `core_sync_status`.
- No destructive migration runs without a data backup checkpoint.
