# Android Health Connect – Integration Exploration

This document explores how Android Health Connect could be integrated into the walking
app, what data types are available, what user-facing features they would unlock, and
the realistic implementation path from a React Native / Expo perspective.

---

## 1. What Is Health Connect?

Health Connect is Android's centralised health and fitness data platform. It acts as a
privacy-controlled data vault on the device: apps can read and write health records
(steps, heart rate, exercise sessions, calories, etc.) and the user controls exactly
which apps are allowed access to which data types.

It ships pre-installed on **Android 14+** and is available as a downloadable Play
Store package for **Android 9–13**.

**Google Fit is being deprecated in 2026.** The official migration guidance from
Google is to adopt Health Connect for all phone-side fitness data. Apps that previously
used the Fit Recording API for steps, the History API for read/write, or the Session API
for activity summaries are all directed to Health Connect. This makes Health Connect the
correct and forward-looking API to target.

**Reference:**
- https://developer.android.com/health-and-fitness/health-connect
- https://developer.android.com/health-and-fitness/health-connect/migration/fit

---

## 2. Android-Only: iOS Alternative

Health Connect is Android-only. For a cross-platform walking app:

| Platform | APIs |
|---|---|
| **Android** | **Health Connect** (`react-native-health-connect`) |
| **iOS** | **HealthKit** (`react-native-health`) |

The app already targets Android first, so this document focuses on Health Connect. The
conceptual features below all have HealthKit equivalents. A future iOS phase would wrap
the same feature using the HealthKit equivalents — `HKQuantityType.stepCount`,
`HKWorkout`, `HKQuantityType.activeEnergyBurned`, etc.

---

## 3. React Native Package

The community package **`react-native-health-connect`** provides a typed React Native
bridge to the Android Health Connect Jetpack library.

```bash
npx expo install react-native-health-connect
```

**Key package facts:**
- Maintained on GitHub: `matinzd/react-native-health-connect`
- Mirrors the Health Connect Jetpack API closely — `initialize()`, `requestPermission()`,
  `readRecords()`, `insertRecords()`, `aggregateRecord()`, etc.
- Returns typed TypeScript results.
- Requires a **development build** (not compatible with Expo Go).
- Minimum Android SDK 26 (Android 8 Oreo).

This is the only dependency needed — no direct Kotlin / Java native code required.

---

## 4. Data Types Relevant to the Walking App

Health Connect supports 40+ data types. Those most relevant to a walking and hiking app:

| Data Type | Record Class | Read or Write | What It Provides |
|---|---|---|---|
| **Steps** | `StepsRecord` | **READ** | Step count over a time interval. On Android 14+ the OS writes these automatically when any app holds `READ_STEPS` — no pedometer code required. |
| **Distance** | `DistanceRecord` | **WRITE** | We compute distance in post-processing and push it in so it appears correctly in Health Connect history. |
| **Active Calories Burned** | `ActiveCaloriesBurnedRecord` | **READ or WRITE** | Read if a wearable has already written it for the walk window; estimate and write ourselves if not (requires weight). See Section 5.4. |
| **Total Calories Burned** | `TotalCaloriesBurnedRecord` | **READ** | Active + basal calories combined. Only available if written by another app. |
| **Elevation Gained** | `ElevationGainedRecord` | **WRITE** | We computed elevation in post-processing; we push it in. |
| **Exercise Session** | `ExerciseSessionRecord` | **WRITE** | A structured workout entry with type, start/end, title, and — critically — an embedded `ExerciseRoute` (GPS polyline). We build this from our walk data. |
| **Exercise Route** | embedded in `ExerciseSessionRecord` | **WRITE** | Our GPS clean points, written as part of the exercise session. Shareable with other apps (Strava, Google Maps, etc.) via a one-time user consent dialog. |
| **Heart Rate** | `HeartRateRecord` | **READ** | BPM series. We never produce heart rate — this is only present if the user has a paired wearable (Wear OS watch, Fitbit, Garmin) whose companion app writes to Health Connect. |
| **Speed** | `SpeedRecord` | **WRITE or READ** | We can derive speed from our GPS track and write it, or read it if another source provides it. |

---

## 5. Features These Would Unlock

