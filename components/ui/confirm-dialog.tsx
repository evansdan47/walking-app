import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const accent = variant === 'danger' ? '#dc2626' : colors.primary;
  const accentMuted = variant === 'danger' ? 'rgba(220, 38, 38, 0.12)' : colors.primaryMuted;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable
          style={[styles.panel, { backgroundColor: colors.backgroundCard }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.accentBar, { backgroundColor: accent }]} />

          <View style={styles.body}>
            <View style={styles.header}>
              <View style={[styles.iconWrap, { backgroundColor: accentMuted }]}>
                <Ionicons
                  name={variant === 'danger' ? 'trash-outline' : 'help-circle-outline'}
                  size={20}
                  color={accent}
                />
              </View>
              <View style={styles.headerText}>
                <ThemedText type="bodySemiBold">{title}</ThemedText>
                <ThemedText type="caption" style={{ color: colors.textMuted, marginTop: 4 }}>
                  {message}
                </ThemedText>
              </View>
            </View>

            <View style={styles.actions}>
              <Pressable
                onPress={onCancel}
                style={[styles.cancelBtn, { backgroundColor: colors.backgroundMuted }]}
              >
                <ThemedText type="bodyMed">{cancelLabel}</ThemedText>
              </Pressable>
              <Pressable
                onPress={onConfirm}
                style={[styles.confirmBtn, { backgroundColor: accent }]}
              >
                <ThemedText
                  style={{ color: colors.textInverse, fontFamily: Typography.fontMedium }}
                >
                  {confirmLabel}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  panel: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  accentBar: {
    height: 4,
    width: '100%',
  },
  body: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: Radius.md,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  confirmBtn: {
    flex: 1,
    borderRadius: Radius.md,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
});
