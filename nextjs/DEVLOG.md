# CommunityHQ Dev Log

## 2026-07-13 — Mobile overflow fixes

**Files changed:**
- `components/ui/StatCard.tsx` — the value span (e.g. dollar amounts like "$7,100.00") could overflow past the card's border on mobile because the flex row had no `min-w-0`/wrap. Added `gap-2`, `min-w-0 break-words text-right` on the value, `shrink-0` on the icon, `text-2xl sm:text-3xl` responsive sizing, and `min-w-0 overflow-hidden` on the card itself. Used by all three dashboards (admin/board/resident).
- `components/ui/PageHeader.tsx` — the title/subtitle block had no `min-w-0`, so on narrow screens it couldn't shrink and pushed the `action` button off-screen (reproduced on `/admin/announcements`'s "+ New Announcement" button). Added `flex-wrap` to the row, `min-w-0` + `break-words` to the title block.
- `app/dashboard/users/page.tsx`, `app/dashboard/dues/page.tsx` — both had a `<table>` inside a wrapper with only `overflow-hidden` (no scroll), so on mobile the Role/Joined/Delete (users) and Status/Delete (dues) columns were silently clipped off-screen with no way to reach them. Wrapped the `<table>` in an inner `overflow-x-auto` div (keeping `overflow-hidden` on the outer rounded/bordered card) and added `whitespace-nowrap` to cells so the table scrolls horizontally within its own container instead of clipping or leaking into page-level scroll.

**Decisions made:**
- Found via a screenshot the user provided showing "$7,100.00" spilling out of its stat-card container on `/admin/dashboard` at mobile width. Rather than fix just that one card, audited every other route for the same class of bug using a headless Playwright pass (checked `getBoundingClientRect().right` against viewport width across all admin/resident routes at 375px) — found two more real bugs (announcements header button, users/dues tables) that weren't visible in the one screenshot.
- Long unbreakable values (currency, table cells) get `break-words`/`overflow-x-auto` rather than `truncate` — an ellipsis would silently hide financial figures or role/email data, which is worse than wrapping or scrolling.

**Next steps:** none outstanding for this fix; confirmed page-level `scrollWidth === clientWidth` at 375px on every audited route (no more horizontal page scroll anywhere).

**Gotchas:**
- `StatCard` and `PageHeader` are shared across many pages — bugs in them are the highest-leverage places to look first for "text overflows on mobile"-type reports.
- Flex children default to `min-width: auto`, which uses the *unwrapped* content width for wrap-eligible text and the full string width for unbreakable strings (currency, emails, URLs). Without `min-w-0` on the item, `break-words`/`truncate` do nothing and the item just overflows its container. This is the root cause behind all three bugs fixed here.

## 2026-07-13 — SUPER_ADMIN role + user creation

