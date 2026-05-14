import React, { createContext, useCallback, useContext, useState } from 'react';

import type { WalkPhoto } from '@/lib/db/walk-photos';
import type { RoutePoint } from '@/lib/review/build-route';
import type { RouteColours, RouteDisplayMode } from '@/lib/review/route-display-modes';

/** Extra display options that walk-summary pushes so the shared map renders correctly. */
export interface ReviewOverlayOptions {
  cameraPaddingBottom: number;
  cameraPaddingTop: number;
  showPhotoMarkers: boolean;
  focusCoordinate: [number, number] | null;
  onPhotoLongPress?: (photo: WalkPhoto) => void;
  mode: RouteDisplayMode;
  colours?: RouteColours;
}

const DEFAULT_OVERLAY_OPTIONS: ReviewOverlayOptions = {
  cameraPaddingBottom: 300,
  cameraPaddingTop: 80,
  showPhotoMarkers: false,
  focusCoordinate: null,
  mode: 'route',
};

interface ReviewRouteContextValue {
  /** Route points for the currently open walk summary (empty when none). */
  reviewRoute: RoutePoint[];
  /** Photos for the currently open walk summary. */
  reviewPhotos: WalkPhoto[];
  /** Callback to invoke when the user taps a photo pin on the map. */
  onPhotoTap: ((photo: WalkPhoto) => void) | undefined;
  /** True when a walk-summary screen is open and has pushed its data. */
  isReviewActive: boolean;
  /** Extra display/camera options for the shared map ReviewRouteLayer. */
  reviewOverlayOptions: ReviewOverlayOptions;
  /** Called by walk-summary on mount to populate data into the shared map. */
  setReviewData: (
    route: RoutePoint[],
    photos: WalkPhoto[],
    onPhotoTap: (photo: WalkPhoto) => void,
  ) => void;
  /** Called by walk-summary to sync display/camera options to the shared map. */
  setReviewOverlayOptions: (opts: Partial<ReviewOverlayOptions>) => void;
  /** Called by walk-summary on unmount to clear the shared map overlay. */
  clearReviewData: () => void;
}

const ReviewRouteContext = createContext<ReviewRouteContextValue | null>(null);

export function ReviewRouteProvider({ children }: { children: React.ReactNode }) {
  const [reviewRoute, setReviewRoute] = useState<RoutePoint[]>([]);
  const [reviewPhotos, setReviewPhotos] = useState<WalkPhoto[]>([]);
  const [onPhotoTap, setOnPhotoTap] = useState<((photo: WalkPhoto) => void) | undefined>(
    undefined,
  );
  const [reviewOverlayOptions, setReviewOverlayOptionsState] = useState<ReviewOverlayOptions>(
    DEFAULT_OVERLAY_OPTIONS,
  );

  const setReviewData = useCallback(
    (
      route: RoutePoint[],
      photos: WalkPhoto[],
      handler: (photo: WalkPhoto) => void,
    ) => {
      setReviewRoute(route);
      setReviewPhotos(photos);
      // useState setter with function value must be wrapped in a thunk to avoid
      // React treating the handler itself as an updater function.
      setOnPhotoTap(() => handler);
    },
    [],
  );

  const setReviewOverlayOptions = useCallback((opts: Partial<ReviewOverlayOptions>) => {
    setReviewOverlayOptionsState((prev) => ({ ...prev, ...opts }));
  }, []);

  const clearReviewData = useCallback(() => {
    setReviewRoute([]);
    setReviewPhotos([]);
    setOnPhotoTap(undefined);
    setReviewOverlayOptionsState(DEFAULT_OVERLAY_OPTIONS);
  }, []);

  return (
    <ReviewRouteContext.Provider
      value={{
        reviewRoute,
        reviewPhotos,
        onPhotoTap,
        isReviewActive: reviewRoute.length > 0,
        reviewOverlayOptions,
        setReviewData,
        setReviewOverlayOptions,
        clearReviewData,
      }}
    >
      {children}
    </ReviewRouteContext.Provider>
  );
}

export function useReviewRoute() {
  const ctx = useContext(ReviewRouteContext);
  if (!ctx) throw new Error('useReviewRoute must be used within ReviewRouteProvider');
  return ctx;
}
