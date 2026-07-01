# CommunityHQ

HOA community management platform built with Next.js, Neon PostgreSQL, and Vercel.

## Tech Stack

- **Framework**: Next.js (App Router)
- **Database**: Neon (PostgreSQL) via Prisma
- **Auth**: JWT in httpOnly cookies
- **Email**: Resend
- **Storage**: AWS S3 (document uploads)
- **Hosting**: Vercel

## Local Development

### Prerequisites

- Node.js 20+
- A Neon database (or any PostgreSQL instance)

### Setup

```bash
cd nextjs
npm install
```

Create `nextjs/.env.local`:

```env
DATABASE_URL=postgresql://...
JWT_SECRET=your-local-secret-at-least-32-chars
JWT_EXPIRES_IN=7d
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional — required for document uploads
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AWS_S3_BUCKET=

# Optional — required for email features
RESEND_API_KEY=
EMAIL_FROM=noreply@yourdomain.com
```

### Database

```bash
# Run migrations
npx prisma migrate deploy

# Seed demo data
npx prisma db seed
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Authentication

JWT tokens are stored in an httpOnly cookie (`token`). All dashboard routes are protected server-side via the `getSession()` helper in `lib/auth.ts`. Unauthenticated requests are redirected to `/login`.

### Roles

| Role | Access |
|------|--------|
| `RESIDENT` | Read-only on most features; can submit maintenance requests |
| `BOARD_MEMBER` | Full access except user management |
| `ADMIN` | Full access including user role management |

All authenticated users share a single `/dashboard`. Role-based UI gating hides or shows controls depending on the user's role.

## Demo Credentials

All seeded accounts use the password: **`password123`**

| Role | Email |
|------|-------|
| Resident | `resident@communityhq.local` |
| Admin | `admin@communityhq.local` |
| Board Member | `board@communityhq.local` |

Demo account buttons on the login page fill these credentials automatically.

## Seed Data

The seed creates:
- 20 residents (including the demo resident account)
- 2 admins
- 3 board members
- 5 vendors
- 10 properties
- Sample announcements

## Testing

```bash
# Unit tests
npm test

# Lint + type-check
npm run lint
npx tsc --noEmit

# E2E (requires dev server)
npm run test:e2e
```

## Deployment

Deployed on Vercel. Environment variables are set in the Vercel dashboard. The Vercel project's **Root Directory** must be set to `nextjs`.
