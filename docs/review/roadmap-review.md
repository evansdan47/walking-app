# Stage Two: Review – Implementation Roadmap

This document is the firm implementation plan for the walk review feature. It covers
Mapbox SDK installation, native config, data queries, component architecture, screen
design, and sequenced work items.

---

## 1. Guiding Principles

1. **Review is read-only on data, offline-first.** The review screen loads entirely from
   SQLite. It never blocks on a network call. Sync happens later; review is always
   available.
2. **Post-walk summary IS the review screen.** `app/walk-summary.tsx` is replaced by a
   full `app/walk-review.tsx`. The walk session hook navigates there after stop. The
   history list also routes there.
3. **Mapbox is used in both recording and review, but for different purposes.**
   During recording, a live map shows the user's current position and the
   points being written in real time (simplified style, to be decided). During
   review, the map shows the completed route as a clean polyline with start/end
   markers and photo pins. Map components shared between both screens live in
   `components/map/`; review-specific components live in `components/review/`.
4. **Raw points are never mutated.** Only `is_clean` and `title` columns change after
   recording. The raw GPS record is permanent.
5. **Shared components are reused.** `StatCard`, `StatGrid`, `DistanceDisplay`,
   `PaceDisplay`, `AltitudeDisplay`, and `AppHeader` carry over unchanged.

---

## 2. Dependencies to Add

```bash
npx expo install @rnmapbox/maps react-native-svg
npx expo install @gorhom/bottom-sheet react-native-reanimated react-native-gesture-handler
```

| Package | Purpose |
|---|---|
| `@rnmapbox/maps` | React Native wrapper for Mapbox Maps SDK (Android v11, iOS v11) |
| `react-native-svg` | SVG primitives for the elevation profile chart |
| `@gorhom/bottom-sheet` | Bottom sheet overlay for map-first screen layouts (recording and review) |

> `react-native-svg` and `react-native-reanimated` / `react-native-gesture-handler`
> may already be installed transitively. Check before installing.
>
> `@gorhom/bottom-sheet` requires `react-native-reanimated` ≥ 2 and
> `react-native-gesture-handler`. Both are standard Expo SDK packages.
> After installing, wrap the root navigator with `<GestureHandlerRootView>` and
> `<BottomSheetModalProvider>` (see recording roadmap Phase 9).

### Important: Two Mapbox Tokens

Mapbox requires **two separate tokens**:

| Token | Starts with | Purpose |
|---|---|---|
| **Public token** | `pk.` | Authenticates map tile requests at runtime. Used in the app. Already in `.env.local`. |
| **Secret token** (with `DOWNLOADS:READ` scope) | `sk.` | Authenticates download of the native Mapbox SDK from Mapbox's private Maven repository at build time. Never shipped in the app. |

The public token (`pk.`) you already have in `.env.local` covers runtime map usage.

The secret token is required only because `@rnmapbox/maps` bundles a native Android
library that Mapbox hosts on a private Maven repository — Gradle must authenticate to
download it during `expo run:android`. Without it the build fails with a 401 error.

**How to create the secret token:**
1. Go to `https://console.mapbox.com/account/access-tokens/`
2. Click **Create a token**
3. Under **Secret scopes**, check **`DOWNLOADS:READ`** only — no other scopes needed
4. Give it a name like `walking-app-build` and save
5. Copy the `sk.` value immediately — Mapbox only shows it once

Store it in `.env.local`:
```
MAPBOX_SECRET_DOWNLOAD_TOKEN=sk.eyJ...your_secret_token...
```

> **Never commit the secret token.** `.env.local` is already in `.gitignore`.
> The secret token is used only by Gradle at build time and is never bundled
> into the app or visible to end users.

---

## 3. Native Configuration

### 3.1 `app.json` Plugin ✅ Done (via `app.config.ts`)

The `@rnmapbox/maps` plugin is already configured. `app.json` has been converted to
`app.config.ts` which extends the existing config dynamically and injects the plugin.
The secret download token is read from `RNMAPBOX_MAPS_DOWNLOAD__TOKEN` (double
underscore) in `.env.local` — it is **never** hardcoded in a tracked file.

The current `app.config.ts` is the canonical config. Do not add the plugin directly
to `app.json`. The static `app.json` file is kept only as the base that `app.config.ts`
spreads.

