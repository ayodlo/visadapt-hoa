# CommunityHQ

An HOA and community management platform for residents, board members, and admins — announcements, events, maintenance issues, architectural requests, violations & appeals, dues/payments, documents, polls, and role-based dashboards.

**The application lives in [`nextjs/`](nextjs/) — see [`nextjs/README.md`](nextjs/README.md) for full setup, demo credentials, and the API overview.**

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 (dark mode default, light/dark toggle) |
| Database | PostgreSQL 16 (Neon in production) |
| ORM | Prisma |
| Auth | JWT session cookies |
| Testing | Vitest (unit) + Playwright (e2e) |

## Quick start

```bash
cd nextjs
cp .env.example .env.local   # point DATABASE_URL at a local or Neon Postgres
npx prisma migrate dev
npx prisma db seed           # demo logins: admin@/board@/resident@communityhq.local, password123
npm run dev
```

## Deployment

Deploy on Vercel with the project **Root Directory set to `nextjs/`** (Settings → General). Set the environment variables from `nextjs/.env.example` in the Vercel dashboard; use a Neon `DATABASE_URL` in production.

## Repository history

The project began as a Vite + React client with an Express API (`client/` and `server/`, now removed) and was migrated to a single Next.js app. See `DEVLOG.md` and `nextjs/DEVLOG.md` for the running log.
