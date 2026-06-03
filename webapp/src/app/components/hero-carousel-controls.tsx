'use client';

import {
  HeroCarouselPauseIcon,
  HeroCarouselPlayIcon,
} from '@/app/components/hero-carousel-icons';
import { HERO_SLIDE_INTERVAL_MS } from '@/app/components/hero-ken-burns';

const INACTIVE_DOT_CLASS =
  'h-2 w-2 shrink-0 rounded-full bg-white/40 transition-colors hover:bg-white/70';
const ACTIVE_PILL_CLASS =
  'relative h-2 w-12 shrink-0 overflow-hidden rounded-full bg-white/40';

type SlideMeta = { src: string; label: string };

type HeroCarouselControlsProps = {
  slides: SlideMeta[];
  current: number;
  isPlaying: boolean;
  progressKey: string;
  onTogglePlay: () => void;
  onSelectSlide: (index: number) => void;
};

export function HeroCarouselControls({
  slides,
  current,
  isPlaying,
  progressKey,
  onTogglePlay,
  onSelectSlide,
}: HeroCarouselControlsProps) {
  return (
    <div
      className="absolute bottom-6 left-0 right-0 z-40 flex justify-center items-center"
      role="group"
      aria-label="Carousel controls"
    >
      <div
        className="flex items-center gap-2.5 rounded-full bg-black/20 px-3 py-2 backdrop-blur-sm"
        role="tablist"
        aria-label="Carousel slides"
      >
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={isPlaying ? 'Pause carousel' : 'Play carousel'}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white/90"
        >
          {isPlaying ? <HeroCarouselPauseIcon /> : <HeroCarouselPlayIcon />}
        </button>

        {slides.map((s, i) => {
          const isActive = i === current;
          return (
            <button
              key={s.src}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={s.label}
              onClick={() => onSelectSlide(i)}
              className={isActive ? ACTIVE_PILL_CLASS : INACTIVE_DOT_CLASS}
            >
              {isActive && (
                <span
                  key={progressKey}
                  className="hero-carousel-progress absolute inset-y-0 left-0 w-full rounded-full bg-white"
                  style={{
                    animationDuration: `${HERO_SLIDE_INTERVAL_MS}ms`,
                    animationPlayState: isPlaying ? 'running' : 'paused',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
