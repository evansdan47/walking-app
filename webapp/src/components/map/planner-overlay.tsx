'use client';

import { CollapsibleSidePanel } from '@/components/ui/collapsible-side-panel';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { usePace } from '@/components/pace-context';
import { ACTIVITY_PROFILES, ActivityPace, ActivityType, computeRouteGrade, type RouteGrade } from '@/lib/activity-pace';
import { api } from '@convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import type { Id } from '@convex/_generated/dataModel';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AddPoiForm, PLACE_TYPE_META, type PendingPoi, type PlaceType } from './poi-add-form';
import { usePanelWidth, MOBILE_BREAKPOINT } from '@/hooks/use-panel-width';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Point {
  lng: number;
  lat: number;
  /** True when this point was directly clicked by the user (control point/anchor). False/absent for API navigation points. */
  isControlPoint?: boolean;
  /** True when this control point was successfully snapped via the Directions API. False = straight-line fallback or snap disabled. */
  isSnapped?: boolean;
}

export interface Leg {
  id: string;
  name: string;
  color: string;
  points: Point[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Cardinal bearing in degrees (1–360) from point a to point b. */
export function bearingDeg(a: Point, b: Point): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return Math.round(deg) || 360;
}

/** Haversine distance in km between two coords. */
export function haversineKm(a: Point, b: Point): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function totalKm(points: Point[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += haversineKm(points[i - 1], points[i]);
  return d;
}

// ── POI auto-discovery ─────────────────────────────────────────────────────

/**
 * Corridor half-width for automatic POI discovery, in metres.
 * Configurable via NEXT_PUBLIC_POI_AUTO_DISCOVER_RADIUS_METRES (default 350 m).
 */
export const POI_DISCOVER_RADIUS_M = Math.max(
  1,
  parseInt(process.env.NEXT_PUBLIC_POI_AUTO_DISCOVER_RADIUS_METRES ?? '350', 10),
);

/**
 * Minimum distance in metres from (lat, lng) to any segment of `points`.
 * Uses the equirectangular (flat-earth) approximation — fast, accurate
 * enough for corridor widths up to ~5 km.
 */
function minDistToRouteMetres(lat: number, lng: number, points: Point[]): number {
  if (points.length === 0) return Infinity;
  const LAT_M = 111_320;
  const LNG_M = LAT_M * Math.cos((lat * Math.PI) / 180);
  let minDist = Infinity;
  for (let i = 0; i < points.length; i++) {
    const ax = (points[i].lng - lng) * LNG_M;
    const ay = (points[i].lat - lat) * LAT_M;
    if (i === 0) {
      minDist = Math.min(minDist, Math.hypot(ax, ay));
      continue;
    }
    const px = (points[i - 1].lng - lng) * LNG_M;
    const py = (points[i - 1].lat - lat) * LAT_M;
    const dx = ax - px;
    const dy = ay - py;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-8) {
      minDist = Math.min(minDist, Math.hypot(px, py), Math.hypot(ax, ay));
      continue;
    }
    // Parameter t: projection of the POI (at origin) onto segment prev→curr
    const t = Math.max(0, Math.min(1, (-px * dx - py * dy) / len2));
    minDist = Math.min(minDist, Math.hypot(px + t * dx, py + t * dy));
  }
  return minDist;
}

/**
 * Insert intermediate points along each segment at `maxSpacingKm` intervals
 * so the elevation chart shows actual terrain instead of a straight line
 * between the two clicked endpoints. Snapped segments already have many
 * closely-spaced points, so this is effectively a no-op for them.
 */
export function densifyPoints(points: Point[], maxSpacingKm = 0.08): Point[] {
  if (points.length < 2) return [...points];
  const result: Point[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const steps = Math.max(1, Math.ceil(haversineKm(a, b) / maxSpacingKm));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      result.push({ lng: a.lng + (b.lng - a.lng) * t, lat: a.lat + (b.lat - a.lat) * t });
    }
  }
  return result;
}

function formatKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`;
}

/** Build a GeoJSON LineString from an array of Points. */
export function toGeoJSON(points: Point[]): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: points.map((p) => [p.lng, p.lat]) },
    properties: {},
  };
}

/**
 * Build a GeoJSON MultiLineString from multiple legs, sliced against the
 * animated displayPoints array. Each leg maps to one LineString so legs are
 * never visually connected on the map.
 */
export function toMultiGeoJSON(legs: Leg[], displayPoints: Point[]): GeoJSON.Feature<GeoJSON.MultiLineString> {
  const lines: number[][][] = [];
  let offset = 0;
  for (const leg of legs) {
    const end = Math.min(offset + leg.points.length, displayPoints.length);
    if (end - offset >= 2) {
      lines.push(displayPoints.slice(offset, end).map(p => [p.lng, p.lat]));
    }
    offset += leg.points.length;
    if (offset >= displayPoints.length) break;
  }
  return {
    type: 'Feature',
    geometry: { type: 'MultiLineString', coordinates: lines },
    properties: {},
  };
}

// ── Elevation chart ────────────────────────────────────────────────────────

/** Range selected by dragging on the elevation chart. */
export interface ChartRange {
  start: number;   // index into allPoints (inclusive)
  end: number;     // index into allPoints (inclusive)
  distKm: number;  // cumulative distance of the selection
}

interface ElevationProfileProps {
  points: Point[];
  elevations: number[];
  externalHoverIdx?: number | null;
  onHoverIndex?: (idx: number | null) => void;
  onRangeChange?: (range: ChartRange | null) => void;
}

function ElevationProfile({ points, elevations, externalHoverIdx, onHoverIndex, onRangeChange }: ElevationProfileProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverNorm, setHoverNorm] = useState<number | null>(null);
  const [dragStartNorm, setDragStartNorm] = useState<number | null>(null);
  const [dragEndNorm, setDragEndNorm] = useState<number | null>(null);
  const isDragging = useRef(false);

  // Render up to the shorter of the two arrays so mismatched lengths never crash
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

  const W = 440;
  const H = 60;
  const xOf = (d: number) => (totalDist > 0 ? (d / totalDist) * W : 0);
  const yOf = (e: number) => H - 4 - ((e - minElev) / elevRange) * (H - 14);

  // Build SVG path strings
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
    // Use the SVG's own coordinate transform matrix to convert client coords to
    // SVG user-space. This correctly handles any preserveAspectRatio padding/
    // letterboxing, CSS transforms, zoom, and device pixel ratios.
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
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
    if (isDragging.current && dragStartNorm !== null) {
      setDragEndNorm(norm);
      if (Math.abs(norm - dragStartNorm) > 0.02) {
        const lo = Math.min(dragStartNorm, norm);
        const hi = Math.max(dragStartNorm, norm);
        const s = normToIndex(lo);
        const en = normToIndex(hi);
        if (en > s) onRangeChange?.({ start: s, end: en, distKm: (cumDists[en] ?? 0) - (cumDists[s] ?? 0) });
      }
    }
  }

  function handleMouseLeave() {
    if (!isDragging.current) { setHoverNorm(null); onHoverIndex?.(null); }
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (!hasData) return;
    e.preventDefault();
    isDragging.current = true;
    setDragStartNorm(getSVGNorm(e));
    setDragEndNorm(null);
    onRangeChange?.(null);
  }

  function handleMouseUp() {
    isDragging.current = false;
    const lo = dragStartNorm !== null && dragEndNorm !== null ? Math.min(dragStartNorm, dragEndNorm) : null;
    const hi = dragStartNorm !== null && dragEndNorm !== null ? Math.max(dragStartNorm, dragEndNorm) : null;
    if (lo === null || hi === null || hi - lo <= 0.02) {
      onRangeChange?.(null);
      setDragStartNorm(null);
      setDragEndNorm(null);
    }
    // else: keep range highlight visible until next interaction
  }

  // Hover-derived values — mouse takes priority; fall back to external (sidebar) hover
  const hoverIdx = hoverNorm !== null
    ? normToIndex(hoverNorm)
    : (externalHoverIdx ?? null);
  const hoverElev = hoverIdx !== null ? (elevations[hoverIdx] ?? null) : null;
  const hoverDist = hoverIdx !== null ? (cumDists[hoverIdx] ?? null) : null;
  const hoverSvgX = hoverNorm !== null
    ? hoverNorm * W
    : (hoverIdx !== null && cumDists[hoverIdx] !== undefined ? (cumDists[hoverIdx] / (totalDist || 1)) * W : null);
  const hoverSvgY = hoverElev !== null ? yOf(hoverElev) : null;

  // Drag-derived values
  const hasDrag = dragStartNorm !== null && dragEndNorm !== null && Math.abs(dragEndNorm - dragStartNorm) > 0.02;
  const dragLoNorm = hasDrag ? Math.min(dragStartNorm!, dragEndNorm!) : null;
  const dragHiNorm = hasDrag ? Math.max(dragStartNorm!, dragEndNorm!) : null;
  const dragLoIdx = dragLoNorm !== null ? normToIndex(dragLoNorm) : null;
  const dragHiIdx = dragHiNorm !== null ? normToIndex(dragHiNorm) : null;
  const dragElevDiff = dragLoIdx !== null && dragHiIdx !== null ? (elevations[dragHiIdx] - elevations[dragLoIdx]) : null;
  const dragDistKm = dragLoIdx !== null && dragHiIdx !== null ? ((cumDists[dragHiIdx] ?? 0) - (cumDists[dragLoIdx] ?? 0)) : null;

  // Range highlight path strings
  let rangePathD = '';
  let rangeLineD = '';
  if (hasDrag && dragLoIdx !== null && dragHiIdx !== null) {
    const rSegs = cumDists.slice(dragLoIdx, dragHiIdx + 1).map((d, i) =>
      `${i === 0 ? 'M' : 'L'}${xOf(d).toFixed(1)},${yOf(elevations[dragLoIdx! + i] ?? minElev).toFixed(1)}`
    );
    if (rSegs.length >= 2) {
      rangeLineD = rSegs.join(' ');
      rangePathD = `${rangeLineD} L${xOf(cumDists[dragHiIdx]).toFixed(1)},${H} L${xOf(cumDists[dragLoIdx]).toFixed(1)},${H} Z`;
    }
  }

  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => formatKm(totalDist * t));

  if (!hasData) {
    return (
      <div className="select-none">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-14" preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="#e5e7eb" strokeWidth="2" strokeDasharray="6 4" />
        </svg>
        <p className="text-xs text-slate-400 text-center mt-0.5">Add points to see elevation</p>
      </div>
    );
  }

  return (
    <div className="select-none" onMouseUp={handleMouseUp}>
      <svg
        ref={svgRef}
        viewBox={`0 -26 ${W} ${H + 26}`}
        preserveAspectRatio="none"
        className="w-full h-20 cursor-crosshair overflow-visible relative z-10"
        style={{ userSelect: 'none' }}
        aria-label="Elevation profile"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
      >
        <defs>
          <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2E7D32" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#2E7D32" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="elevGradRange" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF9800" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#FF9800" stopOpacity="0.04" />
          </linearGradient>
        </defs>

        {/* Base fill + elevation line */}
        {pathD && <path d={fillD} fill="url(#elevGrad)" />}
        {pathD && <path d={pathD} fill="none" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}

        {/* ── Range selection ── */}
        {hasDrag && rangePathD && (
          <>
            <path d={rangePathD} fill="url(#elevGradRange)" />
            {rangeLineD && <path d={rangeLineD} fill="none" stroke="#FF9800" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
            <line x1={dragLoNorm! * W} y1="0" x2={dragLoNorm! * W} y2={H} stroke="#FF9800" strokeWidth="1" strokeDasharray="3 2" opacity="0.6" />
            <line x1={dragHiNorm! * W} y1="0" x2={dragHiNorm! * W} y2={H} stroke="#FF9800" strokeWidth="1" strokeDasharray="3 2" opacity="0.6" />
            {dragElevDiff !== null && dragDistKm !== null && (() => {
              const midX = ((dragLoNorm! + dragHiNorm!) / 2) * W;
              const elevLabel = `${dragElevDiff >= 0 ? '+' : ''}${Math.round(dragElevDiff)}m`;
              const distLabel = formatKm(dragDistKm);
              // Single horizontal strip: [↔ distLabel]  [△ elevLabel]
              // Layout: 8px left pad | 14px arrow icon | distText | 10px gap | 14px mountain icon | elevText | 8px right pad
              const bw = 54 + (distLabel.length + elevLabel.length) * 7.5;
              const bx = Math.max(bw / 2 + 2, Math.min(W - bw / 2 - 2, midX));
              const by = H / 2;
              const left = bx - bw / 2;
              return (
                <g>
                  <rect x={left} y={by - 10} width={bw} height={20} rx="4" fill="white" stroke="#d1d5db" strokeWidth="0.8" />
                  {/* Bidirectional arrow icon */}
                  <g transform={`translate(${left + 8},${by - 6})`} stroke="#455A64" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2">
                    <line x1="1" y1="5" x2="11" y2="5" />
                    <polyline points="8,2 11,5 8,8" />
                    <polyline points="4,2 1,5 4,8" />
                  </g>
                  <text x={left + 22} y={by + 5} textAnchor="start" fontSize="13" fill="#455A64" fontWeight="600">{distLabel}</text>
                  {/* Mountain icon */}
                  <g transform={`translate(${left + 32 + distLabel.length * 7.5},${by - 6})`} stroke="#455A64" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3">
                    <polygon points="0,10 5,1 10,10" />
                    <line x1="3.2" y1="5.2" x2="6.8" y2="5.2" />
                  </g>
                  <text x={left + 46 + distLabel.length * 7.5} y={by + 5} textAnchor="start" fontSize="13" fill="#455A64" fontWeight="600">{elevLabel}</text>
                </g>
              );
            })()}
          </>
        )}

        {/* ── Hover elements ── */}
        {hoverSvgX !== null && hoverSvgY !== null && (
          <>
            {/* Vertical cursor */}
            <line x1={hoverSvgX} y1="0" x2={hoverSvgX} y2={H} stroke="#455A64" strokeWidth="1" strokeDasharray="3 2" opacity="0.4" />
            {/* Dot at intersection */}
            <circle cx={hoverSvgX} cy={hoverSvgY} r="3.5" fill="white" stroke="#1a1a1a" strokeWidth="1.5" />
            {/* Walking figure above dot */}
            <g transform={`translate(${hoverSvgX - 4},${hoverSvgY - 19})`} aria-hidden="true">
              <circle cx="4" cy="2.5" r="2" fill="#2E7D32" />
              <line x1="4" y1="4.5" x2="4" y2="10" stroke="#2E7D32" strokeWidth="1.4" strokeLinecap="round" />
              <line x1="4" y1="6.5" x2="1.5" y2="9.5" stroke="#2E7D32" strokeWidth="1.4" strokeLinecap="round" />
              <line x1="4" y1="6.5" x2="6.5" y2="9" stroke="#2E7D32" strokeWidth="1.4" strokeLinecap="round" />
              <line x1="4" y1="10" x2="2" y2="14.5" stroke="#2E7D32" strokeWidth="1.4" strokeLinecap="round" />
              <line x1="4" y1="10" x2="6" y2="14" stroke="#2E7D32" strokeWidth="1.4" strokeLinecap="round" />
            </g>
            {/* Elevation label — above the chart with mountain icon */}
            {hoverElev !== null && (() => {
              const label = `${Math.round(hoverElev)}m`;
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
            {/* Distance label — below the chart overlaying x-axis, with bidirectional arrow icon */}
            {hoverDist !== null && (() => {
              const label = formatKm(hoverDist);
              const bw = label.length * 7.5 + 29;
              const bx = Math.max(bw / 2 + 2, Math.min(W - bw / 2 - 2, hoverSvgX));
              return (
                <g>
                  <rect x={bx - bw / 2} y={H + 5} width={bw} height={19} rx="3" fill="white" stroke="#d1d5db" strokeWidth="0.8" />
                  <g transform={`translate(${bx - bw / 2 + 7},${H + 9})`} stroke="#455A64" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2">
                    <line x1="1" y1="5" x2="11" y2="5" />
                    <polyline points="8,2 11,5 8,8" />
                    <polyline points="4,2 1,5 4,8" />
                  </g>
                  <text x={bx - bw / 2 + 21} y={H + 19} textAnchor="start" fontSize="13" fill="#455A64" fontWeight="600">{label}</text>
                </g>
              );
            })()}
          </>
        )}
      </svg>
      {/* X-axis distance labels */}
      <div className="flex justify-between text-xs text-slate-400 mt-0.5">
        {xTicks.map((label, i) => <span key={i}>{label}</span>)}
      </div>
    </div>
  );
}

// ── Segment row ─────────────────────────────────────────────────────────────

function LegRow({ leg, distKm, timeHours, onDelete }: { leg: Leg; distKm: number; timeHours: number; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: leg.color, backgroundColor: leg.color + '33' }} />
        <svg className="w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate truncate">{leg.name}</p>
        <p className="text-xs text-slate-light">
          {formatKm(distKm)} · {Math.round(distKm * 15)} m elev · {ActivityPace.formatHours(timeHours)}
        </p>
      </div>
      <button onClick={onDelete} className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-slate-500 rounded-full hover:bg-gray-100 transition-colors">
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      </button>
    </div>
  );
}

// ── Preview thumbnail ────────────────────────────────────────────────────────

function PreviewThumbnail({ label, type, onPlay }: { label: string; type: 'satellite' | 'photo'; onPlay?: () => void }) {
  return (
    <div className="relative rounded-xl overflow-hidden flex-1 aspect-4/3 bg-gray-900">
      <svg viewBox="0 0 200 150" className="w-full h-full">
        {type === 'satellite' ? (
          <>
            <rect width="200" height="150" fill="#1a2e1a" />
            <path d="M0 100 Q50 70 100 85 Q150 100 200 75 L200 150 L0 150 Z" fill="#2d4a2d" />
            <path d="M0 120 Q60 90 120 105 Q170 115 200 95 L200 150 L0 150 Z" fill="#1b3a1b" />
            {/* Route line */}
            <path d="M30 130 Q50 100 70 85 Q90 70 110 75 Q140 82 165 60" stroke="#2E7D32" strokeWidth="3" fill="none" strokeLinecap="round" />
            <circle cx="30" cy="130" r="5" fill="#2E7D32" />
            <circle cx="165" cy="60" r="4" fill="#2E7D32" />
          </>
        ) : (
          <>
            <rect width="200" height="150" fill="#4a6741" />
            <path d="M0 80 Q50 50 100 65 Q150 80 200 55 L200 150 L0 150 Z" fill="#2d4a2d" />
            <rect x="60" y="20" width="80" height="50" rx="2" fill="#6b8f71" opacity="0.6" />
            <path d="M60 70 Q100 40 140 70" fill="#556b2f" />
            <rect x="0" y="100" width="200" height="50" fill="#3d5a3e" />
            {/* Stone wall */}
            {[0,20,40,60,80,100,120,140,160,180].map(x => (
              <rect key={x} x={x} y={98} width="18" height="6" rx="1" fill="#8d7b6a" opacity="0.7" />
            ))}
          </>
        )}
      </svg>
      <div className="absolute inset-0 flex items-end p-2">
        <button
          onClick={() => onPlay?.()}
          className="flex items-center gap-1.5 bg-white/90 hover:bg-white text-slate text-xs font-semibold px-2.5 py-1.5 rounded-full transition-colors shadow-sm"
        >
          <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Play
        </button>
      </div>
      <p className="absolute top-2 left-2 text-white text-xs font-medium drop-shadow">{label}</p>
    </div>
  );
}

// ── Left sidebar panel ────────────────────────────────────────────────────────

/** Default sidebar width as a fraction of window width. */
const DEFAULT_WIDTH_RATIO = 0.26;

function clampWidth(px: number) {
  return Math.min(600, Math.max(340, px));
}

/** Icon displayed in the circular collapsed button. */
function RouteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" aria-hidden="true">
      {/* Curved path connecting start to end */}
      <path d="M6 18 Q6 11 12 10 Q18 9 18 6" stroke="#455A64" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      {/* Start — green circle */}
      <circle cx="6" cy="18" r="2.8" fill="#2E7D32" />
      {/* End — red square */}
      <rect x="15.5" y="3.5" width="5" height="5" rx="1" fill="#e53935" />
    </svg>
  );
}

/**
 * Dialog for capturing the user's body weight with unit conversion.
 */
type WeightUnit = 'kg' | 'lb' | 'stone';

function SetWeightDialog({ open, onClose, onSave, currentWeightKg }: {
  open: boolean;
  onClose: () => void;
  onSave: (kg: number) => Promise<void | null>;
  currentWeightKg?: number;
}) {
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState<WeightUnit>('kg');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Pre-fill when opening
  useEffect(() => {
    if (open) {
      if (currentWeightKg !== undefined) {
        if (unit === 'kg')    setValue(currentWeightKg.toFixed(1));
        else if (unit === 'lb')   setValue((currentWeightKg * 2.20462).toFixed(1));
        else if (unit === 'stone') setValue((currentWeightKg / 6.35029).toFixed(1));
      } else {
        setValue('');
      }
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  function toKg(val: string, u: WeightUnit): number | null {
    const n = parseFloat(val);
    if (isNaN(n) || n <= 0) return null;
    if (u === 'kg')    return n;
    if (u === 'lb')    return n * 0.453592;
    if (u === 'stone') return n * 6.35029;
    return null;
  }

  async function handleSave() {
    const kg = toKg(value, unit);
    if (kg === null || kg < 20 || kg > 300) return;
    setSaving(true);
    try {
      await onSave(Math.round(kg * 10) / 10);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const placeholder = unit === 'kg' ? 'e.g. 75' : unit === 'lb' ? 'e.g. 165' : 'e.g. 11.5';
  const kg = toKg(value, unit);
  const isValid = kg !== null && kg >= 20 && kg <= 300;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="set-weight-title"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-xs mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="h-1 w-full bg-brand" />
        <div className="px-5 pt-5 pb-5">
          <h2 id="set-weight-title" className="text-base font-bold text-slate mb-1">Enter your weight</h2>
          <p className="text-[11px] text-slate-light mb-4">Used to personalise your calorie estimates. Stored privately.</p>
          <div className="flex gap-2 mb-4">
            <input
              ref={inputRef}
              type="number"
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && isValid) handleSave(); }}
              placeholder={placeholder}
              min={0}
              step={0.5}
              className="flex-1 min-w-0 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:border-brand focus:bg-white focus:outline-none transition-colors text-slate placeholder:text-slate-400"
            />
            <select
              value={unit}
              onChange={e => {
                const newUnit = e.target.value as WeightUnit;
                // Convert current displayed value to new unit
                const prevKg = toKg(value, unit);
                if (prevKg !== null) {
                  if (newUnit === 'kg')    setValue(prevKg.toFixed(1));
                  else if (newUnit === 'lb')   setValue((prevKg * 2.20462).toFixed(1));
                  else if (newUnit === 'stone') setValue((prevKg / 6.35029).toFixed(1));
                }
                setUnit(newUnit);
              }}
              className="px-2 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:border-brand focus:outline-none transition-colors text-slate"
            >
              <option value="kg">kg</option>
              <option value="lb">lb</option>
              <option value="stone">stone</option>
            </select>
          </div>
          {value !== '' && !isValid && (
            <p className="text-[11px] text-red-500 mb-3">Please enter a value between 20 kg and 300 kg.</p>
          )}
          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm font-medium text-slate hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!isValid || saving}
              className="px-4 py-1.5 text-sm font-semibold bg-brand hover:bg-brand-dark disabled:opacity-50 text-white rounded-lg transition-colors shadow-sm"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Small (i) button that shows a tooltip panel on hover / focus.
 * The panel opens above the anchor and is clamped to stay within the sidebar.
 */
function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        aria-label="More information"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="w-3.5 h-3.5 rounded-full border border-slate-light text-slate-light flex items-center justify-center text-[8px] font-bold leading-none hover:border-slate hover:text-slate transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate ml-1"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute top-full left-0 mt-1.5 w-48 bg-white text-slate text-[11px] leading-relaxed rounded-xl px-3 py-2.5 shadow-lg border border-gray-200 pointer-events-none z-50 whitespace-normal"
        >
          {text}
          {/* Arrow pointing up */}
          <span className="absolute bottom-full left-3 border-4 border-transparent border-b-gray-200" />
        </span>
      )}
    </span>
  );
}

function PlannerSidebar({
  legs,
  elevationPoints,
  elevations,
  onAddLeg,
  onDeleteLeg,
  onClearLast,
  onClearAll,
  onChartHover,
  onChartRangeChange,
  onFlyTo,
  width,
  onWidthChange,
  chartHoverIdx,
  activeSegmentId,
  onSetActiveLeg,
  routeName,
  onRouteNameChange,
  pendingPois,
  onRemovePoi,
  poiMode,
  onTogglePoiMode,
}: {
  legs: Leg[];
  elevationPoints: Point[];
  elevations: number[];
  onAddLeg: () => void;
  onDeleteLeg: (id: string) => void;
  onClearLast: () => void;
  onClearAll: () => void;
  onChartHover: (idx: number | null) => void;
  onChartRangeChange: (range: ChartRange | null) => void;
  onFlyTo: (p: Point) => void;
  width: number;
  onWidthChange: (w: number) => void;
  chartHoverIdx: number | null;
  activeSegmentId: string;
  onSetActiveLeg: (id: string) => void;
  routeName: string;
  onRouteNameChange: (name: string) => void;
  pendingPois: PendingPoi[];
  onRemovePoi: (index: number) => void;
  poiMode: boolean;
  onTogglePoiMode: () => void;
}) {
  const [expandedWpts, setExpandedWpts] = useState<Set<number>>(new Set());
  const { pace: selectedActivity } = usePace();
  // Leg pending confirmation before deletion. null = no dialog shown.
  const [pendingDeleteLeg, setPendingDeleteLeg] = useState<Leg | null>(null);

  // ── Inline route name editing ────────────────────────────────────────────
  const [isEditingName, setIsEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  function startEditingName() {
    setIsEditingName(true);
    // Focus + move caret to end after paint
    setTimeout(() => {
      const el = nameInputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }, 0);
  }

  function commitName() {
    setIsEditingName(false);
    onRouteNameChange(routeName.trim());
  }

  const totalDist = legs.reduce((s, leg) => s + totalKm(leg.points), 0);
  const elevGain = elevations.length >= 2
    ? elevations.reduce((sum, e, i) => i > 0 && e > elevations[i - 1] ? sum + (e - elevations[i - 1]) : sum, 0)
    : 0;

  // Lifted out of the route IIFE so both the stats bar and route section share the same computation.
  const allFlat = useMemo(() => legs.flatMap(s => s.points), [legs]);

  const flatToElev = useMemo(() => {
    const result: number[] = new Array(allFlat.length).fill(0);
    if (allFlat.length > 1) {
      let ei = 0;
      for (let fi = 1; fi < allFlat.length; fi++) {
        const steps = Math.max(1, Math.ceil(haversineKm(allFlat[fi - 1], allFlat[fi]) / 0.08));
        ei += steps;
        result[fi] = ei;
      }
    }
    return result;
  }, [allFlat]);

  const cumTimes = useMemo(() => {
    const activity = ACTIVITY_PROFILES[selectedActivity];
    const result: number[] = new Array(allFlat.length).fill(0);
    for (let fi = 1; fi < allFlat.length; fi++) {
      const segKm = haversineKm(allFlat[fi - 1], allFlat[fi]);
      const ei1 = flatToElev[fi - 1];
      const ei2 = flatToElev[fi];
      const elevDelta = elevations.length > ei2
        ? (elevations[ei2] ?? 0) - (elevations[ei1] ?? 0)
        : 0;
      const gradient = segKm > 0 ? elevDelta / (segKm * 1000) : 0;
      result[fi] = result[fi - 1] + segKm / activity.speedAtGrade(gradient);
    }
    return result;
  }, [allFlat, flatToElev, elevations, selectedActivity]);

  // Total time = time at the last point in the route.
  const totalTime = cumTimes.length > 0 ? cumTimes[cumTimes.length - 1] : 0;

  // Route grade: ITRA effort score + MET-hours + sustained climb detection.
  const routeGrade = useMemo((): RouteGrade | null => {
    if (allFlat.length < 2 || totalDist === 0) return null;
    const segmentData: { distKm: number; gradient: number; timeHours: number }[] = [];
    for (let fi = 1; fi < allFlat.length; fi++) {
      const distKm = haversineKm(allFlat[fi - 1], allFlat[fi]);
      const ei1 = flatToElev[fi - 1];
      const ei2 = flatToElev[fi];
      const elevDelta = elevations.length > ei2
        ? (elevations[ei2] ?? 0) - (elevations[ei1] ?? 0)
        : 0;
      const gradient = distKm > 0 ? elevDelta / (distKm * 1000) : 0;
      const timeHours = cumTimes[fi] - cumTimes[fi - 1];
      segmentData.push({ distKm, gradient, timeHours });
    }
    return computeRouteGrade(segmentData, elevGain, totalDist);
  }, [allFlat, flatToElev, elevations, cumTimes, elevGain, totalDist]);

  // User weight for calorie calculation (default 70 kg if not set).
  const currentUser = useQuery(api.users.getCurrentUser);
  const updateProfile = useMutation(api.users.updateProfile);
  const weightKg = currentUser?.weightKg ?? 70;
  const usingDefaultWeight = currentUser?.weightKg === undefined;
  const grossKcal = routeGrade !== null ? Math.round(routeGrade.metHours * weightKg) : null;
  const netKcal = routeGrade !== null ? Math.round(routeGrade.netMetHours * weightKg) : null;
  const baselineKcal = grossKcal !== null && netKcal !== null ? grossKcal - netKcal : null;
  const [weightDialogOpen, setWeightDialogOpen] = useState(false);

  // Index into allFlat where the active leg begins — used by the Route section.
  const activeLegStartFi = useMemo(() => {
    let startFi = 0;
    for (const leg of legs) {
      if (leg.id === activeSegmentId) break;
      startFi += leg.points.length;
    }
    return startFi;
  }, [legs, activeSegmentId]);

  // Hoist activeLeg so both the elevation profile and the Route section share it.
  const activeLeg = useMemo(
    () => legs.find(s => s.id === activeSegmentId) ?? legs[legs.length - 1],
    [legs, activeSegmentId]
  );

  // Slice of elevationPoints/elevations covering only the active leg.
  // elevOffset is the start index into the full arrays; it is added to indices
  // going up to map-shell (onChartHover/onChartRangeChange) and subtracted from
  // indices coming back down (externalHoverIdx → chartHoverIdx).
  const { activeElevPoints, activeElevations, elevOffset } = useMemo(() => {
    if (activeLeg.points.length === 0) {
      return { activeElevPoints: [] as Point[], activeElevations: [] as number[], elevOffset: 0 };
    }
    const startIdx = flatToElev[activeLegStartFi] ?? 0;
    const endFi = activeLegStartFi + activeLeg.points.length - 1;
    const endIdx = flatToElev[endFi] ?? startIdx;
    return {
      activeElevPoints: elevationPoints.slice(startIdx, endIdx + 1),
      activeElevations: elevations.slice(startIdx, endIdx + 1),
      elevOffset: startIdx,
    };
  }, [activeLeg, activeLegStartFi, flatToElev, elevationPoints, elevations]);

  const alwaysShownContent = (
    <>
      {/* ── Stats grid ── */}
      <div className="px-5 pt-4 pb-4 border-b border-gray-100">

        {/* Row 1: Length / Elev. gain / Est. time */}
        <div className="grid grid-cols-3 divide-x divide-gray-100">
          <div className="text-center pr-3">
            <p className="text-base font-bold text-slate">{totalDist > 0 ? formatKm(totalDist) : '\u2014'}</p>
            <p className="text-[10px] text-slate-light uppercase tracking-wider mt-0.5">Length</p>
          </div>
          <div className="text-center px-3">
            <p className="text-base font-bold text-slate">{totalDist > 0 ? `${Math.round(elevGain)} m` : '\u2014'}</p>
            <p className="text-[10px] text-slate-light uppercase tracking-wider mt-0.5">Elev. gain</p>
          </div>
          <div className="text-center pl-3">
            <p className="text-base font-bold text-slate">
              {totalDist > 0 ? ActivityPace.formatHours(totalTime) : '\u2014'}
            </p>
            <p className="text-[10px] text-slate-light uppercase tracking-wider mt-0.5">Est. time</p>
          </div>
        </div>

        {/* Row 2: Energy / Active Calories / Grade — only shown once route has data */}
        {routeGrade && (
          <div className="grid grid-cols-3 divide-x divide-gray-100 mt-3 pt-3 border-t border-gray-100">

            {/* Energy (MET-hrs) */}
            <div className="text-center pr-3">
              <p className="text-base font-bold text-slate">{routeGrade.metHours.toFixed(1)}</p>
              <p className="text-[10px] text-slate-light uppercase tracking-wider mt-0.5 flex items-center justify-center gap-0.5">
                MET–hrs
                <InfoTooltip text="MET–hours measure physical effort. 1 MET = resting energy. A desk worker uses ~2–3 MET–hrs per day; this walk's score reflects its distance and climb combined. Higher = more demanding." />
              </p>
            </div>

            {/* Active Calories */}
            <div className="text-center px-3">
              {netKcal !== null ? (
                <>
                  <p className="text-base font-bold text-slate">~{netKcal.toLocaleString()} kcal</p>
                  <p className="text-[10px] text-slate-light uppercase tracking-wider mt-0.5 flex items-center justify-center gap-0.5">
                    Active Calories
                    <InfoTooltip text={`Extra effort above resting: ~${netKcal} kcal. Baseline (what you'd burn at rest): ~${baselineKcal} kcal. Gross total: ~${grossKcal} kcal.`} />
                  </p>
                  <p className="text-[10px] text-slate-light mt-1">
                    {usingDefaultWeight ? '70 kg' : `${currentUser!.weightKg} kg`} ·{' '}
                    <button
                      onClick={() => setWeightDialogOpen(true)}
                      className="text-brand hover:underline focus-visible:outline-none"
                    >
                      Edit →
                    </button>
                  </p>
                </>
              ) : null}
            </div>

            {/* Grade */}
            <div className="text-center pl-3">
              <div className="flex items-center justify-center gap-1">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
                  routeGrade.colour === 'green'  ? 'bg-green-100 text-green-800' :
                  routeGrade.colour === 'lime'   ? 'bg-lime-100 text-lime-800' :
                  routeGrade.colour === 'amber'  ? 'bg-amber-100 text-amber-800' :
                  routeGrade.colour === 'orange' ? 'bg-orange-100 text-orange-800' :
                  'bg-red-100 text-red-800'
                }`}>{routeGrade.label}</span>
                {routeGrade.hasSustainedClimb && (
                  <span title="Contains a sustained climb (\u2265200 m gain at \u22658% gradient)" className="text-amber-500">
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-label="Sustained climb">
                      <path d="M3 17 L8 9 L13 13 L18 5" />
                      <polyline points="21 5 18 5 18 8" />
                    </svg>
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-light uppercase tracking-wider mt-0.5">Grade</p>
            </div>

          </div>
        )}

      </div>

      <SetWeightDialog
        open={weightDialogOpen}
        onClose={() => setWeightDialogOpen(false)}
        onSave={(kg) => updateProfile({ weightKg: kg })}
        currentWeightKg={currentUser?.weightKg}
      />

      {/* ── Elevation profile — scoped to the active leg ── */}
      <div className="px-5 pt-4 pb-3 border-b border-gray-100">
        <ElevationProfile
          points={activeElevPoints}
          elevations={activeElevations}
          externalHoverIdx={chartHoverIdx !== null ? chartHoverIdx - elevOffset : null}
          onHoverIndex={(idx) => onChartHover(idx !== null ? idx + elevOffset : null)}
          onRangeChange={(range) =>
            onChartRangeChange(
              range
                ? { start: range.start + elevOffset, end: range.end + elevOffset, distKm: range.distKm }
                : null
            )
          }
        />
      </div>
    </>
  );

  const collapsibleContent = (
    <>
      {/* ── Legs ── chips shown only when > 1 leg */}
      {legs.length > 1 && (
        <div className="mb-3">
          <p className="text-[10px] text-slate-light uppercase tracking-wider mb-1.5">Legs</p>
          <div className="flex flex-wrap gap-1.5">
            {legs.map((leg) => {
              const isActive = leg.id === activeSegmentId;
              return (
                <div
                  key={leg.id}
                  className={`flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full border text-xs font-semibold transition-colors cursor-pointer ${
                    isActive
                      ? 'border-active bg-active/10 text-active'
                      : 'border-gray-200 bg-white text-slate hover:bg-gray-50'
                  }`}
                  onClick={() => onSetActiveLeg(leg.id)}
                >
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: leg.color }} />
                  <span>{leg.name}</span>
                  <span className="font-normal text-slate-light ml-0.5">{formatKm(totalKm(leg.points))}</span>
                  <button
                    className="w-4 h-4 ml-0.5 flex items-center justify-center rounded-full hover:bg-black/10 text-current opacity-60 hover:opacity-100 transition-all"
                    aria-label={`Remove ${leg.name}`}
                    onClick={(e) => { e.stopPropagation(); setPendingDeleteLeg(leg); }}
                  >
                    <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              );
            })}
            <button
              onClick={onAddLeg}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed border-gray-300 text-xs text-slate-light hover:border-gray-400 hover:text-slate transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add leg
            </button>
          </div>
        </div>
      )}

      {/* Route — shows control points for the active leg only */}
      {(() => {
        // activeLeg is hoisted to PlannerSidebar level (useMemo above).
        // activeLegStartFi maps active leg start → allFlat index for cumTimes.
        const legStartTime = cumTimes[activeLegStartFi] ?? 0;
        type NavPt = { point: Point; distKm: number; flatIdx: number };
        type UserWpt = { wptIdx: number; point: Point; distKm: number; flatIdx: number; navPoints: NavPt[] };
        const userWaypoints: UserWpt[] = [];
        let cumDist = 0;
        let prevPoint: Point | null = null;
        let pendingNav: NavPt[] = [];

        for (let fi = 0; fi < activeLeg.points.length; fi++) {
          const globalFi = activeLegStartFi + fi;
          const p = activeLeg.points[fi];
          if (prevPoint) cumDist += haversineKm(prevPoint, p);
          prevPoint = p;
          if (p.isControlPoint) {
            if (userWaypoints.length > 0) userWaypoints[userWaypoints.length - 1].navPoints = pendingNav;
            pendingNav = [];
            userWaypoints.push({ wptIdx: userWaypoints.length, point: p, distKm: cumDist, flatIdx: globalFi, navPoints: [] });
          } else {
            pendingNav.push({ point: p, distKm: cumDist, flatIdx: globalFi });
          }
        }
        if (pendingNav.length > 0 && userWaypoints.length > 0) {
          userWaypoints[userWaypoints.length - 1].navPoints = pendingNav;
        }

        // flatToElev and cumTimes use global allFlat indices — no recomputation needed.

        /** Sum of positive elevation differences between two elevationPoints indices. */
        function legElevGain(startEi: number, endEi: number): number {
          let gain = 0;
          for (let i = startEi + 1; i <= endEi && i < elevations.length; i++) {
            const diff = (elevations[i] ?? 0) - (elevations[i - 1] ?? 0);
            if (diff > 0) gain += diff;
          }
          return gain;
        }

        // Elevation-aware cumulative time is memoised at PlannerSidebar level as `cumTimes`.

        const total = userWaypoints.length;
        const toggleWpt = (i: number) => setExpandedWpts(prev => {
          const next = new Set(prev);
          next.has(i) ? next.delete(i) : next.add(i);
          return next;
        });

        return (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate">Route</h3>
              {legs.length === 1 && (
                <button
                  onClick={onAddLeg}
                  className="flex items-center gap-1 text-xs text-slate-light hover:text-slate transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Add leg
                </button>
              )}
            </div>
            {total === 0 ? (
              <p className="text-xs text-slate-light py-2 text-center">No route points yet</p>
            ) : (
              <div className="@container flex flex-col border border-gray-200 rounded-xl overflow-hidden">
                {/* ── Column header row ── */}
                {total > 1 && (
                  <div className="flex items-center gap-3 px-3 py-1.5 bg-gray-50 border-b border-gray-200">
                    <div className="shrink-0 w-6" />
                    <div className="flex-1" />
                    <div className="shrink-0 flex gap-2 pl-2 border-l border-gray-200">
                      <p className="w-10 text-[9px] text-slate-light uppercase tracking-wider text-right">Bearing</p>
                      <p className="w-14 text-[9px] text-slate-light uppercase tracking-wider text-right">Distance</p>
                      <p className="w-12 text-[9px] text-slate-light uppercase tracking-wider text-right">Elev</p>
                      <p className="w-14 text-[9px] text-slate-light uppercase tracking-wider text-right">Est. time</p>
                    </div>
                    <div className="w-6 shrink-0" />
                  </div>
                )}
                {/* ── Data rows ── */}
                <div className="flex flex-col divide-y divide-gray-100">
                {userWaypoints.map(({ wptIdx, point, distKm, flatIdx, navPoints }) => {
                  const isFirst = wptIdx === 0;
                  const isLast = wptIdx === total - 1;
                  const badgeColour = isFirst ? '#2E7D32' : isLast ? '#e53935' : '#607D8B';
                  const label = isFirst ? 'Start' : isLast ? 'End' : `Control point ${wptIdx + 1}`;
                  const hasNav = navPoints.length > 0;
                  const expanded = expandedWpts.has(wptIdx);

                  // Bearing for the outgoing leg — null when nav-API routed or last point.
                  const outBearing = !isLast ? (() => {
                    const nextWpt = userWaypoints[wptIdx + 1];
                    const legWasSnapped = navPoints.length > 0 || nextWpt.point.isSnapped === true;
                    return legWasSnapped ? null : bearingDeg(point, nextWpt.point);
                  })() : null;

                  return (
                    <div key={wptIdx}>
                      {/* Control point header row:
                          single click  → fly map to this point
                          double click  → expand / collapse nav children
                          hover         → light bg + drive chart/map walker marker */}
                      <div
                        className="flex items-center gap-3 px-3 py-2.5 bg-white hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => onFlyTo(point)}
                        onDoubleClick={() => hasNav && toggleWpt(wptIdx)}
                        onMouseEnter={() => onChartHover(flatToElev[flatIdx])}
                        onMouseLeave={() => onChartHover(null)}
                      >
                        <div
                          className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ background: badgeColour }}
                        >
                          {wptIdx + 1}
                        </div>

                        {/* Left: label + coords — hidden when sidebar is below 500 px */}
                        <div className="flex-1 min-w-0">
                          <div className="hidden @min-[450px]:block">
                            <p className="text-xs font-semibold text-slate truncate">
                              {label}
                            </p>
                            <p className="text-[10px] text-slate-light font-mono truncate">
                              {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                            </p>
                          </div>
                        </div>

                        {/* Right: stats — fixed widths match header row; shown for all control points */}
                        {total > 1 && (
                          <div className="shrink-0 flex gap-2 pl-2 border-l border-gray-100">
                            <div className="w-10 text-right">
                              <p className="text-xs font-semibold text-slate leading-none">
                                {outBearing !== null ? `${outBearing}°` : '—'}
                              </p>
                            </div>
                            <div className="w-14 text-right">
                              <p className="text-xs font-semibold text-slate leading-none">{formatKm(distKm)}</p>
                            </div>
                            <div className="w-12 text-right">
                              <p className="text-xs font-semibold text-slate leading-none">
                                {elevations.length > 0 && elevations[flatToElev[flatIdx]] !== undefined
                                  ? `${Math.round(elevations[flatToElev[flatIdx]])} m`
                                  : '—'}
                              </p>
                            </div>
                            <div className="w-14 text-right">
                              <p className="text-xs font-semibold text-slate leading-none">
                                {distKm === 0 ? '0 min' : ActivityPace.formatHours(cumTimes[flatIdx] - legStartTime)}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Chevron placeholder — always rendered to keep stats columns aligned.
                             Circle button style matches the panel roll-up button, scaled to w-6 h-6. */}
                        <div className="shrink-0 w-6 h-6 flex items-center justify-center">
                          {hasNav && (
                            <button
                              className="w-6 h-6 flex items-center justify-center rounded-full border border-gray-200 hover:bg-gray-100 transition-colors text-slate pointer-events-auto"
                              title={expanded ? 'Collapse navigation points' : 'Expand navigation points'}
                              aria-label={expanded ? 'Collapse' : 'Expand'}
                              onClick={(e) => { e.stopPropagation(); toggleWpt(wptIdx); }}
                            >
                              <svg
                                viewBox="0 0 24 24" className="w-3 h-3 transition-transform"
                                style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                                fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                              >
                                <path d="M6 9l6 6 6-6" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Nav points — collapsible children */}
                      {hasNav && expanded && (
                        <div className="border-t border-gray-100 bg-gray-50">
                          {navPoints.map((np, ni) => (
                            <div
                              key={ni}
                              className="flex items-center gap-3 px-3 py-1.5 border-b border-gray-100 last:border-b-0 hover:bg-gray-100 transition-colors cursor-pointer"
                              onClick={() => onFlyTo(np.point)}
                              onMouseEnter={() => onChartHover(flatToElev[np.flatIdx])}
                              onMouseLeave={() => onChartHover(null)}
                            >
                              {/* Indent indicator — same width as badge (w-6) */}
                              <div className="shrink-0 flex flex-col items-center" style={{ width: 24 }}>
                                <div className="w-px flex-1 bg-gray-300" />
                                <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                                <div className="w-px flex-1 bg-gray-300" />
                              </div>
                              {/* Coords */}
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-slate font-mono truncate">
                                  {np.point.lat.toFixed(5)}, {np.point.lng.toFixed(5)}
                                </p>
                              </div>
                              {/* Stats — same fixed widths as control point columns */}
                              <div className="shrink-0 flex gap-2 pl-2 border-l border-gray-100">
                                <div className="w-10" />{/* bearing — n/a */}
                                <div className="w-14 text-right">
                                  <p className="text-xs font-semibold text-slate leading-none">{formatKm(np.distKm)}</p>
                                </div>
                                <div className="w-12 text-right">
                                  <p className="text-xs font-semibold text-slate leading-none">
                                    {elevations.length > 0 && elevations[flatToElev[np.flatIdx]] !== undefined
                                      ? `${Math.round(elevations[flatToElev[np.flatIdx]])} m`
                                      : '—'}
                                  </p>
                                </div>
                                <div className="w-14 text-right">
                                  <p className="text-xs font-semibold text-slate leading-none">
                                    {ActivityPace.formatHours(cumTimes[np.flatIdx] - legStartTime)}
                                  </p>
                                </div>
                              </div>
                              {/* Chevron placeholder — keep columns aligned */}
                              <div className="w-6 shrink-0" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Route points of interest ── */}
      <div className="mt-3 border-t border-gray-100 pt-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-slate-light uppercase tracking-wider">Route points of interest</p>
          <button
            onClick={onTogglePoiMode}
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
              poiMode
                ? 'bg-active text-white border-active'
                : 'bg-white text-slate border-gray-200 hover:border-active hover:text-active'
            }`}
          >
            + POI
          </button>
        </div>
        {pendingPois.length > 0 && (
          <div className="space-y-1.5">
            {pendingPois.map((poi, idx) => {
              const meta = PLACE_TYPE_META[poi.type];
              const distLabel = poi.distanceFromStartMetres !== undefined
                ? poi.distanceFromStartMetres < 1000
                  ? `${Math.round(poi.distanceFromStartMetres)} m from start`
                  : `${(poi.distanceFromStartMetres / 1000).toFixed(1)} km from start`
                : null;
              return (
                <div key={idx} className="flex items-start gap-2 px-1 group">
                  <span className="text-base leading-none mt-0.5 shrink-0">{meta.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate leading-tight truncate">
                      {poi.name || meta.label}
                    </p>
                    <p className="text-[10px] text-slate-light leading-tight">
                      {distLabel ?? meta.label}
                      {poi.visibility === 'community' && (
                        <span className="ml-1 text-orange-500">· community</span>
                      )}
                      {poi.autoDiscovered && (
                        <span className="ml-1 text-blue-400">· nearby</span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => onRemovePoi(idx)}
                    title="Remove from route"
                    className="shrink-0 p-0.5 text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M4 4l8 8M12 4l-8 8" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </>
  );

  return (
    <>
      <CollapsibleSidePanel
        title="Custom route"
        titleContent={
          isEditingName ? (
            <input
              ref={nameInputRef}
              type="text"
              value={routeName}
              maxLength={120}
              placeholder="Name your route"
              onChange={e => onRouteNameChange(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); commitName(); }
                if (e.key === 'Escape') { e.preventDefault(); setIsEditingName(false); }
              }}
              className="flex-1 min-w-0 bg-transparent text-base font-bold text-slate outline-none border-b border-brand focus:border-brand caret-brand"
            />
          ) : (
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="truncate text-base font-bold text-slate">
                {routeName || 'Custom route'}
              </span>
              <button
                onClick={startEditingName}
                className="shrink-0 p-0.5 rounded text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Edit route name"
              >
                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H3v-2L11.5 2.5Z" />
                </svg>
              </button>
            </span>
          )
        }
        width={width}
        onWidthChange={onWidthChange}
        alwaysShownContent={alwaysShownContent}
        collapsibleContent={collapsibleContent}
      />

      {/* Leg deletion confirmation — shown outside the panel so it renders above everything */}
      <ConfirmDialog
        open={pendingDeleteLeg !== null}
        title={`Remove ${pendingDeleteLeg?.name ?? 'leg'}?`}
        message={
          pendingDeleteLeg && pendingDeleteLeg.points.length > 0
            ? `This will permanently remove ${pendingDeleteLeg.name} and its ${pendingDeleteLeg.points.filter(p => p.isControlPoint).length} waypoint${pendingDeleteLeg.points.filter(p => p.isControlPoint).length !== 1 ? 's' : ''}. This action cannot be undone.`
            : `This will remove ${pendingDeleteLeg?.name ?? 'this leg'}. This action cannot be undone.`
        }
        confirmLabel="Remove leg"
        onConfirm={() => {
          if (pendingDeleteLeg) onDeleteLeg(pendingDeleteLeg.id);
          setPendingDeleteLeg(null);
        }}
        onCancel={() => setPendingDeleteLeg(null)}
      />
    </>
  );
}

// ── Map toolbar ───────────────────────────────────────────────────────────────

function ToolbarBtn({
  onClick, disabled = false, title, children,
  className = '',
}: {
  onClick?: () => void;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`px-3 py-2.5 transition-colors text-slate disabled:opacity-30 disabled:cursor-not-allowed enabled:hover:bg-gray-50 ${className}`}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px self-stretch bg-gray-100" aria-hidden="true" />;
}

function MapToolbar({
  snapToPath, onToggleSnap,
  onUndo, onRedo, canUndo, canRedo,
  onClear,
  onReverse, onCloseLoop, onTrackBack,
  onSave,
  hasPoints,
  isPending,
  sidebarWidth,
  containerRef,
  onWalkPreview,
  onFlyby,
}: {
  snapToPath: boolean;
  onToggleSnap: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onClear: () => void;
  onReverse: () => void;
  onCloseLoop: () => void;
  onTrackBack: () => void;
  onSave: () => void;
  hasPoints: boolean;
  isPending: boolean;
  sidebarWidth: number;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  onWalkPreview?: () => void;
  onFlyby?: () => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  // The toolbar is clamped so its left edge never overlaps the sidebar (desktop).
  // In mobile mode the sidebar is docked to the bottom, so the full width is free.
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT,
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  const mapAreaLeft = isMobile ? 0 : 16 + sidebarWidth + 8;
  return (
    <div
      ref={containerRef}
      className="absolute top-17 right-0 z-10 flex justify-center items-start pointer-events-none"
      style={{ left: mapAreaLeft }}
    >
      <div className="bg-white rounded-xl shadow-lg flex items-center pointer-events-auto">
        {/* Snap to paths toggle */}
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span className="text-xs font-semibold text-slate whitespace-nowrap">Snap</span>
          <button
            onClick={onToggleSnap}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              snapToPath ? 'bg-active' : 'bg-gray-300'
            }`}
            role="switch"
            aria-checked={snapToPath}
            title="Snap route to paths"
          >
            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${
              snapToPath ? 'translate-x-4.5' : 'translate-x-0.75'
            }`} />
          </button>
        </div>

        <ToolbarDivider />

        {/* Undo / Redo */}
        <ToolbarBtn onClick={onUndo} disabled={!canUndo || isPending} title="Undo">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.85"/></svg>
        </ToolbarBtn>
        <ToolbarBtn onClick={onRedo} disabled={!canRedo || isPending} title="Redo">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-4.85"/></svg>
        </ToolbarBtn>

        <ToolbarDivider />

        {/* Clear */}
        <ToolbarBtn onClick={onClear} disabled={!hasPoints || isPending} title="Clear route">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </ToolbarBtn>

        <ToolbarDivider />

        {/* Reverse direction */}
        <ToolbarBtn onClick={onReverse} disabled={!hasPoints || isPending} title="Reverse direction — swap start and end">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
        </ToolbarBtn>

        {/* Close loop */}
        <ToolbarBtn onClick={onCloseLoop} disabled={!hasPoints || isPending} title="Close loop — connect end back to start">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 12a9.5 9.5 0 1 1-9.5-9.5"/><polyline points="16 3 21.5 3 21.5 8"/></svg>
        </ToolbarBtn>

        {/* Track back */}
        <ToolbarBtn onClick={onTrackBack} disabled={!hasPoints || isPending} title="Track back — retrace route to start">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>
        </ToolbarBtn>

        <ToolbarDivider />

        {/* Previews dropdown */}
        {(onWalkPreview || onFlyby) && (
          <div className="relative">
            <ToolbarBtn
              onClick={() => setPreviewOpen((v) => !v)}
              disabled={!hasPoints || isPending}
              title="Preview options"
              className="flex items-center gap-1.5"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              <span className="text-xs font-semibold">Previews</span>
            </ToolbarBtn>
            {previewOpen && (
              <>
                {/* Click-outside backdrop */}
                <div className="fixed inset-0 z-20" onClick={() => setPreviewOpen(false)} />
                <div className="absolute top-full left-0 mt-1 z-30 bg-white rounded-xl shadow-xl border border-gray-100 min-w-45 py-1 pointer-events-auto">
                  {onWalkPreview && (
                    <button
                      onClick={() => { setPreviewOpen(false); onWalkPreview(); }}
                      className="w-full text-left px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Walk visualizer
                    </button>
                  )}
                  {onFlyby && (
                    <button
                      onClick={() => { setPreviewOpen(false); onFlyby(); }}
                      className="w-full text-left px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Checkpoint flyby
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <ToolbarDivider />

        {/* Save */}
        <ToolbarBtn onClick={onSave} disabled={!hasPoints || isPending} title="Save route" className="rounded-r-xl flex items-center gap-1.5 pr-3.5">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          <span className="text-xs font-semibold">Save</span>
        </ToolbarBtn>
      </div>
    </div>
  );
}

function InstructionToast({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 bg-[#263238] text-white text-sm px-4 py-3 rounded-xl shadow-xl pointer-events-auto">
      Click to place points or hold <kbd className="bg-white/20 px-1.5 py-0.5 rounded text-xs font-mono">Shift</kbd> to draw
      <button className="w-5 h-5 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-xs font-bold ml-1">
        ×
      </button>
    </div>
  );
}

// ── Map search bar ────────────────────────────────────────────────────────────

function MapSearchBar({ sidebarWidth }: { sidebarWidth: number }) {
  // 16px gap after sidebar's left-4 + sidebar width + 8px gap before search
  const left = 16 + sidebarWidth + 8;
  return (
    <div className="absolute top-18 z-10 w-64 pointer-events-auto" style={{ left }}>
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input
          type="search"
          placeholder="Search map"
          className="w-full pl-9 pr-3 py-2.5 text-sm bg-white rounded-xl border border-gray-200 shadow-lg focus:outline-none focus:border-brand transition-colors text-slate placeholder:text-slate-400"
        />
      </div>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export const SEGMENT_COLOURS = ['#2E7D32', '#E65100', '#1565C0', '#6A1B9A', '#AD1457'];

interface PlannerOverlayProps {
  legs: Leg[];
  allPoints: Point[];
  elevationPoints: Point[];
  elevations: number[];
  snapToPath: boolean;
  canUndo: boolean;
  canRedo: boolean;
  isPending: boolean;
  onAddLeg: () => void;
  onDeleteLeg: (id: string) => void;
  onClearLast: () => void;
  onClearAll: () => void;
  onToggleSnap: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onReverse: () => void;
  onCloseLoop: () => void;
  onTrackBack: () => void;
  onChartHover: (idx: number | null) => void;
  onChartRangeChange: (range: ChartRange | null) => void;
  onFlyTo: (p: Point) => void;
  chartHoverIdx: number | null;
  activeSegmentId: string;
  onSetActiveLeg: (id: string) => void;
  // POI mode
  poiMode: boolean;
  onTogglePoiMode: () => void;
  pendingPoiLngLat: { lng: number; lat: number } | null;
  onPendingPoiCancel: () => void;
  // Edit mode — set when the user clicks Edit on an existing route in Explore
  editingRouteId?: Id<'plannedRoutes'> | null;
  initialRouteName?: string;
  initialRouteDescription?: string;
  onRouteSaved?: (id: Id<'plannedRoutes'>) => void;
  /** Called whenever the pending-POI list changes, so map-shell can render markers. */
  onPendingPoisChange?: (pois: PendingPoi[]) => void;
  /** Start the walk visualizer preview. */
  onWalkPreview?: () => void;
  /** Start the checkpoint flyby preview. */
  onFlyby?: () => void;
}

export function PlannerOverlay({
  legs,
  allPoints,
  elevationPoints,
  elevations,
  snapToPath,
  canUndo,
  canRedo,
  isPending,
  onAddLeg,
  onDeleteLeg,
  onClearLast,
  onClearAll,
  onToggleSnap,
  onUndo,
  onRedo,
  onReverse,
  onCloseLoop,
  onTrackBack,
  onChartHover,
  onChartRangeChange,
  onFlyTo,
  chartHoverIdx,
  activeSegmentId,
  onSetActiveLeg,
  poiMode,
  onTogglePoiMode,
  pendingPoiLngLat,
  onPendingPoiCancel,
  editingRouteId,
  initialRouteName,
  initialRouteDescription,
  onRouteSaved,
  onPendingPoisChange,
  onWalkPreview,
  onFlyby,
}: PlannerOverlayProps) {
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [routeName, setRouteName] = useState(initialRouteName ?? '');
  const [sidebarWidth, setSidebarWidth] = usePanelWidth();

  // Pending POIs: held locally, saved atomically with the route.
  const [pendingPois, setPendingPois] = useState<PendingPoi[]>([]);

  // Notify map-shell whenever the POI list changes so it can render markers.
  useEffect(() => { onPendingPoisChange?.(pendingPois); }, [pendingPois, onPendingPoisChange]);

  // When editing an existing route, seed pendingPois from the saved places.
  const existingPlaces = useQuery(
    api.places.getByPlannedRoute,
    editingRouteId ? { plannedRouteId: editingRouteId } : 'skip',
  );
  const seededRef = useRef(false);
  useEffect(() => { seededRef.current = false; }, [editingRouteId]);
  useEffect(() => {
    if (!existingPlaces || seededRef.current) return;
    seededRef.current = true;
    setPendingPois(
      existingPlaces.map((r) => ({
        lngLat: { lng: r.place.longitude, lat: r.place.latitude },
        type: r.place.type as PendingPoi['type'],
        name: r.place.name,
        details: r.place.details as Record<string, unknown> | undefined,
        visibility: (r.place.visibility === 'public' ? 'community' : r.place.visibility) as PendingPoi['visibility'],
        distanceFromStartMetres: r.distanceFromStartMetres,
        order: r.order,
        savedPlaceId: r.placeId,
        alreadyLinked: true,
      } as PendingPoi))
    );
  }, [existingPlaces]);

  // ── POI auto-discovery ────────────────────────────────────────────────────
  // IDs of auto-discovered POIs the user explicitly dismissed — never re-add.
  const dismissedAutoIds = useRef<Set<string>>(new Set());
  useEffect(() => { dismissedAutoIds.current.clear(); }, [editingRouteId]);

  // Bounding box for the current route, expanded by the discovery radius.
  const poiDiscoveryBbox = useMemo(() => {
    if (allPoints.length < 1) return null;
    let minLat = allPoints[0].lat, maxLat = allPoints[0].lat;
    let minLng = allPoints[0].lng, maxLng = allPoints[0].lng;
    for (const p of allPoints) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    }
    const padLat = POI_DISCOVER_RADIUS_M / 111_320;
    const midLat = (minLat + maxLat) / 2;
    const padLng = POI_DISCOVER_RADIUS_M / (111_320 * Math.cos((midLat * Math.PI) / 180));
    return { minLat: minLat - padLat, maxLat: maxLat + padLat, minLng: minLng - padLng, maxLng: maxLng + padLng };
  }, [allPoints]);

  const nearbyPlaces = useQuery(
    api.places.getNearBbox,
    poiDiscoveryBbox
      ? { ...poiDiscoveryBbox, visibilities: ['community', 'public'] as const }
      : 'skip',
  );

  // Merge auto-discovered POIs whenever route or nearby data changes.
  useEffect(() => {
    if (allPoints.length < 2) {
      // Clear auto-discovered POIs when there's no route.
      setPendingPois(prev => prev.filter(p => !p.autoDiscovered));
      return;
    }
    if (!nearbyPlaces) return;

    setPendingPois(prev => {
      // Remove auto-discovered POIs that are now out of range or dismissed.
      const nearbySet = new Set(nearbyPlaces.map((p: { _id: string }) => p._id));
      const filtered = prev.filter(p => {
        if (!p.autoDiscovered) return true;
        if (!p.savedPlaceId || !nearbySet.has(p.savedPlaceId)) return false;
        return minDistToRouteMetres(p.lngLat.lat, p.lngLat.lng, allPoints) <= POI_DISCOVER_RADIUS_M;
      });

      // Add newly in-range POIs.
      const existingIds = new Set(filtered.map(p => p.savedPlaceId).filter(Boolean));
      const toAdd: PendingPoi[] = [];
      for (const place of nearbyPlaces as Array<{
        _id: string; latitude: number; longitude: number; type: string;
        name?: string; details?: unknown; visibility: string;
      }>) {
        if (existingIds.has(place._id)) continue;
        if (dismissedAutoIds.current.has(place._id)) continue;
        if (minDistToRouteMetres(place.latitude, place.longitude, allPoints) > POI_DISCOVER_RADIUS_M) continue;
        // Compute approximate distance from route start.
        let cumDist = 0, bestDist = Infinity, bestCumDist = 0;
        for (let i = 0; i < allPoints.length; i++) {
          if (i > 0) cumDist += haversineKm(allPoints[i - 1], allPoints[i]) * 1000;
          const d = haversineKm({ lng: place.longitude, lat: place.latitude }, allPoints[i]) * 1000;
          if (d < bestDist) { bestDist = d; bestCumDist = cumDist; }
        }
        toAdd.push({
          lngLat: { lng: place.longitude, lat: place.latitude },
          type: place.type as PendingPoi['type'],
          name: place.name,
          details: place.details as Record<string, unknown> | undefined,
          visibility: (place.visibility === 'public' ? 'community' : place.visibility) as PendingPoi['visibility'],
          distanceFromStartMetres: Math.round(bestCumDist),
          order: filtered.length + toAdd.length,
          savedPlaceId: place._id,
          autoDiscovered: true,
        });
      }

      if (toAdd.length === 0 && filtered.length === prev.length) return prev;
      return [...filtered, ...toAdd];
    });
  }, [nearbyPlaces, allPoints]);

  function handlePoiAdded(poi: PendingPoi) {
    // Compute distanceFromStartMetres using haversine scan of all route points.
    if (allPoints.length > 0) {
      let cumDist = 0;
      let bestDist = Infinity;
      let bestCumDist = 0;
      for (let i = 0; i < allPoints.length; i++) {
        if (i > 0) cumDist += haversineKm(allPoints[i - 1], allPoints[i]) * 1000;
        const d = haversineKm(poi.lngLat, allPoints[i]) * 1000;
        if (d < bestDist) { bestDist = d; bestCumDist = cumDist; }
      }
      poi = { ...poi, distanceFromStartMetres: Math.round(bestCumDist), order: pendingPois.length };
    }
    setPendingPois(prev => [...prev, poi]);
    onPendingPoiCancel(); // clears pendingPoiLngLat + exits poiMode
  }

  const handleRemovePoi = useCallback((index: number) => {
    setPendingPois(prev => {
      const poi = prev[index];
      if (poi?.autoDiscovered && poi.savedPlaceId) {
        dismissedAutoIds.current.add(poi.savedPlaceId);
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleWidthChange = useCallback((w: number) => setSidebarWidth(w), []);
  const toolbarWrapperRef = useRef<HTMLDivElement>(null);

  const totalDistKm = legs.reduce((s, leg) => s + totalKm(leg.points), 0);
  const elevGainM = elevations.length >= 2
    ? elevations.reduce((sum, e, i) => i > 0 && e > elevations[i - 1] ? sum + (e - elevations[i - 1]) : sum, 0)
    : 0;

  function requestClear() {
    setConfirmClearOpen(true);
  }

  function handleConfirmClear() {
    setConfirmClearOpen(false);
    onClearAll();
  }

  return (
    <>
      {/* ── Left sidebar ── */}
      <PlannerSidebar
        legs={legs}
        elevationPoints={elevationPoints}
        elevations={elevations}
        onAddLeg={onAddLeg}
        onDeleteLeg={onDeleteLeg}
        onClearLast={onClearLast}
        onClearAll={requestClear}
        onChartHover={onChartHover}
        onChartRangeChange={onChartRangeChange}
        onFlyTo={onFlyTo}
        chartHoverIdx={chartHoverIdx}
        width={sidebarWidth}
        onWidthChange={handleWidthChange}
        activeSegmentId={activeSegmentId}
        onSetActiveLeg={onSetActiveLeg}
        routeName={routeName}
        onRouteNameChange={setRouteName}
        pendingPois={pendingPois}
        onRemovePoi={handleRemovePoi}
        poiMode={poiMode}
        onTogglePoiMode={onTogglePoiMode}
      />

      {/* ── Instruction toast ── */}
      <InstructionToast visible={allPoints.length === 0} />

      {/* ── Bottom toolbar ── */}
      <MapToolbar
        containerRef={toolbarWrapperRef}
        snapToPath={snapToPath}
        onToggleSnap={onToggleSnap}
        onUndo={onUndo}
        onRedo={onRedo}
        onClear={requestClear}
        canUndo={canUndo}
        canRedo={canRedo}
        onReverse={onReverse}
        onCloseLoop={onCloseLoop}
        onTrackBack={onTrackBack}
        onSave={() => setSaveDialogOpen(true)}
        hasPoints={allPoints.length >= 1}
        isPending={isPending}
        sidebarWidth={sidebarWidth}
        onWalkPreview={onWalkPreview}
        onFlyby={onFlyby}
      />

      {/* ── POI mode banner (shown when waiting for map click, no form yet) ── */}
      {poiMode && !pendingPoiLngLat && (
        <div className="absolute top-30 inset-x-0 z-20 flex justify-center pointer-events-none">
          <div className="flex items-center gap-3 bg-white/95 backdrop-blur-sm rounded-full shadow-md px-4 py-2 pointer-events-auto border border-gray-100">
            <span className="text-sm text-slate">Click the map to place a point of interest</span>
            <button
              onClick={onPendingPoiCancel}
              className="text-xs font-semibold text-slate-light hover:text-slate border border-gray-200 rounded-full px-2.5 py-0.5 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Add POI form (shown after map click, before confirmation) ── */}
      {pendingPoiLngLat && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto">
            <AddPoiForm
              lngLat={pendingPoiLngLat}
              onSave={handlePoiAdded}
              onCancel={onPendingPoiCancel}
            />
          </div>
        </div>
      )}

      {/* ── Save route dialog ── */}
      <SaveRouteDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        onSaved={(id) => { setSaveDialogOpen(false); onRouteSaved?.(id); }}
        legs={legs}
        totalDistKm={totalDistKm}
        elevGainM={elevGainM}
        initialTitle={routeName}
        initialDescription={initialRouteDescription}
        pendingPois={pendingPois}
        editingRouteId={editingRouteId}
      />

      {/* ── Confirm clear dialog ── */}
      <ConfirmDialog
        open={confirmClearOpen}
        title="Remove route"
        message="This action will remove the current route. Are you sure?"
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleConfirmClear}
        onCancel={() => setConfirmClearOpen(false)}
      />
    </>
  );
}

// ── Shared icon ────────────────────────────────────────────────────────────────

// ── Save Route Dialog ────────────────────────────────────────────────────────

function SaveRouteDialog({ open, onClose, onSaved, legs, totalDistKm, elevGainM, initialTitle, initialDescription, pendingPois, editingRouteId }: {
  open: boolean;
  onClose: () => void;
  onSaved: (id: Id<'plannedRoutes'>) => void;
  legs: Leg[];
  totalDistKm: number;
  elevGainM: number;
  initialTitle?: string;
  initialDescription?: string;
  pendingPois: PendingPoi[];
  editingRouteId?: Id<'plannedRoutes'> | null;
}) {
  const saveRoute = useMutation(api.planned_routes.save);
  const updateRoute = useMutation(api.planned_routes.update);
  const createPlace = useMutation(api.places.createPlace);
  const linkToPlannedRoute = useMutation(api.places.linkToPlannedRoute);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTitle(initialTitle?.trim() ?? '');
      setDescription(initialDescription?.trim() ?? '');
      setError('');
      setTimeout(() => {
        const el = titleRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }, 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  async function handleSave() {
    const trimmed = title.trim();
    if (!trimmed) { setError('Please enter a name for the route.'); return; }
    setSaving(true);
    setError('');
    try {
      let id: Id<'plannedRoutes'>;

      if (editingRouteId) {
        // ── Update existing route ────────────────────────────────────────
        id = await updateRoute({
          id: editingRouteId,
          title: trimmed,
          ...(description.trim() ? { description: description.trim() } : {}),
          legs,
          stats: { distanceKm: Math.round(totalDistKm * 100) / 100, elevationGainM: Math.round(elevGainM) },
        });
      } else {
        // ── Create new route ─────────────────────────────────────────────
        id = await saveRoute({
          title: trimmed,
          ...(description.trim() ? { description: description.trim() } : {}),
          legs,
          stats: { distanceKm: Math.round(totalDistKm * 100) / 100, elevationGainM: Math.round(elevGainM) },
        });
      }

      // Persist POIs:
      //   alreadyLinked  → skip entirely (already in DB and linked to this route)
      //   savedPlaceId   → auto-discovered: already in DB, just link to the route
      //   neither        → new POI: create in DB then link
      for (const poi of pendingPois) {
        if (poi.alreadyLinked) continue;
        let placeId: Id<'places'>;
        if (poi.savedPlaceId) {
          placeId = poi.savedPlaceId as Id<'places'>;
        } else {
          placeId = await createPlace({
            type: poi.type,
            visibility: poi.visibility,
            latitude: poi.lngLat.lat,
            longitude: poi.lngLat.lng,
            ...(poi.name ? { name: poi.name } : {}),
            ...(poi.details ? { details: poi.details } : {}),
          });
        }
        await linkToPlannedRoute({
          plannedRouteId: id,
          placeId,
          ...(poi.order !== undefined ? { order: poi.order } : {}),
          ...(poi.distanceFromStartMetres !== undefined ? { distanceFromStartMetres: poi.distanceFromStartMetres } : {}),
        });
      }

      onSaved(id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const distLabel = totalDistKm < 1
    ? `${Math.round(totalDistKm * 1000)} m`
    : `${totalDistKm.toFixed(1)} km`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-route-title"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-sm mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="h-1 w-full bg-brand" />
        <div className="px-5 pt-5 pb-5">
          <h2 id="save-route-title" className="text-base font-bold text-slate mb-0.5">{editingRouteId ? 'Update route' : 'Save route'}</h2>
          <p className="text-[11px] text-slate-light mb-4">
            {distLabel}{elevGainM > 0 ? ` · +${Math.round(elevGainM)} m elevation` : ''}
          </p>

          <div className="flex flex-col gap-3 mb-4">
            <div>
              <label className="block text-xs font-semibold text-slate mb-1">Name <span className="text-red-500">*</span></label>
              <input
                ref={titleRef}
                type="text"
                value={title}
                maxLength={120}
                onChange={e => { setTitle(e.target.value); setError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                placeholder="e.g. Snowdon via Pyg Track"
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:border-brand focus:bg-white focus:outline-none transition-colors text-slate placeholder:text-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate mb-1">Description <span className="text-slate-light font-normal">(optional)</span></label>
              <textarea
                value={description}
                maxLength={500}
                onChange={e => setDescription(e.target.value)}
                placeholder="Add notes about the route…"
                rows={3}
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:border-brand focus:bg-white focus:outline-none transition-colors text-slate placeholder:text-slate-400 resize-none"
              />
            </div>
          </div>

          {error && (
            <p className="text-[11px] text-red-500 mb-3">{error}</p>
          )}

          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm font-medium text-slate hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!title.trim() || saving}
              className="px-4 py-1.5 text-sm font-semibold bg-brand hover:bg-brand-dark disabled:opacity-50 text-white rounded-lg transition-colors shadow-sm"
            >
              {saving
                ? (editingRouteId ? 'Updating…' : 'Saving…')
                : editingRouteId
                  ? 'Update route'
                  : pendingPois.length > 0 ? `Save route + ${pendingPois.length} POI${pendingPois.length !== 1 ? 's' : ''}` : 'Save route'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function WalkIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7z"/>
    </svg>
  );
}
