# Control de cupos de vacantes — referencia de implementación

**Endpoint:** `PATCH /api/vacancies/:vacancyId/candidates/:candidateId/status`
**PR:** #149 · Merged 2026-07-23 · Commit `196c1d6`
**Archivos modificados:** `src/validations/vacancy.validation.ts`, `src/controllers/vacancies.controller.ts`, `src/routes/vacancies.ts`, `src/tests/routes/vacancies.test.ts`

---

## Contexto

`Vacancy.availableSlots` existía en el modelo desde el schema inicial, pero ninguna ruta de escritura lo leía — se capturaba en create/update y luego se ignoraba. Tampoco existía ninguna forma de que un controlador transicionara `Application.status` a `SELECCIONADO`, así que el reclutador no podía marcar a un candidato como contratado y la vacante nunca podía cerrarse sola al llenarse sus cupos.

Esta implementación agrega la primera ruta de escritura para `Application.status` y la conecta tanto al contador de cupos como al cierre automático de la vacante.

---

## Recap del modelo de dominio

```
Vacancy
  id, title, availableSlots, status (ACTIVE | PAUSED | CLOSED), userId, ...

Application                       ← tabla de unión entre Candidate y Vacancy
  id, candidateId, vacancyId, status (PENDIENTE | EN_PROCESO | SELECCIONADO | RECHAZADO)

Candidate
  id, fullName, email, userId, ...
```

La tabla `Application` es la que rastrea el ciclo de vida de un candidato dentro de una vacante específica. Cada CV subido crea una fila `Application` en estado `PENDIENTE`. El nuevo endpoint es la única ruta de escritura que mueve a un candidato por los otros estados.

---

## Capa de validación

**Archivo:** `src/validations/vacancy.validation.ts`

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

El enum `ApplicationStatus` viene directamente del cliente de Prisma, así que los valores válidos son los mismos cuatro que conoce la base de datos: `PENDIENTE`, `EN_PROCESO`, `SELECCIONADO`, `RECHAZADO`. Cualquier otro valor (ej. `"HIRED"`) se rechaza aquí con `400` antes de que corra el controlador.

Ambos params de URL se convierten a enteros, así que un segmento no numérico (ej. `/api/vacancies/abc/candidates/1/status`) también es un `400`.

---

## Registro de la ruta

**Archivo:** `src/routes/vacancies.ts`

```ts
router.patch(
  "/:vacancyId/candidates/:candidateId/status",
  validate(changeCandidateStatusSchema),
  catchAsync(changeCandidateStatus),
);
```

La ruta se registra antes de `PUT /:id` y `DELETE /:id` para evitar cualquier riesgo de colisión de paths con la ruta `PATCH /:id/status` existente (que usa un único segmento `:id`). Express las resuelve sin ambigüedad: la ruta existente tiene dos segmentos (`/:id/status`) mientras que la nueva tiene cuatro (`/:vacancyId/candidates/:candidateId/status`).

---

## Controlador

**Archivo:** `src/controllers/vacancies.controller.ts` — `changeCandidateStatus`

Todo el camino de escritura corre dentro de una única `$transaction` de Prisma. Esta es la decisión de diseño crítica: garantiza que el chequeo de cupos y la actualización de `Application` (y el cierre opcional de `Vacancy`) sean atómicos — sin escrituras parciales, sin condiciones de carrera entre requests concurrentes.

### Helper `HttpError`

Una clase privada definida antes del controlador:

```ts
class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}
```

`errorHandler` duck-tipea `.statusCode` en cualquier error lanzado, así que lanzar un `HttpError` dentro de la transacción es suficiente para propagar un status HTTP específico (404, 409) fuera del bloque `catch` directamente al cliente — sin cadenas `if/else` fuera de la transacción.

### Ejecución paso a paso dentro de `$transaction`

**1. Row-lock de la vacante**

```ts
const [vacancy] = await tx.$queryRaw<
  { id: number; availableSlots: number; status: VacancyStatus }[]
>`SELECT id, availableSlots, status FROM Vacancy WHERE id = ${vacancyId} AND userId = ${req.user!.id} FOR UPDATE`;
```

