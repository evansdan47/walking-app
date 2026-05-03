/**
 * Activity pace profiles for estimating walk/run times along a route.
 *
 * ## Gradient model — modified Tobler hiking function
 *
 * The original Tobler (1993) formula models walking speed as a function of
 * slope (rise / run, dimensionless):
 *
 *   W = 6 × exp(−3.5 × |slope + 0.05|)   [km/h]
 *
 * Key properties:
 *  • Peaks at slope = −0.05 (a gentle 5 % descent, ~2.9°) — physiologically
 *    this is the most efficient gradient because gravity assists without
 *    forcing heavy braking.
 *  • Falls off smoothly and continuously in both directions — no hard cutover
 *    between "flat" and "hill" modes.
 *  • At slope = 0 (flat):  W ≈ 5.04 km/h
 *  • At slope = +0.10 (10 % up):  W ≈ 2.4 km/h
 *  • At slope = +0.20 (20 % up):  W ≈ 0.5 km/h  (very steep)
 *  • At slope = −0.10 (10 % down): W ≈ 4.6 km/h  (braking kicks in)
 *
 * ## Per-activity scaling
 *
 * We normalise the formula so that flat-ground speed equals `flatKmh` exactly,
 * then apply a per-activity `gradeSensitivity` (the k parameter):
 *
 *   speed(slope) = flatKmh × exp(−k × |slope + 0.05|) / exp(−k × 0.05)
 *
 *  • Standard Tobler k = 3.5 suits a comfortable hiker (Ramble).
 *  • Higher k (e.g. 4.5) → more hill-sensitive (Amble).
 *  • Lower k (e.g. 2.2) → less hill-sensitive, handles grade better (Runner).
 *
 * This means times are not just linearly scaled by pace — steeper sections
 * penalise slower activities proportionally more than faster ones.
 *
 * ## Gradient interpretation
 *
 *   slope = Δelevation (m) / horizontal distance (m)
 *
 *  0–0.03  ( 0– 3 %):  barely perceptible
 *  0.03–0.08 ( 3– 8 %):  noticeable, comfortable
 *  0.08–0.15 ( 8–15 %):  definite hill, pace drops meaningfully
 *  0.15–0.25 (15–25 %):  steep — significant slowdown for all activities
 *  > 0.25 (> 25 %):  very steep — typically requires scrambling
 */

export type ActivityType = 'amble' | 'ramble' | 'jogger' | 'runner';

/**
 * SVG path data (viewBox 0 0 24 24) for each activity type.
 * Used by the ActivityPicker component to visually represent each activity.
 * Each entry is a `<path>` d-string drawn at 24×24 units, stroke-based.
 */
export const ACTIVITY_ICONS: Record<ActivityType, { paths: string[]; strokeWidth?: number }> = {
  // Person walking slowly with a cane
  amble: {
    paths: [
      // Head
      'M12 3 a1.5 1.5 0 1 1 0 3 a1.5 1.5 0 0 1 0-3',
      // Body leaning slightly forward
      'M12 6.5 L10.5 12 L9 17',
      // Walking stick
      'M11 9 L8.5 17',
      // Arms
      'M10.5 9 L8.5 12 M10.5 9 L13 11.5',
      // Legs
      'M10.5 12 L8.5 17 M10.5 12 L12 17',
    ],
    strokeWidth: 1.5,
  },
  // Person walking upright, relaxed stride
  ramble: {
    paths: [
      // Head
      'M12 2.5 a1.5 1.5 0 1 1 0 3 a1.5 1.5 0 0 1 0-3',
      // Torso
      'M12 6 L12 12',
      // Arms swinging
      'M12 8 L9.5 11 M12 8 L14.5 10.5',
      // Legs in stride
      'M12 12 L10 17 M12 12 L14 17',
    ],
    strokeWidth: 1.5,
  },
  // Person jogging — forward lean, bent knee raised
  jogger: {
    paths: [
      // Head
      'M13 2.5 a1.5 1.5 0 1 1 0 3 a1.5 1.5 0 0 1 0-3',
      // Torso (slight forward lean)
      'M13 6 L12 11.5',
      // Arms pumping
      'M12 8 L9.5 10.5 M12 8 L14.5 6.5',
      // Legs — one kicked back, one knee up
      'M12 11.5 L10 15.5 L9 18 M12 11.5 L14 14 L15 17',
    ],
    strokeWidth: 1.5,
  },
  // Person running — pronounced lean, high knees
  runner: {
    paths: [
      // Head
      'M14 2 a1.5 1.5 0 1 1 0 3 a1.5 1.5 0 0 1 0-3',
      // Torso (aggressive forward lean)
      'M14 5.5 L12 11',
      // Arms driving hard
      'M12 8 L9 9.5 M12 8 L15 6',
      // Legs — high stride
      'M12 11 L10 14 L8.5 17.5 M12 11 L14.5 13.5 L16 17',
    ],
    strokeWidth: 1.5,
  },
};

