'use client';

import { api } from '@convex/_generated/api';
import { useMutation } from 'convex/react';
import { useState } from 'react';

export function AdminReleases() {
  const seed = useMutation(api.appRelease.adminSeedDefaults);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSeed() {
    setBusy(true);
    setResult(null);
    try {
      const res = await seed({});
      setResult(`Seeded: ${res.inserted} inserted, ${res.updated} updated`);
    } catch (err) {
      setResult(err instanceof Error ? err.message : 'Seed failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Mobile releases</h1>
        <p className="text-sm text-gray-500 mt-1">
          Native build minimum and nudge thresholds. Full policy editing via Convex dashboard or{' '}
          <code className="text-xs">appRelease.adminUpdatePolicy</code> for now.
        </p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={handleSeed}
        className="rounded-lg border border-gray-200 text-sm font-semibold px-3 py-2 hover:bg-gray-50 disabled:opacity-50"
      >
        Seed default policies
      </button>
      {result && <p className="text-sm text-gray-600">{result}</p>}
    </div>
  );
}