### 3.2 Dynamic Config (`app.config.ts`)

Convert `app.json` to `app.config.ts` if not already done, so the secret token is
injected from the environment variable rather than written in the file:

```ts
// app.config.ts
import { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  // ...all existing app.json fields...
  plugins: [
    'expo-router',
    ['expo-location', { /* ... */ }],
    [
      '@rnmapbox/maps',
      {
        RNMapboxMapsImpl: 'mapbox',
        RNMapboxMapsDownloadToken: process.env.MAPBOX_SECRET_DOWNLOAD_TOKEN ?? '',
      },
    ],
  ],
};

export default config;
```

### 3.3 Access Token Initialisation

The public access token must be set before any map component renders. Do this once in
`app/_layout.tsx`:

```ts
import Mapbox from '@rnmapbox/maps';

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '');
```

Add to `.env.local`:
```
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ...your_public_token...
```

Note: `MAPBOX_ACCESS_TOKEN` is already present but uses the non-`EXPO_PUBLIC_` prefix
(not visible to the JS bundle). Add the `EXPO_PUBLIC_` prefixed version alongside it.

### 3.4 Required Rebuild

After adding the plugin and running `npx expo prebuild --clean`, a full native rebuild
is required:

```bash
npx expo prebuild --clean
npx expo run:android
```

This is mandatory — `@rnmapbox/maps` includes native code that Metro alone cannot
deliver.

---

## 4. Database Layer Changes

Two new query functions and one update function are needed. All in existing files.

### 4.1 `lib/db/track-points.ts` — Add `getCleanPointsForWalk`

```ts
export function getCleanPointsForWalk(walkId: string): TrackPoint[] {
  // SELECT ... WHERE walk_id = ? AND is_clean = 1 ORDER BY timestamp ASC
  // Falls back to all points if none are marked clean yet (defensive).
}
```

Used by the map route and elevation chart. Only clean points are displayed — this
eliminates GPS spikes from the visual route.

### 4.2 `lib/db/track-points.ts` — Add `getFirstPointForWalk`

```ts
export function getFirstPointForWalk(walkId: string): TrackPoint | null {
  // SELECT * FROM track_points WHERE walk_id = ? ORDER BY timestamp ASC LIMIT 1
}
```

Used by the history screen to determine each walk's start coordinate for the
overview map markers.

### 4.3 `lib/db/walks.ts` — Add `listCompletedWalks`

```ts
export function listCompletedWalks(): Walk[] {
  // SELECT * FROM walks WHERE status = 'completed' ORDER BY started_at DESC
}
```

Used by the history list screen. Ordered newest-first.

### 4.4 `lib/db/walks.ts` — Add `updateWalkTitle`

```ts
export function updateWalkTitle(walkId: string, title: string): void {
  // UPDATE walks SET title = ? WHERE id = ?
}
```

Called when the user confirms a title edit in the review screen.

### 4.5 `lib/db/walks.ts` — Add `deleteWalk`

```ts
export function deleteWalk(walkId: string): void {
  // DELETE FROM track_points WHERE walk_id = ?
  // DELETE FROM walk_photos WHERE walk_id = ?
  // DELETE FROM sync_jobs WHERE walk_id = ?
  // DELETE FROM walks WHERE id = ?
  // (in that order, to respect foreign key ordering)
}
```

Called from the delete confirmation dialog on the review screen.

---

## 5. Data Preparation Layer

Location: `lib/review/`

These functions are called once when the review screen loads. They are synchronous
(SQLite is sync via `expo-sqlite`).

### 5.1 `lib/review/build-route.ts`

```ts
export interface RoutePoint {
  latitude: number;
  longitude: number;
  altitude: number | null;
  timestamp: number;
}

export function buildRoute(walkId: string): RoutePoint[] {
  // 1. Call getCleanPointsForWalk(walkId)
  // 2. Map to RoutePoint[]
  // 3. Return empty array if no clean points (renders nothing gracefully)
}
```

### 5.2 `lib/review/build-geojson.ts`

```ts
import type { Feature, LineString } from 'geojson';

export function buildRouteGeoJSON(points: RoutePoint[]): Feature<LineString> {
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: points.map((p) => [p.longitude, p.latitude]),
    },
    properties: {},
  };
}
```

