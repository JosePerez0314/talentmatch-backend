# Vacancy slot enforcement — implementation reference

**Endpoint:** `PATCH /api/vacancies/:vacancyId/candidates/:candidateId/status`
**PR:** #149 · Merged 2026-07-23 · Commit `196c1d6`
**Files changed:** `src/validations/vacancy.validation.ts`, `src/controllers/vacancies.controller.ts`, `src/routes/vacancies.ts`, `src/tests/routes/vacancies.test.ts`

---

## Context

`Vacancy.availableSlots` existed on the model since the initial schema, but was never read by any write path — it was captured on create/update and then ignored. There was also no way for any controller to transition `Application.status` to `SELECCIONADO`, so the recruiter had no way to mark a candidate as hired and the vacancy could never close itself once its slots were full.

This implementation adds the first write path for `Application.status` and wires it to both the slot counter and an automatic vacancy close-out.

---

## Domain model recap

```
Vacancy
  id, title, availableSlots, status (ACTIVE | PAUSED | CLOSED), userId, ...

Application                       ← join table between Candidate and Vacancy
  id, candidateId, vacancyId, status (PENDIENTE | EN_PROCESO | SELECCIONADO | RECHAZADO)

Candidate
  id, fullName, email, userId, ...
```

The `Application` table is what tracks a candidate's lifecycle within a specific vacancy. Every uploaded CV creates an `Application` row in `PENDIENTE` status. The new endpoint is the only write path that moves a candidate through the other statuses.

---

## Validation layer

**File:** `src/validations/vacancy.validation.ts`

```ts
export const changeCandidateStatusSchema = z.object({
  params: z.object({
    vacancyId:   z.coerce.number().int().positive("Invalid vacancy ID"),
    candidateId: z.coerce.number().int().positive("Invalid candidate ID"),
  }),
  body: z.object({
    status: z.enum(Object.values(ApplicationStatus) as [string, ...string[]]),
  }),
});
```

The `ApplicationStatus` enum comes directly from the Prisma client, so the valid values are the same four the database knows: `PENDIENTE`, `EN_PROCESO`, `SELECCIONADO`, `RECHAZADO`. Any other value (e.g. `"HIRED"`) is rejected here with `400` before the controller runs.

Both URL params are coerced to integers, so a non-numeric segment (e.g. `/api/vacancies/abc/candidates/1/status`) is also a `400`.

---

## Route registration

**File:** `src/routes/vacancies.ts`

```ts
router.patch(
  "/:vacancyId/candidates/:candidateId/status",
  validate(changeCandidateStatusSchema),
  catchAsync(changeCandidateStatus),
);
```

The route is registered before `PUT /:id` and `DELETE /:id` to avoid any path-collision risk with the existing `PATCH /:id/status` route (which uses a single `:id` segment). Express resolves these two unambiguously: the existing route has two segments (`/:id/status`) while the new one has four (`/:vacancyId/candidates/:candidateId/status`).

---

## Controller

**File:** `src/controllers/vacancies.controller.ts` — `changeCandidateStatus`

The entire write path runs inside a single Prisma `$transaction`. This is the critical design decision: it ensures that the slot check and the `Application` update (and the optional `Vacancy` close) are atomic — no partial writes, no race conditions between concurrent requests.

### `HttpError` helper

A private class defined above the controller:

```ts
class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}
```

`errorHandler` duck-types `.statusCode` on any thrown error, so throwing an `HttpError` inside the transaction is enough to propagate a specific HTTP status (404, 409) out of the `catch` block directly to the client — without any `if/else` chains outside the transaction.

### Step-by-step execution inside `$transaction`

**1. Row-lock the vacancy**

```ts
const [vacancy] = await tx.$queryRaw<
  { id: number; availableSlots: number; status: VacancyStatus }[]
>`SELECT id, availableSlots, status FROM Vacancy WHERE id = ${vacancyId} AND userId = ${req.user!.id} FOR UPDATE`;
```

