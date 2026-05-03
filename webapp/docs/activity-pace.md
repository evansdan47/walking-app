# Activity Pace Model

**Source file:** `src/lib/activity-pace.ts`  
**Used in:** `src/components/map/planner-overlay.tsx`

---

## Overview

The activity pace model estimates how long it will take to walk, jog, or run a planned route. It accounts for terrain gradient — speed varies continuously with slope rather than switching between a fixed set of "flat / uphill / downhill" buckets. The model is intentionally a *scientific estimate*, not a precise prediction; real-world conditions (surface type, weather, fitness level) will always vary.

---

## The Tobler Hiking Function

The mathematical foundation is the **modified Tobler (1993) hiking function**:

$$W = W_{\text{flat}} \cdot \frac{e^{-k\,|\text{slope}+0.05|}}{e^{-k \cdot 0.05}}$$

Where:

| Symbol | Meaning |
|--------|---------|
| $W$ | Speed at this gradient (km/h) |
| $W_{\text{flat}}$ | Cruising speed on flat ground (km/h) — activity-specific |
| $k$ | Gradient sensitivity — higher = more hill-affected |
| $\text{slope}$ | Rise ÷ run (dimensionless; positive = uphill) |

### Why +0.05?

The offset of +0.05 comes from empirical physiology: a **gentle 5% descent (~2.9°)** is the most efficient gradient because gravity assists forward motion without requiring heavy braking. The function peaks there and falls off in both directions. This is the original Tobler observation and is consistent across recreational hiking data.

### Why continuous, not threshold-based?

A hard cutover between terrain categories (e.g. "anything >5% counts as uphill") creates unrealistic step changes in time estimates when a route crosses that threshold by even one metre. The exponential function produces a smooth, continuous response:

- **0–3% gradient**: barely perceptible slowdown
- **3–8%**: noticeable, comfortable pace reduction
- **8–15%**: definite hill — meaningful time impact
- **15–25%**: steep — significant slowdown for all activities
- **>25%**: scrambling territory — all activities hit the minimum 0.5 km/h floor

The result is that time estimates average out naturally across variable terrain rather than "snapping" between modes.

---

## Activity Profiles

Four built-in profiles are defined in `ACTIVITY_PROFILES`:

| Activity | Label | Flat speed | Sensitivity (k) | Character |
|----------|-------|-----------|----------------|-----------|
| `amble` | Amble | 3.0 km/h | 4.5 | Leisurely stroll; most affected by hills |
| `ramble` | Ramble | 4.5 km/h | 3.5 | Comfortable walking; standard Tobler value |
| `jogger` | Jogger | 8.0 km/h | 2.8 | Easy jogging; better uphill fitness |
| `runner` | Runner | 12.0 km/h | 2.2 | Running pace; strongest hill technique |

**Flat speed** is the guaranteed speed at slope = 0 (the normalisation constant ensures this exactly).

**Gradient sensitivity (k)** controls how steeply the curve falls as gradient increases. The standard Tobler value is 3.5, validated for recreational walking. A higher k (amble) reflects that slower walkers expend proportionally more energy per metre of climb and have less reserve to maintain pace. A lower k (runner) reflects stronger cardiovascular and muscular adaptation.

### Speed at common gradients

Approximate values in km/h:

| Gradient | Amble | Ramble | Jogger | Runner |
|----------|-------|--------|--------|--------|
| −10% (descent) | 2.3 | 3.9 | 7.2 | 11.1 |
| 0% (flat) | 3.0 | 4.5 | 8.0 | 12.0 |
| +5% | 2.1 | 3.4 | 6.5 | 10.2 |
| +10% | 1.1 | 2.2 | 5.0 | 8.8 |
| +20% | 0.3 | 0.7 | 2.4 | 5.0 |

---

## Integration in the Planner

In `planner-overlay.tsx`, cumulative time is computed inside the waypoints IIFE:

```ts
const cumTimes: number[] = new Array(allFlat.length).fill(0);
for (let fi = 1; fi < allFlat.length; fi++) {
  const segKm = haversineKm(allFlat[fi - 1], allFlat[fi]);
  const elevDelta = elevations[flatToElev[fi]] - elevations[flatToElev[fi - 1]];
  const gradient = elevDelta / (segKm * 1000);   // rise(m) / run(m)
  cumTimes[fi] = cumTimes[fi - 1] + segKm / activity.speedAtGrade(gradient);
}
```

- `allFlat` — every point in the route (control points + API nav points) in order
- `flatToElev` — maps each `allFlat` index to the corresponding `elevationPoints` index (accounts for the densification step used to query terrain elevation from Mapbox)
- `cumTimes[i]` — hours from the start of the route to point `i`

Each control point and navigation point row in the waypoints table displays `ActivityPace.formatHours(cumTimes[flatIdx])`, which is the estimated time to *reach* that point from the start.

---

## Future Directions

- **User-personalised profiles** — once sufficient walk history is available (tracked via Convex), a user's actual pace distribution could be fitted to the Tobler curve to produce a personalised $k$ and $W_{\text{flat}}$.
- **Surface type modifier** — paths, roads, and off-trail terrain have different rolling resistance. A `surfaceMultiplier` could be added to the speed calculation.
- **Fitness-based dynamic k** — a user's `k` could adapt over time as more data is collected.
- **Pace selector UI** — the four pills in the stats bar are the entry point. A slider or custom pace input may be added later.
