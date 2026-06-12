import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { ClipPath, Defs, G, LinearGradient, Polygon, Rect, Stop } from 'react-native-svg';
import { useEffect, useId, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useBadgeShineEffect } from '@/hooks/use-badge-shine-effect';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { badgeIconName } from '@/lib/badges/badge-icons';
import {
  SHINE_EFFECT_CONFIG,
  type BadgeShineEffect,
} from '@/lib/badges/shine-effects';
import { TIER_BORDER, type BadgeTier } from '@/lib/badges/tier-styles';
import type { BadgeGalleryStatus } from '@/lib/badges/types';

const VIEW_W = 68;
const VIEW_H = 64;
const HEX_POINTS = '34,2 64,17 64,47 34,62 4,47 4,17';

const SIZES = {
  sm: { outer: 52, icon: 18 },
  md: { outer: 68, icon: 22 },
} as const;

const LOCKED_FILL = '#E5E7EB';
const IN_PROGRESS_EMPTY = '#D1D5DB';

type BadgeHexProps = {
  name?: string;
  icon: string;
  categoryColor: string;
  tier?: BadgeTier;
  status: BadgeGalleryStatus;
  progressPercent?: number;
  isNew?: boolean;
  size?: 'sm' | 'md';
  /** Pixel width override (gallery / large cells). */
  outerSize?: number;
  /** Scale hex to 100% of parent width (overview 5-column grid). */
  fillWidth?: boolean;
  /** Override global admin shine style (e.g. admin preview). */
  shineEffect?: BadgeShineEffect;
  onPress?: () => void;
};

