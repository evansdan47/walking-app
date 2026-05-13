# Stage Three: Replaying / Following – Implementation Roadmap

This document is the firm implementation plan for the walk replaying (route following)
feature. It covers the data model for follow sessions, route proximity logic, alert
mechanics, component design, and sequenced work items.

---

## 1. Guiding Principles

1. **Only clean routes are followed.** The reference path is built from `is_clean = 1`
   points only — the same set review renders. Raw GPS noise in the source recording
   never reaches the proximity logic.
2. **False alerts are worse than delayed alerts.** The deviation check uses both a
   distance threshold and a consecutive-update buffer before triggering. One bad GPS
   fix never alerts.
3. **Works entirely offline.** The route and session state live in SQLite. No network
   call is made during a follow session. The live position comes from the device GPS.
4. **Foreground-first for MVP.** Location tracking runs as a foreground watcher.
   Background location can be added in a later phase if the use-case demands it.
5. **Alerting is the primary output.** The map is secondary. The phone is in the
   user's pocket most of the time. Haptics and sound carry more weight than pixels.
6. **A follow session is its own data object.** It is separate from the source walk so
   the source walk record is never mutated, and past follow sessions can be reviewed.
7. **Direction is assumed forward.** MVP always follows the route start-to-finish.
   Reverse following is not supported.

---

## 2. Dependencies to Add

No new packages are required. All needed packages are already installed:

| Package | Purpose in this stage |
|---|---|
| `expo-location` | Foreground `watchPositionAsync` for live position during follow |
| `expo-haptics` | Vibration feedback on off-route / back-on-route events |
| `@rnmapbox/maps` | Map with reference route overlay and live position layer |
| `expo-sqlite` | Stores follow sessions and reads existing clean route points |
| `expo-av` | Audio alert on deviation (optional, already transitively installed) |

---

## 3. Database Layer Changes

### 3.1 New Table: `follow_sessions`

Add to the existing `lib/db/client.ts` migration block:

```sql
CREATE TABLE IF NOT EXISTS follow_sessions (
  id              TEXT PRIMARY KEY,       -- local UUID
  walk_id         TEXT NOT NULL REFERENCES walks(id),
  status          TEXT NOT NULL,          -- 'active' | 'completed' | 'abandoned'
  started_at      INTEGER NOT NULL,       -- Unix ms
  ended_at        INTEGER,               -- Unix ms, set on stop
  route_point_count INTEGER NOT NULL,    -- snapshot of clean point count used
  distance_covered_metres REAL,          -- approximate, updated on stop
  off_route_event_count INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL
);
```

### 3.2 `lib/db/follow-sessions.ts` — New file

```ts
export function createFollowSession(walkId: string, routePointCount: number): string
// INSERT a new row with status = 'active'. Returns the new session id.

export function getActiveFollowSession(): FollowSession | null
// SELECT * FROM follow_sessions WHERE status = 'active' LIMIT 1

export function completeFollowSession(
  sessionId: string,
  distanceCoveredMetres: number,
): void
// UPDATE status = 'completed', ended_at = now, distance_covered_metres = ?

export function abandonFollowSession(sessionId: string): void
// UPDATE status = 'abandoned', ended_at = now

export function incrementOffRouteCount(sessionId: string): void
// UPDATE off_route_event_count = off_route_event_count + 1

export function listFollowSessionsForWalk(walkId: string): FollowSession[]
// SELECT * FROM follow_sessions WHERE walk_id = ? ORDER BY started_at DESC
```

### 3.3 `lib/db/walks.ts` — Add `getFollowableWalks`

```ts
export function getFollowableWalks(): Walk[]
// SELECT walks that have status = 'completed' and
// have at least MIN_FOLLOWABLE_POINTS (e.g. 10) clean track points.
// ORDER BY started_at DESC.
// Used by the route-picker screen to filter out walks that are too short
// to make a useful reference route.
```

### 3.4 `lib/db/track-points.ts` — Already complete

`getCleanPointsForWalk(walkId)` from the review stage is used directly. No new
query is needed.

---

## 4. Route Preparation Layer

Location: `lib/replay/`

Functions in this layer are pure and synchronous. They are called once when a
follow session starts, not on every location update.

### 4.1 `lib/replay/build-follow-route.ts`

