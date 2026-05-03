---
name: ui-stat-card
description: >
  Use this skill when displaying numeric or text statistics in a card, panel,
  or grid — e.g. distance, elevation, time, calories, grade, MET-hours, or any
  other route/activity metric. Also use when asked to make stats display
  "consistent", "standardised", or "look the same" across panels.
---

# UI Stat Card Pattern

This skill defines the **canonical way to display route and activity statistics**
across the Rambleio webapp. Apply it everywhere a value + label pair is shown
in a panel, card, or sidebar.

---

## Core Pattern

> **Value first (large), label below (small caps)**

```tsx
<div className="text-center px-3">
  <p className="text-base font-bold text-slate">{value}</p>
  <p className="text-[10px] text-slate-light uppercase tracking-wider mt-0.5">{label}</p>
</div>
```

- Value: `text-base font-bold text-slate`
- Label: `text-[10px] text-slate-light uppercase tracking-wider mt-0.5`
- Alignment: `text-center` (in grids); left-aligned only in dense list rows

---

## Grid Layout

Use a `grid grid-cols-N divide-x divide-gray-100` wrapper. Apply padding inside
each cell with `pr-3` / `px-3` / `pl-3` so the divider lines have visible space
on both sides.

```tsx
<div className="grid grid-cols-3 divide-x divide-gray-100">
  <div className="text-center pr-3"> … </div>
  <div className="text-center px-3"> … </div>
  <div className="text-center pl-3"> … </div>
</div>
```

Wrap the grid in a section with a bottom border:

```tsx
<div className="px-5 pt-4 pb-4 border-b border-gray-100">
  {/* grid here */}
</div>
```

For **two rows of stats** (e.g. primary metrics + derived metrics), separate rows
with a top border and top margin rather than `gap-y`:

```tsx
<div className="grid grid-cols-3 divide-x divide-gray-100 mt-3 pt-3 border-t border-gray-100">
  …
</div>
```

This avoids the grid's `gap` collapsing the vertical border line.

---

## Info Tooltips Inline With the Label

When a stat has an explanatory tooltip, render it *inside* the label `<p>` using
`flex items-center justify-center gap-0.5`:

```tsx
<p className="text-[10px] text-slate-light uppercase tracking-wider mt-0.5 flex items-center justify-center gap-0.5">
  Active Calories
  <InfoTooltip text="Extra effort above resting: …" />
</p>
```

Never put the tooltip next to the value — it should clarify the label, not the number.

---

## Sub-Labels (Tertiary Lines)

Some stats have a contextual sub-line (e.g. "80 kg · Edit →" for calorie
estimates). Place these **below the label**, not below the value:

```tsx
<div className="text-center px-3">
  <p className="text-base font-bold text-slate">~{netKcal} kcal</p>
  <p className="text-[10px] text-slate-light uppercase tracking-wider mt-0.5 …">
    Active Calories <InfoTooltip … />
  </p>
  <p className="text-[10px] text-slate-light mt-1">
    {weightKg} kg · <button className="text-brand hover:underline">Edit →</button>
  </p>
</div>
```

---

## Badge / Non-Text Values

For stats that are rendered as a coloured badge (e.g. difficulty grade),
centre the badge in place of the value text, then put the label below as normal:

```tsx
<div className="text-center pl-3">
  <div className="flex items-center justify-center gap-1">
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold …">
      {routeGrade.label}
    </span>
  </div>
  <p className="text-[10px] text-slate-light uppercase tracking-wider mt-0.5">Grade</p>
</div>
```

---

## Conditional Second Row

Hide the second stats row entirely until data is available — never render empty
placeholder cells. Use a conditional wrapper:

```tsx
{routeGrade && (
  <div className="grid grid-cols-3 divide-x divide-gray-100 mt-3 pt-3 border-t border-gray-100">
    …
  </div>
)}
```

---

## Where This Pattern Is Used

| File | Section |
|------|---------|
| `src/components/map/planner-overlay.tsx` | `alwaysShownContent` stats grid |
| `src/components/map/explore-overlay.tsx` | `SelectedRoutePanel` stats grid |

When adding stats to any new panel or card in this repo, follow this pattern.
