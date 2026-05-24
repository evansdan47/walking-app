/**
 * Lightweight structured logger that persists entries to SQLite.
 *
 * Usage:
 *   import { appLog } from '@/lib/diagnostics/logger';
 *   appLog('error', 'sync', 'Upload failed', err, { walkId });
 *
 * All functions are safe to call anywhere — they will never throw even if the
 * database is unavailable.
 */
import { db } from '../db/client';

export type LogLevel = 'error' | 'warn' | 'info';

export interface AppLogEntry {
  id: number;
  ts: number;
  level: LogLevel;
  tag: string;
  message: string;
  stack: string | null;
  context: string | null;
}

/** Maximum number of log rows retained. Oldest rows beyond this are pruned. */
const MAX_LOGS = 500;

/**
 * Write a log entry to the app_logs table.
 *
 * @param level   Severity: 'error' | 'warn' | 'info'
 * @param tag     Short module identifier, e.g. 'sync', 'location', 'session'
 * @param message Human-readable description
 * @param error   Optional Error instance — its stack is stored separately
 * @param context Optional key/value bag for structured context (walkId, phase, etc.)
 */
export function appLog(
  level: LogLevel,
  tag: string,
  message: string,
  error?: unknown,
  context?: Record<string, unknown>,
): void {
  try {
    const stack =
      error instanceof Error
        ? (error.stack ?? error.message ?? null)
        : error != null
          ? String(error)
          : null;
    const contextJson = context ? JSON.stringify(context) : null;

    db.runSync(
      `INSERT INTO app_logs (ts, level, tag, message, stack, context)
       VALUES (?, ?, ?, ?, ?, ?)`,
      Date.now(),
      level,
      tag,
      message,
      stack,
      contextJson,
    );

    // Prune to keep only the most recent MAX_LOGS entries.
    db.runSync(
      `DELETE FROM app_logs
       WHERE id NOT IN (
         SELECT id FROM app_logs ORDER BY ts DESC LIMIT ?
       )`,
      MAX_LOGS,
    );
  } catch {
    // Never let logging crash the app.
  }
}

/** Read all log entries, newest first. Returns [] if anything goes wrong. */
export function getLogs(): AppLogEntry[] {
  try {
    return db.getAllSync<AppLogEntry>(
      `SELECT id, ts, level, tag, message, stack, context
       FROM app_logs
       ORDER BY ts DESC`,
    );
  } catch {
    return [];
  }
}

/** Delete all stored log entries. */
export function clearLogs(): void {
  try {
    db.runSync(`DELETE FROM app_logs`);
  } catch {}
}

/** Count of stored log entries. */
export function getLogCount(): number {
  try {
    const row = db.getFirstSync<{ n: number }>(`SELECT COUNT(*) as n FROM app_logs`);
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}
