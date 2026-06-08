'use client';

import { api } from '@convex/_generated/api';
import { kgToLb, lbToKg, type DistanceUnit, type ElevationUnit, type WeightUnit } from '@/lib/format-units';
import { useMutation, useQuery } from 'convex/react';
import { useEffect, useState } from 'react';

function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-700 mb-2">{label}</p>
      <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-50 ${
              value === opt.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start justify-between gap-3 cursor-pointer">
      <div>
        <p className="text-xs font-medium text-gray-900">{label}</p>
        {description && <p className="text-[10px] text-gray-500 mt-0.5">{description}</p>}
      </div>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
      />
    </label>
  );
}

export function AccountMenuPreferences() {
  const prefs = useQuery(api.users.getPreferences);
  const updatePreferences = useMutation(api.users.updatePreferences);

  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('km');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [elevationUnit, setElevationUnit] = useState<ElevationUnit>('metres');
  const [weightInput, setWeightInput] = useState('');
  const [showCalories, setShowCalories] = useState(true);
  const [defaultMapView, setDefaultMapView] = useState<'terrain' | 'standard'>('terrain');
  const [defaultWalkVisibility, setDefaultWalkVisibility] = useState<'private' | 'public'>('private');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!prefs) return;
    setDistanceUnit(prefs.units?.distance ?? 'km');
    setWeightUnit(prefs.units?.weight ?? 'kg');
    setElevationUnit(prefs.units?.elevation ?? 'metres');
    const kg = prefs.profile?.weightKg;
    if (kg !== undefined) {
      const wUnit = prefs.units?.weight ?? 'kg';
      setWeightInput(
        wUnit === 'lb' ? kgToLb(kg).toFixed(1) : String(kg % 1 === 0 ? kg : kg.toFixed(1)),
      );
    } else {
      setWeightInput('');
    }
    setShowCalories(prefs.display?.showCalories ?? true);
    setDefaultMapView(prefs.display?.defaultMapView ?? 'terrain');
    setDefaultWalkVisibility(prefs.privacy?.defaultWalkVisibility ?? 'private');
  }, [prefs]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    let weightKg: number | undefined;
    if (weightInput.trim() !== '') {
      const parsed = parseFloat(weightInput);
      if (isNaN(parsed) || parsed <= 0) {
        setError('Enter a valid body weight.');
        setSaving(false);
        return;
      }
      weightKg = Math.round((weightUnit === 'lb' ? lbToKg(parsed) : parsed) * 10) / 10;
      if (weightKg < 20 || weightKg > 300) {
        setError('Weight must be between 20 and 300 kg (or equivalent).');
        setSaving(false);
        return;
      }
    }

    try {
      await updatePreferences({
        preferences: {
          units: { distance: distanceUnit, weight: weightUnit, elevation: elevationUnit },
          ...(weightKg !== undefined ? { profile: { weightKg } } : {}),
          display: { showCalories, defaultMapView },
          privacy: { defaultWalkVisibility },
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save preferences');
    } finally {
      setSaving(false);
    }
  }

  const loading = prefs === undefined;

  return (
    <form onSubmit={(e) => void handleSave(e)} className="space-y-5">
      <div>
        <h2 className="text-sm font-bold text-gray-900">Preferences</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Units and display settings sync across the web app.
        </p>
      </div>

      <SegmentedControl
        label="Distance units"
        value={distanceUnit}
        options={[
          { value: 'km', label: 'Kilometres' },
          { value: 'miles', label: 'Miles' },
        ]}
        onChange={setDistanceUnit}
        disabled={loading || saving}
      />

      <SegmentedControl
        label="Elevation units"
        value={elevationUnit}
        options={[
          { value: 'metres', label: 'Metres' },
          { value: 'feet', label: 'Feet' },
        ]}
        onChange={setElevationUnit}
        disabled={loading || saving}
      />

      <SegmentedControl
        label="Weight units"
        value={weightUnit}
        options={[
          { value: 'kg', label: 'Kilograms' },
          { value: 'lb', label: 'Pounds' },
        ]}
        onChange={(unit) => {
          setWeightUnit(unit);
          if (weightInput.trim() === '') return;
          const parsed = parseFloat(weightInput);
          if (isNaN(parsed)) return;
          const kg = weightUnit === 'lb' ? lbToKg(parsed) : parsed;
          setWeightInput(
            unit === 'lb' ? kgToLb(kg).toFixed(1) : String(kg % 1 === 0 ? kg : kg.toFixed(1)),
          );
        }}
        disabled={loading || saving}
      />

      <div>
        <label htmlFor="pref-weight" className="block text-xs font-medium text-gray-700 mb-1.5">
          Body weight <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            id="pref-weight"
            type="number"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            placeholder={weightUnit === 'kg' ? 'e.g. 70' : 'e.g. 154'}
            min={weightUnit === 'kg' ? 20 : 44}
            max={weightUnit === 'kg' ? 300 : 660}
            step={0.5}
            disabled={loading || saving}
            className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:border-brand focus:bg-white focus:outline-none"
          />
          <span className="text-xs text-gray-500 w-6">{weightUnit}</span>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5">
          Used to estimate calorie burn in the route planner. Not shared with anyone.
        </p>
      </div>

      <div className="space-y-3 pt-1 border-t border-gray-100">
        <p className="text-xs font-medium text-gray-700">Display</p>
        <ToggleRow
          label="Show calorie estimates"
          description="Energy burn on planned routes"
          checked={showCalories}
          onChange={setShowCalories}
          disabled={loading || saving}
        />
        <SegmentedControl
          label="Default map style"
          value={defaultMapView}
          options={[
            { value: 'terrain', label: 'Terrain' },
            { value: 'standard', label: 'Standard' },
          ]}
          onChange={setDefaultMapView}
          disabled={loading || saving}
        />
      </div>

      <div className="space-y-3 pt-1 border-t border-gray-100">
        <p className="text-xs font-medium text-gray-700">Privacy</p>
        <SegmentedControl
          label="Default walk visibility"
          value={defaultWalkVisibility}
          options={[
            { value: 'private', label: 'Private' },
            { value: 'public', label: 'Public' },
          ]}
          onChange={setDefaultWalkVisibility}
          disabled={loading || saving}
        />
      </div>

      {error && (
        <p className="text-xs text-red-600" role="alert">{error}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading || saving}
          className="bg-brand hover:bg-brand-dark disabled:opacity-50 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
        >
          {saving ? 'Saving…' : 'Save preferences'}
        </button>
        {saved && <span className="text-xs text-green-600 font-medium">Saved</span>}
      </div>
    </form>
  );
}