```ts
export interface FollowPoint {
  latitude: number;
  longitude: number;
  cumulativeDistanceMetres: number; // distance from route start to this point
}

export interface FollowRoute {
  walkId: string;
  points: FollowPoint[];
  totalDistanceMetres: number;
}

export function buildFollowRoute(walkId: string): FollowRoute | null {
  // 1. Call getCleanPointsForWalk(walkId)
  // 2. Return null if fewer than MIN_FOLLOWABLE_POINTS
  // 3. Map to FollowPoint[], accumulating Haversine distance for each step
  // 4. Set totalDistanceMetres from the last point's cumulativeDistance
}
```

Returns `null` when the walk has too few clean points so callers can render an error
state rather than starting a nonsensical follow session.

### 4.2 `lib/replay/compute-proximity.ts`

Core geometry. All calculations use Haversine distance.

```ts
export interface ProximityResult {
  distanceToRouteMetres: number;     // perpendicular distance to nearest segment
  nearestSegmentIndex: number;       // index of the nearest route segment
  progressMetres: number;            // cumulative distance to nearest segment projected point
  progressFraction: number;          // 0.0 → 1.0
}

export function computeProximity(
  lat: number,
  lon: number,
  route: FollowRoute,
  searchFromSegment: number,         // start search here, not from index 0 (optimisation)
): ProximityResult {
  // For each segment from searchFromSegment to route.points.length - 2:
  //   Find the closest point on the segment (project lat/lon onto segment line)
  //   Compute perpendicular distance from user to that point
  //   Track minimum
  // Return the minimum with segment index and progress
}

// Haversine distance between two lat/lon points in metres
export function haversineMetres(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number
```

`searchFromSegment` is forwarded from `lastNearestSegmentIndex` held in the session
state. This avoids re-scanning the whole route on every GPS update — the user is
almost always within 1–2 segments of their previous position. The search wraps
forward only (supporting forward direction assumption).

### 4.3 `lib/replay/deviation-detector.ts`

Stateful detector that prevents single noisy GPS fixes from triggering alerts.

```ts
export const OFF_ROUTE_DISTANCE_THRESHOLD_METRES = 30; // user is this far from route
export const OFF_ROUTE_CONSECUTIVE_UPDATES = 3;        // must be true for this many updates

export type DeviationState = 'on_route' | 'off_route';

export class DeviationDetector {
  private consecutiveBreaches = 0;
  private state: DeviationState = 'on_route';

  update(distanceToRouteMetres: number): {
    state: DeviationState;
    changed: boolean;   // true if state flipped this update
  } {
    // Accumulate or clear consecutiveBreaches depending on threshold.
    // Only flip state when consecutiveBreaches reaches OFF_ROUTE_CONSECUTIVE_UPDATES
    // (entering off_route) or drops to 0 (returning on_route).
    // Return { state, changed: stateFlippedThisCall }
  }
}
```

A class rather than a function so consecutive count survives across the watcher
callback without being stored in React state.

---

## 5. Follow Session State Machine

Location: `hooks/use-follow-session.ts`

The central hook for the follow screen. Manages the full lifecycle, wires live
location to the proximity engine, and fires alerts.

```ts
type FollowPhase =
  | { phase: 'idle' }
  | { phase: 'loading'; walkId: string }
  | { phase: 'active';
      sessionId: string;
      walkId: string;
      route: FollowRoute;
      deviationState: DeviationState;
      progressFraction: number;
      progressMetres: number;
      distanceCoveredMetres: number;
      elapsedMs: number;
    }
  | { phase: 'completed'; sessionId: string; walkId: string }
  | { phase: 'error'; message: string };

interface FollowSessionActions {
  start: (walkId: string) => Promise<void>;
  stop: () => Promise<void>;
}
```

**`start(walkId)`:**
1. Set `{ phase: 'loading' }`.
2. Call `buildFollowRoute(walkId)`. If null set `{ phase: 'error' }` and return.
3. Insert a follow session row (`createFollowSession`). Store `sessionId`.
4. Instantiate a `DeviationDetector`.
5. Initialise `lastNearestSegmentIndex = 0`.
6. Start `Location.watchPositionAsync` with `accuracy: BestForNavigation`,
   `timeInterval: 3000`, `distanceInterval: 3`.
7. In the watcher callback:
   a. Call `computeProximity(lat, lon, route, lastNearestSegmentIndex)`.
   b. Update `lastNearestSegmentIndex` from result (only move forward).
   c. Call `detector.update(result.distanceToRouteMetres)`.
   d. If `changed`:
      - **On-route → Off-route**: `Haptics.notificationAsync('warning')` + play
        alert sound + `incrementOffRouteCount(sessionId)`.
      - **Off-route → On-route**: `Haptics.notificationAsync('success')`.
   e. Update state phase with `progressFraction`, `progressMetres`,
      `distanceCoveredMetres`, `deviationState`.
