# Mock Interview Practice App — Design Spec

**Date:** 2026-10-09 · **Author:** Vlad Belcea · **Deadline:** Sat 2026-10-10 12:00 EEST

## 1. Goal and success criteria

A web app that helps interviewers prepare, run and review mock technical interviews, and helps them see whether participants are improving over time.

Success means:
- Reviewers open a public URL, log in with a seeded demo account and walk through the full flow (create participant → schedule session → complete → record feedback → see it in reports and search) without errors.
- Every functional requirement in the assignment is covered.
- Each non-functional requirement (performance, scalability, reliability, security, maintainability) maps to a concrete, demonstrable decision.
- The repo shows Docker, a real cloud provider, CI/CD, tests and a clean Git workflow.

## 2. Assumptions

- **Users are interviewers** (mentors, team leads, peers). **Participants are records**, not logins.
- Two roles: `INTERVIEWER` (own sessions only) and `ADMIN` (everything, organisation-wide reports).
- Participants are a shared directory visible to every authenticated user.
- One feedback record per session; feedback only for completed sessions.
- Single time zone display (browser local); timestamps stored in UTC.
- Volume target for the demo: hundreds of sessions; design must not degrade at tens of thousands (indexes, server-side pagination, DB-side aggregation).

## 3. Stack

| Layer | Choice |
|---|---|
| Frontend | Angular (standalone components, signals), Angular Material, ng2-charts (Chart.js) |
| Backend | NestJS (TypeScript), Prisma ORM, class-validator, @nestjs/swagger, @nestjs/throttler, helmet |
| Database | PostgreSQL on Neon (free tier), `pg_trgm` extension |
| API hosting | Docker image on GHCR → Azure Container Apps (Consumption plan) |
| Frontend hosting | Vercel (Git integration) |
| CI/CD | GitHub Actions |
| Tests | Jest + Supertest (API), Angular unit tests (web) |
| **Fallback** | Same image on Render if Azure isn't serving `/health` via CI by ~00:30 |

## 4. Data model

```
User          id, email (unique), passwordHash, name, role (ADMIN|INTERVIEWER), createdAt, updatedAt
Participant   id, fullName, email (unique), targetRole, seniority (JUNIOR|MID|SENIOR),
              notes?, createdById → User, createdAt, updatedAt
InterviewSession
              id, title, type (CODING|SYSTEM_DESIGN|BEHAVIORAL|TECHNICAL), scheduledAt,
              durationMin, status (SCHEDULED|COMPLETED|CANCELLED), completedAt?, notes?,
              participantId → Participant, interviewerId → User, createdAt, updatedAt
Feedback      id, sessionId (unique) → InterviewSession, overallRating 1–5,
              problemSolving 1–5, communication 1–5, technicalDepth 1–5, codeQuality 1–5,
              recommendation (STRONG_HIRE|HIRE|NO_HIRE|STRONG_NO_HIRE),
              strengths, improvements, summary?, createdAt, updatedAt
```

**Business rules**
- Status transitions: `SCHEDULED → COMPLETED` (sets `completedAt`), `SCHEDULED → CANCELLED`. No other transitions.
- Completed/cancelled sessions: only `notes` stays editable.
- Feedback create/update only when status is `COMPLETED`.
- New sessions: `scheduledAt` may be in the past (for logging interviews already held) — validated only as a valid date; `durationMin` 15–240.
- Skill scores are fixed columns so trend queries stay simple SQL.

**Indexes**
- `InterviewSession(interviewerId, scheduledAt)`, `(participantId, scheduledAt)`, `(status)`
- GIN `pg_trgm` on `Participant.fullName`, `InterviewSession.title`, `Feedback.strengths`, `Feedback.improvements` (raw SQL migration) — search uses `ILIKE '%q%'`, which these indexes accelerate
- Unique on `User.email`, `Participant.email`, `Feedback.sessionId`

## 5. API (`/api/v1`, Swagger at `/api/docs`)

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Participants | `GET /participants?q&page&pageSize`, `POST`, `GET /:id`, `PATCH /:id`, `GET /:id/sessions` |
| Sessions | `GET /sessions?status&type&participantId&from&to&q&sort&order&page&pageSize`, `POST`, `GET /:id`, `PATCH /:id`, `POST /:id/complete`, `POST /:id/cancel` |
| Feedback | `PUT /sessions/:id/feedback`, `GET /sessions/:id/feedback` |
| Search | `GET /search?q=` → `{ participants[], sessions[], feedback[] }` (top 5 each) |
| Reports | `GET /reports/summary`, `GET /reports/trends?participantId&from&to` |
| Health | `GET /health` (includes DB ping) |

**Structure:** one Nest module per domain; controller (HTTP + DTOs) → service (rules, ownership) → `PrismaService`.

