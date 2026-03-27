# Stage One: Recording – Implementation Roadmap

This document is the firm implementation plan for the walk recording feature. It covers every layer from native permissions down to Convex sync, with component designs, folder structure, and sequenced work items.

---

## 1. Guiding Principles

1. **Convex is never touched during a walk.** All recording writes go to local SQLite. Convex only receives data after the walk is complete and a reliable connection is detected.
2. **The background task does one thing.** Receive a location fix → validate accuracy → write to SQLite → return. Nothing else happens in the hot path.
3. **Keep raw data; derive everything else.** All raw GPS fixes are stored. Stats and clean route geometry are computed in a single post-processing pass after the user taps Stop.
4. **The UI is honest.** The app clearly communicates that closing it mid-walk ends recording. No silent data loss.
5. **Components are reusable.** Stat cards, timers, and status badges are built generically so the same pieces work in Review and Replay screens later.

---

## 2. Dependencies to Add

```bash
npx expo install expo-location expo-task-manager expo-sqlite expo-camera expo-file-system expo-network
```

| Package | Purpose |
|---|---|
| `expo-location` | GPS location updates (foreground + background) |
| `expo-task-manager` | Background task registration for location |
| `expo-sqlite` | Local offline database |
| `expo-camera` | In-walk photo capture |
| `expo-file-system` | Local photo file management pre-sync |
| `expo-network` | Detect connectivity to trigger sync |

`expo-haptics` is already present and will be used for recording control feedback.

---

## 3. Native Configuration (`app.json`)

The following additions are required for background location on both platforms.

```json
{
  "expo": {
    "ios": {
      "supportsTablet": true,
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "Used to record your walk route.",
        "NSLocationAlwaysAndWhenInUseUsageDescription": "Used to keep recording your walk while your phone is locked or in your pocket.",
        "NSLocationAlwaysUsageDescription": "Used to keep recording your walk while your phone is locked or in your pocket.",
        "UIBackgroundModes": ["location"]
      }
    },
    "android": {
      "permissions": [
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_BACKGROUND_LOCATION",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_LOCATION"
      ]
    },
    "plugins": [
      "expo-router",
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "Used to keep recording your walk while your phone is in your pocket.",
          "isAndroidBackgroundLocationEnabled": true,
          "isAndroidForegroundServiceEnabled": true
        }
      ]
    ]
  }
}
```

> **Important:** Background location on a real device requires a **development build** (`npx expo run:ios` or `npx expo run:android`). Expo Go does not support background location tasks.

---

## 4. Local Database (SQLite)

The local SQLite database is the sole write target during recording. Its schema mirrors the Convex schema but uses string UUIDs as primary keys (Convex `_id`s are assigned only after upload).

### Tables

#### `walks`
```sql
CREATE TABLE IF NOT EXISTS walks (
  id           TEXT PRIMARY KEY,   -- local UUID
  title        TEXT,
  status       TEXT NOT NULL,      -- 'recording' | 'paused' | 'completed'
  started_at   INTEGER NOT NULL,   -- Unix ms
  ended_at     INTEGER,            -- Unix ms
  device_id    TEXT NOT NULL,
  stats_json   TEXT,               -- JSON blob, set after post-processing
  convex_id    TEXT,               -- set after successful sync
  created_at   INTEGER NOT NULL
);
```

#### `track_points`
```sql
CREATE TABLE IF NOT EXISTS track_points (
  id              TEXT PRIMARY KEY,
  walk_id         TEXT NOT NULL REFERENCES walks(id),
  timestamp       INTEGER NOT NULL,  -- Unix ms
  latitude        REAL NOT NULL,
  longitude       REAL NOT NULL,
  altitude_metres REAL,
  speed_mps       REAL,
  accuracy_metres REAL NOT NULL,
  is_clean        INTEGER,           -- 0 | 1 | NULL (set after post-processing)
  INDEX (walk_id, timestamp)
);
```

#### `walk_photos`
```sql
CREATE TABLE IF NOT EXISTS walk_photos (
  id               TEXT PRIMARY KEY,
  walk_id          TEXT NOT NULL REFERENCES walks(id),
  timestamp        INTEGER NOT NULL,
  latitude         REAL NOT NULL,
  longitude        REAL NOT NULL,
  local_uri        TEXT NOT NULL,    -- device file path pre-sync
  caption          TEXT,
  convex_id        TEXT,             -- set after upload
  storage_id       TEXT,             -- Convex _storage id, set after upload
  INDEX (walk_id, timestamp)
);
```

