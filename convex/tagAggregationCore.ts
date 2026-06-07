import type { Doc } from './_generated/dataModel';

/** Minimum walker confirmations before a tag surfaces on a route (beta default). */
export const MIN_WALKER_CONFIRMATIONS = 3;

/** Seasonal tags older than this (ms) contribute less to confidence. */
export const SEASONAL_DECAY_MS = 90 * 24 * 60 * 60 * 1000;

export type TagKind = Doc<'tagDefinitions'>['kind'];

export type ContributionRollup = {
  tagId: string;
  confirmationCount: number;
  creatorConfirmed: boolean;
  autoSuggested: boolean;
  lastReportedAt: number;
};

/**
 * Whether a tag should appear on a public route card / detail panel.
 */
export function shouldDisplayRouteTag(
  kind: TagKind,
  confirmationCount: number,
  creatorConfirmed: boolean,
): boolean {
  if (creatorConfirmed && kind === 'objective') return true;
  if (kind === 'seasonal') return confirmationCount >= 1;
  return confirmationCount >= MIN_WALKER_CONFIRMATIONS;
}

/**
 * 0–1 confidence score for sorting and future ranking.
 */
export function computeConfidenceScore(
  kind: TagKind,
  confirmationCount: number,
  creatorConfirmed: boolean,
  lastReportedAt: number,
  now = Date.now(),
): number {
  if (creatorConfirmed && kind === 'objective') return 1;

  let base = Math.min(1, confirmationCount / Math.max(MIN_WALKER_CONFIRMATIONS, 1));

  if (kind === 'seasonal') {
    const age = Math.max(0, now - lastReportedAt);
    const recency = Math.max(0, 1 - age / SEASONAL_DECAY_MS);
    base *= 0.5 + 0.5 * recency;
  }

  if (kind === 'subjective') {
    base *= 0.85 + 0.15 * Math.min(1, confirmationCount / 20);
  }

  return Math.round(Math.min(1, Math.max(0, base)) * 1000) / 1000;
}

export function mergeContributionIntoRollup(
  rollup: ContributionRollup,
  contribution: {
    source: Doc<'tagContributions'>['source'];
    reportedAt: number;
  },
): ContributionRollup {
  const next = { ...rollup, lastReportedAt: Math.max(rollup.lastReportedAt, contribution.reportedAt) };

  if (contribution.source === 'walker' || contribution.source === 'auto_confirmed') {
    next.confirmationCount += 1;
  }
  if (contribution.source === 'auto_confirmed') {
    next.autoSuggested = true;
  }

  return next;
}
