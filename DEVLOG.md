# Dev Log

---

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
