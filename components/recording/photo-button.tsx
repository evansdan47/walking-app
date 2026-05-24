import { CameraView, useCameraPermissions } from 'expo-camera';
import { randomUUID } from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import * as MediaLibrary from 'expo-media-library';
import { useRef, useState } from 'react';
import {
    Modal,
    SafeAreaView,
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
  const [mediaPermission] = MediaLibrary.usePermissions();
  const cameraRef = useRef<CameraView | null>(null);

  async function handleCapture() {
    if (!cameraRef.current) return;
    const [photo, pos] = await Promise.all([
      cameraRef.current.takePictureAsync({ quality: 0.7 }),
      Location.getLastKnownPositionAsync(),
    ]);
    if (!photo) return;

    const destUri = `${FileSystem.documentDirectory}photos/${randomUUID()}.jpg`;
    await FileSystem.makeDirectoryAsync(
      `${FileSystem.documentDirectory}photos/`,
      { intermediates: true },
    );
    await FileSystem.moveAsync({ from: photo.uri, to: destUri });

    if (mediaPermission?.granted) {
      MediaLibrary.saveToLibraryAsync(destUri).catch(() => {});
    }

    insertPhoto({
      id: randomUUID(),
      walkId,
      timestamp: Date.now(),
      latitude: currentLocation?.latitude ?? 0,
      longitude: currentLocation?.longitude ?? 0,
      heading: pos?.coords.heading ?? null,
      localAssetUri: destUri,
      caption: null,
    });
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

// Floating action button used in the map button strip.
// When permission is granted, tapping opens a fullscreen camera overlay;
// the overlay closes automatically after a photo is captured or via the
// close button.
export function PhotoFab({
  walkId,
  currentLocation,
  disabled = false,
  style,
  iconColor,
}: PhotoButtonProps & { style?: StyleProp<ViewStyle>; iconColor?: string }) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  const [permission, requestPermission] = useCameraPermissions();
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();
  const [cameraOpen, setCameraOpen] = useState(false);
  const cameraRef = useRef<CameraView | null>(null);

  async function handleCapture() {
    if (!cameraRef.current) return;
    const [photo, pos] = await Promise.all([
      cameraRef.current.takePictureAsync({ quality: 0.7 }),
      Location.getLastKnownPositionAsync(),
    ]);
    if (!photo) return;

    const destUri = `${FileSystem.documentDirectory}photos/${randomUUID()}.jpg`;
    await FileSystem.makeDirectoryAsync(
      `${FileSystem.documentDirectory}photos/`,
      { intermediates: true },
    );
    await FileSystem.moveAsync({ from: photo.uri, to: destUri });

    if (mediaPermission?.granted) {
      MediaLibrary.saveToLibraryAsync(destUri).catch(() => {});
    }

    insertPhoto({
      id: randomUUID(),
      walkId,
      timestamp: Date.now(),
      latitude: currentLocation?.latitude ?? 0,
      longitude: currentLocation?.longitude ?? 0,
      heading: pos?.coords.heading ?? null,
      localAssetUri: destUri,
      caption: null,
    });

    setCameraOpen(false);
  }

  function handlePress() {
    if (!permission?.granted) {
      void requestPermission();
      return;
    }
    // Request media library permission in the background if not yet determined.
    // Camera opens regardless — saving to the gallery is best-effort.
    if (!mediaPermission?.granted && mediaPermission?.canAskAgain) {
      void requestMediaPermission();
    }
    setCameraOpen(true);
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.secondary }, style, disabled && { opacity: 0.4 }]}
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <IconSymbol name="camera.fill" size={20} color={iconColor ?? '#fff'} />
      </TouchableOpacity>

      <Modal visible={cameraOpen} animationType="slide" statusBarTranslucent onRequestClose={() => setCameraOpen(false)}>
        <SafeAreaView style={styles.cameraOverlay}>
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
          {/* Close button */}
          <TouchableOpacity
            style={[styles.overlayClose, { backgroundColor: colors.backgroundCard }]}
            onPress={() => setCameraOpen(false)}
            activeOpacity={0.8}
          >
            <IconSymbol name="xmark" size={18} color={colors.text} />
          </TouchableOpacity>
          {/* Shutter button */}
          <TouchableOpacity
            style={styles.shutterButton}
            onPress={() => { void handleCapture(); }}
            activeOpacity={0.8}
          >
            <View style={styles.shutterInner} />
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  cameraOverlay: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlayClose: {
    position: 'absolute',
    top: Spacing.xxl,
    left: Spacing.base,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
  },
  shutterButton: {
    position: 'absolute',
    bottom: Spacing.xxl,
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
  },
});
