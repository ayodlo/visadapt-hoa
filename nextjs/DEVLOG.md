# CommunityHQ Dev Log

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
