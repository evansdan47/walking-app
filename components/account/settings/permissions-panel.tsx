import { Pedometer } from 'expo-sensors';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { PermissionRow, type PermStatus } from '@/components/account/settings/permission-row';
import { Spacing } from '@/constants/theme';
import { useLocationPermission } from '@/hooks/use-location-permission';
import {
  checkHealthConnectPermissions,
  isHealthConnectAvailable,
  requestHealthConnectPermissions,
} from '@/lib/health-connect';

export function PermissionsPanel() {
  const location = useLocationPermission();
  const [pedometerStatus, setPedometerStatus] = useState<PermStatus>('undetermined');
  const [hcAvailable, setHcAvailable] = useState(false);
  const [hcStatus, setHcStatus] = useState<PermStatus>('undetermined');

  useEffect(() => {
    void Pedometer.getPermissionsAsync().then((p) => {
      setPedometerStatus(p.granted ? 'granted' : p.status === 'denied' ? 'denied' : 'undetermined');
    });
    void isHealthConnectAvailable().then(async (avail) => {
      setHcAvailable(avail);
      if (avail) {
        const granted = await checkHealthConnectPermissions();
        setHcStatus(granted?.readSteps ? 'granted' : 'undetermined');
      } else {
        setHcStatus('unavailable');
      }
    });
  }, []);

  const requestPedometer = useCallback(async () => {
    const result = await Pedometer.requestPermissionsAsync();
    setPedometerStatus(result.granted ? 'granted' : 'denied');
  }, []);

  const requestHC = useCallback(async () => {
    await requestHealthConnectPermissions();
    const granted = await checkHealthConnectPermissions();
    setHcStatus(granted?.readSteps ? 'granted' : 'denied');
  }, []);

  const locationFg: PermStatus = !location.loaded ? 'undetermined' : location.foreground;
  const locationBg: PermStatus = !location.loaded ? 'undetermined' : location.background;

  return (
    <View style={{ gap: Spacing.sm }}>
      <PermissionRow
        label="Location (foreground)"
        sublabel="Required for GPS walk recording"
        status={locationFg}
        {...(locationFg !== 'granted' && { onRequest: () => { void location.requestForeground(); } })}
      />
      <PermissionRow
        label="Location (background)"
        sublabel="Track walks with screen off"
        status={locationFg === 'granted' ? locationBg : 'unavailable'}
        {...(locationFg === 'granted' && locationBg !== 'granted' && {
          onRequest: () => { void location.requestBackground(); },
        })}
      />
      <PermissionRow
        label="Step counter"
        sublabel="Counts steps via device pedometer"
        status={pedometerStatus}
        {...(pedometerStatus !== 'granted' && { onRequest: requestPedometer })}
      />
      {hcAvailable ? (
        <PermissionRow
          label="Health Connect"
          sublabel="Steps, heart rate & calorie data"
          status={hcStatus}
          {...(hcStatus !== 'granted' && hcStatus !== 'unavailable' && { onRequest: requestHC })}
        />
      ) : null}
    </View>
  );
}
