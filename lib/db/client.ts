import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('rambleio.db');

db.execSync(`
  PRAGMA journal_mode=WAL;

  CREATE TABLE IF NOT EXISTS walks (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT,
    status TEXT NOT NULL CHECK(status IN ('recording','paused','completed')),
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    device_id TEXT NOT NULL,
    stats_json TEXT,
    convex_id TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS track_points (
    id TEXT PRIMARY KEY NOT NULL,
    walk_id TEXT NOT NULL REFERENCES walks(id),
    timestamp INTEGER NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    altitude_metres REAL,
    speed_mps REAL,
    accuracy_metres REAL NOT NULL,
    is_clean INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_track_points_walk_ts ON track_points(walk_id, timestamp);

  CREATE TABLE IF NOT EXISTS walk_photos (
    id TEXT PRIMARY KEY NOT NULL,
    walk_id TEXT NOT NULL REFERENCES walks(id),
    timestamp INTEGER NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    local_uri TEXT NOT NULL,
    caption TEXT,
    convex_id TEXT,
    storage_id TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_walk_photos_walk_ts ON walk_photos(walk_id, timestamp);

  CREATE TABLE IF NOT EXISTS sync_jobs (
    id TEXT PRIMARY KEY NOT NULL,
    walk_id TEXT NOT NULL REFERENCES walks(id),
    device_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending','in_progress','completed','failed')),
    attempted_at INTEGER,
    error_message TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON sync_jobs(status);

  CREATE TABLE IF NOT EXISTS kv_store (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
`);

export { db };

// Schema migrations — ALTER TABLE silently fails if the column already exists,
// which is the correct behaviour for idempotent migrations.
try { db.execSync(`ALTER TABLE walk_photos ADD COLUMN heading REAL`); } catch {}

// sync_jobs: retry tracking columns added for exponential backoff and
// mid-upload checkpointing.
try { db.execSync(`ALTER TABLE sync_jobs ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0`); } catch {}
try { db.execSync(`ALTER TABLE sync_jobs ADD COLUMN next_attempt_at INTEGER NOT NULL DEFAULT 0`); } catch {}
try { db.execSync(`ALTER TABLE sync_jobs ADD COLUMN uploaded_point_count INTEGER NOT NULL DEFAULT 0`); } catch {}

// walks: live broadcast flag — true when user explicitly starts a live walk.
try { db.execSync(`ALTER TABLE walks ADD COLUMN is_live INTEGER NOT NULL DEFAULT 0`); } catch {}

// track_points: timestamp of when the point was successfully pushed to Convex
// during a live walk. NULL means not yet synced.
try { db.execSync(`ALTER TABLE track_points ADD COLUMN synced_at INTEGER`); } catch {}
try { db.execSync(`CREATE INDEX IF NOT EXISTS idx_track_points_unsynced ON track_points(walk_id, synced_at) WHERE synced_at IS NULL`); } catch {}

