# Stage Zero: Project Setup – Implementation Roadmap

This document covers everything that should be done **before** stage one recording begins. The goal is a clean, themed, authenticated shell with the right folder structure, design system, and infrastructure wired up — so that every feature built afterwards has a solid foundation and consistent visual language.

---

## 1. Clean Up the Expo Template

The project was initialised with `create-expo-app` which added a number of demo screens, assets, and boilerplate components that should not ship. These need removing cleanly.

### Files to delete

```
app/(tabs)/explore.tsx          ← Expo template demo screen
app/modal.tsx                   ← Expo template modal demo
components/hello-wave.tsx       ← animated wave emoji
components/parallax-scroll-view.tsx  ← decorative hero scroll view
components/external-link.tsx    ← used only by explore.tsx
assets/images/partial-react-logo.png
assets/images/react-logo.png
assets/images/react-logo@2x.png
assets/images/react-logo@3x.png
```

### Files to replace with app-specific stubs

| File | Replace with |
|---|---|
| `app/(tabs)/index.tsx` | Walk library screen stub (see Section 9) |
| `app/(tabs)/_layout.tsx` | App tab bar (see Section 9) |
| `app/_layout.tsx` | Root layout with Convex provider + auth |

### Components to keep and rename

The following template components have good bones — keep them but update token values to use the new design system (Section 3):

| Current file | Keep as | Reason |
|---|---|---|
| `components/themed-text.tsx` | Keep | Wire up to new typography scale |
| `components/themed-view.tsx` | Keep | Wire up to new colour tokens |
| `components/haptic-tab.tsx` | Keep | Used in tab bar |
| `components/ui/collapsible.tsx` | Keep | Useful in settings/profile |
| `components/ui/icon-symbol.tsx` + `.ios.tsx` | Keep | SF Symbols / MaterialIcons wrapper |

---

## 2. Folder Structure

Establish the full folder structure now so all stages have consistent homes.

```
app/
  _layout.tsx                  ← root layout (Convex + auth providers)
  +not-found.tsx               ← 404 screen (replace template content)
  walk-summary.tsx             ← post-walk summary (Stage 1)
  (tabs)/
    _layout.tsx                ← tab bar
    index.tsx                  ← Walk Library (home)
    record.tsx                 ← Recording screen (Stage 1)
    profile.tsx                ← User profile / settings stub
  (auth)/
    _layout.tsx                ← unauthenticated stack
    sign-in.tsx                ← Sign-in screen
    sign-up.tsx                ← Sign-up screen (if using email/password)

components/
  shared/                      ← reusable across all stages
  recording/                   ← Stage 1 specific
  review/                      ← Stage 2 specific (create empty dir)
  replay/                      ← Stage 3 specific (create empty dir)
  ui/                          ← existing icon-symbol + collapsible

constants/
  theme.ts                     ← expanded (see Section 3)

hooks/
  use-auth.ts                  ← auth state hook
  use-color-scheme.ts          ← existing, keep
  use-theme-color.ts           ← existing, keep

lib/
  db/                          ← SQLite layer (Stage 1)
  location/                    ← GPS engine (Stage 1)
  sync/                        ← Sync pipeline (Stage 1)

convex/
  schema.ts                    ← already created
  auth.config.ts               ← auth provider config
  users.ts                     ← user mutations
```

---

## 3. Design System / Theme (`constants/theme.ts`)

Replace the placeholder tint colours with the full design token set from the style guide. Everything else in the app imports from this single file — no hardcoded colour strings anywhere.

### Colour tokens

