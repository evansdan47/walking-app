# Design System Document: The Modern Alpine Framework

## 1. Overview & Creative North Star: "The Tactical Editorial"
This design system moves away from the generic "fitness tracker" aesthetic toward a **Tactical Editorial** experience. It combines the high-readability and hierarchy of a premium outdoor magazine with the rugged, functional utility of high-end GPS equipment.

The North Star of this system is **Intentional Asymmetry and Tonal Depth**. We reject the flat, "boxed-in" layout of standard apps. Instead, we use expansive white space, overlapping elements (like a map container bleeding behind a stat card), and high-contrast typography to create a sense of scale. The interface should feel like a sophisticated tool—built for the trail but designed for the gallery.

---

## 2. Colors: High-Visibility Contrast
Our palette utilizes a sophisticated "Earthy Neon" approach. We use high-vis `primary` (#a43700 - Burnt Ochre) and `secondary` (#1b6d24 - Forest Canopy) to draw the eye to critical actions, grounded by a cool, atmospheric `surface` series.

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders to section content. Separation is achieved through:
- **Background Shifts:** Placing a `surface-container-low` (#e6f6ff) element against a `surface` (#f3faff) background.
- **Negative Space:** Using the Spacing Scale (e.g., `8` or `10`) to create "breathing rooms" that act as invisible boundaries.

### Surface Hierarchy & Nesting
Treat the UI as physical layers of "Frosted Glacial Glass."
- **Layer 1 (Base):** `surface` (#f3faff)
- **Layer 2 (Content Sections):** `surface-container-low` (#e6f6ff)
- **Layer 3 (Floating Cards):** `surface-container-lowest` (#ffffff) for maximum "pop" and legibility.

### The "Glass & Gradient" Rule
For hero elements or active tracking states, use Glassmorphism. A container with `surface-variant` at 60% opacity with a `20px` backdrop blur creates a premium, integrated feel. Use a subtle linear gradient from `primary` (#a43700) to `primary_container` (#cd4700) on main CTAs to give them "soul" and tactile depth.

---

## 3. Typography: Precision & Scale
We utilize two typefaces to balance character with utility: **Plus Jakarta Sans** for high-impact displays and **Inter** for mission-critical data.

- **Display (Plus Jakarta Sans):** Used for "Hero Stats" (Total Miles, Elevation Gain). The exaggerated x-height feels modern and assertive.
- **Headline (Plus Jakarta Sans):** Used for section titles. Use `headline-lg` (2rem) to create a clear editorial entry point.
- **Body & Labels (Inter):** Inter’s neutral, high-legibility design is reserved for "glanceable" data like timestamps, coordinates, and labels.

**Editorial Tip:** Use `display-lg` (3.5rem) for the primary stat of a hike. Pair it with a `label-md` in all-caps with 5% letter spacing for a "technical manual" aesthetic.

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are forbidden. We use **Ambient Shadows** and **Tonal Stacking** to define depth.

- **The Layering Principle:** To lift a card, do not add a border. Place a `surface-container-lowest` (#ffffff) card on a `surface-dim` (#c7dde9) background.
- **Ambient Shadows:** When a button or map-control must float, use a shadow with a 24px blur, 4% opacity, using the `on-surface` color (#071e27). This mimics natural mountain light rather than digital mud.
- **The "Ghost Border":** If accessibility requires a stroke (e.g., in high-glare outdoor settings), use `outline-variant` (#e3bfb2) at **15% opacity**. It should be felt, not seen.

---

## 5. Components

### Buttons (Tactical Actions)
- **Primary:** High-vis `primary` (#a43700) background with `on-primary` (#ffffff) text. Use `xl` (1.5rem) roundedness for a "pill" shape that is easy to tap with gloves or moving hands.
- **Secondary:** `secondary_container` (#a0f399) background. This provides high visibility against the trail without competing with the primary "Start/Stop" actions.
- **Interaction:** On press, scale the button down to 0.96 for tactile haptic feedback.

### Data Visualization Cards
- **The Rule:** No dividers. Use `surface-container-highest` (#cfe6f2) backgrounds for the card itself.
- **Layout:** Use "Organic Brutalism"—large, bold stats (`display-md`) left-aligned, with small descriptive labels (`label-sm`) tucked in the corner or overlapping a subtle background icon.

### Map Containers
- **Style:** Maps should bleed edge-to-edge where possible. 
- **Overlays:** Use Glassmorphic panels (`surface` at 70% + blur) for map controls (Zoom, Layers). This keeps the map visible beneath the UI, increasing the sense of "immersion" in the landscape.

### Tracking Chips
- **Status:** Use `secondary` (#1b6d24) for "Active" and `primary` (#a43700) for "Paused."
- **Shape:** Use `full` (9999px) roundedness. These should look like physical pebbles or smooth stones.

---

## 6. Do's and Don'ts

### Do:
- **Use generous vertical spacing.** Outdoors, users are moving; tight layouts cause errors. Reference spacing `8` (2.75rem) between major content blocks.
- **Layer your surfaces.** Use the "Lowest to Highest" container logic to guide the eye.
- **Prioritize the "Primary" color for safety.** The Burnt Ochre (#a43700) must be used for the most critical path (e.g., "Emergency SOS" or "Finish Hike").

### Don't:
- **Don't use 1px dividers.** It clutters the rugged aesthetic and mimics legacy web design.
- **Don't use pure black.** Use `on-surface` (#071e27) for text to maintain a natural, high-end feel.
- **Don't use small tap targets.** Any interactive element must be at least 48dp x 48dp, even if the visual "asset" is smaller. Use the Spacing Scale to ensure padding.