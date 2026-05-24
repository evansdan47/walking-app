import { db } from './client';

export interface WalkStatusCount { status: string; count: number }
export interface PhotoStatusCount { status: string; count: number }
export interface SyncJobStatusCount { status: string; count: number }

export interface DbDebugStats {
  dbSizeBytes: number;
  walkCounts: WalkStatusCount[];
  totalWalks: number;
  trackPointCount: number;
  waypointCount: number;
  photoCounts: PhotoStatusCount[];
  totalPhotos: number;
  syncJobCounts: SyncJobStatusCount[];
  totalSyncJobs: number;
  exploreRoutesCount: number;
  exploreRegionCacheCount: number;
  appLogCount: number;
  kvEntryCount: number;
}

export function getDbDebugStats(): DbDebugStats {
  const pageCountRow = db.getFirstSync<{ page_count: number }>('PRAGMA page_count');
  const pageSizeRow  = db.getFirstSync<{ page_size: number }>('PRAGMA page_size');
  const dbSizeBytes  = (pageCountRow?.page_count ?? 0) * (pageSizeRow?.page_size ?? 4096);

  const walkRows = db.getAllSync<{ status: string; cnt: number }>(
    'SELECT status, COUNT(*) as cnt FROM walks GROUP BY status',
  );
  const walkCounts = walkRows.map(r => ({ status: r.status, count: r.cnt }));
  const totalWalks = walkCounts.reduce((s, r) => s + r.count, 0);

  const tpRow = db.getFirstSync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM track_points');
  const trackPointCount = tpRow?.cnt ?? 0;

  const wpRow = db.getFirstSync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM waypoints');
  const waypointCount = wpRow?.cnt ?? 0;

  const photoRows = db.getAllSync<{ photo_status: string; cnt: number }>(
    'SELECT photo_status, COUNT(*) as cnt FROM walk_photos GROUP BY photo_status',
  );
  const photoCounts = photoRows.map(r => ({ status: r.photo_status, count: r.cnt }));
  const totalPhotos = photoCounts.reduce((s, r) => s + r.count, 0);

  const syncJobRows = db.getAllSync<{ status: string; cnt: number }>(
    'SELECT status, COUNT(*) as cnt FROM sync_jobs GROUP BY status',
  );
  const syncJobCounts = syncJobRows.map(r => ({ status: r.status, count: r.cnt }));
  const totalSyncJobs = syncJobCounts.reduce((s, r) => s + r.count, 0);

  const erRow  = db.getFirstSync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM explore_routes');
  const ercRow = db.getFirstSync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM explore_region_cache');
  const alRow  = db.getFirstSync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM app_logs');
  const kvRow  = db.getFirstSync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM kv_store');

  return {
    dbSizeBytes,
    walkCounts,
    totalWalks,
    trackPointCount,
    waypointCount,
    photoCounts,
    totalPhotos,
    syncJobCounts,
    totalSyncJobs,
    exploreRoutesCount:      erRow?.cnt  ?? 0,
    exploreRegionCacheCount: ercRow?.cnt ?? 0,
    appLogCount:             alRow?.cnt  ?? 0,
    kvEntryCount:            kvRow?.cnt  ?? 0,
  };
}