#### `sync_jobs`
```sql
CREATE TABLE IF NOT EXISTS sync_jobs (
  id            TEXT PRIMARY KEY,
  walk_id       TEXT NOT NULL REFERENCES walks(id),
  device_id     TEXT NOT NULL,
  status        TEXT NOT NULL,  -- 'pending' | 'in_progress' | 'completed' | 'failed'
  attempted_at  INTEGER,
  error_message TEXT
);
```

### Database Layer

Location: `lib/db/`

| File | Responsibility |
|---|---|
| `lib/db/client.ts` | Opens and migrates the SQLite database. Single shared instance. |
| `lib/db/walks.ts` | `createWalk`, `updateWalkStatus`, `updateWalkStats`, `getWalk`, `listWalks` |
| `lib/db/track-points.ts` | `insertPoint`, `getPointsForWalk`, `markPointsClean` |
| `lib/db/walk-photos.ts` | `insertPhoto`, `getPhotosForWalk`, `updatePhotoAfterSync` |
| `lib/db/sync-jobs.ts` | `createSyncJob`, `getPendingJobs`, `updateJobStatus` |

All DB operations are async and wrapped so callers never import SQLite directly.

---

## 5. Location Recording Engine

### 5.1 Background Task

Location: `lib/location/background-task.ts`

```
BACKGROUND_LOCATION_TASK = 'WALK_LOCATION_TASK'
```

The task is defined using `TaskManager.defineTask`. It runs in the background (and with screen locked) and **only does three things**:

1. Check `locations` array from the OS is non-empty.
2. For each fix: if `accuracy` is below the acceptance threshold (e.g. > 50 m, reject), write the point to SQLite.
3. Return.

No state reads, no UI updates, no Convex calls, no stats calculation. This is the critical constraint that keeps the background task alive and battery-efficient.

```ts
// lib/location/background-task.ts
import * as TaskManager from 'expo-task-manager';
import { insertPoint } from '../db/track-points';
import { getActiveWalkId } from '../db/walks';  // reads a single persisted value

export const BACKGROUND_LOCATION_TASK = 'WALK_LOCATION_TASK';
const ACCURACY_THRESHOLD_METRES = 50;

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  const walkId = await getActiveWalkId();
  if (!walkId) return;

  for (const loc of locations) {
    if ((loc.coords.accuracy ?? 999) > ACCURACY_THRESHOLD_METRES) continue;
    await insertPoint({
      walkId,
      timestamp: loc.timestamp,
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      altitudeMetres: loc.coords.altitude ?? undefined,
      speedMps: loc.coords.speed ?? undefined,
      accuracyMetres: loc.coords.accuracy ?? 999,
    });
  }
});
```

> **This file must be imported at the root of the app** (in `app/_layout.tsx`) so the task is registered before the background runtime needs it.

### 5.2 Location Task Hook

Location: `hooks/use-location-task.ts`

Manages starting and stopping `Location.startLocationUpdatesAsync`. Exposes `startTracking()` and `stopTracking()` as the only interface. The hook is not responsible for the walk session state — that sits in `use-walk-session.ts`.

**Options used for `startLocationUpdatesAsync`:**
```ts
{
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 5000,          // minimum 5 s between updates
  distanceInterval: 5,         // minimum 5 m of movement
  showsBackgroundLocationIndicator: true,  // iOS blue bar
  foregroundService: {         // Android foreground service notification
    notificationTitle: 'Walk recording in progress',
    notificationBody: 'Tap to return to the app.',
    notificationColor: '#E65100',
  },
  pausesUpdatesAutomatically: false,
}
```

`distanceInterval: 5` combined with `timeInterval: 5000` means the app won't flood the database while the user is stationary.

### 5.3 Permission Flow

Location: `hooks/use-location-permission.ts`

A dedicated hook, not inlined in the recording screen, so it can be reused for the follow/replay screen.

