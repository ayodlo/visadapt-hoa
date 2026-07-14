# App Store Submission Checklist

What's already done in this repo vs. what's still needed — mostly external
account setup and content, not code. Nothing in this checklist has been
submitted to a store; it's all local config and a plan.

## Done in this repo

- [x] `app.json` — placeholder bundle identifiers (`com.communityhq.app` for
      both iOS `bundleIdentifier` and Android `package`), initial
      `buildNumber`/`versionCode`
- [x] Placeholder icon/splash/adaptive-icon assets (simple generated house
      glyph on blue, replacing Expo's default template icon) — see
      [Replace placeholder branding](#replace-placeholder-branding) below
- [x] `eas.json` — `development`/`preview`/`production` build profiles with
      per-profile `EXPO_PUBLIC_API_URL`
- [x] Privacy policy page at `nextjs/app/privacy/page.tsx` (real content,
      reachable without login) — see [Privacy policy](#privacy-policy) below

## Still needed (in order)

### 1. Replace placeholder branding
- **Bundle identifier**: `com.communityhq.app` is a placeholder. If you own a
  real domain, prefer its reverse form (e.g. `com.yourdomain.app`). This is
  effectively permanent once you first submit to either store — changing it
  later means a new app listing, not an update.
- **Icons/splash**: the generated house-glyph icon is a placeholder, not
  final design. Replace `mobile/assets/icon.png`,
  `android-icon-foreground.png`, `android-icon-background.png`,
  `android-icon-monochrome.png`, `favicon.png`, and `splash-icon.png` with
  real branded assets before submitting (same filenames/dimensions — see
  each file's current size for the exact spec Expo expects).

### 2. Deploy the backend so the app has a real API to talk to
- The web app isn't deployed yet (see root `DEVLOG.md` — Vercel deploy is
  still on the TODO list). `eas.json`'s `preview`/`production` profiles point
  `EXPO_PUBLIC_API_URL` at the placeholder `https://your-app.vercel.app` —
  update this to the real deployed URL once it exists.
- This also makes the privacy policy page (`/privacy`) reachable at a real,
  stable URL — required for both stores' privacy policy link field.

### 3. Apple Developer Program
- Enroll at [developer.apple.com](https://developer.apple.com) ($99/year).
  Needed before any iOS build can be submitted to TestFlight or the App
  Store.

### 4. Google Play Console
- Register at [play.google.com/console](https://play.google.com/console)
  ($25 one-time). Needed before any Android build can be submitted to
  internal testing or production.

### 5. EAS account + project linking
- Create a free [expo.dev](https://expo.dev) account if you don't have one.
- From `mobile/`, run `eas login`, then `eas init` (or `eas build:configure`)
  to link this project to your account — this writes a real
  `extra.eas.projectId` into `app.json` (currently absent; a fabricated one
  would break builds, so this step can't be done without your account).
- **This is now also a push notification blocker, not just a build blocker**:
  `Notifications.getExpoPushTokenAsync()` (in
  `mobile/src/notifications/registerPushToken.ts`) requires this project ID
  to mint a token. Until `eas init` runs, the registration call fails
  silently (caught, logged in dev only, doesn't crash the app) and no device
  ever gets a push token — the full server-side pipeline (DB model, API
  route, all 6 trigger points) is in place and tested against the real Expo
  push API, but nothing will actually arrive on a device until this step is
  done.
- First builds: `eas build --profile production --platform ios` and
  `--platform android`.

### 6. Store privacy declarations
Both stores require you to declare what data the app collects — use the
[Privacy policy](#privacy-policy) content below as the source of truth for
answering these, since it already reflects exactly what the app actually
collects (no camera/location/contacts/ads/analytics/push, per the real
mobile+API code, not guessed):
- **Apple**: App Privacy "nutrition label" questionnaire in App Store
  Connect (per app, before submission).
- **Google**: Data Safety section in Play Console.

### 7. Store listing content (both stores)
- App description, keywords/category, support URL, marketing screenshots
  (multiple device sizes per store's requirements — none exist yet).
- Content rating questionnaire (Google Play).

### 8. Submit
- `eas submit --platform ios` / `--platform android` once builds and store
  listings are ready.

## Privacy policy

Live at `nextjs/app/privacy/page.tsx` (route: `/privacy`, public — proxy.ts
exempts it from the auth gate). Covers: what's collected (account info,
property address, financial/payment records, issue/architectural
request/violation content, announcement read receipts, poll votes, session
tokens), what's explicitly *not* collected (camera, location, contacts, ad
identifiers, analytics, push), who can see it (role-based within your HOA),
retention, and security. **Before publishing**: replace the placeholder
contact email (`privacy@communityhq.example.com`) with a real one, and
re-review the content if app functionality changes (e.g. if push
notifications or file uploads are added later, the policy needs updating to
match — it's only accurate as of what the app does today).

## Push notifications

Implemented (Phase 6): new announcements, issue comments, violation notices,
and architectural request decisions all trigger a push via `nextjs/lib/push.ts`
(raw Expo Push API, no new server dependency) and
`mobile/src/notifications/registerPushToken.ts`. The privacy policy
(`nextjs/app/privacy/page.tsx`) has been updated to disclose the push token
collection accordingly. **Real delivery to a device is blocked on the EAS
project ID gap in step 5 above** — update store privacy declarations (step 6)
to include push tokens once that's resolved.