### 5.1 Step Counter During Recording

**What:** Display a live step count card alongside distance and pace during an active recording session.

**How it works:**
- On Android 14+, Health Connect provides on-device step counting automatically — no
  pedometer code required in our app. Steps are batched and written to the Health
  Connect database roughly once per minute.
- Before the walk starts, query the current cumulative step count as a baseline.
- At display time, query again and subtract the baseline to get walk-specific steps.
- `StepsRecord.COUNT_TOTAL` is returned by an aggregate query over the walk time range.

**User value:** Steps are a universal walking metric. "8,642 steps" resonates with
users who track daily step goals regardless of whether they care about GPS distance.

**New `StatCard`:** `StepsDisplay` — shows `count` formatted with thousands separator,
label `"STEPS"`, no unit suffix.

---

### 5.2 Write Walk as Exercise Session

**What:** After a walk is completed and post-processed, write an `ExerciseSessionRecord`
to Health Connect. This:
- Makes the walk appear in the Health Connect app, Google Fit (legacy), Samsung Health,
  Strava, and any other app with Health Connect read access.
- Publishes the GPS route as an `ExerciseRoute` embedded in the session, enabling
  third-party apps to display the map.
- The walk counts towards the user's daily active minutes and calorie burn goals in
  those apps.

**Exercise type to use:** `ExerciseSessionRecord.EXERCISE_TYPE_WALKING` (or
`EXERCISE_TYPE_HIKING` for longer/elevation-heavy walks — could be auto-selected based
on elevation gain threshold).

**When to write:** During the existing sync pipeline in `lib/sync/upload-walk.ts`, after
Convex upload succeeds. Or immediately in `stop()` / post-processing, since this is
local and does not require connectivity.

**ExerciseRoute from our clean points:**
```ts
const route = ExerciseRoute(
  cleanPoints.map(pt => ({
    time: new Date(pt.timestamp),
    latitude: pt.latitude,
    longitude: pt.longitude,
    altitude: pt.altitudeMetres ?? undefined,
    horizontalAccuracy: pt.accuracyMetres,
  }))
);
```

---

### 5.3 Write Steps and Distance for the Walk

**What:** After post-processing, insert a `StepsRecord` and `DistanceRecord` covering
the walk's time range. This ensures the walk's steps and distance are attributed
correctly in Health Connect's activity history rather than relying solely on the
background OS pedometer (which may double-count if we also read from it).

**Pattern:**
```ts
await insertRecords([
  {
    recordType: 'Steps',
    count: walk.stats.stepCount,
    startTime: walk.startedAt,
    endTime: walk.endedAt,
  },
  {
    recordType: 'Distance',
    distance: { value: walk.stats.distanceMetres, unit: 'meters' },
    startTime: walk.startedAt,
    endTime: walk.endedAt,
  },
]);
```

> **Note on step counting accuracy:** GPS distance and pedometer step counts are
> independent signals. GPS gives accurate distance; the pedometer gives accurate
> step count. Both should be written. Our current post-processing does not yet
> compute step count — this would require integrating a step reading during recording
> (see Section 5.1) or querying the final total from Health Connect after the walk.

---

### 5.4 Calorie Burn Display

**Important — Health Connect is a data store, not a computation engine.** It does not
calculate calories for you from GPS or step data. Calories only appear in Health Connect
if another app or device has already written them there.

There are two paths:

**Path A — Read from a wearable (no work required):**
If the user has a Wear OS watch, Fitbit, Garmin, or any device whose companion app
writes to Health Connect, calories for the walk time window will already be in Health
Connect. We query `ACTIVE_CALORIES_TOTAL` over the walk's start/end time and display
it. If the user has no wearable, this query returns null — show `--`.