**Pagination:** `page` (default 1), `pageSize` (default 20, max 100); response `{ items, total, page, pageSize }`.

**Error shape:** `{ statusCode, error, message, path, timestamp }` via a global exception filter; Prisma `P2002 → 409`, `P2025 → 404`.

## 6. Security

- bcrypt password hashes (cost 10); JWT (HS256, 1 h) in `Authorization: Bearer`.
- Rationale for header over cookie: SPA and API are cross-site (Vercel vs Azure); third-party cookie blocking makes cross-site cookies unreliable. Trade-off (XSS exposure of a stored token) documented; future: refresh token in httpOnly cookie on a shared custom domain.
- Global `JwtAuthGuard` (opt-out via `@Public()`), `RolesGuard` with `@Roles()`.
- Ownership in services: interviewers get **404** for others' sessions (don't leak existence). Admin bypasses ownership.
- Global `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })`.
- Throttling on `/auth/*` (5 req/min/IP for login & register).
- helmet; CORS allow-list from `CORS_ORIGINS` env.
- Secrets (`DATABASE_URL`, `JWT_SECRET`) only as Container Apps secrets / GitHub secrets.
- Register always creates `INTERVIEWER`; `ADMIN` only via seed.

## 7. Reporting

All aggregation in Postgres (`COUNT … FILTER`, `AVG`, `date_trunc('week', …)`), scoped to the caller unless ADMIN.

- **Summary:** totals by status, completed this month, upcoming (next 7 days), pending feedback (completed without feedback), average overall rating, recommendation distribution, sessions by type, sessions per week (last 12 weeks), average skill scores per week (last 12 weeks).
- **Trends (per participant):** ordered list of completed sessions with the four skill scores and overall rating → progress chart.

## 8. Frontend

Routes (lazy-loaded): `/login`, `/register`, `/dashboard`, `/sessions`, `/sessions/new`, `/sessions/:id`, `/sessions/:id/edit`, `/participants`, `/participants/:id`, `/search?q=`.

- `authGuard` on everything except login/register.
- HTTP interceptor: attach token; 401 → logout + redirect; other errors → snackbar with the API message.
- Auth state in a signal-based `AuthService`; token in `sessionStorage`.
- Toolbar global search → `/search`.
- Dashboard: KPI cards + 4 charts. Participant detail: profile, session timeline, skill-progress line chart.
- Session detail: Complete / Cancel actions with confirm dialog; feedback form (sliders 1–5, recommendation select, strengths/improvements textareas).
- Responsive (Material + CSS grid), usable at 375 px.

## 9. Testing

- **API unit (Jest):** `SessionsService` transitions & ownership; `FeedbackService` only-if-completed; `ReportsService` scoping.
- **API integration (Supertest + real Postgres):** auth flow; create→complete→feedback happy path; interviewer cannot read another's session (404); validation 400; search & summary return expected shapes.
- **Web unit:** `authGuard`, auth interceptor, feedback form validation.
- Future: Playwright E2E, load tests.

## 10. Repo, CI/CD, deployment

```
/api   /web   /docs   docker-compose.yml   .github/workflows/{ci,deploy}.yml   README.md
```

- **Local:** `docker compose up -d db` (+ optional api service); `npm run start:dev` / `ng serve`; `npm run seed`.
- **Seed:** admin + interviewer demo accounts, ~6 participants, ~30 sessions over 8 weeks, scores trending upward.
- **ci.yml** (PR + push): api lint, typecheck, test (Postgres service container), build; web lint, test (headless), build.
- **deploy.yml** (push to `main`, after CI): build multi-stage image (Node 22 Alpine, non-root) → push `ghcr.io/<user>/mock-interview-api:<sha>` → `prisma migrate deploy` against Neon → `azure/container-apps-deploy-action`.
- **Container Apps:** 0.25 vCPU / 0.5 GiB, min replicas 1 during review, liveness/readiness probes on `/api/v1/health`, port 3000.
- **Web:** Vercel builds `/web`, `API_URL` injected at build via environment file; SPA rewrite to `index.html`.
- **Git workflow:** feature branches → PR → `main`, CI required.

## 11. Documentation deliverables

- `README.md`: overview, live URLs + demo credentials, setup, design decisions, assumptions, known limitations, future improvements.
- `docs/architecture.md`: Mermaid deployment/data-flow diagram, ER diagram, request-lifecycle diagram, deployment approach.

## 12. Out of scope (future improvements)

Participant logins, refresh tokens/httpOnly cookies, calendar invites, CSV/PDF export, real-time updates, Playwright E2E, OIDC for GitHub→Azure, Azure PostgreSQL / private networking, caching layer for reports, cursor pagination, audit log, i18n.
