import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';

import { SegmentedControl } from '@/components/account/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDisplayPreferences } from '@/hooks/use-display-preferences';
import {
  kgToLb,
  lbToKg,
  type DistanceUnit,
  type ElevationUnit,
  type WeightUnit,
} from '@/lib/format-units';

export function PreferencesScreenContent() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { loaded, preferences, updatePreferences } = useDisplayPreferences();

  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('km');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [elevationUnit, setElevationUnit] = useState<ElevationUnit>('metres');
  const [weightInput, setWeightInput] = useState('');
  const [showCalories, setShowCalories] = useState(true);
  const [defaultMapView, setDefaultMapView] = useState<'terrain' | 'standard'>('terrain');
  const [defaultWalkVisibility, setDefaultWalkVisibility] = useState<'private' | 'public'>(
    'private',
  );

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) return;
    setDistanceUnit(preferences.distanceUnit);
    setWeightUnit(preferences.weightUnit);
    setElevationUnit(preferences.elevationUnit);
    const kg = preferences.bodyWeightKg;
    if (kg != null) {
      setWeightInput(
        preferences.weightUnit === 'lb'
          ? kgToLb(kg).toFixed(1)
          : String(kg % 1 === 0 ? kg : kg.toFixed(1)),
      );
    } else {
      setWeightInput('');
    }
    setShowCalories(preferences.showCalories);
    setDefaultMapView(preferences.defaultMapView);
    setDefaultWalkVisibility(preferences.defaultWalkVisibility);
  }, [loaded, preferences]);

  async function handleSave() {
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

  function handleWeightUnitChange(unit: WeightUnit) {
    setWeightUnit(unit);
    if (weightInput.trim() === '') return;
    const parsed = parseFloat(weightInput);
    if (isNaN(parsed)) return;
    const kg = weightUnit === 'lb' ? lbToKg(parsed) : parsed;
    setWeightInput(
      unit === 'lb' ? kgToLb(kg).toFixed(1) : String(kg % 1 === 0 ? kg : kg.toFixed(1)),
    );
  }

  if (!loaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View>
        <ThemedText type="bodySemiBold">Preferences</ThemedText>
        <ThemedText type="caption" style={{ color: colors.textMuted, marginTop: 2 }}>
          Units and display settings sync across the web app.
        </ThemedText>
      </View>

      <SegmentedControl
        label="Distance units"
        value={distanceUnit}
        options={[
          { value: 'km', label: 'Kilometres' },
          { value: 'miles', label: 'Miles' },
        ]}
        onChange={setDistanceUnit}
        disabled={saving}
      />

      <SegmentedControl
        label="Elevation units"
        value={elevationUnit}
        options={[
          { value: 'metres', label: 'Metres' },
          { value: 'feet', label: 'Feet' },
        ]}
        onChange={setElevationUnit}
        disabled={saving}
      />

      <SegmentedControl
        label="Weight units"
        value={weightUnit}
        options={[
          { value: 'kg', label: 'Kilograms' },
          { value: 'lb', label: 'Pounds' },
        ]}
        onChange={handleWeightUnitChange}
        disabled={saving}
      />

      <View>
        <ThemedText type="bodyMed" style={styles.fieldLabel}>
          Body weight <ThemedText style={{ color: colors.textMuted }}>(optional)</ThemedText>
        </ThemedText>
        <View
          style={[
            styles.weightRow,
            { borderColor: colors.border, backgroundColor: colors.backgroundCard },
          ]}
        >
          <TextInput
            style={[styles.weightInput, { color: colors.text }]}
            value={weightInput}
            onChangeText={setWeightInput}
            keyboardType="decimal-pad"
            placeholder={weightUnit === 'kg' ? 'e.g. 70' : 'e.g. 154'}
            placeholderTextColor={colors.textMuted}
            editable={!saving}
          />
          <ThemedText type="caption" style={{ color: colors.textMuted }}>
            {weightUnit}
          </ThemedText>
        </View>
        <ThemedText type="caption" style={{ color: colors.textMuted, marginTop: Spacing.xs }}>
          Used to estimate calorie burn. Not shared with anyone.
        </ThemedText>
      </View>

      <View style={[styles.section, { borderTopColor: colors.border }]}>
        <ThemedText type="bodyMed" style={styles.sectionTitle}>
          Display
        </ThemedText>
        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <ThemedText type="body">Show calorie estimates</ThemedText>
            <ThemedText type="caption" style={{ color: colors.textMuted }}>
              Energy burn on planned routes
            </ThemedText>
          </View>
          <Switch
            value={showCalories}
            onValueChange={setShowCalories}
            disabled={saving}
            trackColor={{ false: colors.border, true: colors.primaryMuted }}
            thumbColor={showCalories ? colors.primary : colors.backgroundMuted}
          />
        </View>
        <SegmentedControl
          label="Default map style"
          value={defaultMapView}
          options={[
            { value: 'terrain', label: 'Terrain' },
            { value: 'standard', label: 'Standard' },
          ]}
          onChange={setDefaultMapView}
          disabled={saving}
        />
      </View>

      <View style={[styles.section, { borderTopColor: colors.border }]}>
        <ThemedText type="bodyMed" style={styles.sectionTitle}>
          Privacy
        </ThemedText>
        <SegmentedControl
          label="Default walk visibility"
          value={defaultWalkVisibility}
          options={[
            { value: 'private', label: 'Private' },
            { value: 'public', label: 'Public' },
          ]}
          onChange={setDefaultWalkVisibility}
          disabled={saving}
        />
      </View>

      {error ? (
        <ThemedText type="caption" style={{ color: '#b91c1c' }}>
          {error}
        </ThemedText>
      ) : null}

      <View style={styles.saveRow}>
        <Pressable
          onPress={() => void handleSave()}
          disabled={saving}
          style={[styles.saveButton, { backgroundColor: colors.primary, opacity: saving ? 0.5 : 1 }]}
        >
          {saving ? (
            <ActivityIndicator color={colors.textInverse} size="small" />
          ) : (
            <ThemedText type="bodyMed" style={{ color: colors.textInverse }}>
              Save preferences
            </ThemedText>
          )}
        </Pressable>
        {saved ? (
          <ThemedText type="caption" style={{ color: colors.success }}>
            Saved
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.lg },
  loading: { paddingVertical: Spacing.xl, alignItems: 'center' },
  fieldLabel: { marginBottom: Spacing.xs },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
  },
  weightInput: {
    flex: 1,
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.base,
    paddingVertical: Spacing.xs,
  },
  section: {
    gap: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: { marginBottom: Spacing.xs },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  toggleText: { flex: 1, gap: 2 },
  saveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  saveButton: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    minWidth: 140,
    alignItems: 'center',
  },
});
