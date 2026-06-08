'use client';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

import { usePace } from '@/components/pace-context';
import { ACTIVITY_PROFILES, type ActivityPace } from '@/lib/activity-pace';
import { formatDaysAgo, formatWalkDateTime, formatWalkedOnDate } from '@/lib/walk-date';

type RouteWalkHistoryProps = {
  plannedRouteId: Id<'plannedRoutes'>;
  routeDistanceKm: number;
  routeElevationM: number;
};

function fmtTime(km: number, elevM: number, activity: ActivityPace): string {
  const hrs = km / activity.flatKmh + elevM / 600;
  const totalMins = Math.round(hrs * 60);
  if (totalMins <= 0) return '—';
  if (totalMins < 60) return `${totalMins} min`;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function formatDistanceM(metres: number | undefined): string {
  if (metres === undefined || metres <= 0) return '—';
  if (metres >= 1000) return `${(metres / 1000).toFixed(1)} km`;
  return `${Math.round(metres)} m`;
}

function formatDuration(seconds: number | undefined): string {
  if (seconds === undefined || seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatPace(secsPerKm: number | null | undefined): string {
  if (secsPerKm === null || secsPerKm === undefined || !Number.isFinite(secsPerKm) || secsPerKm <= 0) {
    return '—';
  }
  const m = Math.floor(secsPerKm / 60);
  const s = Math.round(secsPerKm % 60);
  return `${m}:${s.toString().padStart(2, '0')}/km`;
}

function paceFromWalk(
  stats: { distanceMetres: number; movingTimeSeconds: number; avgPaceSecsPerKm: number | null } | null,
): number | null {
  if (!stats || stats.distanceMetres <= 0) return null;
  if (stats.avgPaceSecsPerKm != null && stats.avgPaceSecsPerKm > 0) {
    return stats.avgPaceSecsPerKm;
  }
  if (stats.movingTimeSeconds <= 0) return null;
  return stats.movingTimeSeconds / (stats.distanceMetres / 1000);
}

export function RouteWalkHistoryBanner({ lastWalkedAt }: { lastWalkedAt: number }) {
  return (
    <p className="text-xs text-brand font-medium mt-1 leading-snug">
      You have walked this before — last walked on {formatWalkedOnDate(lastWalkedAt)} (
      {formatDaysAgo(lastWalkedAt)})
    </p>
  );
}

export function RouteWalkPhotoGrid({
  photos,
}: {
  photos: Array<{ _id: Id<'walkPhotos'>; url: string | null; timestamp: number }>;
}) {
  if (photos.length === 0) {
    return (
      <p className="text-xs text-gray-400 py-2">No photos from your walks on this route yet.</p>
    );
  }

  const featured = photos[0]!;
  const side = photos.slice(1, 3);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Photography</p>
        <p className="text-[10px] text-gray-400">
          {photos.length} photo{photos.length === 1 ? '' : 's'} from your walks
        </p>
      </div>
      <div className="flex gap-1.5" style={{ height: 168 }}>
        <div className="flex-[3] rounded-lg overflow-hidden bg-gray-100 relative">
          {featured.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={featured.url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gray-200" />
          )}
        </div>
        {side.length > 0 && (
          <div className="flex flex-col gap-1.5 flex-[2]">
            {side.map((photo) => (
              <div key={photo._id} className="flex-1 rounded-lg overflow-hidden bg-gray-100 relative min-h-0">
                {photo.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo.url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gray-200" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type WalkRow = {
  walkId: Id<'walks'>;
  startedAt: number;
  stats: {
    distanceMetres: number;
    durationSeconds: number;
    movingTimeSeconds: number;
    avgPaceSecsPerKm: number | null;
    elevationGainMetres: number | null;
  } | null;
};

function RouteWalkHistoryTable({
  walks,
  routeDistanceKm,
  routeElevationM,
  onOpenWalk,
}: {
  walks: WalkRow[];
  routeDistanceKm: number;
  routeElevationM: number;
  onOpenWalk: (walkId: Id<'walks'>) => void;
}) {
  const { pace } = usePace();
  const activity = ACTIVITY_PROFILES[pace];
  const estTime = fmtTime(routeDistanceKm, routeElevationM, activity);
  const paceLabel = activity.label;

  const averages = useMemo(() => {
    const withStats = walks.filter((w) => w.stats && w.stats.distanceMetres > 0);
    if (withStats.length === 0) return null;

    const distanceMetres =
      withStats.reduce((s, w) => s + (w.stats?.distanceMetres ?? 0), 0) / withStats.length;
    const elevationGainMetres =
      withStats.reduce((s, w) => s + (w.stats?.elevationGainMetres ?? 0), 0) / withStats.length;
    const movingTimeSeconds =
      withStats.reduce((s, w) => s + (w.stats?.movingTimeSeconds ?? 0), 0) / withStats.length;
    const totalDistKm = withStats.reduce((s, w) => s + (w.stats?.distanceMetres ?? 0), 0) / 1000;
    const totalMoving = withStats.reduce((s, w) => s + (w.stats?.movingTimeSeconds ?? 0), 0);
    const avgPace = totalDistKm > 0 ? totalMoving / totalDistKm : null;

    return { distanceMetres, elevationGainMetres, movingTimeSeconds, avgPace };
  }, [walks]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Your walks</p>
        <p className="text-[10px] text-gray-400">
          Est. {estTime} · {paceLabel}
        </p>
      </div>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-xs border-collapse min-w-[520px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
              <th className="text-left font-semibold py-2 pr-2">When</th>
              <th className="text-right font-semibold py-2 px-2">Distance</th>
              <th className="text-right font-semibold py-2 px-2">Ascent</th>
              <th className="text-right font-semibold py-2 px-2">Actual</th>
              <th className="text-right font-semibold py-2 pl-2">Pace</th>
            </tr>
          </thead>
          <tbody>
            {walks.map((walk) => {
              const elev = walk.stats?.elevationGainMetres;
              return (
                <tr
                  key={walk.walkId}
                  onClick={() => onOpenWalk(walk.walkId)}
                  className="border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <td className="py-2.5 pr-2 text-gray-800 font-medium">
                    {formatWalkDateTime(walk.startedAt)}
                  </td>
                  <td className="py-2.5 px-2 text-right text-gray-700 tabular-nums">
                    {formatDistanceM(walk.stats?.distanceMetres)}
                  </td>
                  <td className="py-2.5 px-2 text-right text-gray-700 tabular-nums">
                    {elev != null && elev > 0 ? `${Math.round(elev)} m` : '—'}
                  </td>
                  <td className="py-2.5 px-2 text-right text-gray-700 tabular-nums">
                    {formatDuration(walk.stats?.movingTimeSeconds)}
                  </td>
                  <td className="py-2.5 pl-2 text-right text-gray-600 tabular-nums">
                    {formatPace(paceFromWalk(walk.stats))}
                  </td>
                </tr>
              );
            })}
            {averages && walks.length > 1 && (
              <tr className="bg-gray-50/80">
                <td className="py-2 pr-2 pl-2 font-semibold text-gray-600">Average</td>
                <td className="text-right py-2 px-2 font-semibold text-gray-800 tabular-nums">
                  {formatDistanceM(averages.distanceMetres)}
                </td>
                <td className="text-right py-2 px-2 font-semibold text-gray-800 tabular-nums">
                  {averages.elevationGainMetres > 0
                    ? `${Math.round(averages.elevationGainMetres)} m`
                    : '—'}
                </td>
                <td className="text-right py-2 px-2 font-semibold text-gray-800 tabular-nums">
                  {formatDuration(averages.movingTimeSeconds)}
                </td>
                <td className="text-right py-2 pl-2 font-semibold text-gray-800 tabular-nums">
                  {formatPace(averages.avgPace)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ExploreRouteWalkHistoryTable({
  plannedRouteId,
  routeDistanceKm,
  routeElevationM,
}: RouteWalkHistoryProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const history = useQuery(api.walks.getRouteWalkHistory, { plannedRouteId });

  const openWalk = (walkId: Id<'walks'>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('mode', 'activity');
    params.set('walkId', walkId);
    router.push(`/map?${params.toString()}`);
  };

  if (history === undefined || history === null) return null;

  return (
    <div className="px-4 py-4 border-b border-gray-100">
      <RouteWalkHistoryTable
        walks={history.walks}
        routeDistanceKm={routeDistanceKm}
        routeElevationM={routeElevationM}
        onOpenWalk={openWalk}
      />
    </div>
  );
}

/** Header-only banner for embedding under route title. */
export function useRouteWalkHistory(plannedRouteId: Id<'plannedRoutes'>) {
  return useQuery(api.walks.getRouteWalkHistory, { plannedRouteId });
}