**Sequence:**
1. On recording screen mount: call `Location.getForegroundPermissionsAsync()`.
2. If not granted: render `<PermissionGate type="foreground" />` — explains why and triggers the system dialog.
3. Only after foreground granted: call `Location.getBackgroundPermissionsAsync()`.
4. If not granted: render `<PermissionGate type="background" />` — explicitly explains the "screen locked" use case.
5. Only after both granted: enable the Start button.

Never ask for both permissions simultaneously. Never ask at app launch.

---

## 6. Walk Session State Machine

Location: `hooks/use-walk-session.ts`

This is the central coordination hook for the recording screen. It owns the session lifecycle and exposes a clean API:

```ts
type WalkSessionState =
  | { phase: 'idle' }
  | { phase: 'recording'; walkId: string; startedAt: number }
  | { phase: 'paused';   walkId: string; startedAt: number; pausedAt: number }
  | { phase: 'completed'; walkId: string };

interface WalkSessionActions {
  start: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
}
```

**`start()`:**
1. Generate a UUID for the walk.
2. Write the walk row to SQLite with `status: 'recording'`.
3. Write the active walk ID to a persisted key (`expo-secure-store` or `AsyncStorage`) — this is what the background task reads.
4. Call `startTracking()` from `use-location-task.ts`.
5. Transition state to `{ phase: 'recording', ... }`.

**`pause()`:**
1. Update SQLite walk status to `'paused'`.
2. Call `stopTracking()`.
3. Transition state to `{ phase: 'paused', ... }`.
4. Note: pausing does NOT clear the active walk ID — resuming just restarts tracking under the same walk.

**`resume()`:**
1. Update SQLite walk status to `'recording'`.
2. Call `startTracking()`.
3. Transition state back to `{ phase: 'recording', ... }`.

**`stop()`:**
1. Call `stopTracking()`.
2. Update SQLite walk status to `'completed'`, set `ended_at`.
3. Clear the active walk ID from persisted storage.
4. Dispatch `runPostProcessing(walkId)` — see Section 7.
5. Transition state to `{ phase: 'completed', walkId }`.
6. Navigate to the Walk Summary screen.

---

## 7. Post-Processing

Location: `lib/location/post-processing.ts`

Runs once, synchronously, after `stop()` is called. The user sees a brief "Calculating..." state while this completes. It does not run in the background task.

### Steps

**Step 1 – Load raw points**
Fetch all points for the walk ordered by `timestamp` from SQLite.

**Step 2 – Filter clean points**
Mark a point as clean if:
- `accuracy_metres <= 50` (configurable constant `CLEAN_ACCURACY_THRESHOLD`)
- It is not a duplicate (same lat/lng as the previous point)
- It does not jump more than `MAX_JUMP_METRES` (300 m) from the previous clean point in less than 10 seconds (outlier / teleport detection)

Write `is_clean = 1` back to SQLite for accepted points.

**Step 3 – Compute distance**
Sum the Haversine distance between consecutive clean points.

**Step 4 – Compute time breakdown**
- `durationSeconds` = `(ended_at - started_at) / 1000`
- `movingTimeSeconds` = duration of intervals where consecutive clean points are > 3 m apart within a sliding window
- `stoppedTimeSeconds` = `durationSeconds - movingTimeSeconds`

**Step 5 – Compute pace**
`avgPaceSecsPerKm = movingTimeSeconds / (distanceMetres / 1000)`

**Step 6 – Elevation (best-effort)**
If altitude data is present on ≥ 50% of clean points:
- Apply a simple moving-average smooth (window of 5)
- Sum positive deltas → `elevationGainMetres`
- Sum negative deltas → `elevationLossMetres`

**Step 7 – Save stats**
Serialise to JSON and write to `walks.stats_json`. Update walk row.

**Step 8 – Create sync job**
Insert a `sync_jobs` row for the walk with `status: 'pending'`.

---

## 8. Sync Pipeline

### 8.1 Connectivity Detection

Location: `hooks/use-sync-trigger.ts`

Uses `Network.addNetworkStateListener` from `expo-network`. When network state transitions to connected and reachable, trigger the sync manager.

### 8.2 Sync Manager

Location: `lib/sync/sync-manager.ts`

```
syncPendingWalks():
  1. Fetch all sync_jobs WHERE status = 'pending' ORDER BY created_at ASC
  2. For each job (process one at a time, sequentially):
     a. Mark job as 'in_progress'
     b. Call uploadWalk(walkId)
     c. On success: mark 'completed', write convex_id back to local walk row
     d. On failure: mark 'failed', store error_message
```

