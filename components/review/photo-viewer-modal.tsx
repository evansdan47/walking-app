import { Ionicons } from '@expo/vector-icons';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { WalkPhoto } from '@/lib/db/walk-photos';

interface PhotoViewerModalProps {
  photo: WalkPhoto | null;
  onClose: () => void;
}

export function PhotoViewerModal({ photo, onClose }: PhotoViewerModalProps) {
  const insets = useSafeAreaInsets();
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];

  const timestamp = photo
    ? new Date(photo.timestamp).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <Modal
      visible={photo !== null}
      presentationStyle="overFullScreen"
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Close button — top left */}
        <Pressable
          style={[styles.closeButton, { top: insets.top + 12 }]}
          onPress={onClose}
          hitSlop={12}
        >
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>

        {/* Photo */}
        {photo && (
          <Image
            source={{ uri: photo.localUri }}
            style={styles.photo}
            resizeMode="contain"
          />
        )}

        {/* Timestamp — bottom centre */}
        {photo && (
          <View style={[styles.timestampBar, { bottom: insets.bottom + 16 }]}>
            <Text style={[styles.timestamp, { color: colors.textInverse }]}>
              {timestamp}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    padding: 4,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  timestampBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  timestamp: {
    fontFamily: Typography.fontMedium,
    fontSize: 13,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
});
