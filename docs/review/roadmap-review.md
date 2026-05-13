# Stage Two: Review – Implementation Roadmap

This document is the firm implementation plan for the walk summary feature. It covers
Mapbox SDK installation, native config, data queries, component architecture, screen
design, and sequenced work items.

---

## 1. Guiding Principles

1. **Review is read-only on data, offline-first.** The review screen loads entirely from
   SQLite. It never blocks on a network call. Sync happens later; review is always
   available.
2. **Post-walk summary IS the review screen.** `app/walk-summary.tsx` is the combined
   post-walk summary and walk summary screen. The walk session hook navigates there after stop. The
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

### 7.1 `app/walk-summary.tsx`

The full walk summary screen. Entry points:

1. **Post-walk**: `hooks/use-walk-session.ts` `stop()` navigates here after
   post-processing completes.
2. **History list**: `app/(tabs)/explore.tsx` taps navigate here.

Both use `router.push('/walk-summary?walkId=...')`.

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

`app/walk-summary.tsx` is a stack screen resolved automatically by `expo-router`
because it lives at `app/walk-summary.tsx`. No routing configuration changes needed.

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
> pattern used by `LivePositionLayer` during recording. The screen (`walk-summary.tsx`)
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

### Phase 4 — Screen Redesign, Tabbed Stats & Photos

The flat `WalkStatSummary` table and `WalkActionBar` are replaced by a redesigned
layout: the screen is restructured first (4a), then five tab sections are built and
wired in. A persistent **bottom action bar** (Share, Export GPX, Edit, Delete) is
fixed at the screen bottom; title and headline stats sit above the fold in the
bottom sheet. The tab bar scrolls horizontally so future tabs can be added without
layout rework.

#### Tab definitions

| Tab | Icon | Content |
|---|---|---|
| **Walk Stats** | `walk-outline` | Distance, pace, duration (with km/miles unit toggle) |
| **Health** | `heart-outline` | Steps, time moving, calories, future heart rate |
| **Elevation** | `trending-up-outline` | SVG elevation chart + detailed ascent/descent stats |
| **Training** | `stats-chart-outline` | Circuit detection + comparison with previous runs |
| **Photos** | `camera-outline` | Vertical timeline; map shows photo pins; fullscreen viewer with navigation |

---

#### 4a — Review screen layout redesign and bottom action bar

The Phase 5 implementation put the title inside the scrollable sheet. The redesigned
layout (design reference attached) promotes the title and headline stats **above the
fold** and adds a persistent **bottom action bar** replacing the old `WalkActionBar`.
This section captures what needs to change from the Phase 5 baseline.

**Target layout (top to bottom):**

```
[ MapboxGL.MapView  — full screen behind sheet              ]
[ ─────────────── bottom sheet ──────────────────────────── ]
[  WalkHeaderCard (title, date, status badges)               ]
[  Headline row: "8.42 km  ·  1h 37m 21s"                   ]
[  ReviewTabBar                                              ]
[  ── scrollable tab content ──────────────────────────────  ]
[  TabWalkStats / TabHealth / TabElevation / etc.            ]
[ ─────────────── bottom action bar (fixed) ─────────────── ]
[  Share  │  Export GPX  │  Save Route  │  Delete         ]
```

The `AppHeader` (back arrow, top-left) remains as an absolute overlay. The `...`
more-options button (top-right) is a placeholder for Phase 9.

---

**New component: `components/review/review-action-bar.tsx` (work item 33):**
- [x] Create `ReviewActionBar`.

```
Props:
  onShare:      () => void
  onExportGpx:  () => void
  onSaveRoute?: () => void   // omitted for follow-session walks
  onDelete:     () => void
  showSaveRoute: boolean     // false when walk was recorded during a follow session
```

| Button | Icon | Label | Style | Condition |
|---|---|---|---------|---|
| Share | `share-outline` | Share | Muted | Always |
| Export GPX | `download-outline` | Export GPX | Muted | Always |
| Save Route | `bookmark-outline` | Save Route | Muted | Only when `showSaveRoute` is `true` |
| Delete | `trash-outline` | Delete | Destructive red | Always |

- Fixed `View` at the bottom of the screen, height 60 dp + `insets.bottom` padding.
- Background `colors.backgroundCard`, hairline top border `colors.border`.
- Each button: icon (22 dp) centred above label (`Typography.sizes.xs`). Equal
  `flex: 1` columns (three or four depending on `showSaveRoute`).
- Delete shows `Alert.alert` confirmation before calling `onDelete`.
- Share and Export GPX call their respective handlers — stubbed to a
  "Coming soon" alert until Phase 9 is implemented.
- Save Route calls `onSaveRoute` which opens the Save Route modal (Phase 8).

**When is `showSaveRoute` true?**
- `walk.followSessionId === null` (walk was a free recording, not linked to a follow session).
- The `followSessionId` field is added to the `walks` SQLite table in Replaying Phase 1.
  Until that phase lands, treat all walks as free walks (`showSaveRoute = true` always).

---

