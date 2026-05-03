'use client';

import dynamic from 'next/dynamic';

// PlannerOverlay owns its own Map instance with click handlers; must be client-only.
export const PlannerOverlayClient = dynamic(
  () => import('./planner-overlay').then((m) => m.PlannerOverlay),
  { ssr: false }
);
