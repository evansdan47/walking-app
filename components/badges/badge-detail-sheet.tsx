import { Ionicons } from '@expo/vector-icons';
import { useMutation } from 'convex/react';
import { useEffect, useRef } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BadgeHex } from '@/components/badges/badge-hex';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { badgeConfettiColors } from '@/lib/badges/badge-confetti';
import { TIER_LABEL, type BadgeTier } from '@/lib/badges/tier-styles';
import type { BadgeGalleryItem, RecentUnlockedBadge } from '@/lib/badges/types';

type BadgeDetailSheetProps = {
  badge: RecentUnlockedBadge | BadgeGalleryItem;
  categoryColor: string;
  categoryName?: string;
  open: boolean;
  onClose: () => void;
};

function formatUnlockDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function BadgeDetailSheet({
  badge,
  categoryColor,
  categoryName,
  open,
  onClose,
}: BadgeDetailSheetProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const markSeen = useMutation(api.badges.markBadgeSeen);
  const confettiRef = useRef<ConfettiCannon>(null);
  const celebratedRef = useRef(false);
  const celebrating =
    badge.isNew &&
    (('unlockedAt' in badge && Boolean(badge.unlockedAt)) ||
      ('status' in badge && badge.status === 'earned'));
  const screenWidth = Dimensions.get('window').width;
  const tierLabel = badge.tier ? TIER_LABEL[badge.tier as BadgeTier] : null;
  const description =
    'description' in badge && badge.description
      ? badge.description
      : 'description' in badge && badge.status === 'locked' && badge.lockedDescription
        ? badge.lockedDescription
        : 'Earned automatically from your walks and activity on Rambleio.';

  useEffect(() => {
    if (!open) {
      celebratedRef.current = false;
      return;
    }

    if (celebrating && !celebratedRef.current) {
      celebratedRef.current = true;
      confettiRef.current?.start();
    }

    if (badge.isNew) {
      void markSeen({ badgeKey: badge.key }).catch(() => undefined);
    }
  }, [open, celebrating, badge.isNew, badge.key, markSeen]);

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <View style={styles.confettiLayer} pointerEvents="none">
          <ConfettiCannon
            ref={confettiRef}
            count={120}
            origin={{ x: screenWidth / 2, y: -16 }}
            autoStart={false}
            fadeOut
            fallSpeed={2800}
            explosionSpeed={400}
            colors={badgeConfettiColors(categoryColor)}
          />
        </View>
        <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              paddingBottom: insets.bottom + Spacing.base,
              backgroundColor: colors.backgroundCard,
              borderColor: colors.border,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {celebrating ? (
            <ThemedText style={[styles.celebrate, { color: colors.primary }]}>
              Badge unlocked!
            </ThemedText>
          ) : null}

          <View style={styles.headerRow}>
            <BadgeHex
              icon={badge.icon}
              categoryColor={categoryColor}
              tier={badge.tier}
              status={'status' in badge ? badge.status : 'earned'}
              progressPercent={'progressPercent' in badge ? badge.progressPercent : undefined}
              isNew={badge.isNew}
              size="md"
            />
            <View style={styles.headerText}>
              <ThemedText type="bodySemiBold" style={styles.title}>
                {badge.name}
              </ThemedText>
              {categoryName ? (
                <ThemedText type="caption" style={{ color: colors.textMuted }}>
                  {categoryName}
                </ThemedText>
              ) : null}
              {tierLabel ? (
                <ThemedText type="caption" style={{ color: colors.textMuted }}>
                  {tierLabel} tier
                </ThemedText>
              ) : null}
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.icon} />
            </Pressable>
          </View>

          <ThemedText type="body" style={{ color: colors.textMuted, lineHeight: 22 }}>
            {description}
          </ThemedText>

          {'unlockedAt' in badge && badge.unlockedAt ? (
            <ThemedText style={{ color: colors.success, fontFamily: Typography.fontMedium }}>
              Earned {formatUnlockDate(badge.unlockedAt)}
            </ThemedText>
          ) : null}

          {'status' in badge &&
          badge.status === 'in_progress' &&
          badge.progressPercent !== undefined ? (
            <View style={styles.progressBlock}>
              <View style={styles.progressLabels}>
                <ThemedText type="caption">Progress</ThemedText>
                <ThemedText type="caption">{badge.progressPercent}%</ThemedText>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: colors.backgroundMuted }]}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${badge.progressPercent}%`, backgroundColor: categoryColor },
                  ]}
                />
              </View>
            </View>
          ) : null}
        </Pressable>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  confettiLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.base,
    gap: Spacing.md,
  },
  celebrate: {
    textAlign: 'center',
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: Typography.sizes.md,
  },
  progressBlock: {
    gap: Spacing.xs,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressTrack: {
    height: 8,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
});
