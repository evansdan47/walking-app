import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { clearLogs, getLogs, type AppLogEntry, type LogLevel } from '@/lib/diagnostics/logger';

// ─── Log row ────────────────────────────────────────────────────────────────

function levelColor(level: LogLevel, colors: typeof Colors.light) {
  if (level === 'error') return '#ef4444';
  if (level === 'warn')  return '#f59e0b';
  return colors.textMuted;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short',
  });
}

interface LogRowProps {
  entry: AppLogEntry;
  colors: typeof Colors.light;
}

function LogRow({ entry, colors }: LogRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = !!(entry.stack || entry.context);
  const accent = levelColor(entry.level, colors);

  return (
    <Pressable
      style={[rowStyles.row, { borderLeftColor: accent }]}
      onPress={() => hasDetail && setExpanded((v) => !v)}
    >
      <View style={rowStyles.header}>
        {/* Level badge */}
        <View style={[rowStyles.badge, { backgroundColor: accent + '22' }]}>
          <Text style={[rowStyles.badgeText, { color: accent }]}>
            {entry.level.toUpperCase()}
          </Text>
        </View>

        {/* Tag + message */}
        <View style={rowStyles.content}>
          <View style={rowStyles.titleRow}>
            <Text style={[rowStyles.tag, { color: colors.primary }]}>{entry.tag}</Text>
            <Text style={[rowStyles.time, { color: colors.textMuted }]}>
              {formatDate(entry.ts)} {formatTime(entry.ts)}
            </Text>
          </View>
          <Text style={[rowStyles.message, { color: colors.text }]} numberOfLines={expanded ? undefined : 2}>
            {entry.message}
          </Text>
        </View>

        {/* Expand chevron */}
        {hasDetail && (
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={colors.textMuted}
            style={rowStyles.chevron}
          />
        )}
      </View>

      {expanded && (
        <View style={[rowStyles.detail, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          {entry.context && (
            <View style={rowStyles.detailSection}>
              <Text style={[rowStyles.detailLabel, { color: colors.textMuted }]}>Context</Text>
              <Text style={[rowStyles.detailText, { color: colors.text }]}>
                {JSON.stringify(JSON.parse(entry.context), null, 2)}
              </Text>
            </View>
          )}
          {entry.stack && (
            <View style={rowStyles.detailSection}>
              <Text style={[rowStyles.detailLabel, { color: colors.textMuted }]}>Stack / Error</Text>
              <Text style={[rowStyles.detailText, { color: colors.text }]}>{entry.stack}</Text>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    borderLeftWidth: 3,
    marginBottom: Spacing.xs,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.xs,
  },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    alignSelf: 'flex-start',
    marginTop: 1,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  content: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  tag: {
    fontSize: 11,
    fontWeight: '600',
  },
  time: {
    fontSize: 10,
  },
  message: {
    fontSize: 12,
    lineHeight: 16,
  },
  chevron: {
    alignSelf: 'center',
    marginLeft: Spacing.xs,
  },
  detail: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  detailSection: { gap: 2 },
  detailLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  detailText: {
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 15,
  },
});

// ─── Filter bar ─────────────────────────────────────────────────────────────

type Filter = 'all' | LogLevel;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all',   label: 'All' },
  { id: 'error', label: 'Errors' },
  { id: 'warn',  label: 'Warnings' },
  { id: 'info',  label: 'Info' },
];

// ─── Main panel ─────────────────────────────────────────────────────────────

export function DiagnosticsPanel() {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  const [logs, setLogs] = useState<AppLogEntry[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const scrollRef = useRef<ScrollView>(null);

  const refresh = useCallback(() => {
    setLogs(getLogs());
  }, []);

  // Refresh when panel first mounts.
  useEffect(() => { refresh(); }, [refresh]);

  const filtered = useMemo(
    () => filter === 'all' ? logs : logs.filter((l) => l.level === filter),
    [logs, filter],
  );

  const counts = useMemo(() => ({
    error: logs.filter((l) => l.level === 'error').length,
    warn:  logs.filter((l) => l.level === 'warn').length,
    info:  logs.filter((l) => l.level === 'info').length,
  }), [logs]);

  const handleClear = () => {
    Alert.alert(
      'Clear Diagnostics',
      'Delete all log entries?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            clearLogs();
            setLogs([]);
          },
        },
      ],
    );
  };

  return (
    <View style={[panel.container, { borderColor: colors.border }]}>
      {/* Summary row */}
      <View style={[panel.summary, { borderBottomColor: colors.border }]}>
        <View style={panel.summaryLeft}>
          {counts.error > 0 && (
            <View style={[panel.pill, { backgroundColor: '#ef444420' }]}>
              <Ionicons name="close-circle" size={12} color="#ef4444" />
              <Text style={[panel.pillText, { color: '#ef4444' }]}>{counts.error} error{counts.error !== 1 ? 's' : ''}</Text>
            </View>
          )}
          {counts.warn > 0 && (
            <View style={[panel.pill, { backgroundColor: '#f59e0b20' }]}>
              <Ionicons name="warning" size={12} color="#f59e0b" />
              <Text style={[panel.pillText, { color: '#f59e0b' }]}>{counts.warn} warning{counts.warn !== 1 ? 's' : ''}</Text>
            </View>
          )}
          {counts.error === 0 && counts.warn === 0 && (
            <View style={[panel.pill, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
              <Text style={[panel.pillText, { color: colors.primary }]}>No errors</Text>
            </View>
          )}
        </View>
        <View style={panel.summaryRight}>
          <Pressable onPress={refresh} hitSlop={8} style={panel.iconBtn}>
            <Ionicons name="refresh" size={16} color={colors.textMuted} />
          </Pressable>
          <Pressable onPress={handleClear} hitSlop={8} style={panel.iconBtn}>
            <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>

      {/* Filter tabs */}
      <View style={[panel.filterRow, { borderBottomColor: colors.border }]}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.id}
            style={[panel.filterTab, filter === f.id && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setFilter(f.id)}
          >
            <Text style={[panel.filterLabel, { color: filter === f.id ? colors.primary : colors.textMuted }]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Log list */}
      {filtered.length === 0 ? (
        <View style={panel.empty}>
          <Ionicons name="document-text-outline" size={28} color={colors.textMuted} />
          <Text style={[panel.emptyText, { color: colors.textMuted }]}>
            {logs.length === 0 ? 'No logs yet' : 'Nothing matches this filter'}
          </Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={panel.list}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          {filtered.map((entry) => (
            <LogRow key={entry.id} entry={entry} colors={colors} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const panel = StyleSheet.create({
  container: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  summaryLeft: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap', flex: 1 },
  summaryRight: { flexDirection: 'row', gap: Spacing.sm },
  iconBtn: { padding: 4 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
  },
  pillText: { fontSize: 11, fontWeight: '600' },
  filterRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: 13,
  },
  list: {
    maxHeight: 400,
    padding: Spacing.sm,
  },
});
