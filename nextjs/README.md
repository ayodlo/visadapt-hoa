# CommunityHQ

A full-stack HOA (homeowners association) management platform built with Next.js 16, Prisma, and PostgreSQL. It covers the day-to-day workflows of a single community: announcements, events, issue tracking, architectural review, violation enforcement with appeals, dues/payments, document distribution, polls, and role-based dashboards for residents, admins (property management staff), and board members.

**Deployment model: single-tenant.** One deployment = one HOA. There is no organization/community model; every user in the database belongs to the same community. Multi-community support requires schema and auth changes (see [Known Limitations](#known-limitations--product-gaps)).

---

## Contents

1. [Quick Start](#quick-start)
2. [Demo Credentials & Seed Data](#demo-credentials--seed-data)
3. [Roles & Permission Model](#roles--permission-model)
4. [Feature Modules](#feature-modules) — what each module does, its workflow states, and its rules
5. [Validation Limits](#validation-limits)
6. [Capacities & Pagination](#capacities--pagination)
7. [Security Model](#security-model)
8. [Known Limitations & Product Gaps](#known-limitations--product-gaps)
9. [API Reference](#api-reference)
10. [Testing & Quality Gates](#testing--quality-gates)
11. [Deployment](#deployment-vercel)
12. [Operations Notes](#operations-notes)

---

## Quick Start

### Prerequisites
- Node.js 24 (the lockfile is written by npm 11.6.1 — see [Operations Notes](#operations-notes))
- A PostgreSQL database (local Docker or Neon free tier)

```bash
cd nextjs
npm install
cp .env.example .env.local     # fill in values — see table below
npx prisma db push             # create tables (dev)
npx prisma db seed             # load demo data
npm run dev                    # http://localhost:3000
```

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (Neon: use the pooled URL) |
| `JWT_SECRET` | Yes | Random secret, at least 32 chars — `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | Yes | Token lifetime, e.g. `7d` (see [Security Model](#security-model) for the cookie-lifetime caveat) |
| `NEXT_PUBLIC_APP_URL` | Yes | Full base URL, e.g. `http://localhost:3000` — used in password-reset links |
| `RESEND_API_KEY` | No | Enables the two transactional emails that are wired up (password reset, maintenance status). Without it, those emails silently do not send; nothing else breaks. |
| `EMAIL_FROM` | No | Verified sender for Resend (defaults to `onboarding@resend.dev`) |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` / `AWS_S3_BUCKET` | No | An S3 helper module exists (`lib/s3.ts`) but **no feature currently uploads files** — see [Documents](#documents) |

---

## Demo Credentials & Seed Data

All seeded accounts use the password **`password123`**.

| Role | Email |
|---|---|
| Resident | `resident@communityhq.local` |
| Admin | `admin@communityhq.local` |
| Board Member | `board@communityhq.local` |

The seed (`prisma/seed.ts`) is **destructive**: it runs `deleteMany` on every table and recreates everything. Never run it against a database with real data. It creates:

- **20 residents** (`resident@communityhq.local` + 19 like `james.carter@example.com`), **2 admins**, **3 board members**, **5 vendors**, **10 properties** with resident profiles
- **6 announcements** (mix of priorities, one pinned, one emergency)
- **~100 charges + payments**: $250/month HOA dues March–July 2026 per resident; 15 residents fully paid, 3 with an overdue June + late fee, 2 with June pending; capital-improvement and roof-repair special assessments sprinkled in — so dashboards show realistic delinquency numbers out of the box
- **12 documents** (metadata only — see [Documents](#documents))
- **17 maintenance issues** across the full status range, with comments, activity trails, vendor and staff assignments
- **10 architectural requests** covering every workflow state
- **8 violations** covering the enforcement lifecycle, including appeals

---

## Roles & Permission Model

Three roles, fixed hierarchy, stored on the user and embedded in the JWT:

| Capability | Resident | Board Member | Admin |
|---|---|---|---|
| View announcements, events, documents, polls | ✅ | ✅ | ✅ |
| Vote in polls | ✅ | ✅ | ✅ |
| Pay own dues (simulated), see own ledger | ✅ | — | — |
| Submit / track own issues, arch requests | ✅ | — | — |
| Respond to / appeal own violations | ✅ | — | — |
| Create/edit announcements, events, polls | — | ✅ | ✅ |
| Manage the issue queue (assign, status, vendors) | — | ✅ | ✅ |
| Review architectural requests | — | ✅ decision statuses only | ✅ all statuses |
| Create violations, send notices, review appeals | — | ✅ | ✅ |
| View all residents' payment status | — | ✅ | ✅ |
| Upload/manage documents | — | — | ✅ |
| Change user roles, delete users | — | — | ✅ |
| API reports | — | ✅ | ✅ |

Notes product owners should know:

- **Registration is open.** Anyone who can reach the site can self-register and always gets the RESIDENT role (no email verification, no invitation flow, no approval step). Admins promote users to board/admin from the Users page.
- **Role changes take effect at next login.** The role lives inside the JWT, which is valid for up to `JWT_EXPIRES_IN`. Demoting or promoting a user does not invalidate their existing token.
- **Board vs. admin on architectural requests** is the only place the two staff roles differ in *transition* power: board members can set `UNDER_REVIEW`, `NEEDS_MORE_INFORMATION`, `APPROVED`, `DENIED`; admins can additionally set `SUBMITTED` and `WITHDRAWN`. Elsewhere (violations, issues, announcements, events, polls) board members have the same write powers as admins.
- **Internal comments** on issues, architectural requests, and violations are hidden from residents at the query level (not just the UI).

---

## Feature Modules

### Dashboards
Role-specific landing pages, queried live from the database on the server (no client fetch):

- **Resident:** current balance, open issues, active violations, pending arch requests, recent announcements.
- **Admin:** outstanding community balance, open/overdue issue counts, delinquent account count, open violations, pending arch requests, needs-attention queue, recent announcements, issue breakdown, financial summary.
- **Board:** financial summary, decision queue (arch requests + appeals pending), issue resolution rate.

### Announcements
- Created by admins and board members. Title ≤ 300 chars; body unlimited; optional target location label ≤ 200 chars.
- **Priorities:** Normal, Important, Emergency (visual treatment only — no notification behavior).
- **Audiences:** All Residents, Board Members Only, Specific Location. ⚠️ *Audience is a filter for the board-only case only:* residents' feeds include both `ALL_RESIDENTS` **and** `SPECIFIC_LOCATION` announcements — the location is displayed as a label, not enforced as targeting. Do not put confidential content in a "Specific Location" announcement.
- **Scheduling:** `publishAt` in the future hides the announcement until then; `expiresAt` auto-hides it after. Pinned announcements sort first.
- **Read receipts:** first view per user is recorded (unique per user/announcement); admins see read counts.
- Deleting an announcement permanently removes it and its read receipts.

### Issues (maintenance/community issue tracker)
The primary work-order system. Residents submit; staff triage.

- **Resident submission:** title 5–200 chars, description ≥ 10 chars, location 3–300 chars, category (Landscaping, Maintenance, Parking, Safety, Noise, Gate/Access, Trash, Other), priority (Low/Medium/High/Urgent), preferred contact method (Email/Phone/Text).
- **Lifecycle:** `SUBMITTED → UNDER_REVIEW → ASSIGNED → IN_PROGRESS → WAITING_ON_VENDOR → RESOLVED → CLOSED`. Transitions are **not** enforced as a graph — staff can set any status at any time; the order above is the intended flow.
- Staff can assign a staff member and/or link one of the seeded vendors, and set a due date.
- **Comments:** public (visible to the resident) or internal (staff-only), ≤ 2000 chars. Every status change and comment is recorded in an activity trail shown on the detail page.
- Residents can comment on their own issues but cannot change status.

### Architectural Requests (ARC review)
Residents request approval for exterior modifications; staff and board review.

- **Types:** Fence, Exterior Paint, Landscaping, Solar Panels, Roof, Shed, Other.
- **Resident submission:** description 20–5000 chars, optional desired start date and property. "Attachments" are **checklist labels only** (Site Plan, Elevation Drawing, Material Samples, Contractor Quote, Before Photo, Supporting Document) — no actual file upload exists.
- **Lifecycle:** `DRAFT → SUBMITTED → UNDER_REVIEW → (NEEDS_MORE_INFORMATION ⇄) → APPROVED / DENIED`, plus `WITHDRAWN`.
- **Resident powers on their own request:** edit type/description/dates while in `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, or `NEEDS_MORE_INFORMATION`; submit a draft; withdraw in any of those same statuses. Once `APPROVED` or `DENIED`, the request is immutable to the resident.
- **Review powers:** admins and board members can cite a governing rule (≤ 500 chars) and record a decision reason (≤ 2000 chars) — both shown to the resident. Board members are limited to decision-related transitions (see role table).
- Public/internal comments and a full activity trail, same as issues.

### Violations & Appeals (community standards enforcement)
Staff-initiated enforcement with a resident-friendly presentation ("Community Standards" language in the resident UI).

- **Created by admin or board:** type (Landscaping & Maintenance, Parking, Noise, Property Appearance, Unauthorized Modification, Pet Violation, Trash & Debris, Other), rule citation 3–500 chars, description 10–5000 chars, observation date, optional cure deadline, optional resolution steps ≤ 2000 chars, optional evidence **URL** ≤ 500 chars (a link, not an upload).
- **Lifecycle:** `DRAFT → NOTICE_SENT → RESIDENT_RESPONDED / UNDER_REVIEW → RESOLVED / ESCALATED / CLOSED`. As with issues, staff can set any status; the graph is convention, not enforcement. A `DRAFT` violation is not visible to the resident; moving it to `NOTICE_SENT` is the "send" action (⚠️ no actual notification is sent — see [Known Limitations](#known-limitations--product-gaps)).
- **Resident response:** allowed only while status is `NOTICE_SENT`; 10–3000 chars; automatically moves the violation to `RESIDENT_RESPONDED`.
- **Appeals:** **one per violation** (enforced by a DB unique constraint). A resident may appeal while the violation is in `NOTICE_SENT`, `RESIDENT_RESPONDED`, `UNDER_REVIEW`, or `ESCALATED`; reason 20–3000 chars. Staff review the appeal to `UNDER_REVIEW`, then `APPROVED` / `DENIED` (with an outcome note ≤ 2000 chars); the reviewer and timestamp are recorded. A withdrawn or denied appeal cannot be re-filed.
- Deadline proximity is surfaced on resident and staff dashboards; nothing automatic happens when a deadline passes.

### Payments & Charges (dues)
A charge/payment ledger with a **simulated checkout — no real money moves**.

- **All amounts are integer cents.** Displayed as dollars in the UI.
- **Charges** (what a resident owes) currently come **only from the seed**. There is no admin UI or API to create a charge, and no recurring-dues generator. This is the biggest functional gap for real-world use (see [Known Limitations](#known-limitations--product-gaps)).
- **Resident payment flow:** resident sees outstanding charges (oldest/overdue first) and pays any amount up to the total owed. Payment method is a label (Credit Card, Debit Card, Bank Transfer, Check) — nothing is charged. The payment is recorded instantly as `PAID` with a confirmation number (`CHQ-…`), and an audit-log entry is written.
- **Application order:** payments settle charges oldest-and-overdue-first, and **only whole charges are settled**. ⚠️ A partial payment (less than the next charge's amount) is *recorded as a payment but settles nothing* — the resident's charge balance is unchanged. The UI steers residents toward full amounts, but the API accepts any positive amount up to the balance. Treat partial payments as unsupported.
- **Guards:** cannot pay with zero balance; cannot pay more than the balance.
- **Admin/board view:** paginated roster of all residents with balance and last payment; per-resident charge/payment history (read-only — staff cannot record offline payments through the UI).
- A separate, older **Dues Records** module (`/dashboard/dues`) still exists — see Legacy Modules below.

### Documents
A community document library — **metadata only, no file storage**.

- Admin-only create/edit/delete: title, optional description, category (CC&Rs, Rules & Regulations, Meeting Minutes, Financial Documents, Insurance, Community Forms, Maintenance, Other), a `fileUrl` string and file name. The URL is stored and echoed back verbatim; nothing is uploaded, validated, or proxied.
- All authenticated users (including residents and board) can browse, filter by category, search, and "download" — the download endpoint returns the stored URL for the client to open.
- An S3 client helper (`lib/s3.ts`, presigned GET/PUT) is implemented but **not called by any route**. Wiring real uploads is a deferred feature.

### Polls
- Created by admins and board members: question, optional description, **minimum 2 options**, optional close date.
- **One vote per user per poll**, enforced by a DB unique constraint (re-vote returns 409). Votes cannot be changed or withdrawn. Voting on a closed poll is rejected.
- Results (per-option percentages) are revealed to a user after they vote, or when the poll closes.

### Events
- Simple community calendar: title, optional description/location, start time, optional end time.
- Admins and board members create/edit/delete; residents view. No RSVP, recurrence, or reminders.

### Users & Profile
- **Users admin page** (admin only in the UI): list all users, change roles, delete users.
  - Admins cannot delete their own account.
  - ⚠️ Deleting a user who has any history (issues, payments, violations, etc.) will fail with a database foreign-key error — there is no archival/anonymization flow. In practice, users with activity cannot be deleted.
- **Profile page** (all roles): edit first/last name and email; change password (requires current password; new password min 8 chars).

### Legacy Modules
Two earlier-generation modules are still mounted and share the sidebar:

- **Maintenance** (`/dashboard/maintenance`, `MaintenanceRequest` model): a simpler predecessor of Issues (title/description/priority, 4 statuses, no comments/vendors/assignment). This is also the **only module with a wired outbound email**: when staff change a request's status, the resident is emailed via Resend (silently skipped if `RESEND_API_KEY` is unset).
- **Dues Records** (`/dashboard/dues`, `DuesRecord` model): a labeled dues list (Pending/Paid/Overdue/Waived) that is **not connected to the Charges/Payments ledger**. Board members' "Dues" nav item points here. Reconciling or retiring one of the two financial modules is recommended before production (see Known Limitations).

### Audit Log
Sensitive actions (payments, violation and arch-request changes, etc.) write rows to an `audit_logs` table with actor, action, entity, and JSON metadata. **There is no UI** — it is queryable only via the database or Prisma Studio.

---

## Validation Limits

All server-side (Zod), independent of any UI hints. Requests exceeding limits get HTTP 400 with a message.

| Field | Limit |
|---|---|
| Password (register, reset, change) | min 8 chars, no complexity rules, no maximum |
| Announcement title / target location | ≤ 300 / ≤ 200 chars (body unlimited) |
| Issue title / location / description | 5–200 / 3–300 / ≥ 10 chars (no max on description) |
| Arch request description | 20–5000 chars |
| Governing rule reference / decision reason | ≤ 500 / ≤ 2000 chars |
| Violation rule citation / description | 3–500 / 10–5000 chars |
| Violation resolution steps / evidence URL | ≤ 2000 / ≤ 500 chars |
| Violation response / appeal reason | 10–3000 / 20–3000 chars |
| Comments (issues, arch requests, violations) | 1–2000 chars |
| Appeal outcome note | ≤ 2000 chars |
| Payment amount | positive integer cents, ≤ current balance |
| Poll | ≥ 2 options |
| Emails | RFC-format validated; unique per user |

Notable absences: no length caps on announcement/issue/legacy-maintenance bodies or document titles; no file-size limits anywhere (because there are no file uploads); no rate or frequency limits on submissions (a resident can file unlimited issues/requests).

---

## Capacities & Pagination

| Surface | Page size |
|---|---|
| Admin lists: announcements, issues, violations, arch requests, payments roster | 20 per page (fixed) |
| Documents | 12 per page default, client-adjustable up to 50 |
| Report endpoints | Issues capped at 500 rows, arch requests at 200, payments report at 20 |
| Resident "my …" lists, events, polls, users, dues records | **Unpaginated** — returns all rows |

Practical capacity: at a realistic single-HOA scale (hundreds of residents, thousands of records) the unpaginated endpoints are fine; they would degrade with tens of thousands of rows. There are no hard record caps anywhere.

---

## Security Model

- **Auth:** email + bcrypt (cost 12) password, JWT (`jsonwebtoken`, HS256) in an `HttpOnly`, `SameSite=Lax` cookie, `Secure` flag in production. Default token lifetime 7 days (`JWT_EXPIRES_IN`).
  - ⚠️ The **cookie** Max-Age is hard-coded to 7 days regardless of `JWT_EXPIRES_IN`. If you set the token lifetime shorter, users keep a cookie holding an expired token (they'll be redirected to login — harmless); longer, and the cookie expires first.
- **Route protection:** middleware (`proxy.ts`) verifies the JWT for every page and API path except `/login`, `/register`, `/forgot-password`, `/reset-password`, and `/api/auth/*`, redirecting to login. Every API handler *additionally* checks the session and role — defense in depth.
- **Password reset:** 32-byte random token, 1-hour expiry, single-use (consumed transactionally). The forgot-password endpoint always returns success (no account enumeration). The email is only actually sent if `RESEND_API_KEY` is configured; failures are swallowed silently.
- **No logout-everywhere / token revocation:** JWTs are stateless; a stolen or stale token is valid until expiry. Changing a password does **not** invalidate existing sessions.
- **Audit logging** on financially/legally sensitive actions (see above).

### Security items to address before selling this

1. **`GET /api/users` is not role-restricted.** Any authenticated user — including any self-registered resident — can retrieve every user's full name, email address, and role. The Users *page* is admin-only in the UI, but the API is open to all logged-in users (an e2e test currently pins this behavior). This is a personal-data exposure and should be locked to admins.
2. **No rate limiting or brute-force protection** on login, registration, or password reset. (The retired Express backend had rate limits; the Next.js app has none.)
3. **Open self-registration** with no email verification — anyone can create a resident account and immediately see announcements, documents, events, polls, and the users list.
4. **No CSRF tokens.** `SameSite=Lax` mitigates cross-site POSTs in modern browsers, but there is no secondary defense.
5. **Violation "evidence" and document links are unvalidated URLs** entered by staff — they can point anywhere.
6. **No account lockout, session listing, 2FA, or password complexity policy.**

---

## Known Limitations & Product Gaps

Things a product owner/vendor must know before treating this as a sellable SaaS:

| Area | Reality |
|---|---|
| **Payments are simulated** | No gateway. "Paying" instantly marks charges paid and issues a confirmation number. No refunds, disputes, receipts by email, or reconciliation. Stripe integration is deferred. |
| **No way to create charges** | Charges exist only from seed data. Real operation needs an admin charge-creation UI and/or a recurring dues generator (a scheduled job was planned but never registered). |
| **Two parallel financial modules** | The modern Charges/Payments ledger and the legacy Dues Records list are unconnected. Board "Dues" nav uses the legacy one. Consolidate before production. |
| **Two parallel maintenance modules** | Issues (full-featured) and legacy Maintenance coexist in the nav; only legacy Maintenance sends email. Consolidate. |
| **Almost no notifications** | "Notice sent," announcement priorities, deadlines, appeal decisions — none trigger email/SMS/push. Only password reset and legacy-maintenance status changes send email, and only if Resend is configured. |
| **No file uploads** | Documents and violation evidence are URL strings; arch-request attachments are checkbox labels. S3 helper exists but is unused. |
| **Single-tenant** | One community per deployment. No tenant isolation, billing, or white-labeling. |
| **No scheduled jobs** | Nothing marks charges `OVERDUE` when due dates pass, expires violations deadlines, or sends reminders. Any time-based behavior visible in seeded data was hand-authored. |
| **User deletion breaks on history** | FK constraints block deleting any user with activity; no soft-delete/anonymization (relevant for GDPR/CCPA erasure requests). |
| **No data export** | No CSV/PDF export for boards or auditors; reports are JSON API endpoints only. |
| **Timezones** | All timestamps are stored UTC and rendered in the viewer's browser locale. An HOA in one timezone with a manager in another will see different wall-clock times; deadlines are moments, not local dates. |
| **Accessibility** | Reasonable semantics (aria labels/current, focus rings, keyboard-dismissable dialogs) but never formally audited against WCAG. |
| **No observability** | No error tracking, structured logging, metrics, or uptime checks. |
| **Status graphs are conventions** | Staff can jump any issue/violation/arch request to any allowed status — no transition enforcement or approval chains. |

### Deferred feature backlog (from the dev log)
Stripe payments · Resend notifications across all modules · real S3 document upload · amenity reservations · e-signatures · automated compliance reminders (scheduled jobs) · AI document search · multi-community support · full accounting (GL, budgets, expenses).

---

## API Reference

All routes are cookie-authenticated (except `/api/auth/*` where noted) and return `{ error: string }` with an appropriate status on failure. "Staff" = admin + board member.

### Auth (public)
| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/register` | Open registration; always creates RESIDENT; auto-login (sets cookie) |
| POST | `/api/auth/login` | Sets JWT cookie |
| POST | `/api/auth/logout` | Clears cookie |
| GET | `/api/auth/me` | Current session user |
| POST | `/api/auth/forgot-password` | Always 200; emails reset link if Resend configured |
| POST | `/api/auth/reset-password` | Consumes single-use token (1 h expiry) |
| PATCH | `/api/auth/change-password` | Authenticated; requires current password |
| PATCH | `/api/auth/profile` | Update name/email |

### Dashboards & Reports (staff)
`GET /api/admin/dashboard` · `GET /api/board/dashboard` · `GET /api/admin/reports/{issues,payments,architectural-requests,violations}`

### Announcements
| Method | Path | Access |
|---|---|---|
| GET | `/api/announcements` | Any authenticated (audience/publish-window filtered); marks reads |
| GET/POST | `/api/admin/announcements` | Staff (paginated, filterable) |
| PATCH/DELETE | `/api/admin/announcements/[id]` | Staff |

### Issues
| Method | Path | Access |
|---|---|---|
| POST | `/api/issues` | Resident |
| GET | `/api/issues/me` | Resident (own) |
| GET/PATCH | `/api/issues/[id]` | Owner (limited) / staff |
| POST | `/api/issues/[id]/comments` | Owner / staff (staff may mark internal) |
| GET | `/api/admin/issues` | Staff (paginated, filter by status/category/priority/search) |
| GET/PATCH | `/api/admin/issues/[id]` | Staff (status, assignee, vendor, due date) |
| POST | `/api/admin/issues/[id]/comments` | Staff |

### Architectural Requests
| Method | Path | Access |
|---|---|---|
| POST | `/api/architectural-requests` | Resident (creates DRAFT or submits) |
| GET | `/api/architectural-requests/me` | Resident (own) |
| GET/PATCH | `/api/architectural-requests/[id]` | Owner (edit/submit/withdraw per status rules) |
| POST | `/api/architectural-requests/[id]/comments` | Owner / staff |
| GET | `/api/admin/architectural-requests` | Staff (paginated) |
| GET/PATCH | `/api/admin/architectural-requests/[id]` | Admin (all transitions) |
| GET | `/api/board/architectural-requests` | Board (paginated) |
| GET/PATCH | `/api/board/architectural-requests/[id]` | Board (decision transitions only) |

### Violations
| Method | Path | Access |
|---|---|---|
| GET | `/api/violations/me` | Resident (own, non-DRAFT) |
| GET | `/api/violations/[id]` | Owner / staff |
| POST | `/api/violations/[id]/respond` | Owner, only in NOTICE_SENT |
| POST | `/api/violations/[id]/appeal` | Owner, appealable statuses, one per violation |
| GET/POST | `/api/admin/violations` | Staff (paginated, filterable) |
| GET/PATCH | `/api/admin/violations/[id]` | Staff |
| PATCH | `/api/admin/violations/[id]/appeal` | Staff (review/decide appeal) |

### Payments
| Method | Path | Access |
|---|---|---|
| GET | `/api/payments/me` | Resident — outstanding charges + balance |
| GET | `/api/payments/me/ledger` | Resident — full charge/payment history |
| POST | `/api/payments/me/pay` | Resident — simulated payment (see rules above) |
| GET | `/api/admin/payments` | Staff — resident roster with balances (paginated) |
| GET | `/api/admin/payments/[residentId]` | Staff — one resident's ledger (read-only) |

### Documents, Events, Polls, Users, Legacy
| Method | Path | Access |
|---|---|---|
| GET | `/api/documents` | Any authenticated (paginated, category filter, search) |
| POST | `/api/documents` / PATCH·DELETE `/api/documents/[id]` | Admin only |
| GET | `/api/documents/[id]/download` | Any authenticated — returns stored URL |
| GET/POST | `/api/events`, PATCH/DELETE `/api/events/[id]` | GET any; writes staff |
| GET/POST | `/api/polls`, DELETE `/api/polls/[id]`, POST `/api/polls/[id]/vote` | GET/vote any; create/delete staff |
| GET | `/api/users` | ⚠️ Any authenticated user (see Security) |
| PATCH/DELETE | `/api/users/[id]` | Admin (no self-delete; delete fails for users with history) |
| GET/POST `/api/maintenance`, PATCH/DELETE `/api/maintenance/[id]` | Legacy maintenance | Resident create; staff update (sends email if configured) |
| GET/POST `/api/dues`, PATCH/DELETE `/api/dues/[id]` | Legacy dues records | Residents see own; writes staff |

---

## Testing & Quality Gates

```bash
npm test              # 100 Vitest unit tests (pure functions — no DB needed)
npm run test:e2e      # 25 Playwright e2e tests (needs DATABASE_URL + seeded DB; auto-starts dev server)
npm run lint          # ESLint (0 warnings)
npx tsc --noEmit      # Type check
npm run build         # Production build (runs prisma generate first)
```

GitHub Actions: `CI` (unit + lint + typecheck) runs on every push/PR to `main`. `E2E tests` runs only when the repo variable `E2E_ENABLED` is `'true'` and requires `DATABASE_URL`/`JWT_SECRET` secrets.

### UI/theming
Dark mode is the default; a sun/moon toggle (sidebar, mobile top bar, auth pages) persists the choice in `localStorage` with no flash on load. The entire dark theme lives in `app/globals.css` via Tailwind v4 CSS-variable remapping — do **not** add `dark:` variants to pages, and never use `bg-gray-800/900` for "always dark" surfaces (grays invert); use `slate` instead.

---

## Deployment (Vercel)

1. Import the repo into Vercel; set the project **Root Directory** to `nextjs`.
2. Add the environment variables above in project settings (Neon `DATABASE_URL` recommended).
3. Build command is already `prisma generate && next build` via `package.json`.
4. Initialize the production schema once: `npx prisma db push` with the production `DATABASE_URL`. Only seed non-production databases — the seed wipes all data.

## Operations Notes

- **npm version is pinned in CI (11.6.1).** npm releases disagree about optional wasm dependencies in the lockfile; the workflows pin the version that writes `package-lock.json` locally. If you upgrade local Node/npm, regenerate the lockfile and bump the pin in `.github/workflows/{ci,e2e}.yml`.
- **Prisma on Windows:** if `prisma generate` fails with `EPERM … query_engine-windows.dll.node`, an orphaned `next dev` child process is holding the engine DLL — kill the stray `node` process.
- **Prisma binary targets** include `rhel-openssl-3.0.x` for Vercel's runtime.
- **The migration history is stale — do not use `prisma migrate`.** `prisma/migrations/` only covers the schema as of the early sprints; every later model (issues, charges/payments, architectural requests, violations, …) was applied with `prisma db push` and has no migration. Running `prisma migrate dev` will report drift and offer to reset. Either keep using `db push` (current practice) or baseline a fresh migration history before production, where tracked migrations are strongly recommended.
- The seed is idempotent but destructive (delete-then-recreate). `DEVLOG.md` in this directory is the running engineering log.
