# CommunityHQ

A full-stack HOA management platform built with Next.js 16, Prisma, and PostgreSQL. Covers the resident, admin, and board member workflows for a typical homeowners association.

---

## Features by Role

### Resident
- Dashboard with live balance, open issues, active violations, and recent announcements
- Pay HOA dues (simulated checkout — no real gateway)
- Submit and track maintenance issues
- Browse and download community documents
- View and respond to announcements
- Submit and track architectural modification requests
- View community standards notices (violations) with deadline tracking
- Submit responses and file appeals on violations

### Admin
- Dashboard with live KPIs: outstanding balance, open/overdue issues, delinquent accounts, open violations and arch requests, recent activity feed
- Manage residents and users (view, role assignment)
- Post and manage announcements
- Full issue queue with assignment, vendor linking, status tracking, and internal comments
- Process payments and view payment history per resident
- Upload and manage documents (categories, visibility)
- Manage architectural requests: full review workflow with internal/public comments, governing rule citation, and decision recording
- Manage violations: create, send notice, track responses, manage appeals, update resolution steps
- API reports: `/api/admin/reports/issues`, `/api/admin/reports/payments`, `/api/admin/reports/architectural-requests`, `/api/admin/reports/violations`

### Board Member
- Dashboard with financial summary, decision queue count, and resolution rate
- Review and vote on architectural requests
- Review escalated violations and pending resident appeals
- View community issue metrics
- Read-only access to documents, announcements, and dues

---

## Architecture

```
nextjs/
├── app/
│   ├── api/                   # Route handlers (REST-style)
│   │   ├── admin/             # Admin + board shared routes
│   │   ├── board/             # Board-only routes
│   │   └── ...                # Public/resident routes
│   ├── admin/                 # Admin UI pages
│   ├── board/                 # Board member UI pages
│   ├── resident/              # Resident UI pages
│   └── dashboard/             # Legacy shared pages (events, polls, maintenance, profile)
├── components/
│   ├── ui/                    # Reusable primitives (StatCard, PageHeader, StatusBadge, etc.)
│   ├── Sidebar.tsx            # Desktop navigation
│   └── MobileNav.tsx          # Mobile slide-in drawer
├── lib/
│   ├── auth.ts                # JWT sign/verify, getSession, requireRole
│   ├── api.ts                 # ok/err/unauthorized/forbidden/notFound helpers
│   ├── dashboard.ts           # getAdminDashboard, getBoardDashboard, getResidentDashboard
│   ├── violations.ts          # Type labels and status helpers
│   └── architectural-requests.ts  # Type labels and status helpers
├── prisma/
│   ├── schema.prisma          # Full data model
│   └── seed.ts                # Idempotent seed (deleteMany then recreate)
└── __tests__/                 # Vitest unit tests
    ├── lib/                   # Pure function tests (auth, dashboard, helpers)
    └── workflow/              # Access control and business logic tests
```

**Stack:** Next.js 16 App Router · React 19 · TypeScript · Tailwind CSS v4 · Prisma 5 · PostgreSQL (Neon) · JWT (jsonwebtoken) · Vitest · Playwright (e2e)

**Auth:** Cookie-based JWT. The token is `HttpOnly`, `SameSite=Lax`, and `Secure` in production. Role is embedded in the token — no session table needed.

**Role routing:** Middleware reads the JWT and redirects based on role. Admin and board member share most management routes; board members have restricted write permissions (decision-related transitions only, no create/delete).

---

## Setup

### Prerequisites
- Node.js 20+
- A PostgreSQL database (Neon free tier works)

### 1. Install dependencies

```bash
cd nextjs
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local` and fill in real values:

```bash
cp .env.example .env.local
```

Required variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Neon: use the pooled URL) |
| `JWT_SECRET` | Random secret at least 32 chars — `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `7d` |
| `NEXT_PUBLIC_APP_URL` | Full base URL, e.g. `http://localhost:3000` |

Optional (used by deferred features):

| Variable | Description |
|---|---|
| `RESEND_API_KEY` | For email notifications (not wired up yet) |
| `AWS_ACCESS_KEY_ID` | For S3 file storage (not wired up yet) |
| `AWS_SECRET_ACCESS_KEY` | For S3 file storage |
| `AWS_REGION` | S3 region |
| `S3_BUCKET_NAME` | S3 bucket for document uploads |

### 3. Push schema and seed

```bash
# Push schema to the database (development)
npx prisma db push --accept-data-loss

# Seed demo data
npx prisma db seed
```

On Windows PowerShell, set the environment variable first:

```powershell
$env:DATABASE_URL = "postgresql://..."
npx prisma db push --accept-data-loss
npx prisma db seed
```

### 4. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Prisma Commands

| Command | Description |
|---|---|
| `npx prisma db push` | Push schema changes (dev) |
| `npx prisma db push --accept-data-loss` | Push and accept column drops |
| `npx prisma db push --force-reset` | Drop and recreate all tables |
| `npx prisma db seed` | Run `prisma/seed.ts` |
| `npx prisma studio` | Open Prisma Studio GUI |
| `npx prisma generate` | Regenerate the Prisma Client |

---

## Demo Credentials

All demo accounts use the password: **`password123`**

| Role | Email |
|---|---|
| Resident | `resident@communityhq.local` |
| Admin | `admin@communityhq.local` |
| Board Member | `board@communityhq.local` |

