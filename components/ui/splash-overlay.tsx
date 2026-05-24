import { Palette, Typography } from '@/constants/theme';
import { useEffect, useRef } from 'react';
import { Animated, Image, ImageBackground, StyleSheet, Text } from 'react-native';

interface Props {
  onDone: () => void;
}

/**
 * Custom in-app splash overlay.
 *
 * Full-screen background image with logo + wordmark at the top and a tagline
 * at the bottom. Fades out after a short hold to reveal the app underneath.
 *
 * The native SplashScreen is hidden by the caller before this mounts.
 */
export function SplashOverlay({ onDone }: Props) {
  const opacity = useRef(new Animated.Value(1)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade the logo + text in quickly
    Animated.timing(contentOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // After a short hold, fade the whole overlay out
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) onDone();
      });
    }, 1200);

    return () => clearTimeout(timer);
  }, [opacity, contentOpacity, onDone]);

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <ImageBackground
        source={require('@/assets/images/splash-background.png')}
        style={styles.background}
        resizeMode="cover"
      >
        {/* Top: logo + wordmark */}
        <Animated.View style={[styles.topContent, { opacity: contentOpacity }]}>
          <Image
            source={require('@/assets/images/splash-icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.wordmark}>rambleio</Text>
          <Text style={styles.tagline}>Record. Review. Follow.</Text>
        </Animated.View>

        {/* Bottom: dark bar with tagline */}
        <Animated.View style={[styles.bottomBar, { opacity: contentOpacity }]}>
          <Text style={styles.bottomTagline}>Every step tells a story.</Text>
        </Animated.View>
      </ImageBackground>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    pointerEvents: 'none' as const,
  },
  background: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topContent: {
    alignItems: 'center',
    paddingTop: 100,
  },
  logo: {
    width: 110,
    height: 110,
  },
  wordmark: {
    fontFamily: Typography.fontDisplay,
    fontSize: 40,
    color: Palette.ink[700],
    marginTop: 12,
    letterSpacing: 0.5,
  },
  tagline: {
    fontFamily: Typography.fontRegular,
    fontSize: 15,
    color: Palette.ink[600],
    marginTop: 6,
    letterSpacing: 0.3,
  },
  bottomBar: {
    backgroundColor: Palette.ink[700],
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  bottomTagline: {
    fontFamily: Typography.fontRegular,
    fontSize: 15,
    color: Palette.slate[400],
    letterSpacing: 0.4,
  },
});