**`app/walk-summary.tsx` layout changes (work item 34):**
- [x] Replace `<WalkActionBar onDelete={handleDelete} />` with `<ReviewActionBar>`,
  rendered **outside** the `BottomSheet` as a sibling `View` absolutely positioned
  at the screen bottom (or just use `position: 'absolute'`).
- [x] Compute `showSaveRoute = walk.followSessionId === null` (or `true` until
  Replaying Phase 1 adds the field) and pass to `ReviewActionBar`.
- [x] Adjust bottom sheet snap points so the collapsed state (`index={0}`) exposes
  the full `WalkHeaderCard` + headline stats row + `ReviewTabBar`. A snap point
  of `~45% + navAdjPct%` typically achieves this — tune per device.
- [x] Add `paddingBottom` to the bottom sheet `contentContainerStyle` equal to the
  action bar height so the last tab item is never obscured.
- [x] Add `saveRouteModalVisible` state (`false` by default); wire to `onSaveRoute` prop of
  `ReviewActionBar`. Render a `<SaveRouteModal>` (Phase 8) when true.
- [x] `npx tsc --noEmit` — 0 errors.

**Checkpoint:** Action bar fixed at screen bottom on all tabs. Title and tab bar
visible without expanding the sheet. Delete still works. Save Route button opens stub
modal (free walks only — hidden for follow-session walks). Share and Export GPX show
placeholder alert.

---

#### 4b — Extend `WalkStats` type and post-processing

The existing `WalkStats` interface (in `lib/db/walks.ts`) and post-processing
(`lib/location/post-processing.ts`) need new fields for the Elevation tab's detailed
stats. These are computed in the same post-processing pass that already runs after
`stop()`.

New fields to add to `WalkStats`:

```ts
// Elevation detail — all optional (absent when altitude data insufficient)
longestAscentMetres?: number;      // vertical metres in longest single upward stretch
steepestAscentGradientPct?: number;// max gradient % seen across any 50 m window (ascent)
longestDescentMetres?: number;     // vertical metres in longest single downward stretch
steepestDescentGradientPct?: number;
```

Post-processing changes (`lib/location/post-processing.ts`):

- After the existing elevation gain/loss pass, run a second pass over smoothed altitude points:
  - Track the current "run" (consecutive points going upward or downward).
  - On direction flip: record the run's total vertical metres; track the longest seen.
  - Gradient: for each pair of consecutive clean points with altitude, compute
    `abs(Δalt) / haversineMetres * 100`. Track the max value seen for ascents and
    descents separately over a sliding 50 m window to smooth out GPS noise.
- Serialise new fields into `stats_json` alongside the existing values.
- **No schema migration needed** — `stats_json` is a JSON blob; old walks simply won't
  have these keys (UI displays `--` when values are `undefined`).

**Work item 18:**
- [x] Add `longestAscentMetres`, `steepestAscentGradientPct`, `longestDescentMetres`,
  `steepestDescentGradientPct` to the `WalkStats` interface in `lib/db/walks.ts`.
- [x] Implement the ascent/descent run-tracker in `lib/location/post-processing.ts`.
- [x] Implement 50 m sliding-window gradient calculation.
- [x] `npx tsc --noEmit` — 0 errors.

**Checkpoint:** Record a walk with elevation change. Inspect `stats_json` in SQLite —
new fields present and non-zero.

---

#### 4c — Unit preference and weight in Profile

Unit preference (km vs. miles) and body weight (for calorie display) are user
preferences stored in `expo-secure-store` alongside the existing feature flags pattern.

**Profile screen (`app/(tabs)/profile.tsx`) changes:**

- Add a **Unit preference** toggle (KM / Miles). Stored as `preferMiles: boolean` in
  a new `UserPreferences` key in `expo-secure-store`.
- Add a **Body weight** numeric input (kg, with a small "for calorie estimates" label).
  Stored as `bodyWeightKg: number | null`. Used by the Health tab to compute a
  per-walk calorie estimate when Health Connect calories are not available.
- Both values are read via a new `hooks/use-user-preferences.ts` hook (pattern mirrors
  `use-feature-flags.ts`: load from SecureStore on mount, expose typed state + setter).

```ts
// hooks/use-user-preferences.ts
export interface UserPreferences {
  preferMiles: boolean;
  bodyWeightKg: number | null;
}
```

`DistanceDisplay` and `PaceDisplay` already accept raw SI values — they will be updated
to accept an optional `unit: 'km' | 'mi'` prop and format accordingly. The preference
is passed down from `walk-summary.tsx` via the tab components.

**Work items 19–20:**
- [x] Create `hooks/use-user-preferences.ts` with `preferMiles` and `bodyWeightKg`.
- [x] Add unit toggle and body weight input to `app/(tabs)/profile.tsx`.
- [x] Update `DistanceDisplay` to accept and render miles when `unit='mi'`.
- [x] Update `PaceDisplay` to render min/mile when `unit='mi'`.
- [x] `npx tsc --noEmit` — 0 errors.

---

#### 4d — Tab bar component

**Work item 21:**
- [x] Create `components/review/review-tab-bar.tsx`.

