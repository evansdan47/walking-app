'use client';

import { BetaBadge } from '@/components/account/beta-badge';
import {
  getManageBillingAction,
  getPlanDisplayName,
  getPlanTagline,
  getStatusDisplayName,
  getStatusStyle,
  getUpgradeAction,
  PLAN_BENEFITS,
  type BillingActionState,
  type SubscriptionPlan,
  type UserSubscription,
} from '@/lib/subscription';
import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';

function BillingActionButton({
  label,
  variant,
  action,
}: {
  label: string;
  variant: 'primary' | 'secondary';
  action: BillingActionState;
}) {
  const disabled = !action.enabled;
  const base =
    variant === 'primary'
      ? 'bg-brand text-white hover:bg-brand/90 disabled:bg-gray-200 disabled:text-gray-500'
      : 'border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:border-gray-200 disabled:text-gray-400 disabled:hover:bg-transparent';

  return (
    <button
      type="button"
      disabled={disabled}
      title={disabled ? action.reason : undefined}
      aria-disabled={disabled}
      className={`w-full sm:w-auto px-4 py-2 rounded-lg text-xs font-semibold transition-colors disabled:cursor-not-allowed ${base}`}
      onClick={() => {
        if (!action.enabled) return;
        // Stripe Checkout / Customer Portal — wired in a future billing phase
      }}
    >
      {label}
    </button>
  );
}

function PlanCardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden animate-pulse">
      <div className="h-24 bg-gray-100" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-gray-100 rounded w-2/3" />
        <div className="h-3 bg-gray-100 rounded w-full" />
        <div className="h-3 bg-gray-100 rounded w-5/6" />
      </div>
    </div>
  );
}

type SubscriptionPanelProps = {
  /** Dropdown vs full-page — spacing only */
  variant?: 'menu' | 'page';
};

export function SubscriptionPanel({ variant = 'menu' }: SubscriptionPanelProps) {
  const summary = useQuery(api.users.getAccountSummary);
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

  return (
    <div className={variant === 'page' ? 'space-y-6' : 'space-y-4'}>
      <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
        <div className="relative px-4 py-5 bg-gradient-to-br from-amber-50 via-white to-orange-50/40 border-b border-gray-100">
          <div
            className="absolute inset-0 opacity-25 pointer-events-none"
            aria-hidden
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 80'%3E%3Cpath fill='%23fcd34d' d='M0 80 L80 40 L160 55 L240 25 L320 50 L400 30 L400 80 Z'/%3E%3C/svg%3E")`,
              backgroundSize: 'cover',
              backgroundPosition: 'bottom',
            }}
          />
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-gray-900">{getPlanDisplayName(plan)}</h2>
                {plan === 'beta' && <BetaBadge />}
              </div>
              <p className="text-xs text-gray-600 mt-1.5 max-w-md leading-relaxed">{getPlanTagline(plan)}</p>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getStatusStyle(sub.status)}`}
            >
              {getStatusDisplayName(sub.status)}
            </span>
          </div>
        </div>

        <div className="px-4 py-4">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
            What&apos;s included
          </p>
          <ul className="space-y-2">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-2 text-xs text-gray-700">
                <svg
                  viewBox="0 0 20 20"
                  className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5"
                  fill="currentColor"
                  aria-hidden
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                    clipRule="evenodd"
                  />
                </svg>
                {benefit}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Billing
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <BillingActionButton label="Upgrade plan" variant="primary" action={upgradeAction} />
          <BillingActionButton label="Manage billing" variant="secondary" action={billingAction} />
        </div>
        <p className="text-[10px] text-gray-400 mt-3 leading-relaxed">
          Paid plans and self-service billing will be powered by Stripe. Your account is ready — no
          payment details are collected during beta.
        </p>
      </div>

      {sub.providerCustomerId && (
        <p className="text-[10px] text-gray-400 font-mono truncate" title={sub.providerCustomerId}>
          Billing account linked
        </p>
      )}
    </div>
  );
}

/** Compact plan label for nav sidebar */
export function SubscriptionNavBadge() {
  const summary = useQuery(api.users.getAccountSummary);
  if (summary === undefined) return null;
  const plan = (summary?.subscription.plan ?? 'beta') as SubscriptionPlan;
  if (plan !== 'beta') return null;

  return (
    <span className="ml-auto shrink-0 rounded-full bg-amber-100 text-amber-800 text-[9px] font-semibold px-1.5 py-0.5 leading-none">
      Beta
    </span>
  );
}
