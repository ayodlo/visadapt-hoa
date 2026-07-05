# CommunityHQ (application)

This directory contains the Next.js application. **The full product documentation — features, roles, workflow rules, validation limits, security model, known limitations, API reference, and deployment — lives in the [repository root README](../README.md).**

Quick reference (run from this directory):

```bash
npm install
cp .env.example .env.local     # see root README for the variable table
npx prisma migrate deploy
npx prisma db seed             # demo logins: admin@/board@/resident@communityhq.local, password123
npm run dev                    # http://localhost:3000
```

```bash
npm test              # unit tests (Vitest)
npm run test:e2e      # e2e tests (Playwright)
npm run lint
npm run build
```

`DEVLOG.md` in this directory is the running engineering log. Read `AGENTS.md` before writing framework-touching code.