This is passed directly to Mapbox's `ShapeSource`. Using a GeoJSON `LineString` rendered
as a `LineLayer` is the correct approach for a route polyline — it performs far better
than individual annotations for walks of any length.

### 5.3 `lib/review/build-elevation-profile.ts`

```ts
export interface ElevationPoint {
  distanceMetres: number;  // cumulative distance from start
  altitudeMetres: number;
}

export function buildElevationProfile(points: RoutePoint[]): ElevationPoint[] {
  // 1. Filter to points with altitude != null
  //    If fewer than 2 altitude points, return []
  // 2. For each point, accumulate Haversine distance from previous
  // 3. Return array of { distanceMetres, altitudeMetres }
}
```

Returns an empty array when altitude data is insufficient — the chart component renders
`null` rather than crashing.

---

## 6. React Components

All new components live in `components/review/` unless marked **shared**.

### 6.1 `components/review/route-map.tsx`

The main Mapbox map showing the walk route, start/end markers, and photo pins.

```
Props:
  points:   RoutePoint[]
  photos:   WalkPhoto[]     — from lib/db/walk-photos.ts getPhotosForWalk()
  onPhotoTap: (photo: WalkPhoto) => void
  style?:   ViewStyle
```

**Implementation:**

```tsx
import MapboxGL from '@rnmapbox/maps';

// Route rendered as ShapeSource + LineLayer (GeoJSON LineString).
// Camera auto-fits to the route bounding box on first render.
// Padding of ~60dp on all sides so the route is not clipped by screen edges.

const routeGeoJSON = buildRouteGeoJSON(points);
const bounds = computeBounds(points);

<MapboxGL.MapView
  styleURL={MapboxGL.StyleURL.Outdoors}
  logoEnabled={true}
  attributionEnabled={true}
>
  <MapboxGL.Camera
    bounds={{ ne: bounds.ne, sw: bounds.sw, paddingTop: 60, paddingBottom: 60,
              paddingLeft: 40, paddingRight: 40 }}
    animationDuration={0}
  />

  {/* Route line */}
  <MapboxGL.ShapeSource id="route" shape={routeGeoJSON}>
    <MapboxGL.LineLayer
      id="route-line"
      style={{
        lineColor: Colors.light.primary,   // Burnt ochre
        lineWidth: 4,
        lineJoin: 'round',
        lineCap: 'round',
      }}
    />
  </MapboxGL.ShapeSource>

  {/* Start marker — green circle */}
  {points.length > 0 && (
    <MapboxGL.PointAnnotation
      id="start"
      coordinate={[points[0].longitude, points[0].latitude]}
    >
      <StartMarker />
    </MapboxGL.PointAnnotation>
  )}

  {/* End marker — ochre square */}
  {points.length > 1 && (
    <MapboxGL.PointAnnotation
      id="end"
      coordinate={[points[points.length - 1].longitude, points[points.length - 1].latitude]}
    >
      <EndMarker />
    </MapboxGL.PointAnnotation>
  )}

  {/* Photo pins */}
  {photos.map((photo) => (
    <MapboxGL.PointAnnotation
      key={photo.id}
      id={`photo-${photo.id}`}
      coordinate={[photo.longitude, photo.latitude]}
      onSelected={() => onPhotoTap(photo)}
    >
      <PhotoPin />
    </MapboxGL.PointAnnotation>
  ))}
</MapboxGL.MapView>
```

**Helper: `computeBounds(points)`**

```ts
function computeBounds(points: RoutePoint[]) {
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  return {
    ne: [Math.max(...lngs), Math.max(...lats)] as [number, number],
    sw: [Math.min(...lngs), Math.min(...lats)] as [number, number],
  };
}
```

Guard: if `points.length === 0`, render a `<MapPlaceholder />` card instead of an
empty Mapbox view (avoids a degenerate camera state).

**Attribution:** Mapbox `logoEnabled` and `attributionEnabled` must both be `true`.
They can be repositioned but not hidden — required by Mapbox terms of service.

### 6.2 `components/review/elevation-chart.tsx`

A simple SVG line chart built with `react-native-svg`. No third-party charting library.

```
Props:
  data:    ElevationPoint[]   — from buildElevationProfile()
  height?: number             — defaults to 80
  style?:  ViewStyle
```

**Implementation sketch:**

