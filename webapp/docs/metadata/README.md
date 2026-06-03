# SEO & metadata — setup and launch checklist

This document describes the search and social metadata wired into the Rambleio webapp gateway (`https://rambleio.com`), what is already in place, and what you should review or finish before and after launch.

## Goals

- **Search engines** can index the public marketing pages with accurate titles, descriptions, canonical URLs, `robots.txt`, and `sitemap.xml`.
- **Social platforms** (Facebook, LinkedIn, X, Slack, iMessage, etc.) show a sensible preview when someone shares a link.
- **Structured data** (JSON-LD) tells Google what Rambleio is (organization + software app).
- **Authenticated app routes** stay out of search results (`noindex` + `robots` disallow).

---

## What is already implemented

| Area | Location | Notes |
|------|----------|--------|
| Site URL & handles | `src/lib/site.ts` | Defaults to `https://rambleio.com` |
| Page copy (titles, descriptions, keywords) | `src/lib/seo-content.ts` | Single place to edit marketing text |
| Next.js `Metadata` API | `src/lib/metadata.ts` | Root, landing, newsletter, `noindex` helpers |
| Root layout metadata | `src/app/layout.tsx` | Imports `rootMetadata` |
| Landing page | `src/app/page.tsx` | `landingPageMetadata` + JSON-LD |
| Newsletter page | `src/app/newsletter/layout.tsx` | `newsletterPageMetadata` + JSON-LD |
| Auth & dashboard | `src/app/(auth)/layout.tsx`, `src/app/(dashboard)/layout.tsx` | `noindex, nofollow` |
| Crawler rules | `src/app/robots.ts` | Allow `/`, `/newsletter`; disallow app paths |
| Sitemap | `src/app/sitemap.ts` | Only public indexable URLs |
| JSON-LD | `src/components/structured-data.tsx` | Organization, WebSite, SoftwareApplication, WebPage |
| Share image (generated) | `src/app/opengraph-image.tsx` | 1200×630 PNG at build time |
| Favicon / touch icon (generated) | `src/app/icon.tsx`, `src/app/apple-icon.tsx` | Placeholder green “R” |
| Web manifest | `src/app/manifest.ts` | PWA-style metadata |
| Crawler-visible landing copy | `src/app/components/landing-page.tsx` | `sr-only` H1 + intro (carousel is client-only) |
| Static OG drop folder | `public/og/` | For optional hand-designed share image |

After deploy, these routes are available:

- `https://rambleio.com/robots.txt`
- `https://rambleio.com/sitemap.xml`
- `https://rambleio.com/opengraph-image` (used as `og:image` via Next.js file convention)

---

## Environment variables

Add to `.env.local` (see `.env.local.example`):

```env
NEXT_PUBLIC_SITE_URL=https://rambleio.com
```

Use your staging URL on preview deployments so `metadataBase`, canonical links, sitemap, and JSON-LD `@id` values stay correct.

---

## Pre-launch checklist (manual work)

### 1. Marketing copy — **required**

Edit **`src/lib/seo-content.ts`**:

| Field | Guidance |
|-------|----------|
| `LANDING_SEO.title` | ~50–60 characters; primary keywords near the start |
| `LANDING_SEO.description` | ~150–160 characters; include a clear CTA (e.g. newsletter / beta) |
| `LANDING_SEO.shortTitle` | Used for Open Graph / Twitter; can match or shorten the main title |
| `LANDING_SEO.keywords` | Optional hint for some engines; focus on real search terms |
| `LANDING_SEO.h1` / `intro` | Must align with metadata; also used in `sr-only` block on `/` |
| `NEWSLETTER_SEO.*` | Same rules for `/newsletter` |

Keep landing `h1` / `intro` in sync with the visible product message on the hero carousel.

### 2. Site identity — **required**

Edit **`src/lib/site.ts`**:

- `TWITTER_HANDLE` — set to your real `@handle` when the account exists (remove or leave placeholder if not live).
- `CONTACT_EMAIL` — use a monitored inbox (used in JSON-LD `Organization`).

### 3. Social share image — **recommended**

**Option A — keep generated image (current)**  
Customize **`src/app/opengraph-image.tsx`** (colours, tagline, layout). Rebuild and re-scrape in social debuggers after changes.

**Option B — use a designed static asset**

1. Export **`public/og/rambleio-og.png`** at **1200×630 px** (&lt; 8 MB).
2. In **`src/lib/metadata.ts`**, add to `rootMetadata` (and landing/newsletter if different):

   ```ts
   openGraph: {
     images: [{ url: "/og/rambleio-og.png", width: 1200, height: 630, alt: "…" }],
   },
   twitter: {
     images: ["/og/rambleio-og.png"],
   },
   ```

