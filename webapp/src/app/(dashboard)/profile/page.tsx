'use client';

import { api } from '@convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function ProfilePage() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const updateProfile = useMutation(api.users.updateProfile);

  const [name, setName] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Populate fields once user data loads
  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name ?? '');
      setWeightInput(currentUser.weightKg !== undefined ? String(currentUser.weightKg) : '');
    }
  }, [currentUser]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    const weightKg = weightInput !== '' ? parseFloat(weightInput) : undefined;

    try {
      await updateProfile({
        name: name.trim() || undefined,
        weightKg: weightKg !== undefined && !isNaN(weightKg) ? weightKg : undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="absolute inset-0 flex items-start justify-center pt-8 px-4 pointer-events-none">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-200 pointer-events-auto overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-slate">Profile settings</h1>
            <Link
              href="/map"
              className="text-sm text-slate-light hover:text-slate transition-colors"
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-5">
          {/* Display name */}
          <div>
            <label className="block text-sm font-medium text-slate mb-1.5" htmlFor="profile-name">
              Display name
            </label>
            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              maxLength={80}
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:border-brand focus:bg-white focus:outline-none transition-colors text-slate placeholder:text-slate-400"
            />
          </div>

          {/* Weight */}
          <div>
            <label className="block text-sm font-medium text-slate mb-1.5" htmlFor="profile-weight">
              Body weight <span className="text-slate-light font-normal">(kg)</span>
            </label>
            <input
              id="profile-weight"
              type="number"
              value={weightInput}
              onChange={e => setWeightInput(e.target.value)}
              placeholder="e.g. 70"
              min={20}
              max={300}
              step={0.5}
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:border-brand focus:bg-white focus:outline-none transition-colors text-slate placeholder:text-slate-400"
            />
            <p className="mt-1.5 text-[11px] text-slate-light">
              Used to estimate calorie burn in the route planner. Not shared with anyone.
            </p>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving || currentUser === undefined}
              className="bg-brand hover:bg-brand-dark disabled:opacity-50 text-white font-semibold text-sm px-5 py-2 rounded-lg transition-colors shadow-sm"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {saved && (
              <span className="text-sm text-green-600 font-medium">Saved ✓</span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
