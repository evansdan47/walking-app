'use client';

import { HeroCarouselControls } from '@/app/components/hero-carousel-controls';
import {
  HERO_KEN_BURNS_EFFECTS,
  HERO_SLIDE_INTERVAL_MS,
  heroKenBurnsClass,
  pickHeroKenBurnsEffect,
  type HeroKenBurnsEffect,
} from '@/app/components/hero-ken-burns';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';

const SLIDES = [
  {
    src: '/slides/Landscape/BG_RecordEveryWalk.jpg',
    label: 'Record every walk',
    headline: 'Record. Review. Replay.',
    sub: 'Every Walk.',
    body: 'Silently capture your route, photos and stats in the background. Your walk, beautifully documented.',
  },
  {
    src: '/slides/Landscape/BG_FollowRoutes.jpg',
    label: 'Follow Routes',
    headline: 'Stay on track.',
    sub: 'Every step of the way.',
    body: 'Get gentle alerts the moment you drift off path. Eyes up, phone in pocket — confidence on every trail.',
  },
  {
    src: '/slides/Landscape/BG_ExploreNewPlaces.jpg',
    label: 'Explore new places',
    headline: 'Discover your',
    sub: 'next adventure.',
    body: 'Handpicked trails near you and across the world. Find the walk that suits your day.',
  },
  {
    src: '/slides/Landscape/BG_PlanYourAdventure.jpg',
    label: 'Plan your adventure',
    headline: 'Plan it perfectly.',
    sub: 'Before you go.',
    body: 'Build routes with our web planner. Set waypoints, check elevation, and share with friends.',
  },
  {
    src: '/slides/Landscape/BG_OfflineReliability.jpg',
    label: 'Offline reliability',
    headline: 'No signal?',
    sub: 'No problem.',
    body: 'Maps and routes always available offline. Walk with confidence far from the crowd.',
  },
  {
    src: '/slides/Landscape/BG_BetterTogether.jpg',
    label: 'Better together',
    headline: 'Walk together.',
    sub: 'Share the journey.',
    body: 'Share your walks, inspire others, and discover routes from the Rambleio community.',
  },
];

const TEXT_FADE_MS = 250;
/** Image crossfade — longer than text fade for a smooth dissolve. */
const SLIDE_CROSSFADE_MS = 1000;