`FOR UPDATE` bloquea la fila durante toda la transacción. Esto es lo que hace seguras dos transiciones `SELECCIONADO` casi simultáneas sobre la misma vacante: el segundo request se bloquea en el `SELECT ... FOR UPDATE` hasta que la primera transacción hace commit, momento en el cual relee el `selectedCount` actualizado y puede recibir un `409` si la primera ya llenó el cupo.

Si la fila no se encuentra (vacante inválida o `userId` incorrecto), `vacancy` es `undefined` — lanza `HttpError(404, "Vacancy not found or unauthorized")`.

**2. Control por estado de la vacante**

```ts
if (vacancy.status === "CLOSED") {
  throw new HttpError(409, "This vacancy is closed; candidate status can no longer be changed");
}
```

Cualquier escritura sobre cualquier candidato en una vacante `CLOSED` se bloquea incondicionalmente — independientemente de qué `status` se esté enviando. Este chequeo ocurre antes de la búsqueda de `Application`, así que el 409 se dispara incluso si el candidato no existe.

**3. Buscar la `Application`**

```ts
const application = await tx.application.findFirst({
  where: {
    vacancyId,
    candidateId,
    candidate: { userId: req.user!.id },   // guarda cross-tenant
  },
});
if (!application) throw new HttpError(404, "Candidate is not linked to this vacancy");
```

El filtro `candidate: { userId: req.user!.id }` cierra el vector cross-tenant: un usuario que conoce un `candidateId` ajeno no puede afectarlo, porque el join a `Candidate` no coincidirá.

**4. Chequeo de cupos (solo en una nueva transición a `SELECCIONADO`)**

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

`isNewSelection` es `false` (el chequeo de cupos se omite) en dos situaciones:
- El candidato ya está en `SELECCIONADO` y el body también envía `SELECCIONADO` (reconfirmación — idempotente, nunca cuenta doble el cupo).
- El estado destino es `PENDIENTE`, `EN_PROCESO` o `RECHAZADO` — estos nunca tocan el contador.

**5. Actualizar la `Application`**

```ts
const updatedApplication = await tx.application.update({
  where: { candidateId_vacancyId: { candidateId, vacancyId } },
  data: { status: status as ApplicationStatus },
});
```

**6. Auto-cierre de la vacante si se ocupó el último cupo**

Este paso solo corre si `isNewSelection` fue `true` (es decir, pasamos el chequeo de cupos arriba):

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

Se usa el conteo post-actualización (no `selectedCount + 1`) porque otra transacción concurrente podría haber agregado una selección entre los pasos 4 y 6 — leer el conteo actual después de la escritura es el camino seguro.

**7. Respuesta**

```ts
res.status(200).json({
  success: true,
  data: {
    application: updatedApplication,
    vacancy: { id: vacancy.id, availableSlots: vacancy.availableSlots, status: vacancyStatus },
  },
});
```

`vacancyStatus` es el estado *post-transacción* — `"CLOSED"` si se disparó el auto-cierre, `"ACTIVE"` (o lo que fuera antes) en caso contrario.

---

## Contrato completo de respuesta

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

**Nota:** este endpoint devuelve `{ success, data }` directamente — NO pasa por `sendResponseOr404`, así que no hay un wrapper externo `{ response: { success, data } }`. Esto es consistente con `POST /api/vacancies`, `POST /:id/upload` y otros controladores de respuesta directa.

### Respuestas de error

Todos los errores comparten el shape `{ "success": false, "error": "<mensaje>" }`. El `400` además incluye un array `details` del middleware Zod.

