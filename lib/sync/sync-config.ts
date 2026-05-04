/**
 * Centralised configuration for the walk sync system.
 *
 * Adjust constants here to tune retry behaviour without touching business
 * logic. All time values are in milliseconds unless noted otherwise.
 */

/** How often the periodic retry timer fires (foreground only). Default: 10 minutes. */
export const SYNC_RETRY_INTERVAL_MS = 10 * 60 * 1_000;

/** Maximum number of upload attempts before a job is permanently abandoned. */
export const MAX_SYNC_RETRIES = 5;

/**
 * Base delay for exponential backoff between retries.
 * Delay after attempt N = min(SYNC_BACKOFF_BASE_MS × 2^N, SYNC_BACKOFF_MAX_MS).
 * Default: 1 minute.
 */
export const SYNC_BACKOFF_BASE_MS = 60 * 1_000;

/** Upper cap for exponential backoff. Default: 1 hour. */
export const SYNC_BACKOFF_MAX_MS = 60 * 60 * 1_000;

/** Number of track points per Convex mutation batch. */
export const SYNC_BATCH_SIZE = 500;

/**
 * How often the live-sync timer flushes unsynced points to Convex during an
 * active Live Broadcast walk. Only fires while the app is in the foreground.
 * Default: 15 seconds.
 */
export const LIVE_SYNC_INTERVAL_MS = 15 * 1_000;
