# Sessions Page Rework — Implementation Roadmap

## Phase 1 — Data Layer
**Goal**: Ensure per-walk photo counts and weekly aggregates are available cheaply.

- [x] **`lib/db/walk-photos.ts`** — Added `getPhotoCountsForWalks()` and `getFirstPhotosForWalks()` (bulk photo fetch with limit)
- [x] **`lib/db/walks.ts`** — Added `listCompletedWalksSince()` and `getWeeklyStats()` returning `WeekBucket[]` for the last N weeks
- [x] **`lib/db/track-points.ts`** — Added `getRouteCoordinatesForWalk(walkId, maxPoints = 60)` with downsampling

---

## Phase 2 — Core New Components

- [x] **`components/sessions/weekly-summary-card.tsx`**
  - Displays: total distance, session count, time outdoors
  - 8-week SVG bar chart (week labels, current week in secondary colour)
  - "THIS WEEK" heading label

- [x] **`components/sessions/session-memory-card.tsx`** — new card replacing `HistoryWalkCard`
  - **Photo strip**: horizontal scroll, 4 thumbnails with `+N` overlay
  - **Route SVG thumbnail**: `Polyline` from downsampled coordinates, coloured by secondary theme
  - **Title + metadata row**: distance · duration · elevation gain
  - Date group header rendered by parent screen, not inside card

- [x] **`components/sessions/perspective-switcher.tsx`**
  - Segmented pill control: **Recent · Routes · Nearby**
  - Controlled by `activeView` state in the parent screen

---

## Phase 3 — Screen Overhaul

- [x] **New screen: `app/(tabs)/sessions.tsx`**
  - Full dedicated screen (not a bottom sheet)
  - Layout: Header (title + Sync/Map actions) → `PerspectiveSwitcher` → `WeeklySummaryCard` → grouped `SectionList` feed
  - Groups walks by: Today / day label (this week) / Earlier This Month / Month Year
  - Routes and Nearby perspectives show "Coming soon" placeholder stubs
  - Enrichment (photos + route coords) loaded on every focus via `useFocusEffect`

- [x] **`app/(tabs)/index.tsx`** — Sessions tab press now routes to `/(tabs)/sessions` instead of opening a bottom sheet; sessions sheet and snap-point removed; `HistorySheetContent` remains in file but is unused (can be cleaned up in Phase 5)

---

## Phase 4 — Perspective Views

- [ ] **Recent** (default): chronological grouped list as above

- [ ] **Routes** (Phase 4b): group walks by proximity/overlap of start coordinates to infer repeated routes; show route silhouette + visit count + last visited date

- [ ] **Nearby** (Phase 4c): filter walks whose start point is within ~10km of current location using `expo-location`; show distance to start marker

> Routes and Nearby can be **stubbed** initially (show "Coming soon" placeholder) and filled in iteratively.

---

## Phase 5 — Polish

- [ ] **Date group headers** with collapsible "Earlier This Month" / older months (chevron toggle)
- [ ] **Skeleton loading** while DB query runs on focus
- [ ] **`HistoryWalkCard`** in `index.tsx` sessions sheet can remain as the compact list view (recordings-during-record overlay); the new full screen is the primary entry point

---

## Tab Wiring Change

The current tab bar has: `Explore · Record · [map/library icon] · Profile`
The sessions tab needs to point to the new screen. The `_layout.tsx` / `index.tsx` tab press routing will need updating to open the new screen rather than the in-map `HistorySheetContent`.

---

## Suggested Order of Work

| Step | What | Risk |
|------|------|------|
| 1 | Data helpers (photos, weekly stats, route coords) | Low |
| 2 | `WeeklySummaryCard` component | Low |
| 3 | `SessionMemoryCard` with photo strip + SVG route | Medium |
| 4 | New `sessions.tsx` screen wired to tab | Medium |
| 5 | `PerspectiveSwitcher` + Routes/Nearby stubs | Low |
| 6 | Date grouping + collapsible sections | Low |
