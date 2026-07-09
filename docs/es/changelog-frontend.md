# Changelog para Frontend — TalentMatch AI

**Fecha:** 2026-07-01
**Alcance:** Correcciones de validación, tipado e integridad de datos en `positions`, `vacancies`, `admin`, `users` y en el manejador global de errores. Ningún cambio de esta sesión modificó `prisma/schema.prisma` ni requirió migraciones — son cambios de código en la capa de API, no de base de datos.

---

## 1. Cambios en Endpoints

### `POST /api/positions` (crear posición)

Sin cambios en la forma del payload (mismos campos, mismos requeridos/opcionales que antes). Cambia el **comportamiento interno**: si `educationLevel` es `"NONE"` o `"HIGH_SCHOOL"` y no se envía `educationArea`, el backend ya no falla — completa automáticamente `educationArea: "N/A"` antes de guardar. Antes esto podía producir un error 500.

### `PUT /api/positions/:id` (actualizar posición)

**Cambio de comportamiento relevante para el frontend.** Antes, si el body del `PUT` omitía `optionalTechnicalSkills`, `languages` o `educationArea`, el backend los sobrescribía silenciosamente (`[]` o `"N/A"`), borrando datos existentes aunque el usuario no quisiera tocarlos. Esto ya está corregido: **cualquier campo omitido del body se conserva tal cual estaba guardado.** El `PUT` ahora es un parche real (solo se actualizan los campos presentes en el body), no un reemplazo completo del registro.

### `POST /api/vacancies` (crear vacante)

Sin cambios de contrato. `status` sigue siendo opcional (si se omite, la base de datos aplica `ACTIVE` por defecto).

### `PUT /api/vacancies/:id` (actualizar vacante)

Mismo fix que en posiciones: actualización parcial real. Campos omitidos ya no se sobrescriben.

### `PATCH /api/vacancies/:id/status`

Sin cambios de contrato ni de comportamiento.

### `POST /api/vacancies/:id/upload` (subir CVs de candidatos)

Sin cambios en la forma del payload ni de la respuesta. Cambió el manejo interno de duplicados (detección de hash repetido vía código de error de Prisma), pero la forma de la respuesta por archivo es la misma: `{ success, data }` o `{ success: false, message, error, stack }`.

### `PUT /api/admin/users/:id/role`

Sin cambios de contrato (sigue esperando `{ role: "ADMIN" | "USER" }`).

### `POST /api/users` (registro)

Sin cambios de contrato. El caso de email duplicado sigue devolviendo `409` igual que antes.

**Resumen:** ningún endpoint agregó campos nuevos obligatorios ni eliminó campos existentes del contrato público. Los cambios son de robustez interna, no de forma del payload.

---

## 2. Lógica de Validación

- **Regla `NONE` / `HIGH_SCHOOL` (Position):** cuando el nivel educativo no exige área de estudio, el frontend **puede seguir omitiendo** `educationArea` — el backend le asigna `"N/A"` automáticamente. Recomendación: si el frontend muestra este valor en pantallas de lectura (detalle de posición, reportes), mapear `"N/A"` a un texto amigable como "No aplica" en vez de mostrarlo crudo.
- **Niveles que sí requieren área** (`BACHELOR`, `TECHNICAL`, `UNIVERSITY`, `MASTER`, `DOCTORATE`) mantienen la misma validación de siempre: si falta `educationArea`, la API responde `400` con el mensaje `"Education area is required for this education level"`.
- No se agregaron restricciones nuevas sobre otros campos (`role`, `yearsOfExperience`, `technicalSkills`, etc.) — se mantienen igual que antes.

---

## 3. Errores

El **formato base** de las respuestas de error no cambió:

```json
{ "success": false, "error": "<mensaje>" }
```

y para errores de validación Zod:

```json
{
  "success": false,
  "error": "Validation error",
  "details": [{ "field": "campo", "message": "..." }]
}
```

Lo que sí cambió:

- **Nueva categoría de error mapeada a 400 (antes era 500):** si un payload pasa la validación de Zod pero es inconsistente para la base de datos (ej. un tipo de dato que Prisma rechaza), antes el backend devolvía `500` con el mensaje interno de Prisma expuesto. Ahora devuelve:

  ```json
  { "success": false, "error": "Invalid data sent to the database" }
  ```

  con status **400**. El frontend puede tratarlo como cualquier otro error de validación (mostrar como error de formulario, no como error de sistema).

- **Los mensajes de error 500 genéricos ya no exponen detalle interno en producción.** En el entorno del VPS (`NODE_ENV=production`), cualquier error no controlado explícitamente devuelve siempre:
  ```json
  { "success": false, "error": "Internal server error" }
  ```
  independientemente de la causa real. En desarrollo local sigue devolviendo el mensaje real para facilitar debugging. **El frontend no debe depender del contenido de `error` en un 500 para lógica de negocio** — solo usarlo para logging/soporte, y mostrar al usuario un mensaje genérico propio ("Ocurrió un error, intenta de nuevo").

---

## 4. Impacto / Acción requerida para Frontend

1. **No se requiere ningún cambio obligatorio en los payloads enviados.** Los formularios actuales de creación/edición de Posiciones y Vacantes siguen funcionando sin modificación.
2. **Revisar formularios de edición (PUT) de Posición y Vacante:** si el frontend tenía algún workaround para "reenviar siempre todos los campos" al editar (por precaución ante el bug de sobrescritura), ya no es necesario — pero tampoco rompe nada si se sigue haciendo así. Si el frontend ya enviaba solo los campos modificados (actualización parcial real), ese flujo ahora es seguro y se comporta como se esperaría.
3. **Manejo de errores 500 genéricos:** ajustar el frontend para no mostrar ni parsear `error` de una respuesta 500 esperando contenido técnico específico — en producción siempre será `"Internal server error"`. Usar el `statusCode` para decidir el mensaje que se muestra al usuario, no el texto de `error`.
4. **Nuevo caso 400 "Invalid data sent to the database":** si el frontend tiene un manejador genérico para errores `400` de formulario, este nuevo caso entra en el mismo flujo sin necesitar lógica adicional. Si el frontend distinguía errores por texto exacto de `error`, considerar agregar este mensaje a esa lista.
5. **Campo `educationArea` con valor `"N/A"`:** si alguna pantalla de detalle/reportes muestra `educationArea` directamente, verificar cómo se renderiza cuando el valor sea `"N/A"` y ajustar la presentación si es necesario (opcional, no bloqueante).

---

_Reporte generado a partir de `git diff` contra `main` de los archivos modificados en esta sesión: `src/validations/position.validation.ts`, `src/controllers/positions.controller.ts`, `src/controllers/vacancies.controller.ts`, `src/controllers/admin.controller.ts`, `src/controllers/users.controller.ts`, `src/index.ts`, y la migración de `src/middlewares/error/errorHandler.js` a `src/middlewares/error/errorHandler.middleware.ts`._
