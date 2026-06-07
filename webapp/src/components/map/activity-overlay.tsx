'use client';

import type { ActivityWalkPhoto } from '@/components/activity/activity-walk-photo';
import { WalkActivityCard, type WalkCardEnrichment } from '@/components/activity/walk-activity-card';
import { WalkPhotoViewerModal } from '@/components/activity/walk-photo-viewer-modal';

export type { ActivityWalkPhoto };
import { WalkTaggingPrompt } from '@/components/tags/walk-tagging-prompt';
import { CollapsibleSidePanel } from '@/components/ui/collapsible-side-panel';
import { api } from '@convex/_generated/api';
import type { Doc, Id } from '@convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExploreElevationProfile } from './explore-overlay';
import type { Point } from './planner-overlay';
import { usePanelWidth, PANEL_MIN_WIDTH, PANEL_MAX_WIDTH, usePanelHeight, PANEL_MIN_HEIGHT, PANEL_MAX_HEIGHT, MOBILE_BREAKPOINT } from '@/hooks/use-panel-width';

// ── Types ──────────────────────────────────────────────────────────────────────

interface TrackPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  altitudeMetres?: number;
}

interface ActivityOverlayProps {
  /** Called whenever the displayed GPS track changes. Empty array = clear. */
  onTrackChange: (points: Point[]) => void;
  /** Called to fly-fit the map to a track's bounding box. */
  onFitBounds: (bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }) => void;
  /** Called when the user hovers the elevation chart. */
  onElevHoverIdx: (idx: number | null) => void;
  /** Called when walk photos load or clear (for map markers). */
  onPhotosChange: (photos: ActivityWalkPhoto[]) => void;
  /** Hovered photo — synced between gallery and map markers. */
  photoHoverId: Id<'walkPhotos'> | null;
  onPhotoHover: (id: Id<'walkPhotos'> | null) => void;
}

// ── Formatting helpers ─────────────────────────────────────────────────────────

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDistance(metres: number) {
  const km = metres / 1000;
  return km >= 1 ? `${km.toFixed(2)} km` : `${Math.round(metres)} m`;
}

function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

function formatPace(secsPerKm: number) {
  const m = Math.floor(secsPerKm / 60);
  const s = Math.round(secsPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')} /km`;
}

function formatPhotoClockTime(ts: number) {
  return new Date(ts).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatElapsedFromStart(walkStartedAt: number, photoTs: number) {
  const secs = Math.max(0, Math.round((photoTs - walkStartedAt) / 1000));
  return formatDuration(secs);
}

// ── Geometry helpers ───────────────────────────────────────────────────────────

function computeBounds(pts: Point[]): { minLat: number; maxLat: number; minLng: number; maxLng: number } | null {
  if (pts.length === 0) return null;
  let minLat = pts[0].lat, maxLat = pts[0].lat;
  let minLng = pts[0].lng, maxLng = pts[0].lng;
  for (const p of pts) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  // Add a small padding fraction
  const padLat = Math.max((maxLat - minLat) * 0.1, 0.002);
  const padLng = Math.max((maxLng - minLng) * 0.1, 0.002);
  return { minLat: minLat - padLat, maxLat: maxLat + padLat, minLng: minLng - padLng, maxLng: maxLng + padLng };
}

function trackToPoints(track: TrackPoint[]): Point[] {
  return track.map((p) => ({ lng: p.longitude, lat: p.latitude }));
}

// ── Sidebar width clamp ────────────────────────────────────────────────────────

// ── Sub-components ─────────────────────────────────────────────────────────────

function WalkListSkeleton() {
  return (
    <div className="space-y-2 px-1 pt-1 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-16 bg-gray-100 rounded-xl" />
      ))}
    </div>
  );
}

// ── Detail panel ───────────────────────────────────────────────────────────────

