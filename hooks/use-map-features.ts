import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useMutation, useQuery } from 'convex/react';

import { api } from '@/convex/_generated/api';

const CACHE_KEY = 'map_features_v1';

export interface MapFeatureFlags {
  /** When true, map is shown in 45° isometric (3D) perspective. */
  map3d: boolean;
  /** When true, a compass needle is shown in the button strip; tap resets to north-up. */
  mapCompass: boolean;
  /** When true, a floating panel shows lat/lng, OS grid ref, and nearest postcode. */
  mapLocationInfo: boolean;
}

const DEFAULTS: MapFeatureFlags = {
  map3d: false,
  mapCompass: false,
  mapLocationInfo: false,
};

/**
 * Convex-backed map feature flags — three independent booleans stored directly
 * on the user document.
 *
 * - Reads from a Convex `users.getMapFeatureFlags` subscription (real-time).
 * - Falls back to SecureStore cache (`map_features_v1`) when offline.
 * - Writes optimistically to local state + SecureStore, then fires the
 *   Convex mutation in the background.
 */
export function useMapFeatures() {
  const [flags, setFlags] = useState<MapFeatureFlags>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const initialLoadDone = useRef(false);

  const convexFlags = useQuery(api.users.getMapFeatureFlags);
  const setFlagsMutation = useMutation(api.users.setMapFeatureFlags);

  // Load cached flags from SecureStore on mount (offline-first)
  useEffect(() => {
    SecureStore.getItemAsync(CACHE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            setFlags({ ...DEFAULTS, ...JSON.parse(raw) });
          } catch {
            // corrupt cache — keep defaults
          }
        }
      })
      .finally(() => {
        initialLoadDone.current = true;
        setLoaded(true);
      });
  }, []);

  // Sync from Convex whenever server data arrives — overwrites local state
  useEffect(() => {
    if (convexFlags === undefined) return; // still loading
    if (convexFlags === null) return;      // unauthenticated
    const merged: MapFeatureFlags = { ...DEFAULTS, ...convexFlags };
    setFlags(merged);
    void SecureStore.setItemAsync(CACHE_KEY, JSON.stringify(merged));
  }, [convexFlags]);

  const setMapFeature = useCallback(
    async <K extends keyof MapFeatureFlags>(key: K, value: MapFeatureFlags[K]) => {
      const updated: MapFeatureFlags = { ...flags, [key]: value };
      // Optimistic update
      setFlags(updated);
      void SecureStore.setItemAsync(CACHE_KEY, JSON.stringify(updated));
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await setFlagsMutation({ [key]: value } as any);
      } catch {
        // Offline — local cache already updated; Convex will sync on reconnect
      }
    },
    [flags, setFlagsMutation],
  );

  return { mapFeatures: flags, setMapFeature, loaded };
}