Processing is sequential (not parallel) to avoid hammering the network or hitting Convex rate limits.

### 8.3 Walk Upload

Location: `lib/sync/upload-walk.ts`

```
uploadWalk(localWalkId):
  1. Load walk row from SQLite
  2. Load all clean track points (is_clean = 1)
  3. Load all walk photos

  4. Call Convex mutation: walks.create(walk data) → get convexWalkId

  5. Batch-upload track points (500 per batch):
     Call Convex mutation: trackPoints.insertBatch(convexWalkId, batch)

  6. For each photo:
     a. Read local file into ArrayBuffer
     b. Generate Convex upload URL via action: walkPhotos.generateUploadUrl()
     c. PUT file to the URL
     d. Call Convex mutation: walkPhotos.create(convexWalkId, storageId, metadata)
     e. Update local walk_photos row with convex_id and storage_id

  7. Return convexWalkId
```

Photo uploads happen after all points are committed so a partial upload doesn't leave orphan files.

### 8.4 Convex Functions

Location: `convex/walks.ts`, `convex/trackPoints.ts`, `convex/walkPhotos.ts`

These are standard Convex `mutation`s. All are authenticated — they call `ctx.auth.getUserIdentity()` and look up the user from the `users` table. No walk is inserted without a valid `userId`.

---

## 9. React Components

All components are in `components/recording/` unless marked **shared** (available to Review and Replay stages too).

### 9.1 Shared Primitive: `StatCard`

**`components/shared/stat-card.tsx`** ← reused across all three stages

```
Props:
  label: string           — e.g. "DISTANCE"
  value: string           — e.g. "3.2"
  unit?: string           — e.g. "km"
  size?: 'sm' | 'md' | 'lg'
  accent?: boolean        — renders value in Primary orange
  style?: ViewStyle
```

A rounded card with `label` above in small uppercase slate text and `value + unit` below in large bold. Uses the style guide's card design: light background, rounded corners, consistent padding. Size `'lg'` is used for the headline stat (elapsed time); `'md'` for the supporting grid.

### 9.2 Shared Primitive: `StatGrid`

**`components/shared/stat-grid.tsx`** ← reused across all three stages

```
Props:
  children: ReactNode     — expects StatCard children
  columns?: 2 | 3        — defaults to 2
```

A responsive grid wrapper. On the recording screen columns=2. On the post-walk summary columns=3 can be used for a denser layout.

### 9.3 `ElapsedTimer`

**`components/recording/elapsed-timer.tsx`**

```
Props:
  startedAt: number        — Unix ms
  pausedDurationMs: number — accumulated paused time to subtract
  running: boolean         — false = frozen display
```

Derives elapsed seconds from `Date.now() - startedAt - pausedDurationMs` on a 1-second `setInterval`. Does **not** use a state machine counter — always re-derives from wall clock so it survives re-renders without drift.

Renders as a `StatCard` with `size="lg"` displaying `HH:MM:SS`.

### 9.4 `DistanceDisplay`

**`components/recording/distance-display.tsx`**

```
Props:
  distanceMetres: number
  unit?: 'km' | 'mi'      — defaults to 'km'
```

Renders as a `StatCard`. Formats to one decimal place when ≥ 1 km, two decimal places below. Unit label updates accordingly.

Reusable: also used on the Walk Summary screen and Review screen.

### 9.5 `PaceDisplay`

**`components/recording/pace-display.tsx`**

```
Props:
  paceSecsPerKm: number | null
  unit?: 'km' | 'mi'
```

Renders as a `StatCard` with label `"PACE"` and value formatted as `MM:SS /km`. Shows `"--:--"` when `null` (before enough distance to compute).

### 9.6 `AltitudeDisplay`

**`components/recording/altitude-display.tsx`**

```
Props:
  altitudeMetres: number | null
```

Renders as a `StatCard`. Shows `"--"` when null. Altitude is displayed for interest but marked as approximate in the label (`"ALT ≈"`).

### 9.7 `RecordingStatusBadge`

**`components/recording/recording-status-badge.tsx`** ← reused in Replay stage

```
Props:
  status: 'recording' | 'paused' | 'completed' | 'idle'
```

