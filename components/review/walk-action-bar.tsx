import { Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';

import { Radius, Spacing, Typography } from '@/constants/theme';

const ERROR_COLOR = '#c62828';

interface WalkActionBarProps {
  onDelete: () => void;
}

export function WalkActionBar({ onDelete }: WalkActionBarProps) {
  const handleDelete = () => {
    Alert.alert('Delete walk?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  };

  return (
    <TouchableOpacity
      style={[styles.deleteButton, { borderColor: ERROR_COLOR }]}
      onPress={handleDelete}
      activeOpacity={0.7}
    >
      <Text style={[styles.deleteText, { color: ERROR_COLOR }]}>
        Delete Walk
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  deleteButton: {
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  deleteText: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.base,
  },
});