```ts
export const Palette = {
  // Primary – intent and action
  orange: {
    900: '#BF360C',
    800: '#D84315',
    700: '#E65100',   // ← Primary action (Start button, CTA)
    600: '#F4511E',
    100: '#FBE9E7',   // ← subtle tinted background
  },
  // Secondary – status and confirmation
  green: {
    900: '#1B5E20',
    800: '#2E7D32',   // ← Active / success
    700: '#388E3C',
    100: '#E8F5E9',   // ← soft pill background
  },
  // Tertiary – supporting UI
  teal: {
    900: '#004D40',
    800: '#00695C',
    700: '#006064',   // ← icons, secondary controls
    100: '#E0F2F1',
  },
  // Neutral – structure
  slate: {
    900: '#263238',
    800: '#37474F',
    700: '#455A64',   // ← primary text / containers
    600: '#546E7A',
    400: '#78909C',
    200: '#B0BEC5',
    100: '#ECEFF1',
    50:  '#F5F7F8',
  },
  white: '#FFFFFF',
  black: '#000000',
} as const;

export const Colors = {
  light: {
    // Text
    text:           Palette.slate[700],
    textMuted:      Palette.slate[400],
    textInverse:    Palette.white,
    // Backgrounds
    background:     Palette.white,
    backgroundCard: Palette.slate[50],
    backgroundMuted:Palette.slate[100],
    // Brand
    primary:        Palette.orange[700],
    primaryMuted:   Palette.orange[100],
    secondary:      Palette.green[800],
    secondaryMuted: Palette.green[100],
    tertiary:       Palette.teal[700],
    tertiaryMuted:  Palette.teal[100],
    // UI
    border:         Palette.slate[200],
    icon:           Palette.slate[400],
    tint:           Palette.orange[700],
    tabIconDefault: Palette.slate[400],
    tabIconSelected:Palette.orange[700],
  },
  dark: {
    text:           Palette.slate[100],
    textMuted:      Palette.slate[400],
    textInverse:    Palette.slate[900],
    background:     Palette.slate[900],
    backgroundCard: Palette.slate[800],
    backgroundMuted:Palette.slate[700],
    primary:        Palette.orange[600],
    primaryMuted:   '#4A1A00',
    secondary:      Palette.green[700],
    secondaryMuted: '#0A2E0C',
    tertiary:       Palette.teal[700],
    tertiaryMuted:  '#012928',
    border:         Palette.slate[700],
    icon:           Palette.slate[400],
    tint:           Palette.orange[600],
    tabIconDefault: Palette.slate[400],
    tabIconSelected:Palette.orange[600],
  },
} as const;
```

### Typography tokens

Load a custom font (see Section 4). Define the full scale here so `ThemedText` can reference it.

```ts
export const Typography = {
  // Font families — resolved after font loading
  fontSans:    'Inter_400Regular',
  fontSansMed: 'Inter_500Medium',
  fontSansBold:'Inter_700Bold',

  // Scale
  sizes: {
    xs:   11,
    sm:   13,
    base: 16,
    md:   18,
    lg:   22,
    xl:   28,
    xxl:  36,
    hero: 56,   // large stat display (elapsed timer)
  },
  lineHeights: {
    tight:  1.2,
    normal: 1.5,
    loose:  1.8,
  },
} as const;
```

### Spacing & radius tokens

```ts
export const Spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  base:16,
  lg:  24,
  xl:  32,
  xxl: 48,
} as const;

export const Radius = {
  sm:   6,
  md:   12,
  lg:   20,
  full: 999,  // pill shapes
} as const;
```

### Elevation / shadow tokens

```ts
export const Shadows = {
  card: {
    shadowColor: Palette.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,   // Android
  },
  modal: {
    shadowColor: Palette.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;
```

---

## 4. Custom Font (Inter)

The style guide calls for a clean, modern sans-serif. **Inter** is the best match: open-source, highly legible at small sizes, excellent for numeric stat displays, and widely used in mobile apps.

### Install

```bash
npx expo install expo-font @expo-google-fonts/inter
```

### Load in root layout

```ts
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;
  // ... rest of layout
}
```

### Update `ThemedText`

Extend the `type` prop to include the full typography scale and wire each variant to the `Typography` tokens. Remove all hardcoded pixel values from `ThemedText` styles.