export function HeroCarousel() {
  const [current, setCurrent] = useState(0);
  const [timerKey, setTimerKey] = useState(0);
  const [textVisible, setTextVisible] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  /** Per-slide effect — avoids swapping classes on the outgoing slide (which caused transform snap). */
  const [effectsBySlide, setEffectsBySlide] = useState<HeroKenBurnsEffect[]>(() =>
    SLIDES.map((_, i) =>
      i === 0 ? HERO_KEN_BURNS_EFFECTS[0] : HERO_KEN_BURNS_EFFECTS[0],
    ),
  );
  /** Pause Ken Burns during opacity crossfade so only dissolve is visible. */
  const [isCrossfading, setIsCrossfading] = useState(false);
  const slideStartedAtRef = useRef(Date.now());
  const crossfadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const advanceTo = useCallback((index: number | ((prev: number) => number)) => {
    setTextVisible(false);

    if (crossfadeTimeoutRef.current) {
      clearTimeout(crossfadeTimeoutRef.current);
    }

    setCurrent((c) => {
      const next = typeof index === 'function' ? index(c) : index;
      if (next !== c) {
        setIsCrossfading(true);
        setEffectsBySlide((effects) => {
          const copy = [...effects];
          copy[next] = pickHeroKenBurnsEffect(effects[next]);
          return copy;
        });
        crossfadeTimeoutRef.current = setTimeout(() => {
          setIsCrossfading(false);
          crossfadeTimeoutRef.current = null;
        }, SLIDE_CROSSFADE_MS);
      }
      return next;
    });

    setTimeout(() => setTextVisible(true), TEXT_FADE_MS);
    setTimerKey((k) => k + 1);
  }, []);

  useEffect(() => {
    return () => {
      if (crossfadeTimeoutRef.current) {
        clearTimeout(crossfadeTimeoutRef.current);
      }
    };
  }, []);

  const prev = useCallback(() => {
    advanceTo((c) => (c - 1 + SLIDES.length) % SLIDES.length);
  }, [advanceTo]);

  const next = useCallback(() => {
    advanceTo((c) => (c + 1) % SLIDES.length);
  }, [advanceTo]);

  useEffect(() => {
    slideStartedAtRef.current = Date.now();
  }, [current, timerKey]);

  useEffect(() => {
    if (!isPlaying) return;

    const elapsed = Date.now() - slideStartedAtRef.current;
    const remaining = Math.max(0, HERO_SLIDE_INTERVAL_MS - elapsed);
    const id = setTimeout(() => {
      advanceTo((c) => (c + 1) % SLIDES.length);
    }, remaining);

    return () => clearTimeout(id);
  }, [timerKey, isPlaying, advanceTo, current]);

  const slide = SLIDES[current];
  const progressKey = `${current}-${timerKey}`;
  const kenBurnsRunning = isPlaying && !isCrossfading;

  return (
    <div className="relative isolate w-full h-full">

      {/* ── Slides (z-0 — Ken Burns transforms must stay below text) ── */}
      <div className="absolute inset-0 z-0 overflow-hidden isolate">
        {SLIDES.map((s, i) => {
          const isActive = i === current;
          const effect = effectsBySlide[i]!;
          const runKenBurns = isActive && kenBurnsRunning;

          return (
            <div
              key={s.src}
              className={`absolute inset-0 overflow-hidden transition-opacity ease-in-out ${
                isActive ? 'opacity-100 z-[1]' : 'opacity-0 z-0 pointer-events-none'
              }`}
              style={{ transitionDuration: `${SLIDE_CROSSFADE_MS}ms` }}
              aria-hidden={!isActive}
            >
              <div
                key={`${i}-${effect}`}
                className={`hero-kb-frame ${heroKenBurnsClass(effect)}`}
                style={{
                  animationDuration: `${HERO_SLIDE_INTERVAL_MS}ms`,
                  animationPlayState: runKenBurns ? 'running' : 'paused',
                }}
              >
                <Image
                  src={s.src}
                  alt={isActive ? s.label : ''}
                  fill
                  className="object-cover"
                  sizes="100vw"
                  priority={i < 2}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Gradient overlays (above animated images) ── */}
      <div className="absolute inset-0 z-10 bg-gradient-to-r from-black/70 via-black/30 to-transparent pointer-events-none" />
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/35 via-transparent to-black/20 pointer-events-none" />

      {/* ── Per-slide text (above gradients + images) ── */}
      <div
        className="absolute inset-0 z-10 flex items-start pointer-events-none"
        style={{ opacity: textVisible ? 1 : 0, transition: 'opacity 0.4s ease' }}
      >
        <div className="w-full max-w-7xl mx-auto px-6 pt-24">
        <div className="max-w-xl pointer-events-auto">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/60 mb-4">
            {slide.label}
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-1">
            {slide.headline}
          </h1>
          <p className="text-4xl md:text-5xl font-bold italic text-[#81c784] leading-tight mb-5">
            {slide.sub}
          </p>
          <p className="text-base text-white/80 max-w-sm leading-relaxed mb-8">
            {slide.body}
          </p>
        </div>
        </div>
      </div>

      {/* ── Prev / Next arrows ── */}
      <button
        onClick={prev}
        aria-label="Previous slide"
        className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-black/30 hover:bg-black/60 text-white transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        onClick={next}
        aria-label="Next slide"
        className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-black/30 hover:bg-black/60 text-white transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <HeroCarouselControls
        slides={SLIDES}
        current={current}
        isPlaying={isPlaying}
        progressKey={progressKey}
        onTogglePlay={() => setIsPlaying((p) => !p)}
        onSelectSlide={(i) => advanceTo(i)}
      />
    </div>
  );
}
