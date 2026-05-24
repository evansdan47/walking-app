# Explore Database Refactor — Problem Analysis

> Written May 2026, before designing the replacement architecture.
> The goal is to be honest about every flaw in the current approach so the
> new design avoids repeating the same mistakes.

---

## Current Numbers (8 routes in production)

| Metric | Value |
|---|---|
| Total routes in DB | 8 |
| Estimated total route data size | ~200–400 KB |
| Observed Convex DB I/O | ~50 MB / hour during active use |
| Peak function calls | 175+ `listNearest` calls in a single minute |
| Peak `listWithinBounds` calls | 78 calls in same minute |

The DB I/O is roughly 100–200× what it should be for the data volume.

---

## Root Problem: Convex Subscriptions Are Driven by Viewport Changes

Every time the user pans or zooms the map, the parent component (`index.tsx`) emits
a new `viewBounds` object after a 700 ms debounce. This flows into
`ExploreSheetContent`, which calls `useQuery(listWithinBounds, viewBounds)`.

Because `useQuery` is a **live subscription**, changing the arguments drops the old
subscription and creates a new one, which causes Convex to execute the query function
on the server immediately and on every subsequent DB write.  Panning across a map
(even slowly) generates a continuous stream of new subscriptions.

The 700 ms debounce only partially helps — at normal panning speed it still fires 10–20
new subscriptions per minute.

---

## Problem List

### 1. Double Subscription Race Condition (the immediate spike)

`ExploreSheetContent` runs two queries: `listWithinBounds` and `listNearest`.
The decision of which one to skip was controlled by `committedModeRef` — a React ref.

**The bug**: both `useQuery` calls are in the same render function. `listWithinBounds`
reads the ref **before** the inline stabilisation code. That inline code then mutates
the ref to `'nearest'`. By the time `listNearest` evaluates its skip condition, the ref
has already changed. Result: **both queries subscribe simultaneously in the same render.**

This caused the 78 + 175 = 253 calls visible in the dashboard during a single minute.

A partial fix was applied (promoting `committedMode` to `useState`) but the underlying
model — two competing server subscriptions managed by a state machine — is still fragile.

### 2. Every Pan Creates a New Server Round-Trip

The data does not change between pans. The 8 routes existed before the session started
and will exist after it ends. Yet every viewport change discards the old subscription
and fetches the same routes again from Convex's database.

There is no client-side cache that persists across subscriptions.  Convex's reactive
cache only lives as long as the subscription argument stays identical.

### 3. `listNearest` Is an Expensive Fallback for a Cheap Problem

When `listWithinBounds` returns fewer than 5 routes, a second query (`listNearest`)
fires to find the closest routes globally using haversine distance.

This query has no spatial index.  It reads **all public routes** from the DB, computes
distances in the Convex function, then sorts and slices.  With 8 routes today that is
trivial; at 10,000 routes it would be a full table scan on every sparse-area pan.