```
Props:
  tabs:        { id: string; label: string; icon: string }[]
  activeTab:   string
  onTabChange: (id: string) => void
```

- Horizontal `ScrollView` (shows all 4 tabs without scroll at normal font sizes, but
  scrolls gracefully if labels are long or future tabs are added).
- Each tab: Ionicons icon above label text, pill highlight on active, muted colour
  when inactive. Uses `Colors.primary` for active state.
- No animation required for MVP — instant content swap on press.

---

#### 4e — Walk Stats tab

**Work item 22:**
- [x] Create `components/review/tab-walk-stats.tsx`.

```
Props:
  stats:      WalkStats | null
  unit:       'km' | 'mi'
  onUnitToggle: () => void
```

Content:
- Hero row: `DistanceDisplay` | `PaceDisplay` (both respect `unit`).
- Unit toggle button (small, top-right of the hero row): tapping calls `onUnitToggle`
  which flips the preference and persists it.
- Stat table rows: Duration (HH:MM:SS), Time stopped, Waypoints stored, Photos taken.
- Reuses the existing `formatDuration` helper from `duration-display.tsx`.
- Replaces the hero section of the current `WalkStatSummary`.

---

#### 4f — Health Stats tab

**Work item 23:**
- [x] Create `components/review/tab-health-stats.tsx`.

```
Props:
  stats:         WalkStats | null
  bodyWeightKg:  number | null
```

Content (stat table rows):
- **Steps** — prefers `hcStepCount` (Health Connect), falls back to `stepCount`
  (device pedometer), shows source label "(HC)" or "(device)" as small muted suffix.
- **Time moving** — `movingTimeSeconds` formatted as HH:MM:SS.
- **Active calories** — shows `caloriesKcal` from Health Connect if present; otherwise
  estimates using MET formula: `MET × bodyWeightKg × durationHours × 3.5 / 200`.
  Uses MET ≈ 3.5 (moderate walking pace) as a constant. If `bodyWeightKg` is null and
  HC calories absent, shows `-- (set weight in Profile)` as a tap-hint linking to
  profile screen via `router.push('/(tabs)/profile')`.
- **Avg heart rate** — shows `avgHeartRateBpm` or `--`. Includes a small greyed
  "Future update" label if value is `--` to indicate this is planned.
- **Max heart rate** — shows `maxHeartRateBpm` or `--`.
- Health Connect sync badge (existing `hcBadge` style from `WalkStatSummary`) shown
  when `stats.hcSynced === true`.

---

#### 4g — Elevation tab (chart + detail stats)

**Work items 24–25:**
- [x] Create `components/review/elevation-chart.tsx` using `react-native-svg`.
- [x] Create `components/review/tab-elevation.tsx`.

**`elevation-chart.tsx`:**

```
Props:
  data:    ElevationPoint[]   — from buildElevationProfile() (already exists)
  height?: number             — defaults to 120
  style?:  ViewStyle
```

- Uses `react-native-svg` (`Svg`, `Polyline`, `Path`, `Text`, `Line`).
- Normalise altitude values to SVG viewport height with 10% top/bottom padding.
- Filled area under the polyline using a `Path` closed back to the baseline — filled
  with `Colors.primary` at 15% opacity.
- Polyline stroke in `Colors.primary`, width 2.
- Horizontal dashed reference line at the min and max altitude values.
- Labels: min altitude (bottom-left), max altitude (top-right), total distance
  (bottom-right). Text uses `Typography.sizes.xs` equivalent font size (10).
- Returns `null` when `data.length < 2` — the tab shows a "No elevation data" empty
  state card in that case.

**`tab-elevation.tsx`:**

```
Props:
  points: RoutePoint[]    — the same route points used by the map
  stats:  WalkStats | null
```

- Calls `buildElevationProfile(points)` inline (already in `lib/review/`).
- Renders `ElevationChart` at the top of the tab, full width, height 120.
- Below the chart: a stat table with the following rows:

| Label | Source |
|---|---|
| Total ascent | `stats.elevationGainMetres` |
| Total descent | `stats.elevationLossMetres` |
| Longest ascent | `stats.longestAscentMetres` |
| Longest descent | `stats.longestDescentMetres` |
| Steepest ascent | `stats.steepestAscentGradientPct` formatted as `X.X%` |
| Steepest descent | `stats.steepestDescentGradientPct` formatted as `X.X%` |

- All values show `--` when `undefined` (old walks without new post-processing fields).
- Same table styles as the existing `WalkStatSummary` detail table.

---

#### 4h — Training tab

**Work item 26:**
- [x] Create `components/review/tab-training.tsx`.

```
Props:
  walk:   Walk
  stats:  WalkStats | null
  route:  RoutePoint[]
```

This tab is **MVP-scoped** — the circuit comparison engine is marked as a future
phase. The tab is built now so the shell exists and the UX is established.

**Circuit detection (MVP):**
- A walk is considered a circuit if the distance between the first and last clean
  route points is less than 5% of the total walk distance (or < 200 m, whichever is
  greater).
