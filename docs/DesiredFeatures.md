🥾 Your Walking App – Feature Summary
🟢 1. Core Experience (MVP)

These are the foundations your app is built on.

📍 Recording
GPS walk recording
Background tracking (phone in pocket)
Pause / resume
Offline-first (no signal required)
🔁 Review
View completed walks
Map replay
Basic stats:
distance
time
elevation (optional)
🧭 Follow (Your Key Feature)
Follow your own recorded routes
Simple visual route line
No cluttered UI during walk
🧭 2. Guidance System (Your Differentiator)
🟢 Silent-by-default navigation
No constant instructions
No “turn right in 20m” noise
🔴 Off-route detection
Detect deviation from route
Distance-based thresholds
📳 Haptic feedback (core)
Escalating “heartbeat” style alerts:
subtle when slightly off
stronger when further away
Stops when back on route
🎧 Optional audio guidance
Pre-generated (offline)
Plays while phone is locked

Types:

junction instructions
waypoint notifications
optional progress updates
⚙️ Guidance modes
Silent (default) → only alerts when off-route
Assisted → adds subtle pre-turn cues
Full guidance → audio + full instructions
⏸️ User control
Pause guidance (quick access)
Snooze (e.g. 10 mins)
Auto-dampening if user stays off-route
🗺️ 3. Mapping & Navigation Layer
🌍 Map system
Mapbox-based (global coverage)
Abstracted map layer (future-proof)
🧭 Grid reference support
Show OS grid references (UK)
Optional grid overlay
Use in exports and navigation
🧾 Printable outputs
🧭 Navigation Card (open terrain)
bearings
distances
grid references
waypoint-to-waypoint
🥾 Walking Guide (footpaths)
natural language directions:
“take the left path at the fork”
broken into legs
📦 “Route Pack”
overview map (non-OS)
stats
instructions
printable PDF
🌄 4. Experience Features (Standout Ideas)
🧭 “Viewpoint / Trig Mode”

At key locations (e.g. tors, summits):

Modes:
3D terrain view (Mapbox)
optional AR overlay
Features:
landmark labels
distances
tap for info
“what am I looking at?”
🤖 AI-assisted content

Used before the walk, not during:

generate walking directions
create summaries
enrich with:
terrain notes
landmarks
history (optional)
🎧 Audio Route Guide
Pre-generated voice instructions
Stored offline
Triggered by location
📳 5. Haptic System (Core UX Layer)
Patterns:
Turn / attention → double pulse
Off-route → escalating pulses
Waypoint → single pulse
Viewpoint → long pulse
Behaviour:
minimal
meaningful
non-intrusive
🧠 6. Mental Model of the App

This is important:

👉 Your app is NOT:

a fitness tracker
a map-first tool
a turn-by-turn navigator

👉 Your app IS:

🟢 “A walking companion that quietly keeps you on track”
🚀 7. Future / Optional Features
🗺️ Map packs
OS maps (UK) as premium add-on
regional packs (like Komoot)
🌿 Environmental AI
plant/tree identification
wildlife recognition
🧠 Reflection layer
walk summaries
mood tracking (optional)
👥 Community (inspired by Ramblers)
group walks
shared routes
🎯 Sponsored walks
charity goals
progress tracking
shareable pages
🔥 Key Differentiators

Compared to apps like:

AllTrails
Komoot
Strava
You stand out by:
🟢 Silent navigation
alert only when wrong
🟢 Haptic-first guidance
works in pocket
no screen needed
🟢 Route reuse
record once → follow anytime
🟢 Printable outputs
navigation cards
walking guides
🟢 Viewpoint exploration
trig-style digital experience
👍 Final Thought

What you’ve designed is actually very coherent:

👉 Everything ties back to:

offline-first
low distraction
real-world walking behaviour

---

## 🚀 Pre-Release Checklist (closing-stage tasks)

> Items to review before final public release — not to implement early.

- [ ] **R8 / ProGuard** — Currently disabled (`minifyEnabled false` in `android/app/build.gradle`). Before release, evaluate enabling R8 (`minifyEnabled true` + `shrinkResources true`) to reduce AAB size (typically 20–40%) and allow mapping file upload to Play Console (makes crash stack traces readable in Android Vitals). Requires regression testing — React Native apps may need keep rules to prevent R8 stripping live code.