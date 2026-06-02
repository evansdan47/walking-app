import Image from "next/image";
import Link from "next/link";
import { NavAuthButtons } from "@/components/nav-auth-buttons";
import { HeroCarousel } from "./hero-carousel";

// ── Nav ────────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <nav className="relative z-20 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto w-full">
      <Image
        src="/Logo_Rambleio.png"
        alt="Rambleio"
        height={32}
        width={130}
        className="h-8 w-auto"
        style={{ width: 'auto' }}
        priority
      />
      <div className="flex items-center gap-3">
        <NavAuthButtons />
      </div>
    </nav>
  );
}

// ── Hero ───────────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="relative h-screen overflow-hidden">
      <HeroCarousel />
      <div className="absolute top-0 left-0 right-0 z-30">
        <Navbar />
      </div>
      {/* ── Beta notice ── */}
      <div className="absolute bottom-10 left-0 right-0 z-30">
        <div className="max-w-7xl mx-auto px-6 flex justify-end">
          <div className="max-w-xs backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl px-5 py-4 shadow-lg">
            <p className="text-xs font-bold uppercase tracking-widest text-white/60 mb-1">Closed Beta</p>
            <p className="text-sm text-white leading-snug mb-3">
              Rambleio is currently in closed beta. Sign up to our newsletter to receive updates on our progress and find out how you can get involved.
            </p>
            <Link
              href="/newsletter"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#81c784] hover:text-white transition-colors"
            >
              Sign up to the newsletter
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <HeroSection />
    </div>
  );
}

