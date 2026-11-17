# DICT Camarines Norte — Logsheet Web App

Academic prototype replacing the DICT Camarines Norte visitor logsheet and the
separate Online Client Satisfaction Measurement (CSM) form with one web app.

- `client/` — React (Vite) frontend
- `server/` — Express REST API, PostgreSQL, JWT auth
- `server/migrations/` — plain SQL migrations
- `server/scripts/` — migration runner and seed script

## Prerequisites

- Node.js 20+ and npm
- PostgreSQL 14+

## Setup

```bash
npm install

# 1. Configure the environment
cp .env.example .env
# set JWT_SECRET to a long random string (32+ chars)

# 2. Create the database
createdb dict_logsheet

# 3. Migrate and seed
npm run migrate
npm run seed

# 4. Run both servers
npm run dev
```

Client: http://localhost:5173 — API: http://localhost:4000

The public visitor log is the client landing page at `/`. Staff sign in through the
`Staff Login` button to access the role-based visitor log or dashboard. Public
visitor submissions use `POST /api/visitors/public`, are rate-limited to 60
requests per IP every 15 minutes, and never expose saved records.

## Database connection

The server supports two connection modes. Pick one in `.env`.

**TCP connection** (works everywhere):

```dotenv
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dict_logsheet
```

**Local peer-auth socket** (Linux/macOS dev, no password):

```dotenv
DATABASE_SOCKET=/run/postgresql
DATABASE_NAME=dict_logsheet
DATABASE_USER=your_os_user
```

`DATABASE_URL` wins when both are set. Without `DATABASE_USER`, the OS user is used.
`TRUST_PROXY` controls Express proxy handling and should match the deployment
topology; use `false` when the app is not behind a trusted reverse proxy.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start API and client together |
| `npm run dev:server` | API only (`node --watch`) |
| `npm run dev:client` | Vite client only |
| `npm run migrate` | Apply pending SQL migrations |
| `npm run seed` | Seed lookups, demo users, and synthetic visitors |
| `npm test` | Create an isolated temporary PostgreSQL database, run migrations and synthetic seed, execute the Vitest/Supertest suite, then remove the database |
| `npm run build` | Production build of the client |

Verification scripts:

```bash
node server/scripts/verify-dashboard.js
node server/scripts/verify-forecast.js
node server/scripts/verify-export.js
```

The verification scripts use the configured development database. The automated
test suite uses a separate temporary database and never modifies development data.

## Demo accounts (development only)

The seed refuses to run when `NODE_ENV=production`. Passwords are for local
development only.

| Username | Role | Password |
| --- | --- | --- |
| `frontdesk` | front_desk | `Demo#2026` |
| `reviewer` | reviewer | `Demo#2026` |
| `admin` | administrator | `Demo#2026` |

Override the shared demo password with `SEED_DEMO_PASSWORD` before seeding. Quote it
if it contains `#` (dotenv treats an unquoted `#` as a comment).

## Notes

- All seed data is synthetic. Never load real visitor data into this prototype.
- Emails and contact numbers are stored server-side; they are never included in
  dashboard or export payloads.
- Public visitor entries are stored with `source = 'public'`, no staff creator,
  and a privacy-safe create audit record.
- Login, survey submissions, and public visitor submissions are rate-limited.
- CSV and PDF exports contain aggregate data only. Spreadsheet-formula prefixes
  are neutralized in CSV cells.