```
type prop variants (updated):
  'hero'           — 56px bold, used for elapsed timer
  'title'          — 28px bold
  'subtitle'       — 22px semibold
  'label'          — 11px medium uppercase + letter-spacing, used for stat labels
  'body'           — 16px regular
  'bodyMed'        — 16px medium
  'bodySemiBold'   — 16px semibold  (was 'defaultSemiBold')
  'caption'        — 13px regular
  'link'           — 16px medium, primary colour
```

---

## 5. App Icon and Splash Screen

The template ships with placeholder React logo assets. These should be replaced before any real device testing so the app looks intentional from day one.

### What to create

| Asset | Size | Notes |
|---|---|---|
| `assets/images/icon.png` | 1024×1024 | App icon, no rounded corners (OS applies mask) |
| `assets/images/splash-icon.png` | 200×200 | Centred mark on splash |
| `assets/images/favicon.png` | 48×48 | Web tab favicon |
| `assets/images/android-icon-foreground.png` | 108×108 (in 432×432 canvas) | Adaptive icon foreground |
| `assets/images/android-icon-background.png` | 432×432 | Adaptive icon background — use `Palette.orange[100]` |
| `assets/images/android-icon-monochrome.png` | 432×432 | Monochrome variant |

### Update `app.json` splash config

Set `backgroundColor` on the splash to match the brand:
```json
"splash": {
  "backgroundColor": "#FBE9E7",
  "resizeMode": "contain"
}
```

Remove the `partial-react-logo.png`, `react-logo*.png` files once replaced.

---

## 6. Authentication Setup

The app needs authentication before any user data (walks, photos, follow sessions) can be stored. Authentication is required from the moment a user opens the recording screen.

### Recommended provider: Clerk

Clerk is the simplest integration for Convex and supports the full auth flow (sign-in, sign-up, session management, JWT issuing) without requiring a custom backend. It has an official Expo SDK.

### Install

```bash
npm install @clerk/clerk-expo
npx expo install expo-secure-store
```

### Convex auth config (`convex/auth.config.ts`)

```ts
export default {
  providers: [
    {
      domain: 'https://<your-clerk-instance>.clerk.accounts.dev',
      applicationID: 'convex',
    },
  ],
};
```

### Environment variables (`.env.local`)

```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CONVEX_DEPLOYMENT=dev:...
EXPO_PUBLIC_CONVEX_URL=https://...convex.cloud
```

> **Never commit `.env.local`.** Confirm it is in `.gitignore`.

### Root layout wiring (`app/_layout.tsx`)

```tsx
import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { ConvexProviderWithAuth, ConvexReactClient } from 'convex/react';
import * as SecureStore from 'expo-secure-store';

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!);

const tokenCache = {
  getToken: (key: string) => SecureStore.getItemAsync(key),
  saveToken: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  deleteToken: (key: string) => SecureStore.deleteItemAsync(key),
};

export default function RootLayout() {
  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      tokenCache={tokenCache}
    >
      <ConvexProviderWithAuth client={convex} useAuth={useAuth}>
        <RootNavigator />
      </ConvexProviderWithAuth>
    </ClerkProvider>
  );
}
```

> `ConvexProviderWithAuth` (not plain `ConvexProvider`) is required so auth tokens are forwarded with every Convex request. Using plain `ConvexProvider` means `ctx.auth.getUserIdentity()` always returns `null`.

### Auth route guard

Use a layout-level guard in `app/(tabs)/_layout.tsx`. If `!isSignedIn`, redirect to `/(auth)/sign-in`. This means unauthenticated users can never reach recording, the library, or profile screens.

```tsx
import { useAuth } from '@clerk/clerk-expo';
import { Redirect } from 'expo-router';

export default function TabLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;
  // ... Tabs
}
```

### User record creation (`convex/users.ts`)

A `mutation` that upserts on `tokenIdentifier`. Called once from the app after sign-in is confirmed:

```ts
export const upsertCurrentUser = mutation({
  args: { name: v.optional(v.string()), email: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');
    const existing = await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', q => q.eq('tokenIdentifier', identity.tokenIdentifier))
      .unique();
    if (existing) return existing._id;
    return await ctx.db.insert('users', {
      tokenIdentifier: identity.tokenIdentifier,
      name: args.name ?? identity.name ?? undefined,
      email: args.email ?? identity.email ?? undefined,
    });
  },
});
```

### Auth screens

Two minimal screens in `app/(auth)/`:

**`sign-in.tsx`**
- Email + password fields (or OAuth buttons via Clerk)
- Primary orange CTA: "Sign In"
- Link to sign-up
- Branded header with app name

**`sign-up.tsx`**
- Name, email, password fields
- Confirm password
- Primary CTA: "Create Account"
- Link back to sign-in

Both screens use the design system colours and `ThemedText` — no ad-hoc styles.

---

## 7. Convex Setup Verification

Convex is already in `package.json`. Before stage one, confirm the following are working:

### Checklist

- [ ] `.env.local` contains `CONVEX_DEPLOYMENT` and `EXPO_PUBLIC_CONVEX_URL`
- [ ] `npx convex dev` starts without errors and picks up `convex/schema.ts`
- [ ] The `users`, `walks`, `trackPoints`, `walkPhotos`, `syncJobs`, `followSessions`, `offRouteEvents` tables are visible in the Convex dashboard
- [ ] `convex/auth.config.ts` is created and points to the correct Clerk domain
- [ ] `convex/users.ts` `upsertCurrentUser` mutation deploys successfully
- [ ] A test sign-in from the app successfully creates a `users` document in the dashboard

---

## 8. ESLint and TypeScript Configuration

The project has `eslint-config-expo` and TypeScript. Tighten the config before writing feature code so bad patterns are caught early.

### `tsconfig.json` — confirm strict mode is on

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

`noUncheckedIndexedAccess` is particularly valuable for SQLite result arrays and GPS point arrays — it forces explicit null checks.

### `eslint.config.js` — add rules

Add to the existing config:
```js
rules: {
  'no-console': ['warn', { allow: ['warn', 'error'] }],
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-floating-promises': 'error',
}
```

`no-floating-promises` catches unhandled async calls, which is critical for the SQLite write path in the background task.

### Path aliases

Confirm `@/` resolves to the workspace root (already set up by the template). Add additional aliases for cleaner imports:

```json
// tsconfig.json paths
"@/lib/*": ["./lib/*"],
"@/convex/*": ["./convex/*"]
```

---

## 9. App Shell – Tab Bar and Stub Screens

Replace the template tab structure with the real app navigation. Three tabs in the MVP:

| Tab | Icon | Screen | Stage |
|---|---|---|---|
| Library | `list.bullet` | Walk list (stub in Stage 0) | Stage 2 |
| Record | `record.circle` | Recording screen | Stage 1 |
| Profile | `person.circle` | User profile / settings | Stage 0 stub |

### Tab bar style

In `app/(tabs)/_layout.tsx`:
```ts
tabBarStyle: {
  backgroundColor: Colors[colorScheme].background,
  borderTopColor: Colors[colorScheme].border,
  height: 60,
},
tabBarActiveTintColor: Colors[colorScheme].primary,       // orange
tabBarInactiveTintColor: Colors[colorScheme].tabIconDefault, // slate
tabBarLabelStyle: {
  fontFamily: Typography.fontSansMed,
  fontSize: Typography.sizes.xs,
  marginBottom: 4,
},
```

### Stub screen content

Each stub screen should render:
- App header bar with the screen title
- A centred placeholder message: `"Coming in Stage X"`
- The correct background colour from the design system

This confirms routing and theming work end-to-end before any feature code is written.

### Profile screen (minimal, working in Stage 0)

The profile screen should be functional from Stage 0 since it holds sign-out:
- Display name and email from Clerk
- "Sign Out" button (secondary style)
- App version number

