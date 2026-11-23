# DICT Logsheet Web Application (academic prototype)

## Goal
Replace a Google Sheets visitor logsheet and a separate Google Form (Online Client
Satisfaction Measurement, CSM) for DICT Camarines Norte Provincial Office with one
web app. Keep EVERY existing field and function, then add validation, roles, audit
log, analytics, forecast, export, and import.

## Stack
- Frontend: React (Vite) + Recharts, plain CSS or Tailwind
- Backend: Node.js + Express REST API (/api/...), zod for validation
- DB: PostgreSQL with plain SQL migrations in /server/migrations (use `pg`)
- Auth: bcrypt password hashes, JWT in httpOnly cookie, role middleware
- Security: helmet, cors config, express-rate-limit, parameterized queries only
- Monorepo: /client, /server, .env.example, README.md

## Roles
front_desk (log/search/correct/void visitors), reviewer (dashboards, CSM aggregates,
export), administrator (everything + users, lookups, import, audit log).

## Data entities
users, visitor_logs, csm_responses, lookup lists (purposes, offices external/internal,
regions, age_groups), audit_log, import_batches.
- visitor_logs: id, visit_date, name, gender, purpose, purpose_other, contact_number,
  created_by, created_at, updated_at, voided (boolean). Void, never hard-delete.
- csm_responses: id, response_date, age_group, sex, gender, region,
  service_type, office, created_at. No link to visitor_logs.
- audit_log: write a row for every create, edit, void, import, export.

## Existing-system fields (must be preserved exactly)
Visitor form: Date (defaults to today), Name (required), Gender (Male, Female,
optional Others), Purpose (PSA Appointment, eGovPH app Assistance, NBI Appointment,
SSS assistance, Others + short description), Contact number (PH mobile format
09XXXXXXXXX or +639XXXXXXXXX). One Save action (Enter also submits). No
"click outside the textbox" requirement.
Dashboard: month selector -> total, male, female, today's visitors.
CSM: Date, Age (18-25, 26-35, 36-45, 46-60, 60 and above (60 pataas)),
Sex (Male, Female, Prefer not to say), Gender (Masculine, Feminine, Non-Binary,
Prefer Not to Say, Other), Region (all 17 PH regions), Type of service
(External/Serbisyong Panlabas or Internal/Serbisyong Panloob), Office:
 External: Cybersecurity Bureau; Government Digital Transformation Bureau; ICT Literacy
 and Competency Development Bureau; Infostructure Management Bureau; Legal Service
 (External); Postal Regulation Division; Regional Office (External); Consumer
 Complaint Center.
 Internal: Administrative Service; Central Receiving and Releasing Unit; Finance
 Service; Legal Service (Internal); Management Information Systems Service;
 Procurement Service; Regional Offices (Internal).
Confidentiality text on the survey page: "This Client Satisfaction Measurement (CSM)
survey aims to track the client experience of government offices. Your answers will
enable this office to provide a better service. For privacy and security, rest
assured that all the information that you will share shall remain confidential."

## Rules
- Validate on client AND server. Reject out-of-list values.
- Contact numbers never appear in dashboards or exports; only roles that need
  them see them.
- Use only synthetic seed data (Filipino-style fake names, fake numbers). No real data.
- Small commits per feature. Keep files short and readable. Add comments only where
  needed. Do not add features not listed here.
- After each task: run the app/tests, report what works and what doesn't.
- Work on one task at a time. Before coding a task, give a short plan and wait for
  nothing; then implement it.

## Public visitor form (added after Sprint 2)
Landing page "/" is a public, write-only visitor form (POST /api/visitors/public,
rate-limited, honeypot, server forces today's Asia/Manila date). visitor_logs has a
`source` column ('public', 'staff', and later 'import'). Staff log in via the top-right
button. There must be no public GET, PATCH, or void endpoint.
