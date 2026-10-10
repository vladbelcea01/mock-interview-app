# Mock Interview Studio

A web app for preparing, running and reviewing **mock technical interviews**. Interviewers schedule practice sessions with participants, mark them completed, and record structured feedback: four skill scores, an overall rating, a recommendation, strengths and areas to improve. Dashboards and per-participant progress charts show whether practice is paying off.

| | |
|---|---|
| **Live app** | https://mock-interview-app-ochre.vercel.app |
| **API** | https://mock-interview-api.redsky-d5c93c1e.westeurope.azurecontainerapps.io/api/v1 |
| **API docs (Swagger)** | https://mock-interview-api.redsky-d5c93c1e.westeurope.azurecontainerapps.io/api/docs |
| **Architecture** | [docs/architecture.md](docs/architecture.md) |

**Demo accounts**

| Role | Email | Password |
|---|---|---|
| Interviewer (sees own sessions) | `interviewer@demo.dev` | `Demo123!` |
| Second interviewer | `maria@demo.dev` | `Demo123!` |
| Admin (sees everything) | `admin@demo.dev` | `Admin123!` |

> The API runs with one warm replica during the review period. If the first request is slow anyway, the database may be resuming from idle (Neon free tier); retry after a few seconds.

---

## Features

| Requirement | What the app does |
|---|---|
| **Interview management** | Create, view, edit, complete and cancel sessions (coding, system design, technical, behavioral). Lists are paginated and sortable, with filters for status, type, date range and title. Filters are kept in the URL, so a refresh or shared link shows the same view. |
| **Candidate tracking** | Shared participant directory (target role, seniority, notes). Each participant has a history timeline of their interviews. |
| **Feedback management** | One structured feedback record per completed session: overall rating plus problem solving, communication, technical depth and code quality (1–5), a recommendation, strengths, areas to improve, and a summary. |
| **Search & discovery** | A global search box covers participants (name/email), sessions (title) and feedback text, with a text snippet around each feedback match. Each list also has its own debounced search. |
| **Reporting** | The dashboard shows completed this month, upcoming in the next 7 days, sessions awaiting feedback, and the average rating. Charts show sessions per week, skill averages per week, recommendations and session types. Each participant page has a **progress chart** of skill scores across sessions. |
| **Auth & roles** | Email/password with JWT. **Interviewers** only see and act on their own sessions and feedback; **admins** see everything and get organisation-wide reports. |

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Angular 21 (standalone components, signals, lazy routes), Angular Material, Chart.js |
| Backend | NestJS 11 (TypeScript), Drizzle ORM + node-postgres, class-validator, Swagger, Passport-JWT, bcrypt, @nestjs/throttler, helmet |
| Database | PostgreSQL 16 with `pg_trgm` (Neon in production) |
| Testing | Jest + Supertest (API unit + e2e against a real Postgres), Vitest via the Angular CLI (web) |
| Delivery | Docker (multi-stage), GitHub Actions CI/CD, GitHub Container Registry, Azure Container Apps, Vercel |

## Repository layout

```
api/                  NestJS API (Dockerfile, drizzle/ SQL migrations, src/, test/)
web/                  Angular SPA (vercel.json for SPA routing)
docs/architecture.md  data model, data flow, deployment (Mermaid diagrams)
docs/deploy-azure.md  one-time Azure setup runbook
docs/superpowers/     design spec and implementation plan
docker-compose.yml    local Postgres (+ optional containerised API)
.github/workflows/    ci.yml, deploy.yml, seed.yml
```

## Running locally

**Prerequisites:** Node 22, Docker (or any local PostgreSQL 16).

```bash
# 1. Database
docker compose up -d db

# 2. API  →  http://localhost:3000/api/v1  (Swagger: /api/docs)
cd api
cp .env.example .env
npm ci
npm run db:migrate
npm run seed            # demo accounts + 8 weeks of sample interviews (wipes existing data)
npm run start:dev

# 3. Web  →  http://localhost:4200
cd ../web
npm ci
npm start
```

To run the API in a container too: `docker compose --profile full up --build`.

**Tests**

```bash
cd api && npm test            # unit tests (session rules, LIKE escaping)
cd api && npm run test:e2e    # 46 HTTP-level tests against a real Postgres (needs DATABASE_URL)
cd api && npm run lint:check
cd web && npx ng test --watch=false
```

## Design decisions

**Architecture**
- **Monorepo with two deployables.** The SPA and API change together during development but scale and deploy independently: static files go on a CDN, and the API runs in containers.
- **Modular monolith API.** There is one NestJS module per domain (auth, participants, sessions, feedback, search, reports, health). Each has controller → service → data access layers, which keeps responsibilities clear without the cost of microservices.
- **Business rules as pure functions.** Session status transitions and edit rules live in `session-rules.ts` and are unit-tested without a database. The HTTP behaviour is covered by e2e tests.

