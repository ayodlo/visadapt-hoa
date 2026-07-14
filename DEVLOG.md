# Dev Log

---

## 2026-07-14 (Fix, part 2: CI still failing after the lockfile fix)

**Files changed:**
- `.github/workflows/ci.yml` — removed `cache: npm`/`cache-dependency-path` from the `actions/setup-node@v4` step.

**Decisions made:**
- The lockfile regeneration below (part 1) fixed the `npm ci` integrity failure, but pushing it (`16c8455`) surfaced a **second, different** failure on the real GitHub Actions runner: `npm test` crashed with `Cannot find native binding` / `Cannot find module '@rolldown/binding-linux-x64-gnu'`, even though the lockfile entry for that exact package is present and correctly formed (`os: ["linux"], cpu: ["x64"]` — verified directly). This is npm's own documented bug (npm/cli#4828, quoted verbatim in the error message rolldown's native loader prints): a restored `~/.npm` cache — via `actions/setup-node@v4`'s built-in caching, which was carrying over stale cache state from all the previously-failing runs since July 5 — causes `npm ci` to silently skip installing a valid optional platform dependency. This reproduces the "works in a fresh environment (my Docker container had an empty cache), fails on the real cached CI runner" pattern exactly.
- Fix is to stop caching npm's download cache for this job entirely, rather than trying to bust/version the cache key — simplest and most robust against this specific bug recurring. User chose to scope the fix to `ci.yml` only (the workflow that's actually broken) rather than also touching `e2e.yml`/`mobile-ci.yml`, which have the same caching setup but haven't demonstrated the bug.

**Next steps:**
- Watch the next CI run to confirm both fixes together (lockfile regen + no npm cache) actually go green — still not yet confirmed via a real passing run as of this entry.
- If `e2e.yml` or `mobile-ci.yml` ever hit this same "Cannot find native binding" class of error, apply the identical fix (drop `cache: npm` from their `actions/setup-node@v4` steps).

**Gotchas:**
- The generic GitHub check-run annotation API only ever reports "Process completed with exit code 1" — no actual error text. Full step output requires the job-logs endpoint, which 403s ("Must have admin rights to Repository") even for a public repo without an authenticated token with repo access. Real diagnosis for this second failure only became possible once the user pasted the actual `npm test` output copied from the Actions UI. Installing `gh` CLI + `gh auth login` would remove this blind spot going forward.

**Verification:** Not yet — this fix is unverified against a real CI run at the time of this entry (see Next steps). Diagnosis (lockfile entry correctness, cache-restore theory) was verified by direct inspection of `package-lock.json`, not just inference.

**Correction (see part 3 below): the caching theory in this entry was wrong.** Pushing the no-cache fix (`6ee58dc`) hit the *identical* error on the next run. The real cause and working fix are in the next entry — this one is left as-is rather than rewritten, since the reproduction process (and getting a plausible-but-wrong theory disproven by an actual CI run) is itself worth keeping visible.

## 2026-07-14 (Fix, part 3: the actual root cause — npm workspaces + rolldown on Linux)

**Files changed:**
- `.github/workflows/ci.yml` — restored `cache: npm` (part 2's removal didn't fix anything, so no reason to keep paying the speed cost); added a step after `npm ci` that explicitly reinstalls `@rolldown/binding-linux-x64-gnu` at whatever version `rolldown` itself resolved to (read dynamically via `node -p`, not hardcoded).

