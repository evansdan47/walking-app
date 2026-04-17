import { Platform } from 'react-native';
import { getSdkStatus, initialize, SdkAvailabilityStatus } from 'react-native-health-connect';

/**
 * Initialises the Health Connect SDK.
 * Safe to call multiple times — subsequent calls are no-ops on Android.
 * Always returns false on non-Android platforms.
 */
export async function initializeHealthConnect(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    return await initialize();
  } catch {
    return false;
  }
}

/**
 * Returns true if Health Connect is installed and available on this device.
 * Returns false if the SDK is not installed or requires an update.
 */
export async function isHealthConnectAvailable(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const status = await getSdkStatus();
    return status === SdkAvailabilityStatus.SDK_AVAILABLE;
  } catch {
    return false;
  }
}

/**
 * Returns true if Health Connect needs to be installed or updated via Play Store.
 * The caller can use this to show a deep-link prompt to the user.
 */
export async function isHealthConnectUpdateRequired(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const status = await getSdkStatus();
    return status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED;
  } catch {
    return false;
  }
}
