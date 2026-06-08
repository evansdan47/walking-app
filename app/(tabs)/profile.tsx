import { useAuth, useUser } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import { useConvex } from 'convex/react';
import Constants from 'expo-constants';
import { Pedometer } from 'expo-sensors';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    LayoutAnimation,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    UIManager,
    View,
} from 'react-native';

import { DiagnosticsPanel } from '@/components/profile/diagnostics-panel';
import { AppHeader } from '@/components/shared/app-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { RouteColourPicker } from '@/components/ui/route-colour-picker';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLocationPermission } from '@/hooks/use-location-permission';
import { useRouteColours } from '@/hooks/use-route-colours';
import { useUserPreferences } from '@/hooks/use-user-preferences';
import {
    checkHealthConnectPermissions,
    isHealthConnectAvailable,
    requestHealthConnectPermissions,
} from '@/lib/health-connect';
import { downloadWalksFromCloud } from '@/lib/sync/download-walks';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ---------------------------------------------------------
// Accordion
// ---------------------------------------------------------
interface AccordionProps {
  title: string;
  icon: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  rightSlot?: React.ReactNode;
}

function Accordion({ title, icon, defaultOpen = false, children, rightSlot }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const rotation = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.timing(rotation, {
      toValue: open ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setOpen((prev) => !prev);
  }, [open, rotation]);

  const chevronRotation = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  return (
    <View style={[accStyles.wrapper, { borderColor: colors.border }]}>
      <Pressable
        style={[accStyles.header, { backgroundColor: colors.backgroundCard }]}
        onPress={toggle}
        android_ripple={{ color: colors.border }}
      >
        <View style={accStyles.headerLeft}>
          <Ionicons name={icon as never} size={18} color={colors.primary} style={accStyles.headerIcon} />
          <ThemedText type="bodyMed" style={accStyles.headerTitle}>{title}</ThemedText>
        </View>
        <View style={accStyles.headerRight}>
          {rightSlot}
          <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Animated.View>
        </View>
      </Pressable>
      {open && (
        <View style={[accStyles.body, { borderTopColor: colors.border }]}>
          {children}
        </View>
      )}
    </View>
  );
}

const accStyles = StyleSheet.create({
  wrapper: {
    width: '100%',
    borderWidth: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  headerIcon: {},
  headerTitle: {},
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  body: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.base,
    gap: Spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'transparent',
    marginVertical: Spacing.xs,
  },
});

// ---------------------------------------------------------
// PermissionRow
// ---------------------------------------------------------
type PermStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable';

interface PermissionRowProps {
  label: string;
  sublabel?: string;
  status: PermStatus;
  onRequest?: () => void;
}