8. Set `{ phase: 'active', ... }`.

**`stop()`:**
1. Remove the location watcher (`watcher.remove()`).
2. Call `completeFollowSession(sessionId, distanceCoveredMetres)`.
3. Set `{ phase: 'completed', ... }`.

---

## 6. Alert Feedback

Location: inside `hooks/use-follow-session.ts` at the deviation change point.

### 6.1 Haptics

Use `expo-haptics` — already installed.

```ts
import * as Haptics from 'expo-haptics';

// Off-route
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

// Back on-route
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
```

### 6.2 Audio (optional — can be added in a later pass)

Load a short alert sound via `expo-av` once when the follow session starts. Play it
alongside the haptic on deviation. Respect the device silent switch by using
`playsInSilentModeIOS: false` (so audio does not force-override silent mode — haptics
remain the primary alert channel).

---

## 7. React Components

All new components live in `components/replay/`.

### 7.1 `components/replay/replay-route-layer.tsx`

A Mapbox layer component placed inside the shared `MapboxGL.MapView`.  Renders the
reference route; live position is handled by the existing `LivePositionLayer`.

```
Props:
  route:            FollowRoute
  progressFraction: number    — 0.0–1.0; used to tint walked vs. remaining segments
  deviationState:   DeviationState
  style?:           ViewStyle
```

**Implementation:**

```tsx
// Reference route: full polyline in muted slate (#94A3B8), width 6.
// Walked portion: overlaid polyline in primary ochre up to the progress point, width 4.
// Builds two GeoJSON LineStrings from FollowPoint[]:
//   - full route (all points)
//   - walked portion (points 0 → nearestSegmentIndex, clipped by progress)
//
// Camera: follows the user's live position during the session (use followUserLocation
// or a Camera ref updated on each position update).
// On session start: fitBounds to the full route so the user can see where they are
// relative to the route before they start moving.
```

No `MapboxGL.MapView` inside this component — it contributes sources and layers only.

### 7.2 `components/replay/follow-status-badge.tsx`

```
Props:
  state: DeviationState   — 'on_route' | 'off_route'
```

Pill-shaped badge, same design language as `RecordingStatusBadge`.
- `'on_route'` → forest green background, "ON ROUTE", no animation.
- `'off_route'` → amber/warning background, "OFF ROUTE", pulsing animation
  (same `withRepeat` pattern as `RecordingStatusBadge`).

### 7.3 `components/replay/route-progress-bar.tsx`

A thin horizontal progress strip (not a `StatCard`) showing completion of the route.

```
Props:
  progressFraction: number    — 0.0–1.0
  totalDistanceMetres: number
  progressMetres: number
```

- A `View` with a child `View` whose `width` is `${progressFraction * 100}%`.
- Animated width change using `react-native-reanimated` `withSpring`.
- Subtitle text: `"X.X km of Y.Y km"`.

### 7.4 `components/replay/follow-controls.tsx`

```
Props:
  phase:    FollowPhase['phase']
  onStart:  () => void
  onStop:   () => void
  disabled?: boolean
```

- `'idle'` → single large **Follow Route** button (Primary ochre, filled, full-width).
- `'active'` → **Stop Following** (outlined, destructive). Tapping shows
  `Alert.alert` confirmation before calling `onStop`.
- `'loading'` → button in disabled/loading state.
- `'completed'` → nothing (navigation is automatic).
- `'error'` → nothing (error card rendered by screen).

Uses `expo-haptics` on press (light impact for start, heavy for stop) — same pattern
as `RecordingControls`.

### 7.5 `components/replay/route-picker-card.tsx`

A swipeable card shown in the route-picker bottom sheet (walk-follow entry screen).

```
Props:
  walk:    Walk
  onPress: () => void
```

Displays the walk title, date, distance pill, and duration pill — identical to
`HistoryWalkCard` but with a "Follow" label replacing the chevron. Disables walks
with `route_point_count < MIN_FOLLOWABLE_POINTS`.

---

## 8. Screens

### 8.1 `app/walk-follow.tsx` — Follow Screen

A stack screen — identical layout approach to `walk-summary.tsx`.

