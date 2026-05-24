import { ConvexClient } from 'convex/browser';

/**
 * Imperative (non-React) Convex client for use by sync engines and other
 * code that runs outside React component trees.
 *
 * This client is unauthenticated — only use it for queries that return
 * public data (e.g. the Explore region sync). Authenticated mutations
 * should go through the ConvexReactClient provided by ConvexProviderWithAuth
 * in the component tree.
 */
export const convexClient = new ConvexClient(
  process.env.EXPO_PUBLIC_CONVEX_URL!,
);
