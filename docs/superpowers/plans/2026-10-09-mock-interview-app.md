# Mock Interview Practice App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployed Angular + NestJS app for scheduling, completing and reviewing mock technical interviews, with search and progress reporting.

**Architecture:** Monorepo with `/api` (NestJS modules: controller → service → Prisma) and `/web` (Angular standalone SPA). API ships as a Docker image to GHCR and runs on Azure Container Apps; Postgres on Neon; SPA on Vercel. GitHub Actions runs tests, builds, migrates and deploys.

**Tech Stack:** Node 22, NestJS, Prisma 6, PostgreSQL 16 (+ `pg_trgm`), Jest + Supertest, Angular (latest CLI), Angular Material, ng2-charts, Docker, GitHub Actions, Azure Container Apps, Neon, Vercel.

**Spec:** `docs/superpowers/specs/2026-10-09-mock-interview-app-design.md`

## Global Constraints

- Node **22** everywhere (Dockerfile `node:22-alpine`, CI `actions/setup-node` `22`).
- Pin **`prisma@6` / `@prisma/client@6`** (avoid Prisma 7 config/adapter changes tonight).
- API listens on `0.0.0.0:${PORT:-3000}`; global prefix **`/api/v1`**; Swagger at **`/api/docs`**.
- Env vars: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN=1h`, `CORS_ORIGINS` (comma-separated), `PORT`.
- All IDs are UUIDs (`@default(uuid()) @db.Uuid`); path params use `ParseUUIDPipe`.
- Timestamps stored UTC.
- Pagination: `page` default 1, `pageSize` default 20, max 100 → response `{ items, total, page, pageSize }`.
- Error body: `{ statusCode, error, message, path, timestamp }`.
- Interviewers get **404** (never 403) for sessions/feedback they don't own. ADMIN bypasses ownership.
- `durationMin` 15–240; ratings/scores integers 1–5.
- Secrets never in the image or repo; `.env` is git-ignored, `.env.example` committed.
- Commit after every task with conventional commit messages, ending with the attribution lines:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01GNknxYx85RmtMLD3tfNKPt`.

## Review Focus

1. **Malformed IDs in URLs** (`/sessions/abc`) → 400, not a 500 stack trace. Test in Task 6.
2. **Interviewer probing another interviewer's data** via direct ID on session, feedback and participant trends → 404 / scoped results. Tests in Tasks 6, 7, 8.
3. **Search input with LIKE wildcards or tiny queries** (`%`, `_`, `"a"`) → wildcards escaped, `q` shorter than 2 chars → 400. Test in Task 8.
4. **Duplicate emails** (register twice, participant twice, any casing) → 409 with readable message; emails lower-cased before save. Tests in Tasks 4, 5.
5. **Database unreachable / Neon resuming** → `/health` returns 503 with `{ status: "error" }` instead of hanging; frontend shows a snackbar instead of a blank page. Test in Task 1.

---

## File Structure

```
api/
  Dockerfile, .dockerignore, .env.example
  prisma/schema.prisma, prisma/migrations/*, prisma/seed.ts
  src/main.ts                       bootstrap (prefix, helmet, CORS, pipes, filter, swagger)
  src/app.module.ts
  src/common/                       http-exception.filter.ts, pagination.dto.ts, decorators (public, roles, current-user)
  src/prisma/                       prisma.module.ts, prisma.service.ts
  src/health/                       health.controller.ts
  src/auth/                         auth.module/controller/service, jwt.strategy.ts, guards (jwt-auth, roles), dto/
  src/participants/                 module/controller/service, dto/
  src/sessions/                     module/controller/service, dto/
  src/feedback/                     module/controller/service, dto/
  src/search/                       module/controller/service
  src/reports/                      module/controller/service
  test/                             *.e2e-spec.ts, utils.ts (app factory, db reset, login helper)
web/
  vercel.json
  src/environments/environment(.development).ts
  src/app/app.routes.ts, app.config.ts
  src/app/core/                     auth.service.ts, auth.guard.ts, auth.interceptor.ts, api.models.ts, *-api.service.ts
  src/app/layout/                   shell.component.ts (toolbar + global search + nav)
  src/app/features/auth/            login, register
  src/app/features/dashboard/       dashboard.component.ts
  src/app/features/sessions/        list, detail, form, feedback-form
  src/app/features/participants/    list, detail, form-dialog
  src/app/features/search/          search.component.ts
docker-compose.yml
.github/workflows/ci.yml, deploy.yml
docs/architecture.md
README.md
```

