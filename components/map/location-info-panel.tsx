import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { latLonToOSGridRef } from '@/lib/location/grid-ref';

interface Props {
  latitude: number;
  longitude: number;
  /** Background colour (typically the card background). */
  backgroundColor: string;
  /** Primary text colour. */
  textColor: string;
  /** Secondary / muted text colour. */
  mutedColor: string;
  /** Border colour. */
  borderColor: string;
}

interface LocationDetails {
  gridRef: string;
  postcode: string | null;
  postcodeLoading: boolean;
}

/** Minimum movement (metres) before re-fetching the postcode. */
const POSTCODE_REFETCH_THRESHOLD_M = 150;

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Floating overlay panel that shows location details:
 *   • Decimal lat/lng
 *   • OS National Grid Reference
 *   • Nearest postcode (via postcodes.io — UK only, no API key required)
 *   • What3Words placeholder (requires a W3W API key to enable)
 */
export function LocationInfoPanel({
  latitude,
  longitude,
  backgroundColor,
  textColor,
  mutedColor,
  borderColor,
}: Props) {
  const [details, setDetails] = useState<LocationDetails>({
    gridRef: latLonToOSGridRef(latitude, longitude),
    postcode: null,
    postcodeLoading: true,
  });

  // Track the last postcode-fetch position to avoid refetching on every GPS update
  const lastFetchPos = useRef<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    const gridRef = latLonToOSGridRef(latitude, longitude);

    const shouldFetch =
      !lastFetchPos.current ||
      haversineM(lastFetchPos.current.lat, lastFetchPos.current.lon, latitude, longitude) >
        POSTCODE_REFETCH_THRESHOLD_M;

    if (!shouldFetch) {
      setDetails((prev) => ({ ...prev, gridRef }));
      return;
    }

    lastFetchPos.current = { lat: latitude, lon: longitude };
    setDetails((prev) => ({ ...prev, gridRef, postcodeLoading: true }));

    let cancelled = false;
    fetch(
      `https://api.postcodes.io/postcodes?lon=${longitude.toFixed(6)}&lat=${latitude.toFixed(6)}&limit=1`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const code: string | null = data?.result?.[0]?.postcode ?? null;
        setDetails((prev) => ({ ...prev, postcode: code, postcodeLoading: false }));
      })
      .catch(() => {
        if (cancelled) return;
        setDetails((prev) => ({ ...prev, postcode: null, postcodeLoading: false }));
      });

    return () => {
      cancelled = true;
    };
  }, [latitude, longitude]);

  const latStr = latitude.toFixed(6);
  const lonStr = longitude.toFixed(6);
  const postcodeStr = details.postcodeLoading
    ? '…'
    : details.postcode ?? 'N/A (outside UK)';

  return (
    <View style={styles.container}>
      <View style={[styles.card, { backgroundColor, borderColor }]}>
        <Row label="Lat" value={latStr} textColor={textColor} mutedColor={mutedColor} />
        <Row label="Lng" value={lonStr} textColor={textColor} mutedColor={mutedColor} />
        <Row label="Grid ref" value={details.gridRef} textColor={textColor} mutedColor={mutedColor} />
        <Row label="Postcode" value={postcodeStr} textColor={textColor} mutedColor={mutedColor} />
      </View>
      {/* Downward-pointing tail — single triangle matching the card background */}
      <View style={[styles.tail, { borderTopColor: backgroundColor }]} />
    </View>
  );
}

function Row({
  label,
  value,
  textColor,
  mutedColor,
  muted,
}: {
  label: string;
  value: string;
  textColor: string;
  mutedColor: string;
  muted?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: mutedColor }]}>{label}</Text>
      <Text style={[styles.value, { color: muted ? mutedColor : textColor }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const TAIL_W = 9;
const TAIL_H = 7;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  card: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 220,
    gap: 2,
  },
  /** Single downward-pointing triangle — aligned by alignSelf: 'center' on the parent. */
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: TAIL_W,
    borderRightWidth: TAIL_W,
    borderTopWidth: TAIL_H,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    // borderTopColor set inline from the backgroundColor prop
    marginTop: -1, // overlap the card's bottom border so there’s no hairline gap
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    minWidth: 58,
  },
  value: {
    fontSize: 11,
    fontFamily: 'monospace',
    flex: 1,
    textAlign: 'right',
  },
});
