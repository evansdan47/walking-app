'use client';

import { api } from '@convex/_generated/api';
import type { Doc } from '@convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import type { GeoJSONSource } from 'mapbox-gl';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layer, Marker, Popup, Source, useMap } from 'react-map-gl/mapbox';
import { RouteTagDisplay } from '@/components/tags/route-tag-display';
import { PanelPacePicker } from '@/components/panel-pace-picker';
import { usePace } from '@/components/pace-context';
import { ACTIVITY_PROFILES, type ActivityPace } from '@/lib/activity-pace';
import { usePanelWidth, PANEL_MIN_WIDTH, PANEL_MAX_WIDTH, usePanelHeight, PANEL_MIN_HEIGHT, PANEL_MAX_HEIGHT, MOBILE_BREAKPOINT } from '@/hooks/use-panel-width';

// ── Types ──────────────────────────────────────────────────────────────────

export type PlannedRoute = Doc<'plannedRoutes'>;
/** Route enriched by listWithinBoundsWithAuthors — has resolved authorName + normalised visibility. */
export type EnrichedRoute = PlannedRoute & {
  authorName: string;
  visibility: 'private' | 'shared' | 'public';
  isOwner: boolean;
};
interface ViewBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

interface PopupState {
  lng: number;
  lat: number;
  routes: EnrichedRoute[];
}

function isSamePopupState(
  a: PopupState,
  lng: number,
  lat: number,
  routes: EnrichedRoute[],
): boolean {
  if (a.lng !== lng || a.lat !== lat || a.routes.length !== routes.length) return false;
  return a.routes.every((r, i) => r._id === routes[i]?._id);
}

// ── Geographic pre-clustering ────────────────────────────────────────────────

interface RouteGroup {
  routes: EnrichedRoute[];
  lat: number;
  lng: number;
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const dφ = ((lat2 - lat1) * Math.PI) / 180;
  const dλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  return haversineM(a.lat, a.lng, b.lat, b.lng) / 1000;
}

/** Greedy single-pass grouping: routes whose start points are within radiusM of
 *  the first ungrouped route in the set are merged into one pin. */
function preClusterRoutes(routes: EnrichedRoute[], radiusM: number): RouteGroup[] {
  const assigned = new Set<string>();
  const groups: RouteGroup[] = [];
  for (const route of routes) {
    if (assigned.has(route._id)) continue;
    const fp = route.legs[0]?.points[0];
    if (!fp) continue;
    const group: EnrichedRoute[] = [route];
    assigned.add(route._id);
    for (const other of routes) {
      if (assigned.has(other._id)) continue;
      const op = other.legs[0]?.points[0];
      if (!op) continue;
      if (haversineM(fp.lat, fp.lng, op.lat, op.lng) <= radiusM) {
        group.push(other);
        assigned.add(other._id);
      }
    }
    const lat = group.reduce((s, r) => s + (r.legs[0]?.points[0]?.lat ?? 0), 0) / group.length;
    const lng = group.reduce((s, r) => s + (r.legs[0]?.points[0]?.lng ?? 0), 0) / group.length;
    groups.push({ routes: group, lat, lng });
  }
  return groups;
}

// ── GeoJSON helpers ─────────────────────────────────────────────────────────

function groupsToGeoJSON(groups: RouteGroup[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: groups.map((g, i) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [g.lng, g.lat] },
      properties: {
        groupId: i,
        count: g.routes.length,
        color: g.routes[0].legs[0]?.color ?? '#E65100',
      },
    })),
  };
}

function routeToLineGeoJSON(route: PlannedRoute): FeatureCollection<LineString> {
  type Leg = { points: Array<{ lng: number; lat: number }>; color: string };
  return {
    type: 'FeatureCollection',
    features: (route.legs as Leg[])
      .filter((leg) => leg.points.length >= 2)
      .map((leg) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'LineString' as const,
          coordinates: leg.points.map((p) => [p.lng, p.lat]),
        },
        properties: { color: leg.color },
      })),
  };
}
/** Stable empty FeatureCollection used as a no-op data source. */
const EMPTY_FC: FeatureCollection<LineString> = { type: 'FeatureCollection', features: [] };
// ── Time formatting ─────────────────────────────────────────────────────────

