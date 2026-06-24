# CommunityHQ

An HOA and community management platform.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vite + React + TypeScript |
| Styling | Tailwind CSS |
| Routing | React Router v6 |
| Server state | TanStack Query v5 |
| Forms | React Hook Form + Zod |
| Backend | Express + TypeScript |
| Database | PostgreSQL 16 via Docker |
| ORM | Prisma |
| Auth | JWT (local dev) |
| Testing | Vitest |

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for PostgreSQL)
- npm >= 10 (comes with Node 20)

---

## First-time setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env if you need non-default values
cp .env server/.env
```

### 3. Start the database

```bash
docker compose up -d
```

### 4. Run Prisma migrations and generate the client

```bash
npm run db:generate
npm run db:migrate
```

When prompted for a migration name, enter something like `init`.

### 5. (Optional) Seed the database

```bash
npm run db:seed
# Creates admin@communityhq.local / password123
```

---

## Running the app

### Development (both client + server with hot reload)

```bash
npm run dev
```

- Client: http://localhost:5173
- API: http://localhost:3000
- Health check: http://localhost:3000/api/health

### Client only

```bash
npm run dev:client
```

### Server only

```bash
npm run dev:server
```

---

## Building for production

```bash
npm run build
```

Outputs:
- Server: `server/dist/`
- Client: `client/dist/`

---

## Testing

```bash
# All tests
npm test

# Client tests only
npm run test:client

# Server tests only
npm run test:server
```

---

## Database commands

| Command | Description |
|---------|-------------|
| `npm run db:generate` | Regenerate Prisma client after schema changes |
| `npm run db:migrate` | Create and run a new migration |
| `npm run db:seed` | Seed the database with initial data |
| `npm run db:reset` | Drop all data and re-run migrations |
| `npm run db:studio` | Open Prisma Studio in the browser |

---

## Project structure

```
/
├── client/                # Vite + React + TypeScript frontend
│   └── src/
│       ├── api/           # API client utility
│       ├── components/    # Shared reusable components
│       ├── features/      # Feature-scoped modules
│       ├── layouts/       # Page layout shells
│       ├── pages/         # Route-level page components
│       ├── routes/        # React Router configuration
│       ├── types/         # Shared TypeScript types
│       └── utils/         # Pure utility helpers
│
├── server/                # Express + TypeScript API
│   ├── prisma/            # Prisma schema, migrations, seed
│   └── src/
│       ├── controllers/   # Route handler functions
│       ├── middleware/     # Express middleware (auth, errors, etc.)
│       ├── routes/        # Express router definitions
│       ├── schemas/       # Zod validation schemas
│       ├── services/      # Business logic
│       └── utils/         # Utility helpers (prisma client, etc.)
│
├── docker-compose.yml     # PostgreSQL service
├── .env.example           # Environment variable template
└── package.json           # npm workspace root
```

---

## Linting and formatting

```bash
# Lint all packages
npm run lint

# Format all files
npm run format
```
