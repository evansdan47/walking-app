import { CameraView, useCameraPermissions } from 'expo-camera';
import { randomUUID } from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { useRef } from 'react';
import {
    StyleProp,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { insertPhoto } from '@/lib/db/walk-photos';

interface PhotoButtonProps {
  walkId: string;
  currentLocation: { latitude: number; longitude: number } | null;
  disabled?: boolean;
}

export function PhotoButton({ walkId, currentLocation, disabled = false }: PhotoButtonProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const router = useRouter();

  async function handleCapture() {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
    if (!photo) return;

    const destUri = `${FileSystem.documentDirectory}photos/${randomUUID()}.jpg`;
    await FileSystem.makeDirectoryAsync(
      `${FileSystem.documentDirectory}photos/`,
      { intermediates: true },
    );
    await FileSystem.moveAsync({ from: photo.uri, to: destUri });

    insertPhoto({
      id: randomUUID(),
      walkId,
      timestamp: Date.now(),
      latitude: currentLocation?.latitude ?? 0,
      longitude: currentLocation?.longitude ?? 0,
      localUri: destUri,
      caption: null,
    });

    router.back();
  }

  if (!permission?.granted) {
    return (
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.secondary }]}
        onPress={() => { void requestPermission(); }}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>📷</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.cameraContainer}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
      <TouchableOpacity
        style={[styles.captureButton, { backgroundColor: colors.primary }]}
        onPress={() => { void handleCapture(); }}
        activeOpacity={0.8}
      >
        <Text style={styles.captureText}>Capture</Text>
      </TouchableOpacity>
    </View>
  );
}

// Floating action button used when camera is not open
export function PhotoFab({
  walkId,
  currentLocation,
  disabled = false,
  style,
  iconColor,
}: PhotoButtonProps & { style?: StyleProp<ViewStyle>; iconColor?: string }) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  const [, requestPermission] = useCameraPermissions();

  return (
    <TouchableOpacity
      style={[styles.fab, { backgroundColor: colors.secondary }, style, disabled && { opacity: 0.4 }]}
      onPress={() => { void requestPermission(); }}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <IconSymbol name="camera.fill" size={20} color={iconColor ?? '#fff'} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: Spacing.xxl + Spacing.base,
    right: Spacing.base,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  fabText: {
    fontSize: 24,
  },
  cameraContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    backgroundColor: '#000',
  },
  captureButton: {
    position: 'absolute',
    bottom: Spacing.xl,
    alignSelf: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  captureText: {
    color: '#fff',
    fontFamily: Typography.fontBold,
    fontSize: Typography.sizes.base,
  },
});
