import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

export type PermissionStatus = 'undetermined' | 'granted' | 'denied';

export interface LocationPermissions {
  foreground: PermissionStatus;
  background: PermissionStatus;
  /** True once the initial system-permission check has resolved. */
  loaded: boolean;
  requestForeground: () => Promise<void>;
  requestBackground: () => Promise<void>;
}

function toStatus(status: Location.PermissionStatus): PermissionStatus {
  if (status === Location.PermissionStatus.GRANTED) return 'granted';
  if (status === Location.PermissionStatus.DENIED) return 'denied';
  return 'undetermined';
}

export function useLocationPermission(): LocationPermissions {
  const [foreground, setForeground] = useState<PermissionStatus>('undetermined');
  const [background, setBackground] = useState<PermissionStatus>('undetermined');
  const [loaded, setLoaded] = useState(false);

  // Read current system state on mount so the UI does not flash permission
  // gates on screens that were already granted.
  useEffect(() => {
    void (async () => {
      const { status: fg } = await Location.getForegroundPermissionsAsync();
      setForeground(toStatus(fg));
      if (fg === Location.PermissionStatus.GRANTED) {
        const { status: bg } = await Location.getBackgroundPermissionsAsync();
        setBackground(toStatus(bg));
      }
      setLoaded(true);
    })();
  }, []);

  async function requestForeground() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setForeground(toStatus(status));
  }

  async function requestBackground() {
    // Background must only be requested after foreground is granted.
    const { status } = await Location.requestBackgroundPermissionsAsync();
    setBackground(toStatus(status));
  }

  return { foreground, background, loaded, requestForeground, requestBackground };
}