---

## 10. Header Component

A shared app header used on all full screens (not modal sheets).

**`components/shared/app-header.tsx`**

```
Props:
  title: string
  onBack?: () => void         — renders a back chevron if provided
  rightAction?: ReactNode     — optional right-side button slot
```

Uses `useSafeAreaInsets()` for top padding. Background uses `Colors.background`. Title uses `ThemedText type="subtitle"`. Consistent across all screens so the visual rhythm is established early.

---

## 11. Sequenced Work Items

### Phase 1 – Clean the template
- [x] Delete template-only files listed in Section 1
- [x] Remove `react-logo*` assets from `assets/images/`
- [x] Remove `scripts/reset-project.js` (one-time utility, no longer needed)
- [ ] Confirm the app still builds and runs after deletion

### Phase 2 – Create folder structure
- [x] Create `components/shared/`, `components/recording/`, `components/review/`, `components/replay/` directories (add `.gitkeep` to empty ones)
- [x] Create `lib/db/`, `lib/location/`, `lib/sync/` directories
- [x] Create `app/(auth)/` directory and layout stub

### Phase 3 – Design system
- [x] Expand `constants/theme.ts` with full `Palette`, `Colors`, `Typography`, `Spacing`, `Radius`, `Shadows` tokens
- [x] Install Inter font (`expo-font` + `@expo-google-fonts/inter`)
- [x] Update `app/_layout.tsx` to load fonts and hold splash screen
- [x] Update `components/themed-text.tsx` with full typography scale
- [x] Update `components/themed-view.tsx` to use new colour tokens

### Phase 4 – App icon and splash
- [ ] Create/source branded icon and splash assets
- [ ] Replace all placeholder image assets
- [ ] Update `app.json` splash background colour

### Phase 5 – Authentication
- [x] Create Clerk account and application
- [x] Install `@clerk/clerk-expo` and `expo-secure-store`
- [x] Create `convex/auth.config.ts`
- [x] Create `convex/users.ts` with `upsertCurrentUser` mutation
- [x] Wire `ClerkProvider` + `ConvexProviderWithAuth` into `app/_layout.tsx`
- [x] Create `app/(auth)/_layout.tsx`, `sign-in.tsx`, `sign-up.tsx`
- [x] Add auth guard to `app/(tabs)/_layout.tsx`
- [x] Deploy and verify user document creation in Convex dashboard

### Phase 6 – App shell
- [x] Replace `app/(tabs)/_layout.tsx` with real tab configuration
- [x] Create stub `app/(tabs)/index.tsx` (Walk Library placeholder)
- [x] Create stub `app/(tabs)/record.tsx` (Recording placeholder)
- [x] Create stub `app/(tabs)/profile.tsx` (Profile — sign-out functional)
- [x] Create `components/shared/app-header.tsx`

### Phase 7 – Config and tooling
- [x] Confirm `tsconfig.json` strict settings
- [x] Update `eslint.config.js` with additional rules
- [x] Run `npx expo lint` — resolve all warnings
- [x] Run `npx convex dev` — confirm schema deploys clean
- [] Install dev build (`npx expo run:ios` and/or `npx expo run:android`) to confirm native modules resolve

### Phase 8 – Acceptance check
- [ ] Fresh install on iOS simulator: splash → sign-up → three tabs visible → sign-out works
- [ ] Fresh install on Android emulator: same flow
- [ ] `npx convex dev` shows all 7 tables in dashboard
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] No ESLint errors (`npx expo lint`)

---

## 12. What Stage Zero Deliberately Does Not Include

These are in scope for later stages but should not be started now:

- Any SQLite setup (Stage 1)
- Any location permissions or GPS code (Stage 1)
- Map SDK installation (Stage 2)
- Push notifications (post-MVP)
- Social/sharing features (post-MVP)

Keeping Stage 0 focused means the foundation is verifiable and stable before adding complexity.