The fallback exists purely because the client throws away data (previous area's routes)
the moment the viewport changes.  If routes were cached locally, "nearest" would be a
free `ORDER BY distance LIMIT 5` on the device.

### 4. Route Data Is Large and Transmitted Repeatedly

Each `plannedRoute` document contains a `legs` array of GPS coordinate arrays.  A
modest 10 km route with ~1,000 points is 50–100 KB of JSON.  This data is:

- Re-transmitted on every new subscription (every debounced pan)
- Transmitted twice when both queries fire simultaneously (problem 1)
- Transmitted to both `ExploreSheetContent` **and** `ExploreMapLayer` independently
  (the map layer had its own `useQuery` until it was removed in a previous fix)

The same bytes are sent over the wire 10–20 times per minute for data that hasn't
changed since the session started.

### 5. No Offline Support

`ExploreSheetContent` has no offline fallback.  If the device loses connectivity
mid-walk (which is common on a walking app) the Explore tab shows nothing.  The
entire feature requires an active Convex websocket.

This is particularly bad because the primary use case — looking up nearby routes while
deciding which walk to do — is exactly when the user may be in a low-signal area.

### 6. Auth Token Refresh Causes Transient Empty Results

When Clerk refreshes the auth token, Convex briefly loses the auth context.  During
this window, `listWithinBounds` returns `[]` (empty — it only returns public routes
for authenticated users, or the auth guard rejects the request).

This caused the route list to flash empty during normal use.  A workaround was added
(`lastInBoundsRef` with filtering logic that ignores shrinking result sets) but it is
complex and fragile — it had to distinguish "auth oscillation" from "user panned to a
genuinely empty area."

This complexity exists solely because the data is fetched live rather than cached.

### 7. The `committedMode` State Machine Is Overly Complex

To avoid running both queries simultaneously, a state machine was introduced:

```
null → (routes arrive, < 5) → 'nearest'
null → (routes arrive, >= 5) → 'inbounds'
any → (viewBounds changes) → null
```

This state machine exists solely to manage which of the two Convex subscriptions is
active.  It has been the source of multiple bugs:

- Originally a `useRef` that caused the double-subscription race (problem 1)
- Promoted to `useState` which introduced a 1-render delay before `listNearest` starts
- The viewBounds reset (`setCommittedMode(null)` during render) relies on React's
  "derived state during render" pattern, which is poorly documented and rarely used
- `isInitialLoad`, `isFetching`, `knownRoutes`, `knownNearest`, `routesSkipped`,
  `seenInitialLoadRef`, `restLoadingPendingId` — all of this complexity stems from
  managing two competing server subscriptions

### 8. The Debounce Is a Symptom, Not a Fix

The 700 ms debounce in `index.tsx` was added specifically to reduce Convex call
frequency.  Without it, every scroll gesture fires a new subscription.

It introduces a visible 700 ms lag between the user stopping their pan and the route
list updating.  It also interacts badly with skeleton feedback: the skeleton appears
immediately on card tap but the query doesn't start for 700 ms, so there is a window
where skeletons are shown but `isFetching` is still false.

A second timer (1500 ms fallback) was added to clear stale skeletons in cases where
the debounce doesn't trigger an `isFetching` cycle.

Both timers are band-aids on the real problem: server queries should not be the primary
mechanism for browsing static data.

### 9. Scaling Is Broken by Design

The `listWithinBounds` query uses four inequality filters (`minLat ≤ lat ≤ maxLat`,
`minLng ≤ lng ≤ maxLng`).  Convex indexes support at most one inequality filter per
query; the current implementation is a filtered scan of all public routes.

At 8 routes this is fine.  At 10,000 routes, every pan executes a full table scan on
the `plannedRoutes` table.  There is no path to adding a spatial index in Convex that
would make this query efficient without a schema redesign.

### 10. Costs Scale With User Count, Not Data Size

With the current architecture, each active user session generates a continuous stream
of Convex function invocations (one per debounced pan).  DB I/O scales as:

```
cost ∝ (users × pans_per_session × route_data_size)
```

With 1 user and 8 routes, the cost is already ~50 MB/hour.  With 100 concurrent users
it would be ~5 GB/hour — for a dataset that is a few hundred KB.

---

## Summary

The core mistake is using **reactive server subscriptions as a spatial query engine**
for data that:

- Changes rarely (routes are created infrequently)
- Is relatively small (a few hundred KB for a region)
- Is the same for all users (public routes)
- Needs to work offline (walking app, poor signal areas)

The right model is a **download once, browse locally** approach:  fetch route data
for a geographic region once, store it in the on-device SQLite database, and browse
it entirely without network calls.  Only check the server when the user explicitly
refreshes, or when a lightweight hash check reveals that new routes have been added.

---

## UX Requirements

> These define what the *user* should experience, independent of implementation.
> They are the acceptance criteria for the replacement architecture.

### 1. Browsing Must Feel Instant

- Scrolling the route list and panning the map must never stall waiting for a network
  response. All browsing operates against data already on the device.
- The bottom sheet route list must populate immediately when the Explore tab is opened,
  with no skeleton loading state, provided the user has visited this region before.
- Map pins and polylines must render from local data at the same speed as the rest of
  the map tiles — no async gap between tiles appearing and route pins appearing.
- Cluster pins (zoom < 11) and individual pins (zoom ≥ 11) must switch instantly on
  zoom, with no re-fetch.

### 2. The User's Own Routes Are Always Immediately Visible

- A user's own routes (private and public) are stored locally the moment they are
  created in the planner. They appear in the Explore list and on the map without any
  server round-trip.
- If the user edits a route's title, description, legs, or visibility, the change
  appears immediately in the Explore view.
- Own routes are visually distinguishable from public routes authored by others
  (e.g. a subtle badge or different pin colour — to be designed).
- Own routes remain visible even when the device is fully offline.

### 3. New Public Routes Appear in a Timely Manner (Not Necessarily Instantly)

- When a user publishes a route (changes visibility to "public"), there is no
  expectation that it appears in other users' Explore views immediately. A delay of up
  to the region's sync timeout (default: 1 hour) is acceptable.
- The author sees their newly published route immediately in their own view (rule 2).
- Other users see it at their next background sync for that region.

### 4. Direct Route Sharing Is Immediate

- If user A explicitly shares a specific route with user B (via a deep link, share
  sheet, or in-app invite — future feature), user B must be able to view that route
  immediately by ID, bypassing the region cache entirely.
- This is a targeted fetch of a single document, not a region sync.
- The fetched route is saved to the local DB so subsequent views are offline.

### 5. Background Sync Is Invisible to the User

- Hash checks and route downloads happen on a background thread and must not cause
  any jank, list flicker, empty-state flash, or skeleton re-appearance.
- When new routes arrive from a background sync, they are inserted into the local DB
  and the list updates smoothly — new cards appear at the correct sort position without
  the whole list rebuilding.
- If a sync is in progress, no loading indicator is shown unless the user explicitly
  triggered it (pull-to-refresh). A subtle, non-blocking indicator (e.g. a small
  spinner in the sheet header) is acceptable for user-triggered syncs only.
- A failed sync (no network, server error) must never degrade the browsing experience.
  The user sees cached data as normal; the sync silently retries later.

### 6. Region Sync Cadence (Hash-Check Throttling)

- When the user browses a region cell for the first time: download all public routes
  for that cell immediately.
- On subsequent visits: check the region hash against the stored hash **only if**
  the time since the last successful hash check exceeds the configured timeout.
  - Default timeout: **1 hour**
  - Timeout must be adjustable via a constant (not hard-coded deep in logic) so it can
    be tuned based on content update frequency.
- If the hash is unchanged: update the `lastCheckedAt` timestamp for the cell, do not
  download anything.
- If the hash has changed: download only the updated region (full region re-download
  is acceptable at current scale; delta sync can be added later).
- Hash checks are cheap (one lightweight Convex function call returning a short string).
  They should not count as "a sync" in the user's mental model — they are invisible.

### 7. Pull-to-Refresh Forces an Immediate Sync

- A pull-to-refresh gesture on the Explore sheet triggers an immediate hash check for
  all currently visible region cells, ignoring the 1-hour timeout.
- If new routes are found they download and appear before the refresh spinner stops.
- If no new routes are found the spinner stops after the hash check completes (fast).
- This is the user's escape hatch when they know a new route was just published and
  don't want to wait for the timeout.

### 8. Offline State Is Handled Gracefully

- The Explore tab must be fully functional (browse, view detail, start walk) with no
  internet connection, using cached data.
- If the device is offline and a region has never been downloaded, show an appropriate
  empty state: "No routes cached for this area. Connect to the internet to download."
  (Not a generic error or blank screen.)
- The offline/cached indicator should be subtle — a small icon or faded "Cached" label
  in the sheet header. It must not dominate the UI.

### 9. Route Detail and Start Walk Are Never Blocked by Network

- Tapping a route card to view its detail (stats strip, description, legs, waypoints)
  must work instantly from local data. No fetch required.
- Tapping "Start Walk" must be able to begin navigation immediately. The full route
  geometry (all leg points) must be available locally before the route is shown in the
  list — it is downloaded as part of the region sync, not on demand.

### 10. The Planner Always Reflects the Latest Own Routes

- The route planner (plan tab) loads the user's own routes from the local DB instantly.
- When a new route is saved in the planner, it appears in the Explore list on the next
  render without a visible transition delay.

### 11. Sort Order and Filtering Are Local Operations

- Sorting routes (e.g. by date, distance, difficulty — future feature) must be
  performed by a local SQLite query, not a server round-trip.
- Filtering by distance from current location (the current "nearest" fallback) becomes
  a free `ORDER BY distance ASC` SQL query once routes are in the local DB.

### 12. Existing UI Elements Must Continue to Work Correctly

The following behaviours from the current UI must be preserved:

| Element | Required behaviour |
|---|---|
| Route list cards | Show title, distance, elevation, est. time, difficulty, date — all from local data |
| Skeleton cards | Only shown on first-ever download of a region (never on subsequent visits) |
| Highlighted route card | Pinned to top of list, camera flies to route — no change |
| Route detail panel | Stats strip, description, leg list, waypoint count — from local data |
| Start Walk button | Begins a follow session immediately — geometry available locally |
| Edit Route button | Opens planner with local route data |
| Map pins (zoom ≥ 11) | Individual coloured pins per route start point — from local data |
| Cluster pins (zoom < 11) | Greedy clustering algorithm unchanged — runs on local data |
| Cluster tap → zoom in | Camera behaviour unchanged |
| Route polyline | Shown on card tap — geometry available locally |
| "No routes here" empty state | Shown when local DB has no routes for the current viewport |
| Sheet header subtitle | e.g. "8 routes in view" — count from local query |

---

## Proposed Solution: Offline-First with Region-Keyed SQLite Cache

### Guiding Principle

> The device is the database. Convex is the origin server.

Route browsing reads exclusively from on-device SQLite. Convex is contacted only to
check whether anything has changed (a cheap hash comparison) and to deliver a batch
download when it has. Between syncs, the server is never touched.

---

### Part 1 — The Region Grid

The world is divided into a regular lat/lng grid. Each cell is identified by snapping
its south-west corner to the nearest grid boundary.

```
CELL_DEGREES = 2.0   (configurable constant — reduce as route count grows)

cell_key = "{floor(lat / CELL_DEGREES) * CELL_DEGREES}:{floor(lng / CELL_DEGREES) * CELL_DEGREES}"

Examples:
  Edinburgh  (55.95°N,  3.19°W) → "54:-4"
  London     (51.50°N,  0.12°W) → "50:-2"
  Manchester (53.48°N,  2.24°W) → "52:-4"
  Berlin     (52.52°N, 13.40°E) → "52:12"
```

At `CELL_DEGREES = 2`, a typical phone screen (covering roughly 0.3° × 0.5°) sits
entirely within one cell most of the time. Panning a full city will cross at most one
cell boundary per direction. The entire UK is covered by approximately 30 cells.

Each public route is assigned to exactly one cell based on its **centroid** — the
average lat/lng of all points across all its legs. This is a pure function of the
route data; no schema change is required on the server.

```
centroid = average of all { lat, lng } across route.legs[*].points[*]
cell_key  = routeToCell(centroid)
```

A shared utility `lib/explore/region.ts` exports `computeCentroid(legs)` and
`routeToCell(centroid)` so both the app and Convex functions use identical logic.

---

### Part 2 — Local SQLite Schema

Two new tables are added to the existing `lib/db/client.ts` setup.

#### `explore_routes`

Stores all route data needed for browsing, detail view, map rendering, and starting a
walk. Contains both downloaded public routes and the user's own routes.

```sql
CREATE TABLE IF NOT EXISTS explore_routes (
  convex_id        TEXT    PRIMARY KEY NOT NULL,
  cell_key         TEXT    NOT NULL,
  title            TEXT    NOT NULL,
  description      TEXT,
  visibility       TEXT    NOT NULL DEFAULT 'public',
  created_at       INTEGER NOT NULL,        -- Unix ms
  author_convex_id TEXT,                    -- Convex user ID of the author
  is_own_route     INTEGER NOT NULL DEFAULT 0,  -- 1 = created by this device's user
  legs_json        TEXT    NOT NULL,        -- full legs array, JSON-serialised
  stats_json       TEXT,                   -- { distanceKm, elevationGainM }
  centroid_lat     REAL    NOT NULL,
  centroid_lng     REAL    NOT NULL,
  synced_at        INTEGER NOT NULL         -- Unix ms — when this row was last written
);

CREATE INDEX IF NOT EXISTS idx_er_cell       ON explore_routes(cell_key);
CREATE INDEX IF NOT EXISTS idx_er_centroid   ON explore_routes(centroid_lat, centroid_lng);
CREATE INDEX IF NOT EXISTS idx_er_own        ON explore_routes(is_own_route);
CREATE INDEX IF NOT EXISTS idx_er_created    ON explore_routes(created_at DESC);
```

**Key design decisions:**
- `legs_json` stores the full geometry so Start Walk never needs a network call.
- `is_own_route = 1` rows are owned by the planner, not the sync engine. Region syncs
  never delete or overwrite them.
- `centroid_lat / centroid_lng` are stored for fast viewport queries without
  deserialising `legs_json`.

#### `explore_region_cache`

Tracks the sync state of each cell the user has ever visited.

```sql
CREATE TABLE IF NOT EXISTS explore_region_cache (
  cell_key           TEXT    PRIMARY KEY NOT NULL,
  server_hash        TEXT,       -- NULL = never successfully checked
  last_checked_at    INTEGER,    -- Unix ms — when hash was last compared to server
  last_downloaded_at INTEGER     -- Unix ms — when routes were last downloaded for this cell
);
```

---

### Part 3 — Convex Server Functions (Minimal Surface)

Only two new Convex query functions are needed. Both are **non-reactive** — called
once on demand, not subscribed to.

#### `getRegionHashes({ cellKeys: string[] }) → Record<string, string>`

Returns a hash string for each requested cell. A hash is defined as:

```
hash = "{count_public_routes_in_cell}_{max_created_at_in_cell}"
```

Example: `"8_1747123456789"` — 8 public routes, newest created at that timestamp.

This hash changes when a route is added to the cell. It does **not** change when a
route is edited (title, description, stats), which is acceptable for the current scale.
Full content hashing (all route IDs sorted and hashed) can replace this if edits need
to propagate — it remains a compatible change.

The function accepts a batch of cell keys so the app can check an entire viewport's
cells in one network round-trip.

#### `listPublicByRegion({ cellKey: string }) → PlannedRoute[]`

Returns the full document for every public route whose centroid falls in the given
cell. This is the download function — called only when the hash has changed.

At current scale (8 routes total, ~2 per cell) this is trivially fast. At 10,000
routes, adding a `regionKey` index to the `plannedRoutes` Convex table would make it
an indexed lookup rather than a scan — that optimisation is a non-breaking additive
schema change.

#### (Future) `getRouteById({ id }) → PlannedRoute | null`

For direct route sharing (UX requirement 4). Not part of the initial implementation
but the server function is trivial and can be added when the share feature is built.

---

### Part 4 — Sync Engine

A pure TypeScript module `lib/explore/sync-engine.ts` that has no React dependencies.
It owns all interactions with Convex and all writes to the two new SQLite tables.

#### Sync Configuration

```ts
const SYNC_CONFIG = {
  cellDegrees: 2.0,          // grid resolution
  hashCheckTtlMs: 60 * 60 * 1000,  // 1 hour — how long a hash check stays valid
};
```

Both constants live in one place. `hashCheckTtlMs` can be lowered during development
or raised for a production dataset that changes weekly.

#### Cell Staleness Check

```
isCellStale(cellKey):
  row = SELECT * FROM explore_region_cache WHERE cell_key = ?
  if row is null             → STALE (never visited)
  if row.last_checked_at is null → STALE (visited but never checked)
  if now - row.last_checked_at > hashCheckTtlMs → STALE
  else → FRESH (do nothing)
```

#### Sync Flow for a Viewport

```
syncIfStale(viewBounds):

  1. Compute cells[]  = all cell keys overlapping viewBounds
                        (typically 1–4 cells)

  2. staleCells[]     = cells.filter(isCellStale)

  3. if staleCells is empty → return  (all fresh, zero network calls)

  4. hashes           = fetchQuery(getRegionHashes, { cellKeys: staleCells })
                        (ONE network call for all stale cells)

  5. for each cell in staleCells:
       a. UPDATE explore_region_cache SET last_checked_at = now WHERE cell_key = cell
       b. if hashes[cell] === storedHash(cell) → continue  (no change)
       c. else:
            routes = fetchQuery(listPublicByRegion, { cellKey: cell })
            DELETE FROM explore_routes WHERE cell_key = cell AND is_own_route = 0
            INSERT OR REPLACE INTO explore_routes (...) for each route
            UPDATE explore_region_cache
              SET server_hash = hashes[cell], last_downloaded_at = now
            WHERE cell_key = cell

  6. Notify UI via observable (see Part 5)
```

#### Key Properties of This Flow

- **Steps 1–3 are entirely local.** If all cells are fresh, zero network calls.
- **Step 4 is one batch call** regardless of how many cells are stale. Two cells
  being checked costs the same as one.
- **Downloads are sequential** (one cell at a time in step 5) to avoid parallel
  Convex calls. In practice, first visit downloads 1–4 cells; subsequent visits
  download 0 cells.
- **Own routes are never touched** — the DELETE in step 5c filters `is_own_route = 0`.
- **The UI is never blocked** — sync runs asynchronously after the viewport query
  returns cached data.

#### Triggering the Sync Engine

| Trigger | Action |
|---|---|
| Viewport changes (debounced 500 ms) | `syncIfStale(viewBounds)` |
| Pull-to-refresh | `forceSync(viewBounds)` — skips the TTL check, always re-checks hashes |
| App comes to foreground | `syncIfStale(lastViewBounds)` — catches overnight changes |
| Route published by this user | Local `explore_routes` row updated immediately; server upload happens async via existing sync infrastructure; other users' caches invalidate on next hash check |

---

### Part 5 — The Explore Data Hook

`hooks/use-explore-data.ts` is the single interface between the React UI and the
offline store. It replaces both `useQuery(listWithinBounds)` and
`useQuery(listNearest)`.

```ts
interface UseExploreDataResult {
  routes: LocalRoute[];        // routes within (padded) viewport, from SQLite
  isInitialLoad: boolean;      // true only on first-ever visit to a region
  isSyncing: boolean;          // true during pull-to-refresh hash check + download
  lastCheckedAt: number | null; // oldest last_checked_at of visible cells
  refresh: () => void;         // triggers forceSync
}
```

**Internal operation:**

1. On mount and whenever `viewBounds` changes:
   - Run local SQLite query immediately → update `routes` state (zero network, instant)
   - Fire `syncIfStale(viewBounds)` asynchronously (does not block route display)

2. SQLite viewport query:
   ```sql
   SELECT * FROM explore_routes
   WHERE centroid_lat BETWEEN :minLat - :pad AND :maxLat + :pad
     AND centroid_lng BETWEEN :minLng - :pad AND :maxLng + :pad
   ORDER BY created_at DESC
   ```
   `pad = CELL_DEGREES / 4` (half a grid-step padding catches routes near cell edges).
   This runs in microseconds on the device; no debounce needed.

3. When the sync engine writes new rows, it emits a change notification. The hook
   re-runs the local SQLite query and updates `routes`. This is the only time the
   route list refreshes — driven by a local DB write, not a Convex subscription.

4. `isInitialLoad` is true only when `routes` is empty **and** a download is in
   progress for one of the current cells. Skeleton cards are shown only in this case.
   Once a region has been cached, `isInitialLoad` is never true again for that region.

---

### Part 6 — Own Routes Integration

The planner already writes routes to the local `walks` / `planned_routes` tables.
When a route is saved in the planner it must also be written (or upserted) into
`explore_routes` with `is_own_route = 1` so it is immediately visible in the Explore
view.

```
onRouteSaved(route):
  centroid = computeCentroid(route.legs)
  cell_key = routeToCell(centroid)
  INSERT OR REPLACE INTO explore_routes (
    convex_id, cell_key, title, ..., is_own_route = 1, ...
  )
```

Because the Convex ID is not known at creation time (the route hasn't synced yet), the
local UUID is used as `convex_id` until the upload completes, at which point the row
is updated with the real Convex ID. This is the same pattern used by the existing walk
sync jobs.

---

### Part 7 — What Disappears

The following complexity is **deleted entirely** by this architecture:

| Deleted | Why it existed |
|---|---|
| `useQuery(listWithinBounds)` | Replaced by local SQLite query |
| `useQuery(listNearest)` | Replaced by `ORDER BY distance ASC` local query |
| `committedMode` state machine (`null` / `'nearest'` / `'inbounds'`) | Managed two competing subscriptions |
| `lastInBoundsRef` auth-oscillation filter | Convex auth refresh no longer affects browsing |
| `seenInitialLoadRef` + 1500ms timeout | Loading state is now trivial: one flag |
| `restLoadingPendingId` + timeout timer | Skeleton logic simplified to one boolean |
| 700ms viewport debounce (or reduce to ~200ms) | SQLite query is instant; debounce is only to throttle sync checks |
| `onRoutesChange` prop + `exploreRoutes` state in `index.tsx` | Both components read from the same local DB — no prop threading needed |
| `ExploreMapLayer` receiving routes as prop | Reads from local DB directly via the same hook |

---

### Part 8 — Cost Model After Refactor

With 8 routes and a 1-hour hash TTL:

| Scenario | Convex calls |
|---|---|
| User opens app, all regions fresh (< 1hr since last check) | **0** |
| User opens app, one region stale | **1** hash batch call |
| Hash unchanged | **+0** (no download) |
| Hash changed (new route added) | **+1** download call |
| User pans within same region cell | **0** |
| User pans into new cell (first visit) | **1** hash + **1** download |
| User pans into new cell (visited today) | **0** |
| Pull-to-refresh | **1** hash batch call |

**Projected DB I/O for 1 active user, 1-hour session:**
- 2–4 hash checks × ~1 KB each = ~4 KB
- 0–1 route downloads × ~400 KB = ~400 KB
- **Total: ~400 KB** vs current **~50 MB**
- **~125× reduction**

With 100 concurrent users the saving is proportional — 40 MB/hour vs 5 GB/hour.

