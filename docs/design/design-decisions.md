# Design Decisions Log

This document records significant product and UX decisions made during development, including the rationale behind each change. It serves as the canonical reference for why the app is the way it is.

---

## Recording Screen Redesign

*Captured May 2026 — based on the reference design shown in `record-a-walk-design.png`.*

---

### 1. Recording Flow Simplification

**Before:**
> Open Record → Welcome card → Press Start → Confirm state → Begin recording

**Now:**
> Tap Record → Immediately recording

Removing the welcome card and start confirmation eliminates friction, reduces the chance of forgetting to press start, and matches the mental model of other single-action capture tools (camera, voice memo). Pressing Record simply records.

**Balance:**
- Start = immediate (no friction)
- Pause / Stop = confirmation-protected (see §10)

---

### 2. The Recording Screen Is Walk-Centric, Not Device-Centric

**Removed from the live recording view:**
- Battery percentage
- Storage remaining
- Raw GPS accuracy (e.g. "±12 m")
- Lap button
- Home button
- Excess telemetry readouts

Showing device internals makes the screen feel like a diagnostics panel rather than a walking companion. Every element on the recording screen must answer the question: *"does this help the user understand their walk right now?"* If the answer is no, it is removed.

---

### 3. GPS Accuracy → GPS Signal Quality

**Before:** `GPS ±12m`
**Now:** `GPS Strong` (with a signal-bar icon)

Users care about confidence, not engineering metrics. "GPS Strong" communicates whether the route can be trusted. "±12 m" is meaningless to most users and implies a false precision. The signal-quality model (Strong / Good / Weak / No Signal) maps raw accuracy bands to human-readable confidence levels.

---

### 4. Live Elevation Profile During Recording

An elevation profile chart is displayed on the recording screen, updating as the walk progresses.

**Why this matters:**

Before this change, elevation data existed only as a post-walk review concept. Adding it to the recording screen makes the walk feel *alive* — the profile reinforces terrain, progress, and movement through landscape in real time.

It also creates visual and conceptual continuity between recording and review: the same chart shape the user watches grow during the walk is what they see again in the Elevation tab of the walk summary. This continuity makes both screens more familiar and reinforces the product's identity as an outdoor exploration companion rather than a data logger.

Photo markers are shown on the profile at their captured distance position, providing spatial context for photos within the terrain.

---

### 5. Additional Lifestyle Metrics on the Recording Screen

**Added to the live stat grid:**
- Active calories (live estimate)
- Steps (Health Connect preferred, device pedometer fallback)
- Elevation gain / loss

This broadens the app from route logger to walking activity companion without overwhelming the screen. The stat grid remains glanceable — nine cards maximum, laid out in three rows of three.

---

### 6. Calories Are Informational; Weight Is On-Demand

**Interaction model:**
- **Tap** calories card → informational tooltip only
- **Long press** calories card → quick-adjust body weight sheet

Calorie accuracy depends on body weight, but weight is not important enough to occupy permanent screen space. Long-press surfaces the adjustment exactly when the user cares (when looking at calories) without adding a visible weight field to the recording or review screens.

This pattern aligns with the preference storage architecture (`use-user-preferences.ts`, `expo-secure-store`) — weight is persisted and applied silently to all future calorie estimates.

---

### 7. Save Point: Quick Save on Tap, Categorisation on Long Press

**Interaction model:**
- **Tap** Save Point → immediately saves a waypoint at current location
- **Long press** Save Point → detailed categorisation sheet (type, name, note)

This supports both casual use (quick landmark drop) and future advanced route curation (typed waypoints, named points of interest) without forcing complexity onto every user. Save Point is the beginning of the route-authoring system that will underpin the planned route library and route-following features.

---

### 8. "Explore" Replaced "Home"

**Before:** Home tab
**Now:** Explore tab

"Home" is a generic mobile app convention. "Explore" is discovery-oriented and outdoorsy — it reinforces the core product identity of walking discovery rather than fitness tracking. The tab shows the walk history map, which is genuinely an exploration surface.

---

### 9. "Sessions" Replaced "Library"

**Before:** Library tab
**Now:** Sessions tab

"Library" implies static, file-oriented content management. "Sessions" is experiential, personal, and activity-based — it matches the app's data model (walk sessions, follow sessions, recorded sessions) and communicates that each entry is something *the user did*, not something they *filed*.

---

### 10. Confirmation Dialogs on Pause and Stop

Start is immediate (no dialog). Pause and Stop require a confirmation tap.

**Why:** Real-world outdoor conditions create accidental input — pocket presses, rain, gloves, and other environmental factors make unintended taps genuinely common. The cost of accidentally stopping a 3-hour walk far exceeds the cost of one extra tap. Start has no confirmation because the cost of an accidental start is low (the user simply stops immediately).

---

### 11. Recording and Review Are Deliberately Different Screens

**Recording purpose:** Live awareness, glanceability, low interaction cost
**Review purpose:** Reflection, analysis, exploration, tabs, deeper insight

These are different cognitive modes. An earlier risk in the design was making recording and review look identical. That would have been a mistake — a screen optimised for glancing at while walking is not the same as a screen optimised for sitting down and exploring your data.

Recording prioritises: a large live map, minimal UI, a stat grid that can be read at a glance, and a single action bar (Pause / Stop / Save Point).

Review prioritises: a collapsed map, tabbed navigation, rich breakdowns, and non-time-sensitive exploration.

---

### 12. Product Identity: Walking Companion, Not GPS Recorder

The sum of all the above decisions shifts the product's identity from "a GPS recorder that also shows stats" to "an exploration and walking companion." That is a more distinctive, emotionally resonant position — and one that better reflects the actual outdoor context in which the app is used.

The elevation profile during recording is the single addition that most embodies this shift: it transforms the act of recording movement into the experience of traversing terrain.

---

## Navigation Structure

| Tab | Previous Label | Current Label | Rationale |
|---|---|---|---|
| Map / history | Home | Explore | Outdoorsy, discovery-oriented |
| Active recording | Record | Record | Unchanged — correct |
| Walk history list | Library | Sessions | Experiential, matches data model |
| User settings | Profile | Profile | Unchanged — correct |
