---
name: global-pace
description: >
  Use this skill when adding, moving, or consuming the global pace (activity
  type) selector, or when calculating estimated times anywhere in the app. Also
  use when a new page or component needs to display an estimated walk time, or
  when the user asks why estimated times differ across panels.
---

# Global Pace — Architecture & Usage

The **global pace** is the single user-selected activity type (`ActivityType`)
that drives every estimated-time calculation across the whole Rambleio app.
There is only one pace at a time; changing it instantly updates all panels.

---

## Architecture

| Layer | File | Role |
|-------|------|------|
| State | `src/components/pace-context.tsx` | React context + `localStorage` persistence |
| Provider | `src/app/(dashboard)/layout.tsx` | Wraps the whole dashboard in `<PaceProvider>` |
| Picker UI | `src/components/dashboard-header.tsx` | `<ActivityPicker>` in the global nav bar |
| Consumer (planner) | `src/components/map/planner-overlay.tsx` | Reads `usePace()` for per-segment time calc |
| Consumer (explore) | `src/components/map/explore-overlay.tsx` | Reads `usePace()` in `SelectedRoutePanel` |

---

## Reading the pace in a component

```tsx
import { usePace } from '@/components/pace-context';
import { ACTIVITY_PROFILES } from '@/lib/activity-pace';

function MyComponent() {
  const { pace } = usePace();
  const activity = ACTIVITY_PROFILES[pace];
  // activity.flatKmh — flat-ground speed in km/h
  // activity.speedAtGrade(gradient) — speed at a given slope
  // ActivityPace.formatHours(hours) — "1h 30m" style string
}
```

---

## Calculating estimated time

### Simple estimate (total distance + elevation gain only)
Use this when you only have summary stats (e.g. a route card in the explore panel):

```ts
import type { ActivityPace } from '@/lib/activity-pace';

function fmtTime(km: number, elevM: number, activity: ActivityPace): string {
  // activity.flatKmh replaces the hardcoded 5 km/h in Naismith's rule
  const hrs = km / activity.flatKmh + elevM / 600;
  const totalMins = Math.round(hrs * 60);
  if (totalMins <= 0) return '—';
  if (totalMins < 60) return `${totalMins} min`;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
```

### Accurate per-segment estimate (planner, with elevation array)
Use `activity.speedAtGrade(gradient)` per segment when you have per-point
elevations. See `cumTimes` useMemo in `planner-overlay.tsx` for the reference
implementation.

---

## Changing the pace

```tsx
const { setPace } = usePace();
setPace('jogger'); // persists to localStorage automatically
```

---

## Key types from `src/lib/activity-pace.ts`

```ts
type ActivityType = 'amble' | 'ramble' | 'jogger' | 'runner';
// flatKmh values: amble=3.0, ramble=4.5, jogger=8.0, runner=12.0

class ActivityPace {
  readonly flatKmh: number;
  speedAtGrade(gradient: number): number; // gradient = rise/run (dimensionless)
  static formatHours(hours: number): string; // "1h 30m" style
}

const DEFAULT_ACTIVITY: ActivityType = 'ramble';
const ACTIVITY_PROFILES: Record<ActivityType, ActivityPace>;
```

---

## Rules

- **Never** create a local `selectedActivity` state — always call `usePace()`.
- **Never** hard-code `5` km/h for flat-ground speed — use `activity.flatKmh`.
- **Always** pass the `ActivityPace` object into time-formatting helpers rather
  than re-reading the profile inside the helper.
- The `ActivityPicker` UI component lives in
  `src/components/ui/activity-picker.tsx` — do not duplicate it.

---

## Future: personalised pace from walk history

The `ActivityType` key is a stable enum that can later be supplemented with a
user-specific multiplier derived from their recorded walks. The shape would be:

```ts
const effectiveFlatKmh = activity.flatKmh * (user.paceMultiplier ?? 1.0);
```

Keep this in mind when implementing: avoid embedding `activity.flatKmh` in
persisted data (store the `ActivityType` string instead).
