'use client';

import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDistance(metres: number) {
  const km = metres / 1000;
  return km >= 1 ? `${km.toFixed(1)} km` : `${metres.toFixed(0)} m`;
}

function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m`;
}

export default function WalksPage() {
  const walks = useQuery(api.walks.listForCurrentUser);

  if (walks === undefined) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400 text-sm">
        Loading walks…
      </div>
    );
  }

  if (walks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <p className="text-gray-500 font-medium">No walks yet</p>
        <p className="text-gray-400 text-sm">
          Record walks in the mobile app and sync them to see them here.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Your Walks</h1>
      <ul className="flex flex-col gap-3">
        {walks.map((walk) => (
          <li key={walk._id}>
            <a
              href={`/walks/${walk._id}`}
              className="block bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-orange-300 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate group-hover:text-orange-700 transition-colors">
                    {walk.title ?? formatDate(walk.startedAt)}
                  </p>
                  {walk.title && (
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(walk.startedAt)}</p>
                  )}
                </div>
                {walk.stats && (
                  <div className="flex gap-3 shrink-0 text-sm">
                    <span className="bg-orange-50 text-orange-700 font-medium px-2.5 py-0.5 rounded-full text-xs">
                      {formatDistance(walk.stats.distanceMetres)}
                    </span>
                    <span className="bg-gray-100 text-gray-500 font-medium px-2.5 py-0.5 rounded-full text-xs">
                      {formatDuration(walk.stats.durationSeconds)}
                    </span>
                  </div>
                )}
              </div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
