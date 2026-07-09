# TalentMatch AI — Backend

> A REST API that automates candidate screening and evaluation for HR teams: it extracts data from PDF CVs with AI, mathematically compares it against a vacancy's requirements, and returns a candidate ranking ready for human review.

**Stack:** Node.js · Express 5 · TypeScript (JS→TS migration in progress) · MySQL · Prisma · Zod · OpenAI API · Cloudinary
**Project status:** core functionality complete (auth, CRUD, matching engine) and an **automated test suite (Jest + Supertest)** is in place — see [Testing](#-testing).

> For the deep technical reference of the backend (architecture, request lifecycle, data model, CV pipeline, scoring engine, security, deployment) see **[`backend-documentation.md`](./backend-documentation.md)**.

---

## Table of contents

- [System overview](#system-overview)
- [CV processing pipeline](#cv-processing-pipeline)
- [Matching engine](#matching-engine)
- [Architecture & security](#architecture--security)
- [Technology stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Environment variables](#environment-variables)
- [Getting started (local)](#getting-started-local)
- [Available scripts](#available-scripts)
- [Project structure](#project-structure)
- [API reference](#api-reference)
- [CI/CD & deployment](#cicd--deployment)
- [🧪 Testing](#-testing)
- [Development conventions](#development-conventions)
- [Roadmap](#roadmap)
- [License](#license)

---

## System overview

TalentMatch AI is a multi-tenant B2B platform: each user (company/recruiter) manages their own space of **Departments → Positions → Vacancies → Candidates**, fully isolated from every other user. This repository is the backend — the "brain" that ingests CVs, interprets them with AI and computes how well each candidate fits a specific vacancy.

The goal is to eliminate the hours an HR team spends reading unqualified CVs, delivering instead an ordered, explainable ranking of the best candidates.

## CV processing pipeline

When a recruiter uploads one or more CVs to a vacancy (`POST /api/vacancies/:id/upload`), each file goes through:

1. **Deduplication (first):** a SHA-256 hash of the PDF is computed; if a candidate with that hash already exists, it is reused without calling AI or Cloudinary.
2. **Text extraction:** the raw PDF content is read (`pdf-parse`, with a bounded retry for transient errors).
3. **Quality gate:** if the extracted text is under 500 characters (scanned/corrupt/illegible CV), it is discarded and the error is reported for that single file — without blocking the rest of the batch.
4. **AI reading:** the text is sent to an OpenAI model, which extracts skills, experience, education and languages into a structured profile.
5. **Non-CV rejection:** if the AI returns an all-blank profile (the PDF was not a resume), it is rejected before spending a Cloudinary upload.
6. **Secure upload + persistence:** the PDF is stored in Cloudinary and the normalized candidate profile is persisted in MySQL, linked to the vacancy and the user.

Evaluation (`POST /api/vacancies/:id/evaluations`) is a separate, explicit step: it runs the matching engine over the vacancy's candidates that don't yet have a result, with bounded concurrency (`p-limit(5)`).

## Matching engine

The AI **does not assign the score** — it only structures the profile. The final score (0–100) is computed by a deterministic algorithm (`src/utils/scoringEngine.ts`) with these weights:

| Criterion | Weight |
| ----------------------------------------------- | ---- |
| Hard skills (mandatory technical skills) | 30% |
| Experience (required years) | 20% |
| Role match | 15% |
| Languages | 15% |
| Education | 10% |
| Soft skills | 10% |

**Special business rules:**

- **"Lifesaver":** if the candidate lacks formal years of experience but has strong personal projects, they get partial experience credit instead of an automatic reject.
- **"Guillotine":** if the candidate is missing a mandatory hard skill, the hard-skills contribution is reduced proportionally, pushing them out of the top of the ranking.

## Architecture & security

Mandatory layers on every request: **Routes → Validation middleware (Zod) → Controller → Service → Prisma**.

- **Authentication:** JWT (`Authorization: Bearer <token>`), issued at `POST /api/users/login`.
- **RBAC:** `USER` and `ADMIN` roles. Only `ADMIN` can access `/api/admin/*` (global stats, user management).
- **Multi-tenant isolation:** every query (except `/api/admin`) is filtered by the token's `userId` — a user can never read or modify another's resources.
- **Payload validation:** Zod validates `body`, `params` and `query` before any controller touches them.
- **Centralized error handling:** a single `errorHandler` translates Zod and Prisma errors into consistent HTTP responses, and hides internal detail when `NODE_ENV=production`.
- **Headers & CORS:** Helmet + an explicit origin whitelist (`ALLOWED_ORIGINS`).
- **Rate limiting:** 100 requests / 15 minutes per IP (`express-rate-limit`).
- **Passwords:** hashed with `bcrypt` before persisting.

For the full per-endpoint detail see **[`api-documentation.md`](./api-documentation.md)**; for the complete architecture, **[`backend-documentation.md`](./backend-documentation.md)**.

## Technology stack

| Category | Technology |
| -------------------------- | -------------------------------------------------- |
| Runtime | Node.js 20+ |
| Framework | Express 5 |
| Language | TypeScript (progressive migration from JavaScript) |
| Database | MySQL 8 |
| ORM | Prisma |
| Validation | Zod |
| Authentication | JSON Web Tokens (`jsonwebtoken`) + `bcrypt` |
| AI / NLP | OpenAI API |
| File storage | Cloudinary |
| PDF parsing | `pdf-parse` |
| File uploads | Multer |
| HTTP security | Helmet, `express-rate-limit`, CORS |
| Bounded concurrency | `p-limit` |
| Testing | Jest + Supertest (via `babel-jest`) |

## Prerequisites

- **Node.js** `20.20.1` or higher (see `engines` in `package.json`)
- **Docker** (only to run MySQL locally — the backend runs natively, never inside a container in development)
- **npm**
- OpenAI and Cloudinary credentials if you will test the AI/file-upload flows

## Environment variables

There is currently no `.env.example` in the repo — create a `.env` in the root with these variables:

```env
# 1. MySQL initialization via Docker (used by docker-compose)
MYSQL_ROOT_PASSWORD=
MYSQL_DATABASE=
MYSQL_USER=
MYSQL_PASSWORD=

# 2. Prisma connection to the database
DATABASE_URL=

# 3. Node/Express core
NODE_ENV=development
PORT=3000
JWT_SECRET=

# 4. External integrations
OPENAI_API_KEY=
CLOUDINARY_URL=
ALLOWED_ORIGINS=http://localhost:5173
```

> `DATABASE_URL` must point at the MySQL you start with Docker — using the port exposed in `docker-compose.local.yml` (`3307` on the host, `3306` inside the container).

## Getting started (local)

Follow the project's infrastructure split: **Docker runs MySQL only**, the backend runs natively with Node.

```bash
# 1. Clone and install dependencies
git clone <repo-url>
cd talentmatch-backend
npm install

# 2. Start only the MySQL database
docker compose -f docker-compose.local.yml up -d

# 3. Configure your .env (see the previous section)

# 4. Generate the Prisma client and apply the schema
npx prisma generate
npx prisma migrate dev

# 5. (Optional) Seed a test admin user
npx prisma db seed
# Creates admin@admin.ai / Admin123 — change this password immediately
# in any environment that is not your local machine.

# 6. Start the dev server (hot reload)
npm run dev
```

The server listens on `http://localhost:<PORT>` (default `3000`).

## Available scripts

| Script | Description |
| -------------------------- | ---------------------------------------------------------------------- |
| `npm run dev` | Starts the server with hot reload (`tsx watch`) |
| `npm run build` | Compiles TypeScript to `dist/` |
| `npm start` | Runs the compiled build (`node dist/index.js`) — used in production |
| `npm run type-check` | Type-checks without emitting (`tsc --noEmit`) — the CI gate |
| `npm run check-js` | Type-checks the remaining legacy `.js` files |
| `npm test <target>` | Custom test runner — requires an explicit target (see [Testing](#-testing)) |

## Project structure

```
src/
├── controllers/     # Request/response logic per resource
├── routes/          # Endpoint definitions + middleware wiring
├── validations/     # Zod schemas (body/params/query) per resource
├── middlewares/
│   ├── auth/        # JWT, RBAC
│   ├── error/       # Global error handler + 404
│   ├── security/    # Helmet, CORS, rate limiting
│   ├── upload/      # Multer configuration
│   └── validation/  # Generic middleware that applies the Zod schemas
├── services/        # Reusable business logic (matching, Cloudinary, CVs)
├── prompts/         # OpenAI call prompts and wrappers
├── utils/           # Scoring algorithm, hashing, etc.
├── types/           # Shared types and interfaces
├── lib/             # Prisma client, catchAsync, response helpers, pdf wrapper
└── tests/           # Jest/Supertest suites + helpers (mirrors the source tree)

prisma/
├── schema.prisma    # Data model (MySQL)
├── migrations/      # Migration history
└── seed.ts          # Development admin-user seed
```

## API reference

The complete documentation of each endpoint (method, required auth, parameters, body types, and possible error codes) lives in **[`api-documentation.md`](./api-documentation.md)**. Resource summary:

| Resource | Base path | Auth |
| ------------------------------------------------------- | ------------------ | -------------------------- |
| Users / Auth | `/api/users` | Public (register and login) |
| Departments | `/api/departments` | JWT |
| Positions | `/api/positions` | JWT |
| Vacancies | `/api/vacancies` | JWT |
| Candidates (read-only) | `/api/candidates` | JWT |
| Dashboard (per-user metrics) | `/api/dashboard` | JWT |
| Administration (global metrics, user management) | `/api/admin` | JWT + `ADMIN` role |

The most recent contract changes (for the frontend team) are in **[`changelog-frontend.md`](./changelog-frontend.md)**.

## CI/CD & deployment

`.github/workflows/deploy.yml` defines the pipeline on `main`:

1. **Validation gate:** `npm ci` + `npm run type-check`. If the project doesn't compile, the pipeline stops here.
2. **Deploy:** only if the previous gate passes, it SSHes into the VPS, runs `git reset --hard origin/main`, rebuilds the image with `docker compose` and applies `npx prisma migrate deploy` inside the running container. It finishes by pruning old images to avoid filling the disk.

On the VPS, **everything runs containerized** (backend + MySQL via `docker-compose.yml`), unlike the local environment where only the database lives in Docker.

## 🧪 Testing

**Automated test suite with Jest + Supertest** (transpiled by `babel-jest`), running against a dedicated `talentmatch_test` MySQL database. It covers all routes (admin, departments, positions, vacancies, users, candidates, dashboard) on happy paths and error paths, with multi-tenant isolation verified.

Key points (full detail in [`backend-documentation.md`](./backend-documentation.md) §18 and in [`last-changes.md`](./last-changes.md)):

- Serial execution (`maxWorkers: 1`) over a single shared DB truncated between tests.
- Safety guard: `jest.setup.ts` hard-fails if `DATABASE_URL` doesn't contain `talentmatch_test`.
- Custom runner (`npm test <target>`) requiring an explicit target, with a name shortcut and an opt-in prompt for tests that call OpenAI/Cloudinary.
- Throughput benchmark `npm test upload` (100 real CVs).

## Development conventions

The architecture rules, JS→TS migration, and error/transaction handling this repo follows are documented in **[`CLAUDE.md`](../../CLAUDE.md)**. In short:

- The project is in active migration from JavaScript to strict TypeScript — new code is written in `.ts` with no `any`.
- Every external input (`body`, `params`, `query`) is validated with Zod before touching the database.
- HR operations with multiple dependent writes must use Prisma's `$transaction`.
- All code comments are written in English.

## Roadmap

- [x] Database schema definition (Prisma/MySQL)
- [x] Authentication and RBAC (`USER` / `ADMIN`)
- [x] CRUD for Departments, Positions and Vacancies
- [x] CV upload and extraction (PDF → AI → structured profile)
- [x] Deterministic scoring/matching engine
- [x] Validation and error-handling hardening (see `changelog-frontend.md`)
- [x] Automated test suite (unit + integration)
- [ ] Test coverage in the CI pipeline (today the gate is `type-check` only)
- [ ] Versioned `.env.example`

## License

ISC — see `package.json`.
