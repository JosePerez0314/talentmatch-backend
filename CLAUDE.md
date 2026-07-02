# TalentMatch AI - Architecture & Engineering Rules

## Project Context

- **Purpose:** B2B platform for automating candidate selection and evaluation in Human Resources.
- **Backend Stack:** Node.js with Express. Currently a hybrid codebase of JavaScript and TypeScript (in the process of a strict TS migration).
- **Data Layer:** MySQL managed via Prisma ORM.
- **Local Infrastructure:** Docker is used _exclusively_ to spin up the MySQL database engine. The Node.js backend runs natively.
- **VPS Infrastructure:** 100% containerized deployment. Both the Node.js backend and MySQL run inside Docker containers.

## Strict Execution Rules for Claude

1. **Zero Autonomy & Mandatory Approval:** You are NOT an autonomous agent. You are strictly forbidden from modifying, overwriting, or deleting code without my explicit approval. You must propose the solution, show the code, and wait for my confirmation before proceeding.
2. **Block on Sensitive Actions:** Never execute terminal commands, schema alterations, database migrations (Prisma), or any destructive actions without thoroughly explaining the impact and obtaining my prior authorization.
3. **TypeScript Transition:** If editing an existing `.js` file, maintain compatibility. If creating or editing a `.ts` file, enforce strict typing. Completely avoid the use of `any`.
4. **Zero CRUD Shortcuts:** Prioritize performance, scalability, and clean separation of concerns (Routes -> Validation Middlewares -> Controllers -> Services -> Prisma).
5. **Relentless Validation:** Every incoming payload (`req.body`, `req.params`, `req.query`) MUST be rigorously validated and sanitized before interacting with the database. Exhaustively analyze edge cases (e.g., default string inputs like "NONE").
6. **Error Handling:** Use the existing `errorHandler` and `catchAsync` utilities located in `src/lib/` and `src/middlewares/`. Always respond with proper semantic HTTP status codes.
7. **Database Transactions:** If an HR operation requires multiple dependent writes, you must use Prisma's `$transaction` API to guarantee data consistency and prevent race conditions in MySQL.

## Git & Commit Formatting

8. **Strict Commit Format (Conventional Commits):** Whenever I explicitly instruct you to generate a commit message or commit a specific set of changes, you MUST strictly adhere to the Conventional Commits specification.

- **Format:** `<type>(<scope>): <subject>`
- **Types allowed:** `feat`, `fix`, `refactor`, `test`, `docs`, `chore`.
- **Examples:** `feat(admin): implement JWT test helper utility`, `fix(db): resolve foreign key constraint in test teardown`, `refactor(auth): migrate token validation to strict TypeScript`.
- When generating the commit message, briefly ensure the subject line accurately reflects the actual architectural or code changes we just discussed.