```tsx
import Svg, { Path, Text as SvgText } from 'react-native-svg';

// Normalise data to SVG viewport (e.g. width = container width, height = 80)
// x = (point.distanceMetres / totalDistance) * svgWidth
// y = svgHeight - ((alt - minAlt) / (maxAlt - minAlt)) * svgHeight
// Build SVG <Path> d string from x/y pairs
// Fill below the line with low-opacity forest green

// Y axis: min/max altitude labels at left edge (e.g. "42 m" / "118 m")
// X axis: total distance label at right edge (e.g. "3.2 km")
// No gridlines — keep it clean and readable
```

Returns `null` if `data.length < 2` or all altitudes are identical. The elevation
section in the review screen is conditionally rendered based on this.

The chart is **not interactive** in MVP. Tap-to-seek can be added in Stage 3.

### 6.3 `components/review/walk-header-card.tsx`

Title display with inline edit, and date/duration metadata.

```
Props:
  walkId:           string
  title:            string | null
  startedAt:        number
  endedAt:          number
  durationSeconds:  number
  onTitleChanged:   (newTitle: string) => void
```

**Behaviour:**
- Default display: walk date as "Saturday, 28 March 2026" with formatted duration below.
- If `walk.title` is null, display the formatted date as the title.
- Tapping the title enters edit mode: shows a `TextInput`, confirm tick, and cancel ×.
- On confirm: calls `updateWalkTitle(walkId, newTitle)` then `onTitleChanged(newTitle)`.
- Validation: trim whitespace; if empty, revert to the date-based default string.

### 6.4 `components/review/photo-viewer-modal.tsx`

Full-screen modal shown when the user taps a photo pin on the map.

```
Props:
  photo:   WalkPhoto | null
  onClose: () => void
```

- React Native `<Modal presentationStyle="overFullScreen" transparent>`.
- Photo displayed full-screen via `<Image source={{ uri: photo.localUri }} resizeMode="contain" />`.
- Back button overlay (top-left) and photo timestamp overlay (bottom-centre).
- No photo editing, sharing, or captioning in MVP.

### 6.5 `components/review/walk-stat-summary.tsx`

The stats section below the map. Reuses existing shared components.

```
Props:
  stats: WalkStats
  unit?: 'km' | 'mi'
```

Renders a `StatGrid` (3 columns) containing:
- `DistanceDisplay` — total distance
- `DurationDisplay` — total elapsed time as HH:MM:SS (static, not ticking)
- `PaceDisplay` — average pace
- `ElevationGainDisplay` — shows `↑ Xm / ↓ Ym` (or `--` if absent)
- `StatCard label="MOVING"` — `movingTimeSeconds` formatted as HH:MM:SS
- `StatCard label="STOPPED"` — `stoppedTimeSeconds` formatted as HH:MM:SS

> **New shared component: `components/recording/duration-display.tsx`**
>
> ```
> Props:
>   durationSeconds: number
>   label?: string      — defaults to "Duration"
> ```
>
> Static version of `ElapsedTimer` (no interval). Formats seconds to HH:MM:SS.
> Renders as a `StatCard`. Reused across summary and review screens.

### 6.6 `components/review/walk-action-bar.tsx`

A row of action buttons at the bottom of the review screen.

```
Props:
  onDelete: () => void
  onShare?:  () => void   — prop exists but hidden/disabled in MVP
```

- **Delete**: outlined destructive button. Tapping shows `Alert.alert` confirmation:
  *"Delete walk? This cannot be undone."* → Confirm calls `deleteWalk(walkId)` then
  navigates back to the history list.
- Share button is not rendered in MVP. The prop is a forward-compatibility hook for Stage 3.

### 6.7 `components/review/history-walk-card.tsx`

A list card rendered for each completed walk in the history screen.

```
Props:
  walk:    Walk
  onPress: () => void
```

Displays:
- Walk title (or date-based default when `walk.title` is null)
- Formatted date + start time
- Distance and duration as two inline stat pills
- `chevron-forward` Ionicon (right side)
- A 3dp left border in `Colors.primary` (ochre) for visual rhythm

No map thumbnail in MVP. A static map image using the Mapbox Static Images API
can be added in Stage 3 once sync is in place.

---

## 7. Screens