**Data and performance**
- **PostgreSQL.** The domain is relational (participants ↔ sessions ↔ feedback), needs integrity (one feedback per session, unique emails) and aggregate reporting. SQL fits better than a document store.
- **Drizzle ORM.** It gives type-safe queries, plain SQL migrations kept in the repo, and readable raw SQL for reports. It has no native engine binary, which keeps the Docker image small.
- **Aggregation in the database.** The dashboard uses `COUNT … FILTER`, `AVG` and a zero-filled `generate_series` of weeks, so only small result sets reach the browser.
- **Indexes chosen from the real queries.** Composite `(interviewer_id, scheduled_at)` and `(participant_id, scheduled_at)` indexes serve lists and history. GIN trigram indexes keep `ILIKE '%term%'` search fast at scale.
- **Server-side pagination everywhere,** with `pageSize` capped at 100.
- **Debounced search inputs** and **lazy-loaded routes** keep the UI responsive.

**Reliability**
- **Validation at the edge.** A global `ValidationPipe` uses a whitelist, rejects unknown fields and transforms types. DTOs trim and normalise input, for example lower-casing emails.
- **One error shape.** Every error returns `{ statusCode, error, message, path, timestamp }`. Postgres constraint errors map to `409` or `400` instead of `500`, and internals are never leaked.
- **Safe state transitions.** Completing or cancelling a session uses `UPDATE … WHERE status = 'SCHEDULED'`, so two concurrent clicks cannot both win.
- **Health endpoint with a DB ping.** It returns 503 when the database is unreachable and backs the Container Apps liveness and readiness probes.
- **Migrations run as a pipeline step before deploy,** not at container start. A broken migration stops the release instead of crash-looping replicas.

**Security**
- **Passwords** are hashed with bcrypt. Login returns one generic `Invalid credentials` message and runs a bcrypt comparison against a dummy hash for unknown emails, so neither the message nor the timing reveals which accounts exist.
- **JWT (HS256, 1 hour) sent as a Bearer header rather than a cookie.** The SPA (Vercel) and API (Azure) are on different sites, and third-party cookie blocking makes cross-site cookies unreliable. The trade-off is that a token in `sessionStorage` would be exposed by an XSS bug. That risk is mitigated by Angular's automatic output escaping, no use of `innerHTML`, and a short token lifetime.
- **Authorization in two layers.** A global JWT guard (opt-out with `@Public()`) plus a roles guard handle routes. **Ownership checks in the services** return **404 instead of 403** for other interviewers' data, so a session's existence is never confirmed.
- **Self-registration always creates `INTERVIEWER` accounts.** Admins are created by the seed or by an operator.
- **Hardening:** rate limiting on `/auth/*` (5 requests per minute per IP, with the proxy-aware client IP), `helmet` headers, a CORS allow-list from configuration, and secrets only in Container Apps and GitHub secrets.

**Delivery**
- **GHCR instead of Azure Container Registry.** It's free and lives next to the code. **Neon instead of Azure Database for PostgreSQL**: free, no firewall setup, and switching is only a connection-string change.
- **Vercel for the SPA:** global CDN and preview deployments per branch.

## Assumptions

- **The users are interviewers** (mentors, team leads, peers) who run mock interviews. **Participants are records, not logins.**
- The participant directory is shared by all interviewers. Sessions and feedback belong to the interviewer who ran them.
- A session has **at most one feedback record**, and it can only be recorded once the session is **completed**.
- Sessions can be created with a **past date**, to log interviews that already happened.
- Times are stored in UTC and shown in the browser's time zone. Weekly reports use ISO weeks in UTC.
- "Progress" means changes in the per-skill scores over a participant's completed sessions.

## Known limitations

- The JWT lives in `sessionStorage` and there are no refresh tokens, so users sign in again after an hour or in a new tab. There is no server-side token revocation.
- Rate-limit counters are in memory, so each API replica counts separately.
- The data model has no delete operations (by design, to keep history), and there is no audit log of who changed what.
- Offset pagination: very deep pages get slower, and concurrent inserts can shift pages.
- The progress chart and weekly reports use the scheduled date and UTC week boundaries.
- No end-to-end browser tests. UI logic is covered by component and unit tests.
- On the free database tier the first request after idling may take a few seconds while Neon resumes.

## Future improvements

- **Auth:**
  - refresh tokens in an httpOnly, SameSite cookie on a shared custom domain (or a BFF), plus token revocation
  - participant logins so candidates can read their own feedback
  - SSO (Entra ID)
- **Workflow:**
  - calendar invites and reminders
  - configurable feedback rubrics per interview type
  - question banks
  - CSV/PDF export
- **Scale:**
  - Redis for rate limiting and caching dashboard aggregates
  - cursor pagination
  - read replicas for reporting
  - OpenTelemetry tracing and dashboards
- **Delivery:**
  - OIDC federation from GitHub to Azure instead of a service-principal secret
  - infrastructure as code (Bicep/Terraform)
  - Playwright E2E tests in CI
  - Azure PostgreSQL with private networking
