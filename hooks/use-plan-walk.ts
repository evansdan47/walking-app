/**
 * usePlanWalk
 *
 * All route-planning state and actions in one hook.
 * Used by PlanOverlay (which renders in index.tsx's view hierarchy so the
 * underlying map is never unmounted or reloaded).
 */

import { useMutation } from 'convex/react';
import { useCallback, useMemo, useState } from 'react';

import { api } from '@/convex/_generated/api';
import { upsertExploreRoute } from '@/lib/explore/sync-engine';
import type { PlanLeg, PlanPoint } from '@/lib/planning/route-stats';
import {
  difficulty,
  estimatedTimeMins,
  totalDistKm,
} from '@/lib/planning/route-stats';
import { fetchSnappedRoute } from '@/lib/planning/snap-to-path';
import { useUndoRedo } from './use-undo-redo';

const LEG_COLOUR = '#CD4700';

function emptyLeg(): PlanLeg {
  return { id: Date.now().toString(), name: 'Route', color: LEG_COLOUR, points: [] };
}

export interface UsePlanWalkReturn {
  legs: PlanLeg[];
  controlPoints: PlanPoint[];
  distKm: number;
  estimatedMins: number;
  routeDifficulty: 'Easy' | 'Moderate' | 'Challenging';
  routeName: string;
  setRouteName: (name: string) => void;
  snapToPath: boolean;
  toggleSnapToPath: () => void;
  isSnapping: boolean;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  addWaypoint: (lat: number, lng: number) => void;
  closeLoop: () => void;
  trackBack: () => void;
  isLoopClosed: boolean;
  clear: () => void;
  resetToEmpty: () => void;
  saveDraft: (title: string) => Promise<string>;
}

export function usePlanWalk(): UsePlanWalkReturn {
  const { present: legs, commit, undo, redo, canUndo, canRedo, reset } =
    useUndoRedo<PlanLeg[]>([emptyLeg()]);

  const [snapToPath, setSnapToPath] = useState(true);
  const [isSnapping, setIsSnapping] = useState(false);
  const [routeName, setRouteName] = useState('My Route');

  const saveRoute = useMutation(api.planned_routes.save);

  const distKm = useMemo(() => totalDistKm(legs), [legs]);
  const estimatedMins = useMemo(() => estimatedTimeMins(distKm), [distKm]);
  const routeDifficulty = useMemo(() => difficulty(distKm), [distKm]);

  const controlPoints = useMemo<PlanPoint[]>(() => {
    const pts: PlanPoint[] = [];
    for (const leg of legs) {
      for (const pt of leg.points) {
        if (pt.isControlPoint) pts.push(pt);
      }
    }
    return pts;
  }, [legs]);

  const addWaypoint = useCallback(
    (lat: number, lng: number) => {
      if (isSnapping) return;

      const newPoint: PlanPoint = { lat, lng, isControlPoint: true };
      const currentLeg = legs[0]!;
      const lastControlPoint = [...currentLeg.points]
        .reverse()
        .find((p) => p.isControlPoint);

      if (!snapToPath || !lastControlPoint) {
        commit((prev) => [{ ...prev[0]!, points: [...prev[0]!.points, newPoint] }]);
        return;
      }

      const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';
      if (!token) {
        commit((prev) => [{ ...prev[0]!, points: [...prev[0]!.points, newPoint] }]);
        return;
      }

      setIsSnapping(true);
      fetchSnappedRoute(lastControlPoint, newPoint, token)
        .then((snappedPoints) => {
          if (snappedPoints.length > 0) {
            const last = snappedPoints[snappedPoints.length - 1]!;
            last.isControlPoint = true;
            last.isSnapped = false;
          }
          commit((prev) => [
            { ...prev[0]!, points: [...prev[0]!.points, ...snappedPoints] },
          ]);
        })
        .catch(() => {
          commit((prev) => [{ ...prev[0]!, points: [...prev[0]!.points, newPoint] }]);
        })
        .finally(() => setIsSnapping(false));
    },
    [legs, snapToPath, isSnapping, commit],
  );

  /**
   * Snaps a path from the last control point back to the first, closing the
   * loop.  Re-uses the existing addWaypoint logic so snap-to-path applies.
   */
  const closeLoop = useCallback(() => {
    const currentLeg = legs[0]!;
    const firstControlPoint = currentLeg.points.find((p) => p.isControlPoint);
    if (!firstControlPoint) return;
    addWaypoint(firstControlPoint.lat, firstControlPoint.lng);
  }, [legs, addWaypoint]);

  /**
   * Appends the current route in reverse so the walk returns the same way it
   * came.  Re-uses all already-snapped points — no extra API calls.
   */
  const trackBack = useCallback(() => {
    const currentLeg = legs[0]!;
    if (currentLeg.points.length < 2) return;
    // Reverse all points, skip index 0 (= current endpoint, already at end).
    const toAppend = [...currentLeg.points].reverse().slice(1);
    commit((prev) => [
      { ...prev[0]!, points: [...prev[0]!.points, ...toAppend] },
    ]);
  }, [legs, commit]);

  /** True when the last control point is within 25 m of the first. */
  const isLoopClosed = useMemo(() => {
    if (controlPoints.length < 2) return false;
    const first = controlPoints[0]!;
    const last = controlPoints[controlPoints.length - 1]!;
    const dLat = (first.lat - last.lat) * 111_320;
    const dLng =
      (first.lng - last.lng) * 111_320 * Math.cos(first.lat * (Math.PI / 180));
    return Math.sqrt(dLat * dLat + dLng * dLng) < 25;
  }, [controlPoints]);

  const clear = useCallback(() => reset([emptyLeg()]), [reset]);

  const resetToEmpty = useCallback(() => {
    reset([emptyLeg()]);
    setRouteName('My Route');
    setSnapToPath(true);
  }, [reset]);

  const saveDraft = useCallback(
    async (title: string): Promise<string> => {
      const stats = {
        distanceKm: Math.round(distKm * 100) / 100,
        elevationGainM: 0,
      };
      const savedId = await saveRoute({ title, legs, stats, visibility: 'private' });
      upsertExploreRoute({
        _id: savedId as string,
        userId: '',
        title,
        legs,
        stats,
        createdAt: Date.now(),
        visibility: 'private',
      });
      return savedId as string;
    },
    [distKm, legs, saveRoute],
  );

  return {
    legs,
    controlPoints,
    distKm,
    estimatedMins,
    routeDifficulty,
    routeName,
    setRouteName,
    snapToPath,
    toggleSnapToPath: () => setSnapToPath((v) => !v),
    isSnapping,
    canUndo,
    canRedo,
    undo,
    redo,
    addWaypoint,
    closeLoop,
    trackBack,
    isLoopClosed,
    clear,
    resetToEmpty,
    saveDraft,
  };
}