- Computed inline from `route[0]` and `route[route.length - 1]` using `haversineMetres`.
- Show a pill badge: "Circuit detected" (green) or "Out & back / linear" (slate muted).

**Content for MVP:**
- Circuit badge (see above).
- If circuit: a placeholder card — "Lap comparison coming soon. When enabled, this
  will compare your pace, distance, and stats against your previous runs of this
  circuit." Styled as an info card with a `stats-chart-outline` icon.
- If not a circuit: a placeholder card — "Training comparison is available for
  circuit walks. Record a route that starts and ends at the same point."
- Both placeholders use the same muted info-card style.

**Future phase (not in this roadmap):** Route fingerprinting to identify walks that
follow the same path, lap-time extraction, trend charts across multiple runs.

---

#### 4i — Photos tab

The Photos tab replaces the old behaviour where photo pins were always visible on
the map and tapping them opened `PhotoViewerModal`. Photo pins are now **only shown
on the map when the Photos tab is active**, and the viewer supports gallery
navigation.

**Changes to `ReviewRouteLayer` (work item 28):**
- [x] Add a `showPhotoMarkers?: boolean` prop (defaults to `false`).
- [x] Wrap the photo `PointAnnotation` block with `{showPhotoMarkers && photos.map(...)}` so
  pins are hidden on all non-Photos tabs.
- [x] Replace `PhotoConePin` (heading cone) with a simple **camera dot marker** — a
  filled circle with a small camera icon, no heading cone. The heading field is
  retained in the database but not displayed (compass readings are unreliable).
  The new marker is a small inline component `PhotoDotPin` inside `review-route-layer.tsx`.
- [x] `npx tsc --noEmit` — 0 errors.

**`lib/review/build-photo-timeline.ts` (work item 29):**
- [x] Create a pure function that, given `photos: WalkPhoto[]` and `route: RoutePoint[]`,
  returns an enriched list with cumulative distance from route start for each photo:

```ts
export interface PhotoTimelineEntry {
  photo: WalkPhoto;
  distanceMetres: number;    // cumulative distance from walk start to photo location
  formattedTime: string;     // HH:MM:SS from walk start
  formattedDistance: string; // e.g. "1.2 km" or "0.8 mi"
}

export function buildPhotoTimeline(
  photos: WalkPhoto[],
  route: RoutePoint[],
  walkStartedAt: number,
): PhotoTimelineEntry[]
```

Implementation:
1. Sort photos by `timestamp` ascending.
2. For each photo, find the route point with the nearest `timestamp`
   (binary search is fine — route is already ordered by timestamp).
3. Use that route point's index into a pre-computed cumulative distance array
   (same Haversine accumulation as `buildElevationProfile`) to get
   `distanceMetres`.
4. `formattedTime` = elapsed seconds from `walkStartedAt` formatted as HH:MM:SS
   using the existing `formatDuration` helper.
5. `formattedDistance` = metres formatted to one decimal place in km (or miles if
   preference is passed in — accept an optional `unit: 'km' | 'mi'` param).

**`components/review/tab-photos.tsx` (work item 30):**
- [x] Create a vertical timeline view.

```
Props:
  photos:      WalkPhoto[]
  route:       RoutePoint[]
  walk:        Walk
  unit:        'km' | 'mi'
  onPhotoOpen: (photo: WalkPhoto, index: number) => void
```

Layout:
- Calls `buildPhotoTimeline(photos, route, walk.startedAt)` to enrich photos.
- If `photos.length === 0`: render an empty-state card — camera icon +
  "No photos taken on this walk".
- Otherwise: a `ScrollView` containing a vertical timeline:
  - A thin vertical line runs down the left side (1.5 px, `colors.border`).
  - Each photo entry is a row:
    - **Left column** (56 dp wide): time label (HH:MM) in `Typography.sizes.xs`,
      then distance label (`X.X km`) below it in `Typography.sizes.xs` muted.
      Both right-aligned against the timeline line.
    - **Timeline dot**: a filled circle (10 dp diameter, `colors.primary`) sits
      on the vertical line between the left column and the thumbnail.
    - **Right column**: a square thumbnail (`Image`, 72×72, `borderRadius: 8`,
      `resizeMode: 'cover'`). Wrapped in a `Pressable` that calls
      `onPhotoOpen(entry.photo, index)`.
  - Spacing between entries: `Spacing.lg` (24 dp).
  - Top of the list: a small header row showing the total photo count:
    `"${photos.length} photo${photos.length !== 1 ? 's' : ''}"` in muted text.

**`components/review/photo-viewer-carousel.tsx` (work item 31):**

Replaces `PhotoViewerModal`. A full-screen overlay supporting left/right navigation
and swipe gestures.

```
Props:
  photos:       WalkPhoto[]          — full ordered list
  initialIndex: number               — which photo to open first
  walk:         Walk                 — for formattedTime / distance
  route:        RoutePoint[]
  unit:         'km' | 'mi'
  onClose:      () => void
```

- Rendered as a `Modal` (same `presentationStyle="overFullScreen"`, `transparent`,
  `animationType="fade"` as the old `PhotoViewerModal`).
