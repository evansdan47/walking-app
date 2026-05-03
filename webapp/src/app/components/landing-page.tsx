import Link from "next/link";
import { NavAuthButtons } from "@/components/nav-auth-buttons";

// ── Icons ──────────────────────────────────────────────────────────────────

function RambleIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#E65100" />
      <path
        d="M8 22 L13 10 L18 17 L22 13 L26 22"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="22" cy="13" r="2.5" fill="white" />
    </svg>
  );
}

function MapIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <line x1="9" y1="3" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="21" />
    </svg>
  );
}

function NavigationIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <polygon points="3 11 22 2 13 21 11 13 3 11" />
    </svg>
  );
}

function CheckCircleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

// ── Hero Background ────────────────────────────────────────────────────────

function HeroBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Sky gradient */}
      <div className="absolute inset-0 bg-linear-to-b from-amber-100 via-green-100 to-green-200" />
      {/* Rolling hills */}
      <svg className="absolute bottom-0 w-full" viewBox="0 0 1440 500" preserveAspectRatio="xMidYMid slice" fill="none">
        <path d="M0 500 L0 280 Q200 180 400 240 Q600 300 720 200 Q840 100 1000 160 Q1160 220 1280 140 Q1360 100 1440 120 L1440 500 Z" fill="#4caf50" opacity="0.35" />
        <path d="M0 500 L0 350 Q180 260 360 310 Q540 360 700 280 Q860 200 1060 260 Q1200 310 1440 240 L1440 500 Z" fill="#388e3c" opacity="0.4" />
        <path d="M0 500 L0 420 Q220 360 440 390 Q660 420 880 360 Q1080 310 1440 370 L1440 500 Z" fill="#2e7d32" opacity="0.55" />
        {/* Winding path */}
        <path d="M580 500 Q600 420 650 370 Q700 320 680 260 Q660 200 700 140 Q730 90 760 60" stroke="#E65100" strokeWidth="8" strokeLinecap="round" opacity="0.85" fill="none" />
        <path d="M580 500 Q600 420 650 370 Q700 320 680 260 Q660 200 700 140 Q730 90 760 60" stroke="white" strokeWidth="3" strokeLinecap="round" strokeDasharray="12 8" opacity="0.6" fill="none" />
      </svg>
      {/* Sunlight overlay */}
      <div className="absolute inset-0 bg-linear-to-br from-amber-200/30 via-transparent to-transparent" />
      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-linear-to-r from-black/55 via-black/30 to-transparent" />
    </div>
  );
}

// ── Map Preview ────────────────────────────────────────────────────────────

function MapPreview() {
  return (
    <div className="w-full aspect-4/3 rounded-xl overflow-hidden shadow-lg" aria-hidden="true">
      <svg viewBox="0 0 400 300" className="w-full h-full">
        {/* Ocean */}
        <rect width="400" height="300" fill="#4fc3f7" />
        {/* Land mass */}
        <path d="M0 80 Q60 40 140 60 Q220 80 300 50 Q360 30 400 60 L400 300 L0 300 Z" fill="#66bb6a" />
        <path d="M0 100 Q80 70 160 90 Q240 110 320 80 Q370 65 400 80 L400 300 L0 300 Z" fill="#81c784" />
        {/* Terrain elevation lines */}
        <path d="M40 140 Q120 100 200 120 Q280 140 360 110" stroke="#a5d6a7" strokeWidth="1.5" fill="none" opacity="0.7" />
        <path d="M60 160 Q140 130 220 150 Q300 170 380 140" stroke="#a5d6a7" strokeWidth="1.5" fill="none" opacity="0.5" />
        {/* Route line */}
        <path d="M80 240 Q120 200 160 180 Q200 160 220 140 Q240 120 280 130 Q320 140 350 110" stroke="#E65100" strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M80 240 Q120 200 160 180 Q200 160 220 140 Q240 120 280 130 Q320 140 350 110" stroke="white" strokeWidth="2" strokeLinecap="round" strokeDasharray="8 6" fill="none" />
        {/* Start marker */}
        <circle cx="80" cy="240" r="8" fill="#E65100" />
        <circle cx="80" cy="240" r="4" fill="white" />
        {/* End marker */}
        <circle cx="350" cy="110" r="8" fill="#2E7D32" />
        <circle cx="350" cy="110" r="4" fill="white" />
      </svg>
    </div>
  );
}

