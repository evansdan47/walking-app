import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { Palette, Typography } from '@/constants/theme';

interface Props {
  onDone: () => void;
}

/**
 * Custom in-app splash overlay.
 *
 * Rendered immediately after fonts load, on top of the full app tree.
 * It mirrors the native splash background so the handoff is seamless, then
 * fades out after a short display to reveal the app underneath.
 *
 * The native SplashScreen is hidden by the caller before this mounts.
 */
export function SplashOverlay({ onDone }: Props) {
  const opacity = useRef(new Animated.Value(1)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade the wordmark + tagline in quickly
    Animated.timing(textOpacity, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();

    // After a short hold, fade the whole overlay out
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) onDone();
      });
    }, 700);

    return () => clearTimeout(timer);
  }, [opacity, textOpacity, onDone]);

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <View style={styles.content}>
        <Image
          source={require('@/assets/images/splash-icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Animated.View style={[styles.textBlock, { opacity: textOpacity }]}>
          <Text style={styles.wordmark}>Rambleio</Text>
          <Text style={styles.tagline}>Walk more. Explore more.</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Palette.ink[700], // #122518 — matches native splash bg
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none' as const,
  },
  content: {
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 200,
  },
  textBlock: {
    alignItems: 'center',
    marginTop: 20,
  },
  wordmark: {
    fontFamily: Typography.fontDisplay,
    fontSize: 36,
    color: Palette.surface.base, // warm near-white
    letterSpacing: 1.5,
  },
  tagline: {
    fontFamily: Typography.fontRegular,
    fontSize: 14,
    color: Palette.slate[400],
    marginTop: 6,
    letterSpacing: 0.5,
  },
});