/** Diagonal shine band — SVG gradient translated across the hex clip. */
function BadgeShineOverlay({
  width,
  height,
  effect,
  animate,
}: {
  width: number;
  height: number;
  effect: BadgeShineEffect;
  animate: boolean;
}) {
  const gradId = useId().replace(/:/g, '');
  const config = SHINE_EFFECT_CONFIG[effect];
  const span = Math.max(width, height);
  const bandW = span * config.bandScale;
  const bandH = span * 2;
  const travel = span * 1.35;
  const translate = useSharedValue(-travel);

  useEffect(() => {
    if (!animate) return;
    translate.value = -travel;
    translate.value = withRepeat(
      withTiming(travel, { duration: config.duration, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, [animate, travel, translate, config.duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translate.value }, { rotate: '35deg' }],
  }));

  return (
    <View style={styles.shineClip} pointerEvents="none">
      <Animated.View
        style={[
          styles.shineBandWrap,
          {
            width: bandW,
            height: bandH,
            top: (height - bandH) / 2,
            left: (width - bandW) / 2,
          },
          animate ? animatedStyle : { transform: [{ translateX: 0 }, { rotate: '35deg' }] },
        ]}
      >
        <Svg width={bandW} height={bandH}>
          <Defs>
            <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
              {config.stops.map((stop) => (
                <Stop
                  key={stop.offset}
                  offset={String(stop.offset)}
                  stopColor="#fff"
                  stopOpacity={stop.opacity}
                />
              ))}
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={bandW} height={bandH} fill={`url(#${gradId})`} />
        </Svg>
      </Animated.View>
    </View>
  );
}

export function BadgeHex({
  name,
  icon,
  categoryColor,
  tier,
  status,
  progressPercent = 0,
  isNew = false,
  size = 'md',
  outerSize,
  fillWidth = false,
  shineEffect: shineEffectOverride,
  onPress,
}: BadgeHexProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const shineEffect = useBadgeShineEffect(shineEffectOverride);
  const reduceMotion = useReducedMotion();
  const outer = outerSize ?? SIZES[size].outer;
  const iconSize =
    fillWidth || outerSize != null
      ? Math.max(12, Math.round(outer * 0.3))
      : SIZES[size].icon;
  const hexAspect = VIEW_H / VIEW_W;
  const dims = { outer, iconSize };
  const locked = status === 'locked';
  const earned = status === 'earned';
  const inProgress = status === 'in_progress';
  const fillPercent = Math.min(100, Math.max(0, progressPercent));
  const borderColor = tier ? TIER_BORDER[tier] : 'rgba(255,255,255,0.35)';
  const showNewShine = isNew && earned;
  const baseFill = locked ? LOCKED_FILL : inProgress ? IN_PROGRESS_EMPTY : categoryColor;
  const fillHeight = (VIEW_H * fillPercent) / 100;
  const clipId = useId();
  const [hexLayout, setHexLayout] = useState({
    width: dims.outer,
    height: dims.outer * hexAspect,
  });

  const hexFrameStyle = fillWidth
    ? { width: '100%' as const, aspectRatio: VIEW_W / VIEW_H }
    : { width: dims.outer, height: dims.outer * hexAspect };

  const hexBody = (
    <View style={[styles.cell, fillWidth ? styles.cellFill : { width: dims.outer }]}>
      <View
        style={hexFrameStyle}
        onLayout={
          fillWidth
            ? (e) => {
                const { width, height } = e.nativeEvent.layout;
                if (width > 0 && height > 0) {
                  setHexLayout({ width, height });
                }
              }
            : undefined
        }
      >
        <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
          <Defs>
            <ClipPath id={clipId}>
              <Polygon points={HEX_POINTS} />
            </ClipPath>
          </Defs>
          <Polygon
            points={HEX_POINTS}
            fill={baseFill}
            stroke={locked ? '#CBD5E1' : borderColor}
            strokeWidth={2}
          />
          {inProgress && fillPercent > 0 ? (
            <G clipPath={`url(#${clipId})`}>
              <Rect
                x={0}
                y={VIEW_H - fillHeight}
                width={VIEW_W}
                height={fillHeight}
                fill={categoryColor}
              />
            </G>
          ) : null}
        </Svg>

        <View style={styles.overlay} pointerEvents="none">
          {showNewShine ? (
            <BadgeShineOverlay
              width={hexLayout.width}
              height={hexLayout.height}
              effect={shineEffect}
              animate={!reduceMotion}
            />
          ) : null}
          <View style={styles.iconWrap}>
            <Ionicons
              name={badgeIconName(icon)}
              size={dims.iconSize}
              color={locked ? 'rgba(255,255,255,0.7)' : '#fff'}
            />
          </View>
          {earned ? (
            <View style={[styles.check, { backgroundColor: colors.backgroundCard }]}>
              <Ionicons name="checkmark" size={10} color={colors.success} />
            </View>
          ) : null}
          {showNewShine ? (
            <View style={[styles.newPill, { backgroundColor: colors.primary }]}>
              <ThemedText style={styles.newPillText}>NEW</ThemedText>
            </View>
          ) : null}
        </View>
      </View>

      {name ? (
        <ThemedText
          type="caption"
          numberOfLines={2}
          style={[styles.name, { color: locked ? colors.textMuted : colors.text }]}
        >
          {name}
        </ThemedText>
      ) : null}
    </View>
  );

  if (!onPress) return hexBody;

  return (
    <Pressable onPress={onPress} style={styles.pressable} accessibilityRole="button">
      {hexBody}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: { alignItems: 'center' },
  cell: { alignItems: 'center', gap: Spacing.xs },
  cellFill: { width: '100%', alignSelf: 'stretch' },
  overlay: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  iconWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  check: {
    position: 'absolute',
    right: 8,
    bottom: 6,
    width: 16,
    height: 16,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newPill: {
    position: 'absolute',
    top: 0,
    right: 0,
    borderRadius: Radius.full,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  newPillText: {
    color: '#fff',
    fontSize: 8,
    fontFamily: Typography.fontBold,
    letterSpacing: 0.5,
  },
  name: { textAlign: 'center', lineHeight: 12, fontSize: 10, minHeight: 24 },
  shineClip: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  shineBandWrap: { position: 'absolute' },
});