interface ActivityDetailProps {
  walkId: Id<'walks'>;
  walk: Pick<
    Doc<'walks'>,
    | 'title'
    | 'startedAt'
    | 'endedAt'
    | 'stats'
    | 'status'
    | 'taggingCompletedAt'
    | 'taggingSkipped'
    | 'plannedRouteId'
  >;
  track: TrackPoint[] | undefined;
  photos: ActivityWalkPhoto[] | undefined;
  photoHoverId: Id<'walkPhotos'> | null;
  onPhotoHover: (id: Id<'walkPhotos'> | null) => void;
  onBack: () => void;
  onElevHoverIdx: (idx: number | null) => void;
  panelWidth: number;
  onWidthChange: (w: number) => void;
}

function WalkPhotoGallery({
  photos,
  walkStartedAt,
  photoHoverId,
  onPhotoHover,
}: {
  photos: ActivityWalkPhoto[] | undefined;
  walkStartedAt: number;
  photoHoverId: Id<'walkPhotos'> | null;
  onPhotoHover: (id: Id<'walkPhotos'> | null) => void;
}) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  if (photos === undefined) {
    return (
      <div>
        <p className="text-[10px] text-slate-light uppercase tracking-wider mb-2 font-medium">Photography</p>
        <div className="grid grid-cols-3 gap-2 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="aspect-square rounded-lg bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="border-t border-gray-100 pt-3">
        <p className="text-[10px] text-slate-light uppercase tracking-wider mb-2 font-medium">Photography</p>
        <p className="text-xs text-gray-400">No photos recorded for this walk.</p>
      </div>
    );
  }

  return (
    <>
    <div className="border-t border-gray-100 pt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-slate-light uppercase tracking-wider font-medium">Photography</p>
        <p className="text-[10px] text-gray-400">
          {photos.length} photo{photos.length === 1 ? '' : 's'}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((photo, photoIndex) => {
          const isHovered = photoHoverId === photo._id;
          return (
            <button
              key={photo._id}
              type="button"
              className={`group text-left rounded-lg overflow-hidden border transition-all ${
                isHovered ? 'border-brand ring-2 ring-brand/30 shadow-sm' : 'border-gray-100 hover:border-gray-200'
              }`}
              onClick={() => setViewerIndex(photoIndex)}
              onMouseEnter={() => onPhotoHover(photo._id)}
              onMouseLeave={() => onPhotoHover(null)}
              onFocus={() => onPhotoHover(photo._id)}
              onBlur={() => onPhotoHover(null)}
            >
              <div className="aspect-square bg-gray-100 relative overflow-hidden">
                {photo.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.url}
                    alt={photo.caption ?? 'Walk photo'}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a41.09 41.09 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="px-1.5 py-1.5 bg-white">
                <p className="text-[10px] font-semibold text-gray-700 tabular-nums">
                  {formatPhotoClockTime(photo.timestamp)}
                </p>
                <p className="text-[9px] text-gray-400 tabular-nums">
                  +{formatElapsedFromStart(walkStartedAt, photo.timestamp)}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>

    <WalkPhotoViewerModal
      open={viewerIndex !== null}
      photos={photos}
      initialIndex={viewerIndex ?? 0}
      walkStartedAt={walkStartedAt}
      onClose={() => {
        setViewerIndex(null);
        onPhotoHover(null);
      }}
      onActivePhotoChange={onPhotoHover}
    />
    </>
  );
}

function ActivityDetail({
  walkId,
  walk,
  track,
  photos,
  photoHoverId,
  onPhotoHover,
  onBack,
  onElevHoverIdx,
  panelWidth,
  onWidthChange,
}: ActivityDetailProps) {
  const stats = walk.stats;
  const [taggingDismissed, setTaggingDismissed] = useState(false);
  const showTaggingPrompt =
    walk.status === 'completed' &&
    !walk.taggingCompletedAt &&
    !walk.taggingSkipped &&
    !taggingDismissed;

  // ── Resize ─────────────────────────────────────────────────────────────
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      isDragging.current = true;
      dragStartX.current = e.clientX;
      dragStartWidth.current = panelWidth;
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    },
    [panelWidth],
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

  // ── Mobile height resize ──────────────────────────────────────────────
  const [panelHeight, setPanelHeight] = usePanelHeight();
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT,
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

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

  // ─────────────────────────────────────────────────────────────────

  const elevPoints = useMemo(
    () => (track ?? []).map((p) => ({ lat: p.latitude, lng: p.longitude })),
    [track],
  );

  const elevations = useMemo(
    () => (track ?? []).map((p) => p.altitudeMetres ?? 0),
    [track],
  );

  const hasElevData = useMemo(
    () => (track ?? []).some((p) => p.altitudeMetres !== undefined),
    [track],
  );

  const date = formatDate(walk.startedAt);
  const duration = walk.endedAt ? walk.endedAt - walk.startedAt : null;

  return (
    <>
    <div
      className={isMobile
        ? 'absolute bottom-0 left-0 right-0 z-10 pointer-events-auto bg-white rounded-t-xl shadow-xl overflow-hidden flex flex-col'
        : 'absolute left-4 z-10 pointer-events-auto bg-white rounded-xl shadow-xl overflow-hidden flex flex-col'
      }
      style={isMobile ? { height: panelHeight } : { top: 68, bottom: 16, width: panelWidth }}
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
      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-4 pb-3 shrink-0 border-b border-gray-100">
        <button
          onClick={onBack}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
          aria-label="Back to activity list"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-gray-900 text-base leading-tight truncate">
            {walk.title ?? date}
          </h2>
          {walk.title && (
            <p className="text-xs text-gray-400 mt-0.5">{date}</p>
          )}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="overflow-y-auto flex-1 min-h-0 px-4 py-4 space-y-5">

        {/* Primary stats grid */}
        {stats && (
          <div className="grid grid-cols-3 gap-3">
            <StatCell label="Distance" value={formatDistance(stats.distanceMetres)} />
            <StatCell label="Duration" value={formatDuration(stats.durationSeconds)} />
            <StatCell
              label="Avg pace"
              value={stats.avgPaceSecsPerKm != null ? formatPace(stats.avgPaceSecsPerKm) : '—'}
            />
          </div>
        )}

        {/* Elevation profile */}
        <div>
          <p className="text-[10px] text-slate-light uppercase tracking-wider mb-2 font-medium">Elevation</p>
          {!track ? (
            <div className="h-16 flex items-center justify-center bg-gray-50 rounded-lg animate-pulse">
              <p className="text-xs text-gray-400">Loading…</p>
            </div>
          ) : !hasElevData ? (
            <div className="h-16 flex items-center justify-center bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-400">No elevation data recorded</p>
            </div>
          ) : (
            <ExploreElevationProfile
              points={elevPoints}
              elevations={elevations}
              onHoverIndex={onElevHoverIdx}
            />
          )}
        </div>

        {/* Secondary stats */}
        {stats && (
          <div className="grid grid-cols-2 gap-3">
            <StatCell
              label="Elevation gain"
              value={stats.elevationGainMetres != null ? `${Math.round(stats.elevationGainMetres)} m` : '—'}
            />
            <StatCell
              label="Moving time"
              value={formatDuration(stats.movingTimeSeconds)}
            />
            {stats.elevationLossMetres != null && (
              <StatCell
                label="Elevation loss"
                value={`${Math.round(stats.elevationLossMetres)} m`}
              />
            )}
            {duration != null && (
              <StatCell
                label="Total time"
                value={formatDuration(Math.round(duration / 1000))}
              />
            )}
          </div>
        )}

        {/* GPS info */}
        {track && (
          <div className="border-t border-gray-100 pt-3">
            <p className="text-[10px] text-slate-light uppercase tracking-wider mb-1.5 font-medium">GPS points</p>
            <p className="text-xs text-gray-500">{track.length.toLocaleString()} track points recorded</p>
          </div>
        )}

        <WalkPhotoGallery
          photos={photos}
          walkStartedAt={walk.startedAt}
          photoHoverId={photoHoverId}
          onPhotoHover={onPhotoHover}
        />

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
    {showTaggingPrompt && (
      <WalkTaggingPrompt
        walkId={walkId}
        {...(walk.plannedRouteId !== undefined ? { plannedRouteId: walk.plannedRouteId } : {})}
        onDone={() => setTaggingDismissed(true)}
      />
    )}
    </>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center bg-gray-50 rounded-xl py-3 px-2">
      <p className="text-sm font-bold text-gray-900 leading-tight">{value}</p>
      <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}

// ── Main overlay ───────────────────────────────────────────────────────────────

export function ActivityOverlay({
  onTrackChange,
  onFitBounds,
  onElevHoverIdx,
  onPhotosChange,
  photoHoverId,
  onPhotoHover,
}: ActivityOverlayProps) {
  const [selectedWalkId, setSelectedWalkId] = useState<Id<'walks'> | null>(null);
  const [hoveredWalkId, setHoveredWalkId] = useState<Id<'walks'> | null>(null);
  const [sidebarWidth, setSidebarWidth] = usePanelWidth();

  const walks = useQuery(api.walks.listForCurrentUser);
  const walkIds = useMemo(() => (walks ?? []).map((w) => w._id), [walks]);
  const cardEnrichmentRows = useQuery(
    api.walks.getCardEnrichment,
    walkIds.length > 0 ? { walkIds } : 'skip',
  );
  const cardEnrichment = useMemo(() => {
    const map = new Map<Id<'walks'>, WalkCardEnrichment>();
    for (const row of cardEnrichmentRows ?? []) {
      map.set(row.walkId, {
        totalPhotos: row.totalPhotos,
        photos: row.photos,
        routeCoordinates: row.routeCoordinates,
      });
    }
    return map;
  }, [cardEnrichmentRows]);
  const removeWalk = useMutation(api.walks.remove);
  const walkPhotos = useQuery(
    api.walk_photos.listForWalk,
    selectedWalkId ? { walkId: selectedWalkId } : 'skip',
  );

  // Load GPS track for hover preview (skip when showing detail)
  const hoveredTrack = useQuery(
    api.track_points.getCleanForWalk,
    hoveredWalkId && !selectedWalkId ? { walkId: hoveredWalkId } : 'skip',
  );

  // Load GPS track for selected walk detail view
  const selectedTrack = useQuery(
    api.track_points.getCleanForWalk,
    selectedWalkId ? { walkId: selectedWalkId } : 'skip',
  );

  // Push hovered track to map when not in detail view
  const prevBoundsRef = useRef<string>('');
  useEffect(() => {
    if (selectedWalkId) return; // detail view handles its own track
    const track = hoveredTrack;
    if (!track) {
      onTrackChange([]);
      return;
    }
    const pts = trackToPoints(track);
    onTrackChange(pts);
    const bounds = computeBounds(pts);
    if (bounds) {
      const key = `${bounds.minLat.toFixed(5)},${bounds.maxLat.toFixed(5)}`;
      if (key !== prevBoundsRef.current) {
        prevBoundsRef.current = key;
        onFitBounds(bounds);
      }
    }
  }, [hoveredTrack, selectedWalkId, onTrackChange, onFitBounds]);

  // When hover clears (mouse leaves list), clear the track
  useEffect(() => {
    if (!hoveredWalkId && !selectedWalkId) {
      onTrackChange([]);
      prevBoundsRef.current = '';
    }
  }, [hoveredWalkId, selectedWalkId, onTrackChange]);

  // Push walk photos to map markers when detail view is open
  useEffect(() => {
    if (!selectedWalkId) {
      onPhotosChange([]);
      onPhotoHover(null);
      return;
    }
    onPhotosChange(walkPhotos ?? []);
  }, [selectedWalkId, walkPhotos, onPhotosChange, onPhotoHover]);

  // When selectedTrack loads, push to map and fit
  const fittedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedTrack || !selectedWalkId) return;
    const pts = trackToPoints(selectedTrack);
    onTrackChange(pts);
    if (fittedIdRef.current !== selectedWalkId) {
      fittedIdRef.current = selectedWalkId;
      const photoPts = (walkPhotos ?? []).map((p: ActivityWalkPhoto) => ({
        lat: p.latitude,
        lng: p.longitude,
      }));
      const bounds = computeBounds([...pts, ...photoPts]);
      if (bounds) onFitBounds(bounds);
    }
  }, [selectedTrack, selectedWalkId, walkPhotos, onTrackChange, onFitBounds]);

  // Clear fitted-id ref when selection changes
  useEffect(() => {
    if (!selectedWalkId) fittedIdRef.current = null;
  }, [selectedWalkId]);

  const handleBack = useCallback(() => {
    setSelectedWalkId(null);
    onElevHoverIdx(null);
    onTrackChange([]);
    onPhotosChange([]);
    onPhotoHover(null);
    prevBoundsRef.current = '';
  }, [onElevHoverIdx, onTrackChange, onPhotosChange, onPhotoHover]);

  const handleWidthChange = setSidebarWidth;

  // Selected walk data (for the detail panel)
  const selectedWalk = useMemo(
    () => (walks ?? []).find((w) => w._id === selectedWalkId) ?? null,
    [walks, selectedWalkId],
  );

  // ── List panel content ────────────────────────────────────────────────────

  const listContent = useMemo(() => {
    if (walks === undefined) return <WalkListSkeleton />;
    if (walks.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
          <svg viewBox="0 0 24 24" className="w-10 h-10 text-gray-200" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-gray-500">No activities yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Record walks in the mobile app — they&apos;ll appear here after syncing.
            </p>
          </div>
        </div>
      );
    }

    const inProgress = walks.filter((w) => w.status === 'recording' || w.status === 'paused');
    const completed = walks.filter((w) => w.status === 'completed');

    function renderGroup(group: NonNullable<typeof walks>) {
      return group.map((walk) => (
        <WalkActivityCard
          key={walk._id}
          walk={walk}
          enrichment={cardEnrichment.get(walk._id)}
          isHovered={hoveredWalkId === walk._id}
          onHover={(hovered) => setHoveredWalkId(hovered ? walk._id : null)}
          onView={() => {
            setSelectedWalkId(walk._id);
            setHoveredWalkId(null);
          }}
          onRemove={() => {
            void removeWalk({ walkId: walk._id }).then(() => {
              if (selectedWalkId === walk._id) {
                setSelectedWalkId(null);
                onTrackChange([]);
                onPhotosChange([]);
                onPhotoHover(null);
              }
              if (hoveredWalkId === walk._id) {
                setHoveredWalkId(null);
                onTrackChange([]);
              }
            });
          }}
        />
      ));
    }

    return (
      <div className="px-1 pb-2">
        {inProgress.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wider px-1 mb-1.5">
              In Progress
            </p>
            <div className="space-y-2">{renderGroup(inProgress)}</div>
          </div>
        )}
        {completed.length > 0 && (
          <div>
            {inProgress.length > 0 && (
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 mb-1.5">
                Completed
              </p>
            )}
            <div className="space-y-2">{renderGroup(completed)}</div>
          </div>
        )}
      </div>
    );
  }, [
    walks,
    hoveredWalkId,
    selectedWalkId,
    cardEnrichment,
    removeWalk,
    onTrackChange,
    onPhotosChange,
    onPhotoHover,
  ]);

  // ── Render ────────────────────────────────────────────────────────────────

  // Detail panel shown on top of (replacing) the side panel
  if (selectedWalkId && selectedWalk) {
    return (
      <ActivityDetail
        walkId={selectedWalkId}
        walk={selectedWalk}
        track={selectedTrack}
        photos={walkPhotos}
        photoHoverId={photoHoverId}
        onPhotoHover={onPhotoHover}
        onBack={handleBack}
        onElevHoverIdx={onElevHoverIdx}
        panelWidth={sidebarWidth}
        onWidthChange={setSidebarWidth}
      />
    );
  }

  return (
    <CollapsibleSidePanel
      title="Activity"
      width={sidebarWidth}
      onWidthChange={handleWidthChange}
      alwaysShownContent={
        <div className="px-3 pb-2">
          <p className="text-[11px] text-slate-light">
            {walks === undefined
              ? 'Loading…'
              : walks.length === 0
              ? 'No activities recorded yet'
              : `${walks.length} activit${walks.length === 1 ? 'y' : 'ies'}`}
          </p>
        </div>
      }
      collapsibleContent={listContent}
    />
  );
}