### 7.1 `app/walk-review.tsx` (replaces `app/walk-summary.tsx`)

The full walk review screen. Entry points:

1. **Post-walk**: `hooks/use-walk-session.ts` `stop()` navigates here after
   post-processing completes.
2. **History list**: `app/(tabs)/explore.tsx` taps navigate here.

Both use `router.push('/walk-review?walkId=...')`.

**Screen layout (map-first, bottom sheet overlay):**

```
┌─────────────────────────────────────────┐
│  MapboxGL.MapView  (100 % screen)       │
│  – completed route polyline             │
│  – start marker, end marker             │
│  – photo pin annotations                │
└─────────────────────────────────────────┘
         ↑ (behind everything)

┌─────────────────────────────────────────┐
│  BottomSheet (snaps over map)           │
│                                         │
│  ── Collapsed snap point (~25 %) ──     │
│    Walk title (or date default)         │
│    Distance • Duration  (headline row)  │
│                                         │
│  ── Expanded snap point (~70 %) ──      │
│    WalkHeaderCard (title + edit + date) │
│    ElevationChart (if ≥ 2 alt points)  │
│    WalkStatSummary (3-col StatGrid)     │
│    WalkActionBar (Delete)               │
└─────────────────────────────────────────┘

PhotoViewerModal — full-screen, rendered over everything
AppHeader with back chevron — rendered as absolute overlay
```

**Data loading (synchronous):**

```ts
const walk = getWalk(walkId);
const route = buildRoute(walkId);
const elevationProfile = buildElevationProfile(route);
const photos = getPhotosForWalk(walkId);
```

**Guards:**
- `walk === null` → error state card ("Walk not found") + back button.
- `walk.stats === null` → loading state (post-processing not yet complete). Should
  not occur in normal flow since navigation happens after post-processing, but handle
  defensively.
- `route.length === 0` → `RouteMap` renders a placeholder ("Route not available") — stats
  still render normally.

**Delete flow:**

```ts
function handleDelete() {
  Alert.alert(
    'Delete walk?',
    'This cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteWalk(walkId);
          router.replace('/(tabs)');
        },
      },
    ],
  );
}
```

**Cross-tab guard:** Before navigating here from the history list, check
`useWalkSessionContext().phase`. If `recording` or `paused`, show an alert and do not
navigate (see recording roadmap Phase 11).

### 7.2 History List Screen (`app/(tabs)/explore.tsx`)

Repurpose the existing `explore.tsx` tab as the walk history screen.

**Screen layout (map-first, bottom sheet overlay):**

```
┌─────────────────────────────────────────┐
│  MapboxGL.MapView  (100 % screen)       │
│  – one WalkStartDot per completed walk  │
│  – camera centred on most recent start  │
│  – scrollEnabled/pitch/rotate disabled  │
└─────────────────────────────────────────┘
         ↑ (behind everything)

┌─────────────────────────────────────────┐
│  BottomSheet (snaps over map)           │
│                                         │
│  ── Collapsed snap point (~15 %) ──     │
│    "X walks"   (drag handle row)        │
│                                         │
│  ── Expanded snap point (~75 %) ──      │
│    AppHeader title "My Walks"           │
│    FlatList of HistoryWalkCards         │
│    EmptyWalkHistory (when list empty)   │
└─────────────────────────────────────────┘
```

**Data loading:**

Walk list and map points refresh on screen focus so new walks appear after returning
from review:

```ts
const [walks, setWalks] = useState<Walk[]>([]);
const [startPoints, setStartPoints] = useState<{ walk: Walk; coordinate: [number, number] }[]>([]);

useFocusEffect(
  useCallback(() => {
    const completed = listCompletedWalks();
    setWalks(completed);
    const pts = completed
      .map((w) => {
        const pt = getFirstPointForWalk(w.id);
        return pt ? { walk: w, coordinate: [pt.longitude, pt.latitude] as [number, number] } : null;
      })
      .filter(Boolean);
    setStartPoints(pts);
  }, [])
);
```

**Tab bar icon:**

Update `app/(tabs)/_layout.tsx` to use `map-outline` (Ionicons) for this tab.
The current `code-slash` icon from the Expo template should be replaced.

**Empty state (`<EmptyWalkHistory />`):**

Centred card: map icon, "No walks yet", subtext
"Start recording to see your history here." No CTA needed — the Record tab is
one tap away.