/** Estimated time using the global activity pace (flat speed + Naismith-style elev penalty). */
function fmtTime(km: number, elevM: number, activity: ActivityPace): string {
  const hrs = km / activity.flatKmh + elevM / 600;
  const totalMins = Math.round(hrs * 60);
  if (totalMins <= 0) return '—';
  if (totalMins < 60) return `${totalMins} min`;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function difficultyLevel(distKm: number, elevM: number): { label: string; color: string } {
  const grade = elevM / (distKm * 1000 || 1);
  if (grade > 0.08 || distKm > 15) return { label: 'Hard', color: '#37474f' };
  if (grade > 0.04 || distKm > 8) return { label: 'Moderate', color: '#E65100' };
  return { label: 'Easy', color: '#2E7D32' };
}

function fmtDist(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

/**
 * Estimate net MET-hours for a route using the ACSM walking equation at a
 * reference pace of 4.5 km/h. Net MET-hours exclude the resting baseline (1 MET)
 * so the value represents locomotion effort only — comparable to fitness tracker
 * "active calories" labels.
 */
function calcNetMetHours(distKm: number, elevM: number): number {
  if (distKm <= 0) return 0;
  const SPEED_KMH = 4.5;
  const speedMPerMin = (SPEED_KMH * 1000) / 60;
  const avgGradient = elevM / (distKm * 1000);
  const locomotionVO2 = 0.1 * speedMPerMin + 1.8 * speedMPerMin * Math.max(0, avgGradient);
  const netMet = locomotionVO2 / 3.5;
  const timeHours = distKm / SPEED_KMH;
  return netMet * timeHours;
}

function calcViewingKm(bounds: ViewBounds): string {
  const latDiff = bounds.maxLat - bounds.minLat;
  const lngDiff = bounds.maxLng - bounds.minLng;
  const midLat = ((bounds.minLat + bounds.maxLat) / 2) * (Math.PI / 180);
  const km = Math.sqrt((latDiff * 111) ** 2 + (lngDiff * 111 * Math.cos(midLat)) ** 2);
  return km.toFixed(0);
}

// ── Filter helpers ───────────────────────────────────────────────────────────

function ceilTo(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

/** Round a distance (km) up to the nearest "nice" increment. */
function niceDistMax(km: number): number {
  if (km <= 2) return ceilTo(km, 0.5);
  if (km <= 10) return ceilTo(km, 1);
  if (km <= 30) return ceilTo(km, 2);
  if (km <= 100) return ceilTo(km, 5);
  return ceilTo(km, 10);
}

/** Round an elevation gain (m) up to the nearest "nice" increment. */
function niceElevMax(m: number): number {
  if (m <= 50) return ceilTo(m, 10);
  if (m <= 200) return ceilTo(m, 25);
  if (m <= 1000) return ceilTo(m, 50);
  return ceilTo(m, 100);
}

/** Round a duration (mins) up to the nearest "nice" increment. */
function niceDurMax(mins: number): number {
  if (mins <= 30) return ceilTo(mins, 5);
  if (mins <= 120) return ceilTo(mins, 15);
  if (mins <= 360) return ceilTo(mins, 30);
  return ceilTo(mins, 60);
}

/** Estimated walk duration in minutes for a route, using the global pace. */
function routeDurMins(km: number, elevM: number, activity: ActivityPace): number {
  return Math.max(1, Math.round((km / activity.flatKmh + elevM / 600) * 60));
}

// ── Dual-handle range slider ─────────────────────────────────────────────────

const THUMB_INPUT_CLS = [
  // pointer-events-none on the track: prevents the stacked inputs from
  // stealing each other's clicks. The thumb pseudo-element re-enables them.
  'absolute inset-0 w-full h-full appearance-none bg-transparent pointer-events-none',
  '[&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-0',
  '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:cursor-grab',
  '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5',
  '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white',
  '[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-brand [&::-webkit-slider-thumb]:shadow',
  '[&::-moz-range-track]:bg-transparent [&::-moz-range-track]:h-0',
  '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:cursor-grab',
  '[&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5',
  '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white',
  '[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-brand [&::-moz-range-thumb]:shadow',
].join(' ');

function RangeSlider({
  min, max, low, high, step = 1, onLow, onHigh, format, label,
}: {
  min: number; max: number; low: number; high: number; step?: number;
  onLow: (v: number) => void; onHigh: (v: number) => void;
  format: (v: number) => string; label: string;
}) {
  const range = max - min || 1;
  const lowPct = ((low - min) / range) * 100;
  const highPct = ((high - min) / range) * 100;

  return (
    <div className="flex flex-col gap-1.5 select-none">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">{label}</span>
        <span className="text-xs font-semibold text-slate tabular-nums shrink-0">
          {low === min && high === max ? 'Any' : `${format(low)} – ${format(high)}`}
        </span>
      </div>
      <div className="relative h-5">
        {/* Background track */}
        <div className="absolute top-1/2 inset-x-0 -translate-y-1/2 h-1.5 rounded-full bg-gray-200 pointer-events-none" />
        {/* Active range fill */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-brand pointer-events-none"
          style={{ left: `${lowPct}%`, width: `${highPct - lowPct}%` }}
        />
        {/* Low thumb — z-10 only when at max so it stays grabbable */}
        <input
          type="range" min={min} max={max} step={step} value={low}
          onChange={e => onLow(Math.max(min, Math.min(Number(e.target.value), high - step)))}
          className={`${THUMB_INPUT_CLS} ${low >= max ? 'z-10' : 'z-0'}`}
        />
        {/* High thumb — z-10 in the normal case (thumbs not at same position) */}
        <input
          type="range" min={min} max={max} step={step} value={high}
          onChange={e => onHigh(Math.min(max, Math.max(Number(e.target.value), low + step)))}
          className={`${THUMB_INPUT_CLS} ${low < max ? 'z-10' : 'z-0'}`}
        />
      </div>
    </div>
  );
}

// ── Filter bar ───────────────────────────────────────────────────────────────

function fmtDurSlider(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

interface FilterState {
  distKm: [number, number];   // high = Infinity → no upper limit
  elevM: [number, number];
  durMins: [number, number];
}

const UNFILTERED: FilterState = {
  distKm: [0, Infinity],
  elevM: [0, Infinity],
  durMins: [0, Infinity],
};

function isFilterActive(f: FilterState): boolean {
  return f.distKm[0] > 0 || f.distKm[1] !== Infinity
    || f.elevM[0] > 0 || f.elevM[1] !== Infinity
    || f.durMins[0] > 0 || f.durMins[1] !== Infinity;
}

function FilterBar({
  open, onToggle,
  filter, setFilter,
  maxDist, maxElev, maxDur,
}: {
  open: boolean; onToggle: () => void;
  filter: FilterState; setFilter: (f: FilterState) => void;
  maxDist: number; maxElev: number; maxDur: number;
}) {
  const active = isFilterActive(filter);
  const activeCount = [
    filter.distKm[0] > 0 || filter.distKm[1] !== Infinity,
    filter.elevM[0] > 0 || filter.elevM[1] !== Infinity,
    filter.durMins[0] > 0 || filter.durMins[1] !== Infinity,
  ].filter(Boolean).length;

  // Map Infinity sentinel to slider max
  const distLow = filter.distKm[0];
  const distHigh = filter.distKm[1] === Infinity ? maxDist : filter.distKm[1];
  const elevLow = filter.elevM[0];
  const elevHigh = filter.elevM[1] === Infinity ? maxElev : filter.elevM[1];
  const durLow = filter.durMins[0];
  const durHigh = filter.durMins[1] === Infinity ? maxDur : filter.durMins[1];

  return (
    <div className="absolute right-4 z-20 pointer-events-auto flex flex-col items-end gap-2" style={{ top: 70 }}>
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className={[
          'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow transition-colors',
          active
            ? 'bg-brand text-white hover:bg-brand/90'
            : 'bg-white text-slate hover:bg-gray-50 border border-gray-200',
        ].join(' ')}
        aria-label="Toggle filters"
      >
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="8" y1="12" x2="16" y2="12" />
          <line x1="11" y1="18" x2="13" y2="18" />
        </svg>
        Filter{activeCount > 0 && ` (${activeCount})`}
      </button>

      {/* Filter panel */}
      {open && (
        <div className="bg-white rounded-xl shadow-xl border border-gray-100 p-4 w-72 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate uppercase tracking-wider">Filter walks</p>
            {active && (
              <button
                onClick={() => setFilter(UNFILTERED)}
                className="text-[11px] font-semibold text-brand hover:underline"
              >
                Reset all
              </button>
            )}
          </div>

          <RangeSlider
            label="Distance"
            min={0} max={maxDist} step={0.5}
            low={distLow} high={distHigh}
            format={v => `${v} km`}
            onLow={v => setFilter({ ...filter, distKm: [v, filter.distKm[1]] })}
            onHigh={v => setFilter({ ...filter, distKm: [filter.distKm[0], v >= maxDist ? Infinity : v] })}
          />

          <RangeSlider
            label="Elev. gain"
            min={0} max={maxElev} step={10}
            low={elevLow} high={elevHigh}
            format={v => `${v} m`}
            onLow={v => setFilter({ ...filter, elevM: [v, filter.elevM[1]] })}
            onHigh={v => setFilter({ ...filter, elevM: [filter.elevM[0], v >= maxElev ? Infinity : v] })}
          />

          <RangeSlider
            label="Est. duration"
            min={0} max={maxDur} step={5}
            low={durLow} high={durHigh}
            format={fmtDurSlider}
            onLow={v => setFilter({ ...filter, durMins: [v, filter.durMins[1]] })}
            onHigh={v => setFilter({ ...filter, durMins: [filter.durMins[0], v >= maxDur ? Infinity : v] })}
          />
        </div>
      )}
    </div>
  );
}

// ── Popup route item ─────────────────────────────────────────────────────────

// ── Visibility badge ────────────────────────────────────────────────────────────────────

const VISIBILITY_CONFIG = {
  private: {
    label: 'Private',
    icon: (
      <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="7" width="10" height="7" rx="1.5" />
        <path d="M5 7V5a3 3 0 0 1 6 0v2" />
      </svg>
    ),
    className: 'bg-gray-100 text-gray-600 border border-gray-200',
  },
  shared: {
    label: 'Shared',
    icon: (
      <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="5" cy="6" r="2" />
        <circle cx="11" cy="6" r="2" />
        <path d="M1 13c0-2 1.8-3 4-3s4 1 4 3" />
        <path d="M11 10c1.5 0 3.5.8 3.5 2.5" />
      </svg>
    ),
    className: 'bg-blue-50 text-blue-600 border border-blue-200',
  },
  public: {
    label: 'Public',
    icon: (
      <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="8" cy="8" r="6" />
        <path d="M8 2a10 10 0 0 1 0 12M8 2a10 10 0 0 0 0 12" />
        <line x1="2" y1="8" x2="14" y2="8" />
      </svg>
    ),
    className: 'bg-green-50 text-green-700 border border-green-200',
  },
} as const;

function VisibilityBadge({ visibility }: { visibility: 'private' | 'shared' | 'public' }) {
  const cfg = VISIBILITY_CONFIG[visibility];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${cfg.className}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ── RoutePopupItem ─────────────────────────────────────────────────────────

function RoutePopupItem({
  route,
  onSelect,
  onHover,
  onLeave,
  displayColor,
}: {
  route: EnrichedRoute;
  onSelect: (r: EnrichedRoute) => void;
  onHover?: () => void;
  onLeave?: () => void;
  displayColor: string;
}) {
  const dist = route.stats?.distanceKm ?? 0;
  const elev = route.stats?.elevationGainM ?? 0;
  const diff = difficultyLevel(dist, elev);
  const netMetH = calcNetMetHours(dist, elev);
  return (
    <button
      onClick={() => onSelect(route)}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
    >
      {/* Route colour indicator */}
      <div
        className="shrink-0 w-3.5 h-3.5 rounded-full ring-2 ring-white shadow-sm"
        style={{ backgroundColor: displayColor }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-orange-600 transition-colors">
          {route.title}
        </p>
        {/* Badge + stats on one row */}
        <div className="flex items-center gap-3 mt-1.5">
          <span
            className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded text-white shrink-0"
            style={{ backgroundColor: diff.color }}
          >
            {diff.label}
          </span>
          {/* Stats: icon above value, 3 columns */}
          <div className="grid grid-cols-3 gap-x-3">
            <div className="flex flex-col items-center gap-0.5">
              <svg viewBox="0 0 12 12" className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="1" y1="6" x2="11" y2="6" />
                <polyline points="8,3 11,6 8,9" />
                <polyline points="4,3 1,6 4,9" />
              </svg>
              <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">{dist > 0 ? fmtDist(dist) : '—'}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <svg viewBox="0 0 12 12" className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="1,11 6,2 11,11" />
                <line x1="4" y1="6.5" x2="8" y2="6.5" />
              </svg>
              <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">{elev > 0 ? `+${Math.round(elev)} m` : '—'}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <svg viewBox="0 0 12 12" className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 11C3.5 11 2 9.5 2 7.5 2 5.5 4 4 4.5 2.5 4.5 4 5 5 5 5.5 5.8 4.5 6.2 3.2 5.8 2 7 3 8 5 8 7 8 9.5 7 11 6 11Z" />
              </svg>
              <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">{dist > 0 ? `${netMetH.toFixed(1)} MET·h` : '—'}</span>
            </div>
          </div>
        </div>
      </div>
      <svg
        className="w-4 h-4 text-gray-300 group-hover:text-orange-500 transition-colors shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
  );
}

// ── ExploreMapLayers — rendered INSIDE <Map> ─────────────────────────────────

interface ExploreMapLayersProps {
  viewBounds: ViewBounds | null;
  selectedRoute: EnrichedRoute | null;
  onRouteSelect: (r: EnrichedRoute | null) => void;
  elevHoverIdx?: number | null;
  onElevationsReady?: (points: Array<{ lat: number; lng: number }>, elevations: number[]) => void;
  /** When set, only routes whose IDs are in this Set are rendered as pins. */
  filteredIds?: Set<string> | null;
}

export function ExploreMapLayers({ viewBounds, selectedRoute, onRouteSelect, elevHoverIdx, onElevationsReady, filteredIds }: ExploreMapLayersProps) {
  const { current: map } = useMap();
  const routes = useQuery(api.planned_routes.listWithinBoundsWithAuthors, viewBounds ?? 'skip') as EnrichedRoute[] | undefined;

  // Apply active filter before clustering so hidden routes produce no pins
  const visibleRoutes = useMemo(() => {
    if (!routes || !filteredIds) return routes;
    return routes.filter(r => filteredIds.has(r._id));
  }, [routes, filteredIds]);

  // Pre-cluster at 15 m so overlapping start points always share one pin
  const groups = useMemo(() => (visibleRoutes ? preClusterRoutes(visibleRoutes, 15) : []), [visibleRoutes]);
  const groupsRef = useRef<RouteGroup[]>([]);
  groupsRef.current = groups;

  const onRouteSelectRef = useRef(onRouteSelect);
  onRouteSelectRef.current = onRouteSelect;

  const geoJSON = useMemo(() => groupsToGeoJSON(groups), [groups]);

  const [popup, setPopup] = useState<PopupState | null>(null);
  const popupRef = useRef<PopupState | null>(null);
  popupRef.current = popup;

  const toggleRoutePopupRef = useRef((lng: number, lat: number, routes: EnrichedRoute[]) => {
    void lng;
    void lat;
    void routes;
  });

  // ── Route line cache — avoids recomputing GeoJSON for the same route ──────
  const routeLineCacheRef = useRef<Map<string, FeatureCollection<LineString>>>(new Map());
  const getCachedLine = useCallback((route: EnrichedRoute): FeatureCollection<LineString> => {
    if (!routeLineCacheRef.current.has(route._id)) {
      routeLineCacheRef.current.set(route._id, routeToLineGeoJSON(route));
    }
    return routeLineCacheRef.current.get(route._id)!;
  }, []);

  // ── Pin hover — stores the whole group + anchor position ──────────────────
  const [pinHover, setPinHover] = useState<{ lng: number; lat: number; group: RouteGroup } | null>(null);
  const pinHoverRef = useRef<{ lng: number; lat: number; group: RouteGroup } | null>(null);

  // ── Popup item hover — restricts preview to the hovered route ─────────────
  const [popupRouteHover, setPopupRouteHover] = useState<EnrichedRoute | null>(null);
  const popupRouteHoverRef = useRef<EnrichedRoute | null>(null);

  toggleRoutePopupRef.current = (lng, lat, routes) => {
    const current = popupRef.current;
    if (current && isSamePopupState(current, lng, lat, routes)) {
      setPopup(null);
      setPopupRouteHover(null);
      popupRouteHoverRef.current = null;
      return;
    }
    pinHoverRef.current = null;
    setPinHover(null);
    setPopupRouteHover(null);
    popupRouteHoverRef.current = null;
    setPopup({ lng, lat, routes });
  };

  // ── Z-order cycling — rotates which route renders last (on top) ─────────
  // Only active when hovering a multi-route pin without a popup-item override.
  const [cycleIdx, setCycleIdx] = useState(0);
  useEffect(() => {
    const isMulti =
      pinHover !== null &&
      pinHover.group.routes.length > 1 &&
      !popupRouteHover &&
      popup === null;
    if (!isMulti) { setCycleIdx(0); return; }
    const id = setInterval(() => setCycleIdx((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [pinHover, popupRouteHover, popup]);

  // ── Elevation sampling for selected route ─────────────────────────────────
  // Sample terrain heights for each route point so the info panel can render
  // an elevation chart. Uses a short delay so the terrain DEM tiles have loaded.
  const [elevPoints, setElevPoints] = useState<Array<{ lat: number; lng: number }>>([]);
  const elevSampledIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedRoute) {
      setElevPoints([]);
      onElevationsReady?.([], []);
      elevSampledIdRef.current = null;
      return;
    }
    if (elevSampledIdRef.current === selectedRoute._id) return;
    elevSampledIdRef.current = selectedRoute._id;

    type Leg = { points: Array<{ lng: number; lat: number }> };
    const allPts = (selectedRoute.legs as Leg[]).flatMap((leg) => leg.points);
    if (allPts.length === 0) { setElevPoints([]); onElevationsReady?.([], []); return; }

    const mapInstance = map?.getMap();
    if (!mapInstance) { setElevPoints([]); onElevationsReady?.([], []); return; }

    // ── 1. Fit the map to the route so all terrain tiles are in view ─────────
    // queryTerrainElevation only works for tiles currently rendered — off-screen
    // tiles won't have elevation data and return 0 (flat spots in the profile).
    // We pan+zoom first, then sample once the map is idle (animation done + tiles loaded).
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const p of allPts) {
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
    }
    mapInstance.fitBounds(
      [[minLng, minLat], [maxLng, maxLat]],
      {
        // Left padding accounts for the 448px info panel + margin
        padding: { top: 80, right: 60, bottom: 60, left: 480 },
        duration: 800,
        maxZoom: 15,
      },
    );

    // ── 2. Sample elevations once the map is fully idle ───────────────────────
    // The 'idle' event fires when: camera animation has finished AND all tiles
    // (including terrain DEM tiles) have finished loading.
    function sampleElevations() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elevs = allPts.map((p) => {
        const e = (mapInstance as any).queryTerrainElevation([p.lng, p.lat], { exaggerated: false });
        return typeof e === 'number' ? e : 0;
      });
      setElevPoints(allPts);
      onElevationsReady?.(allPts, elevs);
    }

    // Safety fallback: sample after 3 s even if idle never fires (e.g. no terrain layer)
    const fallback = setTimeout(() => {
      mapInstance.off('idle', sampleElevations);
      sampleElevations();
    }, 3000);

    mapInstance.once('idle', () => {
      clearTimeout(fallback);
      sampleElevations();
    });

    return () => {
      clearTimeout(fallback);
      mapInstance.off('idle', sampleElevations);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoute, map]);

  // Two GeoJSON layers to guarantee z-order:
  //   baseLines — non-top routes (rendered first → below)
  //   topLine   — the currently cycled/selected route (rendered after → always on top)
  // Using a single source and reordering features within it does NOT guarantee
  // z-order in Mapbox GL because tile generation may not honour feature array order.
  // Separate Mapbox layers are added in stack order and are always respected.
  const { baseLines, topLine } = useMemo<{
    baseLines: FeatureCollection<LineString>;
    topLine: FeatureCollection<LineString>;
  }>(() => {
    if (popup) {
      if (popupRouteHover) {
        return { baseLines: EMPTY_FC, topLine: getCachedLine(popupRouteHover) };
      }
      return { baseLines: EMPTY_FC, topLine: EMPTY_FC };
    }
    if (popupRouteHover) {
      return { baseLines: EMPTY_FC, topLine: getCachedLine(popupRouteHover) };
    }
    if (pinHover) {
      const n = pinHover.group.routes.length;
      const topIdx = n > 1 ? cycleIdx % n : 0;
      const baseFeatures: Feature<LineString>[] = [];
      const topFeatures: Feature<LineString>[] = [];
      for (let i = 0; i < n; i++) {
        const feats = getCachedLine(pinHover.group.routes[i]).features;
        if (i === topIdx) topFeatures.push(...feats);
        else baseFeatures.push(...feats);
      }
      return {
        baseLines: { type: 'FeatureCollection', features: baseFeatures },
        topLine: { type: 'FeatureCollection', features: topFeatures },
      };
    }
    if (selectedRoute) return { baseLines: EMPTY_FC, topLine: getCachedLine(selectedRoute) };
    return { baseLines: EMPTY_FC, topLine: EMPTY_FC };
  }, [popup, popupRouteHover, pinHover, cycleIdx, selectedRoute, getCachedLine]);

  // Layer-specific click + cursor handlers
  useEffect(() => {
    if (!map) return;
    const mapbox = map.getMap();

    const onClusterClick = (e: mapboxgl.MapLayerMouseEvent) => {
      e.originalEvent.stopPropagation();
      const feature = e.features?.[0];
      if (!feature || feature.geometry.type !== 'Point') return;
      const clusterId = feature.properties?.cluster_id as number;
      const [lng, lat] = (feature.geometry as Point).coordinates;
      const source = mapbox.getSource('explore-routes') as GeoJSONSource | undefined;
      if (!source) return;
      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err || zoom == null) return;
        const currentZoom = mapbox.getZoom();
        if (zoom <= currentZoom + 0.5) {
          source.getClusterLeaves(clusterId, 100, 0, (lErr, features) => {
            if (lErr || !features) return;
            // Each leaf is a pre-cluster group; collect all routes from them
            const clusterRoutes = (features ?? []).flatMap((f) => {
              const gid = f.properties?.groupId as number;
              return groupsRef.current[gid]?.routes ?? [];
            });
            if (clusterRoutes.length > 0) {
              toggleRoutePopupRef.current(lng, lat, clusterRoutes as EnrichedRoute[]);
            }
          });
        } else {
          mapbox.easeTo({ center: [lng, lat], zoom });
        }
      });
    };

    const onPinClick = (e: mapboxgl.MapLayerMouseEvent) => {
      e.originalEvent.stopPropagation();
      const feature = e.features?.[0];
      if (!feature || feature.geometry.type !== 'Point') return;
      const gid = feature.properties?.groupId as number;
      const group = groupsRef.current[gid];
      if (!group) return;
      const [lng, lat] = (feature.geometry as Point).coordinates;
      if (group.routes.length === 1) {
        // Clear pinHover so it doesn't outlive the selection — mouseleave may
        // not fire on a click, leaving a stale hover line after the panel closes.
        pinHoverRef.current = null;
        setPinHover(null);
        setPopup(null);
        setPopupRouteHover(null);
        popupRouteHoverRef.current = null;
        onRouteSelectRef.current(group.routes[0] as EnrichedRoute);
      } else {
        toggleRoutePopupRef.current(lng, lat, group.routes as EnrichedRoute[]);
      }
    };

    const onPinMouseEnter = (e: mapboxgl.MapLayerMouseEvent) => {
      mapbox.getCanvas().style.cursor = 'pointer';
      if (popupRef.current) return;
      const feature = e.features?.[0];
      if (!feature || feature.geometry.type !== 'Point') return;
      const gid = feature.properties?.groupId as number;
      const group = groupsRef.current[gid];
      if (!group) return;
      const [lng, lat] = (feature.geometry as Point).coordinates;
      const next = { lng, lat, group };
      pinHoverRef.current = next;
      setPinHover(next);
    };

    const onPinMouseLeave = () => {
      mapbox.getCanvas().style.cursor = '';
      if (!pinHoverRef.current) return;
      pinHoverRef.current = null;
      setPinHover(null);
    };

    const cursorOn = () => { mapbox.getCanvas().style.cursor = 'pointer'; };
    const cursorOff = () => { mapbox.getCanvas().style.cursor = ''; };

    mapbox.on('click', 'explore-clusters', onClusterClick);
    mapbox.on('click', 'explore-cluster-count', onClusterClick);
    mapbox.on('click', 'explore-unclustered-point', onPinClick);
    mapbox.on('click', 'explore-unclustered-count', onPinClick);
    mapbox.on('mouseenter', 'explore-clusters', cursorOn);
    mapbox.on('mouseleave', 'explore-clusters', cursorOff);
    mapbox.on('mouseenter', 'explore-unclustered-point', onPinMouseEnter);
    mapbox.on('mouseleave', 'explore-unclustered-point', onPinMouseLeave);
    mapbox.on('mouseenter', 'explore-unclustered-count', onPinMouseEnter);
    mapbox.on('mouseleave', 'explore-unclustered-count', onPinMouseLeave);

    return () => {
      mapbox.off('click', 'explore-clusters', onClusterClick);
      mapbox.off('click', 'explore-cluster-count', onClusterClick);
      mapbox.off('click', 'explore-unclustered-point', onPinClick);
      mapbox.off('click', 'explore-unclustered-count', onPinClick);
      mapbox.off('mouseenter', 'explore-clusters', cursorOn);
      mapbox.off('mouseleave', 'explore-clusters', cursorOff);
      mapbox.off('mouseenter', 'explore-unclustered-point', onPinMouseEnter);
      mapbox.off('mouseleave', 'explore-unclustered-point', onPinMouseLeave);
      mapbox.off('mouseenter', 'explore-unclustered-count', onPinMouseEnter);
      mapbox.off('mouseleave', 'explore-unclustered-count', onPinMouseLeave);
    };
  }, [map]);

  if (!routes || routes.length === 0) return null;

  return (
    <>
      {/* Cluster + pin source */}
      <Source
        id="explore-routes"
        type="geojson"
        data={geoJSON}
        cluster
        clusterRadius={50}
        clusterMaxZoom={14}
        clusterProperties={{
          // Sum the per-pin route count so clusters show total routes, not total pins
          route_count: ['+', ['get', 'count']],
        }}
      >
        {/* Cluster backing circles */}
        <Layer
          id="explore-clusters"
          type="circle"
          filter={['has', 'point_count']}
          paint={{
            'circle-color': [
              'step',
              ['get', 'route_count'],
              '#E65100',
              5, '#BF360C',
              15, '#7B1FA2',
            ],
            'circle-radius': ['step', ['get', 'route_count'], 20, 5, 24, 15, 28],
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#fff',
            'circle-opacity': 0.92,
          }}
        />
        {/* Cluster count text — shows total routes, not pin count */}
        <Layer
          id="explore-cluster-count"
          type="symbol"
          filter={['has', 'point_count']}
          layout={{
            'text-field': ['to-string', ['get', 'route_count']],
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': 13,
          }}
          paint={{ 'text-color': '#ffffff' }}
        />
        {/* Individual pins — larger when representing multiple grouped routes */}
        <Layer
          id="explore-unclustered-point"
          type="circle"
          filter={['!', ['has', 'point_count']]}
          paint={{
            'circle-color': ['get', 'color'],
            'circle-radius': ['case', ['>', ['get', 'count'], 1], 13, 9],
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#fff',
            'circle-opacity': 0.92,
          }}
        />
        {/* Count badge on multi-route pins */}
        <Layer
          id="explore-unclustered-count"
          type="symbol"
          filter={['all', ['!', ['has', 'point_count']], ['>', ['get', 'count'], 1]]}
          layout={{
            'text-field': ['get', 'count'],
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': 11,
            'text-allow-overlap': true,
          }}
          paint={{ 'text-color': '#ffffff' }}
        />
      </Source>

      {/* Route preview — two sources guarantee z-order via Mapbox layer stack.
           explore-route-base is added first (renders below);
           explore-route-top is added after (always renders on top).
           Both are always mounted; empty FeatureCollections show nothing. */}
      <Source id="explore-route-base" type="geojson" data={baseLines}>
        <Layer
          id="explore-route-base-casing"
          type="line"
          paint={{ 'line-color': '#fff', 'line-width': 6, 'line-opacity': 0.4 }}
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        />
        <Layer
          id="explore-route-base-line"
          type="line"
          paint={{ 'line-color': ['get', 'color'], 'line-width': 4, 'line-opacity': 0.5 }}
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        />
      </Source>
      <Source id="explore-route-top" type="geojson" data={topLine}>
        <Layer
          id="explore-route-top-casing"
          type="line"
          paint={{ 'line-color': '#fff', 'line-width': 6, 'line-opacity': 0.7 }}
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        />
        <Layer
          id="explore-route-top-line"
          type="line"
          paint={{ 'line-color': ['get', 'color'], 'line-width': 4, 'line-opacity': 0.95 }}
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        />
      </Source>

      {/* Click popup — route selection for multi-route pins */}
      {popup && (
        <Popup
          longitude={popup.lng}
          latitude={popup.lat}
          anchor="bottom"
          onClose={() => {
            setPopup(null);
            setPopupRouteHover(null);
            popupRouteHoverRef.current = null;
          }}
          closeButton={false}
          closeOnClick={false}
          closeOnMove={false}
          offset={20}
          maxWidth="360px"
        >
          <div className="py-1 min-w-72">
            {popup.routes.length > 1 && (
              <div className="flex items-center justify-between px-3 pb-2 border-b border-gray-100 mb-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  {popup.routes.length} routes here
                </p>
                <button
                  onClick={() => setPopup(null)}
                  className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  aria-label="Close"
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            {popup.routes.map((route) => (
              <RoutePopupItem
                key={route._id}
                route={route}
                displayColor={route.legs[0]?.color ?? '#E65100'}
                onSelect={(r) => {
                  popupRouteHoverRef.current = null;
                  setPopupRouteHover(null);
                  pinHoverRef.current = null;
                  setPinHover(null);
                  onRouteSelectRef.current(r);
                  setPopup(null);
                }}
                onHover={() => {
                  popupRouteHoverRef.current = route;
                  setPopupRouteHover(route);
                }}
                onLeave={() => {
                  popupRouteHoverRef.current = null;
                  setPopupRouteHover(null);
                }}
              />
            ))}
          </div>
        </Popup>
      )}

      {/* Elevation chart hover marker — walker dot follows mouse on map */}
      {elevHoverIdx != null && elevPoints[elevHoverIdx] && (
        <Marker
          longitude={elevPoints[elevHoverIdx].lng}
          latitude={elevPoints[elevHoverIdx].lat}
          anchor="bottom"
        >
          <div className="w-4 h-4 rounded-full bg-green-700 ring-2 ring-white shadow-md" />
        </Marker>
      )}
    </>
  );
}

// ── Explore elevation profile ────────────────────────────────────────────────

interface ExploreElevProfileProps {
  points: Array<{ lat: number; lng: number }>;
  elevations: number[];
  onHoverIndex?: (idx: number | null) => void;
}

export function ExploreElevationProfile({ points, elevations, onHoverIndex }: ExploreElevProfileProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverNorm, setHoverNorm] = useState<number | null>(null);

  const len = Math.min(points.length, elevations.length);
  const hasData = len >= 2;

  const cumDists = useMemo(() => {
    if (points.length === 0) return [];
    const r = [0];
    for (let i = 1; i < points.length; i++) r.push(r[i - 1] + haversineKm(points[i - 1], points[i]));
    return r;
  }, [points]);

  const { minElev, maxElev } = useMemo(() => {
    const slice = elevations.slice(0, len).filter(Number.isFinite);
    if (slice.length === 0) return { minElev: 0, maxElev: 100 };
    const lo = Math.min(...slice);
    const hi = Math.max(...slice);
    const pad = Math.max((hi - lo) * 0.15, 8);
    return { minElev: lo - pad, maxElev: hi + pad };
  }, [elevations, len]);

  const elevRange = Math.max(maxElev - minElev, 10);
  const totalDist = cumDists.length > 0 ? cumDists[cumDists.length - 1] : 0;
  const W = 440; const H = 60;
  const xOf = (d: number) => totalDist > 0 ? (d / totalDist) * W : 0;
  const yOf = (e: number) => H - 4 - ((e - minElev) / elevRange) * (H - 14);

  let pathD = '';
  let fillD = '';
  if (hasData && totalDist > 0) {
    const segs = cumDists.slice(0, len).map((d, i) =>
      `${i === 0 ? 'M' : 'L'}${xOf(d).toFixed(1)},${yOf(elevations[i]).toFixed(1)}`
    );
    pathD = segs.join(' ');
    fillD = `${pathD} L${W},${H} L0,${H} Z`;
  }

  function normToIndex(norm: number): number {
    if (cumDists.length === 0) return 0;
    const dist = norm * totalDist;
    let best = 0, bestDiff = Infinity;
    for (let i = 0; i < len; i++) {
      const d = Math.abs(cumDists[i] - dist);
      if (d < bestDiff) { bestDiff = d; best = i; }
    }
    return best;
  }

  function getSVGNorm(e: React.MouseEvent): number {
    const svg = svgRef.current;
    if (!svg) return 0;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return 0;
    const svgPt = pt.matrixTransform(ctm.inverse());
    return Math.max(0, Math.min(1, svgPt.x / W));
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!hasData) return;
    const norm = getSVGNorm(e);
    setHoverNorm(norm);
    onHoverIndex?.(normToIndex(norm));
  }

  function handleMouseLeave() {
    setHoverNorm(null);
    onHoverIndex?.(null);
  }

  const hoverIdx = hoverNorm !== null ? normToIndex(hoverNorm) : null;
  const hoverElev = hoverIdx !== null ? (elevations[hoverIdx] ?? null) : null;
  const hoverSvgX = hoverNorm !== null ? hoverNorm * W : null;
  const hoverSvgY = hoverElev !== null ? yOf(hoverElev) : null;

  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => fmtDist(totalDist * t));

  if (!hasData) {
    return (
      <div className="h-16 flex items-center justify-center bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-400">Elevation data loading…</p>
      </div>
    );
  }

  return (
    <div className="select-none">
      <svg
        ref={svgRef}
        viewBox={`0 -26 ${W} ${H + 26}`}
        preserveAspectRatio="none"
        className="w-full h-20 cursor-crosshair overflow-visible"
        style={{ userSelect: 'none' }}
        aria-label="Elevation profile"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <linearGradient id="exploreElevGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2E7D32" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#2E7D32" stopOpacity="0" />
          </linearGradient>
        </defs>
        {pathD && <path d={fillD} fill="url(#exploreElevGrad)" />}
        {pathD && <path d={pathD} fill="none" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}

        {hoverSvgX !== null && hoverSvgY !== null && (
          <>
            <line x1={hoverSvgX} y1="0" x2={hoverSvgX} y2={H} stroke="#455A64" strokeWidth="1" strokeDasharray="3 2" opacity="0.4" />
            <circle cx={hoverSvgX} cy={hoverSvgY} r="3.5" fill="white" stroke="#1a1a1a" strokeWidth="1.5" />
            {/* Walking figure */}
            <g transform={`translate(${hoverSvgX - 4},${hoverSvgY - 19})`} aria-hidden="true">
              <circle cx="4" cy="2.5" r="2" fill="#2E7D32" />
              <line x1="4" y1="4.5" x2="4" y2="10" stroke="#2E7D32" strokeWidth="1.4" strokeLinecap="round" />
              <line x1="4" y1="6.5" x2="1.5" y2="9.5" stroke="#2E7D32" strokeWidth="1.4" strokeLinecap="round" />
              <line x1="4" y1="6.5" x2="6.5" y2="9" stroke="#2E7D32" strokeWidth="1.4" strokeLinecap="round" />
              <line x1="4" y1="10" x2="2" y2="14.5" stroke="#2E7D32" strokeWidth="1.4" strokeLinecap="round" />
              <line x1="4" y1="10" x2="6" y2="14" stroke="#2E7D32" strokeWidth="1.4" strokeLinecap="round" />
            </g>
            {hoverElev !== null && (() => {
              const label = `${Math.round(hoverElev)} m`;
              const bw = label.length * 7.5 + 29;
              const bx = Math.max(bw / 2 + 2, Math.min(W - bw / 2 - 2, hoverSvgX));
              return (
                <g>
                  <rect x={bx - bw / 2} y={-24} width={bw} height={19} rx="3" fill="white" stroke="#d1d5db" strokeWidth="0.8" />
                  <g transform={`translate(${bx - bw / 2 + 7},-21)`} stroke="#455A64" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3">
                    <polygon points="0,10 5,1 10,10" />
                    <line x1="3.2" y1="5.2" x2="6.8" y2="5.2" />
                  </g>
                  <text x={bx - bw / 2 + 21} y={-10} textAnchor="start" fontSize="13" fill="#455A64" fontWeight="600">{label}</text>
                </g>
              );
            })()}
          </>
        )}
      </svg>
      <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
        {xTicks.map((label, i) => <span key={i}>{label}</span>)}
      </div>
    </div>
  );
}

// ── Photo placeholders ────────────────────────────────────────────────────────

function WalkPhoto({ scene, className }: { scene: number; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-lg bg-gray-200 ${className ?? ''}`}>
      <svg viewBox="0 0 200 150" className="w-full h-full block">
        {scene === 0 && <>
          <rect width="200" height="150" fill="#5B8FB9" />
          <path d="M0 90 Q40 70 80 82 Q120 94 160 76 Q180 70 200 78 L200 150 L0 150Z" fill="#3a6b4a" />
          <path d="M0 112 Q50 96 100 106 Q150 116 200 101 L200 150 L0 150Z" fill="#1e4a2e" />
          <path d="M25 82 Q34 53 44 82Z" fill="#6b9b6b" />
          <path d="M152 77 Q164 47 178 77Z" fill="#6b9b6b" />
          <ellipse cx="158" cy="34" rx="22" ry="14" fill="#fff" opacity="0.75" />
        </>}
        {scene === 1 && <>
          <rect width="200" height="150" fill="#a8d0e8" />
          <path d="M0 100 Q55 62 105 78 Q155 94 200 66 L200 150 L0 150Z" fill="#4CAF50" />
          <path d="M0 122 Q62 102 125 112 Q172 120 200 108 L200 150 L0 150Z" fill="#2E7D32" />
          {[28, 76, 130, 174].map((x, i) => (
            <path key={i} d={`M${x} ${88 + (i % 2) * 8} Q${x + 9} ${68 + (i % 2) * 8} ${x + 18} ${88 + (i % 2) * 8}Z`} fill="#388E3C" />
          ))}
          <circle cx="40" cy="28" r="16" fill="#fff" opacity="0.7" />
        </>}
        {scene === 2 && <>
          <rect width="200" height="150" fill="#b8c9d4" />
          <path d="M0 112 Q28 80 62 96 Q92 110 122 84 Q152 58 200 90 L200 150 L0 150Z" fill="#78909C" />
          <path d="M0 128 Q42 112 82 122 Q132 132 200 118 L200 150 L0 150Z" fill="#546E7A" />
          <path d="M72 94 Q90 58 108 84Z" fill="#90A4AE" />
          <path d="M140 90 Q158 54 178 88Z" fill="#90A4AE" />
          <ellipse cx="110" cy="30" rx="30" ry="18" fill="#e8ecee" opacity="0.6" />
        </>}
        {scene === 3 && <>
          <rect width="200" height="150" fill="#3a5c2e" />
          <path d="M0 40 Q50 20 100 35 Q150 50 200 30 L200 150 L0 150Z" fill="#2d4a24" />
          <rect x="88" y="0" width="12" height="110" fill="#6b4514" />
          {[20, 50, 72, 100, 130, 160].map((x, i) => (
            <path key={i} d={`M${x} ${70 + (i % 3) * 12} Q${x + 14} ${44 + (i % 3) * 12} ${x + 28} ${70 + (i % 3) * 12}Z`} fill="#2E7D32" />
          ))}
          <path d="M82 140 Q90 112 98 140Z M100 140 Q108 115 116 140Z" fill="#5a3c10" />
        </>}
      </svg>
    </div>
  );
}

function PhotoGrid() {
  return (
    <div className="flex gap-1.5" style={{ height: 168 }}>
      <WalkPhoto scene={0} className="flex-3" />
      <div className="flex flex-col gap-1.5 flex-2">
        <WalkPhoto scene={1} className="flex-1" />
        <WalkPhoto scene={2} className="flex-1" />
      </div>
    </div>
  );
}

// ── Reviews ───────────────────────────────────────────────────────────────────

const MOCK_REVIEWS = [
  {
    id: 'r1',
    name: 'Sarah Mitchell',
    initials: 'SM',
    color: '#4CAF50',
    rating: 5,
    date: 'Mar 2026',
    activity: 'Hiking',
    text: 'Stunning views throughout. The path to the summit is steep but totally worth it — well-marked and rewarding.',
  },
  {
    id: 'r2',
    name: 'Tom Perkins',
    initials: 'TP',
    color: '#1976D2',
    rating: 4,
    date: 'Jan 2026',
    activity: 'Hiking',
    text: 'Beautiful walk with lovely sections. Can get muddy after rain near the start. Parking fills quickly at weekends.',
  },
  {
    id: 'r3',
    name: 'Lisa Chen',
    initials: 'LC',
    color: '#E91E63',
    rating: 4,
    date: 'Dec 2025',
    activity: 'Trail running',
    text: 'Great run! The descent into the cove is a highlight. Start early to avoid weekend crowds.',
  },
];

function StarRating({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <svg key={i} viewBox="0 0 24 24" className="w-3.5 h-3.5"
          fill={i < value ? '#FFB300' : 'none'}
          stroke={i < value ? '#FFB300' : '#D1D5DB'}
          strokeWidth="2"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  );
}

function ReviewRow({ name, initials, color, rating, date, activity, text }: typeof MOCK_REVIEWS[number]) {
  return (
    <div className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
      <div
        className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold"
        style={{ backgroundColor: color }}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
          <span className="text-[11px] text-gray-400 shrink-0">{date}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <StarRating value={rating} />
          <span className="text-[11px] text-gray-500">· {activity}</span>
        </div>
        <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

// ── Selected route panel ─────────────────────────────────────────────────────

interface SelectedRoutePanelProps {
  route: EnrichedRoute;
  onClose: () => void;
  onPreview: () => void;
  routeElevPoints: Array<{ lat: number; lng: number }>;
  routeElevations: number[];
  onElevHoverIdx: (idx: number | null) => void;
  /** True when the current user is an admin (can edit any route). */
  isAdmin: boolean;
  /** Called when the user clicks the Edit button. */
  onEdit?: () => void;
}

function SelectedRoutePanel({ route, onClose, onPreview, routeElevPoints, routeElevations, onElevHoverIdx, isAdmin, onEdit }: SelectedRoutePanelProps) {
  const dist = route.stats?.distanceKm ?? 0;
  const elev = route.stats?.elevationGainM ?? 0;
  const { pace } = usePace();
  const activity = ACTIVITY_PROFILES[pace];
  const diff = difficultyLevel(dist, elev);
  const date = new Date(route.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  const [liked, setLiked] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  // ── Resize ──────────────────────────────────────────────────────────────
  const [width, onWidthChange] = usePanelWidth();
  const [panelHeight, setPanelHeight] = usePanelHeight();
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT,
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Width resize (desktop)
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      isDragging.current = true;
      dragStartX.current = e.clientX;
      dragStartWidth.current = width;
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    },
    [width],
  );

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!isDragging.current) return;
      const next = dragStartWidth.current + (e.clientX - dragStartX.current);
      onWidthChange(Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, next)));
    }
    function onUp() {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
  }, [onWidthChange]);

  // Height resize (mobile)
  const isHeightDragging = useRef(false);
  const heightDragStartY = useRef(0);
  const heightDragStartHeight = useRef(0);

  const onTopGripperDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      isHeightDragging.current = true;
      heightDragStartY.current = e.clientY;
      heightDragStartHeight.current = panelHeight;
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    },
    [panelHeight],
  );

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!isHeightDragging.current) return;
      const next = heightDragStartHeight.current - (e.clientY - heightDragStartY.current);
      setPanelHeight(Math.min(PANEL_MAX_HEIGHT, Math.max(PANEL_MIN_HEIGHT, next)));
    }
    function onUp() {
      if (!isHeightDragging.current) return;
      isHeightDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
  }, [setPanelHeight]);

  // ────────────────────────────────────────────────────────────────────────
  const DESC_LIMIT = 160;
  const description = route.description ?? 'A scenic walk through varied terrain with great views. Suitable for walkers of all abilities with some moderate sections along the way.';
  const isDescLong = description.length > DESC_LIMIT;

  return (
    <div
      className={isMobile
        ? 'absolute bottom-0 left-0 right-0 z-10 pointer-events-auto bg-white rounded-t-xl shadow-xl overflow-hidden flex flex-col'
        : 'absolute left-4 z-10 pointer-events-auto bg-white rounded-xl shadow-xl overflow-hidden flex flex-col'
      }
      style={isMobile ? { height: panelHeight } : { top: 68, bottom: 16, width }}
    >
      {/* Top resize handle — mobile only */}
      {isMobile && (
        <div
          onPointerDown={onTopGripperDown}
          className="shrink-0 h-5 flex justify-center items-center cursor-ns-resize"
          aria-hidden="true"
          title="Drag to resize"
        >
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-3 pt-4 pb-3 shrink-0">
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label="Back"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-900 text-base leading-tight">{route.title}</h2>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="text-xs text-gray-500">{route.authorName}</span>
              <span className="text-gray-300 text-xs">·</span>
              <span className="text-xs text-gray-400">{date}</span>
              <VisibilityBadge visibility={route.visibility} />
            </div>
          </div>
          <PanelPacePicker />
        </div>

        {/* Rating + difficulty strip */}
        <div className="px-4 pb-3 flex items-center gap-2 shrink-0">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-yellow-400 shrink-0" fill="currentColor">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          <span className="text-xs font-semibold text-gray-700">4.2</span>
          <span className="text-xs text-gray-300">(12 reviews)</span>
          <span className="text-gray-200">·</span>
          <span
            className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full text-white"
            style={{ backgroundColor: diff.color }}
          >
            {diff.label}
          </span>
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1 min-h-0">

          {/* Toolbar */}
          <div className="flex items-center gap-1.5 px-4 py-3 border-t border-gray-100">
            <button
              onClick={() => setLiked(!liked)}
              className={`flex items-center gap-1.5 flex-1 justify-center py-2 rounded-lg text-xs font-semibold transition-colors ${
                liked ? 'bg-red-50 text-red-600 ring-1 ring-red-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              Save
            </button>
            <button className="flex items-center gap-1.5 flex-1 justify-center py-2 rounded-lg text-xs font-semibold bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              Share
            </button>
            {(route.isOwner || isAdmin) && (
              <button
                onClick={onEdit}
                className="flex items-center gap-1.5 flex-1 justify-center py-2 rounded-lg text-xs font-semibold bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit
              </button>
            )}
            <button className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors shrink-0">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 px-4 py-4 border-b border-gray-100">
            <div className="text-center">
              <p className="text-base font-bold text-gray-900">{dist > 0 ? fmtDist(dist) : '—'}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">Length</p>
            </div>
            <div className="text-center border-x border-gray-100">
              <p className="text-base font-bold text-gray-900">{elev > 0 ? `${Math.round(elev)} m` : '—'}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">Elev. gain</p>
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-gray-900">{dist > 0 ? fmtTime(dist, elev, activity) : '—'}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">Est. time</p>
            </div>
          </div>

          {/* Route tags */}
          <RouteTagDisplay
            plannedRouteId={route._id}
            className="px-4 py-4 border-b border-gray-100"
          />

          {/* Photos */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-100">
            <PhotoGrid />
          </div>

          {/* Description */}
          <div className="px-4 py-4 border-b border-gray-100">
            <p className="text-sm text-gray-700 leading-relaxed">
              {isDescLong && !descExpanded ? description.slice(0, DESC_LIMIT) + '…' : description}
            </p>
            {isDescLong && (
              <button
                onClick={() => setDescExpanded(!descExpanded)}
                className="text-xs font-semibold text-brand hover:underline mt-1"
              >
                {descExpanded ? 'Show less' : 'more'}
              </button>
            )}
          </div>

          {/* Elevation chart */}
          <div className="px-4 py-4 border-b border-gray-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">Elevation profile</p>
            <ExploreElevationProfile
              points={routeElevPoints}
              elevations={routeElevations}
              onHoverIndex={onElevHoverIdx}
            />
          </div>

          {/* Reviews */}
          <div className="px-4 pt-4 pb-2 border-b border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-bold text-gray-800">Reviews</p>
              <div className="flex items-center gap-1">
                <StarRating value={4} />
                <span className="text-xs font-semibold text-gray-600 ml-1">4.2</span>
                <span className="text-xs text-gray-400">(12)</span>
              </div>
            </div>
            {MOCK_REVIEWS.map((r) => <ReviewRow key={r.id} {...r} />)}
          </div>

          {/* CTA */}
          <div className="px-4 py-4">
            <button
              onClick={onPreview}
              className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Preview walk
            </button>
          </div>
        </div>

      {/* Resize handle — right edge (desktop only) */}
      {!isMobile && (
        <div
          onPointerDown={onResizePointerDown}
          className="absolute right-0 top-0 bottom-0 w-3 flex items-center justify-center cursor-ew-resize group rounded-r-xl"
          aria-hidden="true"
          title="Drag to resize"
        >
          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="w-1 h-1 rounded-full bg-gray-400" />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

// ── Bottom HUD ───────────────────────────────────────────────────────────────

function MapHUD({ routeCount, viewingKm }: { routeCount: number | null; viewingKm: string | null }) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3">
      <div className="bg-[#263238]/90 backdrop-blur-sm rounded-xl px-5 py-3 flex items-center gap-6 text-white shadow-lg">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Viewing Range</p>
          <p className="text-xl font-bold leading-tight">{viewingKm ?? '...'} <span className="text-sm font-normal">km</span></p>
        </div>
        <div className="w-px h-8 bg-white/20" />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Routes Found</p>
          <p className="text-xl font-bold leading-tight">{routeCount === null ? '...' : routeCount}</p>
        </div>
      </div>
    </div>
  );
}

// ── Main HTML overlay (panels over the map) ──────────────────────────────────

interface ExploreOverlayProps {
  viewBounds: ViewBounds | null;
  selectedRoute: EnrichedRoute | null;
  onDeselectRoute: () => void;
  onPreviewRoute: (route: EnrichedRoute) => void;
  routeElevPoints?: Array<{ lat: number; lng: number }>;
  routeElevations?: number[];
  onElevHoverIdx?: (idx: number | null) => void;
  /** Called whenever the active filter changes. Pass null when no filter is active. */
  onFilteredIdsChange?: (ids: Set<string> | null) => void;
  /** Called when the user clicks Edit on a route they are authorised to edit. */
  onEditRoute?: (route: EnrichedRoute) => void;
}

export function ExploreOverlay({ viewBounds, selectedRoute, onDeselectRoute, onPreviewRoute, routeElevPoints, routeElevations, onElevHoverIdx, onFilteredIdsChange, onEditRoute }: ExploreOverlayProps) {
  const routes = useQuery(api.planned_routes.listWithinBoundsWithAuthors, viewBounds ?? 'skip') as EnrichedRoute[] | undefined;
  const currentUser = useQuery(api.users.getCurrentUser);
  const isAdmin = currentUser?.isAdmin === true;
  const viewingKm = viewBounds ? calcViewingKm(viewBounds) : null;
  const { pace } = usePace();
  const activity = ACTIVITY_PROFILES[pace];

  // ── Filter state ─────────────────────────────────────────────────────────
  const [filter, setFilter] = useState<FilterState>(UNFILTERED);
  const [filterOpen, setFilterOpen] = useState(false);

  // Derive nice-rounded max values from visible routes
  const maxDist = useMemo(() => {
    if (!routes?.length) return 20;
    return niceDistMax(Math.max(...routes.map(r => r.stats?.distanceKm ?? 0), 0.5));
  }, [routes]);
  const maxElev = useMemo(() => {
    if (!routes?.length) return 500;
    return niceElevMax(Math.max(...routes.map(r => r.stats?.elevationGainM ?? 0), 10));
  }, [routes]);
  const maxDur = useMemo(() => {
    if (!routes?.length) return 120;
    return niceDurMax(Math.max(...routes.map(r => routeDurMins(r.stats?.distanceKm ?? 0, r.stats?.elevationGainM ?? 0, activity)), 15));
  }, [routes, activity]);

  // Apply filter to routes
  const filteredRoutes = useMemo(() => {
    if (!routes) return undefined;
    const active = isFilterActive(filter);
    if (!active) return routes;
    return routes.filter(r => {
      const dist = r.stats?.distanceKm ?? 0;
      const elev = r.stats?.elevationGainM ?? 0;
      const dur = routeDurMins(dist, elev, activity);
      const [dLow, dHigh] = filter.distKm;
      const [eLow, eHigh] = filter.elevM;
      const [tLow, tHigh] = filter.durMins;
      if (dist < dLow || (dHigh !== Infinity && dist > dHigh)) return false;
      if (elev < eLow || (eHigh !== Infinity && elev > eHigh)) return false;
      if (dur < tLow || (tHigh !== Infinity && dur > tHigh)) return false;
      return true;
    });
  }, [routes, filter, activity]);

  // Notify parent of active filtered IDs (for pin filtering in ExploreMapLayers)
  const filteredIds = useMemo(() => {
    if (!isFilterActive(filter) || !filteredRoutes) return null;
    return new Set(filteredRoutes.map(r => r._id));
  }, [filteredRoutes, filter]);

  useEffect(() => {
    onFilteredIdsChange?.(filteredIds);
  }, [filteredIds, onFilteredIdsChange]);

  const displayCount = filteredRoutes?.length ?? routes?.length ?? null;

  return (
    <>
      <MapHUD routeCount={displayCount} viewingKm={viewingKm} />
      <FilterBar
        open={filterOpen}
        onToggle={() => setFilterOpen(v => !v)}
        filter={filter}
        setFilter={setFilter}
        maxDist={maxDist}
        maxElev={maxElev}
        maxDur={maxDur}
      />
      {selectedRoute && (
        <SelectedRoutePanel
          route={selectedRoute}
          onClose={onDeselectRoute}
          onPreview={() => onPreviewRoute(selectedRoute)}
          routeElevPoints={routeElevPoints ?? []}
          routeElevations={routeElevations ?? []}
          onElevHoverIdx={onElevHoverIdx ?? (() => {})}
          isAdmin={isAdmin}
          onEdit={() => onEditRoute?.(selectedRoute)}
        />
      )}
    </>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────────

function TerrainIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 6l-1-2H5v17h2v-7h5l1 2h7V6h-6zm4 8h-4l-1-2H7V6h5l1 2h5v6z"/>
    </svg>
  );
}

function ContourIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 12 Q6 8 9 12 Q12 16 15 12 Q18 8 21 12" />
      <path d="M3 17 Q6 13 9 17 Q12 21 15 17 Q18 13 21 17" />
      <path d="M3 7 Q6 3 9 7 Q12 11 15 7 Q18 3 21 7" />
    </svg>
  );
}

function SatelliteIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="2" y="2" width="9" height="9" rx="1" />
      <rect x="13" y="2" width="9" height="9" rx="1" />
      <rect x="2" y="13" width="9" height="9" rx="1" />
      <rect x="13" y="13" width="9" height="9" rx="1" />
    </svg>
  );
}

function MarkersIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
  );
}

function WeatherIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
  );
}