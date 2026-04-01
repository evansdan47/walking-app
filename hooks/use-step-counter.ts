import { Pedometer } from 'expo-sensors';
import { useEffect, useState } from 'react';

/**
 * Counts steps while `active` is true.
 * Resets to 0 whenever `active` becomes false.
 * Pass `isActive` (recording || paused) so the subscription survives pause/resume.
 */
export function useStepCounter(active: boolean): number {
  const [steps, setSteps] = useState(0);

  useEffect(() => {
    if (!active) {
      setSteps(0);
      return;
    }

    let sub: { remove(): void } | null = null;

    void Pedometer.isAvailableAsync().then((available) => {
      if (!available) return;
      sub = Pedometer.watchStepCount((result) => {
        setSteps(result.steps);
      });
    });

    return () => {
      sub?.remove();
    };
  }, [active]);

  return steps;
}
