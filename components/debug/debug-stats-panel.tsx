import { useMutation } from 'convex/react';
import Constants from 'expo-constants';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { useQueuedWalk } from '@/contexts/queued-walk-context';
import { useWalkSessionContext } from '@/contexts/walk-session-context';
import { api } from '@/convex/_generated/api';
import { type FeatureFlags } from '@/hooks/use-feature-flags';
import { type DbDebugStats, getDbDebugStats } from '@/lib/db/debug-stats';
import { type AppLogEntry, clearLogs, getLogs } from '@/lib/diagnostics/logger';

type ColorPalette = typeof Colors.light | typeof Colors.dark;

interface Props {
  flags: FeatureFlags;
  colors: ColorPalette;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatTs(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({ title, colors }: { title: string; colors: ColorPalette }) {
  return (
    <Text style={[styles.sectionHeader, { color: colors.primary }]}>{title.toUpperCase()}</Text>
  );
}

function StatRow({
  label,
  value,
  colors,
  accent,
  indent,
}: {
  label: string;
  value: string;
  colors: ColorPalette;
  accent?: boolean;
  indent?: boolean;
}) {
  return (
    <View style={[styles.row, indent && styles.rowIndent]}>
      <Text style={[styles.rowLabel, { color: indent ? colors.textMuted : colors.text }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.rowValue, { color: accent ? colors.primary : colors.textMuted }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function DebugStatsPanel({ flags, colors }: Props) {
  const { state: session } = useWalkSessionContext();
  const { queuedWalk } = useQueuedWalk();
  const [dbStats, setDbStats] = useState<DbDebugStats | null>(null);
  const [logs, setLogs] = useState<AppLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const submitLogs = useMutation(api.device_logs.submit);

  const refresh = useCallback(() => {
    setLoading(true);
    try {
      setDbStats(getDbDebugStats());
      setLogs(getLogs());
      setSendStatus('idle');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleClearLogs = useCallback(() => {
    clearLogs();
    setLogs([]);
    setDbStats((prev) => prev ? { ...prev, appLogCount: 0 } : prev);
  }, []);

  const handleSendLogs = useCallback(async () => {
    setSendStatus('sending');
    try {
      const deviceId = Constants.deviceId ?? `${Platform.OS}-${Platform.Version}`;
      const appVersion = Constants.expoConfig?.version ?? '0.0.0';
      // Send at most the 200 most-recent entries (already sorted newest-first).
      const entries = getLogs().slice(0, 200).map((e) => ({
        ts: e.ts,
        level: e.level,
        tag: e.tag,
        message: e.message,
        stack: e.stack ?? undefined,
        context: e.context ?? undefined,
      }));
      await submitLogs({ deviceId, appVersion, entries });
      setSendStatus('sent');
    } catch {
      setSendStatus('error');
    }
  }, [submitLogs]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <View style={styles.container}>
      {/* Refresh button */}
      <View style={styles.headerRow}>
        <Text style={[styles.panelTitle, { color: colors.textMuted }]}>Tap rows to copy. Fetched at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.</Text>
        <Pressable onPress={refresh} hitSlop={8} disabled={loading}>
          {loading
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Text style={[styles.refreshBtn, { color: colors.primary }]}>↺ Refresh</Text>}
        </Pressable>
      </View>

      {/* ── Walk Session ── */}
      <SectionHeader title="Walk Session" colors={colors} />
      <View style={[styles.card, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
        <StatRow
          label="Phase"
          value={session.phase}
          colors={colors}
          accent={session.phase !== 'idle'}
        />
        {session.phase !== 'idle' && (
          <>
            <StatRow label="Walk ID" value={session.walkId.slice(0, 12) + '…'} colors={colors} />
            <StatRow label="Started" value={formatTs(session.startedAt)} colors={colors} />
            {'isLive' in session && (
              <StatRow label="Live broadcast" value={session.isLive ? 'Yes' : 'No'} colors={colors} />
            )}
          </>
        )}
      </View>

      {/* ── Queued Walk ── */}
      <SectionHeader title="Queued Walk" colors={colors} />
      <View style={[styles.card, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
        {queuedWalk ? (
          <>
            <StatRow label="Title" value={queuedWalk.title ?? '(untitled)'} colors={colors} accent />
            <StatRow label="ID" value={queuedWalk._id.slice(0, 12) + '…'} colors={colors} />
            <StatRow label="Visibility" value={queuedWalk.visibility ?? '—'} colors={colors} />
          </>
        ) : (
          <StatRow label="Status" value="None queued" colors={colors} />
        )}
      </View>

      {/* ── Feature Flags ── */}
      <SectionHeader title="Feature Flags" colors={colors} />
      <View style={[styles.card, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
        {(Object.entries(flags) as [string, unknown][]).map(([key, val]) => (
          <StatRow key={key} label={key} value={String(val)} colors={colors} />
        ))}
      </View>

      {/* ── Database ── */}
      <SectionHeader title="Database" colors={colors} />
      <View style={[styles.card, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
        {dbStats === null ? (
          <StatRow label="Status" value="Loading…" colors={colors} />
        ) : (
          <>
            <StatRow label="DB file size" value={formatBytes(dbStats.dbSizeBytes)} colors={colors} accent />
            <StatRow label="Walks (total)" value={String(dbStats.totalWalks)} colors={colors} />
            {dbStats.walkCounts.map(w => (
              <StatRow key={w.status} label={w.status} value={String(w.count)} colors={colors} indent />
            ))}
            <StatRow label="Track points" value={dbStats.trackPointCount.toLocaleString()} colors={colors} />
            <StatRow label="Waypoints" value={String(dbStats.waypointCount)} colors={colors} />
            <StatRow label="Photos (total)" value={String(dbStats.totalPhotos)} colors={colors} />
            {dbStats.photoCounts.map(p => (
              <StatRow key={p.status} label={p.status} value={String(p.count)} colors={colors} indent />
            ))}
            <StatRow label="Sync jobs (total)" value={String(dbStats.totalSyncJobs)} colors={colors} />
            {dbStats.syncJobCounts.map(j => (
              <StatRow key={j.status} label={j.status} value={String(j.count)} colors={colors} indent />
            ))}
            <StatRow label="Explore routes" value={String(dbStats.exploreRoutesCount)} colors={colors} />
            <StatRow label="Explore regions cached" value={String(dbStats.exploreRegionCacheCount)} colors={colors} />
            <StatRow label="App log entries" value={dbStats.appLogCount.toLocaleString()} colors={colors} />
            <StatRow label="KV store entries" value={String(dbStats.kvEntryCount)} colors={colors} />
          </>
        )}
      </View>

      {/* ── App Logs ── */}
      <View style={[styles.sectionHeaderRow]}>
        <SectionHeader title="App Logs (newest first)" colors={colors} />
        {logs.length > 0 && (
          <Pressable onPress={handleClearLogs} hitSlop={8}>
            <Text style={[styles.clearBtn, { color: colors.textMuted }]}>Clear</Text>
          </Pressable>
        )}
      </View>

      {/* Send Logs button */}
      <Pressable
        style={[
          styles.sendBtn,
          {
            backgroundColor:
              sendStatus === 'sent'  ? colors.success ?? '#2e7d32' :
              sendStatus === 'error' ? '#c0392b' :
              colors.primary,
            opacity: sendStatus === 'sending' || sendStatus === 'sent' ? 0.7 : 1,
          },
        ]}
        onPress={handleSendLogs}
        disabled={sendStatus === 'sending' || sendStatus === 'sent'}
      >
        {sendStatus === 'sending' ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.sendBtnText}>
            {sendStatus === 'sent'  ? '✓ Logs sent to Convex' :
             sendStatus === 'error' ? '⚠ Send failed — tap ↺ to retry' :
             '↑ Send logs to Convex'}
          </Text>
        )}
      </Pressable>
      <View style={[styles.card, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
        {logs.length === 0 ? (
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textMuted }]}>No entries</Text>
          </View>
        ) : (
          logs.map((entry) => (
            <View key={entry.id} style={[styles.logEntry, { borderBottomColor: colors.border }]}>
              <View style={styles.logEntryHeader}>
                <Text style={[styles.logBadge, { backgroundColor: levelColor(entry.level) }]}>
                  {entry.level.toUpperCase()}
                </Text>
                <Text style={[styles.logTag, { color: colors.primary }]}>{entry.tag}</Text>
                <Text style={[styles.logTs, { color: colors.textMuted }]}>{formatTs(entry.ts)}</Text>
              </View>
              <Text style={[styles.logMessage, { color: colors.text }]} numberOfLines={3}>
                {entry.message}
              </Text>
              {entry.stack ? (
                <Text style={[styles.logStack, { color: colors.textMuted }]} numberOfLines={4}>
                  {entry.stack}
                </Text>
              ) : null}
              {entry.context ? (
                <Text style={[styles.logStack, { color: colors.textMuted }]} numberOfLines={2}>
                  {entry.context}
                </Text>
              ) : null}
            </View>
          ))
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function levelColor(level: AppLogEntry['level']): string {
  switch (level) {
    case 'error': return '#c0392b';
    case 'warn':  return '#e67e22';
    case 'info':  return '#2980b9';
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  panelTitle: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.xs,
    flex: 1,
  },
  refreshBtn: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.sm,
  },
  sectionHeader: {
    fontFamily: Typography.fontBold,
    fontSize: Typography.sizes.xs,
    letterSpacing: 0.8,
    marginTop: Spacing.sm,
    marginBottom: 2,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
  },
  rowIndent: {
    paddingLeft: Spacing.base,
  },
  rowLabel: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.xs,
    flex: 1,
  },
  rowValue: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.xs,
    textAlign: 'right',
    maxWidth: '50%',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clearBtn: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.xs,
    marginTop: Spacing.sm,
  },
  logEntry: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  logEntryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  logBadge: {
    fontFamily: Typography.fontBold,
    fontSize: 9,
    color: '#ffffff',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    overflow: 'hidden',
  },
  logTag: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.xs,
    flex: 1,
  },
  logTs: {
    fontFamily: Typography.fontRegular,
    fontSize: 10,
  },
  logMessage: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.xs,
  },
  logStack: {
    fontFamily: Typography.fontRegular,
    fontSize: 10,
    marginTop: 1,
  },
  sendBtn: {
    borderRadius: 8,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    minHeight: 36,
  },
  sendBtnText: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.sm,
    color: '#ffffff',
  },
});