**Decisions made:**
- Root-caused for real this time, via direct reproduction rather than theory: copied the **full repo** (not just `nextjs/`, which is what part 1's Docker reproduction had done, accidentally sidestepping the real trigger) into a `node:24-bookworm` container and ran the exact CI steps. This reproduced the failure deterministically. Systematically ruled out alternatives in the same container: removing the npm cache didn't help; running from the repo root with `npm ci -w nextjs` didn't help; `npm install` instead of `npm ci` didn't help. Every variant failed identically, *as long as the ancestor root `package.json`'s `"workspaces": ["nextjs", "mobile"]` was present* — a standalone copy of `nextjs/` (no ancestor workspace) never reproduces it, on the same OS/npm/Node version.
- Confirmed directly (not inferred) that `npm ci` was leaving `node_modules/@rolldown/` with **zero** linux-gnu binding present at all after a "successful" install — this is npm's own documented optional-dependency bug (npm/cli#4828): when a package (here, `rolldown`, Vite's bundler binding, shipping 15 OS/CPU platform variants) is installed inside an npm workspace, npm's resolver can silently fail to link the correct platform variant, even though the lockfile entry for it is completely correct.
- Fix: rather than restructuring the workspace (bigger, riskier change) or switching install commands (tested, doesn't help), added a targeted extra step that explicitly (re)installs the missing package by name once npm's own resolution has already dropped it. Reads the required version off the already-installed `rolldown` package rather than hardcoding a version number, so it keeps working automatically as `rolldown` gets bumped by future dependency updates.
- This only affects Linux (the bug needs multiple same-family optional variants competing, which Windows's single `win32-x64-msvc` variant never triggers) — confirmed this is why local Windows dev was never affected, and why `nextjs/` isn't being pulled out of the workspace: the workaround is CI-only.

**Next steps:**
- Watch this push's CI run — this is the fix that was actually verified end-to-end in a full-repo container reproduction (unlike parts 1 and 2's theories).
- If `e2e.yml` is ever changed to run `vitest` (it currently only runs Playwright against a built Next.js server, which doesn't touch Vite/rolldown at all — confirmed not affected), apply the same workaround step there.

**Gotchas:**
- Don't trust a "the fix works" conclusion from a partial reproduction — part 1's Docker container test *excluded* the parent directory (copied only `nextjs/` in isolation) and passed, which looked like confirmation but was actually testing a different, non-representative scenario. The tell should have been that a real fix ought to also be reproducible as a *failure* first; only reproducing the passing case proves nothing. Copy the **whole repo structure** (or whatever the real CI checkout actually contains) when reproducing a CI-only failure, not just the directory the failing step happens to `cd` into.

**Verification:** Reproduced the exact failure in a `node:24-bookworm` container using a full-repo copy (matching CI's actual checkout), confirmed `node_modules/@rolldown/` had no linux binding after `npm ci`, then confirmed the explicit-reinstall workaround brings `npm test` back to 113/113 passing in that same container.

## 2026-07-14 (Fix: CI "Unit tests & lint" failing since ~July 5)

**Files changed:**
- `nextjs/package-lock.json` — regenerated. No dependency changes; the diff is purely optional, platform-gated transitive entries (added `@emnapi/core`/`@emnapi/runtime` — needed by Tailwind's oxide engine and Vite's rolldown binding on Linux; a few `fsevents`/`@aws-sdk`/`@smithy` sub-entries shuffled).

**Decisions made:**
- Diagnosed via GitHub's REST API (workflow runs + check-run annotations) that the `CI` workflow's "Unit tests & lint" job had failed on **every** push since at least 2026-07-05 (`08547cd`) — i.e. this predates the entire mobile app / push notifications / mobile test work from this week. Not a regression from recent sessions.
- Confirmed root cause by reproducing the exact CI environment (Node 24, npm 11.6.1, Ubuntu/Debian) in a local Docker container (`node:24-bookworm`) rather than guessing from the (unauthenticated-API-limited) annotation text, which only said generic "Process completed with exit code 1." `npm ci` failed there with `Missing: @emnapi/core@1.11.1 from lock file` — the committed `nextjs/package-lock.json` (last touched at `880c656`, before the Phase 0 monorepo conversion) had drifted out of sync with what `nextjs/package.json`'s dependency tree resolves to on Linux. A from-scratch `npm install` in the same container regenerated a lockfile that passed `npm ci` + all 113 tests there, and was then re-verified to still pass `npm ci` + tests on Windows too (this lockfile has to serve both, since local dev is Windows and CI is Linux).
- Left `ci.yml`/`e2e.yml` untouched — the fix is entirely in the lockfile, not the workflow.

**Next steps:**
- Watch the next CI run on `main` to confirm this actually goes green (only verified locally + in a matching container, not via an actual GitHub Actions run yet).
- `E2E tests` shows "skipped" on every run — that's by design (`if: vars.E2E_ENABLED == 'true'` in `e2e.yml`), not a failure. Needs repo secrets (`DATABASE_URL`, `JWT_SECRET`, AWS keys, `RESEND_API_KEY`, `EMAIL_FROM`) and the `E2E_ENABLED` repo variable set to `true` — both are GitHub repo-admin actions, not something fixable from a working tree.

**Gotchas:**
- If this resurfaces after a future local `npm install` inside `nextjs/` (e.g. adding a package), regenerate on Linux (or via this same Docker approach) rather than trusting a Windows-generated lockfile — Tailwind v4's oxide engine and Vite's rolldown binding both ship platform-specific optional deps (including wasm32-wasi fallbacks needing `@emnapi/*`) that a Windows install won't necessarily record identically to what Linux CI needs.

**Verification:** Reproduced the failure and the fix in a `node:24-bookworm` container matching CI's Node version and OS family: `npm ci` + `npm test` (113/113) both clean against the regenerated lockfile. Re-verified `npm ci` + `npm test` (113/113) + `tsc --noEmit` + `npm run lint` all clean on Windows with the same regenerated lockfile.

## 2026-07-14 (Mobile unit tests — useApi hook)

**Files changed:**
- `mobile/__tests__/hooks/useApi.test.ts` (new) — 7 tests covering the shared fetch/loading/error/pull-to-refresh hook: initial fetch-on-mount stays `loading` until the fetcher resolves, `ApiError` messages surface verbatim while non-`ApiError` failures fall back to a generic message, `refresh()` toggles `refreshing` (not `loading`) and updates data, `reload()` clears a previous error, re-fetches when the `fetcher` identity changes (the documented `useCallback`-at-the-call-site contract), and `setData` applies a direct optimistic update without re-fetching.

**Decisions made:**
- Used a small local `deferred<T>()` helper (a manually-resolvable promise) to assert *intermediate* states — e.g. `loading === true` while a fetch is still in flight, and `refreshing === true` mid-refresh — rather than only asserting eventual settled state. Instant `mockResolvedValue`/`mockRejectedValue` mocks can't produce an observable in-flight window.

**Next steps:**
- Component/screen rendering tests still the next natural batch (deferred twice now, by original scoping choice).
- `eas init` remains the standalone blocker for real push delivery/builds, unrelated to test coverage.

**Gotchas:**
- **Self-inflicted, now fixed:** an `act(() => {...})` call without `await` (easy to miss since `act()` always returns a `Promise` regardless of whether the callback is sync or async) left a dangling async scope that leaked into subsequent tests in the same file, surfacing as `result.current` reading `null` in *later, unrelated* tests — a confusing action-at-a-distance failure mode worth remembering: if a `result.current` in an RTL hook test is unexpectedly `null`, check every `act(...)` call in that file (including earlier tests) for a missing `await` before assuming the hook itself is broken.
- Passing a destructured, unannotated parameter (`({ fetcher }) => ...`) as `renderHook`'s first argument fails to typecheck when combined with `initialProps`, because `renderHook`'s type signature uses `NoInfer<Props>` on the options parameter specifically to force `Props` inference from the callback alone — an unannotated destructured parameter has nothing to infer from and collapses to `unknown`. Fix: annotate the callback parameter's type explicitly (`({ fetcher }: { fetcher: () => Promise<T> }) => ...`).

**Verification:** `npm exec -w mobile -- jest` — 5 suites, 51 tests, all passing (up from 44). `tsc --noEmit` and `expo lint` both clean on `mobile/`.

## 2026-07-14 (Mobile unit test infrastructure — first batch)

**Files changed:**
- `mobile/package.json` — added `jest-expo`, `jest`, `@testing-library/react-native`, `@types/jest` as devDependencies (via `expo install --dev`, so versions are SDK-57-compatible); added `test`/`test:watch` scripts; added a `jest` config block (`preset: "jest-expo"`, the standard `transformIgnorePatterns` for RN/Expo modules, plus a `moduleNameMapper` — see Gotchas).
- `mobile/tsconfig.json` — added `"types": ["jest"]` so `describe`/`it`/`expect` typecheck.
- `mobile/__tests__/utils/format.test.ts`, `__tests__/utils/tones.test.ts` (new) — pure-function tests for `utils/format.ts`/`utils/tones.ts`.
- `mobile/__tests__/api/client.test.ts` (new) — tests `apiFetch`'s header attachment, 401→unauthorized-handler flow, and error-message fallback, with `globalThis.fetch` mocked.
- `mobile/__tests__/auth/AuthContext.test.tsx` (new) — tests login/logout, cold-start session restore (success and non-auth-error paths), and the 401→auto-logout wiring, with `secureStorage`, `api/client`, and `notifications/registerPushToken` all mocked.
- `.github/workflows/mobile-ci.yml` — renamed the job to "Typecheck, lint & test" and added a `jest` step.

**Decisions made:**
- User chose to scope this first batch to pure logic + the auth/API core (no component/screen rendering tests yet) — highest value, lowest setup risk, given jest-expo's native rendering path was untested territory in this repo.
- Followed the exact setup Expo's own docs recommend for SDK 57 (`jest-expo` preset, `@testing-library/react-native`), rather than an older pattern like `@testing-library/react-hooks` — confirmed by fetching the live versioned docs per `mobile/AGENTS.md`'s instruction.
- Test location mirrors the nextjs convention (a top-level `__tests__/` tree shaped like `src/`), not co-located `*.test.ts` files, for consistency across the monorepo.

**Next steps:**
- Component/screen rendering tests (Button, FormField, StatusBadge, a representative screen) were explicitly deferred to a later batch.
- `useApi.ts` (the shared fetch/loading/pull-to-refresh hook) has no tests yet — natural next target given it backs most list/detail screens.
- No E2E test tooling (Maestro, per the original mobile plan) set up yet — still just unit tests.

**Gotchas:**
- **Real dual-React-instance bug, now fixed.** npm workspaces hoisting produced *three* separate `react` installs across the repo: `mobile/node_modules/react@19.2.3` (react-native's exact pin), `nextjs/node_modules/react@19.2.4` (nextjs's exact pin), and a *third*, freshly-hoisted `node_modules/react@19.2.7` at the repo root (satisfying some dependency's broader `^19` range — nothing pins that version anywhere directly). `jest-expo`'s `react-test-renderer` (also at root, version 19.2.3 — matching mobile's pin, confirmed via `jest-expo`'s own `package.json` dependency) still resolved its internal `require('react')` against the root copy (19.2.7) via plain Node resolution, while mobile's own components resolved `react` from the nested `mobile/node_modules/react` (19.2.3). Two live React module instances in one test run means two separate hook-dispatcher singletons — symptom was `TypeError: Cannot read properties of undefined (reading 'useState')` inside any component under test, with no other explanation in the stack trace. Fixed with a `moduleNameMapper` in `mobile/package.json`'s `jest` config forcing `react`/`react-dom` (and subpaths) to always resolve to `<rootDir>/node_modules/react(-dom)` (the mobile-local, react-native-compatible copies). If this resurfaces after a dependency bump, check `node -e "console.log(require('./node_modules/react/package.json').version)"` at root vs. `mobile/node_modules/react` before assuming it's a new bug.
- **`@testing-library/react-native@14.0.1`'s `renderHook` is `async`** (returns a `Promise<{ result, rerender, unmount }>`), unlike the classic `@testing-library/react-hooks` API most training data assumes. Forgetting to `await` it doesn't throw — it silently returns a `Promise` object, and every property access off the (non-awaited) result reads as `undefined`, which looked at first like a broken render rather than a missing `await`. Confirmed by reading `node_modules/@testing-library/react-native/dist/render-hook.js` directly rather than guessing from docs.
- Auto-mocking a module that imports `expo-notifications` (via `jest.mock('@/notifications/registerPushToken')` with no factory) still evaluates the real module once to derive the mock shape, which prints `expo-notifications`'s "removed from Expo Go" warning to the console during the test run. Harmless, but silenced by giving `jest.mock` an explicit factory (`() => ({ registerPushToken: jest.fn() })`) instead of relying on auto-mock.

**Verification:** `npm exec -w mobile -- jest` — 4 suites, 44 tests, all passing. `tsc --noEmit` and `expo lint` both clean on `mobile/`. Confirmed the new CI step name/command locally matches what `mobile-ci.yml` now runs.

## 2026-07-14 (Phase 6 — push notifications)

**Files changed:**
- `nextjs/prisma/schema.prisma` — new `PushToken` model (`userId`, unique `token`, optional `platform`, `lastSeenAt`), relation on `User`; migration `20260714124010_add_push_tokens` applied to the Neon dev DB.
- `nextjs/lib/push.ts` (new) — `buildPushMessages`/`parseInvalidTokens` (pure, unit-tested) plus `sendPushToUsers` orchestrator. Sends via a raw `fetch` to Expo's push API (`https://exp.host/--/api/v2/push/send`) rather than adding the `expo-server-sdk` dependency — it's a plain HTTPS/JSON endpoint, so no package was needed. Swallows all errors internally so a push failure never breaks the calling route's response; auto-deletes tokens that come back `DeviceNotRegistered`.
- `nextjs/app/api/push-tokens/route.ts` (new) — `POST` only, session-gated (cookie or Bearer), upserts by the unique token so re-login as a different user on the same device reassigns it. No DELETE route — stale tokens self-prune via the cleanup above.
- Trigger call sites added (additive, no response-shape changes) in `app/api/admin/announcements/route.ts` (POST), `app/api/issues/[id]/comments/route.ts` (POST, resident→assigned staff), `app/api/admin/issues/[id]/comments/route.ts` (POST, staff public comment→resident), `app/api/admin/violations/[id]/route.ts` (PATCH, notice sent→resident), `app/api/admin/violations/[id]/appeal/route.ts` (PATCH, appeal decided→resident), `app/api/board/architectural-requests/[id]/route.ts` + `app/api/admin/architectural-requests/[id]/route.ts` (PATCH, decision→resident).
- `nextjs/__tests__/lib/push.test.ts` (new) — 7 unit tests for the pure message-building/cleanup-parsing logic.
- `mobile/package.json` — added `expo-notifications`, `expo-device` (via `expo install`, so versions are SDK-57-compatible).
- `mobile/app.json` — added `expo-notifications` to `plugins`.
- `mobile/src/notifications/registerPushToken.ts` (new) — `Device.isDevice` guard, permission request, `getExpoPushTokenAsync({ projectId })`, POSTs to `/api/push-tokens`. Wrapped in try/catch that only logs in dev — this call is expected to throw until a real EAS project ID exists (see Gotchas).
- `mobile/src/auth/AuthContext.tsx` — calls `registerPushToken()` (fire-and-forget) after login and after a cold-start session restore.
- `mobile/app/_layout.tsx` — `Notifications.setNotificationHandler` (foreground banners) and `addNotificationResponseReceivedListener` with a small `resolveNotificationRoute(type, id, role)` switch that deep-links a tapped notification to the right screen per role.
- `nextjs/app/privacy/page.tsx` — updated to disclose push token collection (was previously stated as "not collected") and the new notification-sending purpose; bumped "Last updated" date.
- `mobile/STORE_SUBMISSION.md` — replaced the old "push deferred" note with what's actually implemented, and flagged the EAS project ID gap as now blocking push delivery too, not just builds.

**Decisions made:**
- Chose which 4 events trigger notifications with the user up front: new announcements, issue comments, violation notices, architectural request decisions (not every possible event — e.g. no push on issue status changes without a comment, no push on poll creation).
- Raw `fetch` to Expo's push endpoint instead of adding `expo-server-sdk` as a new nextjs dependency — kept the backend dependency footprint unchanged for something this simple.
- Recipients for announcements reuse the exact audience→role mapping already used by the resident-facing `GET /api/announcements` route, rather than inventing new targeting logic.
- No token-removal endpoint in v1 — relying entirely on the `DeviceNotRegistered` auto-cleanup, confirmed working against the real Expo API during verification (see below).
- Committed Phases 0-5 (previously fully uncommitted since the prior session) before starting Phase 6, per user's choice, so this phase has a clean baseline.

**Next steps:**
- Real on-device push delivery is blocked on running `eas init` against a real Expo account (writes `extra.eas.projectId` into `app.json`) — everything server-side is built and tested, but `getExpoPushTokenAsync()` can't mint a token without it. See `mobile/STORE_SUBMISSION.md` step 5.
- No mobile unit tests yet at all (pre-existing gap, unrelated to this phase).
- Once a real EAS project exists, re-verify push delivery on a physical device/simulator — everything tested this session used a fake `ExponentPushToken[...]` string.

**Gotchas:**
- None new. The Turbopack `root` fix and npm-workspace `npx` caveats from earlier phases continue to apply unchanged.

**Verification:** `tsc --noEmit` + full vitest suite (113 tests, up from 106) clean on `nextjs/`. `tsc --noEmit` + `expo lint` clean on `mobile/`. Applied the migration to the Neon dev DB and confirmed the `push_tokens` table. Started the real dev server and, using the demo resident/admin/board accounts, registered two fake push tokens via `POST /api/push-tokens`, then live-triggered all 6 call sites (announcement create, resident issue comment, admin issue comment, violation notice, appeal decision, both board and admin architectural-request decisions) — every route still returned its normal success status. Notably, Expo's real push API rejected the fake tokens and our `DeviceNotRegistered` cleanup logic actually deleted both rows afterward (confirmed via a direct DB query) — proof the full send/parse/cleanup pipeline works against the live Expo endpoint, not just a mock.

## 2026-07-13 (Session handoff — mobile app Phases 0-5 complete)

Full-day session building the React Native/Expo mobile app for CommunityHQ
end to end. Detailed per-phase entries are below this one (each dated
2026-07-13, newest first: Phase 5, Phase 4, Phase 3, Phase 2) — this entry is
a consolidated pointer, not a replacement for that detail.

**Files changed:** See each phase entry below for the full file list. Summary
by phase:
- **Phase 0** (monorepo + auth): root `package.json` npm workspace, Bearer-token
  auth added to `nextjs/lib/auth.ts`/`proxy.ts`/login+register routes, new
  `/api/resident/dashboard` route, CI path filters, `mobile-ci.yml`
- **Phase 1** (Expo scaffold): `mobile/` app created, Expo Router navigation
  shell, `AuthContext`/`secureStorage`, API client
- **Phase 2** (resident screens): full resident feature set — dashboard,
  issues, payments, announcements, events, arch requests, violations,
  documents, polls, profile
- **Phase 3** (board screens): board dashboard, architectural request review,
  violations review — with shared-screen extraction (`src/screens/shared/`)
  for the 5 screens identical across roles
- **Phase 4** (admin screens): admin dashboard, issues management, violations
  issuance, vendors, users CRUD, 4 reports — plus a new
  `POST /api/admin/vendors` backend route (user-approved)
- **Phase 5** (store prep): `eas.json`, placeholder bundle ID/icons, real
  privacy policy page at `/privacy`, `mobile/STORE_SUBMISSION.md` checklist

**Decisions made:** See phase entries — key ones: npm workspaces over
pnpm/Turborepo; extend existing cookie auth with Bearer tokens rather than a
parallel mobile auth system; push notifications deferred; shared screens
extracted only where genuinely identical across roles (not speculatively).

**Next steps:**
1. Optional: `/code-review` or `/security-review` pass over the full diff
   before committing (offered to user at end of session, not yet run)
2. Phase 6+: push notifications (unstarted, deferred by design)
3. Work through `mobile/STORE_SUBMISSION.md` (mostly external account setup)
4. No mobile unit tests yet (Jest + RNTL) — deferred per the original plan
   at `C:\Users\theek\.claude\plans\task-plan-the-development-rippling-whistle.md`

**Gotchas:** See phase entries for full detail — the two worth remembering
most:
- `npx <tool>` is unreliable inside `nextjs/` or `mobile/` now that the repo
  is an npm workspace (can silently resolve the wrong hoisted version, or
  fall through to an unrelated registry package). Always use
  `npm exec -w <workspace> -- <tool>` or a direct `node_modules/.bin/<tool>` path.
- If Turbopack ever again logs "inferred your workspace root, but it may not
  be correct" on `nextjs` dev server startup, the fix is already in place
  (`turbopack.root` in `nextjs/next.config.ts`) — if it recurs, something
  changed that config, not a new issue to re-diagnose from scratch.

**Verification:** Every phase was live-tested against the real Next.js API
and Neon dev database (not just typecheck/lint) via a running dev server +
Expo web + Playwright, using the app's real demo accounts. See phase entries
for the specific flows exercised (issue creation/comments, real simulated
payment, poll voting, board decision workflows, admin issue
assignment/violation issuance/vendor+user creation, all 4 admin reports).
`tsc --noEmit` and `expo lint` are clean on `mobile/` as of this entry;
`tsc --noEmit` + full vitest suite (106 tests) clean on `nextjs/`.

## 2026-07-13 (Phase 5 — app store submission prep)

**Files changed:**
- `mobile/app.json` — added placeholder `ios.bundleIdentifier`/`android.package` (`com.communityhq.app`, user-approved placeholder), `buildNumber`/`versionCode`
- `mobile/assets/*.png` — replaced Expo's default template icon/splash/adaptive-icon/favicon with a generated placeholder (blue `#2563eb` background, simple white house glyph), matching each file's exact pre-existing dimensions. `icon.png` specifically re-encoded without an alpha channel (Apple rejects the primary App Store icon if it has one, even fully opaque).
- `mobile/eas.json` (new) — `development`/`preview`/`production` build profiles with per-profile `EXPO_PUBLIC_API_URL` (placeholder `https://your-app.vercel.app` for preview/production, matching the existing `NEXT_PUBLIC_APP_URL` placeholder convention in `nextjs/.env.example`), `submit.production` profile
- `nextjs/app/privacy/page.tsx` (new) — real privacy policy content (not boilerplate) describing exactly what CommunityHQ's actual code collects: account info, property address, financial/payment records, issue/arch-request/violation content, announcement read receipts, poll votes, session tokens — and explicitly what it does NOT collect (camera, location, contacts, ad identifiers, analytics, push — none of these exist in the codebase). Placeholder contact email flagged for replacement before real publishing.
- `nextjs/proxy.ts` — added `/privacy` to `PUBLIC_PATHS` (a privacy policy can't be gated behind login — required for app store review and basic legal validity of the link)
- `mobile/STORE_SUBMISSION.md` (new) — checklist of what's done vs. what remains (mostly external: Apple Developer Program enrollment, Google Play Console registration, EAS account + `eas init` for a real project ID, backend deployment so the placeholder API URL becomes real, store privacy declarations, listing content/screenshots)

**Decisions made:**
- User approved placeholder values for all three open Phase 5 questions: bundle ID (`com.communityhq.app`), generated placeholder branding (rather than leaving Expo's default template icon or blocking on real design work), and eas.json scaffolding without walking through EAS account setup in detail.
- Privacy policy built as a real page in the Next.js app (`/privacy`) rather than a standalone markdown file — the web app is what will eventually get a real deployed URL, so this gives the policy a real, stable link the moment that deployment happens, instead of a separate hosting problem to solve later.
- No EAS project ID was fabricated in `app.json` — that field must come from a real `eas init` run against the user's own Expo account; a fake UUID there would silently break real builds later.

**Next steps:**
- Phase 6+: push notifications (still deferred, unstarted)
- Whenever the user is ready: work through `mobile/STORE_SUBMISSION.md` top to bottom
- Consider a `/code-review` or `/security-review` pass now that all 4 phases (0-5, minus push) of mobile app + backend changes are complete, before this branch gets committed

**Gotchas:**
- **Real PowerShell bug hit and fixed while generating icons**: `New-Object TypeName($arg1, $arg2)` constructor-call sugar (used successfully as a single top-level statement) silently breaks when nested inside a comma-separated array literal (`@(New-Object ..., New-Object ..., New-Object ...)`) — PowerShell's parser mis-binds the arguments in that context, producing "does not contain a method named 'op_Addition'" and similar cryptic errors on completely unrelated later lines (the actual bitmap Save() calls still "succeeded" with garbage/incomplete graphics). Root cause confirmed via minimal repro. Fix: always use explicit `-ArgumentList` with `New-Object`, never the parenthetical constructor-sugar syntax, especially inside array literals.
- Turbopack `root` fix from Phase 2 continues to hold — no root-inference warnings on this session's dev server run either.

**Verification:** Ran `tsc --noEmit` + `expo lint` clean on `mobile/`, `tsc --noEmit` + full vitest suite (106 tests) clean on `nextjs/`. Live-verified the privacy page specifically: started the dev server, confirmed `GET /privacy` returns `200` with no auth cookie (proving the `PUBLIC_PATHS` exemption actually works, not just that the route exists) and that the rendered HTML contains the real page content. Visually inspected the generated icon and Android adaptive-icon layers (foreground transparency, background solid color) to confirm they're not corrupted despite the PowerShell bug encountered mid-generation.

## 2026-07-13 (Phase 4 — admin feature screens)

**Files changed:**
- `nextjs/app/api/admin/vendors/route.ts` — **added `POST` handler** (Zod-validated name/contactName/email/phone/category/notes, `isAdmin()`-gated, audit-logged). Real gap: this route previously only had `GET`; confirmed by reading the file directly (an earlier broad exploration pass had incorrectly reported it as GET/POST already existing). User approved adding it over shipping list-only.
- `mobile/src/types/admin.ts`, `mobile/src/api/admin.ts` (new) — types/client for admin dashboard, issues (list+patch), vendors (list+create), violations (create), users (list/create/update/delete), and the 4 report endpoints
- `mobile/src/api/board.ts` — `listAdminViolations` extended to accept `search`/`type`/`page` (previously only `status`/`hasAppeal`/a no-op `limit`, since the server hardcodes page size to 20 regardless of any client-sent limit) — now shared by both board's and admin's violation list screens
- `mobile/src/screens/shared/ViolationManageScreen.tsx` (new) — extracted from board's violation detail screen; takes a `statusChoices` prop so board (curated subset: Under Review/Resolved/Closed) and admin (full 7-state lifecycle) can reuse the same detail/appeal-decision/status-update UI against the identical underlying `/api/admin/violations/*` endpoints
- `mobile/app/(admin)/_layout.tsx` — Tabs: Dashboard, Issues, Violations, More (was a placeholder single Stack)
- `mobile/app/(admin)/index.tsx` — real Dashboard (8 stat tiles, issues-by-status breakdown, recent activity feed, recent announcements)
- `mobile/app/(admin)/issues/*` — list (search + status filter) and manage screen (status/priority/assign-to-staff/assign-vendor via a single PATCH, since there's no dedicated GET-by-id route — detail is fetched via `PATCH` with an empty body, per the confirmed API behavior)
- `mobile/app/(admin)/violations/*` — list (search+status filter, reusing `listAdminViolations`), new (issue/draft a violation with a searchable resident picker, since no `/api/properties` or resident-search endpoint exists — client-filters the full `/api/users` roster), `[id]` (thin wrapper around the new shared `ViolationManageScreen`)
- `mobile/app/(admin)/more/*` — Vendors (list+create), Users (list+create+edit/delete, respecting the API's self-delete and SUPER_ADMIN constraints), Reports (menu + 4 read-only report screens), plus Announcements/Events/Documents/Polls/Profile re-exported from the Phase 3 shared screens

**Decisions made:**
- Added the missing `POST /api/admin/vendors` route rather than shipping vendors as list-only, per user's explicit choice — mirrors the existing `POST /api/users` pattern exactly (same file structure, `isAdmin()` gate, audit log).
- No `/api/properties` endpoint exists and `propertyId` is optional on violation creation — the mobile create-violation form only offers a resident picker, `propertyId` is never set from mobile. Flagged as a pre-existing API gap, not fixed (out of scope).
- Admin issue "detail" screen calls `PATCH .../[id]` with `{}` to read current state (confirmed this is valid and the only read path — no dedicated GET-by-id route exists for admin issues).

**Next steps:**
- Phase 5: EAS config, app store metadata, privacy policy + App Privacy/Data Safety declarations (per plan)
- Still no mobile unit tests (Jest + RNTL) — deferred per plan
- The 5 vendor entries in the dev database are each tripled (15 rows total, 3 near-identical copies of each vendor with different IDs) — pre-existing seed data duplication unrelated to this session's work, not fixed; noted here so it's not mistaken for a client bug later.

**Gotchas:**
- None new — Turbopack `root` fix from Phase 2 continues to hold; no root-inference warnings across two more dev-server restarts this session.

**Verification:** Live-tested as the demo admin account against the real API: reassigned a real issue (status Assigned→In Progress, resident-facing staff assignee changed to a different staff member, confirmed via UI after reload), created and issued a real violation (status went straight to `NOTICE_SENT` since "send immediately" was toggled, appeared correctly in the violations list), created a real vendor (appeared in the vendor list), created a real user (appeared in the roster), and confirmed all 4 report screens load real aggregated data with no errors (payments report correctly included the $1,250 payment made during Phase 2 testing). Also regression-tested resident and board logins post-Phase-4 — both still load cleanly with zero runtime errors.

## 2026-07-13 (Phase 3 — board feature screens)

**Files changed:**
- `mobile/src/screens/shared/*.tsx` (new) — extracted `AnnouncementsListScreen`, `AnnouncementDetailScreen`, `EventsListScreen`, `EventDetailScreen`, `DocumentsListScreen`, `DocumentDetailScreen`, `PollsListScreen`, `PollDetailScreen`, `ProfileScreen` out of `(resident)/more/**` — these were already 100% role-agnostic (server-side audience/role filtering does the work), so they're now reused as-is by `(board)/more/**` via thin one-line re-export route files. `(resident)/more/**` route files updated to re-export from the shared location instead of holding the implementation.
- `mobile/src/types/board.ts` (new) — `BoardDashboard`, `BoardArchRequestListItem`/`Page`, `BoardArchRequestDecisionInput`, `BoardViolationListItem`/`Page`, `ViolationStatusUpdateInput`, `AppealDecisionInput`
- `mobile/src/api/board.ts` (new) — `getBoardDashboard`, `listBoardArchRequests`/`getBoardArchRequest`/`decideBoardArchRequest` (hit `/api/board/architectural-requests*`), `listAdminViolations`/`getAdminViolation`/`updateAdminViolation`/`decideAppeal` (hit `/api/admin/violations*` — board has no separate violations API, see Decisions)
- `mobile/app/(board)/_layout.tsx` — Tabs: Dashboard, Requests, Violations, More (was a placeholder single Stack)
- `mobile/app/(board)/index.tsx` — real Dashboard (financial summary, decision queue, recent announcements)
- `mobile/app/(board)/requests/*`, `violations/*`, `more/*` (new) — architectural request review (list w/ status filter, detail w/ decision form: status/rule reference/decision reason/comment+internal toggle), violations review (escalated + appeals tabs, detail w/ status update and appeal decision forms), More menu (Announcements/Events/Documents/Polls/Profile/Logout — no Payments/Issues, not board-relevant)

**Decisions made:**
- Verified via a full second Explore pass (not assumed) that board has its OWN dedicated `/api/board/architectural-requests*` routes (strict `BOARD_MEMBER`-only gate), but **no** separate `/api/board/violations*` routes exist — board violation review reuses `/api/admin/violations*`, gated only by `role !== 'RESIDENT'` (so BOARD_MEMBER, ADMIN, SUPER_ADMIN all share it). Violation *creation* stays ADMIN-only. Mobile's `api/board.ts` reflects this asymmetry directly rather than pretending a uniform board API surface exists.
- Extracted the 5 shared screens rather than duplicating them — genuine zero-divergence DRY case (same API calls, same role-agnostic logic), not a premature abstraction.

**Next steps:**
- Phase 4: admin features (per plan at `C:\Users\theek\.claude\plans\task-plan-the-development-rippling-whistle.md`)
- Still no mobile unit tests (Jest + RNTL) — deferred per plan

**Gotchas:**
- None new this session — the Turbopack `root` fix from the Phase 2 entry held up cleanly (no root-inference warning on dev server restart).

**Verification:** Live-tested as the demo board account against the real API: dashboard loaded real financial/decision-queue data, approved a real architectural request (status Submitted → Approved, rule reference + decision reason persisted and displayed), approved a real violation appeal (confirmed the server's documented side effect — violation auto-transitioned Escalated → Resolved). Also regression-tested the resident role after the shared-screen extraction — dashboard, announcements, and profile all still render correctly through the new shared components.

## 2026-07-13 (Phase 2 — resident feature screens)

**Files changed:**
- `nextjs/next.config.ts` — added `turbopack: { root: path.join(__dirname) }`. **Real regression fix**, see Gotchas.
- `mobile/src/types/*.ts` (new) — hand-written types for issues, architectural requests, violations, payments, announcements, events, documents, polls, dashboard, matching exact API response shapes (verified against actual route.ts files, not guessed)
- `mobile/src/api/*.ts` (new) — one file per resource, thin typed wrappers around `apiFetch`
- `mobile/src/components/*.tsx` (new) — shared UI kit: `ScreenContainer`, `Card`, `ListCard`, `ListRow`, `StatusBadge`, `Button`, `FormField`, `ChipSelect`, `LoadingView`, `ErrorView`, `EmptyState`
- `mobile/src/hooks/useApi.ts` (new) — shared fetch/loading/error/pull-to-refresh hook for screens backed by one GET call
- `mobile/src/theme.ts`, `src/utils/format.ts`, `src/utils/tones.ts` (new) — shared colors, date/currency formatting, status→tone mapping
- `mobile/app/(resident)/_layout.tsx` — converted from a bare `Stack` to `Tabs` (Dashboard, Issues, Payments, More), each tab its own nested `Stack`
- `mobile/app/(resident)/index.tsx` — real Dashboard screen (was a placeholder)
- `mobile/app/(resident)/issues/*`, `payments/*`, `more/**` (new) — full resident screen set: issues (list/create/detail+comments), payments (ledger + pay flow with form→processing→receipt), announcements (list+read receipts/detail), events, architectural requests (list/create/detail+comments+withdraw/submit), violations (list/detail+respond/appeal), documents (search/detail/open via `Linking`), polls (list/detail+vote), profile (edit name + change password)
- `mobile/src/auth/AuthContext.tsx` — added `updateUser()` so the Profile screen can update cached user state locally (the profile PUT endpoint refreshes the web cookie but never returns a new bearer token)

**Decisions made:**
- No new picker/select dependency — built a lightweight `ChipSelect` component for enum inputs (category, priority, payment method, etc.) instead of adding `@react-native-picker/picker`
- `useApi(fetcher)` takes only a fetcher, not a separate deps array — callers with a changing dependency (route param, search text) wrap their fetcher in `useCallback(() => getX(id), [id])` themselves. Forced by a stricter `eslint-plugin-react-hooks` rule (React Compiler-aligned) that rejects non-literal dependency arrays passed into hooks — see Gotchas.
- Payments "pay" screen renders its default amount as a *derived* value (`amount || defaultFromBalance`) rather than seeding it via `useEffect` + `setState` — same lint rule family flags synchronous setState-in-effect as an anti-pattern, and the derived approach is simpler anyway.
- Events and Polls have no GET-by-id API route — their detail screens fetch the full list and find the item client-side. Documented as a pre-existing API gap, not fixed (out of scope for the mobile task).

**Next steps:**
- Phase 3: board features; Phase 4: admin features (per plan at `C:\Users\theek\.claude\plans\task-plan-the-development-rippling-whistle.md`)
- No mobile unit tests yet (Jest + RNTL) — still deferred to a later phase per the plan's testing strategy
- Visual polish item: the `+ New` header button on Issues/Architectural Requests list screens gets slightly clipped at 400px viewport width — not verified on an actual device/simulator yet

**Gotchas:**
- **Real regression, now fixed:** the Phase 0 root `package.json`/`package-lock.json` (npm workspaces) made Turbopack auto-infer the *repo root* as the Next.js workspace root instead of `nextjs/` itself (visible as a startup warning: "Next.js inferred your workspace root, but it may not be correct"). This broke module resolution for freshly-compiled route chunks against the wrong `node_modules` tree — concretely, `GET /api/events` 500'd with `Cannot find module 'zod'` even though `nextjs/node_modules/zod@4.4.3` was present and correct (a stray, incompatible `zod@3.25.76` had been hoisted to the *root* `node_modules` by an unrelated install). Fixed by pinning `turbopack: { root: path.join(__dirname) }` in `nextjs/next.config.ts`. If you see similar "Cannot find module" errors on routes that haven't been touched in weeks, suspect this class of issue again and check for a Turbopack root-inference warning at dev-server startup first.
- The Next.js Turbopack dev server crashed once mid-session with `RangeError: Map maximum size exceeded` inside its own `async_hooks` instrumentation, after a long run of many requests across several test scripts. Unrelated to any code in this repo — just restart the dev server if you see it. Not worth chasing further.
- `eslint-plugin-react-hooks` (installed fresh this session via `expo lint`'s auto-setup) enforces literal-array-only dependency lists and flags setState-in-effect much more aggressively than before — expect to hit this if you write a custom hook that forwards a caller-supplied deps array into `useCallback`/`useEffect`/`useMemo` internally. The fix is almost always "push the memoization to the call site," not suppressing the rule (one legitimate suppression exists in `useApi.ts` for the documented "fetch on mount" pattern, with a comment explaining why).
- All Phase 2 verification was done via Expo **web** (Playwright-driven, `--disable-web-security` in the *test browser only* to bypass CORS, which doesn't apply to real native `fetch`) against the live Next.js dev server and real demo-account data — created a real issue, posted a real comment, made a real simulated payment (ledger correctly dropped to $0 after), voted in a real poll (percentages computed correctly). Native iOS/Android behavior (beyond what was already covered in Phase 1's SecureStore fix) is still unverified in this sandboxed environment.

## 2026-07-13

**Files changed:**
- `package.json` (new, repo root) — npm workspaces (`["nextjs", "mobile"]`), converting the repo into a monorepo
- `nextjs/lib/auth.ts` — `getSession()` now falls back to an `Authorization: Bearer <token>` header when no cookie is present
- `nextjs/app/api/auth/login/route.ts`, `register/route.ts` — response body now includes `token` alongside `user` (cookie flow unchanged, additive)
- `nextjs/proxy.ts` — accepts Bearer header as alternative to cookie; returns `401` JSON for `/api/*` auth failures instead of redirecting (page routes still redirect to `/login`)
- `nextjs/app/api/resident/dashboard/route.ts` (new) — wraps existing `lib/dashboard.ts:getResidentDashboard()`, closing the gap where admin/board dashboards had HTTP routes but resident didn't
- `.github/workflows/ci.yml`, `e2e.yml` — added `paths:` filters (`nextjs/**`) so mobile-only pushes stop triggering these; both also switched their `npx tsc`/`npx prisma`/`npx playwright` steps to direct `node_modules/.bin/...` calls (see Gotchas)
- `.github/workflows/mobile-ci.yml` (new) — typecheck + lint for `mobile/`, using `npm exec -w mobile --` (not bare `npx`)
- `mobile/` (new) — Expo SDK 57 app scaffolded via `create-expo-app` + Expo Router, `expo-secure-store`, `expo-linking`, `react-native-safe-area-context`, `react-native-screens`; added `react-native-web`/`react-dom` as dev-only conveniences for headless testing
  - `app/_layout.tsx` — root nav, `Stack.Protected` guards routing to `(auth)`/`(resident)`/`(board)`/`(admin)` based on session + role
  - `app/(auth)/login.tsx`, `app/(resident|board|admin)/index.tsx` — login screen + placeholder role dashboards (real screens are Phase 2-4)
  - `src/auth/AuthContext.tsx`, `src/auth/secureStorage.ts` — session state + token persistence (SecureStore on native, localStorage on web)
  - `src/api/client.ts` — fetch wrapper attaching `Authorization: Bearer`, 401 → auto-logout
  - `src/types/auth.ts` — hand-written mirror of `nextjs/lib/auth.ts` `SessionUser`/`UserRole` (shared types package deferred, see Decisions)
  - `.env.example` — documents `EXPO_PUBLIC_API_URL`

**Decisions made:**
- Full mobile parity planned (resident + board + admin), built with Expo managed workflow + EAS, reusing the existing Next.js REST API against the same Neon DB rather than a separate backend
- Extended the existing cookie-based JWT auth with a Bearer-token variant instead of building a parallel mobile-only auth system
- Push notifications explicitly deferred to a later phase
- npm workspaces chosen over pnpm/Turborepo/Nx — npm is already the pinned tool project-wide
- Shared Zod schemas/types (`packages/shared`) deferred — hand-writing parallel TS types in `mobile/src/types/` until shape drift actually hurts
- Full plan recorded at `C:\Users\theek\.claude\plans\task-plan-the-development-rippling-whistle.md`

**Next steps:**
- Phase 2: resident feature screens (issues, arch requests, violations, payments, announcements, events, documents, polls, profile)
- Phase 3: board features; Phase 4: admin features
- Phase 5: EAS config, app store metadata, privacy policy + App Privacy/Data Safety declarations (required — app handles PII + financial data)
- Set up `mobile/` unit testing (Jest + React Native Testing Library) — none exists yet, only typecheck/lint are wired into CI so far

**Gotchas:**
- **`npx <tool>` inside a workspace member directory is unreliable in this repo now.** Confirmed two failure modes: (1) before a root install existed, `npx tsc` inside `nextjs/` silently ran an unrelated squatted npm package instead of the local compiler; (2) after a root install, it silently resolved to `mobile`'s hoisted TypeScript version (6.0.3) instead of `nextjs`'s pinned one (5.9.3) — no error either way. Always use `npm exec -w <workspace> -- <tool>` from the repo root, an `npm run` script, or a direct `node_modules/.bin/<tool>` path — never a bare `npx <tool>` from inside `nextjs/` or `mobile/`.
- `mobile/AGENTS.md`, `CLAUDE.md`, and `.claude/settings.json` are genuine official output of `create-expo-app@4.0.0` — confirmed by decompiling the real published CLI tarball, which has a documented `--no-agents-md` flag ("Skip generating AGENTS.md, CLAUDE.md, and .claude/settings.json") and a literal "Expo HAS CHANGED... read versioned docs" template string with the installed SDK version interpolated in. I initially misjudged these as a prompt injection and deleted them, then caught the mistake and restored the real regenerated content byte-for-byte. Combined with `nextjs/AGENTS.md` (separately confirmed legitimate against the real `next@16.2.9` tarball, which genuinely ships `node_modules/next/dist/docs/`): both Next.js and Expo now ship these files by default specifically to stop AI agents coding against stale training-data APIs. Lesson: verify an "this looks like an injection" hunch against the actual published registry tarball before acting on it, in either direction.
- `expo-secure-store` has no web implementation and throws at runtime on web (`getValueWithKeyAsync is not a function`) — `mobile/src/auth/secureStorage.ts` branches on `Platform.OS` (localStorage on web, SecureStore on native), matching Expo's own documented pattern. Native (iOS/Android simulator or device) auth flow has NOT been verified in this sandboxed environment — only verified via Expo web (with CORS disabled in the test browser only, not in product code, since native `fetch` isn't subject to CORS).
## 2026-06-24

**Files changed:**
- `server/prisma/schema.prisma` — renamed `name`→`firstName`+`lastName`, `password`→`passwordHash` on User; added Property, ResidentProfile, Vendor, AuditLog models
- `server/prisma/seed.ts` — full rewrite: 20 residents, 2 admins, 3 board members, 5 vendors, 10 properties, 2 sample announcements
- `server/prisma/migrations/20260624190500_split_user_name_add_models/` — new migration applying all schema changes
- `server/src/services/auditLog.ts` — new utility: `createAuditLog({ userId, action, entityType, entityId, metadata })`
- `server/src/schemas/auth.ts` — register/updateProfile schemas use `firstName`+`lastName` instead of `name`
- `server/src/controllers/authController.ts` — updated for `passwordHash`, `firstName`, `lastName`; `safeUser()` returns both name fields
- `server/src/controllers/announcementsController.ts` — `authorSelect` uses `firstName`+`lastName`
- `server/src/controllers/usersController.ts` — search by `firstName`, `lastName`, or `email`; selects include both name fields
- `server/src/controllers/maintenanceController.ts` — `submittedBySelect` uses `firstName`+`lastName`
- `server/src/controllers/eventsController.ts` — `createdBySelect` uses `firstName`+`lastName`
- `server/src/controllers/duesController.ts` — `userSelect` uses `firstName`+`lastName`
- `server/src/controllers/pollsController.ts` — `createdBy` select uses `firstName`+`lastName`
- `server/src/controllers/documentsController.ts` — `uploadedBySelect` uses `firstName`+`lastName`
- `server/src/controllers/dashboardController.ts` — all user selects use `firstName`+`lastName`
- `server/src/controllers/authController.test.ts` — `fakeUser` updated to `firstName`/`lastName`/`passwordHash`
- `server/src/controllers/usersController.test.ts` — `fakeUser` updated to `firstName`/`lastName`
- `client/src/types/index.ts` — `User` type uses `firstName`/`lastName`; `UserSummary` type added; `fullName()` and `dashboardPath()` helpers exported
- `client/src/components/ProtectedRoute.tsx` — accepts optional `allowedRoles`; wrong-role access redirects to user's own dashboard
- `client/src/routes/index.tsx` — added `/resident/dashboard`, `/admin/dashboard`, `/board/dashboard` routes with role guards; `/` redirects to `/resident/dashboard`; `/users` guarded to ADMIN only
- `client/src/pages/LoginPage.tsx` — demo account buttons (Resident / Admin / Board Member) pre-fill the form; post-login redirects to role-specific dashboard
- `client/src/pages/RegisterPage.tsx` — split into `firstName`+`lastName` fields; redirects to role dashboard after register
- `client/src/pages/ProfilePage.tsx` — split into `firstName`+`lastName` fields
- `client/src/layouts/AppLayout.tsx` — uses `fullName()`, nav Dashboard link points to role-specific path
- `client/src/pages/DashboardPage.tsx` — greeting uses `user.firstName`; announcement author uses `fullName()`
- `client/src/pages/UsersPage.tsx` — `ManagedUser` has `firstName`+`lastName`; displays via `fullName()`
- `README.md` — added Authentication section: demo credentials, JWT flow, role redirect table

**Decisions made:**
- `password` stays as the request body field name in Zod schemas; only the DB column is `passwordHash`
- `fullName(user)` helper centralizes first+last concatenation — use it everywhere a display name is needed
- `dashboardPath(role)` centralizes the role→route mapping (in `client/src/types/index.ts`)
- Demo buttons on login pre-fill form instead of auto-submitting — user still clicks Sign in
- Wrong-role dashboard access redirects to the user's own dashboard (not a 403 error page)
- `/` redirects to `/resident/dashboard`; ProtectedRoute with `allowedRoles` then redirects to the correct one per role
- Used `prisma migrate reset --skip-seed` then `prisma migrate dev` to cleanly apply schema changes without data-loss conflicts

**Next steps:**
- Wire `createAuditLog` into auth events (login, register, password change)
- Build API routes + UI for Property and ResidentProfile (currently schema-only, no endpoints)
- Build API routes + UI for Vendor management
- Feature pages exist as stubs — flesh out: announcements CRUD, maintenance status updates, events, polls voting, dues management, document upload

**Gotchas:**
- `user.name` no longer exists anywhere — always use `fullName(user)` or `user.firstName`/`user.lastName`
- All 3 demo accounts: password is `password123`
- 42 server tests passing as of this session
- Migration `20260624190500_split_user_name_add_models` must be present — if DB is reset from scratch, all 8 migrations replay automatically
- The `/` route silently redirects — don't use it as a "home" link; use `dashboardPath(user.role)` instead
