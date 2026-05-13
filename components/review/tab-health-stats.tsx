import { Ionicons } from '@expo/vector-icons';
import { Pedometer } from 'expo-sensors';
import { useEffect, useState } from 'react';
import { Alert, Image, Keyboard, Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDuration } from '@/components/recording/duration-display';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { checkHealthConnectPermissions, isHealthConnectAvailable, requestHealthConnectPermissions } from '@/lib/health-connect';
import type { WalkStats } from '@/lib/db/walks';

const MET = 3.5; // moderate walking pace

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------

/** Formats seconds as "Xh Ym Zs" for natural-language display. */
function formatDurationWords(totalSecs: number): string {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = Math.round(totalSecs % 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

function estimateCalories(movingTimeSecs: number, bodyWeightKg: number): number {
  return Math.round(MET * bodyWeightKg * (movingTimeSecs / 3600));
}

// ---------------------------------------------------------
// Sub-components
// ---------------------------------------------------------

interface IconBubbleProps {
  name: string;
  bgColor: string;
  iconColor: string;
  size?: number;
}
function IconBubble({ name, bgColor, iconColor, size = 22 }: IconBubbleProps) {
  return (
    <View style={[styles.iconBubble, { backgroundColor: bgColor }]}>
      <Ionicons name={name as never} size={size} color={iconColor} />
    </View>
  );
}

interface StatRowProps {
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  sourceLines: string[];
  sourceColor?: string;
  rightContent?: ReactNode;
  style?: ViewStyle;
  last?: boolean;
}
function StatRow({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  sourceLines,
  sourceColor,
  rightContent,
  style,
  last,
}: StatRowProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];

  return (
    <View
      style={[
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        style,
      ]}
    >
      <IconBubble name={icon} bgColor={iconBg} iconColor={iconColor} />
      <View style={styles.rowMid}>
        <Text style={[styles.rowLabel, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[styles.rowValue, { color: colors.text }]}>{value}</Text>
      </View>
      {rightContent != null ? (
        rightContent
      ) : (
        <View style={styles.rowSource}>
          {sourceLines.map((line, i) => (
            <Text
              key={i}
              style={[
                styles.rowSourceText,
                { color: i === sourceLines.length - 1 && sourceColor ? sourceColor : colors.textMuted },
              ]}
            >
              {line}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------
// Main component
// ---------------------------------------------------------

interface TabHealthStatsProps {
  stats: WalkStats | null;
  bodyWeightKg: number | null;
  onSetBodyWeight: (kg: number) => void;
}

export function TabHealthStats({ stats, bodyWeightKg, onSetBodyWeight }: TabHealthStatsProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  const insets = useSafeAreaInsets();

  // Weight modal state
  const [weightModalVisible, setWeightModalVisible] = useState(false);
  const [weightInput, setWeightInput] = useState('');

  // Pedometer permission state (for "no steps" hint)
  const [pedometerGranted, setPedometerGranted] = useState<boolean | null>(null);
  useEffect(() => {
    Pedometer.getPermissionsAsync().then((p) => setPedometerGranted(p.granted));
  }, []);

  const handleRequestStepPermissions = async () => {
    const perm = await Pedometer.requestPermissionsAsync();
    setPedometerGranted(perm.granted);
    // Also request HC if available
    const hcAvail = await isHealthConnectAvailable();
    if (hcAvail) {
      await requestHealthConnectPermissions();
    }
  };

  const handleSaveWeight = () => {
    const kg = parseFloat(weightInput);
    if (!isNaN(kg) && kg > 0 && kg < 500) {
      onSetBodyWeight(kg);
      setWeightModalVisible(false);
    } else {
      Alert.alert('Invalid weight', 'Please enter a valid weight in kg.');
    }
  };

  // Steps
  const stepsValue = stats?.hcStepCount ?? stats?.stepCount;
  const noStepData = stepsValue == null;
  const stepsDisplay = stepsValue != null ? stepsValue.toLocaleString() + ' steps' : '--';
  const stepsSource = stats?.hcStepCount != null
    ? ['Health Connect', '(HC)']
    : stats?.stepCount != null
      ? ['From pedometer', '(device)']
      : ['--'];
  const stepsSourceColor = stats?.hcStepCount != null ? colors.success : undefined;

  // Time moving
  const timeMov = stats?.movingTimeSeconds ?? 0;
  const timeMovDisplay = stats ? formatDurationWords(timeMov) : '--';

  // Calories
  let caloriesDisplay = '--';
  let caloriesSource: string[] = ['--'];
  let caloriesSourceColor: string | undefined;
  let showWeightHint = false;

  if (stats?.caloriesKcal != null) {
    caloriesDisplay = `${Math.round(stats.caloriesKcal)} kcal`;
    caloriesSource = ['Health Connect', '(HC)'];
    caloriesSourceColor = colors.success;
  } else if (bodyWeightKg != null && stats) {
    const est = estimateCalories(stats.movingTimeSeconds, bodyWeightKg);
    caloriesDisplay = `${est} kcal`;
    caloriesSource = [`Estimated (MET ${MET})`, `Using ${bodyWeightKg} kg`];
    caloriesSourceColor = colors.primary;
  } else {
    caloriesDisplay = '--';
    caloriesSource = ['--'];
    showWeightHint = true;
  }

  // Heart rate
  const avgHR = stats?.avgHeartRateBpm;
  const maxHR = stats?.maxHeartRateBpm;
  const avgHRDisplay = avgHR != null ? `${Math.round(avgHR)} bpm` : '--';
  const maxHRDisplay = maxHR != null ? `${Math.round(maxHR)} bpm` : '--';
  const hrSource = (hr: number | undefined) =>
    hr != null ? ['Health Connect', '(HC)'] : ['--'];
  const hrSourceColorFn = (hr: number | undefined) =>
    hr != null ? colors.success : undefined;
  const avgHRColor = hrSourceColorFn(avgHR);
  const maxHRColor = hrSourceColorFn(maxHR);

  // Icon palette
  const green = colors.success;
  const greenBg = colors.successMuted;
  const blue = '#0288d1';
  const blueBg = '#e1f5fe';
  const orange = colors.primary;
  const orangeBg = colors.primaryMuted;
  const red = '#c62828';
  const redBg = '#fce8e8';

  return (
    <View style={styles.container}>
      {/* Header card */}
      <View style={[styles.card, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
        {/* Card header row */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderText}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Health Summary</Text>
            <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
              Data from Health Connect and your device
            </Text>
          </View>
          {/* Health Connect logo badge */}
          <Image
            source={require('@/assets/healthconnect/logo.png')}
            style={styles.hcBadge}
            resizeMode="contain"
            accessibilityLabel="Health Connect"
          />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Steps */}
        <StatRow
          icon="footsteps-outline"
          iconBg={greenBg}
          iconColor={green}
          label="Steps"
          value={stepsDisplay}
          sourceLines={stepsSource}
          {...(stepsSourceColor != null && { sourceColor: stepsSourceColor })}
        />

        {/* Steps permission hint — shown when no step data was recorded */}
        {noStepData && pedometerGranted === false && (
          <View style={[styles.hintCard, { backgroundColor: colors.backgroundMuted, borderColor: colors.border }]}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.hintIcon} />
            <View style={styles.hintBody}>
              <Text style={[styles.hintText, { color: colors.textMuted }]}>
                Permission not granted for step counting.
              </Text>
              <Pressable onPress={() => { void handleRequestStepPermissions(); }} hitSlop={8}>
                <Text style={[styles.hintLink, { color: colors.primary }]}>
                  Enable <Ionicons name="chevron-forward" size={11} color={colors.primary} />
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Time moving */}
        <StatRow
          icon="walk-outline"
          iconBg={blueBg}
          iconColor={blue}
          label="Time Moving"
          value={timeMovDisplay}
          sourceLines={['From movement', '(device)']}
        />

        {/* Active calories — when no weight set, show inline "Set weight" prompt on right side */}
        <StatRow
          icon="flame-outline"
          iconBg={orangeBg}
          iconColor={orange}
          label="Active Calories"
          value={caloriesDisplay}
          sourceLines={caloriesSource}
          {...(caloriesSourceColor != null && { sourceColor: caloriesSourceColor })}
          {...(showWeightHint && {
            rightContent: (
              <View style={styles.rowSource}>
                <Text style={[styles.rowSourceText, { color: colors.textMuted }]}>
                  Set weight for
                </Text>
                <Pressable
                  onPress={() => {
                    setWeightInput(bodyWeightKg != null ? String(bodyWeightKg) : '');
                    setWeightModalVisible(true);
                  }}
                  hitSlop={8}
                >
                  <Text style={[styles.rowSourceText, { color: colors.primary, fontFamily: Typography.fontMedium }]}>
                    calorie estimate
                  </Text>
                </Pressable>
              </View>
            ),
          })}
        />

        {/* Avg heart rate */}
        <StatRow
          icon="heart-outline"
          iconBg={redBg}
          iconColor={red}
          label="Average Heart Rate"
          value={avgHRDisplay}
          sourceLines={hrSource(avgHR)}
          {...(avgHRColor !== undefined && { sourceColor: avgHRColor })}
        />

        {/* Max heart rate */}
        <StatRow
          icon="heart"
          iconBg={redBg}
          iconColor={red}
          label="Max Heart Rate"
          value={maxHRDisplay}
          sourceLines={hrSource(maxHR)}
          {...(maxHRColor !== undefined && { sourceColor: maxHRColor })}
          last
        />
      </View>

      {/* Footer disclaimer */}
      <Text style={[styles.footer, { color: colors.textMuted }]}>
        Health metrics are provided by Health Connect when available. Some data may be estimated.
      </Text>

      {/* Inline weight capture modal. softwareKeyboardLayoutMode="pan" keeps sheet above the keyboard on Android (RN 0.74+) */}
      <Modal
        visible={weightModalVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error prop added in RN 0.74, types may not include it yet
        softwareKeyboardLayoutMode="pan"
        onRequestClose={() => setWeightModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => { Keyboard.dismiss(); setWeightModalVisible(false); }}
        >
          {/* Use a nested Pressable so taps on the sheet don't dismiss */}
          <Pressable
            style={[
              styles.modalSheet,
              { backgroundColor: colors.backgroundCard, paddingBottom: insets.bottom + Spacing.base },
            ]}
            onPress={() => {}}
          >
            <View style={[styles.modalHandle, { backgroundColor: colors.textMuted }]} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>Body Weight</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
              Used to estimate your active calorie burn.
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
              ]}
              placeholder="Weight in kg"
              placeholderTextColor={colors.textMuted}
              value={weightInput}
              onChangeText={setWeightInput}
              keyboardType="decimal-pad"
              returnKeyType="done"
              onSubmitEditing={handleSaveWeight}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.modalSaveBtn, { backgroundColor: colors.primary }]}
              onPress={handleSaveWeight}
              activeOpacity={0.85}
            >
              <Text style={styles.modalSaveBtnText}>Save weight</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------
// Styles
// ---------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: Spacing.base,
    paddingBottom: Spacing.sm,
  },
  cardHeaderText: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.base,
  },
  cardSubtitle: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.xs,
  },
  hcBadge: {
    width: 52,
    height: 52,
    marginLeft: Spacing.sm,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: Spacing.base,
  },
  // Stat rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm,
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMid: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.xs,
  },
  rowValue: {
    fontFamily: Typography.fontBold,
    fontSize: Typography.sizes.base,
  },
  rowSource: {
    alignItems: 'flex-end',
    gap: 1,
  },
  rowSourceText: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.xs,
    textAlign: 'right',
  },
  // Hint card
  hintCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.xs,
  },
  hintIcon: {
    marginTop: 1,
  },
  hintBody: {
    flex: 1,
    gap: Spacing.xs,
  },
  hintText: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.xs,
    lineHeight: 16,
  },
  hintLink: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.xs,
  },
  footer: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.xs,
    lineHeight: 16,
    paddingHorizontal: Spacing.xs,
  },
  // Weight modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    padding: Spacing.base,
    gap: Spacing.sm,
    alignItems: 'stretch',
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.xs,
    opacity: 0.4,
  },
  modalTitle: {
    fontFamily: Typography.fontBold,
    fontSize: Typography.sizes.lg,
  },
  modalSubtitle: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.sm,
    lineHeight: 18,
  },
  modalInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.base,
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.base,
    marginTop: Spacing.xs,
  },
  modalSaveBtn: {
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  modalSaveBtnText: {
    fontFamily: Typography.fontBold,
    fontSize: Typography.sizes.base,
    color: '#fff',
  },
});
