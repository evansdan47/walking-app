import * as Haptics from 'expo-haptics';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Phase = 'idle' | 'recording' | 'paused' | 'completing' | 'completed';

interface RecordingControlsProps {
  phase: Phase;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  disabled?: boolean;
}

export function RecordingControls({
  phase,
  onPause,
  onResume,
  onStop,
  disabled = false,
}: RecordingControlsProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];

  function handlePause() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Pause recording?',
      '',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Pause', onPress: onPause },
      ],
    );
  }

  function handleStop() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Stop recording?',
      'Your walk will be saved and synced.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Stop', style: 'destructive', onPress: onStop },
      ],
    );
  }

  // Phase 13a: idle phase no longer shows a Start button — start happens on tab tap.
  if (phase === 'idle') return null;

  if (phase === 'recording') {
    return (
      <View style={styles.row}>
        {/* Pause — grey, left */}
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.backgroundMuted }, disabled && styles.disabled]}
          onPress={handlePause}
          disabled={disabled}
          activeOpacity={0.8}
        >
          <View style={styles.buttonInner}>
            <IconSymbol name="pause.circle.fill" size={20} color={colors.text} />
            <Text style={[styles.actionText, { color: colors.text }]}>Pause</Text>
          </View>
        </TouchableOpacity>

        {/* Stop — red, centre, most prominent */}
        <TouchableOpacity
          style={[styles.actionBtnStop, disabled && styles.disabled]}
          onPress={handleStop}
          disabled={disabled}
          activeOpacity={0.8}
        >
          <View style={styles.buttonInner}>
            <IconSymbol name="stop.circle.fill" size={20} color="#fff" />
            <Text style={styles.actionTextStop}>Stop</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'paused') {
    return (
      <View style={styles.row}>
        {/* Resume — green, left/centre */}
        <TouchableOpacity
          style={[styles.actionBtnResume, { backgroundColor: colors.success }, disabled && styles.disabled]}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onResume();
          }}
          disabled={disabled}
          activeOpacity={0.8}
        >
          <Text style={styles.actionTextStop}>Resume</Text>
        </TouchableOpacity>

        {/* Stop — red outline, right */}
        <TouchableOpacity
          style={[styles.actionBtn, { borderWidth: 1.5, borderColor: '#d32f2f' }, disabled && styles.disabled]}
          onPress={handleStop}
          disabled={disabled}
          activeOpacity={0.8}
        >
          <View style={styles.buttonInner}>
            <IconSymbol name="stop.circle.fill" size={20} color="#d32f2f" />
            <Text style={[styles.actionText, { color: '#d32f2f' }]}>Stop</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  // completing / completed — no controls
  return null;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionBtn: {
    flex: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnStop: {
    flex: 1.3,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d32f2f',
  },
  actionBtnResume: {
    flex: 1.3,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  actionText: {
    fontFamily: Typography.fontBold,
    fontSize: Typography.sizes.sm,
  },
  actionTextStop: {
    color: '#fff',
    fontFamily: Typography.fontBold,
    fontSize: Typography.sizes.base,
  },
  disabled: {
    opacity: 0.4,
  },
});