---

## 8. Navigation

`app/walk-review.tsx` is a stack screen resolved automatically by `expo-router`
because it lives at `app/walk-review.tsx`. No routing configuration changes needed.

**Back navigation in `AppHeader`:**

Add an optional `showBack` prop to `AppHeader`. When true, render a back chevron
(`Ionicons chevron-back`) that calls `router.back()`. This works from both entry
points:
- Post-walk → back returns to the Record tab (session already reset to idle)
- History list → back returns to the history list

---

## 9. Sequenced Work Items

Work must be done in this order due to dependencies.

### Phase 1 — Mapbox Install and Smoke Test ✅

1. ✅ Create a new Mapbox **secret token** with only the `DOWNLOADS:READ` scope.
   `sk.` value added to `.env.local` as `RNMAPBOX_MAPS_DOWNLOAD__TOKEN` (double
   underscore — this is the env var name the plugin reads automatically).
2. ✅ Add `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` to `.env.local`.
3. ✅ Convert `app.json` to `app.config.ts`. Plugin injected without hardcoding the
   secret token (see Section 3.1).
4. ✅ Run `npx expo install @rnmapbox/maps react-native-svg`.
5. ✅ Run `npx expo prebuild --clean` then `npx expo run:android`.
6. ✅ Add `Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '')`
   to `app/_layout.tsx`.
7. ✅ Map live on the recording screen (Outdoors style, tracks user position).

**Checkpoint:** ✅ Map tiles render on device. No build errors.

---

### Phase 1.5 — Bottom Sheet Install ✅

8. ✅ Installed `@gorhom/bottom-sheet`, `react-native-reanimated`,
   `react-native-gesture-handler`.
9. ✅ Root layout wrapped with `<GestureHandlerRootView>` and
   `<BottomSheetModalProvider>`.
10. ✅ `npx expo prebuild --clean` + `npx expo run:android` successful.

The recording screen has a functional bottom sheet with per-sheet snap points
(Library `45%`, Profile `60%`, Record idle `58%`, Record active `23/33/43/58%`).
The Library bottom sheet is in place and can be adjusted once the history content
is wired up (Phase 6).

**Checkpoint:** ✅ App builds cleanly. Bottom sheet working on recording screen.

---

### Phase 2 — Data Layer ✅

8. ✅ Added `getCleanPointsForWalk(walkId)` to `lib/db/track-points.ts`.
   Falls back to all points when none are marked clean yet (defensive).
9. ✅ Added `getFirstPointForWalk(walkId)` to `lib/db/track-points.ts`.
10. ✅ Added `listCompletedWalks()` to `lib/db/walks.ts`.
11. ✅ Added `updateWalkTitle(walkId, title)` to `lib/db/walks.ts`.
12. ✅ Added `deleteWalk(walkId)` to `lib/db/walks.ts`.
13. ✅ Created `lib/review/build-route.ts` — `buildRoute()` and `buildRouteGeoJSON()`.
14. ✅ Created `lib/review/build-elevation-profile.ts` — `buildElevationProfile()`.
15. ✅ `npx tsc --noEmit` — 0 errors.

**Checkpoint:** ✅ TypeScript clean. Functions return correct shapes.

---

### Phase 3 — ReviewRouteLayer Component ✅

> **Architecture note:** Rather than creating a standalone `MapboxGL.MapView` inside
> a review component, the review route is rendered as a *layer component* placed
> inside the `MapboxGL.MapView` that already fills the screen — exactly the same
> pattern used by `LivePositionLayer` during recording. The screen (`walk-review.tsx`)
> owns the `MapboxGL.MapView`; `ReviewRouteLayer` is a child that contributes layers
> and a `Camera` bounds-fit, with no `MapView` of its own.

16. ✅ Created `components/review/review-route-layer.tsx`.
    - `ShapeSource` + `LineLayer` for the route polyline (burnt ochre, width 4).
    - `MapboxGL.Camera` bounds-fit with padding (80 top, 300 bottom for sheet,
      40 sides) via `animationDuration={0}`.
    - `PointAnnotation` for start (green circle) and end (ochre square) markers.
    - `PointAnnotation` per photo, calling `onPhotoTap` on select.
    - Returns `null` when `points.length === 0`.
