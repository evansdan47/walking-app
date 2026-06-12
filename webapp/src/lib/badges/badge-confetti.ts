/** Celebration burst when a newly earned badge is opened. */
export async function fireBadgeConfetti(categoryColor?: string): Promise<void> {
  const { default: confetti } = await import('canvas-confetti');

  const colors = [
    categoryColor ?? '#E65100',
    '#F9A825',
    '#2E7D32',
    '#90CAF9',
    '#FF6D00',
  ];

  const burst = (particleRatio: number, opts: confetti.Options) => {
    void confetti({
      ...opts,
      colors,
      particleCount: Math.floor(120 * particleRatio),
      spread: 70,
      origin: { y: 0.55 },
      zIndex: 100,
    });
  };

  burst(0.25, { angle: 60, origin: { x: 0, y: 0.55 } });
  burst(0.25, { angle: 120, origin: { x: 1, y: 0.55 } });
  burst(0.35, { spread: 100, origin: { x: 0.5, y: 0.45 } });
  burst(0.15, { decay: 0.92, scalar: 0.85, origin: { x: 0.5, y: 0.5 } });
}
