/** Mirrors `userSubscriptionValidator` in Convex — keep in sync when plans change. */

export type SubscriptionPlan = 'beta' | 'free' | 'plus' | 'pro';
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'cancelled';

export type UserSubscription = {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  providerCustomerId?: string;
};

export const DEFAULT_SUBSCRIPTION: UserSubscription = {
  plan: 'beta',
  status: 'active',
};

const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  beta: 'Rambleio Beta',
  free: 'Rambleio Free',
  plus: 'Rambleio Plus',
  pro: 'Rambleio Pro',
};

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: 'Active',
  trialing: 'Trial',
  past_due: 'Payment issue',
  cancelled: 'Cancelled',
};

const STATUS_STYLES: Record<SubscriptionStatus, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  trialing: 'bg-sky-100 text-sky-800',
  past_due: 'bg-amber-100 text-amber-800',
  cancelled: 'bg-gray-100 text-gray-600',
};

export const PLAN_BENEFITS: Record<SubscriptionPlan, string[]> = {
  beta: [
    'Full access during the Rambleio beta programme',
    'Route planning and exploration on web',
    'Walk recording and sync from the mobile app',
    'Early access to new features as we ship them',
    'Help shape the product with your feedback',
  ],
  free: [
    'Basic walk recording and sync',
    'View completed walks on web',
    'Limited route planning',
  ],
  plus: [
    'Everything in Free',
    'Unlimited route planning and POI discovery',
    'Advanced stats and elevation profiles',
    'Priority support',
  ],
  pro: [
    'Everything in Plus',
    'Team and club features (coming soon)',
    'Export and integrations',
    'Dedicated support',
  ],
};

export function getPlanDisplayName(plan: SubscriptionPlan): string {
  return PLAN_LABELS[plan];
}

export function getStatusDisplayName(status: SubscriptionStatus): string {
  return STATUS_LABELS[status];
}

export function getStatusStyle(status: SubscriptionStatus): string {
  return STATUS_STYLES[status];
}

export function getPlanTagline(plan: SubscriptionPlan): string {
  switch (plan) {
    case 'beta':
      return 'Thank you for being a beta participant — you have complimentary access while we build Rambleio together.';
    case 'free':
      return 'Core walking tools at no cost.';
    case 'plus':
      return 'For regular walkers who want the full toolkit.';
    case 'pro':
      return 'For power users and clubs.';
  }
}

export type BillingActionState =
  | { enabled: true; action: 'stripe_checkout' | 'stripe_portal' }
  | { enabled: false; reason: string };

/** Whether the Upgrade button should be interactive (Stripe Checkout later). */
export function getUpgradeAction(subscription: UserSubscription): BillingActionState {
  if (subscription.plan === 'plus' || subscription.plan === 'pro') {
    return { enabled: false, reason: 'You are already on a paid plan.' };
  }
  if (subscription.plan === 'beta') {
    return { enabled: false, reason: 'Paid plans are not available during the beta programme.' };
  }
  // free — still gated until Stripe is wired
  return { enabled: false, reason: 'Upgrades are not available yet — coming soon.' };
}

/** Whether Manage billing should open Stripe Customer Portal (later). */
export function getManageBillingAction(subscription: UserSubscription): BillingActionState {
  if (subscription.plan === 'beta') {
    return { enabled: false, reason: 'Billing is not applicable during the beta programme.' };
  }
  if (!subscription.providerCustomerId) {
    return { enabled: false, reason: 'No billing account on file yet.' };
  }
  if (subscription.status === 'cancelled') {
    return { enabled: false, reason: 'Your subscription has been cancelled.' };
  }
  // Ready for Stripe portal — enable when backend action exists
  return { enabled: false, reason: 'Billing portal is not available yet — coming soon.' };
}