---

### Task 1: API skeleton, health check, Docker

**Files:**
- Create: `api/` via `npx @nestjs/cli new api --package-manager npm --skip-git --strict`
- Create: `api/src/prisma/prisma.service.ts`, `prisma.module.ts` (global), `api/src/health/health.controller.ts`, `api/src/common/http-exception.filter.ts`, `api/prisma/schema.prisma` (datasource + generator only), `api/Dockerfile`, `api/.dockerignore`, `api/.env.example`, `docker-compose.yml`, `.gitignore`
- Modify: `api/src/main.ts`, `api/src/app.module.ts`
- Test: `api/test/health.e2e-spec.ts`, `api/test/utils.ts`

**Interfaces:**
- Produces: `PrismaService extends PrismaClient` (with `onModuleInit` connect); `configureApp(app: INestApplication): void` in `src/app.setup.ts` (called by `main.ts`); `createTestApp(): Promise<INestApplication>` in `test/utils.ts`, which calls `configureApp` so tests run with the exact production setup.
- Produces: `GET /api/v1/health` → `200 { status: "ok", db: "up" }` or `503 { status: "error", db: "down" }`.

- [ ] **Step 1:** Scaffold Nest, install `@nestjs/config @nestjs/swagger helmet class-validator class-transformer prisma@6 @prisma/client@6`. `docker-compose.yml` with `db` service `postgres:16-alpine` on 5432 (`POSTGRES_USER=app POSTGRES_PASSWORD=app POSTGRES_DB=interviews`), healthcheck, named volume; plus an `api` service building `./api` (profile `full`).
- [ ] **Step 2: Write failing test** `health.e2e-spec.ts`: `GET /api/v1/health` → 200, body `{ status: "ok", db: "up" }`; with `PrismaService.$queryRaw` mocked to reject → 503, body `status: "error"`.
- [ ] **Step 3:** Run `npm run test:e2e -- health` → FAIL (404).
- [ ] **Step 4:** Implement `configureApp` in `src/app.setup.ts`: `setGlobalPrefix('api/v1')`, `helmet()`, `enableCors({ origin: CORS_ORIGINS.split(',') })`, `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`, `HttpExceptionFilter` (also maps Prisma `P2002`→409, `P2025`→404, unknown→500 without leaking internals), Swagger at `api/docs` with bearer auth. Health controller runs `SELECT 1` with a 3 s timeout (`Promise.race`), throws `ServiceUnavailableException` on failure.
- [ ] **Step 5:** Run tests → PASS. `docker compose up -d db` first.
- [ ] **Step 6:** Multi-stage `Dockerfile`: `deps` (npm ci) → `build` (prisma generate + nest build) → `runtime` (`node:22-alpine`, `NODE_ENV=production`, prod deps + generated client + `dist` + `prisma/`, `USER node`, `EXPOSE 3000`, `CMD ["node","dist/main.js"]`). Verify: `docker build -t api ./api && docker run --rm -p 3000:3000 -e DATABASE_URL=... api` → `curl localhost:3000/api/v1/health` returns 200.
- [ ] **Step 7:** Commit `feat(api): skeleton with health check, error filter and Dockerfile`.

### Task 2: CI/CD and first Azure deployment (DEADLINE-RISK GATE)

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `docs/deploy-azure.md` (the exact commands Vlad ran)

**Interfaces:**
- Consumes: `api/Dockerfile`, `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build`.
- Produces: secrets `AZURE_CREDENTIALS`, `DATABASE_URL` (Neon), env names `RESOURCE_GROUP=rg-mock-interviews`, `CONTAINER_APP=mock-interview-api`; image `ghcr.io/<owner>/mock-interview-api:<sha>`.

