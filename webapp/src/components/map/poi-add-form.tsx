'use client';

import { useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PlaceType =
  | 'landmark'
  | 'viewpoint'
  | 'food_drink'
  | 'parking'
  | 'toilet'
  | 'facility'
  | 'hazard'
  | 'wildlife'
  | 'nature_reserve'
  | 'navigation'
  | 'accommodation';

export type PlaceRole =
  | 'start'
  | 'end'
  | 'nearby'
  | 'highlight'
  | 'refreshment_stop'
  | 'warning'
  | 'navigation_cue';

export type PlaceVisibility = 'private' | 'community';

export interface PendingPoi {
  lngLat: { lng: number; lat: number };
  type: PlaceType;
  name?: string;
  details?: Record<string, unknown>;
  visibility: PlaceVisibility;
  /** Approximate distance from the route start, metres. */
  distanceFromStartMetres?: number;
  order?: number;
}

// ── Metadata ──────────────────────────────────────────────────────────────────

const PLACE_TYPES: { type: PlaceType; label: string; emoji: string }[] = [
  { type: 'parking',       label: 'Parking',      emoji: '🚗' },
  { type: 'toilet',        label: 'Toilet',       emoji: '🚻' },
  { type: 'food_drink',    label: 'Food & drink', emoji: '☕' },
  { type: 'viewpoint',     label: 'Viewpoint',    emoji: '👁' },
  { type: 'landmark',      label: 'Landmark',     emoji: '🏛' },
  { type: 'wildlife',      label: 'Wildlife',     emoji: '🐾' },
  { type: 'nature_reserve',label: 'Nature reserve',emoji: '🌿' },
  { type: 'hazard',        label: 'Hazard',       emoji: '⚠️' },
  { type: 'facility',      label: 'Facility',     emoji: '🏪' },
  { type: 'navigation',    label: 'Navigation',   emoji: '📍' },
  { type: 'accommodation', label: 'Accommodation',emoji: '🏠' },
];

export const PLACE_TYPE_META: Record<PlaceType, { label: string; emoji: string }> = Object.fromEntries(
  PLACE_TYPES.map(({ type, label, emoji }) => [type, { label, emoji }]),
) as Record<PlaceType, { label: string; emoji: string }>;

// ── Sub-forms ─────────────────────────────────────────────────────────────────

function ToiletFields({ details, onChange }: {
  details: Record<string, unknown>;
  onChange: (d: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm text-slate">
        <input type="checkbox" checked={!!details.accessible} onChange={e => onChange({ ...details, accessible: e.target.checked })} className="rounded" />
        Accessible (wheelchair)
      </label>
      <label className="flex items-center gap-2 text-sm text-slate">
        <input type="checkbox" checked={!!details.babyChanging} onChange={e => onChange({ ...details, babyChanging: e.target.checked })} className="rounded" />
        Baby changing
      </label>
      <label className="flex items-center gap-2 text-sm text-slate">
        <input type="checkbox" checked={!!details.seasonalOpening} onChange={e => onChange({ ...details, seasonalOpening: e.target.checked })} className="rounded" />
        Seasonal opening only
      </label>
    </div>
  );
}

function ParkingFields({ details, onChange }: {
  details: Record<string, unknown>;
  onChange: (d: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex gap-4">
        <label className="flex items-center gap-1.5 text-sm text-slate">
          <input type="radio" name="paidParking" checked={details.paidParking === false} onChange={() => onChange({ ...details, paidParking: false })} />
          Free
        </label>
        <label className="flex items-center gap-1.5 text-sm text-slate">
          <input type="radio" name="paidParking" checked={details.paidParking === true} onChange={() => onChange({ ...details, paidParking: true })} />
          Paid
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-light uppercase tracking-wide">Approx. spaces</span>
        <input
          type="number"
          min={1}
          value={(details.capacity as number | undefined) ?? ''}
          onChange={e => onChange({ ...details, capacity: e.target.value ? Number(e.target.value) : undefined })}
          placeholder="e.g. 20"
          className="w-28 rounded border border-gray-200 px-2 py-1 text-sm"
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-slate">
        <input type="checkbox" checked={!!details.heightRestriction} onChange={e => onChange({ ...details, heightRestriction: e.target.checked })} className="rounded" />
        Height restriction
      </label>
    </div>
  );
}

function FoodFields({ details, onChange }: {
  details: Record<string, unknown>;
  onChange: (d: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm text-slate">
        <input type="checkbox" checked={!!details.dogFriendly} onChange={e => onChange({ ...details, dogFriendly: e.target.checked })} className="rounded" />
        Dog friendly
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-light uppercase tracking-wide">Opening hours</span>
        <input
          type="text"
          value={(details.openingHours as string | undefined) ?? ''}
          onChange={e => onChange({ ...details, openingHours: e.target.value || undefined })}
          placeholder="e.g. Mon–Sat 9am–5pm"
          className="rounded border border-gray-200 px-2 py-1 text-sm"
        />
      </label>
    </div>
  );
}

function WildlifeFields({ details, onChange }: {
  details: Record<string, unknown>;
  onChange: (d: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-light uppercase tracking-wide">Species</span>
        <input
          type="text"
          value={(details.speciesText as string | undefined) ?? ''}
          onChange={e => onChange({ ...details, speciesText: e.target.value || undefined, species: e.target.value ? e.target.value.split(',').map(s => s.trim()).filter(Boolean) : undefined })}
          placeholder="e.g. Grey seals, puffins"
          className="rounded border border-gray-200 px-2 py-1 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-light uppercase tracking-wide">Best season</span>
        <input
          type="text"
          value={(details.bestTimeOfYear as string | undefined) ?? ''}
          onChange={e => onChange({ ...details, bestTimeOfYear: e.target.value || undefined })}
          placeholder="e.g. Sep–Dec"
          className="rounded border border-gray-200 px-2 py-1 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-light uppercase tracking-wide">Disturbance warning</span>
        <input
          type="text"
          value={(details.disturbanceWarning as string | undefined) ?? ''}
          onChange={e => onChange({ ...details, disturbanceWarning: e.target.value || undefined })}
          placeholder="e.g. Keep 30m from colony"
          className="rounded border border-gray-200 px-2 py-1 text-sm"
        />
      </label>
    </div>
  );
}

function HazardFields({ details, onChange }: {
  details: Record<string, unknown>;
  onChange: (d: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-light uppercase tracking-wide">Severity</span>
        <div className="flex gap-3">
          {(['low', 'medium', 'high'] as const).map(s => (
            <label key={s} className="flex items-center gap-1.5 text-sm text-slate capitalize">
              <input type="radio" name="hazardSeverity" checked={details.hazardSeverity === s} onChange={() => onChange({ ...details, hazardSeverity: s })} />
              {s}
            </label>
          ))}
        </div>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-light uppercase tracking-wide">Advice</span>
        <input
          type="text"
          value={(details.hazardAdvice as string | undefined) ?? ''}
          onChange={e => onChange({ ...details, hazardAdvice: e.target.value || undefined })}
          placeholder="e.g. Steep cliff edge, no fence"
          className="rounded border border-gray-200 px-2 py-1 text-sm"
        />
      </label>
    </div>
  );
}

function GenericNoteField({ details, onChange }: {
  details: Record<string, unknown>;
  onChange: (d: Record<string, unknown>) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-slate-light uppercase tracking-wide">Notes</span>
      <textarea
        rows={2}
        value={(details.note as string | undefined) ?? ''}
        onChange={e => onChange({ ...details, note: e.target.value || undefined })}
        placeholder="Optional notes…"
        className="rounded border border-gray-200 px-2 py-1 text-sm resize-none"
      />
    </label>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

interface AddPoiFormProps {
  lngLat: { lng: number; lat: number };
  onSave: (poi: PendingPoi) => void;
  onCancel: () => void;
}

export function AddPoiForm({ lngLat, onSave, onCancel }: AddPoiFormProps) {
  const [type, setType] = useState<PlaceType | null>(null);
  const [name, setName] = useState('');
  const [details, setDetails] = useState<Record<string, unknown>>({});
  const [visibility, setVisibility] = useState<PlaceVisibility>('community');

  function handleSave() {
    if (!type) return;
    // Strip internal working keys (e.g. speciesText) from persisted details
    const { speciesText: _st, ...cleanDetails } = details as Record<string, unknown> & { speciesText?: string };
    const hasDetails = Object.values(cleanDetails).some(v => v !== undefined);
    onSave({
      lngLat,
      type,
      name: name.trim() || undefined,
      details: hasDetails ? cleanDetails : undefined,
      visibility,
    });
  }

  return (
    <div className="bg-white rounded-xl shadow-lg w-72 p-4 space-y-4">
      <h3 className="text-sm font-semibold text-slate">Add point of interest</h3>

      {/* Type grid */}
      <div>
        <p className="text-xs text-slate-light uppercase tracking-wide mb-2">What is here?</p>
        <div className="grid grid-cols-3 gap-1.5">
          {PLACE_TYPES.map(({ type: t, label, emoji }) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[10px] leading-tight transition-colors ${
                type === t
                  ? 'bg-active/10 ring-1 ring-active text-active font-semibold'
                  : 'bg-gray-50 text-slate hover:bg-gray-100'
              }`}
            >
              <span className="text-base leading-none">{emoji}</span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Name */}
      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-light uppercase tracking-wide">Name <span className="normal-case font-normal">(optional)</span></span>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={type ? `e.g. ${PLACE_TYPE_META[type].label}` : 'Optional name…'}
          className="rounded border border-gray-200 px-2 py-1 text-sm"
        />
      </label>

      {/* Type-specific quick fields */}
      {type === 'toilet'        && <ToiletFields   details={details} onChange={setDetails} />}
      {type === 'parking'       && <ParkingFields  details={details} onChange={setDetails} />}
      {type === 'food_drink'    && <FoodFields     details={details} onChange={setDetails} />}
      {type === 'wildlife'      && <WildlifeFields details={details} onChange={setDetails} />}
      {type === 'hazard'        && <HazardFields   details={details} onChange={setDetails} />}
      {type !== null && !['toilet','parking','food_drink','wildlife','hazard'].includes(type) && (
        <GenericNoteField details={details} onChange={setDetails} />
      )}

      {/* Visibility */}
      <div>
        <p className="text-xs text-slate-light uppercase tracking-wide mb-1.5">Visibility</p>
        <div className="space-y-1">
          <label className="flex items-start gap-2 text-sm text-slate">
            <input type="radio" name="poi-vis" checked={visibility === 'private'} onChange={() => setVisibility('private')} className="mt-0.5" />
            <span>
              <span className="font-medium">Just for this walk</span>
              <span className="block text-xs text-slate-light">Only you can see it</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate">
            <input type="radio" name="poi-vis" checked={visibility === 'community'} onChange={() => setVisibility('community')} className="mt-0.5" />
            <span>
              <span className="font-medium">Share with community</span>
              <span className="block text-xs text-slate-light">Others can confirm and use it</span>
            </span>
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={!type}
          className="flex-1 rounded-lg bg-active px-3 py-2 text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-active/90 transition-colors"
        >
          Add POI
        </button>
        <button
          onClick={onCancel}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-slate hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