`FOR UPDATE` locks the row for the duration of the transaction. This is what makes two near-simultaneous `SELECCIONADO` transitions on the same vacancy safe: the second request blocks on the `SELECT ... FOR UPDATE` until the first transaction commits, at which point it re-reads the updated `selectedCount` and may receive a `409` if the first already filled the slot.

If the row is not found (wrong `vacancyId` or wrong `userId`), `vacancy` is `undefined` — throws `HttpError(404, "Vacancy not found or unauthorized")`.

**2. Gate on vacancy status**

```ts
if (vacancy.status === "CLOSED") {
  throw new HttpError(409, "This vacancy is closed; candidate status can no longer be changed");
}
```

Any write to any candidate in a `CLOSED` vacancy is blocked unconditionally — regardless of which `status` is being sent. This check comes before the `Application` lookup, so the 409 fires even if the candidate doesn't exist.

**3. Find the `Application`**

```ts
const application = await tx.application.findFirst({
  where: {
    vacancyId,
    candidateId,
    candidate: { userId: req.user!.id },   // cross-tenant guard
  },
});
if (!application) throw new HttpError(404, "Candidate is not linked to this vacancy");
```

The `candidate: { userId: req.user!.id }` filter closes the cross-tenant vector: a user who knows a foreign `candidateId` but doesn't own it cannot affect it, because the join to `Candidate` will fail to match.

**4. Slot check (only on a new `SELECCIONADO` transition)**

```ts
const isNewSelection =
  status === "SELECCIONADO" && application.status !== "SELECCIONADO";

if (isNewSelection) {
  const selectedCount = await tx.application.count({
    where: { vacancyId, status: "SELECCIONADO" },
  });
  if (selectedCount >= vacancy.availableSlots) {
    throw new HttpError(409, "No available slots left for this vacancy");
  }
}
```

`isNewSelection` is `false` (slot check is skipped) in two situations:
- The candidate is already `SELECCIONADO` and the body also sends `SELECCIONADO` (re-confirmation — idempotent, never double-counts the slot).
- The target status is `PENDIENTE`, `EN_PROCESO`, or `RECHAZADO` — these never touch the slot counter.

**5. Update the `Application`**

```ts
const updatedApplication = await tx.application.update({
  where: { candidateId_vacancyId: { candidateId, vacancyId } },
  data: { status: status as ApplicationStatus },
});
```

**6. Auto-close the vacancy if the last slot is now taken**

This step only runs if `isNewSelection` was `true` (i.e. we passed the slot check above):

```ts
if (isNewSelection) {
  const selectedCountAfter = await tx.application.count({
    where: { vacancyId, status: "SELECCIONADO" },
  });
  if (selectedCountAfter >= vacancy.availableSlots) {
    await tx.vacancy.update({
      where: { id: vacancyId },
      data: { status: "CLOSED" },
    });
    vacancyStatus = "CLOSED";
  }
}
```

The post-update count is used (not `selectedCount + 1`) because another concurrent transaction might have added a selection between steps 4 and 6 — reading the current count after the write is the safe path.

**7. Return**

```ts
res.status(200).json({
  success: true,
  data: {
    application: updatedApplication,
    vacancy: { id: vacancy.id, availableSlots: vacancy.availableSlots, status: vacancyStatus },
  },
});
```

`vacancyStatus` is the *post-transaction* status — `"CLOSED"` if the auto-close fired, `"ACTIVE"` (or whatever it was before) otherwise.

---

## Full response contract

### `200 OK`

```json
{
  "success": true,
  "data": {
    "application": {
      "id": 1,
      "candidateId": 1,
      "vacancyId": 1,
      "status": "SELECCIONADO",
      "createdAt": "2026-07-23T...",
      "updatedAt": "2026-07-23T..."
    },
    "vacancy": {
      "id": 1,
      "availableSlots": 2,
      "status": "ACTIVE"
    }
  }
}
```

**Note:** this endpoint returns `{ success, data }` directly — it does NOT go through `sendResponseOr404`, so there is no outer `{ response: { success, data } }` wrapper. This is consistent with `POST /api/vacancies`, `POST /:id/upload`, and other direct-response controllers.

