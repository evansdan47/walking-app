type IconProps = {
  className?: string;
};

/** Minimal pause — two rounded bars. */
export function HeroCarouselPauseIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <rect x="5.5" y="4" width="4" height="16" rx="1.25" fill="currentColor" />
      <rect x="14.5" y="4" width="4" height="16" rx="1.25" fill="currentColor" />
    </svg>
  );
}

/** Minimal play — rounded triangle. */
export function HeroCarouselPlayIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M9 6.2v11.6c0 .9 1 .4 1.5-.1l7.2-5.7c.5-.4.5-1.2 0-1.6l-7.2-5.7c-.5-.5-1.5 0-1.5.9Z"
        fill="currentColor"
      />
    </svg>
  );
}