- [ ] **Step 1 (Vlad, local):** Create GitHub repo `mock-interview-app`, push. Create Neon project → copy pooled connection string with `sslmode=require`.
- [ ] **Step 2 (Vlad, local):** `az login`; `az extension add --name containerapp --upgrade`; `az provider register --namespace Microsoft.App --wait`; same for `Microsoft.OperationalInsights`; list allowed regions (command in research report) and pick a European one → `$LOC`.
- [ ] **Step 3: `ci.yml`** on `pull_request` and `push`: job `api` with `services.postgres` (`postgres:16-alpine`, health-cmd `pg_isready`), env `DATABASE_URL=postgresql://app:app@localhost:5432/interviews`, `JWT_SECRET=test`; steps: checkout, setup-node 22 with npm cache (`api/package-lock.json`), `npm ci`, `npx prisma migrate deploy`, `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run test:e2e`, `npm run build`. (Job `web` added in Task 10.)
- [ ] **Step 4: `deploy.yml`** on `workflow_run` of CI completed on `main` with `conclusion == 'success'`; `permissions: packages: write, contents: read`; steps: docker login ghcr with `GITHUB_TOKEN` → `docker/build-push-action` tag `${{ github.sha }}` → `npx prisma migrate deploy` (in `api/`, `DATABASE_URL` from secret) → `azure/login@v2` with `AZURE_CREDENTIALS` → `azure/container-apps-deploy-action@v1` (`imageToDeploy`, `containerAppName`, `resourceGroup`, `registryUrl: ghcr.io`).
- [ ] **Step 5 (Vlad, local):** push, make GHCR package public, then first create:
  `az containerapp up -n mock-interview-api -g rg-mock-interviews -l $LOC --image ghcr.io/<owner>/mock-interview-api:<sha> --ingress external --target-port 3000 --env-vars NODE_ENV=production CORS_ORIGINS=http://localhost:4200 JWT_EXPIRES_IN=1h`
  then `az containerapp registry set ... --server ghcr.io`, `az containerapp secret set ... --secrets database-url=<neon> jwt-secret=<random 48 bytes>`, `az containerapp update ... --set-env-vars DATABASE_URL=secretref:database-url JWT_SECRET=secretref:jwt-secret --min-replicas 1 --max-replicas 2 --cpu 0.25 --memory 0.5Gi`, add HTTP liveness/readiness probes on `/api/v1/health`. Create SP: `az ad sp create-for-rbac --name gh-mock-interviews --role contributor --scopes /subscriptions/<id>/resourceGroups/rg-mock-interviews --json-auth` → GitHub secret `AZURE_CREDENTIALS`.
- [ ] **Step 6: Verify:** push a trivial commit → CI green → deploy green → `curl https://<fqdn>/api/v1/health` returns `{"status":"ok","db":"up"}` and the Container App shows a new revision with the new SHA.
- [ ] **Step 7: DECISION POINT.** If Step 6 isn't green by ~00:30 EEST: create a Render web service from the GHCR image, env vars as above, replace the last two deploy steps with `curl -X POST ${{ secrets.RENDER_DEPLOY_HOOK }}`. Note the switch in `docs/deploy-azure.md`.
- [ ] **Step 8:** Commit `ci: add CI pipeline and Azure Container Apps deployment`.

### Task 3: Data model and migrations

**Files:**
- Modify: `api/prisma/schema.prisma`
- Create: `api/prisma/migrations/<ts>_init/migration.sql` (generated), `api/prisma/migrations/<ts>_search_indexes/migration.sql` (hand-written)
- Test: `api/test/schema.e2e-spec.ts`