interface ActivityConfig {
  type: ActivityType;
  label: string;
  /** Short description shown as a tooltip (no jargon about specific groups). */
  description: string;
  /** Cruising speed on flat ground, km/h. */
  flatKmh: number;
  /**
   * Tobler gradient sensitivity (k parameter).
   * Higher = speed drops faster as gradient increases.
   * Standard leisure hiking = 3.5.
   */
  gradeSensitivity: number;
}

export class ActivityPace {
  readonly type: ActivityType;
  readonly label: string;
  readonly description: string;
  readonly flatKmh: number;
  private readonly gradeSensitivity: number;

  /**
   * Tobler normalisation constant.
   * At slope = 0: |0 + 0.05| = 0.05, so normFactor = exp(−k × 0.05).
   * Dividing by this ensures speedAtGrade(0) === flatKmh exactly.
   */
  private readonly normFactor: number;

  constructor(cfg: ActivityConfig) {
    this.type = cfg.type;
    this.label = cfg.label;
    this.description = cfg.description;
    this.flatKmh = cfg.flatKmh;
    this.gradeSensitivity = cfg.gradeSensitivity;
    this.normFactor = Math.exp(-cfg.gradeSensitivity * 0.05);
  }

  /**
   * Returns speed in km/h at the given gradient (dimensionless rise/run).
   *
   * Positive = uphill, negative = downhill.
   * The curve peaks at slope ≈ −0.05 (gentle descent).
   *
   * The function is continuous — there is no threshold or hard cutover
   * between terrain categories.
   */
  speedAtGrade(gradient: number): number {
    const factor = Math.exp(-this.gradeSensitivity * Math.abs(gradient + 0.05));
    // Clamp to a minimum of 0.5 km/h to avoid division-by-zero on extreme grades
    return Math.max(0.5, this.flatKmh * (factor / this.normFactor));
  }

  /**
   * Format decimal hours to a concise human-readable string.
   * e.g. 0.25 → "15 min", 1.5 → "1h 30m", 2.0 → "2h"
   */
  static formatHours(hours: number): string {
    if (hours <= 0) return '—';
    const totalMins = Math.max(1, Math.round(hours * 60));
    if (totalMins < 60) return `${totalMins} min`;
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }
}

/**
 * Built-in activity profiles.
 *
 * Flat speeds and sensitivity values are derived from empirical hiking/running
 * data. They can be adjusted here as real-world feedback accumulates.
 *
 * Future: users may have personalised profiles computed from their walk history.
 */
export const ACTIVITY_PROFILES: Record<ActivityType, ActivityPace> = {
  amble: new ActivityPace({
    type: 'amble',
    label: 'Amble',
    description: 'Leisurely stroll · ~3 km/h on the flat',
    flatKmh: 3.0,
    // Most affected by hills; caution on descents too
    gradeSensitivity: 4.5,
  }),

  ramble: new ActivityPace({
    type: 'ramble',
    label: 'Ramble',
    description: 'Comfortable walking pace · ~4–5 km/h on the flat',
    flatKmh: 4.5,
    // Standard Tobler value — well-validated for recreational walking
    gradeSensitivity: 3.5,
  }),

  jogger: new ActivityPace({
    type: 'jogger',
    label: 'Jogger',
    description: 'Easy jogging pace · ~8 km/h on the flat',
    flatKmh: 8.0,
    // Better uphill fitness; less cautious on descents
    gradeSensitivity: 2.8,
  }),

  runner: new ActivityPace({
    type: 'runner',
    label: 'Runner',
    description: 'Running pace · ~12 km/h on the flat',
    flatKmh: 12.0,
    // Strong uphill and controlled downhill technique
    gradeSensitivity: 2.2,
  }),
};

export const DEFAULT_ACTIVITY: ActivityType = 'ramble';

// ── Route grading ─────────────────────────────────────────────────────────────

/**
 * Route grade combining three metrics:
 *
 * 1. **ITRA effort score** — `distance_km + ascent_m / 100`
 *    Industry standard used by ITRA, UTMB, and most trail race organisers.
 *    Maps to five human-readable grades.
 *
 * 2. **MET-hours** — metabolic energy expenditure (activity-independent).
 *    Derived from the ACSM walking equation:
 *      MET ≈ 3.5 + (0.1 × speed_m_per_min) + (1.8 × speed_m_per_min × gradient)
 *    Then integrated over time: MET × duration_hours.
 *    Comparable to calorie-burn labels used by fitness trackers.
 *
 * 3. **Sustained climb flag** — true when any continuous climbing section
 *    exceeds 200 m of ascent at > 8 % average gradient. This directly
 *    addresses the "sustained uphill is draining" concern.
 */
