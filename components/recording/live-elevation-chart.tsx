/**
 * LiveElevationChart — real-time elevation profile for the recording screen.
 *
 * Renders a filled area chart from TrackPoint[] with green colouring.
 * Returns null when fewer than 2 points have altitude data.
 * Photo markers appear at their cumulative distance position.
 */
import { useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, {
    Circle,
    Defs,
    LinearGradient,
    Path,
    Stop,
    Text as SvgText,
} from 'react-native-svg';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { TrackPoint } from '@/lib/db/track-points';
import { haversineMetres } from '@/lib/location/haversine';

interface PhotoMarkerInput {
  id: string;
  timestamp: number;
  latitude: number;
  longitude: number;
}

interface LiveElevationChartProps {
  points: TrackPoint[];
  photos?: PhotoMarkerInput[];
  height?: number;
}

const PAD_TOP = 12;
const PAD_BOTTOM = 22;
const PAD_LEFT = 44;
const PAD_RIGHT = 10;

const CHART_COLOR = '#2e7d32';
const CHART_FILL_TOP = '#66bb6a';
const CHART_FILL_BOT = '#e8f5e9';
const PHOTO_DOT_COLOR = '#1b5e20';

export function LiveElevationChart({ points, photos = [], height = 160 }: LiveElevationChartProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  const { width: screenWidth } = useWindowDimensions();

  const svgWidth = screenWidth - 32;
  const chartW = svgWidth - PAD_LEFT - PAD_RIGHT;
  const chartH = height - PAD_TOP - PAD_BOTTOM;

  const computed = useMemo(() => {
    const altPoints = points.filter((p) => p.altitudeMetres !== null) as (TrackPoint & {
      altitudeMetres: number;
    })[];
    if (altPoints.length < 1) return null;

    const rawMin = Math.min(...altPoints.map((p) => p.altitudeMetres));
    const rawMax = Math.max(...altPoints.map((p) => p.altitudeMetres));
    // Pad flat/near-flat sections so the chart always has visible height
    const range = rawMax - rawMin;
    const pad = range < 10 ? (10 - range) / 2 : 0;
    const minAlt = rawMin - pad;
    const maxAlt = rawMax + pad;

    // Cumulative distances — single point gets zero distance
    const cumDist: number[] = [0];
    for (let i = 1; i < altPoints.length; i++) {
      const prev = altPoints[i - 1]!;
      const curr = altPoints[i]!;
      cumDist.push(
        cumDist[i - 1]! + haversineMetres(prev.latitude, prev.longitude, curr.latitude, curr.longitude),
      );
    }
    const totalDist = cumDist[cumDist.length - 1]!;

    // For a single point, spread it across the full chart width
    const toX = (d: number) =>
      totalDist > 0 ? PAD_LEFT + (d / totalDist) * chartW : PAD_LEFT + chartW / 2;
    const toY = (a: number) =>
      PAD_TOP + chartH - ((a - minAlt) / (maxAlt - minAlt)) * chartH;

    const pts = altPoints.map(
      (p, i) => `${toX(cumDist[i]!).toFixed(1)},${toY(p.altitudeMetres).toFixed(1)}`,
    );
    const linePath = `M ${pts.join(' L ')}`;
    const lastX = toX(totalDist);
    const firstX = toX(0);
    const baseY = (PAD_TOP + chartH).toFixed(1);
    const fillPath = `M ${pts.join(' L ')} L ${lastX.toFixed(1)},${baseY} L ${firstX.toFixed(1)},${baseY} Z`;

    // Gain/loss
    let gain = 0;
    let loss = 0;
    for (let i = 1; i < altPoints.length; i++) {
      const diff = altPoints[i]!.altitudeMetres - altPoints[i - 1]!.altitudeMetres;
      if (diff > 0) gain += diff;
      else loss -= diff;
    }

    // Photo markers: nearest point by timestamp
    const photoMarkers: { x: number; y: number }[] = [];
    for (const photo of photos) {
      let nearestIdx = 0;
      let nearestDiff = Infinity;
      for (let i = 0; i < altPoints.length; i++) {
        const diff = Math.abs(altPoints[i]!.timestamp - photo.timestamp);
        if (diff < nearestDiff) {
          nearestDiff = diff;
          nearestIdx = i;
        }
      }
      photoMarkers.push({
        x: toX(cumDist[nearestIdx]!),
        y: toY(altPoints[nearestIdx]!.altitudeMetres),
      });
    }

    const distKm = totalDist / 1000;
    const xLabel =
      distKm >= 1 ? `${distKm.toFixed(2)} km` : `${Math.round(totalDist)} m`;

    return {
      linePath,
      fillPath,
      minAlt,
      maxAlt,
      gain: Math.round(gain),
      xLabel,
      photoMarkers,
      toX,
      toY,
      totalDist,
    };
  }, [points, photos, chartW, chartH]);

  if (!computed) {
    return (
      <View style={[styles.placeholder, { height, width: svgWidth }]}>
        <Text style={styles.placeholderText}>Waiting for GPS altitude…</Text>
      </View>
    );
  }

  const { linePath, fillPath, minAlt, maxAlt, gain, xLabel, photoMarkers } = computed;

  return (
    <View>
      {/* Summary labels */}
      <View style={styles.summaryRow}>
        <Text style={styles.summaryMin}>Min {Math.round(minAlt)} m</Text>
        <Text style={styles.summaryMax}>Max {Math.round(maxAlt)} m</Text>
        <Text style={styles.summaryGain}>Gain {gain} m</Text>
      </View>

      <Svg width={svgWidth} height={height}>
        <Defs>
          <LinearGradient id="liveElevFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={CHART_FILL_TOP} stopOpacity={0.7} />
            <Stop offset="1" stopColor={CHART_FILL_BOT} stopOpacity={0.1} />
          </LinearGradient>
        </Defs>

        {/* Filled area */}
        <Path d={fillPath} fill="url(#liveElevFill)" />

        {/* Line */}
        <Path d={linePath} stroke={CHART_COLOR} strokeWidth={2} fill="none" />

        {/* Y axis labels */}
        <SvgText
          x={PAD_LEFT - 4}
          y={PAD_TOP + 4}
          textAnchor="end"
          fontSize={10}
          fill={colors.textMuted}
          fontFamily={Typography.fontMedium}
        >
          {Math.round(maxAlt)} m
        </SvgText>
        <SvgText
          x={PAD_LEFT - 4}
          y={PAD_TOP + chartH}
          textAnchor="end"
          fontSize={10}
          fill={colors.textMuted}
          fontFamily={Typography.fontMedium}
        >
          {Math.round(minAlt)} m
        </SvgText>

        {/* X axis label */}
        <SvgText
          x={svgWidth - PAD_RIGHT}
          y={height - 4}
          textAnchor="end"
          fontSize={10}
          fill={colors.textMuted}
          fontFamily={Typography.fontMedium}
        >
          {xLabel}
        </SvgText>

        {/* Photo markers */}
        {photoMarkers.map((marker, i) => (
          <Circle
            key={i}
            cx={marker.x}
            cy={marker.y}
            r={6}
            fill={colors.backgroundCard}
            stroke={PHOTO_DOT_COLOR}
            strokeWidth={1.5}
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  summaryMin: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.xs,
    color: '#1565c0',
  },
  summaryMax: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.xs,
    color: '#1565c0',
  },
  summaryGain: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.xs,
    color: '#2e7d32',
  },
  placeholder: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'dashed' as const,
    borderColor: '#ccc',
  },
  placeholderText: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.xs,
    color: '#999',
  },
});