### Error responses

All errors share the shape `{ "success": false, "error": "<message>" }`. The `400` also includes a `details` array from the Zod middleware.

| Code | Condition | `error` message |
|------|-----------|-----------------|
| `400` | `vacancyId` or `candidateId` not a positive integer, or `status` not a valid `ApplicationStatus` | `"Validation error"` (+ `details[]`) |
| `401` | No or invalid `Authorization` header | _(auth middleware)_ |
| `404` | Vacancy not found or `userId` mismatch | `"Vacancy not found or unauthorized"` |
| `404` | `Application` row not found for `(vacancyId, candidateId)` pair | `"Candidate is not linked to this vacancy"` |
| `409` | Vacancy `status` is already `CLOSED` | `"This vacancy is closed; candidate status can no longer be changed"` |
| `409` | All slots already filled (`selectedCount >= availableSlots`) — only on a `SELECCIONADO` transition | `"No available slots left for this vacancy"` |

---

## Business rules summary

1. **Any status change on a `CLOSED` vacancy is blocked (409)** — regardless of which status is sent or which candidate.
2. **Slot check only fires on a new `SELECCIONADO` transition.** Moving a candidate to `PENDIENTE`, `EN_PROCESO`, or `RECHAZADO` never touches the slot counter. Re-confirming a candidate already in `SELECCIONADO` is also safe (the `isNewSelection` guard prevents double-counting).
3. **Auto-close is inline in the same response.** If accepting this candidate fills the last slot, `data.vacancy.status` is `"CLOSED"` in the same 200 — the frontend does not need a second request to know the vacancy just closed.
4. **No automatic reopening.** Once `CLOSED`, the vacancy stays closed regardless of what happens to candidates (un-selecting, adding new candidates, raising `availableSlots` via `PUT`). Reopening requires an explicit `PATCH /api/vacancies/:id/status` with `{ "status": "ACTIVE" }`.
5. **Concurrency safety.** The `SELECT ... FOR UPDATE` row-lock ensures two simultaneous hire attempts for the same vacancy cannot both pass the slot check.

---

## Test coverage

**File:** `src/tests/routes/vacancies.test.ts` — `describe("PATCH /api/vacancies/:vacancyId/candidates/:candidateId/status")`

11 test cases covering:

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Happy path — `EN_PROCESO` on an `ACTIVE` vacancy with 2 slots | `200`, `application.status = "EN_PROCESO"`, `vacancy.status = "ACTIVE"` |
| 2 | `SELECCIONADO` fills the last slot (1 of 1) | `200`, `vacancy.status = "CLOSED"` persisted in DB |
| 3 | `SELECCIONADO` when slots remain (1 of 2) | `200`, `vacancy.status = "ACTIVE"` |
| 4 | `SELECCIONADO` when all slots already taken | `409`, `error` matches `/no available slots/i`, `Application` status unchanged (verified in DB) |
| 5 | Re-confirm an already `SELECCIONADO` candidate | `200`, no double-counting |
| 6 | Any change on a `CLOSED` vacancy | `409`, `error` matches `/closed/i` |
| 7 | Candidate exists but has no `Application` for this vacancy | `404`, `error` matches `/not linked/i` |
| 8 | Vacancy ID does not exist | `404` |
| 9 | Vacancy belongs to another user (cross-tenant) | `404` |
| 10 | Invalid `status` value (e.g. `"HIRED"`) | `400`, `details` contains `body.status` field error |
| 11 | No `Authorization` header | `401` |

New test helpers added for this suite:

- `seedApplication(candidateId, vacancyId, status?)` — creates an `Application` row. Default status `"PENDIENTE"`.
- `seedVacancy(...)` gained an optional `availableSlots` parameter (default `1`, existing call sites unchanged).
- The existing `vacancies.test.ts` `POST /:id/evaluations` happy-path block was also corrected: it now seeds the required `Application` row that the evaluations controller reads from (this was an existing test gap exposed by the PR #146 refactor that sourced evaluations from `Application`).
