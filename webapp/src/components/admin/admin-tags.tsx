'use client';

import { api } from '@convex/_generated/api';
import { useMutation } from 'convex/react';
import { useState } from 'react';

export function AdminTags() {
  const seed = useMutation(api.tags.seedTagDefinitions);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSeed() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await seed({});
      setMessage(`Tags seeded: ${JSON.stringify(res)}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Seed failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Tags</h1>
        <p className="text-sm text-gray-500 mt-1">
          Controlled vocabulary for walk and route tagging.
        </p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={handleSeed}
        className="rounded-lg border border-gray-200 text-sm font-semibold px-3 py-2 hover:bg-gray-50 disabled:opacity-50"
      >
        Seed tag definitions
      </button>
      {message && <p className="text-sm text-gray-600">{message}</p>}
    </div>
  );
}
