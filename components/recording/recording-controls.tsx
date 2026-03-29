import * as Haptics from 'expo-haptics';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Phase = 'idle' | 'recording' | 'paused' | 'completing' | 'completed';

interface RecordingControlsProps {
  phase: Phase;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  disabled?: boolean;
}

export function RecordingControls({
  phase,
  onStart,
  onPause,
  onResume,
  onStop,
  disabled = false,
}: RecordingControlsProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];

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

  if (phase === 'idle') {
    return (
      <View style={styles.row}>
        <TouchableOpacity
          style={[
            styles.primary,
            { backgroundColor: colors.success },
            disabled && styles.disabled,
          ]}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            onStart();
          }}
          disabled={disabled}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryText}>Start my walk</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'recording') {
    return (
      <View style={styles.row}>
        <TouchableOpacity
          style={[
            styles.secondary,
            { borderColor: colors.primary },
            disabled && styles.disabled,
          ]}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onPause();
          }}
          disabled={disabled}
          activeOpacity={0.8}
        >
          <View style={styles.buttonInner}>
            <IconSymbol name="pause.circle.fill" size={20} color={colors.primary} />
            <Text style={[styles.secondaryText, { color: colors.primary }]}>Pause</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.secondary,
            { borderColor: colors.border },
            disabled && styles.disabled,
          ]}
          onPress={handleStop}
          disabled={disabled}
          activeOpacity={0.8}
        >
          <View style={styles.buttonInner}>
            <IconSymbol name="stop.circle.fill" size={20} color={colors.text} />
            <Text style={[styles.secondaryText, { color: colors.text }]}>Stop</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'paused') {
    return (
      <View style={styles.row}>
        <TouchableOpacity
          style={[
            styles.primary,
            { backgroundColor: colors.primary },
            disabled && styles.disabled,
          ]}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onResume();
          }}
          disabled={disabled}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryText}>Resume</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.secondary,
            { borderColor: colors.border },
            disabled && styles.disabled,
          ]}
          onPress={handleStop}
          disabled={disabled}
          activeOpacity={0.8}
        >
          <View style={styles.buttonInner}>
            <IconSymbol name="stop.circle.fill" size={20} color={colors.text} />
            <Text style={[styles.secondaryText, { color: colors.text }]}>Stop</Text>
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
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  primary: {
    flex: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md + 2,
    alignItems: 'center',
  },
  primaryText: {
    color: '#fff',
    fontFamily: Typography.fontBold,
    fontSize: Typography.sizes.base,
  },
  secondary: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    paddingVertical: Spacing.md + 2,
    alignItems: 'center',
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  secondaryText: {
    fontFamily: Typography.fontBold,
    fontSize: Typography.sizes.base,
  },
  disabled: {
    opacity: 0.4,
  },
});