**Entry points:**
1. From `app/walk-summary.tsx`: "Follow this route" action button in `WalkActionBar`.
2. Could later be reached from a dedicated "Follow" tab if the Library list grows
   a follow CTA — not in MVP.

Route: `router.push('/walk-follow?walkId=...')`

**Screen layout (map-first, bottom sheet overlay):**

```
┌─────────────────────────────────────────┐
│  MapboxGL.MapView  (100 % screen)       │
│  – ReplayRouteLayer (reference route)   │
│  – LivePositionLayer (user position)    │
└─────────────────────────────────────────┘
         ↑ (behind everything)

┌─────────────────────────────────────────┐
│  BottomSheet (snaps over map)           │
│                                         │
│  ── Collapsed snap point (~20 %) ──     │
│    FollowStatusBadge • ElapsedTimer     │
│    RouteProgressBar                     │
│                                         │
│  ── Expanded snap point (~55 %) ──      │
│    FollowStatusBadge (large)            │
│    RouteProgressBar                     │
│    StatGrid (2 col):                    │
│      DistanceDisplay  | DurationDisplay │
│      Remaining dist   | Off-route count │
│    FollowControls                       │
└─────────────────────────────────────────┘

AppHeader with back chevron — absolute overlay at top
(back is disabled while a session is active — calls stop first)
```

**Data loading:**

```ts
const walkId = useLocalSearchParams().walkId as string;
const { phase, start, stop } = useFollowSession();

// Auto-start the session when screen mounts and walkId is present
useEffect(() => {
  if (walkId) start(walkId);
}, [walkId]);
```

