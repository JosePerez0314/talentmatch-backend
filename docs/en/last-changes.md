# Recent changes log

**Scope:** everything implemented **after** the state described in the previous version of this document (`CAMBIOS_SIN_COMMIT.md`, which covered the admin testing infrastructure — Jest/Supertest setup, `talentmatch_test` database, JWT test helpers, `app.ts`/`index.ts` split, and `admin.test.ts`). That work is already committed (`286ccc3 "Test admin (#129)"`). This document picks up from there.

All commits referenced below are on branch `test/departments`.

---

## Index

- [1. Local environment catch-up (new machine)](#1-local-environment-catch-up-new-machine)
- [2. Error handler: log severity now matches HTTP status](#2-error-handler-log-severity-now-matches-http-status)
- [3. Error handler: Prisma errors now map to the correct HTTP status](#3-error-handler-prisma-errors-now-map-to-the-correct-http-status)
- [4. `CLAUDE.md` rewritten in English, with a commit format policy](#4-claudemd-rewritten-in-english-with-a-commit-format-policy)
- [5. `CLAUDE.md` expanded with Commands, Architecture, and Testing sections](#5-claudemd-expanded-with-commands-architecture-and-testing-sections)
- [6. Full test suite for `/api/departments`](#6-full-test-suite-for-apidepartments)
- [7. Known gaps left intentionally unfixed](#7-known-gaps-left-intentionally-unfixed)
- [8. Test suite reorganized into a dedicated `src/tests/` tree](#8-test-suite-reorganized-into-a-dedicated-srctests-tree)
- [9. Custom test runner: explicit target, name shortcut, external-service prompt](#9-custom-test-runner-explicit-target-name-shortcut-external-service-prompt)
- [10. New route suites: positions, vacancies, users, candidates, dashboard](#10-new-route-suites-positions-vacancies-users-candidates-dashboard)
- [11. Real OpenAI/Cloudinary credentials for opt-in external tests](#11-real-openaicloudinary-credentials-for-opt-in-external-tests)
- [12. `npm test upload`: 100-CV upload throughput benchmark](#12-npm-test-upload-100-cv-upload-throughput-benchmark)
- [13. `pdf-parse` retry to stop dropping CVs on transient errors](#13-pdf-parse-retry-to-stop-dropping-cvs-on-transient-errors)
- [14. `CLAUDE.md` updated to document the testing overhaul](#14-claudemd-updated-to-document-the-testing-overhaul)

---

## 1. Local environment catch-up (new machine)

**The problem:** the previous document was written on a different machine. This one had the committed code (`package.json`, `jest.config.js`, etc.) but was missing everything that lives outside version control: `node_modules` wasn't in sync, and the `talentmatch_test` database/user didn't exist locally.

**What was done:**

- Ran `npm install` to bring `node_modules` in line with the already-committed `package-lock.json` (Jest, Supertest, babel-jest, and their `@types` packages were missing on disk).
- Created the `talentmatch_test` database and a dedicated, restricted MySQL user (`talentmatch_test`, permissions scoped to that database only) directly in the local `talentmatch_db` Docker container — mirroring what the previous document described as already done on the original machine.
- Applied all 11 existing Prisma migrations to that new database (`prisma migrate deploy`), bringing its schema up to date with `talentmatch_db`.
- Re-ran `prisma/seed.ts` against the real local database (`talentmatch_db`) to backfill the admin user's default departments — confirmed idempotent (upsert-based), no duplicates or data loss for the admin's existing manual department.

**Result:** `npm test` runs correctly on this machine without touching development/production data.

---

## 2. Error handler: log severity now matches HTTP status

**File:** `src/middlewares/error/errorHandler.middleware.ts`
**Commit:** `55a6345 fix(errors): use console.warn for expected 4xx validation errors`

**The problem:** `errorHandler` logged *every* error the same way, via `console.error`, regardless of whether it was a real server failure or a routine client mistake (e.g. sending an invalid `role` value). This meant a `400` from a normal validation failure and a genuine `500` crash looked identical in the logs — noisy in practice, and risky if error-level logs are ever wired to alerting, since real failures would get lost in the noise of everyday bad requests.

**What changed:** the logger now branches on the error's *effective* severity:

- `ZodError`, Prisma "known request" errors resolving to a `4xx`, and any error with an explicit `statusCode < 500` → `console.warn`.
- Anything resolving to `5xx` (including truly unexpected errors) → `console.error`.
- The `res.headersSent` edge case (an error arriving after the response already started) still logs via `console.error`, since that scenario is always anomalous.

No response bodies or status codes changed in this step — only the logging.

---

## 3. Error handler: Prisma errors now map to the correct HTTP status

**File:** `src/middlewares/error/errorHandler.middleware.ts`
**Commit:** `b2f6fab fix(errors): map Prisma P2002 to 409 and P2025 to 404`

**The problem:** `errorHandler` treated every `Prisma.PrismaClientKnownRequestError` identically — always a generic `400 "Invalid data sent to the database"`. That's semantically wrong for two very common cases surfaced while building the Departments test suite:

- Creating a record that violates a unique constraint (e.g. a duplicate department title for the same user) is a **conflict**, not a bad request.
- Updating or deleting a record whose `:id` doesn't exist (or doesn't belong to the requesting user) is **not found**, not a bad request.

**What changed:** two new branches were added before the generic Prisma fallback:

- `err.code === "P2002"` (unique constraint violation) → `409 Conflict`.
- `err.code === "P2025"` (record required for the operation was not found) → `404 Not Found`.
- Every other Prisma error keeps the previous behavior: generic `400`.

This directly fixed observed behavior in Departments: duplicate-title creation now returns `409` instead of `400`, and updating/deleting a non-existent (or another user's) department now returns `404` instead of `400`.

---

## 4. `CLAUDE.md` rewritten in English, with a commit format policy

**Commit:** `f996162 docs(claude): translate rules to english and add commit format policy`

- Translated the entire file from Spanish to English (Project Context + the 7 existing execution rules), no behavioral changes to the rules themselves.
- Added a new rule (`8. Strict Commit Format`): all commits explicitly requested from Claude must follow Conventional Commits (`<type>(<scope>): <subject>`, types limited to `feat`, `fix`, `refactor`, `test`, `docs`, `chore`). Every commit referenced in this document follows that format.

---

## 5. `CLAUDE.md` expanded with Commands, Architecture, and Testing sections

**Commit:** `22c6444 docs(claude): add commands, architecture, and testing sections`

Ran via `/init` to bring `CLAUDE.md` up to date as an onboarding reference for future Claude Code sessions, without touching the existing execution rules or commit policy. Added:

- **Commands:** install, local DB, dev server, type-check, build/start, test invocations (including single-file and single-test-name forms), and the Prisma commands (`generate`, `migrate dev`, `db seed`).
- **Architecture:** the layered request flow, the `app.ts`/`index.ts` split and why it exists, multi-tenant isolation via `req.user.id`, the central error handler's status-code mapping (reflecting the changes from sections 2–3 above), the `Department → Position → Vacancy → Candidate` domain hierarchy (including the `onDelete: Cascade` note relevant to section 6), the CV pipeline, the scoring engine, and the hybrid JS/TS state of the codebase.
- **Testing:** how the Jest/Supertest setup actually works in practice (serial execution, `babel-jest`, the `.env.test` safety check, the JWT test-token helper, test file conventions) — including a callout that most resources (unlike admin) require seeding a real `User` row and minting the token from its real `id`, since `req.user.id` is written as an actual foreign key.

**Note:** while implementing this, `CLAUDE.md` was found deleted from the working tree (unstaged) for reasons outside this session's actions. It was restored from the last commit (`git checkout -- CLAUDE.md`) before applying the additions above, so no existing content was lost.

---

## 6. Full test suite for `/api/departments`

**File:** `src/routes/departments.test.ts` (new)
**Commit:** `d7cf839 test(departments): cover CRUD, validation, auth, and relational integrity`

Following the same pattern established in `admin.test.ts` (Supertest against the real `app`, JWT test tokens, Prisma-backed seed helpers, global `beforeAll`/`afterEach`/`afterAll` truncation), added 20 tests covering all 5 routes exposed by `src/routes/departments.ts` — confirmed to be the complete set (`GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`; no route was missing coverage):

- **`POST /api/departments`:** `201` happy path (and DB persistence check), `400` on Zod validation failure, `401` with no token, `409` on duplicate title for the same user.
- **`GET /api/departments`:** `401` with no token, `200` returning only the requesting user's departments (verified another user's department is excluded — multi-tenant isolation).
- **`GET /api/departments/:id`:** `401` with no token, `200` happy path, `404` for a non-existent id, `404` when the id belongs to another user.
- **`PUT /api/departments/:id`:** `401` with no token, `200` happy path (with DB persistence check), `400` on Zod validation failure (original title left unchanged), `404` for a non-existent id, `404` when the id belongs to another user (target department left unchanged).
- **`DELETE /api/departments/:id`:** `401` with no token, `200` happy path when the department has no linked Positions, `404` for a non-existent id, `404` when the id belongs to another user (department still exists afterward), and a test documenting the actual relational-delete behavior (see section 7 below).

One implementation detail worth noting: unlike `admin.test.ts` (whose endpoints aggregate across all data and never use `req.user.id` as a database foreign key, so a hardcoded token `userId` works fine), the Departments controller writes `req.user!.id` as a real foreign key on every create. So every test here seeds an actual `User` row first and mints its token from that row's real `id`, instead of a hardcoded value.

---

## 7. Known gaps left intentionally unfixed

Two things surfaced while writing the Departments tests that were **not** changed, because fixing them would require touching schema/migrations or a broader refactor outside this task's scope:

1. **`DELETE` with linked Positions doesn't reject — it cascades.** `prisma/schema.prisma` currently defines `Position.department` with `onDelete: Cascade`. So deleting a Department that still has Positions attached does **not** fail with a `P2003` foreign key error — it succeeds and deletes the Positions along with it. The corresponding test in `departments.test.ts` documents this real behavior explicitly rather than asserting a rejection. Making deletion blocking (as originally speced) would require changing that relation to `onDelete: Restrict` and generating/applying a new Prisma migration — a schema/infrastructure change requiring separate authorization.
2. **Inconsistent success response shape.** `GET /api/departments`, `GET /api/departments/:id`, and the happy paths of `PUT`/`DELETE` (all routed through `sendResponseOr404` in `src/lib/responseHandler.ts`) return a body double-nested as `{ response: { success, data } }`, while `POST /api/departments` and every admin endpoint return `{ success, data }` directly. The tests assert against the real, current shape for each endpoint. Unifying this would touch `responseHandler.ts` and is a pre-existing inconsistency, not something introduced by this work.

---

## 8. Test suite reorganized into a dedicated `src/tests/` tree

**Commit:** `6e22c43 refactor(tests): relocate suites and helpers into a dedicated src/tests tree`

**The problem:** the test files lived *inside* the production source folders — `src/routes/admin.test.ts`, `src/routes/departments.test.ts` next to the real route handlers, and the shared helpers in `src/test-utils/`. The goal (explicitly requested) was to keep the `.test.ts` files and their helpers out of the production folders entirely, while continuing to run under the existing `babel-jest` setup.

**What changed (moved, no logic changes):**

- `src/routes/admin.test.ts` → `src/tests/routes/admin.test.ts`
- `src/routes/departments.test.ts` → `src/tests/routes/departments.test.ts`
- `src/test-utils/db.util.ts` → `src/tests/utils/db.util.ts`
- `src/test-utils/jwt.util.ts` → `src/tests/utils/jwt.util.ts`

**Modified:**

- Relative imports inside the moved files updated one level deeper (`../app.js` → `../../app.js`, `../test-utils/jwt.util.js` → `../utils/jwt.util.js`, etc.).
- `jest.setup.afterEnv.ts` — helper import repointed to `./src/tests/utils/db.util.js`.
- `tsconfig.build.json` — the previous `src/test-utils/**` exclude replaced with `src/tests/**`, so the whole test tree (now including non-`.test.ts` helpers) is kept out of the production build.

**Why this layout:** `jest.config.js` already matches `src/**/*.test.ts`, so no test-config change was needed. The tests still transpile through `babel-jest`. A parallel `src/tests/` tree mirrors the structure of the code it covers without polluting the route folders.

---

## 9. Custom test runner: explicit target, name shortcut, external-service prompt

**Commit:** `9b71703 chore(tests): add a test runner with target guard, name shortcut and external prompt`

**The problem:** `npm test` ran the bare `jest`, which (a) runs the *entire* suite by default against the single shared `talentmatch_test` database — wasteful and easy to trigger by muscle memory — and (b) offered no ergonomic way to run one suite by name, nor any control over the tests that call paid external APIs.

**New file:** `scripts/test.ts` (TypeScript, run via `tsx`). It:

- **Requires an explicit target.** Running `npm test` with no argument exits with an error instead of running everything. A mistyped name (e.g. `vacacancies`) prints the list of available suites instead of Jest's raw "No tests found" dump.
- **Turns a bare name into a file-anchored pattern.** `npm test positions` is rewritten to a `testPathPattern` anchored to the file name (`positions[^/\\]*\.test\.ts$`). This is required on Windows: Jest matches its positional arg against the *absolute* path, which begins with `C:\Users\...`, so an un-anchored `users` would otherwise match every file via the `Users` path segment.
- **Prompts before external-service suites.** It runs `jest --listTests` on the target; if it resolves to a file that contains OpenAI/Cloudinary blocks (`positions.test.ts`, `vacancies.test.ts`) and the shell is interactive, it asks `¿Ejecutarlos también? (Y/N)` and sets `RUN_EXTERNAL_TESTS` accordingly. Non-interactive shells (CI, tooling) always skip them. `--external` / `--no-external` bypass the prompt.
- **Auto-configures perf suites.** A file listed in `PERF_FILES` (`upload.test.ts`) forces `RUN_EXTERNAL_TESTS=true` and `KEEP_TEST_DATA=true` with no prompt (see section 12).

**Modified:**

- `package.json` — the `test` script is now `tsx scripts/test.ts` (was `jest`). `test:watch` is unchanged.
- `tsconfig.json` — `scripts/**/*` added to `include` so the runner is type-checked by `npm run type-check`. (Also fixed a real editor error: `scripts/test.ts` was previously in no project, so VS Code reported `Cannot find name 'node:child_process'` because it wasn't inheriting `types: ["node"]`. `@types/node` was already installed — it was purely a config-scope issue, not a missing dependency.) The production build (`tsconfig.build.json`) has its own `include: ["src/**/*"]`, so `scripts/` is never emitted to `dist/`.

---

## 10. New route suites: positions, vacancies, users, candidates, dashboard

**Commit:** `ba81fb6 test(routes): add positions, vacancies, users, candidates and dashboard suites`

**Goal:** cover every endpoint of the remaining routes and *every path* — not just the happy path — mirroring the admin/departments pattern (Supertest against the real `app`, real JWTs via `authHeaderFor`, Prisma seed helpers that create an actual `User` row so `req.user!.id` resolves as a real foreign key).

**New files:**

- `src/tests/routes/positions.test.ts` — `POST /` (201, 400 role/description/technicalSkills/educationArea validation, 404 cross-tenant/missing department, 401), `GET /` (200 tenant-scoped, 401, expired-token 401, wrong-secret 401), `GET /:id` (200, 400 bad id, 404 missing, 404 cross-tenant, 401), `PUT /:id`, `DELETE /:id`, `POST /duplicate/:id` (201 `(Copy)` suffix, 404s, 401), and `POST /complete` (401, 400 no file, plus the external OpenAI+Cloudinary happy path).
- `src/tests/routes/vacancies.test.ts` — `POST /` (201, 404 department, 400 department-without-positions, 400 position-not-in-department, 400 date-order, 400 empty title, 401), `GET /`, `GET /:id`, `PATCH /:id/status`, `PUT /:id`, `DELETE /:id` (happy + 404 + cross-tenant + 401), `GET /:id/results` (200 empty + pagination meta, 200 ordered by score, cross-tenant isolation, 401), `POST /:id/evaluations` (404, 400 no candidates, 401, external happy path), `POST /:id/upload` (400 bad id, 400 no file, 401, external happy path).
- `src/tests/routes/users.test.ts` — public routes (mounted before auth). `POST /` (201 + default departments seeded + password hashed + email normalized, 409 duplicate, 400 bad email, 400 weak password), `POST /login` (200 token + user payload, case-insensitive login, 401 unknown email, 401 wrong password, 400 validation).
- `src/tests/routes/candidates.test.ts` — read-only routes seeded through the full `user → department → position → vacancy → candidate` graph. `GET /` (200 tenant-scoped, 401), `GET /:id` (200, 400 bad id, 404 missing, 404 cross-tenant, 401).
- `src/tests/routes/dashboard.test.ts` — `GET /` (200 with accurate `total` counts + `vacancyStatusBreakdown` + `monthlyActivity`, PAUSED excluded from open count, strict per-user scoping, 401).
- `src/tests/utils/pdf.util.ts` — `makePdfBuffer(text)` builds a real in-memory PDF with `pdfkit` (the external upload/complete tests need a genuine PDF because the controller runs `pdf-parse` before calling OpenAI), plus `SAMPLE_CV_TEXT` / `SAMPLE_POSITION_TEXT` fixtures that clear the controller's character-count quality gate.
- `src/types/pdfkit.d.ts` — a minimal ambient declaration for `pdfkit` (which ships no types and whose `@types` package is not installed), covering only the surface `pdf.util.ts` uses, so the code stays free of `any` without adding a dependency.

**External happy paths** (OpenAI/Cloudinary) live in `describe.skip`-gated blocks keyed on `RUN_EXTERNAL_TESTS`, so they only run when explicitly enabled (section 9). Response-shape assertions match each endpoint's real body (`{ response: { data } }` for `sendResponseOr404` routes vs. `{ data }` for the direct ones).

---

## 11. Real OpenAI/Cloudinary credentials for opt-in external tests

**File:** `jest.setup.ts`
**Commit:** `ed42901 test(config): load real OpenAI/Cloudinary keys for opt-in external tests`

**The problem:** `.env.test` deliberately holds *placeholder* `OPENAI_API_KEY` / `CLOUDINARY_URL` values ("fail loudly if a test ever calls them for real"). So even when an external suite was enabled, it could never actually pass — the real calls failed on the placeholder keys.

**What changed:** after the existing `.env.test` load and the `talentmatch_test` DB guard, a new block runs *only* when `RUN_EXTERNAL_TESTS=true`. It reads the real `.env` at runtime (`dotenv.parse(fs.readFileSync(".env"))`) and copies **only** `OPENAI_API_KEY` and `CLOUDINARY_URL` into `process.env`.

**Why it's safe:**

- `dotenv.parse` returns an object and does **not** mutate `process.env`, so nothing beyond those two keys leaks in.
- `DATABASE_URL` and `JWT_SECRET` are never overridden — the `talentmatch_test` guard above stays the sole authority, so dev/prod data remains unreachable even though the real `.env` (which points `DATABASE_URL` at the dev DB) is parsed.
- If `.env` is missing/unreadable, it warns and the external tests fall back to placeholders (and fail loudly). Verified in isolation with a fake env file containing a trap `DATABASE_URL=...PROD` and `JWT_SECRET`: only the two external keys were copied; the DB URL stayed on `talentmatch_test` and the JWT secret did not leak.

---

## 12. `npm test upload`: 100-CV upload throughput benchmark

**Commit:** `f48dc84 test(upload): add a 100-CV upload throughput benchmark`

**Goal:** measure how fast the CV-upload pipeline calls the external APIs, and prove how it handles the 100-PDF-per-request limit and the controller's concurrency cap.

**New files:**

- `src/tests/utils/generateMockCvs.ts` — a TypeScript generator (replaces the deleted root `generateMockCVs.js`). Each run wipes its output directory and writes N fully-populated, randomized CV PDFs (name, role, technical/optional/soft skills, languages, multi-job experience, education). Every CV carries a unique `Reference ID` line so its SHA-256 hash is unique — the upload controller dedups by content hash, so identical PDFs would collapse into a single candidate and defeat the load test. Verified with the controller's own `pdf-parse` extractor: 10/10 files valid, all above the 500-char gate, all unique.
- `src/tests/routes/upload.test.ts` — generates 100 CVs, uploads them in one request, and logs elapsed time / ms-per-CV (the controller processes at most 5 concurrently via `p-limit(5)`, confirmed unchanged). A second case posts 101 files and asserts the per-request cap: `upload.array("pdfs", 100)` rejects the 101st with `LIMIT_UNEXPECTED_FILE` **before** the controller runs (empirically confirmed), so no OpenAI calls happen and nothing is persisted.

**Modified:**

- `jest.setup.afterEnv.ts` — the global truncation hooks now no-op when `KEEP_TEST_DATA=true`, so the benchmark's candidates persist across runs. `prisma.$disconnect()` still always runs. The `talentmatch_test` DB guard is untouched.

**Deleted:**

- `generateMockCVs.js` (project root) — the old standalone generator, replaced by the typed module above.

**How persistence and cleanup work:** `scripts/test.ts` marks `upload.test.ts` as a perf file → forces real credentials **and** `KEEP_TEST_DATA=true` with no prompt. Because truncation is disabled, the suite does its own cleanup: `beforeAll` deletes the previous run's `upload-perf@test.com` graph in FK-safe order (candidates → vacancies → positions → departments → user), then reseeds and regenerates. Only the latest 100 candidates ever remain, so the DB never accumulates junk. Run outside the runner (raw `jest`), the whole block is `describe.skip`-gated and never touches the API — verified: without credentials it reports 2 skipped, zero API calls.

**Known finding (not changed):** exceeding the 100-file cap currently surfaces as a `500` (the `MulterError` has no `statusCode`, so `errorHandler` falls through to 500). The limit *is* enforced (hard rejection, controller never runs); only the status code is not a clean `4xx`. Mapping `MulterError` → `413`/`400` was left as an optional follow-up.

---

## 13. `pdf-parse` retry to stop dropping CVs on transient errors

**File:** `src/lib/pdfWrapper.ts`
**Commit:** `4a08ab6 fix(pdf): retry pdf-parse extraction to avoid dropping CVs on transient errors`

**The problem (found while running the upload benchmark):** the real 100-CV run logged `Error processing file candidate-cv-099.pdf: bad XRef entry`. Investigation showed `pdf-parse` (pdf.js under the hood) is **non-deterministic** when many documents are parsed in one process: the *exact same buffer* fails one call and succeeds the next (reproduced ~50% failures in a tight in-process loop, while the same buffer reused was consistently fine). The PDFs are valid — it's parser state, not content. In the real controller each failure is caught per-file (`success: false`), so a legitimate CV is **silently dropped** from the batch.

**What changed:** `extract(buffer)` is now wrapped in a bounded retry — up to 6 attempts, 50 ms apart. Because the failures come in short bursts and recover, retrying the same buffer clears them. A genuinely corrupt/encrypted PDF still fails every attempt, and the **original error is rethrown unchanged**, so the controller's existing `catch` path is preserved. Signature is unchanged, so no caller was touched.

**Verification:** the pathological tight loop that previously failed ~50% now succeeds 120/120 across three runs of 40 fresh PDFs. In the real flow each `extract` is spaced out by the OpenAI await, so failures are already rare (1/100 without any retry) — the retry brings silent candidate loss to effectively zero.

---

## 14. `CLAUDE.md` updated to document the testing overhaul

**Commit:** (this changelog commit)

`CLAUDE.md`'s **Testing** section was extended to describe everything above so future sessions have an accurate reference: the `src/tests/` layout and helper location, the `npm test <name>` runner (target guard, Windows-safe name anchoring, single-test flags), the opt-in external-service prompt and the `--external`/`--no-external` flags, the runtime overlay of real OpenAI/Cloudinary keys from `.env` (and why the DB guard stays authoritative), the `npm test upload` benchmark (perf-file auto-config, `KEEP_TEST_DATA`, the 100-file cap, the keep-last-100 cleanup), and the `pdf-parse` retry in `src/lib/pdfWrapper.ts`.