**Interfaces:**
- Produces Prisma models/enums exactly per spec §4: `User`, `Participant`, `InterviewSession`, `Feedback`; enums `Role {ADMIN, INTERVIEWER}`, `Seniority {JUNIOR, MID, SENIOR}`, `SessionType {CODING, SYSTEM_DESIGN, BEHAVIORAL, TECHNICAL}`, `SessionStatus {SCHEDULED, COMPLETED, CANCELLED}`, `Recommendation {STRONG_HIRE, HIRE, NO_HIRE, STRONG_NO_HIRE}`. Relations: `InterviewSession.feedback Feedback?` (`onDelete: Cascade` on Feedback.session), `Participant.sessions`, `User.sessions` (relation name `Interviewer`).
- Indexes: `@@index([interviewerId, scheduledAt])`, `@@index([participantId, scheduledAt])`, `@@index([status])`.

- [ ] **Step 1: Failing test:** after migrate, `SELECT extname FROM pg_extension` contains `pg_trgm`; `pg_indexes` contains `participant_fullname_trgm_idx`, `session_title_trgm_idx`, `feedback_strengths_trgm_idx`, `feedback_improvements_trgm_idx`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Write schema; `npx prisma migrate dev --name init`; `npx prisma migrate dev --create-only --name search_indexes` and fill with `CREATE EXTENSION IF NOT EXISTS pg_trgm;` + four `CREATE INDEX ... USING gin (<col> gin_trgm_ops)`; apply.
- [ ] **Step 4:** Run → PASS. Add `test/utils.ts` `resetDb(prisma)` (TRUNCATE all four tables CASCADE).
- [ ] **Step 5:** Commit `feat(api): data model, migrations and trigram search indexes`.

### Task 4: Auth (register, login, me, guards, throttling)

**Files:**
- Create: `api/src/auth/{auth.module,auth.controller,auth.service,jwt.strategy}.ts`, `api/src/auth/guards/{jwt-auth.guard,roles.guard}.ts`, `api/src/common/decorators/{public,roles,current-user}.decorator.ts`, `api/src/auth/dto/{register.dto,login.dto}.ts`
- Test: `api/src/auth/auth.service.spec.ts`, `api/test/auth.e2e-spec.ts`; add `loginAs(app, email, password): Promise<string>` and `createUser(prisma, {role})` to `test/utils.ts`

**Interfaces:**
- Produces: `AuthUser = { id: string; email: string; name: string; role: Role }` (in `auth/auth-user.ts`); `@CurrentUser() user: AuthUser`; `@Public()`; `@Roles(Role.ADMIN)`; global guards registered as `APP_GUARD` (JwtAuthGuard then RolesGuard; ThrottlerGuard).
- Endpoints: `POST /auth/register {email, password (min 8), name}` → `201 { accessToken, user }`; `POST /auth/login {email, password}` → `200 { accessToken, user }`; `GET /auth/me` → `AuthUser`.

- [ ] **Step 1: Failing tests (e2e):** register → 201 and role `INTERVIEWER` even if body contains `role: "ADMIN"` (→ 400 because forbidNonWhitelisted); register `Vlad@Example.com` then `vlad@example.com` → 409; login wrong password → 401 `"Invalid credentials"` (same message for unknown email); `/auth/me` without token → 401; with tampered token → 401; 6th login within a minute → 429.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement with `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `bcrypt` (cost 10), `@nestjs/throttler` (`@Throttle({ default: { limit: 5, ttl: 60000 } })` on register/login). Lower-case + trim emails in DTO via `@Transform`. Never return `passwordHash`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(api): JWT auth with roles and login throttling`.

### Task 5: Participants

**Files:**
- Create: `api/src/participants/{module,controller,service}.ts`, `dto/{create-participant,update-participant,query-participants}.dto.ts`; `api/src/common/pagination.dto.ts` (`PaginationQueryDto { page=1; pageSize=20 (Max 100) }`, `Paginated<T>`)
- Test: `api/test/participants.e2e-spec.ts`

**Interfaces:**
- Produces: `ParticipantsService.findAll(q: QueryParticipantsDto): Promise<Paginated<Participant>>`, `findOne(id)`, `create(dto, user: AuthUser)`, `update(id, dto)`.
- Endpoints per spec §5; `GET /participants/:id/sessions` is implemented in Task 6 (needs sessions scoping) — controller route lives in `SessionsController` as `GET /participants/:id/sessions`.
- `q` matches `fullName` or `email` with `contains`, `mode: 'insensitive'`; order `fullName asc`.