- Internally maintains `currentIndex` state, initialised from `initialIndex`.
- Calls `buildPhotoTimeline` once and memoises the result.

**Header bar (absolute, top):**
- Close button (`close` icon, top-left, `insets.top + 12` from top).
- Time + distance chip (top-centre):
  ```
  HH:MM:SS  ·  X.X km
  ```
  Pill-shaped, semi-transparent dark background, white text `Typography.sizes.sm`.

**Photo display:**
- Full-screen `Image` (`resizeMode: 'contain'`, `backgroundColor: '#000'`).
- Left/right tap zones (each 25% of screen width, transparent) to navigate:
  - Left zone: tap → previous photo (no-op at index 0).
  - Right zone: tap → next photo (no-op at last photo).
- Left/right arrow icons (`chevron-back`, `chevron-forward`) rendered semi-transparent
  at the vertical mid-point of the photo, hidden when at the respective boundary.

**Footer bar (absolute, bottom):**
- `"Photo X of Y"` centred in `Typography.sizes.sm` white text with semi-transparent
  dark pill background, positioned at `insets.bottom + 16`.
- Left (`‹`) and right (`›`) icon buttons flanking the count label, disabled and
  faded at boundaries.

**Swipe gesture:**
- Use `react-native-gesture-handler`'s `PanGestureHandler` (already installed).
- On horizontal swipe end with velocity > 300 or translation > 60 dp:
  - Swipe left → next photo.
  - Swipe right → previous photo.
- No spring animation required for MVP — instant index change is acceptable.

**Work item 32 — remove `PhotoViewerModal`:**
- [x] Delete or deprecate `components/review/photo-viewer-modal.tsx` (it is fully
  replaced by `PhotoViewerCarousel`).
- [x] Remove all imports of `PhotoViewerModal` from `walk-summary.tsx`.

---

#### 4j — Wire tabs into `walk-summary.tsx`

**Work item 27:**
- [x] Update `app/walk-summary.tsx`:
  - Add `activeTab` state (`useState<'walk' | 'health' | 'elevation' | 'training' | 'photos'>`),
    defaulting to `'walk'`.
  - Load `useUserPreferences()` hook to get `preferMiles` and `bodyWeightKg`; expose
    `setPreference` for the unit toggle.
  - Pass `showPhotoMarkers={activeTab === 'photos'}` to `ReviewRouteLayer` so photo
    pins only appear on the map when the Photos tab is active (see 4i).
  - Replace the `{/* Elevation chart placeholder — Phase 4 */}` comment and the
    `<WalkStatSummary>` render with:
    ```tsx
    <ReviewTabBar activeTab={activeTab} onTabChange={setActiveTab} />
    {activeTab === 'walk' && <TabWalkStats stats={stats} unit={unit} onUnitToggle={...} />}
    {activeTab === 'health' && <TabHealthStats stats={stats} bodyWeightKg={bodyWeightKg} />}
    {activeTab === 'elevation' && <TabElevation points={route} stats={stats} />}
    {activeTab === 'training' && <TabTraining walk={walk} stats={stats} route={route} />}
    {activeTab === 'photos' && (
      <TabPhotos
        photos={photos}
        route={route}
        walk={walk}
        onPhotoOpen={(photo, index) => openPhotoViewer(photo, index)}
      />
    )}
    ```
  - Replace `selectedPhoto` state + `<PhotoViewerModal>` with the new
    `<PhotoViewerCarousel>` (see 4i). The carousel receives `photos`, `initialIndex`,
    and `onClose`.
  - Remove the `WalkStatSummary` import (it is superseded by the tab components).
    The `WalkStatSummary` file can remain in place for reference but is no longer
    rendered.
- [x] `npx tsc --noEmit` — 0 errors.

**Checkpoint:** All five tabs render without crash. Walk Stats shows hero + table.
Health tab shows steps and calories (with fallback when HC not synced). Elevation tab
shows chart when altitude data present, empty state when absent. Training tab shows
circuit badge and placeholder card. Photos tab shows timeline and map pins.

---

#### 4k — Phase 4 acceptance tests

- [ ] Walk Stats: distance renders in km; unit toggle switches to miles and back;
  preference persists across app restarts.
- [ ] Health: calories show HC value when synced; fall back to MET estimate when
  `bodyWeightKg` set in profile; show hint link when neither available.
- [ ] Elevation: chart renders for a walk with altitude data; empty state renders for
  a walk without; all six stat rows show values on a walk recorded after Phase 4a.
- [ ] Training: circuit badge correct for a walk that starts and ends near the same
  point; linear walk shows the out-and-back message.
- [ ] Photos: photo pins do **not** appear on the map when Walk Stats / Health /
  Elevation / Training tabs are active; pins appear (as simple dots, no cone) when
  Photos tab is active.
- [ ] Photos: timeline shows correct time elapsed and cumulative distance for each
  photo entry.
- [ ] Photos: tapping a thumbnail opens the carousel at the correct index.
- [ ] Photos carousel: left/right arrow buttons navigate between photos; arrows
  hidden/faded at boundaries.