export interface RouteGrade {
  /** ITRA effort score (distance_km + ascent_m/100). */
  itраScore: number;
  /** Human-readable grade label. */
  label: 'Easy' | 'Moderate' | 'Strenuous' | 'Very Strenuous' | 'Extreme';
  /** Tailwind colour class for the grade badge. */
  colour: 'green' | 'lime' | 'amber' | 'orange' | 'red';
  /** Gross MET-hours (locomotion + resting baseline). */
  metHours: number;
  /** Net MET-hours — locomotion effort only, resting baseline excluded. */
  netMetHours: number;
  /** True if the route contains a sustained uphill section (≥200 m gain, ≥8% avg gradient). */
  hasSustainedClimb: boolean;
}

/**
 * Compute route grade from per-segment distance, gradient, and time data.
 *
 * @param segmentData  Array of `{ distKm, gradient, timeHours }` for each
 *                     consecutive pair of densified route points.
 * @param totalAscentM Total ascent in metres (positive elevation gain only).
 * @param totalDistKm  Total route distance in km.
 */
export function computeRouteGrade(
  segmentData: { distKm: number; gradient: number; timeHours: number }[],
  totalAscentM: number,
  totalDistKm: number,
): RouteGrade {
  // 1. ITRA effort score
  const itraScore = totalDistKm + totalAscentM / 100;

  let label: RouteGrade['label'];
  let colour: RouteGrade['colour'];
  if (itraScore < 15)       { label = 'Easy';           colour = 'green';  }
  else if (itraScore < 30)  { label = 'Moderate';       colour = 'lime';   }
  else if (itraScore < 50)  { label = 'Strenuous';      colour = 'amber';  }
  else if (itraScore < 80)  { label = 'Very Strenuous'; colour = 'orange'; }
  else                      { label = 'Extreme';        colour = 'red';    }

  // 2. MET-hours using the appropriate ACSM equation per segment.
  //    The ACSM walking equation is valid up to ~8 km/h (133 m/min).
  //    Above that the running equation applies — it has a higher horizontal
  //    coefficient (0.2 vs 0.1), correctly producing more kcal/km for faster
  //    paces rather than less.
  //
  //    Walking  (< 133 m/min):  VO2 = 0.1×v + 1.8×v×max(0,g) + 3.5
  //    Running  (≥ 133 m/min):  VO2 = 0.2×v + 0.9×v×max(0,g) + 3.5
  //    (v in m/min; ACSM GETP 10th ed.)
  const RUNNING_THRESHOLD_M_PER_MIN = 133; // ≈ 8 km/h
  let metHours = 0;
  let netMetHours = 0;
  for (const seg of segmentData) {
    if (seg.timeHours <= 0 || seg.distKm <= 0) continue;
    const speedMPerMin = (seg.distKm * 1000) / (seg.timeHours * 60);
    const isRunning = speedMPerMin >= RUNNING_THRESHOLD_M_PER_MIN;
    const hCoeff = isRunning ? 0.2 : 0.1;
    const gCoeff = isRunning ? 0.9 : 1.8;
    const locomotionVO2 = hCoeff * speedMPerMin + gCoeff * speedMPerMin * Math.max(0, seg.gradient);
    const vo2 = locomotionVO2 + 3.5;
    metHours += (vo2 / 3.5) * seg.timeHours;
    netMetHours += (locomotionVO2 / 3.5) * seg.timeHours;
  }

  // 3. Sustained climb detection.
  //    Scan for runs of consecutive uphill segments totalling ≥200 m ascent
  //    where the average gradient over the run is ≥ 8%.
  let hasSustainedClimb = false;
  let runAscent = 0;
  let runDistKm = 0;
  const ASCENT_THRESHOLD_M = 200;
  const GRADIENT_THRESHOLD = 0.08;

  for (const seg of segmentData) {
    if (seg.gradient > 0.01) {
      // Uphill segment — accumulate the run
      runAscent += seg.gradient * seg.distKm * 1000;
      runDistKm += seg.distKm;
    } else {
      // Flat or downhill — check if the run just ended qualifies
      if (runDistKm > 0) {
        const avgGrad = runDistKm > 0 ? (runAscent / 1000) / runDistKm : 0;
        if (runAscent >= ASCENT_THRESHOLD_M && avgGrad >= GRADIENT_THRESHOLD) {
          hasSustainedClimb = true;
          break;
        }
      }
      runAscent = 0;
      runDistKm = 0;
    }
  }
  // Check any run still in progress at end of route
  if (!hasSustainedClimb && runDistKm > 0) {
    const avgGrad = (runAscent / 1000) / runDistKm;
    if (runAscent >= ASCENT_THRESHOLD_M && avgGrad >= GRADIENT_THRESHOLD) {
      hasSustainedClimb = true;
    }
  }

  return { itраScore: itraScore, label, colour, metHours, netMetHours, hasSustainedClimb };
}