A pill-shaped badge. Uses the style guide's green background for `'recording'`, slate for `'paused'`, and neutral for `'idle'`. Includes a pulsing animation (using `react-native-reanimated` `withRepeat`) on the `'recording'` state to give a live signal. Replay uses an `'on_route'` / `'off_route'` variant of the same component.

### 9.8 `RecordingControls`

**`components/recording/recording-controls.tsx`**

```
Props:
  phase: 'idle' | 'recording' | 'paused' | 'completed'
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  disabled?: boolean     — used while permissions are loading
```

Renders the correct button set for each phase:
- `idle` → single large **Start** button (Primary orange, filled, full-width)
- `recording` → **Pause** (secondary) + **Stop** (outlined, destructive confirmation)
- `paused` → **Resume** (Primary orange) + **Stop** (outlined)
- `completed` → nothing (navigation to summary is automatic)

Stop triggers a confirmation bottom-sheet (`Alert.alert` in MVP) before calling `onStop`.

Uses `expo-haptics` on every button press: light impact on pause/resume, heavy impact on start/stop.

### 9.9 `PhotoButton`

**`components/recording/photo-button.tsx`**

```
Props:
  walkId: string
  currentLocation: { latitude: number; longitude: number } | null
  disabled?: boolean
```

A fixed floating action button positioned bottom-right during recording. Tapping it opens `expo-camera` in a modal. On capture: saves the file locally via `expo-file-system`, inserts a `walk_photos` row into SQLite with the current location and timestamp. Does not block the recording loop.

### 9.10 `PermissionGate`

**`components/shared/permission-gate.tsx`** ← reused in Replay stage

```
Props:
  type: 'foreground' | 'background'
  onGranted: () => void
```

Renders an explanation card with an icon, a plain-language reason, and a primary CTA button. Calls the appropriate `Location.requestXPermissionsAsync()` on tap. On Android 12+ the background permission step opens a system settings screen rather than an in-app dialog — the component handles both paths.

### 9.11 `WalkSummaryCard`

**`components/shared/walk-summary-card.tsx`** ← reused in Review stage

```
Props:
  walk: {
    title?: string;
    startedAt: number;
    endedAt: number;
    stats: WalkStats;
  }
  onViewMap?: () => void
```

Post-walk summary inert card. Shows title, date, all stats in a `StatGrid`, and an optional "View on Map" button (disabled in stage one — wired up in stage two). This is the card rendered on the Walk Summary screen straight after recording stops.

---

## 10. Screen: Recording (`app/(tabs)/record.tsx`)

The recording screen has three visual states, driven by `useWalkSession()`:

### State A — Ready (idle, permissions granted)
- App name / logo header
- Empty stat placeholders (greyed `StatCard`s)  
- `RecordingStatusBadge status="idle"`
- `RecordingControls phase="idle"`

### State B — Active (recording or paused)
- `RecordingStatusBadge` at top (pulsing green or amber)
- `ElapsedTimer` (large, headline card — `size="lg"`)
- `StatGrid` (2 columns):
  - `DistanceDisplay`
  - `PaceDisplay`
  - `AltitudeDisplay`
  - current accuracy indicator (small, for transparency)
- `RecordingControls phase="recording"|"paused"` pinned to bottom
- `PhotoButton` floating above controls

### State C — Completing
- Brief "Calculating your walk..." overlay with an activity indicator
- Fires post-processing then navigates to summary

### State D — Permission required
- `PermissionGate` fills the screen, controls disabled

**No map is rendered on this screen.** The recording screen has zero dependency on any map SDK.

---

## 11. Screen: Walk Summary (`app/walk-summary.tsx`)

Reached automatically after `stop()` completes post-processing. Accessible later from the walk library.

- `WalkSummaryCard` with full stats
- Share / rename options (deferred to later — placeholder only in MVP)
- "Done" button → navigates to home/library tab
- "View on Map" → disabled with a tooltip in stage one; wired in stage two

---

## 12. File & Folder Structure

