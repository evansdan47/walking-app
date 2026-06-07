# Rambleio webapp — agent guide

Next.js 16 App Router frontend for **Rambleio** (walking & hiking: plan routes, explore trails, review recorded walks). Production URL: **https://rambleio.com**.

## Documentation

**Full route and page documentation:** [`docs/sitemap.md`](docs/sitemap.md)  
**Tagging system (planned):** [`docs/taggingsystem.md`](docs/taggingsystem.md) · [`docs/TaggingSystemRoadmap.md`](docs/TaggingSystemRoadmap.md)  
**Docs index:** [`docs/index.md`](docs/index.md)

---

## Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Auth | Clerk (`@clerk/nextjs`) — closed beta, invite-only |
| Backend | Convex (`webapp/convex/`) — shared with mobile app |
| Maps | Mapbox GL (`react-map-gl`) — explore, planner, activity modes |

---

## Monorepo notes

- Webapp path: `webapp/`
- **Convex source of truth is the monorepo root** (`walking-app/convex/`). Run `npx convex dev` from `walking-app/`, not from `webapp/`. After deploy, `node scripts/sync-convex-generated.js` copies `convex/` → `webapp/convex/` for the Next.js app. Edits made only under `webapp/convex/` are **not** deployed until copied to the root.
- Path alias `@convex` → `webapp/convex/` (see `next.config.ts`).

---

## Route map (summary)

| Route | Access | Role |
|-------|--------|------|
| `/` | Public | Landing hero; signed-in users → `/home` |
| `/newsletter` | Public | Waitlist + survey (Convex) |
| `/sign-in`, `/sign-up` | Public | Clerk auth (`noindex`) |
| `/home` | Auth | Beta dashboard hub |
| `/map?mode=` | Auth | Map shell — `explore`, `planner`, `activity` (+ `community` nav placeholder) |
| `/planner`, `/explore` | Auth | Redirects to `/map?mode=…` |
| `/walks` | Auth | Walk history list |
| `/profile` | Auth | User profile (name, weight, settings) |

**Auth middleware:** `src/proxy.ts` — public routes matcher; everything else `auth.protect()`.

**SEO:** only `/` and `/newsletter` in `src/app/sitemap.ts`. Dashboard/auth routes use `noIndexMetadata`.

---

## Key directories

```
src/app/              App Router pages & layouts
src/app/components/   Landing-only (hero carousel, landing-page)
src/components/       Shared UI (map shell, dashboard header, pace context)
src/lib/              site.ts, metadata.ts, seo-content.ts
convex/               Backend schema & functions
docs/                 Technical documentation (add entries to docs/index.md)
public/               Static assets (slides/, logos)
```

---

## Map architecture

One **MapShell** (`src/components/map/map-shell.tsx`) on `/map`. Mode from `?mode=` URL param; viewport preserved via `?lat=&lng=&zoom=`. Overlays: `explore-overlay`, `planner-overlay`, `activity-overlay`.

Global **activity pace** (`PaceProvider`, `PanelPacePicker` in planner/explore panels) drives estimated times — see [`docs/activity-pace.md`](docs/activity-pace.md) and the `global-pace` skill.

---

## Landing page

- `HeroCarousel` — JPG slides, Ken Burns effects (`hero-ken-burns.ts`), 10s auto-advance, crossfade, pause/play progress pills.
- Closed-beta panel in `landing-page.tsx` — use `pointer-events-none` on wrappers, `pointer-events-auto` on the card only (do not block carousel controls).

---

## Documentation conventions

When adding features or routes, update **`docs/sitemap.md`** and **`docs/index.md`**. Follow [`.claude/skills/documenter/SKILL.md`](.claude/skills/documenter/SKILL.md).

---

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->