// ── Outdoor Scene ──────────────────────────────────────────────────────────

function OutdoorScene() {
  return (
    <div className="w-full aspect-square rounded-2xl overflow-hidden shadow-xl" aria-hidden="true">
      <svg viewBox="0 0 320 320" className="w-full h-full">
        {/* Sky */}
        <rect width="320" height="320" fill="#c8e6c9" />
        {/* Sun rays */}
        <circle cx="160" cy="80" r="60" fill="#fff9c4" opacity="0.6" />
        <circle cx="160" cy="80" r="35" fill="#ffee58" opacity="0.5" />
        {/* Forest background */}
        <rect x="0" y="140" width="320" height="180" fill="#2e7d32" />
        {/* Tree trunks and foliage */}
        {[30, 80, 130, 180, 230, 270].map((x, i) => (
          <g key={i}>
            <rect x={x - 5} y={180} width="10" height={60 + (i % 3) * 20} fill="#4e342e" />
            <ellipse cx={x} cy={160 + (i % 2) * 15} rx={22 + (i % 3) * 5} ry={30 + (i % 2) * 10} fill={i % 2 === 0 ? "#388e3c" : "#43a047"} />
            <ellipse cx={x} cy={140 + (i % 2) * 10} rx={15 + (i % 3) * 3} ry={22 + (i % 2) * 6} fill={i % 2 === 0 ? "#2e7d32" : "#1b5e20"} />
          </g>
        ))}
        {/* Forest floor */}
        <path d="M0 260 Q80 240 160 255 Q240 270 320 250 L320 320 L0 320 Z" fill="#1b5e20" />
        {/* Path */}
        <path d="M130 320 Q150 280 155 250 Q158 230 160 200" stroke="#a1887f" strokeWidth="18" strokeLinecap="round" fill="none" opacity="0.8" />
        <path d="M130 320 Q150 280 155 250 Q158 230 160 200" stroke="#bcaaa4" strokeWidth="10" strokeLinecap="round" fill="none" opacity="0.5" />
        {/* Person silhouette */}
        <g transform="translate(148, 215)">
          <circle cx="10" cy="0" r="7" fill="#37474f" />
          <line x1="10" y1="7" x2="10" y2="28" stroke="#37474f" strokeWidth="4" strokeLinecap="round" />
          <line x1="10" y1="15" x2="2" y2="24" stroke="#37474f" strokeWidth="3" strokeLinecap="round" />
          <line x1="10" y1="15" x2="18" y2="24" stroke="#37474f" strokeWidth="3" strokeLinecap="round" />
          <line x1="10" y1="28" x2="4" y2="40" stroke="#37474f" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="10" y1="28" x2="16" y2="40" stroke="#37474f" strokeWidth="3.5" strokeLinecap="round" />
        </g>
        {/* Watch/device highlight */}
        <rect x="163" y="225" width="14" height="10" rx="2" fill="#E65100" />
        <rect x="165" y="227" width="10" height="6" rx="1" fill="white" opacity="0.8" />
        {/* Light rays through trees */}
        <path d="M160 80 L60 200" stroke="#fff9c4" strokeWidth="15" opacity="0.08" />
        <path d="M160 80 L120 220" stroke="#fff9c4" strokeWidth="12" opacity="0.08" />
        <path d="M160 80 L200 210" stroke="#fff9c4" strokeWidth="12" opacity="0.08" />
        <path d="M160 80 L260 190" stroke="#fff9c4" strokeWidth="15" opacity="0.08" />
      </svg>
    </div>
  );
}