There are also 19 additional seeded resident accounts (`james.carter@example.com`, `maria.gonzalez@example.com`, etc.) all using the same password.

---

## Running Tests

```bash
# Unit tests (Vitest)
npm test

# Watch mode
npm run test:watch

# E2E tests (Playwright — requires running dev server)
npm run test:e2e
```

Tests live in `__tests__/`. Vitest is configured in `vitest.config.ts` to include only `__tests__/**/*.test.ts`. No database connection is needed for unit tests — all tests target pure functions.

---

## Linting and Build

```bash
# Type check
npx tsc --noEmit

# Lint
npm run lint

# Production build
npm run build

# Start production server
npm start
```

---

## API Overview

All routes return `{ error: string }` on failure with an appropriate HTTP status code.

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | Email and password login — sets JWT cookie |
| POST | `/api/auth/logout` | Clears JWT cookie |
| GET | `/api/auth/me` | Returns current session user |
| POST | `/api/auth/register` | Create new resident account |
| POST | `/api/auth/forgot-password` | Request reset link (email deferred) |
| POST | `/api/auth/reset-password` | Consume reset token, set new password |
| PATCH | `/api/auth/change-password` | Change password (authenticated) |
| PATCH | `/api/auth/profile` | Update name and email |

### Dashboard
| Method | Path | Access |
|---|---|---|
| GET | `/api/admin/dashboard` | Admin, Board |
| GET | `/api/board/dashboard` | Admin, Board |

### Reports
| Method | Path | Access |
|---|---|---|
| GET | `/api/admin/reports/issues` | Admin, Board |
| GET | `/api/admin/reports/payments` | Admin, Board |
| GET | `/api/admin/reports/architectural-requests` | Admin, Board |
| GET | `/api/admin/reports/violations` | Admin, Board |

### Issues
| Method | Path | Access |
|---|---|---|
| GET | `/api/issues/me` | Resident (own) |
| GET, PATCH | `/api/issues/[id]` | Resident (own) / Admin |
| POST | `/api/issues/[id]/comments` | Resident (own) / Admin |
| GET, POST | `/api/admin/issues` | Admin, Board |
| GET, PATCH | `/api/admin/issues/[id]` | Admin, Board |

### Architectural Requests
| Method | Path | Access |
|---|---|---|
| GET | `/api/architectural-requests/me` | Resident (own) |
| POST | `/api/architectural-requests` | Resident |
| GET, PATCH | `/api/architectural-requests/[id]` | Resident (own) / Admin |
| GET, PATCH | `/api/admin/architectural-requests/[id]` | Admin only |
| GET, PATCH | `/api/board/architectural-requests/[id]` | Board only |

### Violations
| Method | Path | Access |
|---|---|---|
| GET | `/api/violations/me` | Resident (own) |
| GET | `/api/violations/[id]` | Resident (own) / Admin |
| POST | `/api/violations/[id]/respond` | Resident (own, NOTICE_SENT status only) |
| POST | `/api/violations/[id]/appeal` | Resident (own, appealable statuses only) |
| GET, POST | `/api/admin/violations` | Admin, Board |
| GET, PATCH | `/api/admin/violations/[id]` | Admin, Board |
| PATCH | `/api/admin/violations/[id]/appeal` | Admin, Board |

### Payments
| Method | Path | Access |
|---|---|---|
| GET | `/api/payments/me` | Resident (own) |
| GET | `/api/payments/me/ledger` | Resident (own) |
| POST | `/api/payments/me/pay` | Resident — simulated payment |
| GET | `/api/admin/payments` | Admin, Board |
| GET, PATCH | `/api/admin/payments/[residentId]` | Admin only |

---

## Deferred Features

| Feature | Notes |
|---|---|
| Real payment gateway | Stripe or similar. Current flow simulates payment by marking charges as PAID and generating a confirmation number. |
| Email / SMS notifications | The `resend` package is installed and `RESEND_API_KEY` is in `.env.example`, but no emails are sent. Trigger points are documented in the code. |
| Push notifications | Not implemented. |
| Real document uploads | The AWS S3 SDK (`@aws-sdk/client-s3`) is installed but document uploads are not wired. Records use placeholder metadata. |
| Amenity reservations | Pool, gym, clubhouse booking — no model or UI. |
| Full accounting reconciliation | Current financials are a simplified charge/payment ledger. No general ledger, budget tracking, or expense management. |
| E-signatures | CC&Rs acceptance, consent forms, architectural approval letters. |
| Automated compliance reminders | Scheduled jobs to notify residents of overdue violations or upcoming deadlines. |
| AI document search / rule guidance | Semantic search over CC&Rs or board minutes. |
| Docker / containerization | No Dockerfile. Run locally with Node.js or deploy to Vercel. |
| Multi-community support | Single-tenant only. One HOA per deployment. |

---

## Deployment (Vercel)

1. Push the `nextjs/` directory to a GitHub repository (or use the monorepo root with `nextjs` as the root directory setting in Vercel).
2. Import the project into Vercel. Set the root directory to `nextjs`.
3. Add all environment variables from `.env.local` in the Vercel project settings.
4. The build command is `prisma generate && next build` (already configured in `package.json`).
5. Run migrations once against the production database: `npx prisma db push` with the production `DATABASE_URL`.
6. Seed the production database if desired: `npx prisma db seed`.
