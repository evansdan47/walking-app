/**
 * ElevationChart — reusable SVG elevation profile.
 *
 * Renders a filled area chart from an ElevationPoint[] array using react-native-svg.
 * Returns null when data is insufficient (fewer than 2 points).
 */
import { useMemo } from 'react';
import { useWindowDimensions, View, type ViewStyle } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

import { Colors, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { ElevationPoint } from '@/lib/review/build-elevation-profile';

interface ElevationChartProps {
  data: ElevationPoint[];
  height?: number;
  style?: ViewStyle;
}

const PAD_TOP = 28;     // space above chart area for max label
const PAD_BOTTOM = 22;  // space below chart area for axis labels
const PAD_LEFT = 48;    // space left of chart area for y-axis labels
const PAD_RIGHT = 12;   // right margin

function fmtAlt(m: number): string {
  return `${Math.round(m)} m`;
}

function fmtDist(metres: number): string {
  if (metres >= 1000) return `${(metres / 1000).toFixed(2)} km`;
  return `${Math.round(metres)} m`;
}

function buildPath(
  data: ElevationPoint[],
  minAlt: number,
  maxAlt: number,
  chartW: number,
  chartH: number,
  totalDist: number,
): { linePath: string; fillPath: string } {
  const altRange = maxAlt - minAlt;

  const toX = (d: number) => PAD_LEFT + (d / totalDist) * chartW;
  const toY = (a: number) =>
    PAD_TOP + chartH - ((a - minAlt) / altRange) * chartH;

  const pts = data.map((p) => `${toX(p.distanceMetres).toFixed(1)},${toY(p.altitudeMetres).toFixed(1)}`);

  const linePath = `M ${pts.join(' L ')}`;

  // Close the fill path back along the bottom
  const lastX = toX(data[data.length - 1]!.distanceMetres);
  const firstX = toX(data[0]!.distanceMetres);
  const baseY = (PAD_TOP + chartH).toFixed(1);
  const fillPath = `M ${pts.join(' L ')} L ${lastX.toFixed(1)},${baseY} L ${firstX.toFixed(1)},${baseY} Z`;

  return { linePath, fillPath };
}

export function ElevationChart({ data, height = 180, style }: ElevationChartProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  const { width: screenWidth } = useWindowDimensions();

  const svgWidth = screenWidth - 32; // account for card horizontal padding (Spacing.base × 2)

  const chartW = svgWidth - PAD_LEFT - PAD_RIGHT;
  const chartH = height - PAD_TOP - PAD_BOTTOM;

  const { minAlt, maxAlt, totalDist, linePath, fillPath, minY, maxY, minX, maxX } =
    useMemo(() => {
      if (data.length < 2) return null as never;

      const minAlt = Math.min(...data.map((p) => p.altitudeMetres));
      const maxAlt = Math.max(...data.map((p) => p.altitudeMetres));
      const totalDist = data[data.length - 1]!.distanceMetres;
      const altRange = maxAlt - minAlt;

      const toX = (d: number) => PAD_LEFT + (d / totalDist) * chartW;
      const toY = (a: number) => PAD_TOP + chartH - ((a - minAlt) / altRange) * chartH;

      const { linePath, fillPath } = buildPath(data, minAlt, maxAlt, chartW, chartH, totalDist);

      return {
        minAlt,
        maxAlt,
        totalDist,
        linePath,
        fillPath,
        minY: toY(minAlt),
        maxY: toY(maxAlt),
        minX: toX(data[0]!.distanceMetres),
        maxX: toX(totalDist),
      };
    }, [data, chartW, chartH]);

  if (data.length < 2) return null;

  // Use primary colour (ochre in light) for the chart line, blue for reference lines
  const CHART_COLOR = '#1565c0';  // rich blue — matches design reference
  const CHART_FILL_TOP = '#90caf9';  // light blue fill top
  const CHART_FILL_BOT = '#e3f2fd';  // near-white fill bottom
  const REF_LINE_COLOR = '#90caf9';  // dashed reference lines
  const LABEL_COLOR_MIN = CHART_COLOR;
  const LABEL_COLOR_MAX = CHART_COLOR;
  const TEXT_MUTED = colors.textMuted;

  return (
    <View style={style}>
      <Svg width={svgWidth} height={height}>
        <Defs>
          <LinearGradient id="elevFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={CHART_FILL_TOP} stopOpacity={0.6} />
            <Stop offset="1" stopColor={CHART_FILL_BOT} stopOpacity={0.1} />
          </LinearGradient>
        </Defs>

        {/* Dashed min reference line */}
        <Line
          x1={PAD_LEFT}
          y1={minY}
          x2={PAD_LEFT + chartW}
          y2={minY}
          stroke={REF_LINE_COLOR}
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        {/* Dashed max reference line */}
        <Line
          x1={PAD_LEFT}
          y1={maxY}
          x2={PAD_LEFT + chartW}
          y2={maxY}
          stroke={REF_LINE_COLOR}
          strokeWidth={1}
          strokeDasharray="4 4"
        />

        {/* Filled gradient area */}
        <Path d={fillPath} fill="url(#elevFill)" />

        {/* Elevation line */}
        <Path d={linePath} stroke={CHART_COLOR} strokeWidth={1.5} fill="none" />

        {/* Y-axis altitude labels (left side) */}
        <SvgText
          x={PAD_LEFT - 4}
          y={maxY + 4}
          fontSize={10}
          fontFamily={Typography.fontRegular}
          fill={TEXT_MUTED}
          textAnchor="end"
        >
          {fmtAlt(maxAlt)}
        </SvgText>
        <SvgText
          x={PAD_LEFT - 4}
          y={minY + 4}
          fontSize={10}
          fontFamily={Typography.fontRegular}
          fill={TEXT_MUTED}
          textAnchor="end"
        >
          {fmtAlt(minAlt)}
        </SvgText>

        {/* Min label bottom-left (coloured) */}
        <SvgText
          x={PAD_LEFT}
          y={height - 4}
          fontSize={10}
          fontFamily={Typography.fontMedium}
          fill={LABEL_COLOR_MIN}
          textAnchor="start"
        >
          {`Min ${fmtAlt(minAlt)}`}
        </SvgText>

        {/* Max label top-right (coloured) */}
        <SvgText
          x={PAD_LEFT + chartW}
          y={PAD_TOP - 8}
          fontSize={10}
          fontFamily={Typography.fontMedium}
          fill={LABEL_COLOR_MAX}
          textAnchor="end"
        >
          {`Max ${fmtAlt(maxAlt)}`}
        </SvgText>

        {/* Total distance label bottom-right (muted) */}
        <SvgText
          x={PAD_LEFT + chartW}
          y={height - 4}
          fontSize={10}
          fontFamily={Typography.fontRegular}
          fill={TEXT_MUTED}
          textAnchor="end"
        >
          {fmtDist(totalDist)}
        </SvgText>
      </Svg>
    </View>
  );
}
