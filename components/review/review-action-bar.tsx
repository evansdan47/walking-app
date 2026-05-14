import { Ionicons } from '@expo/vector-icons';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const DELETE_COLOR = '#c62828';

interface ReviewActionBarProps {
  onShare: () => void;
  onExportGpx: () => void;
  onSaveRoute?: () => void;
  onDelete: () => void;
  onClose: () => void;
  showSaveRoute: boolean;
}

export function ReviewActionBar({
  onShare,
  onExportGpx,
  onSaveRoute,
  onDelete,
  onClose,
  showSaveRoute,
}: ReviewActionBarProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  const insets = useSafeAreaInsets();

  const handleDelete = () => {
    Alert.alert('Delete walk?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  };

  const handleComingSoon = (feature: string) => {
    Alert.alert('Coming soon', `${feature} will be available in a future update.`);
  };

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.backgroundCard,
          borderTopColor: colors.border,
          paddingBottom: insets.bottom + Spacing.sm,
        },
      ]}
    >
      {/* Delete */}
      <TouchableOpacity
        style={styles.button}
        onPress={handleDelete}
        activeOpacity={0.7}
      >
        <Ionicons name="trash-outline" size={22} color={DELETE_COLOR} />
        <Text style={[styles.label, { color: DELETE_COLOR }]}>Delete</Text>
      </TouchableOpacity>

      {/* Export GPX */}
      <TouchableOpacity
        style={styles.button}
        onPress={() => handleComingSoon('Export GPX')}
        activeOpacity={0.7}
      >
        <Ionicons name="download-outline" size={22} color={colors.textMuted} />
        <Text style={[styles.label, { color: colors.textMuted }]}>Export GPX</Text>
      </TouchableOpacity>

      {/* Share */}
      <TouchableOpacity
        style={styles.button}
        onPress={() => handleComingSoon('Share')}
        activeOpacity={0.7}
      >
        <Ionicons name="share-outline" size={22} color={colors.textMuted} />
        <Text style={[styles.label, { color: colors.textMuted }]}>Share</Text>
      </TouchableOpacity>

      {/* Make Route — only for free walks */}
      {showSaveRoute && (
        <TouchableOpacity
          style={styles.button}
          onPress={() => handleComingSoon('Make Route')}
          activeOpacity={0.7}
        >
          <Ionicons name="bookmark-outline" size={22} color={colors.textMuted} />
          <Text style={[styles.label, { color: colors.textMuted }]}>Make Route</Text>
        </TouchableOpacity>
      )}

      {/* Close */}
      <TouchableOpacity
        style={styles.button}
        onPress={onClose}
        activeOpacity={0.7}
      >
        <Ionicons name="close-outline" size={22} color={colors.textMuted} />
        <Text style={[styles.label, { color: colors.textMuted }]}>Close</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.sm,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.xs,
  },
  label: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.xs,
  },
});
