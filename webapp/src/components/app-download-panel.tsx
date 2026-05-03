'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export function StartWalkButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-brand hover:bg-brand-dark text-white font-semibold text-sm px-4 py-1.5 rounded-lg transition-colors shadow-sm"
      >
        Start Walk
      </button>
      <AppDownloadPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function AppDownloadPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Full-screen frosted backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-white/30 backdrop-blur-md transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Centred drop-down modal */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Download the Rambleio app"
        className={`fixed left-1/2 z-50 w-full max-w-3xl max-h-[90vh] -translate-x-1/2 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ease-out ${
          open ? 'top-[5vh] opacity-100 scale-100' : 'top-0 opacity-0 scale-95 pointer-events-none'
        }`}
      >
        {/* ── Hero ── */}
        <div className="relative h-64 shrink-0 overflow-hidden">
          <svg viewBox="0 0 720 256" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <defs>
              <linearGradient id="dlSky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#b8e4f9" />
                <stop offset="60%" stopColor="#d4f0a0" />
                <stop offset="100%" stopColor="#8bc34a" stopOpacity="0.3" />
              </linearGradient>
              <linearGradient id="dlHill1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4a7c40" />
                <stop offset="100%" stopColor="#2d5a27" />
              </linearGradient>
              <linearGradient id="dlHill2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#336b2b" />
                <stop offset="100%" stopColor="#1a3d18" />
              </linearGradient>
              <linearGradient id="dlPath" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d4a853" />
                <stop offset="100%" stopColor="#a07434" />
              </linearGradient>
              <filter id="dlGlow">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            {/* Sky */}
            <rect width="720" height="256" fill="url(#dlSky)" />
            {/* Sun */}
            <circle cx="580" cy="60" r="36" fill="#FFD54F" opacity="0.9" filter="url(#dlGlow)" />
            <circle cx="580" cy="60" r="28" fill="#FFEE58" opacity="0.6" />
            {/* Distant peaks */}
            <path d="M0 170 L80 95 L140 130 L220 65 L300 105 L370 55 L440 95 L520 50 L590 85 L650 60 L720 90 L720 256 L0 256Z" fill="#5a8a50" opacity="0.55" />
            {/* Mid hills */}
            <path d="M0 195 Q90 155 200 175 Q320 195 450 165 Q560 145 720 180 L720 256 L0 256Z" fill="url(#dlHill1)" />
            {/* Foreground */}
            <path d="M0 222 Q150 205 300 215 Q450 225 720 210 L720 256 L0 256Z" fill="url(#dlHill2)" />
            {/* Path */}
            <path d="M290 256 Q310 230 330 210 Q355 188 370 175" fill="none" stroke="url(#dlPath)" strokeWidth="12" strokeLinecap="round" opacity="0.85" />
            {/* Clouds */}
            <g fill="white" opacity="0.8">
              <ellipse cx="120" cy="55" rx="55" ry="20" />
              <ellipse cx="148" cy="44" rx="38" ry="18" />
              <ellipse cx="95" cy="52" rx="30" ry="14" />
            </g>
            <g fill="white" opacity="0.6">
              <ellipse cx="420" cy="38" rx="44" ry="16" />
              <ellipse cx="444" cy="30" rx="30" ry="13" />
              <ellipse cx="400" cy="36" rx="24" ry="11" />
            </g>
            {/* Hikers */}
            <g transform="translate(280,196)" stroke="#fff" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="0" cy="-36" r="9" fill="white" stroke="none" />
              <line x1="0" y1="-27" x2="0" y2="-10" strokeWidth="3" />
              <line x1="0" y1="-22" x2="-13" y2="-32" strokeWidth="2.5" />
              <line x1="0" y1="-22" x2="13" y2="-32" strokeWidth="2.5" />
              <line x1="0" y1="-10" x2="-8" y2="6" strokeWidth="3" />
              <line x1="0" y1="-10" x2="8" y2="5" strokeWidth="3" />
            </g>
            <g transform="translate(316,190)" stroke="#fff" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="0" cy="-34" r="8.5" fill="white" stroke="none" />
              <line x1="0" y1="-25" x2="0" y2="-9" strokeWidth="3" />
              <line x1="0" y1="-20" x2="-11" y2="-14" strokeWidth="2.5" />
              <line x1="0" y1="-20" x2="11" y2="-18" strokeWidth="2.5" />
              <line x1="0" y1="-9" x2="-9" y2="7" strokeWidth="3" />
              <line x1="0" y1="-9" x2="9" y2="5" strokeWidth="3" />
            </g>
            <g transform="translate(352,193)" stroke="#fff" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="0" cy="-35" r="9" fill="white" stroke="none" />
              <line x1="0" y1="-26" x2="0" y2="-10" strokeWidth="3" />
              <line x1="0" y1="-21" x2="15" y2="-26" strokeWidth="2.5" />
              <line x1="0" y1="-21" x2="-10" y2="-16" strokeWidth="2.5" />
              <line x1="0" y1="-10" x2="-8" y2="6" strokeWidth="3" />
              <line x1="0" y1="-10" x2="8" y2="5" strokeWidth="3" />
            </g>
            <g transform="translate(388,196)" stroke="#fff" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="0" cy="-36" r="8" fill="white" stroke="none" />
              <line x1="0" y1="-28" x2="0" y2="-12" strokeWidth="3" />
              <line x1="0" y1="-23" x2="-12" y2="-18" strokeWidth="2.5" />
              <line x1="0" y1="-23" x2="10" y2="-28" strokeWidth="2.5" />
              <line x1="0" y1="-12" x2="-8" y2="4" strokeWidth="3" />
              <line x1="0" y1="-12" x2="7" y2="5" strokeWidth="3" />
            </g>
            {/* Emoji reactions */}
            <text x="268" y="148" fontSize="20" fontFamily="sans-serif" opacity="0.9">😄</text>
            <text x="304" y="142" fontSize="18" fontFamily="sans-serif" opacity="0.8">😂</text>
            <text x="340" y="145" fontSize="20" fontFamily="sans-serif" opacity="0.9">🎉</text>
            <text x="376" y="148" fontSize="18" fontFamily="sans-serif" opacity="0.8">🤣</text>
          </svg>

          {/* Hero text overlay */}
          <div className="absolute inset-0 flex flex-col justify-end px-8 pb-7 bg-linear-to-t from-black/65 via-black/15 to-transparent">
            <p className="text-white/75 text-xs font-bold uppercase tracking-widest mb-1.5">Rambleio Mobile</p>
            <h2 className="text-white text-3xl font-extrabold leading-tight drop-shadow-md">
              Ready to hit the trail?<br />
              Get the <span className="text-[#FF9800]">Rambleio</span> app.
            </h2>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-black/35 text-white hover:bg-black/55 transition-colors"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* Row 1: copy + QR */}
          <div className="grid grid-cols-[1fr_auto] gap-6 px-8 py-6 border-b border-gray-100">
            <div>
              <h3 className="text-xl font-extrabold text-gray-900 mb-1.5">Go further, safer.</h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-5">
                Download the app to plan, follow and stay on track wherever you roam.
                Works offline, built for the real world. Access thousands of vetted trails
                even when the signal disappears.
              </p>
              <div className="flex flex-col gap-2.5 max-w-50">
                <AppStoreBadge />
                <GooglePlayBadge />
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div className="w-28 h-28 rounded-xl border border-gray-200 bg-white p-1.5 shadow-sm">
                <QRCodeGraphic />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand">Scan to start</p>
              <p className="text-[10px] text-gray-400 text-center leading-snug max-w-25">
                Point your camera to download on your mobile device.
              </p>
            </div>
          </div>

          {/* Row 2: feature cards */}
          <div className="px-8 py-6">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-4">
              Everything you need — free forever
            </p>
            <div className="grid grid-cols-3 gap-3">
              {FEATURES.map(({ icon, title, desc, bg }) => (
                <div key={title} className={`rounded-xl p-4 ${bg}`}>
                  <span className="inline-flex w-8 h-8 rounded-lg items-center justify-center mb-3 text-white bg-white/20">
                    {icon}
                  </span>
                  <p className="text-xs font-bold uppercase tracking-wide mb-1 text-white">{title}</p>
                  <p className="text-xs text-white/80 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Row 3: stats bar */}
          <div className="mx-8 mb-6 rounded-xl bg-gray-50 border border-gray-100 grid grid-cols-4 divide-x divide-gray-200">
            {[
              { value: '10k+', label: 'Routes' },
              { value: '100%', label: 'Free' },
              { value: 'Offline', label: 'Maps' },
              { value: 'iOS & Android', label: 'Platforms' },
            ].map(({ value, label }) => (
              <div key={label} className="flex flex-col items-center py-3">
                <p className="text-base font-extrabold text-gray-800">{value}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </>,
    document.body
  );
}

// ── Feature data ──────────────────────────────────────────────────────────────

const FEATURES = [
  {
    bg: 'bg-[#2E7D32]',
    title: 'Walk',
    desc: 'Follow any saved route turn-by-turn with live GPS. Hear cues, stay on track, never get lost.',
    icon: (
      <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="4" r="2" />
        <line x1="10" y1="6" x2="10" y2="13" />
        <line x1="10" y1="9" x2="7" y2="12" />
        <line x1="10" y1="9" x2="13" y2="11" />
        <line x1="10" y1="13" x2="7.5" y2="18" />
        <line x1="10" y1="13" x2="12.5" y2="17.5" />
      </svg>
    ),
  },
  {
    bg: 'bg-[#E65100]',
    title: 'Record',
    desc: 'Auto-record every outing — distance, time, elevation, pace and MET effort, all saved to your journal.',
    icon: (
      <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="10" r="7" />
        <circle cx="10" cy="10" r="3" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    bg: 'bg-[#1565C0]',
    title: 'Train',
    desc: 'Set weekly distance goals, track progress charts and build activity streaks that keep you moving.',
    icon: (
      <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="2 14 6 8 9.5 11 13 6 18 10" />
      </svg>
    ),
  },
  {
    bg: 'bg-[#4527A0]',
    title: 'Offline Maps',
    desc: 'Download terrain and contour maps for any area. Full navigation without cell signal.',
    icon: (
      <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 5l5-2 4 2 5-2v12l-5 2-4-2-5 2V5Z" />
        <line x1="8" y1="3" x2="8" y2="15" />
        <line x1="12" y1="5" x2="12" y2="17" />
      </svg>
    ),
  },
  {
    bg: 'bg-[#00695C]',
    title: 'Explore',
    desc: 'Browse thousands of community-verified routes near you or anywhere in the world.',
    icon: (
      <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="10" r="7" />
        <polygon points="13,7 8,10 11,13 16,10" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    bg: 'bg-[#6D4C41]',
    title: 'Share',
    desc: 'Share routes, photos and achievements with friends and the global Rambleio community.',
    icon: (
      <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="15" cy="4" r="2" />
        <circle cx="5" cy="10" r="2" />
        <circle cx="15" cy="16" r="2" />
        <line x1="7" y1="9" x2="13" y2="5" />
        <line x1="7" y1="11" x2="13" y2="15" />
      </svg>
    ),
  },
];

// ── QR code graphic ───────────────────────────────────────────────────────────

function QRCodeGraphic() {
  const cells: [number, number][] = [
    [0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0],[0,1],[6,1],[0,2],[2,2],[3,2],[4,2],[6,2],
    [0,3],[2,3],[4,3],[6,3],[0,4],[2,4],[3,4],[4,4],[6,4],[0,5],[6,5],
    [0,6],[1,6],[2,6],[3,6],[4,6],[5,6],[6,6],
    [10,0],[11,0],[12,0],[13,0],[14,0],[15,0],[16,0],[10,1],[16,1],[10,2],[12,2],[13,2],[14,2],[16,2],
    [10,3],[12,3],[14,3],[16,3],[10,4],[12,4],[13,4],[14,4],[16,4],[10,5],[16,5],
    [10,6],[11,6],[12,6],[13,6],[14,6],[15,6],[16,6],
    [0,10],[1,10],[2,10],[3,10],[4,10],[5,10],[6,10],[0,11],[6,11],[0,12],[2,12],[3,12],[4,12],[6,12],
    [0,13],[2,13],[4,13],[6,13],[0,14],[2,14],[3,14],[4,14],[6,14],[0,15],[6,15],
    [0,16],[1,16],[2,16],[3,16],[4,16],[5,16],[6,16],
    [8,0],[9,0],[8,2],[9,2],[8,4],[8,6],[9,6],
    [7,7],[8,7],[9,7],[10,7],[11,7],[13,7],[15,7],[16,7],
    [7,8],[9,8],[11,8],[13,8],[15,8],[7,9],[8,9],[10,9],[12,9],[14,9],[16,9],
    [8,10],[10,10],[11,10],[13,10],[15,10],[16,10],[7,11],[9,11],[11,11],[12,11],[14,11],[16,11],
    [8,12],[10,12],[11,12],[13,12],[15,12],[7,13],[9,13],[12,13],[14,13],[16,13],
    [8,14],[10,14],[11,14],[13,14],[15,14],[16,14],[7,15],[8,15],[10,15],[12,15],[14,15],
    [9,16],[11,16],[12,16],[14,16],[16,16],
  ];
  const S = 4.5;
  return (
    <svg viewBox="0 0 81 81" className="w-full h-full" aria-label="QR code for Rambleio app download">
      <rect width="81" height="81" fill="white" />
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x * S} y={y * S} width={S - 0.5} height={S - 0.5} fill="#111" rx="0.4" />
      ))}
      <rect x="32" y="32" width="17" height="17" rx="3" fill="#E65100" />
      <path d="M35 44 L37.5 38 L40 41.5 L42 39.5 L44.5 44" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

// ── Store badges ──────────────────────────────────────────────────────────────

function AppStoreBadge() {
  return (
    <div className="flex items-center gap-2.5 bg-black text-white rounded-xl px-3 py-2.5 select-none">
      <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" fill="currentColor" aria-hidden="true">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11Z" />
      </svg>
      <div className="leading-none">
        <p className="text-[9px] text-white/60 font-medium">Download on the</p>
        <p className="text-sm font-bold tracking-tight">App Store</p>
      </div>
    </div>
  );
}

function GooglePlayBadge() {
  return (
    <div className="flex items-center gap-2.5 bg-black text-white rounded-xl px-3 py-2.5 select-none">
      <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" aria-hidden="true" fill="none">
        <path d="M3 20.5v-17c0-.83 1-.83 1.5-.5L20 12l-15.5 8c-.5.33-1.5.33-1.5-.5Z" fill="#4CAF50" />
        <path d="M3 3.5L13.5 14 3 20.5V3.5Z" fill="#81C784" />
        <path d="M13.5 14L20 12 3 3.5 13.5 14Z" fill="#FFCA28" />
        <path d="M3 20.5L13.5 14 20 12 3 20.5Z" fill="#F44336" />
      </svg>
      <div className="leading-none">
        <p className="text-[9px] text-white/60 font-medium">GET IT ON</p>
        <p className="text-sm font-bold tracking-tight">Google Play</p>
      </div>
    </div>
  );
}
