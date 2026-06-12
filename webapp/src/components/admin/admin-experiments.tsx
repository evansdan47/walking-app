'use client';

import { api } from '@convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import { useState } from 'react';

export function AdminExperiments() {
  const configs = useQuery(api.experiments.get, { key: 'walk_tagging_ui' });
  const summary = useQuery(api.experiments.adminGetSummary, { key: 'walk_tagging_ui' });
  const seed = useMutation(api.experiments.adminSeedDefaults);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSeed() {
    setBusy(true);
    setMessage(null);
    try {
      await seed({});
      setMessage('Experiment defaults seeded.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Seed failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Experiments</h1>
        <p className="text-sm text-gray-500 mt-1">Walk tagging UI and future A/B tests.</p>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={handleSeed}
        className="rounded-lg border border-gray-200 text-sm font-semibold px-3 py-2 hover:bg-gray-50 disabled:opacity-50"
      >
        Seed experiment defaults
      </button>
      {message && <p className="text-sm text-gray-600">{message}</p>}

      {configs && (
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-bold text-gray-900">walk_tagging_ui</h2>
          <p className="text-xs text-gray-500 mt-1">
            Enabled: {configs.enabled ? 'yes' : 'no'}
          </p>
        </section>
      )}

      {summary && (
        <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
          <h2 className="text-sm font-bold text-gray-900">Summary</h2>
          <pre className="text-[11px] text-gray-600 overflow-auto">
            {JSON.stringify(summary, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}