function PermissionRow({ label, sublabel, status, onRequest }: PermissionRowProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const dotColor =
    status === 'granted' ? colors.success :
    status === 'unavailable' ? colors.textMuted :
    '#f59e0b';

  const statusLabel =
    status === 'granted' ? 'Granted' :
    status === 'denied' ? 'Denied' :
    status === 'unavailable' ? 'Unavailable' :
    'Not set';

  return (
    <View style={permStyles.row}>
      <View style={permStyles.labelCol}>
        <ThemedText type="body">{label}</ThemedText>
        {sublabel ? (
          <ThemedText type="caption" style={{ color: colors.textMuted }}>{sublabel}</ThemedText>
        ) : null}
      </View>
      <View style={permStyles.right}>
        <View style={[permStyles.dot, { backgroundColor: dotColor }]} />
        <ThemedText type="caption" style={{ color: colors.textMuted }}>{statusLabel}</ThemedText>
        {(status === 'denied' || status === 'undetermined') && onRequest ? (
          <Pressable onPress={onRequest} hitSlop={8} style={[permStyles.enableBtn, { borderColor: colors.primary }]}>
            <ThemedText type="caption" style={{ color: colors.primary, fontFamily: Typography.fontMedium }}>
              Enable
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const permStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  labelCol: { flex: 1, gap: 2 },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  enableBtn: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    marginLeft: Spacing.xs,
  },
});

// ---------------------------------------------------------
// Profile screen
// ---------------------------------------------------------
export default function ProfileScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { colours, setColour, resetColours } = useRouteColours();
  const { preferences, setPreference } = useUserPreferences();
  const location = useLocationPermission();

  const [weightDraft, setWeightDraft] = useState<string>(
    preferences.bodyWeightKg !== null ? String(preferences.bodyWeightKg) : '',
  );

  const [pedometerStatus, setPedometerStatus] = useState<PermStatus>('undetermined');
  const [hcAvailable, setHcAvailable] = useState(false);
  const [hcStatus, setHcStatus] = useState<PermStatus>('undetermined');

  useEffect(() => {
    Pedometer.getPermissionsAsync().then((p) => {
      setPedometerStatus(p.granted ? 'granted' : p.status === 'denied' ? 'denied' : 'undetermined');
    });
    isHealthConnectAvailable().then(async (avail) => {
      setHcAvailable(avail);
      if (avail) {
        const granted = await checkHealthConnectPermissions();
        setHcStatus(granted?.readSteps ? 'granted' : 'undetermined');
      } else {
        setHcStatus('unavailable');
      }
    });
  }, []);

  const requestPedometer = useCallback(async () => {
    const result = await Pedometer.requestPermissionsAsync();
    setPedometerStatus(result.granted ? 'granted' : 'denied');
  }, []);

  const requestHC = useCallback(async () => {
    await requestHealthConnectPermissions();
    const granted = await checkHealthConnectPermissions();
    setHcStatus(granted?.readSteps ? 'granted' : 'denied');
  }, []);

  const convex = useConvex();
  const [syncing, setSyncing] = useState(false);

  const handleSyncFromCloud = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await downloadWalksFromCloud(convex);
      if (result.downloaded === 0 && result.failed === 0) {
        Alert.alert('Up to date', 'All cloud walks are already on this device.');
      } else if (result.failed > 0) {
        Alert.alert(
          'Sync complete',
          `Downloaded ${result.downloaded} walk${result.downloaded !== 1 ? 's' : ''}. ${result.failed} failed — check Diagnostics for details.`,
        );
      } else {
        Alert.alert(
          'Sync complete',
          `Downloaded ${result.downloaded} walk${result.downloaded !== 1 ? 's' : ''} from the cloud.`,
        );
      }
    } catch (err) {
      Alert.alert('Sync failed', 'Could not reach the server. Please check your connection and try again.');
    } finally {
      setSyncing(false);
    }
  }, [convex]);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await signOut(); } },
    ]);
  };

  const displayName = user?.fullName ?? user?.firstName ?? 'Walker';
  const email = user?.primaryEmailAddress?.emailAddress ?? '';
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const locationFg: PermStatus = !location.loaded ? 'undetermined' : location.foreground;
  const locationBg: PermStatus = !location.loaded ? 'undetermined' : location.background;

  return (
    <ThemedView style={styles.container}>
      <AppHeader title="Profile" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar */}
        <ThemedView
          variant="backgroundCard"
          style={[styles.avatar, { borderColor: colors.border }]}
        >
          <ThemedText type="title">{displayName.charAt(0).toUpperCase()}</ThemedText>
        </ThemedView>

        <ThemedText type="title" style={styles.name}>{displayName}</ThemedText>
        {email ? (
          <ThemedText type="body" style={[styles.email, { color: colors.textMuted }]}>{email}</ThemedText>
        ) : null}

        <Pressable
          style={[styles.signOutButton, { borderColor: colors.border }]}
          onPress={handleSignOut}
        >
          <ThemedText type="bodyMed" style={{ color: colors.textMuted }}>Sign Out</ThemedText>
        </Pressable>

        {/* ── Preferences ── */}
        <Accordion title="Preferences" icon="options-outline" defaultOpen>

          <View style={styles.prefRow}>
            <ThemedText type="body">Distance unit</ThemedText>
            <View style={[styles.segmentControl, { borderColor: colors.border }]}>
              <Pressable
                style={[styles.segment, !preferences.preferMiles && { backgroundColor: colors.primary }]}
                onPress={() => setPreference('preferMiles', false)}
              >
                <ThemedText
                  type="caption"
                  style={{ color: preferences.preferMiles ? colors.textMuted : colors.textInverse }}
                >km</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.segment, preferences.preferMiles && { backgroundColor: colors.primary }]}
                onPress={() => setPreference('preferMiles', true)}
              >
                <ThemedText
                  type="caption"
                  style={{ color: preferences.preferMiles ? colors.textInverse : colors.textMuted }}
                >mi</ThemedText>
              </Pressable>
            </View>
          </View>

          <View style={styles.prefRow}>
            <View style={styles.prefLabelCol}>
              <ThemedText type="body">Body weight</ThemedText>
              <ThemedText type="caption" style={{ color: colors.textMuted }}>Used for calorie estimates</ThemedText>
            </View>
            <View style={[styles.weightInputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <TextInput
                style={[styles.weightInput, { color: colors.text }]}
                value={weightDraft}
                onChangeText={setWeightDraft}
                keyboardType="decimal-pad"
                placeholder="--"
                placeholderTextColor={colors.textMuted}
                returnKeyType="done"
                onEndEditing={() => {
                  const parsed = parseFloat(weightDraft);
                  if (!weightDraft.trim()) {
                    setPreference('bodyWeightKg', null);
                  } else if (!isNaN(parsed) && parsed > 0 && parsed < 500) {
                    setPreference('bodyWeightKg', parsed);
                  } else {
                    setWeightDraft(preferences.bodyWeightKg !== null ? String(preferences.bodyWeightKg) : '');
                  }
                }}
              />
              <ThemedText type="caption" style={{ color: colors.textMuted }}>kg</ThemedText>
            </View>
          </View>

        </Accordion>

        {/* ── Permissions ── */}
        <Accordion title="Permissions" icon="shield-checkmark-outline">

          <PermissionRow
            label="Location (foreground)"
            sublabel="Required for GPS walk recording"
            status={locationFg}
            {...(locationFg !== 'granted' && { onRequest: () => { void location.requestForeground(); } })}
          />
          <PermissionRow
            label="Location (background)"
            sublabel="Track walks with screen off"
            status={locationFg === 'granted' ? locationBg : 'unavailable'}
            {...(locationFg === 'granted' && locationBg !== 'granted' && {
              onRequest: () => { void location.requestBackground(); },
            })}
          />
          <PermissionRow
            label="Step counter"
            sublabel="Counts steps via device pedometer"
            status={pedometerStatus}
            {...(pedometerStatus !== 'granted' && { onRequest: requestPedometer })}
          />
          {hcAvailable ? (
            <PermissionRow
              label="Health Connect"
              sublabel="Steps, heart rate & calorie data"
              status={hcStatus}
              {...(hcStatus !== 'granted' && hcStatus !== 'unavailable' && { onRequest: requestHC })}
            />
          ) : null}

        </Accordion>

        {/* ── Developer Settings ── */}
        <Accordion title="Developer Settings" icon="code-slash-outline">

          {/* Down-sync: pull walks from Convex to local device */}
          <ThemedText type="caption" style={{ color: colors.textMuted }}>
            Download completed walks from the cloud that are missing on this device.
          </ThemedText>
          <Pressable
            style={[
              accStyles.actionButton,
              { backgroundColor: colors.primary + '18', borderColor: colors.primary + '40' },
              syncing && { opacity: 0.5 },
            ]}
            onPress={handleSyncFromCloud}
            disabled={syncing}
          >
            <Ionicons name={syncing ? 'sync' : 'cloud-download-outline'} size={16} color={colors.primary} />
            <ThemedText type="caption" style={{ color: colors.primary, fontWeight: '600' }}>
              {syncing ? 'Syncing…' : 'Sync from Cloud'}
            </ThemedText>
          </Pressable>

          <View style={accStyles.divider} />

          <View style={styles.devColourHeader}>
            <ThemedText type="caption" style={{ color: colors.textMuted, flex: 1 }}>Route colours</ThemedText>
            <Pressable onPress={resetColours} hitSlop={8}>
              <ThemedText type="caption" style={{ color: colors.primary }}>Reset</ThemedText>
            </Pressable>
          </View>

          <RouteColourPicker
            label="Positive (fast / descent)"
            colour={colours.positive}
            onChange={(hex) => setColour('positive', hex)}
          />
          <RouteColourPicker
            label="Neutral (flat / indeterminate)"
            colour={colours.neutral}
            onChange={(hex) => setColour('neutral', hex)}
          />
          <RouteColourPicker
            label="Negative (slow / ascent)"
            colour={colours.negative}
            onChange={(hex) => setColour('negative', hex)}
          />

        </Accordion>

        {/* ── Diagnostics ── */}
        <Accordion title="Diagnostics" icon="bug-outline">
          <DiagnosticsPanel />
        </Accordion>

        <View style={styles.spacer} />

        <ThemedText type="caption" style={[styles.version, { color: colors.textMuted }]}>
          v{appVersion}
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

// ---------------------------------------------------------
// Styles
// ---------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    alignItems: 'center',
    padding: Spacing.lg,
    flexGrow: 1,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.base,
    marginTop: Spacing.sm,
  },
  name: { marginBottom: Spacing.xs },
  email: { marginBottom: Spacing.lg },
  signOutButton: {
    width: '100%',
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  prefLabelCol: { flex: 1, gap: 2 },
  segmentControl: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  segment: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
    minWidth: 80,
  },
  weightInput: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.base,
    minWidth: 44,
    textAlign: 'right',
  },
  devColourHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  spacer: { flex: 1, minHeight: Spacing.lg },
  version: { marginBottom: Spacing.lg, opacity: 0.5 },
});