- [ ] **Step 1: Failing tests:** create → 201; duplicate email (different case) → 409; invalid seniority → 400; list with `q=ana` returns only matches and `total` correct; `pageSize=500` → 400; `GET /participants/not-a-uuid` → 400.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS.
- [ ] **Step 5:** Commit `feat(api): participants CRUD with search and pagination`.

### Task 6: Interview sessions (CRUD, transitions, ownership, filters)

**Files:**
- Create: `api/src/sessions/{module,controller,service}.ts`, `dto/{create-session,update-session,query-sessions}.dto.ts`
- Test: `api/src/sessions/sessions.service.spec.ts` (Prisma mocked), `api/test/sessions.e2e-spec.ts`

**Interfaces:**
- Produces: `SessionsService.findAll(q: QuerySessionsDto, user): Promise<Paginated<SessionListItem>>` where `SessionListItem` includes `participant {id, fullName}`, `interviewer {id, name}`, `hasFeedback: boolean`; `findOneOwned(id: string, user: AuthUser): Promise<InterviewSession>` (throws `NotFoundException` when missing **or** not owned and user isn't ADMIN — reused by Feedback); `create(dto, user)`, `update(id, dto, user)`, `complete(id, user)`, `cancel(id, user)`, `findByParticipant(participantId, user)`.
- `QuerySessionsDto`: `status?`, `type?`, `participantId?` (uuid), `from?`/`to?` (ISO date), `q?` (title, case-insensitive contains), `sort?: 'scheduledAt'|'createdAt'|'title'` (default `scheduledAt`), `order?: 'asc'|'desc'` (default `desc`), pagination.
- `create`: `interviewerId = user.id` always; participant must exist (404 otherwise).

- [ ] **Step 1: Failing unit tests:** `complete` on SCHEDULED sets status + `completedAt`; `complete` on COMPLETED or CANCELLED → `ConflictException('Session is already completed'/'... cancelled')`; `cancel` on COMPLETED → 409; `update` of a COMPLETED session with fields other than `notes` → 409.
- [ ] **Step 2: Failing e2e tests:** interviewer A creates session; interviewer B `GET /sessions/:id` → 404, `PATCH` → 404, `POST /complete` → 404; B's list excludes A's session; ADMIN sees both; `durationMin: 10` → 400; `GET /sessions/123` → 400; filter `status=COMPLETED&from=...&to=...` returns correct subset; `GET /participants/:id/sessions` returns caller-scoped history ordered `scheduledAt desc`.
- [ ] **Step 3–5:** Run → FAIL; implement; run → PASS.
- [ ] **Step 6:** Commit `feat(api): interview sessions with status transitions and ownership`.

### Task 7: Feedback

**Files:**
- Create: `api/src/feedback/{module,controller,service}.ts`, `dto/upsert-feedback.dto.ts`
- Test: `api/test/feedback.e2e-spec.ts`

**Interfaces:**
- Consumes: `SessionsService.findOneOwned`.
- Produces: `FeedbackService.upsert(sessionId, dto, user): Promise<Feedback>`, `get(sessionId, user): Promise<Feedback>` (404 if none). Routes `PUT|GET /sessions/:id/feedback` (`PUT` → 200 both on create and update).
- DTO: `overallRating, problemSolving, communication, technicalDepth, codeQuality` (`@IsInt @Min(1) @Max(5)`), `recommendation` (enum), `strengths`, `improvements` (`@IsString @MinLength(3) @MaxLength(4000)`), `summary?` (max 4000).

- [ ] **Step 1: Failing tests:** PUT on SCHEDULED session → 409 `"Feedback can only be recorded for completed sessions"`; on COMPLETED → 200, second PUT updates (still one row); score `6` → 400; other interviewer GET/PUT → 404.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(api): feedback recording for completed sessions`.

### Task 8: Search and reports

**Files:**
- Create: `api/src/search/{module,controller,service}.ts`, `api/src/reports/{module,controller,service}.ts`, `api/src/common/escape-like.ts`
- Test: `api/src/common/escape-like.spec.ts`, `api/test/search.e2e-spec.ts`, `api/test/reports.e2e-spec.ts`

**Interfaces:**
- Produces: `escapeLike(s: string): string` (escapes `\`, `%`, `_`).
- `GET /search?q=` (`q` 2–100 chars) → `{ participants: {id, fullName, email}[], sessions: {id, title, scheduledAt, status, participantName}[], feedback: {sessionId, sessionTitle, participantName, snippet}[] }`, max 5 each, sessions/feedback scoped to caller unless ADMIN. Uses `$queryRaw` with `ILIKE '%' || ${escaped} || '%' ESCAPE '\'`.
- `GET /reports/summary` → `{ totals: {scheduled, completed, cancelled}, completedThisMonth, upcomingNext7Days, pendingFeedback, avgOverallRating: number|null, byRecommendation: {recommendation, count}[], byType: {type, count}[], sessionsPerWeek: {week: string /*ISO date*/, count}[] /*last 12 weeks, zero-filled*/, skillsPerWeek: {week, problemSolving, communication, technicalDepth, codeQuality}[] }`.
- `GET /reports/trends?participantId=<uuid>&from?&to?` → `{ participant: {id, fullName}, points: {sessionId, title, scheduledAt, overallRating, problemSolving, communication, technicalDepth, codeQuality}[] }` ordered `scheduledAt asc`, only COMPLETED with feedback, scoped to caller unless ADMIN.
- All aggregates in SQL (`COUNT(*) FILTER`, `AVG`, `date_trunc('week', ...)`, `generate_series` for zero-fill); numeric AVG cast to `float8` and rounded to 2 decimals.

- [ ] **Step 1: Failing tests:** `escapeLike('50%_off\\')` → `'50\\%\\_off\\\\'`; search `q=a` → 400; search `q=%` returns no rows when nothing contains a literal `%`; search finds a participant by partial name and a feedback row by a word in `improvements`; interviewer B's search never returns A's sessions/feedback; summary for a fixture of 3 completed (ratings 3,4,5), 1 scheduled next 3 days, 1 completed without feedback → `avgOverallRating 4`, `pendingFeedback 1`, `upcomingNext7Days 1`, `sessionsPerWeek.length 12`; trends for A's participant called by B → `points: []`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(api): global search and SQL-aggregated reports`.

### Task 9: Seed data

**Files:**
- Create: `api/prisma/seed.ts`; Modify: `api/package.json` (`"prisma": { "seed": "ts-node prisma/seed.ts" }`, script `"seed"`)

**Interfaces:**
- Produces demo accounts (also in README): `admin@demo.dev / Admin123!` (ADMIN), `interviewer@demo.dev / Demo123!` and `maria@demo.dev / Demo123!` (INTERVIEWER).
- Data: 6 participants (mixed seniority/roles), ~30 sessions spread over the past 8 weeks + 4 upcoming, mixed types; ~85% of past sessions completed, 2 cancelled, 2 completed without feedback; per participant, skill scores trend upward over time (deterministic, no `Math.random` — use a seeded formula so demos are reproducible); realistic strengths/improvements text.

- [ ] **Step 1:** Implement idempotent seed (`deleteMany` in FK order, then create).
- [ ] **Step 2: Verify:** `npm run seed` twice without error; `GET /reports/summary` as admin shows non-zero `sessionsPerWeek` across ≥6 weeks and `pendingFeedback 2`.
- [ ] **Step 3:** Run seed against Neon (`DATABASE_URL=<neon> npm run seed`); verify live `/api/v1/auth/login` works with the demo account.
- [ ] **Step 4:** Commit `feat(api): deterministic demo seed data`.

### Task 10: Web skeleton, auth flow, Vercel deploy

**Files:**
- Create: `web/` via `npx @angular/cli@latest new web --routing --style=scss --ssr=false --skip-git`; `ng add @angular/material`; install `ng2-charts chart.js`
- Create: `web/src/environments/*`, `web/src/app/core/{api.models,auth.service,auth.guard,auth.interceptor}.ts`, `web/src/app/layout/shell.component.ts`, `web/src/app/features/auth/{login,register}.component.ts`, `web/vercel.json`
- Modify: `web/src/app/app.routes.ts`, `app.config.ts`, `.github/workflows/ci.yml` (add `web` job: npm ci, lint if configured, `npm test -- --watch=false` headless, `npm run build`)
- Test: `auth.guard.spec.ts`, `auth.interceptor.spec.ts`

**Interfaces:**
- Produces: `environment.apiUrl` (prod: `https://<fqdn>/api/v1`; dev: `http://localhost:3000/api/v1`). `api.models.ts` mirrors API types (`AuthUser`, `Participant`, `Session`, `SessionListItem`, `Feedback`, `Paginated<T>`, `Summary`, `Trends`, `SearchResults`, enums as string unions).
- `AuthService`: signals `user()`, `isLoggedIn()`, `isAdmin()`; `login(email, pw): Observable<void>`, `register(...)`, `logout(): void` (clears `sessionStorage['token']`, navigates `/login`), `token(): string | null`; restores session on startup via `GET /auth/me`.
- `authGuard: CanActivateFn` → `UrlTree('/login')` when logged out. `authInterceptor: HttpInterceptorFn` → adds Bearer; on 401 → `logout()`; on status 0 → snackbar "Cannot reach the server — it may be waking up, try again in a few seconds"; other errors → snackbar with `error.message`.
- Shell: toolbar (app name, global search input → `/search?q=`, user menu with role badge + logout), side nav (Dashboard, Sessions, Participants). Routes lazy-load feature components; default redirect `/dashboard`.

- [ ] **Step 1: Failing tests:** guard returns UrlTree `/login` when logged out, `true` when logged in; interceptor adds header when token present, calls `logout` on 401.
- [ ] **Step 2–4:** FAIL → implement → PASS (`npm test -- --watch=false`).
- [ ] **Step 5:** `vercel.json` `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`. Vercel project: root `web`, build `npm run build`, output `dist/web/browser`. Add Vercel URL to Container Apps `CORS_ORIGINS` (`az containerapp update --set-env-vars CORS_ORIGINS=https://<app>.vercel.app,http://localhost:4200`).
- [ ] **Step 6: Verify:** on the live Vercel URL, log in as `interviewer@demo.dev`, refresh page stays logged in, deep link `/sessions` refresh works (no 404), logout returns to `/login`.
- [ ] **Step 7:** Commit `feat(web): Angular shell, auth flow and Vercel deployment`.

### Task 11: Participants UI

**Files:**
- Create: `web/src/app/core/participants-api.service.ts`, `web/src/app/features/participants/{participant-list,participant-detail,participant-form-dialog}.component.ts`
- Test: `participant-form-dialog.component.spec.ts`

**Interfaces:**
- Consumes: `api.models.ts`, endpoints from Tasks 5, 6, 8 (`/participants/:id/sessions`, `/reports/trends`).
- `ParticipantsApi`: `list(q, page, pageSize)`, `get(id)`, `create(dto)`, `update(id, dto)`, `sessions(id)`, `trends(id)`.
- List: Material table, debounced (300 ms) search, paginator, "New participant" opens dialog. Detail: profile card + edit, session timeline (status chip, link to session), **progress line chart** (5 series: overall + 4 skills, y 1–5) with an empty state "No completed sessions with feedback yet".

- [ ] **Step 1: Failing test:** form invalid with bad email or empty name; valid form emits trimmed values.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Verify** in browser against local API with seed data: search, create (duplicate email shows API 409 message), detail chart renders.
- [ ] **Step 6:** Commit `feat(web): participants list, detail and progress chart`.

### Task 12: Sessions UI and feedback form

**Files:**
- Create: `web/src/app/core/sessions-api.service.ts`, `web/src/app/features/sessions/{session-list,session-detail,session-form,feedback-form}.component.ts`, `web/src/app/shared/confirm-dialog.component.ts`
- Test: `feedback-form.component.spec.ts`

**Interfaces:**
- `SessionsApi`: `list(query)`, `get(id)`, `create(dto)`, `update(id, dto)`, `complete(id)`, `cancel(id)`, `getFeedback(id)`, `saveFeedback(id, dto)`.
- List: server-side `MatTable` + `MatSort` + `MatPaginator`; filters status/type/date range/text (debounced); query params reflected in the URL so filters survive refresh.
- Form: create/edit, participant autocomplete (calls participants list with `q`), type select, datetime, duration (15–240), notes; on COMPLETED/CANCELLED sessions only notes editable.
- Detail: info, status chip, buttons Complete / Cancel (confirm dialog) visible only when SCHEDULED; feedback section: form when COMPLETED (prefilled if exists), read-only view otherwise; "pending feedback" hint when completed without feedback.

- [ ] **Step 1: Failing test:** feedback form invalid when any score missing or strengths < 3 chars; submit emits integers 1–5 and selected recommendation.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Verify** happy path in browser: create → complete → save feedback → reload shows feedback; trying to edit title on completed session isn't possible.
- [ ] **Step 6:** Commit `feat(web): sessions management and feedback form`.

### Task 13: Dashboard and search page

**Files:**
- Create: `web/src/app/core/reports-api.service.ts`, `web/src/app/features/dashboard/dashboard.component.ts`, `web/src/app/features/search/search.component.ts`

**Interfaces:**
- Consumes `GET /reports/summary`, `GET /search`.
- Dashboard: 5 KPI cards (completed this month, upcoming 7 days, pending feedback, avg rating, total completed); charts: sessions per week (line), skill averages per week (multi-line, y 1–5), recommendations (bar), by type (bar); admin sees label "Organisation-wide", interviewer "Your interviews"; loading skeleton + empty state.
- Search: reads `q` from query params, three result groups with links; message for `q` < 2 chars instead of calling the API.

- [ ] **Step 1: Verify** with seed data locally: all charts render with data, search for a participant first name and a word from feedback returns grouped links; at 375 px width layout stacks without horizontal scroll.
- [ ] **Step 2:** Commit `feat(web): reporting dashboard and global search`.

### Task 14: Documentation

**Files:**
- Create: `README.md`, `docs/architecture.md`; Modify: `docs/deploy-azure.md`

**Interfaces:** none.

- [ ] **Step 1:** `README.md` sections: Overview (+ live URLs, Swagger URL, demo credentials), Features, Tech stack, Local setup (prereqs, `docker compose up -d db`, `.env`, migrate, seed, run api/web, tests), Design decisions (each NFR → concrete decision, incl. header-vs-cookie, 404-vs-403, SQL aggregation, trigram indexes, GHCR vs ACR, Neon vs Azure Postgres, migrations as pipeline step), Assumptions (spec §2), Known limitations, Future improvements (spec §12).
- [ ] **Step 2:** `docs/architecture.md`: Mermaid `flowchart` (Browser → Vercel SPA → Container Apps API → Neon; GitHub → Actions → GHCR → Container Apps), Mermaid `erDiagram`, Mermaid `sequenceDiagram` for "save feedback" (interceptor → guard → ValidationPipe → controller → service ownership/status check → Prisma → Postgres → filter on error), deployment approach and scaling notes (replicas 1–2, stateless API, connection pooling via Neon pooler).
- [ ] **Step 3: Verify:** Mermaid renders on GitHub (open the files in the repo web UI).
- [ ] **Step 4:** Commit `docs: README and architecture overview`.

### Task 15: Final verification and submission prep

- [ ] **Step 1:** All CI green on `main`; latest revision live.
- [ ] **Step 2:** Incognito walkthrough on live URL as interviewer and as admin: login → dashboard → create participant → schedule session → complete → feedback → participant progress chart updates → search finds it → logout. Interviewer cannot see `maria@demo.dev`'s sessions.
- [ ] **Step 3:** Confirm `minReplicas=1` (no cold start for reviewers); `/api/docs` loads.
- [ ] **Step 4:** Tag `v1.0.0`; draft the reply email with repo URL, live URL, demo credentials, architecture doc link.