17. ✅ `StartMarker`, `EndMarker`, `PhotoPin`, `WalkStartDot` defined inline in
    `review-route-layer.tsx`. `WalkStartDot` exported for use in the history map.

**Checkpoint:** ✅ TypeScript clean. ReviewRouteLayer ready to drop into any
`MapboxGL.MapView`. Route, markers and photo pins in place.

---

### Phase 4 — Elevation Chart

18. Create `components/review/elevation-chart.tsx` using `react-native-svg`.
    - Normalise altitude to SVG viewport.
    - Filled polyline with low-opacity background.
    - Min/max altitude labels; total distance label.
    - Returns `null` when data is insufficient.

**Checkpoint:** Chart renders with altitude data present. Returns gracefully when
altitude is absent.

---

### Phase 5 — Review Screen ✅

19. ✅ `components/recording/duration-display.tsx` — static `DurationDisplay` StatCard
    (takes `durationSeconds: number`). Exports `formatDuration` helper. Reuses the
    same HH:MM:SS format logic as `ElapsedTimer`. No new component needed — the
    existing `StatCard` pattern is followed exactly.
20. ✅ `components/review/walk-header-card.tsx` — title display with inline edit.
    Tap title → `TextInput` + confirm ✓ + cancel ×. Calls `updateWalkTitle` on
    confirm. Shows formatted date as subtitle. Falls back to date string when title
    is null.
21. ✅ `components/review/walk-stat-summary.tsx` — stats grid using shared components.
    `StatGrid columns={3}`: Distance, Duration, Pace, Elevation (↑gain ↓loss),
    Moving time, Stopped time. Uses `DistanceDisplay`, `DurationDisplay`,
    `PaceDisplay`, `StatCard`.
22. ✅ `components/review/walk-action-bar.tsx` — delete button. Shows `Alert.alert`
    confirmation before calling `onDelete`.
23. ✅ `components/review/photo-viewer-modal.tsx` — full-screen `Modal` with
    photo, close button (top-left), timestamp overlay (bottom-centre).
24. ✅ `app/walk-review.tsx` — map-first + `BottomSheet` layout:
    - `MapboxGL.MapView` fills screen with `ReviewRouteLayer` inside
    - Snap points `['25%', '70%']`, starts at index 0
    - Collapsed (25%): walk title + distance · duration peek row
    - Expanded (70%): `WalkHeaderCard` + `WalkStatSummary` + `WalkActionBar`
    - `PhotoViewerModal` over everything; tapping a map photo pin opens it
    - `AppHeader` (back chevron via `onBack` prop) as absolute overlay at top
    - Walk-not-found guard renders error state
25. ✅ Updated `hooks/use-walk-session.ts`: navigates to `/walk-review` after
    post-processing completes (was `/walk-summary`).
26. ✅ `AppHeader` already supports back button via `onBack` prop — no changes
    needed. `app/_layout.tsx` updated to register the `walk-review` stack screen.
27. ✅ `npx tsc --noEmit` — 0 errors.

**Checkpoint:** ✅ Full review screen builds cleanly. Map fills the screen with the
completed route. Bottom sheet starts collapsed showing headline stats and expands to
show full stats, editable title, and delete action. Photos render as map pins;
tapping opens the modal. Deleting returns to tabs.

---

### Phase 6 — History List Screen ✅

28. ✅ Rewrote `app/(tabs)/library.tsx` as the walk history screen (map-first +
    `BottomSheet` layout):
    - `MapboxGL.MapView` fills screen. `WalkStartDot` `PointAnnotation` per completed
      walk that has GPS points. Camera centres on most recent start point.
    - `BottomSheet` snap points `['15%', '75%']`, index 0 (collapsed on open).
      Collapsed: "X walks" count label visible. Expanded: `BottomSheetFlatList`
      of `HistoryWalkCard` items; `EmptyWalkHistory` when list is empty.
    - `useFocusEffect` reloads walk list and start points every time the screen
      gains focus (new walks appear immediately after returning from record).
    - Mapbox `logoEnabled` + `attributionEnabled` both true (legal requirement).
29. ✅ Tab icon update not required — `library.tsx` uses the existing tab slot;
    `_layout.tsx` still uses `<Slot />` with no native tab bar.