| Código | Condición | Mensaje `error` |
|--------|-----------|-----------------|
| `400` | `vacancyId` o `candidateId` no son enteros positivos, o `status` no es un `ApplicationStatus` válido | `"Validation error"` (+ `details[]`) |
| `401` | Sin header `Authorization` o header inválido | _(middleware de auth)_ |
| `404` | Vacante no encontrada o mismatch de `userId` | `"Vacancy not found or unauthorized"` |
| `404` | Fila `Application` no encontrada para el par `(vacancyId, candidateId)` | `"Candidate is not linked to this vacancy"` |
| `409` | `status` de la vacante ya es `CLOSED` | `"This vacancy is closed; candidate status can no longer be changed"` |
| `409` | Todos los cupos ya están ocupados (`selectedCount >= availableSlots`) — solo en transición a `SELECCIONADO` | `"No available slots left for this vacancy"` |

---

## Resumen de reglas de negocio

1. **Cualquier cambio de estado en una vacante `CLOSED` se bloquea (409)** — independientemente de qué status se envíe o qué candidato.
2. **El chequeo de cupos solo se dispara en una nueva transición a `SELECCIONADO`.** Mover un candidato a `PENDIENTE`, `EN_PROCESO` o `RECHAZADO` nunca toca el contador. Reconfirmar a un candidato ya en `SELECCIONADO` también es seguro (la guarda `isNewSelection` previene el doble conteo).
3. **El auto-cierre viene inline en la misma respuesta.** Si aceptar a este candidato llena el último cupo, `data.vacancy.status` viene `"CLOSED"` en el mismo 200 — el frontend no necesita una segunda request para saber que la vacante se acaba de cerrar.
4. **Sin reapertura automática.** Una vez `CLOSED`, la vacante permanece cerrada independientemente de lo que pase con los candidatos (des-seleccionar, agregar nuevos candidatos, subir `availableSlots` vía `PUT`). Reabrir requiere un `PATCH /api/vacancies/:id/status` explícito con `{ "status": "ACTIVE" }`.
5. **Seguridad ante concurrencia.** El row-lock `SELECT ... FOR UPDATE` garantiza que dos intentos de contratación simultáneos para la misma vacante no puedan ambos pasar el chequeo de cupos.

---

## Cobertura de tests

**Archivo:** `src/tests/routes/vacancies.test.ts` — `describe("PATCH /api/vacancies/:vacancyId/candidates/:candidateId/status")`

11 casos de test que cubren:

| # | Escenario | Esperado |
|---|-----------|----------|
| 1 | Happy path — `EN_PROCESO` en vacante `ACTIVE` con 2 cupos | `200`, `application.status = "EN_PROCESO"`, `vacancy.status = "ACTIVE"` |
| 2 | `SELECCIONADO` llena el último cupo (1 de 1) | `200`, `vacancy.status = "CLOSED"` persistido en BD |
| 3 | `SELECCIONADO` cuando quedan cupos (1 de 2) | `200`, `vacancy.status = "ACTIVE"` |
| 4 | `SELECCIONADO` cuando todos los cupos ya están ocupados | `409`, `error` coincide con `/no available slots/i`, status de `Application` sin cambios (verificado en BD) |
| 5 | Reconfirmar a un candidato ya en `SELECCIONADO` | `200`, sin doble conteo |
| 6 | Cualquier cambio en vacante `CLOSED` | `409`, `error` coincide con `/closed/i` |
| 7 | Candidato existe pero no tiene `Application` para esta vacante | `404`, `error` coincide con `/not linked/i` |
| 8 | ID de vacante no existe | `404` |
| 9 | Vacante pertenece a otro usuario (cross-tenant) | `404` |
| 10 | Valor de `status` inválido (ej. `"HIRED"`) | `400`, `details` contiene error de campo `body.status` |
| 11 | Sin header `Authorization` | `401` |

Nuevos helpers de test agregados para esta suite:

- `seedApplication(candidateId, vacancyId, status?)` — crea una fila `Application`. Estado por defecto `"PENDIENTE"`.
- `seedVacancy(...)` recibió un parámetro opcional `availableSlots` (default `1`, todos los call sites existentes quedan sin cambios).
- El bloque happy-path de `POST /:id/evaluations` en el `vacancies.test.ts` existente también fue corregido: ahora siembra la fila `Application` requerida que el controlador de evaluaciones lee (esta era una brecha de test existente expuesta por el refactor del PR #146 que fuente las evaluaciones desde `Application`).
