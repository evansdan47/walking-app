import * as Location from 'expo-location';

import { BACKGROUND_LOCATION_TASK } from '@/lib/location/background-task';

const TRACKING_OPTIONS: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 5000,
  distanceInterval: 5,
  showsBackgroundLocationIndicator: true,
  pausesUpdatesAutomatically: false,
  foregroundService: {
    notificationTitle: 'Walk recording in progress',
    notificationBody: 'Tap to return to the app.',
    notificationColor: '#a43700',
  },
};

export function useLocationTask() {
  async function startTracking() {
    const isRunning = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
    );
    if (!isRunning) {
      await Location.startLocationUpdatesAsync(
        BACKGROUND_LOCATION_TASK,
        TRACKING_OPTIONS,
      );
    }
  }

  async function stopTracking() {
    const isRunning = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
    );
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  }

  return { startTracking, stopTracking };
}
