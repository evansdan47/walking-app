import Link from 'next/link';

const SECTIONS = [
  {
    href: '/explore',
    label: 'Explore',
    description: 'Discover trails and routes near you',
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
    ),
    accent: 'bg-sky-50 text-sky-600 border-sky-100 hover:border-sky-300',
    iconBg: 'bg-sky-100 text-sky-600',
  },
  {
    href: '/planner',
    label: 'Plan',
    description: 'Build and share your next adventure',
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
        <line x1="9" y1="3" x2="9" y2="18" />
        <line x1="15" y1="6" x2="15" y2="21" />
      </svg>
    ),
    accent: 'bg-orange-50 text-orange-600 border-orange-100 hover:border-orange-300',
    iconBg: 'bg-orange-100 text-orange-600',
  },
  {
    href: '/walks',
    label: 'Review Walks',
    description: 'Revisit your walk history and stats',
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    accent: 'bg-green-50 text-green-700 border-green-100 hover:border-green-300',
    iconBg: 'bg-green-100 text-green-700',
  },
];

type BadgeVariant = 'new' | 'improvement' | 'fix';

const BADGE: Record<BadgeVariant, string> = {
  new:         'bg-emerald-100 text-emerald-700',
  improvement: 'bg-sky-100 text-sky-700',
  fix:         'bg-amber-100 text-amber-700',
};

const UPDATES: { date: string; badge: BadgeVariant; title: string; body: string }[] = [
  {
    date:  '3 June 2026',
    badge: 'new',
    title: 'Immersive photo viewer',
    body:  'Tap any photo in a walk\u2019s Photography gallery and it opens full-screen. Swipe or use the arrow keys to move through the set, and jump straight to any shot from the thumbnail rail along the bottom. Your place on the map highlights as you browse.',
  },
  {
    date:  '3 June 2026',
    badge: 'new',
    title: 'Your walk photos on the map',
    body:  'Open a completed walk in Activity and every synced photo appears as a pin along the route. The detail panel now includes a timestamped gallery\u2014clock time and elapsed time from the start of the walk\u2014so you can relive the day in order.',
  },
  {
    date:  '3 June 2026',
    badge: 'improvement',
    title: 'Activity list, mobile-style',
    body:  'The activity sidebar now mirrors the app you know: a photo strip (first four shots, with a +N badge when there are more), a miniature route shape coloured by difficulty, and quick stats at a glance. Use the \u2026 menu to view a walk or remove it\u2014with a confirmation step so nothing disappears by accident.',
  },
  {
    date:  '3 June 2026',
    badge: 'new',
    title: 'Tell us how the walk felt',
    body:  'After you finish a walk, you may see a short prompt asking what the route was like. We\u2019re running a small experiment with a few different layouts to find the friendliest way to capture tags from walkers. Skip anytime\u2014your walks still save as normal. On mobile, the same flow appears when you open a completed walk summary.',
  },
  {
    date:  '3 June 2026',
    badge: 'new',
    title: 'Tag routes when you save them',
    body:  'When you save a planned route, you can add characteristics (landscape, difficulty, facilities, and more) with optional auto-suggestions from the route geometry. Tagged routes show their labels on the Explore detail panel, helping everyone understand what a walk is like before they set out.',
  },
  {
    date:  '3 June 2026',
    badge: 'improvement',
    title: 'Explore: clearer multi-route pins',
    body:  'Where several routes share a start point, hovering still cycles the highlight on the map\u2014but without the floating tooltip getting in the way. Clicking the pin opens a reliable picker panel; double-clicks no longer leave it stuck until you pan the map.',
  },
  {
    date:  'June 2025',
    badge: 'new',
    title: 'Beta launch',
    body:  'Rambleio is live for early testers. Explore routes, plan walks with the multi-leg planner, and track your history.',
  },
];

export default function BetaHomePage() {
  return (
    <div className="absolute inset-0 pt-14 bg-gray-50 overflow-y-auto pointer-events-auto">
      <div className="max-w-4xl mx-auto px-6 py-10">

        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome to Rambleio Beta</h1>
          <p className="text-sm text-gray-500">
            You&rsquo;re one of our early testers. Choose an area below to get started.
          </p>
        </div>

        {/* Three section cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          {SECTIONS.map(({ href, label, description, icon, accent, iconBg }) => (
            <Link
              key={href}
              href={href}
              className={`flex flex-col gap-4 rounded-2xl border p-6 transition-all shadow-sm hover:shadow-md ${accent}`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconBg}`}>
                {icon}
              </div>
              <div>
                <p className="font-semibold text-gray-900 mb-0.5">{label}</p>
                <p className="text-sm text-gray-500 leading-snug">{description}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* What's New */}
        <h2 className="text-lg font-semibold text-gray-900 mb-4">What&rsquo;s new</h2>
        <div className="flex flex-col gap-4">
          {UPDATES.map(({ date, badge, title, body }) => (
            <div key={`${date}-${title}`} className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${BADGE[badge]}`}>
                  {badge.charAt(0).toUpperCase() + badge.slice(1)}
                </span>
                <span className="text-xs text-gray-400">{date}</span>
              </div>
              <p className="font-semibold text-gray-900 mb-1">{title}</p>
              <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