- [ ] Photos carousel: swipe left/right navigates to next/previous photo.
- [ ] Photos carousel: header pill shows correct time and distance for the currently
  displayed photo.
- [ ] Photos empty state: walk with no photos shows the empty-state card.
- [ ] Tab bar: all five tabs tappable; no layout overflow on small screens.
- [ ] Action bar: Save Route button visible for free walks; hidden for follow-session
  walks (once `followSessionId` field exists — always shown until Replaying Phase 1).
- [ ] Action bar: Delete still works. Share and Export GPX show placeholder alert.
- [ ] `npx tsc --noEmit` — 0 errors.

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
24. ✅ `app/walk-summary.tsx` — map-first + `BottomSheet` layout:
    - `MapboxGL.MapView` fills screen with `ReviewRouteLayer` inside
    - Snap points `['25%', '70%']`, starts at index 0
    - Collapsed (25%): walk title + distance · duration peek row
    - Expanded (70%): `WalkHeaderCard` + `WalkStatSummary` + `WalkActionBar`
    - `PhotoViewerModal` over everything; tapping a map photo pin opens it
    - `AppHeader` (back chevron via `onBack` prop) as absolute overlay at top
    - Walk-not-found guard renders error state
25. ✅ Updated `hooks/use-walk-session.ts`: navigates to `/walk-summary` after
    post-processing completes (was `/walk-summary` Stage 1 screen).
26. ✅ `AppHeader` already supports back button via `onBack` prop — no changes
    needed. `app/_layout.tsx` updated to register the `walk-summary` stack screen.
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
and bottom sheet walk list. Tapping a card navigates to walk summary. Empty state
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
  walk-summary.tsx     ← walk summary screen (map-first + tabbed stats)

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
| Walk deleted while open from history | `deleteWalk` is only reachable via `ReviewActionBar` on the review screen. After deletion, `router.replace('/(tabs)')` is called immediately. No re-render occurs on the deleted walk. |
| Camera fit with zero-point route | Guard in `RouteMap`: if `points.length === 0`, skip `Camera` bounds-fit entirely and render placeholder instead. |
| `EXPO_PUBLIC_` prefix required for JS bundle visibility | `MAPBOX_ACCESS_TOKEN` (no prefix) is not visible to the Metro bundle. A new `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` entry is required in `.env.local`. |

---

## Phase 8 — Save Route Modal

The Save Route action transforms the walk summary screen from a passive read-only view
into a curation layer — available only for free walks (not follow sessions). The user
is **not** editing the raw GPS recording — they are refining the *reviewed
representation* of the walk: its metadata, presentation, and the clean route derived
from raw data.

The Save Route modal opens as a **full-screen modal sheet** (not a separate route) so
the user feels they are still within the summary experience. It uses the same calm
card-based style: grouped sections, muted cards, orange save CTA, destructive actions
separated clearly.

### 8.1 Scope

**In scope for MVP:**

| Feature | Detail |
|---|---|
| Rename walk | Edit the title field — same as the existing inline title edit but more prominent |
| Add / edit description | Free-text notes field (multiline `TextInput`, up to ~500 chars) |
| Choose cover photo | Pick one of the walk's photos as the hero image shown in the history list |
| Trim start / end | Drag handles on a route/elevation timeline to cut unwanted GPS sections |
| Regenerate stats | Re-run post-processing after trimming |
| Delete unwanted photos | Mark individual photos for removal; confirm on save |
| Caption photos | Add/edit text captions per photo |
| Mark as favourite | Boolean flag shown as a star on the history card |

**Not in MVP (future phases):**
- Manual route node dragging
- Waypoint insertion or route drawing
- Arbitrary mid-route deletion
- GPX-level editing
- Privacy / share settings (Phase 9)
- "Mark as benchmark route" (Training tab future phase)

### 8.2 Entry points

The Save Route button in `ReviewActionBar` always opens the full Save Route modal
(it is only shown for free walks to begin with). Future enhancement: the button could
be context-sensitive based on the active tab — e.g. from the Photos tab it opens
directly at the Photos section.

### 8.3 Data model additions

New fields needed in `WalkStats` / `Walk` (in `lib/db/walks.ts`):

```ts
// Walk table additions
isFavourite: boolean;          // new column, default 0
description: string | null;    // new column, free-text notes
coverPhotoId: string | null;   // FK to walk_photos.id
trimStartAt: number | null;    // Unix ms — points before this are excluded from review
trimEndAt: number | null;      // Unix ms — points after this are excluded from review
```

DB migration (in `lib/db/client.ts`):
```sql
ALTER TABLE walks ADD COLUMN is_favourite INTEGER NOT NULL DEFAULT 0;
ALTER TABLE walks ADD COLUMN description TEXT;
ALTER TABLE walks ADD COLUMN cover_photo_id TEXT;
ALTER TABLE walks ADD COLUMN trim_start_at INTEGER;
ALTER TABLE walks ADD COLUMN trim_end_at INTEGER;
```

