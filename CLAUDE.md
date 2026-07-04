# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

- **Purpose:** B2B platform for automating candidate selection and evaluation in Human Resources. Each user (company/recruiter) manages an isolated space of **Departments → Positions → Vacancies → Candidates**.
- **Backend Stack:** Node.js with Express. Currently a hybrid codebase of JavaScript and TypeScript (in the process of a strict TS migration).
- **Data Layer:** MySQL managed via Prisma ORM.
- **Local Infrastructure:** Docker is used _exclusively_ to spin up the MySQL database engine. The Node.js backend runs natively.
- **VPS Infrastructure:** 100% containerized deployment. Both the Node.js backend and MySQL run inside Docker containers.

## Commands

```bash
# Install
npm install

# Local database (Docker runs MySQL only — the backend itself runs natively)
docker compose -f docker-compose.local.yml up -d

# Dev server (hot reload)
npm run dev

# Type-check (no emit) — this is the CI gate; a broken build stops the deploy pipeline
npm run type-check
npm run check-js          # type-checks the remaining legacy .js files

# Build / run production build
npm run build              # tsc -p tsconfig.build.json -> dist/ (tests excluded)
npm start                   # node dist/index.js

# Tests (Jest + Supertest, against a dedicated talentmatch_test MySQL DB — see Testing below)
# npm test always requires an explicit target — there is no default full-suite run.
npm test admin                                     # shortcut: bare name matched against test file paths (-> admin.test.ts)
npm test -- src/tests/routes/departments.test.ts   # full path also works
npm test departments -t "returns 201"              # single test by name within a file

# Prisma
npx prisma generate
npx prisma migrate dev      # local schema changes
npx prisma db seed          # seeds admin@admin.ai / Admin123 + default departments
```

## Architecture

- **Layered request flow (never skip a layer):** Routes → Zod validation middleware → Controllers → (Services) → Prisma → MySQL.
- **`src/app.ts` vs `src/index.ts`:** `app.ts` builds the Express app (middlewares + routes) and exports it without listening; `index.ts` is the _only_ file that calls `app.listen`. This split exists so Supertest can import `app` directly in tests without opening a real port — don't merge them back together.
- **Multi-tenant isolation:** every resource except `/api/admin/*` is scoped by `req.user.id` (from the JWT). `Department`, `Position`, `Vacancy`, and `Candidate` all carry a `userId` column, and controllers filter/write by `req.user!.id` — a user can never read or write another user's resources. RBAC has two roles, `USER` and `ADMIN`; only `ADMIN` can hit `/api/admin/*`.
- **Central error handling:** `src/middlewares/error/errorHandler.middleware.ts` is the single place that turns thrown errors into HTTP responses — `ZodError` → `400`, Prisma `P2002` (unique constraint) → `409`, other known Prisma errors → `400`, otherwise the error's own `statusCode` or `500`. It logs via `console.error` only for real `5xx`/unexpected failures and `console.warn` for expected `4xx` client errors, so log severity reflects actual severity.
- **Domain hierarchy:** `Department → Position → Vacancy → Candidate`, each scoped to a `userId`. Note `Position.departmentId` currently has `onDelete: Cascade` in `prisma/schema.prisma` — deleting a Department cascades to its Positions rather than being blocked.
- **CV pipeline:** upload (`POST /api/vacancies/:id/upload`) → PDF stored on Cloudinary → text extracted with `pdf-parse` → quality-gated (<500 chars is rejected without blocking the rest of the batch) → sent to OpenAI to extract a structured profile → SHA-256 hash dedup (skips a repeat OpenAI call for an already-seen CV) → persisted as a `Candidate`. Evaluation (`POST /api/vacancies/:id/evaluations`) is a separate explicit step.
- **Matching/scoring engine:** the AI only structures the candidate profile — it never assigns the score. `src/utils/scoringEngine.ts` computes a deterministic 0–100 score (Hard Skills 30%, Experience 20%, Role match 15%, Languages 15%, Education 10%, Soft Skills 10%), with two special rules: a "lifesaver" that gives partial experience credit for strong personal projects instead of an automatic reject, and a "guillotine" that heavily penalizes a missing mandatory hard skill. Evaluations run with bounded concurrency via `p-limit`.
- **Hybrid JS/TS:** several files are still `.js` mid-migration. `tsconfig.json` includes test files (so editors resolve `describe`/`it` without errors); `tsconfig.build.json` excludes them and is what `npm run build` actually uses.

