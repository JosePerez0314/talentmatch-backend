# Frontend Changelog — TalentMatch AI

**Date:** 2026-07-01
**Scope:** Validation, typing and data-integrity fixes in `positions`, `vacancies`, `admin`, `users` and in the global error handler. No change in this session modified `prisma/schema.prisma` or required migrations — these are code changes in the API layer, not the database.

---

## 1. Endpoint changes

### `POST /api/positions` (create position)

No change to the payload shape (same fields, same required/optional as before). What changes is the **internal behavior**: if `educationLevel` is `"NONE"` or `"HIGH_SCHOOL"` and `educationArea` is not sent, the backend no longer fails — it automatically fills `educationArea: "N/A"` before saving. This could previously produce a 500 error.

### `PUT /api/positions/:id` (update position)

**Behavior change relevant to the frontend.** Previously, if the `PUT` body omitted `optionalTechnicalSkills`, `languages` or `educationArea`, the backend silently overwrote them (`[]` or `"N/A"`), deleting existing data even if the user didn't want to touch it. This is now fixed: **any field omitted from the body is preserved as it was stored.** The `PUT` is now a real patch (only the fields present in the body are updated), not a full replacement of the record.

### `POST /api/vacancies` (create vacancy)

No contract change. `status` remains optional (if omitted, the database applies `ACTIVE` by default).

### `PUT /api/vacancies/:id` (update vacancy)

Same fix as positions: real partial update. Omitted fields are no longer overwritten.

### `PATCH /api/vacancies/:id/status`

No contract or behavior change.

### `POST /api/vacancies/:id/upload` (upload candidate CVs)

No change to the payload or response shape. The internal handling of duplicates changed (repeated-hash detection via a Prisma error code), but the per-file response shape is the same: `{ success, data }` or `{ success: false, message, error, stack }`.

### `PUT /api/admin/users/:id/role`

No contract change (still expects `{ role: "ADMIN" | "USER" }`).

### `POST /api/users` (registration)

No contract change. The duplicate-email case still returns `409` as before.

**Summary:** no endpoint added new required fields or removed existing fields from the public contract. The changes are about internal robustness, not payload shape.

---

## 2. Validation logic

- **`NONE` / `HIGH_SCHOOL` rule (Position):** when the education level does not require a field of study, the frontend **can keep omitting** `educationArea` — the backend assigns `"N/A"` automatically. Recommendation: if the frontend shows this value on read screens (position detail, reports), map `"N/A"` to a friendly text like "Not applicable" instead of showing it raw.
- **Levels that do require an area** (`BACHELOR`, `TECHNICAL`, `UNIVERSITY`, `MASTER`, `DOCTORATE`) keep the same validation as always: if `educationArea` is missing, the API responds `400` with the message `"Education area is required for this education level"`.
- No new constraints were added on other fields (`role`, `yearsOfExperience`, `technicalSkills`, etc.) — they remain as before.

---

## 3. Errors

The **base format** of error responses did not change:

```json
{ "success": false, "error": "<message>" }
```

and for Zod validation errors:

```json
{
  "success": false,
  "error": "Validation error",
  "details": [{ "field": "field", "message": "..." }]
}
```

What did change:

- **New error category mapped to 400 (previously 500):** if a payload passes Zod validation but is inconsistent for the database (e.g. a data type Prisma rejects), the backend previously returned `500` with Prisma's internal message exposed. Now it returns:

  ```json
  { "success": false, "error": "Invalid data sent to the database" }
  ```

  with status **400**. The frontend can treat it like any other validation error (show it as a form error, not a system error).

- **Generic 500 error messages no longer expose internal detail in production.** In the VPS environment (`NODE_ENV=production`), any error not explicitly handled always returns:
  ```json
  { "success": false, "error": "Internal server error" }
  ```
  regardless of the real cause. In local development it still returns the real message to ease debugging. **The frontend must not depend on the content of `error` in a 500 for business logic** — only use it for logging/support, and show the user its own generic message ("An error occurred, please try again").

---

## 4. Impact / Action required for Frontend

1. **No mandatory change is required in the payloads sent.** The current create/edit forms for Positions and Vacancies keep working without modification.
2. **Review the edit (PUT) forms for Position and Vacancy:** if the frontend had any workaround to "always resend all fields" when editing (as a precaution against the overwrite bug), it is no longer necessary — but nothing breaks if it keeps doing so. If the frontend already sent only the modified fields (real partial update), that flow is now safe and behaves as expected.
3. **Handling generic 500 errors:** adjust the frontend to not show or parse `error` from a 500 response expecting specific technical content — in production it will always be `"Internal server error"`. Use the `statusCode` to decide the message shown to the user, not the `error` text.
4. **New 400 case "Invalid data sent to the database":** if the frontend has a generic handler for form `400` errors, this new case flows into it without needing extra logic. If the frontend distinguished errors by exact `error` text, consider adding this message to that list.
5. **`educationArea` field with value `"N/A"`:** if any detail/report screen shows `educationArea` directly, verify how it renders when the value is `"N/A"` and adjust the presentation if needed (optional, non-blocking).

---

_Report generated from `git diff` against `main` of the files modified in this session: `src/validations/position.validation.ts`, `src/controllers/positions.controller.ts`, `src/controllers/vacancies.controller.ts`, `src/controllers/admin.controller.ts`, `src/controllers/users.controller.ts`, `src/index.ts`, and the migration of `src/middlewares/error/errorHandler.js` to `src/middlewares/error/errorHandler.middleware.ts`._
