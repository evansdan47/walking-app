import React, { createContext, useCallback, useContext, useState } from 'react';

import type { WalkPhoto } from '@/lib/db/walk-photos';
import type { RoutePoint } from '@/lib/review/build-route';

interface ReviewRouteContextValue {
  /** Route points for the currently open walk summary (empty when none). */
  reviewRoute: RoutePoint[];
  /** Photos for the currently open walk summary. */
  reviewPhotos: WalkPhoto[];
  /** Callback to invoke when the user taps a photo pin on the map. */
  onPhotoTap: ((photo: WalkPhoto) => void) | undefined;
  /** True when a walk-summary screen is open and has pushed its data. */
  isReviewActive: boolean;
  /** Called by walk-summary on mount to populate data into the shared map. */
  setReviewData: (
    route: RoutePoint[],
    photos: WalkPhoto[],
    onPhotoTap: (photo: WalkPhoto) => void,
  ) => void;
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

  const clearReviewData = useCallback(() => {
    setReviewRoute([]);
    setReviewPhotos([]);
    setOnPhotoTap(undefined);
  }, []);

  return (
    <ReviewRouteContext.Provider
      value={{
        reviewRoute,
        reviewPhotos,
        onPhotoTap,
        isReviewActive: reviewRoute.length > 0,
        setReviewData,
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