## Testing

- Jest + Supertest, config in `jest.config.js`. `babel-jest` (not `ts-jest`) transpiles both `.ts` and the legacy `.js` files, so tests behave identically whether run via `npm test`, CI, or an editor's single-test runner.
- Tests run serially (`maxWorkers: 1`): every file shares one physical database and truncates it in `jest.setup.afterEnv.ts` (`beforeAll`/`afterEach`/`afterAll` are wired globally — don't redeclare them per file). Running in parallel would let one file's cleanup wipe another file's fixtures mid-test.
- `jest.setup.ts` loads `.env.test` and hard-fails if `DATABASE_URL` doesn't contain `talentmatch_test`, so a misconfigured environment can never truncate dev/prod data. The test database/user (`talentmatch_test`) and its migrations are not part of this repo's automation — set up manually per machine (create the DB/user in the local MySQL container, then `DATABASE_URL="..." npx prisma migrate deploy` against it).
- `src/tests/utils/jwt.util.ts` issues real JWTs signed with the test `JWT_SECRET` (`authHeaderFor({ userId, role })`) instead of hitting the login endpoint — faster, and isolates a test from unrelated login bugs. Also exposes `expiredTestToken` and `tokenWithWrongSecret` for auth edge cases.
- Test files live in a parallel `src/tests/` tree, mirroring the structure of the code they cover (e.g. `src/routes/admin.ts` → `src/tests/routes/admin.test.ts`), matched by `src/**/*.test.ts`. Test helpers live alongside them in `src/tests/utils/`. This keeps test code out of the production folders entirely.
- **Gotcha:** admin endpoints aggregate across all data and never use `req.user.id` as a DB foreign key, so admin tests can use a hardcoded token `userId`. Most other resources (Department, Position, ...) write `req.user!.id` as a real FK — tests for those must seed an actual `User` row first and mint the token from that row's real `id`, not a hardcoded one.
- `npm test` has no default target — it requires an explicit one (enforced by `scripts/test.ts`, run via `tsx`, which exits with an error if none is given, since the shared test DB is not meant for casual full-suite runs). A **bare name is the shortcut** and gets anchored to the file name before being handed to Jest as a `testPathPattern`: `npm test positions` → `src/tests/routes/positions.test.ts`. Anchoring matters on Windows, where the absolute path starts with `C:\Users\...`, so an un-anchored `users` would otherwise match every file. A full path or extra Jest flags (e.g. `-t "returns 201"`) are passed through untouched.
- **Opt-in external-service tests:** endpoints that call OpenAI/Cloudinary (position `/complete`, vacancy `/:id/upload`, `/:id/evaluations`) have their happy path in `describe.skip`-gated blocks. `scripts/test.ts` runs `jest --listTests` on the target; if it resolves to a file with external blocks (`positions.test.ts`, `vacancies.test.ts`) and the shell is interactive (TTY), it prompts `¿Ejecutarlos también? (y/N)` and sets `RUN_EXTERNAL_TESTS` accordingly. Non-interactive shells (CI, this repo's tooling) always skip them. Force with `--external` / `--no-external` to bypass the prompt. Real PDFs for those tests are generated in-memory by `src/tests/utils/pdf.util.ts` (pdfkit).
- **Real credentials for external tests:** the `.env.test` `OPENAI_API_KEY` / `CLOUDINARY_URL` are placeholders. When `RUN_EXTERNAL_TESTS=true`, `jest.setup.ts` overlays *only those two keys* from the real `.env` at runtime (via `dotenv.parse` + `fs.readFileSync`, which does not mutate the rest of `process.env`). `DATABASE_URL` and `JWT_SECRET` are never overridden, so the `talentmatch_test` DB guard stays authoritative and dev/prod data can't be touched. If `.env` is missing/unreadable it warns and the external tests fall back to placeholders (and fail loudly).
- **`npm test upload` — CV upload throughput benchmark** (`src/tests/routes/upload.test.ts`): a performance test, not a unit test. `scripts/test.ts` recognizes it as a `PERF_FILES` entry and, with no prompt, forces `RUN_EXTERNAL_TESTS=true` (real OpenAI/Cloudinary) **and** `KEEP_TEST_DATA=true`. `KEEP_TEST_DATA` disables the global truncation hooks in `jest.setup.afterEnv.ts` so the candidates persist across runs; the test does its own cleanup (deletes the previous run's `upload-perf@test.com` graph in FK-safe order) so only the latest 100 candidates ever remain. It generates 100 unique, fully-populated CV PDFs via `src/tests/utils/generateMockCvs.ts` into `mock_cvs/` (git-ignored), uploads them in one request, and logs elapsed time / ms-per-CV — the upload controller processes at most 5 concurrently (`p-limit(5)`). A second case posts 101 files to prove the per-request cap: `upload.array("pdfs", 100)` rejects the 101st (`LIMIT_UNEXPECTED_FILE`) before the controller runs, so nothing is persisted. Run without the runner (raw `jest`), the whole block is `describe.skip`-gated and never touches the API. NOTE: `pdf-parse` (the extractor) is non-deterministic when called in a tight in-process burst on freshly generated PDFs (~intermittent "bad XRef entry") even though the PDFs are valid — `src/lib/pdfWrapper.ts` wraps `extract` in a bounded retry (6 attempts) that recovers these, so a legitimate CV isn't silently dropped mid-batch; a genuinely corrupt PDF still fails every attempt and rethrows unchanged.

## Strict Execution Rules for Claude

1. **Zero Autonomy & Mandatory Approval:** You are NOT an autonomous agent. You are strictly forbidden from modifying, overwriting, or deleting code without my explicit approval. You must propose the solution, show the code, and wait for my confirmation before proceeding.
2. **Block on Sensitive Actions:** Never execute terminal commands, schema alterations, database migrations (Prisma), or any destructive actions without thoroughly explaining the impact and obtaining my prior authorization.
3. **TypeScript Transition:** If editing an existing `.js` file, maintain compatibility. If creating or editing a `.ts` file, enforce strict typing. Completely avoid the use of `any`.
4. **Zero CRUD Shortcuts:** Prioritize performance, scalability, and clean separation of concerns (Routes -> Validation Middlewares -> Controllers -> Services -> Prisma).
5. **Relentless Validation:** Every incoming payload (`req.body`, `req.params`, `req.query`) MUST be rigorously validated and sanitized before interacting with the database. Exhaustively analyze edge cases (e.g., default string inputs like "NONE").
6. **Error Handling:** Use the existing `errorHandler` and `catchAsync` utilities located in `src/lib/` and `src/middlewares/`. Always respond with proper semantic HTTP status codes.
7. **Database Transactions:** If an HR operation requires multiple dependent writes, you must use Prisma's `$transaction` API to guarantee data consistency and prevent race conditions in MySQL.
8. **English-Only Code Comments:** All code comments MUST be written in English — inline (`//`), block (`/* */`), and JSDoc alike — regardless of the language we converse in. This keeps the codebase consistent for every contributor. When you touch a file that still carries Spanish comments, translate them to English as part of that change.

## Git & Commit Formatting

9. **Strict Commit Format (Conventional Commits):** Whenever I explicitly instruct you to generate a commit message or commit a specific set of changes, you MUST strictly adhere to the Conventional Commits specification.

- **Format:** `<type>(<scope>): <subject>`
- **Types allowed:** `feat`, `fix`, `refactor`, `test`, `docs`, `chore`.
- **Examples:** `feat(admin): implement JWT test helper utility`, `fix(db): resolve foreign key constraint in test teardown`, `refactor(auth): migrate token validation to strict TypeScript`.
- When generating the commit message, briefly ensure the subject line accurately reflects the actual architectural or code changes we just discussed.