**Path B — Estimate and write ourselves:**
We can calculate an approximation using a standard MET (Metabolic Equivalent of Task)
formula, e.g. `calories = MET × weight_kg × duration_hours`. Walking MET is roughly
3.5–5 depending on speed. This requires knowing the user's weight — either from a
`WeightRecord` in Health Connect (if they've entered it in a health app) or by asking
the user to optionally enter their weight in app settings.

For MVP, **Path A** is the lower-effort option: query and display if available, show
`--` if not. Path B can be added later as an opt-in setting.

**Permission:** `READ_ACTIVE_CALORIES_BURNED` for Path A;
`WRITE_ACTIVE_CALORIES_BURNED` additionally for Path B.

**Fall back gracefully:** If Health Connect is unavailable or permission denied, show
`--`. Never block walk completion on this.

---

### 5.5 Read Heart Rate From Paired Wearables

**What:** If the user has a Wear OS watch or any BLE heart rate monitor that writes to
Health Connect, read `HeartRateRecord` over the walk time range during post-processing
and store `avgHeartRate` / `maxHeartRate` in `stats_json`.

Display them as `StatCard`s on the walk review screen:
- `AVG HR — 142 bpm`
- `MAX HR — 168 bpm`

This is entirely passive: our app reads, never writes heart rate. No new sensor code
required.

---

### 5.6 Historical Activity Dashboard

**What:** A new tab (or a section within the history screen) showing the user's
cumulative walking stats by reading back all previously synced `ExerciseSessionRecord`
entries and `StepsRecord` aggregates from Health Connect.

Example widgets:
- Total distance walked this month
- Total steps this week vs daily goal
- Longest walk ever
- Elevation profile across walks

These queries are aggregate reads from Health Connect — no additional local SQLite
schema changes needed.

---

## 6. Permissions Required

All Health Connect permissions must be declared in `AndroidManifest.xml` and requested
at runtime. The user is shown the Health Connect permissions UI (not Android system
dialogs) before access is granted.

For the features described above:

```xml
<!-- app.json → android.permissions array -->
"android.permission.health.READ_STEPS"
"android.permission.health.WRITE_STEPS"
"android.permission.health.WRITE_DISTANCE"
"android.permission.health.READ_DISTANCE"
"android.permission.health.WRITE_EXERCISE"
"android.permission.health.READ_EXERCISE"
"android.permission.health.WRITE_EXERCISE_ROUTE"
"android.permission.health.READ_EXERCISE_ROUTES"
"android.permission.health.READ_ACTIVE_CALORIES_BURNED"
"android.permission.health.READ_TOTAL_CALORIES_BURNED"
"android.permission.health.WRITE_ACTIVE_CALORIES_BURNED"
"android.permission.health.READ_HEART_RATE"
```

**Important:** Users can revoke any Health Connect permission at any time. Every read or
write must be guarded with a permission check. Never block core app functionality (walk
recording, review) on Health Connect availability or permissions.

---

## 7. Availability Checks

Health Connect may not be installed on all devices (older Android versions) or may be
disabled by the user. The app must check before using any Health Connect API:

```ts
import { initialize, getSdkStatus, SdkAvailabilityStatus } from 'react-native-health-connect';

async function isHealthConnectAvailable(): Promise<boolean> {
  const status = await getSdkStatus();
  return status === SdkAvailabilityStatus.SDK_AVAILABLE;
}
```

If `SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED`, the app can deep-link to the Play Store
to prompt the user to install/update Health Connect. This is optional behaviour — never
required for core functionality.

---

## 8. Play Store Requirements

**Apps that access Health Connect data types must complete a health apps declaration
in the Play Console before publishing.** This is a mandatory review by Google where
you declare:

- Which data types your app reads and writes
- Why your app needs access
- A link to your privacy policy that covers health data handling

The review can take 1–4 weeks. **Plan for this before a public release.** For
development and internal testing builds, no declaration is needed.

Reference: https://developer.android.com/health-and-fitness/guides/health-connect/publish/declare-access

---

## 9. Implementation Approach

### Guiding Principles for Health Connect Integration

1. **Health Connect is additive, never blocking.** All Health Connect writes happen
   after the core walk is complete. All Health Connect reads are best-effort. Missing
   or unavailable data shows `--`, never an error.

2. **Request permissions lazily, at the point of use.** Do not ask for Health Connect
   permissions at app launch. Ask for `READ_STEPS` just before the recording screen
   shows. Ask for `WRITE_EXERCISE` just before the first time the app tries to sync
   a completed walk.

3. **Write once, at sync time.** The exercise session, steps, and distance records are
   written during the existing Convex sync pipeline. This means they are written once,
   not during the walk. No Health Connect writes happen in the hot recording path.

4. **Isolate all Health Connect code.** Place all interactions in
   `lib/health-connect/` so the layer can be stubbed for unit tests and can be
   swapped for HealthKit on iOS in a future phase.

---

### Proposed Module Structure

```
lib/
  health-connect/
    client.ts               ← initialize(), getSdkStatus() wrapper
    permissions.ts          ← permission request and check helpers
    steps.ts                ← readStepsForWalk(), readTodayStepCount()
    exercise-session.ts     ← writeExerciseSession(walk, cleanPoints)
    calories.ts             ← readCaloriesForWalk()
    heart-rate.ts           ← readHeartRateForWalk()
    index.ts                ← re-exports
```

---

### Phased Rollout

Given the Play Store review overhead and the additive nature of Health Connect, a staged
approach is sensible:

#### Phase A — Step Counter During Recording (low complexity)
- Install `react-native-health-connect`
- Add native prebuild for `react-native-health-connect` plugin
- Declare `READ_STEPS` / `WRITE_STEPS` in `app.config.ts`
- Create `lib/health-connect/steps.ts`
- Request `READ_STEPS` permission before recording starts
- Read baseline step count at walk start, re-read at display tick, show delta as
  `StepsDisplay` `StatCard`
- Show `--` if Health Connect unavailable or permission denied

**Checkpoint:** Step count ticks up during a walk on the recording screen.

---

#### Phase B — Write Exercise Session After Walk (medium complexity)
- Declare `WRITE_EXERCISE`, `WRITE_EXERCISE_ROUTE` permissions
- Create `lib/health-connect/exercise-session.ts`
- In `lib/sync/upload-walk.ts` (after Convex upload), call
  `writeExerciseSession(walk, cleanPoints)`
- Walk appears in Health Connect app / Strava / Google Fit
- Add a `StatCard` or badge on the walk review screen: "Synced to Health Connect ✓"

**Checkpoint:** Completed walk appears in the Android Health Connect app with the
correct route, duration, and distance.

---

#### Phase C — Calorie and Heart Rate Display (low complexity, data-dependent)
- Declare `READ_ACTIVE_CALORIES_BURNED`, `READ_HEART_RATE` permissions
- Create `lib/health-connect/calories.ts` and `lib/health-connect/heart-rate.ts`
- In post-processing hook, after writing the exercise session, read back the Health
  Connect aggregate for calories and heart rate over the walk duration
- Store in `stats_json`: `caloriesKcal`, `avgHeartRateBpm`, `maxHeartRateBpm`
- Display as `StatCard`s on the review screen

**Checkpoint:** Walk review shows calories and heart rate for users who have a connected
wearable or a paired fitness app.

---

#### Phase D — Historical Activity Dashboard (higher complexity, deferred)
- New screen or section in the history tab
- Reads Health Connect aggregate totals by time range
- Month/week selectors
- Best suited for a later stage once the core recording and review pipeline is solid

---

## 10. Key Constraints and Risks

| Risk | Mitigation |
|---|---|
| Health Connect not installed on device | `getSdkStatus()` check before any API call. Fall back gracefully to `--`. Deep-link to Play Store as optional UX. |
| User denies Health Connect permissions | All HC features degrade silently to `--`. Never block recording or review. |
| Play Store review delay | Start health apps declaration process early. Can ship app without HC features initially and add them in a follow-up release. |
| Step count double-counting | On Android 14+ HC provides on-device step counting AND we can query `StepsRecord`. Reading the aggregate (not inserting) avoids duplication. Only insert `StepsRecord` at walk completion if we derived step count ourselves. |
| Exercise route consent dialog (third-party reads) | Route data written by our app can only be read by other third-party apps via a one-time user consent dialog. This is enforced by HC itself — no action needed on our side. |
| `react-native-health-connect` development pace | Community package; track releases. The underlying Jetpack library is stable and Google-maintained. The React Native bridge is actively maintained but may lag slightly behind new HC Jetpack versions. |
| iOS users get no Health Connect | iOS path requires a separate `react-native-health` / HealthKit integration. Scope that as a separate phase. |