// ── Nav ────────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <nav className="relative z-20 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto w-full">
      <div className="flex items-center gap-2">
        <RambleIcon className="w-8 h-8" />
        <span className="font-bold text-lg text-white tracking-tight">Rambleio</span>
      </div>
      <div className="hidden md:flex items-center gap-8">
        <Link href="/explore" className="text-sm font-medium text-white/90 hover:text-white transition-colors">Explore</Link>
        <Link href="/map?mode=walks" className="text-sm font-medium text-white/90 hover:text-white transition-colors">My Walks</Link>
        <Link href="/planner" className="text-sm font-medium text-white/90 hover:text-white transition-colors">Planner</Link>
        <Link href="/map?mode=community" className="text-sm font-medium text-white/90 hover:text-white transition-colors">Community</Link>
      </div>
      <div className="flex items-center gap-3">
        <NavAuthButtons />
      </div>
    </nav>
  );
}

// ── Hero ───────────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="relative min-h-140 flex flex-col overflow-hidden">
      <HeroBackground />
      <div className="relative z-10 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center px-6 pt-12 pb-24 max-w-7xl mx-auto w-full">
          <div className="max-w-lg">
            <div className="flex items-center gap-2 mb-3" aria-hidden="true">
              <RambleIcon className="w-7 h-7 opacity-90" />
            </div>
            <h1 className="text-5xl font-bold text-white leading-tight mb-2">
              Plan your walk.
            </h1>
            <p className="text-5xl font-bold italic text-[#81c784] leading-tight mb-5">
              Follow your path.
            </p>
            <p className="text-base text-white/80 mb-8 max-w-sm leading-relaxed">
              Rambleio helps you create and follow walking routes — even offline. Explore the world one step at a time with confidence.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white font-semibold px-6 py-3 rounded-lg transition-colors shadow-md text-sm"
              >
                Start Planning
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
              <a
                href="#"
                className="inline-flex items-center gap-2 border border-white/60 hover:border-white text-white font-semibold px-6 py-3 rounded-lg transition-colors text-sm backdrop-blur-sm"
              >
                Download App
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Features Grid ──────────────────────────────────────────────────────────

