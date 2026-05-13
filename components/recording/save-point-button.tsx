/**
 * SavePointButton — FAB for saving a waypoint during a walk.
 *
 * Tap:       immediately saves a waypoint at the current location.
 * Long press: opens a categorisation sheet (type, name, note).
 */
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { insertWaypoint, type WaypointType } from '@/lib/db/waypoints';

interface SavePointButtonProps {
  walkId: string;
  currentLocation: { latitude: number; longitude: number } | null;
  disabled?: boolean;
  onSaved?: (waypointId: string) => void;
  style?: StyleProp<ViewStyle>;
}

const WAYPOINT_TYPES: { type: WaypointType; label: string }[] = [
  { type: 'scenic_view', label: 'Scenic View' },
  { type: 'summit',      label: 'Summit' },
  { type: 'rest_stop',   label: 'Rest Stop' },
  { type: 'hazard',      label: 'Hazard' },
  { type: 'other',       label: 'Other' },
];

function formatTime(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function showToast(msg: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(msg, ToastAndroid.SHORT);
  }
}

export function SavePointButton({
  walkId,
  currentLocation,
  disabled = false,
  onSaved,
  style,
}: SavePointButtonProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  const insets = useSafeAreaInsets();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [selectedType, setSelectedType] = useState<WaypointType | null>(null);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  // Track if long press is in progress to suppress the tap handler
  const longPressActive = useRef(false);

  function handleQuickSave() {
    if (longPressActive.current) return;
    if (!currentLocation) {
      Alert.alert('No GPS fix', 'Waiting for a GPS location…');
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const waypoint = insertWaypoint({
      walkId,
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      name: `Waypoint at ${formatTime(Date.now())}`,
    });
    showToast('Save Point added');
    onSaved?.(waypoint.id);
  }

  function handleLongPress() {
    longPressActive.current = true;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSelectedType(null);
    setName('');
    setNote('');
    setSheetVisible(true);
    // Reset after a tick so the onPress doesn't fire
    setTimeout(() => { longPressActive.current = false; }, 100);
  }

  function handleSheetSave() {
    if (!currentLocation) {
      Alert.alert('No GPS fix', 'Waiting for a GPS location…');
      return;
    }
    const waypoint = insertWaypoint({
      walkId,
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      name: name.trim() || `Waypoint at ${formatTime(Date.now())}`,
      type: selectedType,
      note: note.trim() || null,
    });
    setSheetVisible(false);
    showToast('Save Point added');
    onSaved?.(waypoint.id);
  }

  return (
    <>
      <Pressable
        style={[
          styles.fab,
          {
            backgroundColor: colors.backgroundCard,
            borderColor: colors.border,
          },
          style,
          disabled && styles.disabled,
        ]}
        onPress={handleQuickSave}
        onLongPress={handleLongPress}
        delayLongPress={500}
        disabled={disabled}
      >
        {/* Bookmark icon — using Text glyph as a fallback for cross-platform */}
        <Text style={[styles.fabIcon, { color: colors.success }]}>🔖</Text>
      </Pressable>

      {/* Categorisation sheet */}
      <Modal
        visible={sheetVisible}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => setSheetVisible(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setSheetVisible(false)}>
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: colors.backgroundCard,
                paddingBottom: insets.bottom + Spacing.base,
              },
            ]}
            onPress={() => {}}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.textMuted }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Add Save Point</Text>
            <Text style={[styles.sheetSubtitle, { color: colors.textMuted }]}>
              Mark this location with a category or note.
            </Text>

            {/* Type chips */}
            <View style={styles.typeRow}>
              {WAYPOINT_TYPES.map(({ type, label }) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeChip,
                    { borderColor: colors.border },
                    selectedType === type && {
                      backgroundColor: colors.success,
                      borderColor: colors.success,
                    },
                  ]}
                  onPress={() => setSelectedType(type === selectedType ? null : type)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      { color: selectedType === type ? '#fff' : colors.textMuted },
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Name */}
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: colors.border,
                  color: colors.text,
                  backgroundColor: colors.background,
                },
              ]}
              placeholder="Name (optional)"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
            />

            {/* Note */}
            <TextInput
              style={[
                styles.input,
                styles.noteInput,
                {
                  borderColor: colors.border,
                  color: colors.text,
                  backgroundColor: colors.background,
                },
              ]}
              placeholder="Note (optional)"
              placeholderTextColor={colors.textMuted}
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.success }]}
              onPress={handleSheetSave}
              activeOpacity={0.8}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  fabIcon: {
    fontSize: 18,
  },
  disabled: {
    opacity: 0.4,
  },
  backdrop: {
    flex: 1,
    backgroundColor: '#00000066',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.xs,
  },
  sheetTitle: {
    fontFamily: Typography.fontBold,
    fontSize: Typography.sizes.lg,
  },
  sheetSubtitle: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.sm,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  typeChip: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  typeChipText: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.sm,
  },
  noteInput: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  saveButton: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  saveButtonText: {
    color: '#fff',
    fontFamily: Typography.fontBold,
    fontSize: Typography.sizes.base,
  },
});