Convex schema will need corresponding optional fields on the `walks` table for sync.

### 8.4 Trim Start / End — core feature

This is the most valuable MVP edit action. It addresses real-world recording annoyances
(GPS wobble before starting, forgetting to stop at the car, wandering after the walk).

**UI — `components/review/trim-timeline.tsx`:**

```
Props:
  points:       RoutePoint[]        — clean route points
  trimStartAt:  number | null       — current trim start (Unix ms)
  trimEndAt:    number | null       — current trim end (Unix ms)
  onChange:     (start: number | null, end: number | null) => void
```

- Renders a horizontal timeline spanning the full walk duration.
- The timeline shows the elevation profile (if available) as a subtle filled SVG
  shape behind the drag handles — reuses `buildElevationProfile` output scaled to
  the timeline width.
- Two draggable handles (thumb circles, `colors.primary`) sit on the timeline:
  - **Start handle**: defaults to `points[0].timestamp`; dragging right trims the
    start of the walk.
  - **End handle**: defaults to `points[last].timestamp`; dragging left trims the end.
- The region between handles is highlighted (primary colour, 20% opacity); outside is
  muted (50% opacity overlay).
- Below the timeline: two read-only labels update live as handles move:
  `"Start: HH:MM:SS  End: HH:MM:SS  New duration: X h Xm"`
- Handles use `react-native-gesture-handler` `PanGestureHandler` (already installed).
- Minimum region: handles cannot pass each other; at least 60 s of walk must remain.

**Stats regeneration:**
- When the user taps **Save** in the Save Route modal, if trim values have changed:
  1. Update `trim_start_at` / `trim_end_at` in the `walks` SQLite row.
  2. Re-run `runPostProcessing(walkId)` filtered to `timestamp BETWEEN trimStartAt AND trimEndAt`.
  3. The existing post-processing function is updated to accept optional `startMs` /
     `endMs` parameters that filter which points are included — raw points are never
     deleted, only the trim window changes.
  4. Update `stats_json` with new computed values.
  5. `buildRoute` and `buildElevationProfile` also respect trim bounds (accept the
     same optional window params).
  6. Map and all tab stats refresh automatically when the Save Route modal closes (the
     `walk` and `route` memos in `walk-summary.tsx` re-derive on next render).

### 8.5 Photo management in Edit

**Delete photos:**
- Grid of photo thumbnails (3-column, `Image` 80×80 with `borderRadius: 8`).
- Each thumbnail has a red ✕ badge (top-right) when in "editing" state.
- Tapping ✕ marks the photo for deletion (local state — not committed until Save).
- Marked photos shown with 40% opacity + strikethrough badge.
- On Save: call `deletePhoto(photo.id)` for each marked photo from `lib/db/walk-photos.ts`.

**Captions:**
- Tapping a thumbnail (not the ✕) opens a small inline `TextInput` below the grid
  for that photo's caption. Tapping another photo switches focus.

**Cover photo:**
- A "Set as cover" button appears below the caption input when a photo is selected.
- The selected cover photo ID is stored in `walk.coverPhotoId`.
- `HistoryWalkCard` uses the cover photo as a thumbnail if set (future enhancement
  to the history list — not required for MVP history list).

### 8.6 Save Route modal component structure

**`components/review/save-route-modal.tsx` (work item 35):**
- [ ] Full-screen `Modal` (`presentationStyle="pageSheet"`, `animationType="slide"`).
- [ ] `ScrollView` containing grouped sections with `SectionHeader` labels.
- [ ] Fixed footer: **Cancel** (left, outlined) | **Save** (right, primary orange filled).

Sections (in order):

```
┌─ About ──────────────────────────────────────────┐
│  Title field (TextInput, pre-filled)              │
│  Description / Notes (multiline TextInput, 4 rows)│
│  ★ Favourite toggle                               │
└──────────────────────────────────────────────────┘

┌─ Trim Walk ───────────────────────────────────────┐
│  TrimTimeline component                           │
│  Start / End / New duration labels                │
└──────────────────────────────────────────────────┘

┌─ Photos ─────────────────────────────────────────┐
│  Photo grid (delete ✕ overlay, tap for caption)   │
│  Caption TextInput for selected photo             │
│  "Set as cover" button                            │
└──────────────────────────────────────────────────┘
```

**Save logic:**
1. Update `title`, `description`, `isFavourite`, `coverPhotoId` via new DB functions.
2. Commit photo deletions and caption updates.
3. If trim changed: re-run post-processing.
4. Close modal → parent `walk-summary.tsx` re-derives `walk`, `route`, `stats` via
   `useMemo` (which re-queries SQLite — the existing pattern).

**New DB functions needed:**
- [ ] `updateWalkMeta(walkId, { title, description, isFavourite, coverPhotoId, trimStartAt, trimEndAt })` in `lib/db/walks.ts`.
- [ ] `updatePhotoCaption(photoId, caption)` in `lib/db/walk-photos.ts`.
- [ ] `deletePhoto(photoId)` in `lib/db/walk-photos.ts`.
- [ ] Update `runPostProcessing` in `lib/location/post-processing.ts` to accept
  `{ startMs?: number; endMs?: number }` filter params.