**Files changed:**
- `prisma/schema.prisma` — added `SUPER_ADMIN` to `UserRole` enum; migration `20260713161358_add_super_admin_role` applied to Neon.
- `lib/roles.ts` — new; client-safe `UserRole` type + `isAdmin`/`isStaff` helpers (kept out of `lib/auth.ts` because that file imports `next/headers`/Prisma and can't be pulled into client components).
- `lib/auth.ts` — `SessionUser.role` now uses the shared `UserRole` type.
- `lib/nav.ts`, `app/dashboard/page.tsx`, `app/dashboard/documents/page.tsx`, `app/(auth)/login/page.tsx`, and every client dashboard page with a local `isAdmin`/staff check (events, polls, dues, maintenance, announcements, resident payments/announcements redirects) — swapped hardcoded `role === 'ADMIN'` / `role === 'ADMIN' || role === 'BOARD_MEMBER'` checks for the shared `isAdmin`/`isStaff` helpers so SUPER_ADMIN inherits full ADMIN access everywhere.
- `app/api/users/route.ts` — added `POST` (create user: firstName/lastName/email/password/role, ADMIN or SUPER_ADMIN only; role field only accepts ADMIN/BOARD_MEMBER/RESIDENT).
- `app/api/users/[id]/route.ts`, `app/api/documents/route.ts`, `app/api/documents/[id]/route.ts`, `app/api/announcements/route.ts`, `app/api/announcements/[id]/route.ts`, `app/api/admin/violations/route.ts`, `app/api/admin/architectural-requests/route.ts`, `app/api/admin/architectural-requests/[id]/route.ts`, `app/api/admin/architectural-requests/[id]/comments/route.ts`, `app/api/violations/[id]/route.ts` — same ADMIN→`isAdmin()`/staff→`isStaff()` swap server-side. `PUT`/`DELETE` on `/api/users/[id]` also reject the request if the target user is SUPER_ADMIN and the actor isn't.
- `app/dashboard/users/page.tsx` — added "+ Add User" form (POSTs to the new endpoint); SUPER_ADMIN rows render as a locked badge (no role dropdown, no Delete button) regardless of viewer.
- `components/ui/StatusBadge.tsx` — added a fuchsia color for SUPER_ADMIN badges.
- `prisma/create-super-admin.ts` — new standalone script; `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD` (+ optional first/last name) env vars create or promote a SUPER_ADMIN account. Run via `npm run create-super-admin`.
- `.env.example` — documented the create-super-admin one-off env vars (comment only, no defaults — deliberately not something to persist in `.env.local`).

**Decisions made:**
- SUPER_ADMIN is scoped as "full ADMIN + user creation," not a separate restricted screen — matches how the rest of the role system already layers (BOARD_MEMBER ⊂ staff, ADMIN ⊂ staff+ops). Confirmed with user before implementing broadly.
- SUPER_ADMIN is intentionally **not** assignable through any UI or API — the role enum accepted by `PUT /api/users/[id]` and `POST /api/users` is still `['ADMIN','BOARD_MEMBER','RESIDENT']` only. The only way to mint one is `prisma/create-super-admin.ts`, run by an engineer with DB access. This was a deliberate security choice: the role represents "us, the software engineers," not a rank any admin can hand out.
- New user creation sets a temp password immediately (no email/invite flow) — Resend isn't wired up yet, so an invite-link flow would need a manual hand-off anyway.

**Next steps:**
- If Resend gets wired up, consider switching create-user to an invite-link flow instead of admin-set temp passwords.
- No e2e coverage yet for the create-user form or SUPER_ADMIN lockout behavior — worth adding alongside the test-expansion work already tracked from 2026-07-08.

**Gotchas:**
- Any new "staff only" or "admin only" gate must use `isStaff()`/`isAdmin()` from `lib/roles.ts`, not a literal `role === 'ADMIN'` comparison — otherwise SUPER_ADMIN silently gets locked out of it.
- `lib/roles.ts` exists specifically so role-check helpers can be imported from client components (`'use client'` files can't import `lib/auth.ts` at runtime — only its types).

## 2026-07-08 — Session close: product documentation

**Files changed:**
- `README.md` (repo root) — now holds the complete product documentation: roles/permission matrix, every module's workflow states and rules, validation limits (all Zod constraints), pagination capacities, security model, known-limitations table for product owners, full API reference, testing, deployment, operations notes. Every claim verified against code, not prior docs.
- `nextjs/README.md` — reduced to a quick-reference pointer back to the root README (avoids two diverging copies).

**Decisions made:**
- The detailed docs live at the **repo root** (what GitHub renders and what the owner reads); `nextjs/README.md` is the pointer. Initially done the other way round — corrected after user feedback.
- Documentation is written for a product owner/vendor audience: gaps are stated plainly (simulated payments, no charge creation, metadata-only documents, single-tenant, no notifications) rather than buried.

**Next steps (agreed priority order):**
1. Test expansion — e2e for issues/violations/arch-requests/payments/documents flows; unit tests for payment application logic; optionally enable `E2E_ENABLED` in GitHub.
2. Billing gap — admin charge creation, recurring dues generator (Vercel Cron), PENDING→OVERDUE job; consolidate legacy Dues Records + Maintenance modules.
3. Notifications via Resend (violation notice, appeal/arch decisions, payment receipt).
4. Real S3 uploads (documents → violation evidence → arch attachments).
5. Vercel staging deploy.
6. Security backlog: email verification, CSRF, lockout/2FA, shared-store rate limiting.

**Gotchas:**
- Root README documents behavior that tests pin (e.g. `/api/users` 403 for residents, rate-limit windows) — update both when changing either.
- Doc facts current as of 08547cd: 106 unit / 27 e2e tests; auth rate limits login 20/15min, register 10/hr, forgot 5/15min, reset 10/15min.
- User is writing a CLAUDE.md to manage context growth; start fresh conversations per task.

## 2026-07-02 — Security hardening + migration baseline

**Files touched:**
- `app/api/users/route.ts` — GET is now staff-only (was: any authenticated user could pull every member's name/email/role)
- `app/dashboard/users/layout.tsx` — new server guard; residents are redirected to their dashboard
- `app/dashboard/users/page.tsx` — board members get a read-only roster (no role selects / delete buttons — the write APIs were already admin-only); uses `useSession()`
- `lib/rate-limit.ts` — new in-memory fixed-window limiter (factory + `rateLimit(req, route, limit, windowMs)` helper returning a 429 with Retry-After)
- `app/api/auth/{login,register,forgot-password,reset-password}/route.ts` — per-IP limits: 20/15min, 10/hr, 5/15min, 10/15min
- `__tests__/lib/rate-limit.test.ts` — 6 unit tests (106 total now)
- `e2e/users.spec.ts` — resident test now asserts redirect + API 403; new board read-only test (27 e2e total)
- `prisma/migrations/` — stale history replaced with a single `0_init` baseline generated via `prisma migrate diff --from-empty`; dev DB marked applied with `migrate resolve --applied 0_init`; `migrate diff` against the live DB confirms zero drift
- READMEs — setup/deploy switched from `db push` to `migrate deploy`; security section updated

**Gotchas / decisions:**
- The dev `.env.local` DATABASE_URL points at **Neon**, not the local `communityhq_postgres` Docker container. Prisma CLI does not read `.env.local` — export DATABASE_URL first (e.g. `export DATABASE_URL=$(grep '^DATABASE_URL' .env.local | cut -d= -f2- | tr -d '\"')`).
- Rate limiter is in-memory: per-instance on Vercel serverless (documented as friction, not a guarantee; Upstash Redis is the upgrade path).
- Any DB previously set up via `db push` must be baselined once: `npx prisma migrate resolve --applied 0_init`. From now on use `migrate dev --name <change>` for schema changes.
- `/api/users/[id]` uses PUT (not PATCH) — the README API table was wrong; fixed.

## 2026-07-02 — Recommendations follow-up: lucide icons, legacy cleanup, theme e2e

**Files touched:**
- `package.json` — added `lucide-react`
- `lib/nav.ts` — nav items now carry `LucideIcon` components (LayoutDashboard, Megaphone, Calendar, Hammer, PencilRuler, TriangleAlert, Wrench, ChartColumn, Wallet, FileText, Users) instead of emoji strings
- `components/Sidebar.tsx`, `components/MobileNav.tsx` — render `<item.icon>`; icons inherit text color (active/hover states now tint the icon too)
- `components/ThemeToggle.tsx` — hand-rolled SVGs replaced with lucide `Sun`/`Moon`
- `eslint.config.mjs` — `no-unused-vars` now ignores `_`-prefixed args/vars/caught errors
- `e2e/theme.spec.ts` — new: dark default, toggle to light, persistence across reload
- Repo root: deleted legacy `client/` and `server/` artifact dirs (untracked leftovers — only dist/node_modules remained), root `node_modules/`, empty `vercel.json`, stale Express-era `.env.example`; rewrote root `README.md` to point at `nextjs/` with Vercel root-directory instructions

**Notes:**
- StatCard/EmptyState still use emoji icons passed as string props from pages — deliberate, larger sweep; swap when touching those pages
- GitHub Actions CI (unit) and E2E (gated on `vars.E2E_ENABLED`) already target `nextjs/` — unchanged
- Gotcha: Windows EPERM on `prisma generate` during build = a leftover `next dev` child process holding query_engine DLL; find it via module list and kill (TaskStop/Ctrl-C on npm may orphan the child)
- Gotcha: CI `npm ci` had failed on EVERY push since the workflows were added — different npm versions disagree about `@emnapi/*` optional deps (wasm fallbacks of Tailwind/Next binaries) in the lockfile, and no lockfile satisfies them all (npm 10, local npm 11.6.1, and the runner's newer npm each expect different entries). Fixed by pinning CI's npm to 11.6.1 — the version that writes the lockfile locally. If you upgrade local Node/npm, regenerate the lockfile and bump the pin in both workflows. CI is green as of b05b884 (first green run).

**Verified:** build, tsc, eslint (0 warnings), 100/100 unit, 25/25 e2e (23 prior + 2 theme), screenshot of new icons in dark mode.

## 2026-07-02 — Dark mode (default) + light toggle, UI revision pass

**Files touched:**
- `app/globals.css` — full theming layer: dark palette via `--color-*` variable overrides under `[data-theme="dark"]`, `@custom-variant dark`, utility-level corrections for role-conflicted tokens, `color-scheme` for native controls
- `app/layout.tsx` — `data-theme="dark"` default on `<html>` + inline no-FOUC script (reads localStorage before first paint), `suppressHydrationWarning`, Geist font exposed as `--font-geist-sans`
- `components/ThemeToggle.tsx` — new; CSS-driven sun/moon icons (`dark:hidden`/`dark:block`) so there is no hydration mismatch
- `lib/nav.ts` — new; nav building + active-state logic extracted from Sidebar/MobileNav (was duplicated ~70 lines)
- `components/Sidebar.tsx` — uses `lib/nav`, brand is now a link to the role dashboard, ThemeToggle in header
- `components/MobileNav.tsx` — uses `lib/nav`, ThemeToggle in top bar, `aria-current` on active drawer links
- `app/(auth)/` — login/register/forgot-password/reset-password moved into a route group (URLs unchanged) with a shared layout that adds a fixed ThemeToggle
- `context/toast.tsx` — info toast `bg-gray-800` → `bg-slate-800` (gray-800 is remapped light in dark mode; slate stays constant)
- `app/api/violations/me/route.ts`, `app/api/architectural-requests/me/route.ts` — removed unused `_req` params (lint now clean)
- `e2e/announcements.spec.ts` — updated to the current admin announcements UI (placeholders, Publish button, ConfirmDialog delete); was failing before this session

**Decisions:**
- Theming works by remapping Tailwind v4 `--color-*` variables in one file, NOT by adding `dark:` variants to 58 route files. Tailwind v4 utilities compile to `var(--color-*)`, so pages keep using light-palette class names everywhere.
- Tokens used as BOTH solid button backgrounds and text (white, blue-600/700, red-500/600/700, green-600) keep the variable for backgrounds; text usages are corrected by unlayered per-utility rules at the bottom of globals.css. If you add a new `text-blue-600`-style usage it just works; if you add a new *conflicted* token, add it there.
- Dark is the default (`data-theme="dark"` in SSR HTML); saved preference is applied by an inline head script before paint per the Next.js "preventing flash before hydration" guide.
- Never use `bg-gray-800`/`bg-gray-900` for "always dark" surfaces — grays invert in dark mode. Use slate (unmapped) instead.

**Verified:** production build passes, eslint clean, tsc clean, 100/100 unit tests, 23/23 Playwright e2e, screenshots of login/dashboard/violations in both themes (toggle + persistence across reload confirmed).

**Next steps:**
- Unit + e2e test expansion for production readiness (user's next session goal)
- Consider swapping emoji nav/stat icons for SVG (lucide-react) for consistent cross-platform rendering
- See session recommendations in chat for the full list

## 2026-07-02 — Sprint 9: Live dashboards, reports, tests, README

**Files touched:**
- `lib/dashboard.ts` — new shared DB query layer (getAdminDashboard, getBoardDashboard, getResidentDashboard)
- `app/admin/dashboard/page.tsx` — replaced mock data with live queries
- `app/board/dashboard/page.tsx` — replaced mock data with live queries
- `app/resident/dashboard/page.tsx` — replaced mock data with live queries
- `app/api/admin/dashboard/route.ts` — new
- `app/api/board/dashboard/route.ts` — new
- `app/api/admin/reports/issues/route.ts` — new
- `app/api/admin/reports/payments/route.ts` — new
- `app/api/admin/reports/architectural-requests/route.ts` — new
- `app/api/admin/reports/violations/route.ts` — new
- `__tests__/lib/violations.test.ts` — new (26 tests)
- `__tests__/lib/architectural-requests.test.ts` — new (17 tests)
- `__tests__/lib/dashboard.test.ts` — new (12 tests)
- `__tests__/workflow/access-control.test.ts` — new (45 tests)
- `README.md` — full rewrite with setup, API overview, demo creds, deferred features

**Decisions:**
- Dashboard data layer lives in `lib/dashboard.ts` and is called directly from server components (no HTTP round-trip). API routes are separate for external/client use.
- Tests target pure functions only — no DB mocking needed.
- `formatDollars` moved from `lib/mock-dashboard.ts` to `lib/dashboard.ts`.

**Next steps:**
- Deploy to Vercel (env vars in dashboard, `prisma db push` against production DB)
- Register Windows Task Scheduler cron jobs when ready
- Wire up Resend for email notifications
- Replace document upload placeholders with real S3 integration
- Consider Stripe integration for real payment processing

## 2026-07-02 — Sprint 8: Violation and appeal workflow

Files: `app/admin/violations/`, `app/board/violations/`, `app/resident/violations/`, `app/api/violations/`, `app/api/admin/violations/`, `lib/violations.ts`, `prisma/schema.prisma`, `prisma/seed.ts`, `components/Sidebar.tsx`, `components/MobileNav.tsx`, `components/ui/StatusBadge.tsx`. Added 8 seeded violations, full resident/admin/board UI, resident-friendly "Community Standards" language.

## 2026-07-02 — Sprint 7: Architectural review request workflow

Files: `app/admin/architectural-requests/`, `app/board/architectural-requests/`, `app/resident/architectural-requests/`, `app/api/architectural-requests/`, `app/api/admin/architectural-requests/`, `app/api/board/architectural-requests/`, `lib/architectural-requests.ts`, `prisma/schema.prisma`, `prisma/seed.ts`. Added 10 seeded requests, full resident/admin/board UI with dual-panel admin layout.
