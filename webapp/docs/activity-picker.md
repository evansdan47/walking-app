# ActivityPicker Component

**Source file:** `src/components/ui/activity-picker.tsx`  
**Used in:** `src/components/map/planner-overlay.tsx` (stats bar)  
**Data source:** `src/lib/activity-pace.ts`

---

## Overview

`ActivityPicker` is a reusable dropdown that lets the user select an activity type (Amble, Ramble, Jogger, Runner). The selected activity drives all pace and time estimates throughout the planner — changing it immediately updates Est. Time in the stats bar, all control point rows, all navigation point rows, and the segment summary lines.

---

## Design Rationale

**Why a dropdown instead of pills?**  
Pills worked for quick prototyping but became cramped in the 4-column stats grid. A dropdown lets each option include both an icon and a description line without consuming horizontal space in the stats bar.

**Why SVG icons in the data layer?**  
Each `ActivityType` in `ACTIVITY_ICONS` (in `activity-pace.ts`) stores its path data as an array of `d`-strings alongside its pace parameters. Keeping icon data co-located with pace data means a new activity type added to `ACTIVITY_PROFILES` automatically gains an icon slot in the same file, and the picker doesn't need to know anything about icon assets.

**Why the `+0.05` offset in the Tobler function?**  
See [activity-pace.md](activity-pace.md) for the full explanation.

---

## Components Exported

### `ActivityPicker`

```tsx
<ActivityPicker value={selectedActivity} onChange={setSelectedActivity} />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `ActivityType` | — | Currently selected activity |
| `onChange` | `(type: ActivityType) => void` | — | Called when user picks a new activity |
| `className` | `string` | `''` | Optional wrapper class names |

**Behaviour:**
- Trigger button shows icon + label + chevron
- Dropdown renders all profiles with icon, label, and description line
- Selected item highlighted green with a checkmark
- Closes on outside pointer-down or `Escape`

### `ActivityIcon`

Standalone SVG icon for a given activity type. Useful when you need the icon
alone (e.g. in a map tooltip or legend).

```tsx
<ActivityIcon type="jogger" size={20} color="#2E7D32" />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | `ActivityType` | — | Which icon to render |
| `size` | `number` | `24` | Width and height in px |
| `color` | `string` | `'currentColor'` | SVG stroke colour |
| `className` | `string` | `''` | Additional class names |

---

## Adding a New Activity

1. Add a new `ActivityType` union member in `activity-pace.ts`
2. Add a corresponding `ACTIVITY_ICONS` entry with path data (`d`-strings, 24×24 viewBox, stroke-based)
3. Add a corresponding `ACTIVITY_PROFILES` entry with `flatKmh` and `gradeSensitivity`
4. `ActivityPicker` will automatically render the new option — no other UI changes required

---

## Integration Notes

- `selectedActivity` state lives in `PlannerSidebar` (inside `planner-overlay.tsx`) — a single source of truth for the whole sidebar
- `SegmentRow` receives `activity` as a prop so its summary line also reflects the selected pace
- `cumTimes` in the waypoints IIFE re-derives on every render whenever `selectedActivity` changes (it is not memoised separately — the IIFE itself runs inside `collapsibleContent` which re-renders on state change)

---

## Future Directions

- A user's personalised pace profile (derived from walk history) could be added as a fifth option or an "auto" mode
- The description line in the dropdown could show a `flatKmh` range rather than a fixed sentence
- Long press or hover on an option could show a mini speed-vs-gradient chart