### 8.7 Favourite flag in history list

- [ ] Add `isFavourite` column read to `rowToWalk` in `lib/db/walks.ts`.
- [ ] `HistoryWalkCard` shows a small filled star icon (`star`, `colors.warning` or
  `Colors.palette.orange[700]`) when `walk.isFavourite` is true.
- [ ] (Future) Add a "Favourites" filter chip to the history list header.

### 8.8 Sequenced work items for Phase 8

- [ ] DB migration: add 5 new columns to `walks` table in `lib/db/client.ts`.
- [ ] Update `rowToWalk` and `Walk` interface with new fields.
- [ ] Add `updateWalkMeta`, `updatePhotoCaption`, `deletePhoto` DB functions.
- [ ] Update `runPostProcessing` to accept trim window params.
- [ ] Update `buildRoute` and `buildElevationProfile` to respect trim window.
- [ ] Create `components/review/trim-timeline.tsx`.
- [ ] Create `components/review/save-route-modal.tsx` with all three sections.
- [ ] Wire `saveRouteModalVisible` state in `walk-summary.tsx` to `ReviewActionBar.onSaveRoute`.
- [ ] Add `isFavourite` star to `HistoryWalkCard`.
- [ ] `npx tsc --noEmit` — 0 errors.

### 8.9 Phase 8 acceptance tests

- [ ] Rename: title saved and reflected in header and history list after Edit → Save.
- [ ] Description: notes field saves and reloads correctly.
- [ ] Favourite: star appears on history card; toggles off on second Edit → Save.
- [ ] Trim start: dragging start handle rightward removes early GPS wobble from map
  and shortens distance/duration stats after Save.
- [ ] Trim end: dragging end handle leftward removes trailing GPS from map.
- [ ] Stats regenerate correctly after trim — distance, pace, elevation all updated.
- [ ] Photo delete: marked photos removed from Photos tab timeline and map pins after Save.
- [ ] Photo caption: caption saved and displayed in carousel footer.
- [ ] Cover photo: `walk.coverPhotoId` persists across app restarts.
- [ ] Cancel: no changes committed when Save Route modal is dismissed via Cancel.
- [ ] `npx tsc --noEmit` — 0 errors.

---

## Phase 9 — Share and Export GPX

The Share and Export GPX buttons in `ReviewActionBar` are stubbed in Phase 4k. This
phase implements them.

### 9.1 Export GPX

**Dependencies:** `expo-file-system` (already installed), `expo-sharing`.

```bash
npx expo install expo-sharing
```

**`lib/review/build-gpx.ts` (work item 36):**
- [ ] Create a pure function that serialises the walk route to a GPX XML string.

```ts
export function buildGpx(walk: Walk, points: RoutePoint[]): string
```

Output format:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Ramble.io" ...>
  <metadata>
    <name>{walk.title ?? "Walk"}</name>
    <time>{ISO 8601 of walk.startedAt}</time>
  </metadata>
  <trk>
    <name>{walk.title ?? "Walk"}</name>
    <trkseg>
      <trkpt lat="..." lon="...">
        <ele>...</ele>
        <time>...</time>
      </trkpt>
      ...
    </trkseg>
  </trk>
</gpx>
```

- Uses `points` filtered by `trim_start_at` / `trim_end_at` if set.
- Altitude included only when `point.altitude !== null`.
- Time element uses ISO 8601 from `point.timestamp`.

**`ReviewActionBar.onExportGpx` handler in `walk-summary.tsx` (work item 37):**
- [ ] Build GPX string via `buildGpx(walk, route)`.
- [ ] Write to a temp file via `FileSystem.writeAsStringAsync`:
  `FileSystem.cacheDirectory + 'walk-export.gpx'`
- [ ] Call `Sharing.shareAsync(filePath, { mimeType: 'application/gpx+xml', dialogTitle: 'Export Walk GPX' })`.
- [ ] Wrap in try/catch; show `Alert.alert('Export failed', error.message)` on error.

### 9.2 Share walk summary

**MVP scope:** Share a plain-text summary of the walk using the system share sheet.

```ts
// Text template
`🥾 ${title}
📅 ${date}
📍 ${distanceKm} km  ·  ⏱ ${duration}  ·  👟 ${steps} steps
Recorded with Ramble.io`
```

- [ ] Call `Share.share({ message })` from React Native core `Share` API.
- [ ] If `walk.coverPhotoId` is set, attempt to include the photo URI via
  `Sharing.shareAsync` instead (supports both text and file on Android/iOS).

### 9.3 Phase 9 acceptance tests

- [ ] Export GPX: file opens correctly in a GPX viewer (e.g. Viking, maps.google.com).
- [ ] Export GPX: respects trim bounds — trimmed points not in output.
- [ ] Export GPX: altitude present when walk has altitude data.
- [ ] Share: system share sheet opens with correct walk summary text.
- [ ] Both actions graceful when walk has 0 clean points (show an info alert).
