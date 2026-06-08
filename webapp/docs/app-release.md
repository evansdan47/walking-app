# App release policy & session tracking

Tracks **when** users sign in (web vs mobile), **which mobile build** they run, and enforces **minimum / latest native build** thresholds.

## Data model

### `users` (extended)

| Field | Set when |
|-------|----------|
| `lastLoginAtWeb` | Web `upsertCurrentUser` with `client: 'web'` |
| `lastWebAppVersion` | Same |
| `lastLoginAtMobile` | Mobile sync with `client: 'mobile'` |
| `lastMobileBuild` | Native build number (`versionCode` / `buildNumber`) |
| `lastMobileVersion` | Semver string |
| `lastMobilePlatform` | `ios` or `android` |

### `mobileReleasePolicies` (one row per platform)

| Field | Purpose |
|-------|---------|
| `minimumBuild` | Below this → **blocked** (must update). `0` = off |
| `latestBuild` | Below this (but ≥ minimum) → **optional** update prompt. `0` = off |
| `storeUrl` | Play Store / App Store link opened by the app |

## Client flow

1. **Mobile start** — public query `appRelease.checkMobileBuild` (no auth).
2. **Required** — full-screen block + “Open app store”.
3. **Optional** — dismissible modal after app loads.
4. **Sign-in** — `users.upsertCurrentUser` with `client: 'mobile'` + build metadata.
5. **Web sign-in** — `UserSessionSync` calls `upsertCurrentUser` with `client: 'web'`.

Clerk webhooks are **not** used: mobile build numbers must come from the device. Session sync runs on each Clerk session (idempotent per user id per app launch).

## Android / iOS updates

The app **cannot silently install** a new native build. It opens the store via `Linking.openURL`:

- Android: `market://details?id=com.rambleio.app` (fallback to HTTPS Play Store URL)
- iOS: configured `storeUrl` (set your App Store id URL when published)

[Google Play In-App Updates](https://developer.android.com/guide/playcore/in-app-updates) could be added later for a smoother Android flow.

## Admin setup

### Seed policies (Convex dashboard)

Insert into **`mobileReleasePolicies`** or run `appRelease.adminSeedDefaults` as admin.

Example **Android** row:

```json
{
  "platform": "android",
  "minimumBuild": 0,
  "latestBuild": 0,
  "storeUrl": "https://play.google.com/store/apps/details?id=com.rambleio.app",
  "optionalUpdateMessage": "A new version of Rambleio is available on Google Play.",
  "requiredUpdateMessage": "This version is no longer supported. Please update from Google Play.",
  "updatedAt": 1735689600000
}
```

### Enforce a minimum build

When you publish build **42** and need everyone on **40+**:

```text
appRelease.adminUpdatePolicy({
  platform: "android",
  minimumBuild: 40,
  latestBuild: 42
})
```

- Builds **39** and below → blocked.
- Build **41** → optional “Update available”.
- Build **42+** → no prompt.

EAS production uses `autoIncrement: true` — the native build number is in the EAS build log / Play Console.

## Key files

| Path | Role |
|------|------|
| `convex/appRelease.ts` | `checkMobileBuild`, admin policy mutations |
| `convex/users.ts` | `upsertCurrentUser` session fields |
| `components/app/mobile-build-gate.tsx` | Mobile block + optional modal |
| `hooks/use-user-session-sync.ts` | Mobile Clerk → Convex sync |
| `webapp/src/components/user-session-sync.tsx` | Web sync |
