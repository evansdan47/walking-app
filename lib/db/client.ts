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
