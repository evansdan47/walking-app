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
