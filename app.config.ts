import { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dynamic Expo config that extends app.json with env-var-driven values.
 * app.json remains the source of truth for all static config.
 * This file adds plugins that require secrets from the environment.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  plugins: [
    ...(config.plugins as ExpoConfig['plugins'] ?? []),
    [
      '@rnmapbox/maps',
      {
        RNMapboxMapsImpl: 'mapbox',
        // Secret token is read directly from the RNMAPBOX_MAPS_DOWNLOAD__TOKEN
        // environment variable (note: double underscore). Set it in .env.local.
        // Using the env var avoids embedding the token in gradle.properties.
      },
    ],
  ],
} as ExpoConfig);