function FeaturesSection() {
  return (
    <section className="bg-white py-20 px-6">
      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-6">
        {/* Web Planning Card */}
        <div className="bg-surface rounded-2xl p-8 flex flex-col gap-6 shadow-sm">
          <div>
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-brand text-white mb-4">
              <MapIcon className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate mb-2">Masterful Web Planning</h2>
            <p className="text-sm text-slate-light leading-relaxed">
              Our intuitive web builder allows you to drag, drop, and snap your path to the best walking trails on the planet. High-resolution terrain maps provide every detail you need.
            </p>
          </div>
          <MapPreview />
        </div>

        {/* Follow Anywhere Card */}
        <div className="bg-surface-alt rounded-2xl p-8 flex flex-col gap-6 shadow-sm">
          <div>
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-active text-white mb-4">
              <NavigationIcon className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate mb-2">Follow Anywhere</h2>
            <p className="text-sm text-slate-light leading-relaxed">
              The Rambleio app becomes your silent guide. Turn-by-turn haptic feedback keeps your phone in your pocket while your eyes stay on the landscape.
            </p>
          </div>
          <div className="flex-1 flex flex-col justify-end gap-4">
            {/* Phone mockup */}
            <div className="mx-auto w-28 bg-[#37474f] rounded-[22px] p-1 shadow-xl">
              <div className="bg-slate rounded-[18px] aspect-9/16 flex items-center justify-center overflow-hidden">
                <svg viewBox="0 0 90 160" className="w-full">
                  <rect width="90" height="160" fill="#263238" />
                  <rect x="5" y="15" width="80" height="130" rx="4" fill="#37474f" />
                  {/* Mini map */}
                  <rect x="5" y="15" width="80" height="130" rx="4" fill="#4fc3f7" opacity="0.3" />
                  <path d="M20 120 Q35 90 45 75 Q55 60 65 50 Q72 42 78 35" stroke="#E65100" strokeWidth="3" strokeLinecap="round" fill="none" />
                  <circle cx="20" cy="120" r="4" fill="#E65100" />
                  <circle cx="45" cy="75" r="3" fill="white" />
                  {/* HUD overlay */}
                  <rect x="10" y="95" width="70" height="22" rx="4" fill="#263238" opacity="0.85" />
                  <text x="15" y="107" fill="#E65100" fontSize="7" fontWeight="bold">3.2 mi</text>
                  <text x="50" y="107" fill="#81c784" fontSize="7">On Track</text>
                  {/* Pulse */}
                  <circle cx="45" cy="75" r="6" fill="none" stroke="#E65100" strokeWidth="1.5" opacity="0.5" />
                </svg>
              </div>
            </div>
            {/* Offline badge */}
            <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-3 shadow-sm self-start">
              <CheckCircleIcon className="w-5 h-5 text-active" />
              <div>
                <p className="text-xs font-bold text-slate">100% Offline Access</p>
                <p className="text-xs text-slate-light">Download maps and go off-grid.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Feature Spotlight ──────────────────────────────────────────────────────

function FeatureSpotlight() {
  return (
    <section className="bg-surface py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm grid md:grid-cols-2 gap-0">
          {/* Content */}
          <div className="p-10 flex flex-col justify-center gap-5">
            <div>
              <span className="inline-block bg-surface-alt text-active text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-4">
                New Feature
              </span>
              <h2 className="text-3xl font-bold text-slate leading-tight mb-3">
                Stay on Track. Always.
              </h2>
              <p className="text-sm text-slate-light leading-relaxed">
                Our proprietary &ldquo;Deviation Alert&rdquo; uses high-frequency GPS pings to notify you the moment you stray from your planned route. No more accidental 5-mile detours.
              </p>
            </div>
            <ul className="flex flex-col gap-3">
              {[
                "Intelligent off-route recalibration",
                "Battery-optimized tracking mode",
                "Real-time terrain difficulty updates",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-slate">
                  <CheckCircleIcon className="w-5 h-5 text-active shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          {/* Illustration */}
          <div className="flex items-center justify-center p-8 bg-surface">
            <OutdoorScene />
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Stats ──────────────────────────────────────────────────────────────────

function StatsSection() {
  const stats = [
    { value: "12k+", label: "Trails Logged", color: "text-brand" },
    { value: "500k", label: "Miles Walked", color: "text-brand" },
    { value: "99%", label: "Offline Reliability", color: "text-active" },
    { value: "4.9", label: "App Rating", color: "text-slate" },
  ];

  return (
    <section className="bg-white py-20 px-6">
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-10 text-center">
        {stats.map(({ value, label, color }) => (
          <div key={label} className="flex flex-col items-center gap-2">
            <span className={`text-4xl font-bold ${color}`}>{value}</span>
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-light">{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── CTA ────────────────────────────────────────────────────────────────────

function CTASection() {
  return (
    <section className="bg-[#263238] py-24 px-6">
      <div className="max-w-2xl mx-auto text-center flex flex-col items-center gap-6">
        <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight">
          Ready to discover your next favorite path?
        </h2>
        <p className="text-base text-white/70 leading-relaxed">
          Join a community of 50,000+ walkers who trust Rambleio for their daily escapes and grand adventures.
        </p>
        <div className="flex flex-wrap justify-center gap-4 mt-2">
          <Link
            href="/sign-up"
            className="bg-brand hover:bg-brand-dark text-white font-semibold px-6 py-3 rounded-lg transition-colors text-sm shadow-md"
          >
            Create Free Account
          </Link>
          <a
            href="#"
            className="border border-white/40 hover:border-white/70 text-white font-semibold px-6 py-3 rounded-lg transition-colors text-sm"
          >
            Browse Popular Trails
          </a>
        </div>
      </div>
    </section>
  );
}

// ── Footer ─────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="bg-[#263238] border-t border-white/10 py-8 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-col items-start gap-1">
          <span className="text-white font-bold tracking-tight">Rambleio</span>
          <p className="text-xs text-white/40">
            &copy; 2024 Ramble.io. The path is yours to discover.
          </p>
        </div>
        <div className="flex items-center gap-6">
          {["Privacy", "Terms", "Sustainability", "Help"].map((item) => (
            <a key={item} href="#" className="text-xs font-medium text-white/50 hover:text-white/80 uppercase tracking-wider transition-colors">
              {item}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <HeroSection />
      <FeaturesSection />
      <FeatureSpotlight />
      <StatsSection />
      <CTASection />
      <Footer />
    </div>
  );
}