3. Remove or rename **`src/app/opengraph-image.tsx`** so it does not override the static file.

Test text readability at thumbnail size on mobile share previews.

### 4. Favicon & app icons — **recommended**

Replace placeholder generators:

- **`src/app/icon.tsx`** — browser tab (32×32).
- **`src/app/apple-icon.tsx`** — Apple touch icon (180×180).

Or add PNGs under `public/` and reference them from **`src/app/manifest.ts`** (`icons` array is commented as optional).

### 5. Search Console & Bing — **after first production deploy**

1. [Google Search Console](https://search.google.com/search-console) — add property `https://rambleio.com`.
2. Verify ownership via DNS or HTML tag. For HTML tag, uncomment in **`src/lib/metadata.ts`**:

   ```ts
   verification: { google: "your-token-from-search-console" },
   ```

3. Submit sitemap: `https://rambleio.com/sitemap.xml`.
4. Repeat for [Bing Webmaster Tools](https://www.bing.com/webmasters) if desired.

### 6. Optional: visible landing SEO copy

The hero is a client carousel; crawlers rely on metadata and the **`sr-only`** block. For stronger rankings, consider a short **visible** paragraph below the fold (same text as `LANDING_SEO.intro`) without hurting the hero design.

### 7. New public pages

When you add indexable marketing routes (e.g. `/about`, `/pricing`):

1. Add copy to **`src/lib/seo-content.ts`** (or a page-local `metadata` export).
2. Add the URL to **`src/app/sitemap.ts`**.
3. Allow it in **`src/app/robots.ts`** if it was previously disallowed.
4. Add JSON-LD in **`src/components/structured-data.tsx`** if the page needs its own `WebPage` type.

Keep **`noIndexMetadata`** on anything behind login or with no public value.

---

## File reference (quick map)

```
src/lib/
  site.ts              # SITE_URL, SITE_NAME, TWITTER_HANDLE, CONTACT_EMAIL
  seo-content.ts       # Titles, descriptions, keywords, H1, intro — EDIT FIRST
  metadata.ts          # Next.js Metadata objects; Search Console verification

src/app/
  layout.tsx           # rootMetadata
  page.tsx             # Landing metadata + <StructuredData />
  robots.ts            # Crawl rules
  sitemap.ts           # Public URL list
  manifest.ts          # Web app manifest
  opengraph-image.tsx  # Generated 1200×630 share card
  icon.tsx             # Favicon
  apple-icon.tsx       # Touch icon
  newsletter/layout.tsx

src/components/
  structured-data.tsx  # JSON-LD script tags

public/og/
  (rambleio-og.png)    # Optional static share image
```

---

## Indexing policy (current)

| Route | Indexed? | Mechanism |
|-------|----------|-----------|
| `/` | Yes | `landingPageMetadata`, sitemap, robots allow |
| `/newsletter` | Yes | `newsletterPageMetadata`, sitemap, robots allow |
| `/sign-in`, `/sign-up` | No | `noIndexMetadata` + robots disallow |
| `/home`, `/map`, `/explore`, `/walks`, `/profile`, `/planner` | No | `noIndexMetadata` + robots disallow + Clerk auth |

---

## Post-deploy verification

1. **View page source** on `https://rambleio.com` — confirm `<title>`, `meta name="description"`, `og:*`, `twitter:*`, and JSON-LD `<script type="application/ld+json">`.
2. **robots.txt** — `curl https://rambleio.com/robots.txt`
3. **sitemap.xml** — `curl https://rambleio.com/sitemap.xml`
4. **Share preview** — [Meta Sharing Debugger](https://developers.facebook.com/tools/debug/), [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/), X card validator (when available).
5. **Rich results** — [Google Rich Results Test](https://search.google.com/test/rich-results) on `/` (optional; validates JSON-LD).

After changing OG image or metadata, use each platform’s “Scrape again” / “Refresh” so caches update.

---

## Local development

Metadata uses `NEXT_PUBLIC_SITE_URL` when set; otherwise **`https://rambleio.com`**. For local OG URL testing you can temporarily set:

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Social debuggers require a **public HTTPS** URL, so final share-image checks must happen on production or a preview URL with the env var pointed at that host.

---

## Related Next.js docs

- [Metadata API](https://nextjs.org/docs/app/building-your-application/optimizing/metadata)
- [opengraph-image](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image)
- [robots.ts / sitemap.ts](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots)