// Phase 13f: waypoints table for Save Point feature.
try {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS waypoints (
      id          TEXT PRIMARY KEY NOT NULL,
      walk_id     TEXT NOT NULL REFERENCES walks(id),
      timestamp   INTEGER NOT NULL,
      latitude    REAL NOT NULL,
      longitude   REAL NOT NULL,
      name        TEXT,
      type        TEXT,
      note        TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_waypoints_walk ON waypoints(walk_id);
  `);
} catch {}

// ─── Roadmap Phase 1: schema migrations ───────────────────────────────────────

// walks: privacy controls (visibility defaults private so nothing is accidentally
// shared), start/end trim for home-location protection, and versioned derived
// fields so algorithms can be rerun against historical walks.
try { db.execSync(`ALTER TABLE walks ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'`); } catch {}
try { db.execSync(`ALTER TABLE walks ADD COLUMN trim_start_m INTEGER NOT NULL DEFAULT 0`); } catch {}
try { db.execSync(`ALTER TABLE walks ADD COLUMN trim_end_m INTEGER NOT NULL DEFAULT 0`); } catch {}
try { db.execSync(`ALTER TABLE walks ADD COLUMN stats_version INTEGER`); } catch {}
try { db.execSync(`ALTER TABLE walks ADD COLUMN display_polyline_json TEXT`); } catch {}
try { db.execSync(`ALTER TABLE walks ADD COLUMN display_polyline_version INTEGER`); } catch {}

// walk_photos: OS asset URI (replaces local_uri), explicit upload status, and
// pre-computed nearest track point for fast review timeline positioning.
try { db.execSync(`ALTER TABLE walk_photos ADD COLUMN local_asset_uri TEXT`); } catch {}
try { db.execSync(`ALTER TABLE walk_photos ADD COLUMN photo_status TEXT NOT NULL DEFAULT 'local_only'`); } catch {}
  // CHECK values: 'local_only' | 'upload_pending' | 'uploaded' | 'upload_failed' | 'upload_skipped'
try { db.execSync(`ALTER TABLE walk_photos ADD COLUMN nearest_track_point_id TEXT`); } catch {}

// sync_jobs: separate core walk sync status from photo upload status so photo
// failures never block a walk from being shown as synced.
try { db.execSync(`ALTER TABLE sync_jobs ADD COLUMN core_sync_status TEXT NOT NULL DEFAULT 'pending'`); } catch {}
  // CHECK values: 'pending' | 'in_progress' | 'synced' | 'failed'
try { db.execSync(`ALTER TABLE sync_jobs ADD COLUMN photo_sync_status TEXT NOT NULL DEFAULT 'none'`); } catch {}
  // CHECK values: 'none' | 'pending' | 'partial' | 'synced' | 'failed'
try { db.execSync(`ALTER TABLE sync_jobs ADD COLUMN phase INTEGER NOT NULL DEFAULT 1`); } catch {}
  // 1 = create walk, 2 = upload points, 3 = upload photos, 4 = complete

// explore_routes: local cache of public planned routes, keyed by 2°×2° region
// cell so stale regions can be invalidated independently.
try {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS explore_routes (
      id                TEXT PRIMARY KEY NOT NULL,
      region_key        TEXT NOT NULL,
      title             TEXT NOT NULL,
      description       TEXT,
      author_id         TEXT NOT NULL,
      visibility        TEXT NOT NULL,
      distance_km       REAL,
      elevation_gain_m  REAL,
      centroid_lat      REAL NOT NULL,
      centroid_lng      REAL NOT NULL,
      legs_json         TEXT NOT NULL,
      created_at        INTEGER NOT NULL,
      cached_at         INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_explore_routes_region   ON explore_routes(region_key);
    CREATE INDEX IF NOT EXISTS idx_explore_routes_centroid ON explore_routes(centroid_lat, centroid_lng);
  `);
} catch {}

// explore_region_cache: tracks per-region sync state so the sync engine can
// skip Convex calls for recently-checked regions (TTL ~1 hour).
// All three data columns are nullable — NULL means the region has never been
// checked or fetched.
try {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS explore_region_cache (
      region_key      TEXT PRIMARY KEY NOT NULL,
      route_count     INTEGER NOT NULL DEFAULT 0,
      content_hash    TEXT,
      last_checked_at INTEGER,
      last_synced_at  INTEGER
    );
  `);
} catch {}

// app_logs: structured diagnostic log — written by the app's logger utility.
// Rows are automatically pruned to the most recent 500 entries.
try {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS app_logs (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      ts      INTEGER NOT NULL,
      level   TEXT    NOT NULL,
      tag     TEXT    NOT NULL,
      message TEXT    NOT NULL,
      stack   TEXT,
      context TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_app_logs_ts ON app_logs(ts DESC);
  `);
} catch {}

export function getKv(key: string): string | null {
  const row = db.getFirstSync<{ value: string }>(`SELECT value FROM kv_store WHERE key = ?`, key);
  return row?.value ?? null;
}

export function setKv(key: string, value: string): void {
  db.runSync(
    `INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    value,
  );
}