```
app/
  _layout.tsx              ← import background-task.ts here
  walk-summary.tsx         ← post-walk summary screen
  (tabs)/
    record.tsx             ← recording screen

components/
  shared/
    permission-gate.tsx
    stat-card.tsx
    stat-grid.tsx
    walk-summary-card.tsx
  recording/
    altitude-display.tsx
    distance-display.tsx
    elapsed-timer.tsx
    pace-display.tsx
    photo-button.tsx
    recording-controls.tsx
    recording-status-badge.tsx

hooks/
  use-location-permission.ts
  use-location-task.ts
  use-walk-session.ts
  use-sync-trigger.ts

lib/
  db/
    client.ts
    walks.ts
    track-points.ts
    walk-photos.ts
    sync-jobs.ts
  location/
    background-task.ts     ← TaskManager.defineTask lives here
    haversine.ts           ← distance formula utility
    point-filter.ts        ← clean-point logic
    post-processing.ts     ← stats calculation
  sync/
    sync-manager.ts
    upload-walk.ts

convex/
  schema.ts                ← already created
  walks.ts
  track-points.ts
  walk-photos.ts
  sync-jobs.ts
```

---

## 13. Sequenced Work Items

### Phase 1 – Foundation (no UI)
- [ ] Install dependencies
- [ ] Update `app.json` with permissions and plugins
- [ ] Create `lib/db/client.ts` — open SQLite, run migrations
- [ ] Create all four SQLite table definitions
- [ ] Create `lib/db/` CRUD modules for all tables
- [ ] Write `lib/location/haversine.ts` utility
- [ ] Run development build (`npx expo run:ios` / `npx expo run:android`) — required for background location testing

### Phase 2 – Location Layer
- [ ] Create `lib/location/background-task.ts` — define the task
- [ ] Import `background-task.ts` in `app/_layout.tsx`
- [ ] Create `hooks/use-location-permission.ts`
- [ ] Create `hooks/use-location-task.ts` (start/stop wrapper)

### Phase 3 – Session State Machine
- [ ] Create `hooks/use-walk-session.ts` (start/pause/resume/stop)
- [ ] Create `lib/location/point-filter.ts`
- [ ] Create `lib/location/post-processing.ts`

### Phase 4 – Shared Components
- [ ] `StatCard`
- [ ] `StatGrid`
- [ ] `PermissionGate`

### Phase 5 – Recording Components
- [ ] `RecordingStatusBadge` (with pulse animation)
- [ ] `ElapsedTimer`
- [ ] `DistanceDisplay`
- [ ] `PaceDisplay`
- [ ] `AltitudeDisplay`
- [ ] `RecordingControls`
- [ ] `PhotoButton`

### Phase 6 – Screens
- [ ] `app/(tabs)/record.tsx`
- [ ] `WalkSummaryCard`
- [ ] `app/walk-summary.tsx`

### Phase 7 – Sync Pipeline
- [ ] Convex mutations (`convex/walks.ts`, `convex/track-points.ts`, `convex/walk-photos.ts`)
- [ ] `lib/sync/upload-walk.ts`
- [ ] `lib/sync/sync-manager.ts`
- [ ] `hooks/use-sync-trigger.ts`

### Phase 8 – Integration & Device Testing
- [ ] End-to-end test: start → background lock phone → walk 5+ minutes → stop → verify point count in SQLite
- [ ] Test sync: disable WiFi, record walk, re-enable, confirm Convex receives data
- [ ] Test force-quit: confirm SQLite data is intact, walk can be viewed in library from local data

---

## 14. Key Constraints and Platform Realities

| Constraint | Detail |
|---|---|
| **Force-quit ends recording** | Background task stops when the user swipes the app away. Tell users clearly at session start. |
| **Development build required** | Background location does not work in Expo Go. All real device testing must use `npx expo run:*`. |
| **Android foreground service** | Android requires a visible notification while location runs in the background. The foreground service options in `startLocationUpdatesAsync` handle this. |
| **iOS "Always" permission** | Needed for reliable background updates. The two-step permission flow (When In Use first, then Always) is required by Apple. |
| **Background task JS runtime** | The task runs in a separate JS context. It cannot share React state with the main app. The only communication channel is SQLite. |
| **Battery vs accuracy tradeoff** | `distanceInterval: 5` prevents recording while stationary. Combined with `timeInterval: 5000`, battery impact is acceptable for a typical 1–3 hour walk. |
| **Altitude noise** | Raw altitude is often ±10–20 m. Post-processing smoothing is essential before presenting elevation gain/loss to the user. |
