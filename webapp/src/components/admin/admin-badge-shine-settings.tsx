'use client';

import { BadgeHex } from '@/components/badges/badge-hex';
import {
  BADGE_SHINE_EFFECTS,
  DEFAULT_BADGE_SHINE_EFFECT,
  type BadgeShineEffect,
  isBadgeShineEffect,
} from '@/lib/badges/shine-effects';
import { api } from '@convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import { useEffect, useState } from 'react';

const PREVIEW_COLOR = '#2E7D32';

export function AdminBadgeShineSettings() {
  const settings = useQuery(api.badgeAdmin.getUiSettings);
  const updateSettings = useMutation(api.badgeAdmin.updateUiSettings);
  const [selected, setSelected] = useState<BadgeShineEffect>(DEFAULT_BADGE_SHINE_EFFECT);
  const [previewEffect, setPreviewEffect] = useState<BadgeShineEffect>(DEFAULT_BADGE_SHINE_EFFECT);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setSelected(settings.newBadgeShineEffect);
    setPreviewEffect(settings.newBadgeShineEffect);
  }, [settings]);

  async function handleSave() {
    setBusy(true);
    setSaved(false);
    try {
      await updateSettings({ newBadgeShineEffect: selected });
      setPreviewEffect(selected);
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  const dirty = settings !== undefined && selected !== settings.newBadgeShineEffect;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
      <div>
        <h2 className="text-sm font-bold text-gray-900">New badge shine</h2>
        <p className="text-xs text-gray-500 mt-1">
          Choose how newly earned badges shimmer in the gallery. Pick a style, preview it live, then
          save to apply for all users.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {BADGE_SHINE_EFFECTS.map((effect) => {
          const isSelected = selected === effect.id;
          return (
            <button
              key={effect.id}
              type="button"
              onClick={() => setSelected(effect.id)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                isSelected
                  ? 'border-brand bg-orange-50/60 ring-1 ring-brand/30'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 pt-1">
                  <BadgeHex
                    name=""
                    icon="award"
                    categoryColor={PREVIEW_COLOR}
                    tier="gold"
                    status="earned"
                    isNew
                    newShineEffect={effect.id}
                    size="sm"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-900">{effect.label}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{effect.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            Live preview
          </p>
          <p className="text-[11px] text-gray-600 mt-0.5">
            {BADGE_SHINE_EFFECTS.find((e) => e.id === previewEffect)?.label ?? 'Style'}
            {dirty ? ' (unsaved selection above)' : ''}
          </p>
        </div>
        <BadgeHex
          name="Badge Beginner"
          icon="award"
          categoryColor={PREVIEW_COLOR}
          tier="gold"
          status="earned"
          isNew
          newShineEffect={dirty ? selected : previewEffect}
          size="md"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || !dirty}
          onClick={() => void handleSave()}
          className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save shine style'}
        </button>
        {saved && !dirty && (
          <span className="text-xs text-emerald-700 font-medium">Saved — live for all users.</span>
        )}
        {settings && isBadgeShineEffect(settings.newBadgeShineEffect) && !dirty && (
          <span className="text-xs text-gray-400">
            Current:{' '}
            {BADGE_SHINE_EFFECTS.find((e) => e.id === settings.newBadgeShineEffect)?.label}
          </span>
        )}
      </div>
    </section>
  );
}
