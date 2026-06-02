'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';

const SLIDES = [
  {
    src: '/slides/Landscape/BG_RecordEveryWalk.png',
    label: 'Record every walk',
    headline: 'Record. Review. Replay.',
    sub: 'Every Walk.',
    body: 'Silently capture your route, photos and stats in the background. Your walk, beautifully documented.',
  },
  {
    src: '/slides/Landscape/BG_FollowRoutes.png',
    label: 'Follow Routes',
    headline: 'Stay on track.',
    sub: 'Every step of the way.',
    body: 'Get gentle alerts the moment you drift off path. Eyes up, phone in pocket — confidence on every trail.',
  },
  {
    src: '/slides/Landscape/BG_ExploreNewPlaces.png',
    label: 'Explore new places',
    headline: 'Discover your',
    sub: 'next adventure.',
    body: 'Handpicked trails near you and across the world. Find the walk that suits your day.',
  },
  {
    src: '/slides/Landscape/BG_PlanYourAdventure.png',
    label: 'Plan your adventure',
    headline: 'Plan it perfectly.',
    sub: 'Before you go.',
    body: 'Build routes with our web planner. Set waypoints, check elevation, and share with friends.',
  },
  {
    src: '/slides/Landscape/BG_OfflineReliability.png',
    label: 'Offline reliability',
    headline: 'No signal?',
    sub: 'No problem.',
    body: 'Maps and routes always available offline. Walk with confidence far from the crowd.',
  },
  {
    src: '/slides/Landscape/BG_BetterTogether.png',
    label: 'Better together',
    headline: 'Walk together.',
    sub: 'Share the journey.',
    body: 'Share your walks, inspire others, and discover routes from the Rambleio community.',
  },
];

const INTERVAL_MS = 10_000;

export function HeroCarousel() {
  const [current, setCurrent] = useState(0);
  const [timerKey, setTimerKey] = useState(0);
  const [textVisible, setTextVisible] = useState(true);

  const goTo = useCallback((index: number) => {
    setTextVisible(false);
    setTimeout(() => {
      setCurrent(index);
      setTextVisible(true);
    }, 250);
    setTimerKey((k) => k + 1);
  }, []);

  const prev = useCallback(() => {
    goTo((current - 1 + SLIDES.length) % SLIDES.length);
  }, [current, goTo]);

  const next = useCallback(() => {
    goTo((current + 1) % SLIDES.length);
  }, [current, goTo]);

  useEffect(() => {
    const id = setInterval(() => {
      setTextVisible(false);
      setTimeout(() => {
        setCurrent((c) => (c + 1) % SLIDES.length);
        setTextVisible(true);
      }, 250);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [timerKey]);

  const slide = SLIDES[current];

  return (
    <div className="relative w-full h-full">

      {/* ── Slides ── */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="flex h-full transition-transform duration-700 ease-in-out"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {SLIDES.map((s, i) => (
            <div key={s.src} className="relative flex-shrink-0 w-full h-full">
              <Image
                src={s.src}
                alt={s.label}
                fill
                className="object-cover"
                sizes="100vw"
                priority={i < 2}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Gradient overlays ── */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/20 pointer-events-none" />

      {/* ── Per-slide text ── */}
      <div
        className="absolute inset-0 flex items-start pointer-events-none"
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
          {/* <div className="flex flex-wrap gap-3">
            <a
              href="#"
              className="flex items-center gap-2.5 bg-black/60 hover:bg-black/80 border border-white/20 text-white rounded-xl px-4 py-2.5 transition-colors"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98l-.09.06c-.22.14-2.18 1.27-2.16 3.8.03 3.02 2.65 4.03 2.67 4.04l-.06.18zM13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              <div>
                <div className="text-[10px] text-white/55 leading-none">Download on the</div>
                <div className="text-sm font-semibold leading-snug">App Store</div>
              </div>
            </a>
            <a
              href="#"
              className="flex items-center gap-2.5 bg-black/60 hover:bg-black/80 border border-white/20 text-white rounded-xl px-4 py-2.5 transition-colors"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M3.18 23.76c.28.16.6.19.91.09l12.44-7.17-2.7-2.71-10.65 9.79zM.44 1.09C.17 1.4 0 1.84 0 2.41v19.18c0 .57.17 1.01.44 1.32l.07.07 10.74-10.74v-.25L.51 1.02l-.07.07zM20.49 10.28l-2.85-1.65-3.02 3.02 3.02 3.02 2.87-1.65c.82-.47.82-1.24-.02-1.74zM3.18.24L15.62 7.41l-2.7 2.7L2.27.32c.31-.1.63-.07.91.08v-.16z" />
              </svg>
              <div>
                <div className="text-[10px] text-white/55 leading-none">Get it on</div>
                <div className="text-sm font-semibold leading-snug">Google Play</div>
              </div>
            </a>
          </div> */}
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

      {/* ── Dot indicators ── */}
      <div
        className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-2 z-20"
        role="tablist"
        aria-label="Carousel slides"
      >
        {SLIDES.map((s, i) => (
          <button
            key={s.src}
            role="tab"
            aria-selected={i === current}
            aria-label={s.label}
            onClick={() => goTo(i)}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === current ? 'w-6 bg-white' : 'w-2 bg-white/40 hover:bg-white/70'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
