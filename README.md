# TalentMatch AI — Backend

🇬🇧 English · [🇪🇸 Español](./README.es.md)

> B2B HR SaaS API that reads PDF CVs with the OpenAI API, scores each candidate against a job opening with a deterministic algorithm, and returns an explainable ranking for human review.

**Frontend repo:** [talentmatch-frontend](https://github.com/JosePerez0314/talentmatch-frontend)

**Stack:** Node.js · Express 5 · TypeScript · MySQL · Prisma · Zod · OpenAI API · Cloudinary · Docker

---

## What it does

- **Multi-tenant workspaces:** each recruiter/company manages an isolated space of Departments → Positions → Vacancies → Candidates.
- **JWT auth + RBAC:** `USER` and `ADMIN` roles; admin-only global stats and user management.
- **CV ingestion:** upload up to 100 PDF CVs per request; text is extracted, quality-checked, and structured by AI. Duplicate CVs are detected by SHA-256 hash and never re-processed.
- **Deterministic scoring (0–100):** the AI structures the profile, but never assigns the score.
- **Hiring workflow:** per-candidate application status with vacancy slot enforcement (a vacancy auto-closes when its slots are filled).
- **Dashboards:** per-tenant metrics for users, platform-wide metrics for admins.

## Architecture

```
Client ──► Express API ──► Prisma ──► MySQL
              │
              ├──► OpenAI API   (CV text → structured profile)
              └──► Cloudinary   (PDF storage)
```

Every request crosses the same layers, never skipping one:
`Route → Security (CORS/Helmet/rate limit) → Auth (JWT) → Zod validation → Controller → Service → Prisma`.

**CV flow:** upload PDF → SHA-256 dedup → text extraction (`pdf-parse`) → quality gate (< 500 chars rejected) → OpenAI structures the profile → PDF stored in Cloudinary → `Candidate` saved. Evaluation is a separate, explicit step (`POST /api/vacancies/:id/evaluations`) that scores the candidates and builds the ranking.

## Tech stack

| Category | Technology |
| --- | --- |
| Runtime / framework | Node.js 20.20.1, Express 5 |
| Language | TypeScript (strict; legacy JS being migrated) |
| Database / ORM | MySQL 8, Prisma |
| Validation | Zod |
| Auth | JWT + bcrypt |
| AI | OpenAI API |
| File storage | Cloudinary |
| Security | Helmet, CORS whitelist, `express-rate-limit` |
| Testing | Jest + Supertest |
| Infra | Docker (MySQL locally; full stack on the VPS) |

## Getting started

**Prerequisites:** Node.js `20.20.1`+, npm, Docker (used only for MySQL in local development).

```bash
git clone https://github.com/JosePerez0314/talentmatch-backend.git
cd talentmatch-backend
npm install
cp .env.example .env                                # then fill in the variables
docker compose -f docker-compose.local.yml up -d    # MySQL only
npx prisma generate && npx prisma migrate dev
npx prisma db seed                                  # optional: dev admin user + default departments
npm run dev
```

The API runs at `http://localhost:3000` (or your `PORT`).
> The seed creates a development admin account. Change its password in any non-local environment.

## Environment variables

Copy `.env.example` to `.env` in the project root. **Never commit it** — `.env`, `.env.production` and `.env.test` are git-ignored.

| Variable | What it is | Example |
| --- | --- | --- |
| `MYSQL_ROOT_PASSWORD` | Root password for the MySQL container (read by Docker Compose). | `<strong-password>` |
| `MYSQL_DATABASE` | Database name created on first boot. | `talentmatch` |
| `MYSQL_USER` | Application DB user created on first boot. | `talentmatch_user` |
| `MYSQL_PASSWORD` | Password for `MYSQL_USER`. | `<strong-password>` |
| `DATABASE_URL` | Prisma connection string. Locally the host port is `3307`. | `mysql://USER:PASSWORD@localhost:3307/DATABASE` |
| `NODE_ENV` | `development` or `production`. In production, 5xx responses hide internal error messages. | `development` |
| `PORT` | Port the API listens on. | `3000` |
| `JWT_SECRET` | Secret used to sign and verify JWTs. Use a long random string. | `<long-random-string>` |
| `OPENAI_API_KEY` | OpenAI key used to extract structured data from CVs. | `sk-...` |
| `CLOUDINARY_URL` | Cloudinary credential used to store CV PDFs. | `cloudinary://API_KEY:API_SECRET@CLOUD_NAME` |
| `ALLOWED_ORIGINS` | Comma-separated list of CORS-allowed frontend origins. | `http://localhost:5173` |

Test-runner flags (not needed to run the API): `RUN_EXTERNAL_TESTS` (enable tests that call OpenAI/Cloudinary) and `KEEP_TEST_DATA` (skip DB truncation between tests).

## API

All routes are under `/api`. Responses follow `{ success, data }`; paginated lists add `meta`. Full contract: [`docs/en/api-documentation.md`](./docs/en/api-documentation.md).

| Method | Route | What it does | Auth |
| --- | --- | --- | --- |
| POST | `/api/users` · `/api/users/login` | Register / log in | Public |
| GET·POST·PUT·DELETE | `/api/departments` | Department CRUD | JWT |
| GET·POST·PUT·DELETE | `/api/positions` | Position (job requirements) CRUD | JWT |
| POST | `/api/positions/complete` | Auto-fill a position from a job-description PDF | JWT |
| POST | `/api/positions/duplicate/:id` | Duplicate a position | JWT |
| GET·POST·PUT·DELETE | `/api/vacancies` | Vacancy CRUD | JWT |
| POST | `/api/vacancies/:id/upload` | Upload CV PDFs (up to 100, 5 MB each) | JWT |
| POST | `/api/vacancies/:id/evaluations` | Score pending candidates | JWT |
| GET | `/api/vacancies/:id/results` | Ranked results | JWT |
| PATCH | `/api/vacancies/:id/status` | Change vacancy status | JWT |
| PATCH | `/api/vacancies/:vacancyId/candidates/:candidateId/status` | Change a candidate's application status | JWT |
| GET | `/api/candidates` · `/api/candidates/:id` | Read candidates | JWT |
| GET | `/api/dashboard` | Per-user metrics | JWT |
| GET·PUT·DELETE | `/api/admin/stats` · `/users` · `/users/:id/role` · `/users/:id` | Global stats, user management | JWT + `ADMIN` |

## Database

Seven models in `prisma/schema.prisma`:

```
User ─┬─ Department ── Position ── Vacancy ─┬─ Application ── Candidate
      │                                      └─ MatchResult ── Candidate
      └─ (also owns Position, Vacancy, Candidate via userId)
```

- `User`, `Department`, `Position`, `Vacancy`, `Candidate` — every row carries a `userId` for tenant isolation.
- `Application` — links a candidate to a vacancy (status, unique per pair).
- `MatchResult` — the score and per-criterion breakdown, unique per candidate + vacancy.
- `Candidate` has `@@unique([userId, hash])` for per-tenant CV deduplication.

## Design decisions & tradeoffs

**AI structures, code scores.** The model only turns CV text into a structured profile; a pure function computes the score. This makes rankings reproducible and explainable and removes hallucinated scores. The cost: scoring quality depends on extraction quality, and rules must be coded by hand.

**Strict layered architecture.** Routes → validation → controllers → services → Prisma, with `app.ts` separated from `index.ts` so tests import the app without opening a port. More files than a quick CRUD, but each layer is testable and replaceable.

**Validate everything with Zod, at the edge.** `body`, `params` and `query` are parsed and coerced before any controller runs. It costs some boilerplate per resource, but invalid data never reaches the database.

**Multi-tenancy by `userId` column.** One shared database, every query filtered by the JWT's user id; cross-tenant access returns `404`, not `403`. Simple and cheap to operate, but isolation relies on every query remembering the filter (covered by tests).

**Bounded concurrency and per-file failure isolation.** CVs are processed with `p-limit(5)` so one bad PDF never blocks a batch of 100 and the OpenAI API isn't flooded. Throughput is capped by design.

**Explicit transactions where MySQL can't cascade.** Deleting a vacancy removes `MatchResult`, `Application` and `Candidate` in a `$transaction`, because InnoDB can't resolve the multi-path cascade. More code, but safe deletes.

## Scoring engine

Each candidate gets a 0–100 score computed from the AI-structured profile:

| Criterion | Weight |
| --- | --- |
| Hard skills | 30% |
| Experience | 20% |
| Role match | 15% |
| Languages | 15% |
| Education | 10% |
| Soft skills | 10% |

Skills, languages and soft skills are scored by the share of requirements the candidate meets. Experience is proportional to the required years, with one special rule: a candidate with strong personal projects is guaranteed at least half the experience points (a floor, never a penalty). Roles match if either title contains the other. A missing skill only costs its proportional share — there is no automatic disqualification. Details: [`docs/en/context/scoring-engine.md`](./docs/en/context/scoring-engine.md).

## Tests

Jest + Supertest against a dedicated `talentmatch_test` database. `npm test` always needs an explicit target:

```bash
npm test admin                                     # bare name -> admin.test.ts
npm test -- src/tests/routes/departments.test.ts   # full path
npm test departments -t "returns 201"              # single test
```

Tests that call OpenAI/Cloudinary are opt-in (the runner prompts, or use `--external`). A safety guard refuses to run unless `DATABASE_URL` contains `talentmatch_test`. See [`docs/en/backend-documentation.md`](./docs/en/backend-documentation.md) §18.

## Status

- **Done:** auth + RBAC, full CRUD, CV pipeline with dedup, scoring engine, slot enforcement, dashboards, automated tests, CI (type-check + tests) and containerized VPS deploy.
- **Missing:** OpenAPI/Swagger spec, test coverage reporting in CI, a mandatory-skill ("guillotine") rule in scoring.
- **Would do differently:** introduce `.env.example` and the test suite from day one, and finish the TypeScript migration earlier.

## Documentation

Full docs live in [`docs/`](./docs/) in English and Spanish: [backend architecture](./docs/en/backend-documentation.md), [API reference](./docs/en/api-documentation.md), [frontend changelog](./docs/en/changelog-frontend.md), [recent changes](./docs/en/last-changes.md). Contribution rules: [`CLAUDE.md`](./CLAUDE.md).

## Team

| Name | Role |
| --- | --- |
| **José Gabriel Pérez Calcaño** — [LinkedIn](https://www.linkedin.com/in/im-jose/) | Tech Lead. Architecture, complete backend, and supervision of the team's work. |
| Justin Antonio Sánchez Melo | Frontend |
| Bryam Smith Pérez Hernández | AI prompts and frontend support |

## License

ISC — see `package.json`.
