import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';

import { DEFAULT_ROUTE_COLOURS, type RouteColours } from '@/lib/review/route-display-modes';

const STORE_KEY = 'route_colours_v1';

function mergeWithDefaults(stored: Partial<RouteColours>): RouteColours {
  return { ...DEFAULT_ROUTE_COLOURS, ...stored };
}

export function useRouteColours() {
  const [colours, setColours] = useState<RouteColours>(DEFAULT_ROUTE_COLOURS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(STORE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            setColours(mergeWithDefaults(JSON.parse(raw) as Partial<RouteColours>));
          } catch {
            // corrupt — use defaults
          }
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  const setColour = useCallback(<K extends keyof RouteColours>(key: K, value: string) => {
    setColours((prev) => {
      const next = { ...prev, [key]: value };
      void SecureStore.setItemAsync(STORE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const resetColours = useCallback(() => {
    setColours(DEFAULT_ROUTE_COLOURS);
    void SecureStore.setItemAsync(STORE_KEY, JSON.stringify(DEFAULT_ROUTE_COLOURS));
  }, []);

  return { colours, loaded, setColour, resetColours };
}
