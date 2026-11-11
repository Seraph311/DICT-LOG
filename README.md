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

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start API and client together |
| `npm run dev:server` | API only (`node --watch`) |
| `npm run dev:client` | Vite client only |
| `npm run migrate` | Apply pending SQL migrations |
| `npm run seed` | Seed lookups, demo users, and synthetic visitors |
| `npm run build` | Production build of the client |

## Demo accounts (development only)

The seed refuses to run when `NODE_ENV=production`. Passwords are for local
development only.

| Username | Role | Password |
| --- | --- | --- |
| `frontdesk` | front_desk | `Demo#2026` |
| `reviewer` | reviewer | `Demo#2026` |
| `admin` | administrator | `Demo#2026` |

Override the shared demo password with `SEED_DEMO_PASSWORD` before seeding.

## Notes

- All seed data is synthetic. Never load real visitor data into this prototype.
- Emails and contact numbers are stored server-side; they are never included in
  dashboard or export payloads.