30. ✅ Created `components/review/history-walk-card.tsx` — bordered card with ochre
    left accent, walk title/date/time, distance + duration stat pills, chevron.
31. ✅ Created `components/review/empty-walk-history.tsx` — map icon + "No walks yet"
    centred placeholder.
32. ✅ `useFocusEffect` + `useCallback` wired in `library.tsx`.
33. ✅ Cross-tab recording guard in `handleWalkPress` — shows Alert and blocks
    navigation to review if a walk is active.

**Navigation change:** `app/(tabs)/index.tsx` updated — Library tap now calls
`router.push('/(tabs)/library')` instead of opening an in-map bottom sheet. The
library screen has an `AppHeader` with back button (`router.back()`).

**Checkpoint:** ✅ TypeScript 0 errors. History screen shows map with start dots
and bottom sheet walk list. Tapping a card navigates to walk review. Empty state
renders when no walks exist. Recording guard prevents accidental navigation.

---

### Phase 7 — Polish and Verification

34. Verify Mapbox logo and attribution are visible on all map instances (legal
    requirement — logo and attribution must remain on screen).
35. Verify map and stat cards render correctly in both light and dark mode.
36. Handle edge case: walk with 0 clean points — route shows placeholder, stats still
    render.
37. Handle edge case: walk with no altitude data — elevation chart hidden, elevation
    stats display `--`.
38. Handle edge case: walk deleted mid-history-list cycle (defensive null check on
    `getWalk` in review screen).
39. Run `npx tsc --noEmit` and confirm 0 errors.
40. Record a walk end-to-end → stop → review screen → verify all panels → return to
    history → verify new entry appears.

---

## 10. Folder Structure After Phase 7

```
app/
  (tabs)/
    _layout.tsx         ← tab icon updated for explore tab
    explore.tsx         ← rewritten as History list screen
    index.tsx           ← Record screen (unchanged)
  walk-review.tsx       ← NEW — full review screen (replaces walk-summary.tsx)

components/
  recording/
    duration-display.tsx  ← NEW — static HH:MM:SS StatCard
    ...existing unchanged...
  review/               ← NEW folder
    route-map.tsx
    elevation-chart.tsx
    walk-header-card.tsx
    walk-stat-summary.tsx
    walk-action-bar.tsx
    photo-viewer-modal.tsx
    history-walk-card.tsx
    empty-walk-history.tsx
    markers.tsx           ← StartMarker, EndMarker, PhotoPin, WalkStartDot
  shared/
    ...unchanged...

lib/
  db/
    walks.ts            ← + listCompletedWalks, + updateWalkTitle, + deleteWalk
    track-points.ts     ← + getCleanPointsForWalk, + getFirstPointForWalk
  review/               ← NEW folder
    build-route.ts
    build-geojson.ts
    build-elevation-profile.ts
```

---

## 11. Known Constraints and Risks

| Risk | Mitigation |
|---|---|
| Secret download token accidentally committed | Use `app.config.ts` with `process.env`. Never hardcode in a tracked file. |
| `@rnmapbox/maps` install fails (Maven auth error) | Verify secret token has `DOWNLOADS:READ` scope. Clear Gradle caches if a stale failed attempt was cached (`~/.gradle/caches`). |
| `PointAnnotation` flickers on re-render | Memoize `photos` and `points` arrays with `useMemo`. Do not re-derive inside render. |
| Long walks with many clean points slow GeoJSON build | `buildRouteGeoJSON` runs once synchronously. For long walks (~5,000 points) this is under 20ms — acceptable for MVP. |
| Altitude absent on most Android points | `buildElevationProfile` requires ≥2 altitude points. Chart hidden otherwise. All stats show `--` for elevation fields. Documented expected behaviour. |
| Walk deleted while open from history | `deleteWalk` is only reachable via `WalkActionBar` on the review screen. After deletion, `router.replace('/(tabs)')` is called immediately. No re-render occurs on the deleted walk. |
| Camera fit with zero-point route | Guard in `RouteMap`: if `points.length === 0`, skip `Camera` bounds-fit entirely and render placeholder instead. |
| `EXPO_PUBLIC_` prefix required for JS bundle visibility | `MAPBOX_ACCESS_TOKEN` (no prefix) is not visible to the Metro bundle. A new `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` entry is required in `.env.local`. |
