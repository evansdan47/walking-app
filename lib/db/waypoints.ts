import { randomUUID } from 'expo-crypto';

import { db } from './client';

export type WaypointType = 'scenic_view' | 'summit' | 'rest_stop' | 'hazard' | 'other';

export interface Waypoint {
  id: string;
  walkId: string;
  timestamp: number;
  latitude: number;
  longitude: number;
  name: string | null;
  type: WaypointType | null;
  note: string | null;
}

type WaypointRow = {
  id: string;
  walk_id: string;
  timestamp: number;
  latitude: number;
  longitude: number;
  name: string | null;
  type: string | null;
  note: string | null;
};

function rowToWaypoint(row: WaypointRow): Waypoint {
  return {
    id: row.id,
    walkId: row.walk_id,
    timestamp: row.timestamp,
    latitude: row.latitude,
    longitude: row.longitude,
    name: row.name,
    type: row.type as WaypointType | null,
    note: row.note,
  };
}

export function insertWaypoint(params: {
  walkId: string;
  latitude: number;
  longitude: number;
  name?: string | null;
  type?: WaypointType | null;
  note?: string | null;
}): Waypoint {
  const waypoint: Waypoint = {
    id: randomUUID(),
    walkId: params.walkId,
    timestamp: Date.now(),
    latitude: params.latitude,
    longitude: params.longitude,
    name: params.name ?? null,
    type: params.type ?? null,
    note: params.note ?? null,
  };
  db.runSync(
    `INSERT INTO waypoints (id, walk_id, timestamp, latitude, longitude, name, type, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    waypoint.id,
    waypoint.walkId,
    waypoint.timestamp,
    waypoint.latitude,
    waypoint.longitude,
    waypoint.name,
    waypoint.type,
    waypoint.note,
  );
  return waypoint;
}

export function getWaypointsForWalk(walkId: string): Waypoint[] {
  const rows = db.getAllSync<WaypointRow>(
    `SELECT * FROM waypoints WHERE walk_id = ? ORDER BY timestamp ASC`,
    walkId,
  );
  return rows.map(rowToWaypoint);
}
