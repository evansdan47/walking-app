'use client';

import { usePace } from '@/components/pace-context';
import { ActivityPicker } from '@/components/ui/activity-picker';

/** Compact pace selector for side panels that show estimated time. */
export function PanelPacePicker({ className = '' }: { className?: string }) {
  const { pace, setPace } = usePace();
  return (
    <ActivityPicker
      value={pace}
      onChange={setPace}
      compact
      menuAlign="right"
      className={className}
    />
  );
}
