import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { BetaBadge } from '@/components/account/beta-badge';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useAppQuery } from '@/hooks/use-app-query';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  getManageBillingAction,
  getPlanDisplayName,
  getPlanTagline,
  getStatusDisplayName,
  getUpgradeAction,
  PLAN_BENEFITS,
  STATUS_COLORS,
  type BillingActionState,
  type UserSubscription,
} from '@/lib/subscription';

function BillingActionButton({
  label,
  variant,
  action,
}: {
  label: string;
  variant: 'primary' | 'secondary';
  action: BillingActionState;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const disabled = !action.enabled;

  return (
    <Pressable
      disabled={disabled}
      accessibilityState={{ disabled }}
      accessibilityHint={disabled ? action.reason : undefined}
      style={[
        styles.billingButton,
        variant === 'primary'
          ? {
              backgroundColor: disabled ? colors.backgroundMuted : colors.primary,
            }
          : {
              backgroundColor: 'transparent',
              borderWidth: 1,
              borderColor: disabled ? colors.border : colors.border,
            },
      ]}
    >
      <ThemedText
        style={[
          styles.billingButtonLabel,
          {
            color:
              variant === 'primary'
                ? disabled
                  ? colors.textMuted
                  : colors.textInverse
                : disabled
                  ? colors.textMuted
                  : colors.text,
            fontFamily: Typography.fontMedium,
          },
        ]}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

function PlanCardSkeleton() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.backgroundCard }]}>
      <View style={[styles.skeletonHeader, { backgroundColor: colors.backgroundMuted }]} />
      <View style={styles.skeletonBody}>
        <ActivityIndicator color={colors.primary} />
      </View>
    </View>
  );
}

export function SubscriptionPanel() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const summary = useAppQuery(api.users.getAccountSummary);
  const subscription: UserSubscription | null = summary?.subscription ?? null;
  const loading = summary === undefined;

  if (loading) {
    return <PlanCardSkeleton />;
  }

  const sub = subscription ?? { plan: 'beta' as const, status: 'active' as const };
  const plan = sub.plan;
  const upgradeAction = getUpgradeAction(sub);
  const billingAction = getManageBillingAction(sub);
  const benefits = PLAN_BENEFITS[plan];
  const statusColors = STATUS_COLORS[sub.status];

  return (
    <View style={styles.container}>
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.backgroundCard }]}>
        <View
          style={[
            styles.planHeader,
            {
              borderBottomColor: colors.border,
              backgroundColor: colorScheme === 'dark' ? colors.backgroundMuted : '#fffbeb',
            },
          ]}
        >
          <View style={styles.planHeaderTop}>
            <View style={styles.planTitleRow}>
              <ThemedText type="subtitle" style={styles.planName}>
                {getPlanDisplayName(plan)}
              </ThemedText>
              {plan === 'beta' && <BetaBadge />}
            </View>
            <View style={[styles.statusPill, { backgroundColor: statusColors.background }]}>
              <ThemedText
                style={[
                  styles.statusLabel,
                  { color: statusColors.text, fontFamily: Typography.fontMedium },
                ]}
              >
                {getStatusDisplayName(sub.status)}
              </ThemedText>
            </View>
          </View>
          <ThemedText type="caption" style={{ color: colors.textMuted, lineHeight: 18 }}>
            {getPlanTagline(plan)}
          </ThemedText>
        </View>

        <View style={styles.planBody}>
          <ThemedText
            style={[
              styles.sectionEyebrow,
              { color: colors.textMuted, fontFamily: Typography.fontMedium },
            ]}
          >
            WHAT&apos;S INCLUDED
          </ThemedText>
          <View style={styles.benefitsList}>
            {benefits.map((benefit) => (
              <View key={benefit} style={styles.benefitRow}>
                <Ionicons name="checkmark-circle" size={16} color="#059669" />
                <ThemedText type="caption" style={{ color: colors.text, flex: 1, lineHeight: 18 }}>
                  {benefit}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.backgroundCard }]}>
        <ThemedText
          style={[
            styles.sectionEyebrow,
            { color: colors.textMuted, fontFamily: Typography.fontMedium },
          ]}
        >
          BILLING
        </ThemedText>
        <View style={styles.billingActions}>
          <BillingActionButton label="Upgrade plan" variant="primary" action={upgradeAction} />
          <BillingActionButton label="Manage billing" variant="secondary" action={billingAction} />
        </View>
        <ThemedText type="caption" style={{ color: colors.textMuted, lineHeight: 18, marginTop: Spacing.sm }}>
          Paid plans and self-service billing will be powered by Stripe. Your account is ready — no
          payment details are collected during beta.
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.base,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  planHeader: {
    padding: Spacing.base,
    gap: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  planHeaderTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  planTitleRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  planName: {
    fontSize: Typography.sizes.base,
  },
  statusPill: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  statusLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  planBody: {
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  sectionEyebrow: {
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  benefitsList: {
    gap: Spacing.sm,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  billingActions: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  billingButton: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    alignItems: 'center',
  },
  billingButtonLabel: {
    fontSize: Typography.sizes.sm,
  },
  skeletonHeader: {
    height: 96,
  },
  skeletonBody: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
});