**Guards:**
- `walkId` missing → error card + back button.
- `phase === 'error'` → error card ("Route not available — insufficient GPS points
  were recorded.") + back button.
- `phase === 'loading'` → activity indicator over map.
- `phase === 'completed'` → brief "Session complete" banner, then navigate back
  automatically after 2 s.

**Back-button guard:**

If `phase === 'active'`, the back button (and Android hardware back) calls `stop()`
with confirmation rather than immediately navigating.

```ts
function handleBack() {
  if (phase === 'active') {
    Alert.alert(
      'Stop following?',
      'Your progress will be saved.',
      [
        { text: 'Continue following', style: 'cancel' },
        { text: 'Stop', style: 'destructive', onPress: async () => {
          await stop();
          router.back();
        }},
      ],
    );
  } else {
    router.back();
  }
}
```

---

## 9. Walk Summary Screen Changes (`app/walk-summary.tsx`)

One addition to the existing `WalkActionBar` component:

### 9.1 Add "Follow this route" to `WalkActionBar`

```
Additional prop on WalkActionBar:
  onFollow?: () => void
```

When supplied, render a primary ochre **Follow this route** button above the Delete
button. Routes to the follow screen:

```ts
onFollow={() => router.push(`/walk-follow?walkId=${walkId}`)}
```

**Guard:** Only render the Follow button if the walk has at least
`MIN_FOLLOWABLE_POINTS` clean track points. Call `getCleanPointsForWalk(walkId).length`
once on review screen load and pass a `bool followable` prop down to `WalkActionBar`.

---

## 10. Navigation

`app/walk-follow.tsx` is a stack screen resolved automatically by `expo-router`.
No routing configuration changes are needed.

---

## 11. Sequenced Work Items

Work must be done in this order due to dependencies.

---

### Phase 1 — Database & Route Preparation

1. Add `follow_sessions` table to the migration in `lib/db/client.ts`.
2. Create `lib/db/follow-sessions.ts` with all five functions listed in Section 3.2.
3. Add `getFollowableWalks()` to `lib/db/walks.ts`.
4. Create `lib/replay/build-follow-route.ts`.
5. Create `lib/replay/compute-proximity.ts` (Haversine helpers + `computeProximity`).
6. Create `lib/replay/deviation-detector.ts`.
7. `npx tsc --noEmit` — 0 errors.

**Checkpoint:** All new functions compile cleanly. `buildFollowRoute` returns null for
a walk with no clean points and a valid route for one that has them.

---

### Phase 2 — Follow Session Hook

8. Create `hooks/use-follow-session.ts` with the full state machine.
9. Wire `computeProximity` and `DeviationDetector` into the location watcher callback.
10. Wire haptic alerts on deviation state change.
11. `npx tsc --noEmit` — 0 errors.

**Checkpoint:** Hook runs in isolation (verified by temporarily logging to console
from a test screen). Off-route haptic fires after 3 consecutive breaches. On-route
haptic fires when user returns within threshold.

---

### Phase 3 — UI Components

12. Create `components/replay/replay-route-layer.tsx`.
    - Full route polyline in slate + walked portion in ochre.
    - Camera follows user live position.
13. Create `components/replay/follow-status-badge.tsx`.
    - On-route (green) + Off-route (amber, pulsing).
14. Create `components/replay/route-progress-bar.tsx`.
    - Animated width, formatted distance label.
15. Create `components/replay/follow-controls.tsx`.
    - Idle / active / loading states, haptics on press.
16. `npx tsc --noEmit` — 0 errors.

**Checkpoint:** Components render correctly in isolation. Status badge animation
runs for off-route state. Progress bar animates when fraction changes.

---

### Phase 4 — Follow Screen

17. Create `app/walk-follow.tsx` (map-first + BottomSheet layout).
    - `MapboxGL.MapView` with `ReplayRouteLayer` + `LivePositionLayer`.
    - Bottom sheet snap points `['20%', '55%']`.
    - Collapsed: `FollowStatusBadge` + `ElapsedTimer` + `RouteProgressBar`.
    - Expanded: full stats grid + `FollowControls`.
    - Auto-start `useFollowSession.start(walkId)` on mount.
    - Back-button guard (confirmation when session active).
    - All error/loading/completed guards.
18. `npx tsc --noEmit` — 0 errors.

**Checkpoint:** Screen builds and renders. Route displays on map before session
starts. Bottom sheet opens at collapsed snap point. Session starts automatically.

---

### Phase 5 — Review Screen Integration

19. Add `onFollow` prop to `components/review/walk-action-bar.tsx`.
20. Load clean point count in `app/walk-summary.tsx` to determine `followable` bool.
21. Pass `followable` and `onFollow` to `WalkActionBar`.
22. `onFollow` navigates to `/walk-follow?walkId=...`.
23. `npx tsc --noEmit` — 0 errors.

**Checkpoint:** "Follow this route" button appears on walks with enough clean points.
Tapping navigates to the follow screen and the route loads.

---

### Phase 6 — Polish and Verification

24. Verify Mapbox logo and attribution visible on the follow screen map.
25. Verify haptic alert fires after 3 consecutive off-route updates (~9–15 s at 3 s
    interval), not on a single bad fix.
26. Verify returning on-route fires the success haptic and badge returns to green.
27. Verify stopping mid-session records `status = 'abandoned'` and completes without
    crash.
28. Verify the follow screen back button shows confirmation when a session is active.
29. Verify short walks (< `MIN_FOLLOWABLE_POINTS` clean points) disable the Follow
    button in the review screen and show an error if navigated to directly.
30. Verify device rotation does not lose follow session state (`useFollowSession` is
    not screen-scoped — place it in the context provider if needed).
31. `npx tsc --noEmit` — 0 errors.
32. Walk a route end-to-end: review → follow → deliberate deviation → alert fires →
    return → on-route alert fires → stop → confirm session stored in DB.

---

## 12. Folder Structure After Phase 6

```
app/
  walk-follow.tsx         ← NEW — follow/replay screen

components/
  replay/                 ← NEW folder
    replay-route-layer.tsx
    follow-status-badge.tsx
    route-progress-bar.tsx
    follow-controls.tsx
    route-picker-card.tsx

hooks/
  use-follow-session.ts   ← NEW

lib/
  db/
    follow-sessions.ts    ← NEW
    walks.ts              ← + getFollowableWalks
  replay/                 ← NEW folder
    build-follow-route.ts
    compute-proximity.ts
    deviation-detector.ts
```

---

## 13. Constants Reference

| Constant | Value | Location |
|---|---|---|
| `OFF_ROUTE_DISTANCE_THRESHOLD_METRES` | 30 | `lib/replay/deviation-detector.ts` |
| `OFF_ROUTE_CONSECUTIVE_UPDATES` | 3 | `lib/replay/deviation-detector.ts` |
| `MIN_FOLLOWABLE_POINTS` | 10 | `lib/replay/build-follow-route.ts` |
| `FOLLOW_TIME_INTERVAL_MS` | 3000 | `hooks/use-follow-session.ts` |
| `FOLLOW_DISTANCE_INTERVAL_M` | 3 | `hooks/use-follow-session.ts` |

All constants are module-level named exports so they can be adjusted without hunting
through logic code.
