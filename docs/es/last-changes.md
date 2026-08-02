# Bitácora de cambios recientes

**Alcance:** todo lo implementado **después** del estado descrito en la versión anterior de este documento (`CAMBIOS_SIN_COMMIT.md`, que cubría la infraestructura de testing de admin — setup de Jest/Supertest, base de datos `talentmatch_test`, helpers de JWT para tests, la separación `app.ts`/`index.ts` y `admin.test.ts`). Ese trabajo ya está commiteado (`286ccc3 "Test admin (#129)"`). Este documento parte desde ahí.

Todos los commits referenciados abajo están en la rama `test/departments`.

---

## Índice

- [1. Puesta al día del entorno local (máquina nueva)](#1-puesta-al-día-del-entorno-local-máquina-nueva)
- [2. Error handler: la severidad del log ahora coincide con el status HTTP](#2-error-handler-la-severidad-del-log-ahora-coincide-con-el-status-http)
- [3. Error handler: los errores de Prisma ahora mapean al status HTTP correcto](#3-error-handler-los-errores-de-prisma-ahora-mapean-al-status-http-correcto)
- [4. `CLAUDE.md` reescrito en inglés, con una política de formato de commits](#4-claudemd-reescrito-en-inglés-con-una-política-de-formato-de-commits)
- [5. `CLAUDE.md` expandido con secciones de Commands, Architecture y Testing](#5-claudemd-expandido-con-secciones-de-commands-architecture-y-testing)
- [6. Suite de tests completa para `/api/departments`](#6-suite-de-tests-completa-para-apidepartments)
- [7. Brechas conocidas dejadas sin arreglar a propósito](#7-brechas-conocidas-dejadas-sin-arreglar-a-propósito)
- [8. Suite de tests reorganizada en un árbol `src/tests/` dedicado](#8-suite-de-tests-reorganizada-en-un-árbol-srctests-dedicado)
- [9. Runner de tests personalizado: target explícito, atajo por nombre, prompt de servicios externos](#9-runner-de-tests-personalizado-target-explícito-atajo-por-nombre-prompt-de-servicios-externos)
- [10. Nuevas suites de rutas: positions, vacancies, users, candidates, dashboard](#10-nuevas-suites-de-rutas-positions-vacancies-users-candidates-dashboard)
- [11. Credenciales reales de OpenAI/Cloudinary para tests externos opt-in](#11-credenciales-reales-de-openaicloudinary-para-tests-externos-opt-in)
- [12. `npm test upload`: benchmark de throughput de subida de 100 CVs](#12-npm-test-upload-benchmark-de-throughput-de-subida-de-100-cvs)
- [13. Retry de `pdf-parse` para dejar de perder CVs en errores transitorios](#13-retry-de-pdf-parse-para-dejar-de-perder-cvs-en-errores-transitorios)
- [14. `CLAUDE.md` actualizado para documentar la revisión del testing](#14-claudemd-actualizado-para-documentar-la-revisión-del-testing)
- [15. Endpoint nuevo: cambio de estado de candidato con control de cupos de la vacante](#15-endpoint-nuevo-cambio-de-estado-de-candidato-con-control-de-cupos-de-la-vacante)
- [16. Fix: lista y detalle de vacantes ahora incluyen datos de la posición](#16-fix-lista-y-detalle-de-vacantes-ahora-incluyen-datos-de-la-posición)
- [17. Fix: scoping del hash de candidato por usuario y pipeline de evaluación basado en Application](#17-fix-scoping-del-hash-de-candidato-por-usuario-y-pipeline-de-evaluación-basado-en-application)
- [18. Fix: motor de scoring — cuatro defectos corregidos](#18-fix-motor-de-scoring--cuatro-defectos-corregidos)
- [19. Fix: forma de respuesta uniforme — doble envoltura de `sendResponseOr404` eliminada](#19-fix-forma-de-respuesta-uniforme--doble-envoltura-de-sendresponseor404-eliminada)
- [20. Fix: errores de archivo de Multer ahora devuelven 400 en vez de 500](#20-fix-errores-de-archivo-de-multer-ahora-devuelven-400-en-vez-de-500)
- [21. Fix: dashboard `vacancyStatusBreakdown` — CONTACTING reemplazado por PAUSED](#21-fix-dashboard-vacancystatusbreakdown--contacting-reemplazado-por-paused)
- [22. Fix: paginación agregada a todos los endpoints de listado principales](#22-fix-paginación-agregada-a-todos-los-endpoints-de-listado-principales)
- [23. Fix: `GET /api/vacancies` ahora obtiene candidatos vía join de Application](#23-fix-get-apivacancies-ahora-obtiene-candidatos-vía-join-de-application)
- [24. Fix: `DELETE /api/vacancies/:id` evita la cascada multi-ruta de MySQL](#24-fix-delete-apivacanciesid-evita-la-cascada-multi-ruta-de-mysql)

---

## 1. Puesta al día del entorno local (máquina nueva)

**El problema:** el documento anterior se escribió en una máquina distinta. Esta tenía el código commiteado (`package.json`, `jest.config.js`, etc.) pero le faltaba todo lo que vive fuera del control de versiones: `node_modules` no estaba sincronizado y la base de datos/usuario `talentmatch_test` no existía localmente.

**Qué se hizo:**

- Se corrió `npm install` para poner `node_modules` en línea con el `package-lock.json` ya commiteado (faltaban Jest, Supertest, babel-jest y sus paquetes `@types` en disco).
- Se creó la base de datos `talentmatch_test` y un usuario MySQL dedicado y restringido (`talentmatch_test`, con permisos acotados solo a esa base) directamente en el contenedor Docker local `talentmatch_db` — reflejando lo que el documento anterior describía como ya hecho en la máquina original.
- Se aplicaron las 11 migraciones de Prisma existentes a esa nueva base (`prisma migrate deploy`), poniendo su esquema al día con `talentmatch_db`.
- Se volvió a correr `prisma/seed.ts` contra la base local real (`talentmatch_db`) para rellenar los departamentos default del usuario admin — confirmado idempotente (basado en upsert), sin duplicados ni pérdida de datos para el departamento manual existente del admin.

**Resultado:** `npm test` corre correctamente en esta máquina sin tocar datos de desarrollo/producción.

---

## 2. Error handler: la severidad del log ahora coincide con el status HTTP

**Archivo:** `src/middlewares/error/errorHandler.middleware.ts`
**Commit:** `55a6345 fix(errors): use console.warn for expected 4xx validation errors`

**El problema:** `errorHandler` logueaba *todos* los errores igual, vía `console.error`, sin importar si era una falla real de servidor o un error rutinario del cliente (ej. enviar un valor `role` inválido). Esto hacía que un `400` de una validación normal y un `500` genuino de crash se vieran idénticos en los logs — ruidoso en la práctica, y riesgoso si los logs de nivel error alguna vez se conectan a alertas, ya que las fallas reales se perderían en el ruido de los malos requests cotidianos.

**Qué cambió:** el logger ahora ramifica según la severidad *efectiva* del error:

- `ZodError`, errores "known request" de Prisma que resuelven a `4xx`, y cualquier error con un `statusCode < 500` explícito → `console.warn`.
- Todo lo que resuelve a `5xx` (incluidos errores realmente inesperados) → `console.error`.
- El caso límite `res.headersSent` (un error que llega después de que la respuesta ya empezó) sigue logueando vía `console.error`, ya que ese escenario siempre es anómalo.

No cambió ningún cuerpo de respuesta ni status code en este paso — solo el logging.

---

## 3. Error handler: los errores de Prisma ahora mapean al status HTTP correcto

**Archivo:** `src/middlewares/error/errorHandler.middleware.ts`
**Commit:** `b2f6fab fix(errors): map Prisma P2002 to 409 and P2025 to 404`

**El problema:** `errorHandler` trataba todo `Prisma.PrismaClientKnownRequestError` idénticamente — siempre un genérico `400 "Invalid data sent to the database"`. Eso es semánticamente incorrecto para dos casos muy comunes que surgieron al construir la suite de tests de Departments:

- Crear un registro que viola un constraint único (ej. un título de departamento duplicado para el mismo usuario) es un **conflicto**, no un bad request.
- Actualizar o borrar un registro cuyo `:id` no existe (o no pertenece al usuario que solicita) es **not found**, no un bad request.

**Qué cambió:** se agregaron dos nuevas ramas antes del fallback genérico de Prisma:

- `err.code === "P2002"` (violación de constraint único) → `409 Conflict`.
- `err.code === "P2025"` (registro requerido para la operación no encontrado) → `404 Not Found`.
- Todo otro error de Prisma mantiene el comportamiento previo: `400` genérico.

Esto arregló directamente el comportamiento observado en Departments: la creación con título duplicado ahora devuelve `409` en vez de `400`, y actualizar/borrar un departamento inexistente (o de otro usuario) ahora devuelve `404` en vez de `400`.

---

## 4. `CLAUDE.md` reescrito en inglés, con una política de formato de commits

**Commit:** `f996162 docs(claude): translate rules to english and add commit format policy`

- Se tradujo el archivo entero de español a inglés (Project Context + las 7 reglas de ejecución existentes), sin cambios de comportamiento en las reglas mismas.
- Se agregó una nueva regla (`8. Strict Commit Format`): todos los commits solicitados explícitamente a Claude deben seguir Conventional Commits (`<type>(<scope>): <subject>`, tipos limitados a `feat`, `fix`, `refactor`, `test`, `docs`, `chore`). Todo commit referenciado en este documento sigue ese formato.

---

## 5. `CLAUDE.md` expandido con secciones de Commands, Architecture y Testing

**Commit:** `22c6444 docs(claude): add commands, architecture, and testing sections`

Corrido vía `/init` para poner `CLAUDE.md` al día como referencia de onboarding para futuras sesiones de Claude Code, sin tocar las reglas de ejecución existentes ni la política de commits. Se agregó:

- **Commands:** install, BD local, servidor de dev, type-check, build/start, invocaciones de test (incluidas las formas de un solo archivo y de un solo nombre de test) y los comandos de Prisma (`generate`, `migrate dev`, `db seed`).
- **Architecture:** el flujo de request por capas, la separación `app.ts`/`index.ts` y por qué existe, el aislamiento multi-tenant vía `req.user.id`, el mapeo de status codes del error handler central (reflejando los cambios de las secciones 2–3 arriba), la jerarquía de dominio `Department → Position → Vacancy → Candidate` (incluida la nota `onDelete: Cascade` relevante para la sección 6), el pipeline de CVs, el motor de scoring y el estado híbrido JS/TS de la base de código.
- **Testing:** cómo funciona realmente el setup de Jest/Supertest en la práctica (ejecución serial, `babel-jest`, el chequeo de seguridad de `.env.test`, el helper de token JWT para tests, las convenciones de archivos de test) — incluyendo una advertencia de que la mayoría de los recursos (a diferencia de admin) requieren sembrar una fila `User` real y acuñar el token desde su `id` real, ya que `req.user.id` se escribe como foreign key real.

**Nota:** mientras se implementaba esto, se encontró `CLAUDE.md` borrado del working tree (sin stage) por razones ajenas a las acciones de esta sesión. Se restauró desde el último commit (`git checkout -- CLAUDE.md`) antes de aplicar las adiciones de arriba, así que no se perdió contenido existente.

---

## 6. Suite de tests completa para `/api/departments`

**Archivo:** `src/routes/departments.test.ts` (nuevo)
**Commit:** `d7cf839 test(departments): cover CRUD, validation, auth, and relational integrity`

Siguiendo el mismo patrón establecido en `admin.test.ts` (Supertest contra el `app` real, tokens JWT de test, helpers de seed respaldados por Prisma, truncación global `beforeAll`/`afterEach`/`afterAll`), se agregaron 20 tests que cubren las 5 rutas expuestas por `src/routes/departments.ts` — confirmado como el conjunto completo (`GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`; ninguna ruta quedó sin cobertura):

- **`POST /api/departments`:** happy path `201` (y chequeo de persistencia en BD), `400` en fallo de validación Zod, `401` sin token, `409` en título duplicado para el mismo usuario.
- **`GET /api/departments`:** `401` sin token, `200` devolviendo solo los departamentos del usuario que solicita (verificado que el departamento de otro usuario se excluye — aislamiento multi-tenant).
- **`GET /api/departments/:id`:** `401` sin token, `200` happy path, `404` para un id inexistente, `404` cuando el id pertenece a otro usuario.
- **`PUT /api/departments/:id`:** `401` sin token, `200` happy path (con chequeo de persistencia en BD), `400` en fallo de validación Zod (el título original queda sin cambios), `404` para un id inexistente, `404` cuando el id pertenece a otro usuario (el departamento objetivo queda sin cambios).
- **`DELETE /api/departments/:id`:** `401` sin token, `200` happy path cuando el departamento no tiene Posiciones enlazadas, `404` para un id inexistente, `404` cuando el id pertenece a otro usuario (el departamento sigue existiendo después), y un test que documenta el comportamiento real de borrado relacional (ver sección 7 abajo).

Un detalle de implementación digno de mención: a diferencia de `admin.test.ts` (cuyos endpoints agregan a través de todos los datos y nunca usan `req.user.id` como foreign key de base de datos, así que un `userId` hardcodeado en el token funciona bien), el controlador de Departments escribe `req.user!.id` como foreign key real en cada create. Así que cada test aquí siembra primero una fila `User` real y acuña su token desde el `id` real de esa fila, en vez de un valor hardcodeado.

---

## 7. Brechas conocidas dejadas sin arreglar a propósito

Dos cosas surgieron al escribir los tests de Departments que **no** se cambiaron, porque arreglarlas requeriría tocar esquema/migraciones o un refactor más amplio fuera del alcance de esta tarea:

1. **`DELETE` con Posiciones enlazadas no rechaza — cascadea.** `prisma/schema.prisma` actualmente define `Position.department` con `onDelete: Cascade`. Así que borrar un Departamento que todavía tiene Posiciones adjuntas **no** falla con un error de foreign key `P2003` — tiene éxito y borra las Posiciones junto con él. El test correspondiente en `departments.test.ts` documenta este comportamiento real explícitamente en vez de aseverar un rechazo. Hacer el borrado bloqueante (como se especificó originalmente) requeriría cambiar esa relación a `onDelete: Restrict` y generar/aplicar una nueva migración de Prisma — un cambio de esquema/infraestructura que requiere autorización separada.
2. **Forma de respuesta de éxito inconsistente.** `GET /api/departments`, `GET /api/departments/:id` y los happy paths de `PUT`/`DELETE` (todos ruteados a través de `sendResponseOr404` en `src/lib/responseHandler.ts`) devuelven un cuerpo doblemente anidado como `{ response: { success, data } }`, mientras que `POST /api/departments` y cada endpoint de admin devuelven `{ success, data }` directo. Los tests aseveran contra la forma real y actual de cada endpoint. Unificar esto tocaría `responseHandler.ts` y es una inconsistencia preexistente, no algo introducido por este trabajo.

---

## 8. Suite de tests reorganizada en un árbol `src/tests/` dedicado

**Commit:** `6e22c43 refactor(tests): relocate suites and helpers into a dedicated src/tests tree`

**El problema:** los archivos de test vivían *dentro* de las carpetas de código fuente de producción — `src/routes/admin.test.ts`, `src/routes/departments.test.ts` junto a los handlers de ruta reales, y los helpers compartidos en `src/test-utils/`. El objetivo (solicitado explícitamente) era mantener los archivos `.test.ts` y sus helpers completamente fuera de las carpetas de producción, mientras se sigue corriendo bajo el setup existente de `babel-jest`.

**Qué cambió (movido, sin cambios de lógica):**

- `src/routes/admin.test.ts` → `src/tests/routes/admin.test.ts`
- `src/routes/departments.test.ts` → `src/tests/routes/departments.test.ts`
- `src/test-utils/db.util.ts` → `src/tests/utils/db.util.ts`
- `src/test-utils/jwt.util.ts` → `src/tests/utils/jwt.util.ts`

**Modificado:**

- Los imports relativos dentro de los archivos movidos, actualizados un nivel más profundo (`../app.js` → `../../app.js`, `../test-utils/jwt.util.js` → `../utils/jwt.util.js`, etc.).
- `jest.setup.afterEnv.ts` — import del helper reapuntado a `./src/tests/utils/db.util.js`.
- `tsconfig.build.json` — el exclude previo `src/test-utils/**` reemplazado por `src/tests/**`, así que todo el árbol de tests (ahora incluidos los helpers que no son `.test.ts`) se mantiene fuera del build de producción.

**Por qué este layout:** `jest.config.js` ya matchea `src/**/*.test.ts`, así que no se necesitó cambiar la config de test. Los tests siguen transpilando a través de `babel-jest`. Un árbol paralelo `src/tests/` espeja la estructura del código que cubre sin contaminar las carpetas de rutas.

---

## 9. Runner de tests personalizado: target explícito, atajo por nombre, prompt de servicios externos

**Commit:** `9b71703 chore(tests): add a test runner with target guard, name shortcut and external prompt`

**El problema:** `npm test` corría el `jest` pelado, que (a) corre la suite *entera* por defecto contra la única base `talentmatch_test` compartida — un desperdicio y fácil de disparar por memoria muscular — y (b) no ofrecía forma ergonómica de correr una suite por nombre, ni control sobre los tests que llaman a APIs externas pagas.

**Nuevo archivo:** `scripts/test.ts` (TypeScript, corrido vía `tsx`). Este:

- **Requiere un target explícito.** Correr `npm test` sin argumento sale con error en vez de correr todo. Un nombre mal escrito (ej. `vacacancies`) imprime la lista de suites disponibles en vez del volcado crudo "No tests found" de Jest.
- **Convierte un nombre pelado en un patrón anclado al archivo.** `npm test positions` se reescribe a un `testPathPattern` anclado al nombre del archivo (`positions[^/\\]*\.test\.ts$`). Esto es necesario en Windows: Jest matchea su argumento posicional contra la ruta *absoluta*, que empieza con `C:\Users\...`, así que un `users` sin anclar matchearía todos los archivos vía el segmento de ruta `Users`.
- **Pregunta antes de las suites de servicios externos.** Corre `jest --listTests` sobre el target; si resuelve a un archivo que contiene bloques de OpenAI/Cloudinary (`positions.test.ts`, `vacancies.test.ts`) y la shell es interactiva, pregunta `¿Ejecutarlos también? (Y/N)` y setea `RUN_EXTERNAL_TESTS` en consecuencia. Las shells no interactivas (CI, tooling) siempre los omiten. `--external` / `--no-external` saltan el prompt.
- **Auto-configura suites de performance.** Un archivo listado en `PERF_FILES` (`upload.test.ts`) fuerza `RUN_EXTERNAL_TESTS=true` y `KEEP_TEST_DATA=true` sin prompt (ver sección 12).

**Modificado:**

- `package.json` — el script `test` ahora es `tsx scripts/test.ts` (era `jest`). `test:watch` queda sin cambios.
- `tsconfig.json` — `scripts/**/*` agregado a `include` para que el runner sea type-checkeado por `npm run type-check`. (También arregló un error real del editor: `scripts/test.ts` no estaba antes en ningún proyecto, así que VS Code reportaba `Cannot find name 'node:child_process'` porque no heredaba `types: ["node"]`. `@types/node` ya estaba instalado — era puramente un tema de scope de config, no una dependencia faltante.) El build de producción (`tsconfig.build.json`) tiene su propio `include: ["src/**/*"]`, así que `scripts/` nunca se emite a `dist/`.

---

## 10. Nuevas suites de rutas: positions, vacancies, users, candidates, dashboard

**Commit:** `ba81fb6 test(routes): add positions, vacancies, users, candidates and dashboard suites`

**Objetivo:** cubrir cada endpoint de las rutas restantes y *cada camino* — no solo el happy path — espejando el patrón de admin/departments (Supertest contra el `app` real, JWTs reales vía `authHeaderFor`, helpers de seed de Prisma que crean una fila `User` real para que `req.user!.id` resuelva como foreign key real).

**Nuevos archivos:**

- `src/tests/routes/positions.test.ts` — `POST /` (201, 400 validación de role/description/technicalSkills/educationArea, 404 cross-tenant/departamento faltante, 401), `GET /` (200 scopeado por tenant, 401, token expirado 401, secreto equivocado 401), `GET /:id` (200, 400 id malo, 404 faltante, 404 cross-tenant, 401), `PUT /:id`, `DELETE /:id`, `POST /duplicate/:id` (201 sufijo `(Copy)`, 404s, 401), y `POST /complete` (401, 400 sin archivo, más el happy path externo de OpenAI+Cloudinary).
- `src/tests/routes/vacancies.test.ts` — `POST /` (201, 404 departamento, 400 departamento-sin-posiciones, 400 posición-no-en-departamento, 400 orden-de-fechas, 400 título vacío, 401), `GET /`, `GET /:id`, `PATCH /:id/status`, `PUT /:id`, `DELETE /:id` (happy + 404 + cross-tenant + 401), `GET /:id/results` (200 vacío + meta de paginación, 200 ordenado por score, aislamiento cross-tenant, 401), `POST /:id/evaluations` (404, 400 sin candidatos, 401, happy path externo), `POST /:id/upload` (400 id malo, 400 sin archivo, 401, happy path externo).
- `src/tests/routes/users.test.ts` — rutas públicas (montadas antes de auth). `POST /` (201 + departamentos default sembrados + password hasheado + email normalizado, 409 duplicado, 400 email malo, 400 password débil), `POST /login` (200 token + payload de user, login case-insensitive, 401 email desconocido, 401 password equivocado, 400 validación).
- `src/tests/routes/candidates.test.ts` — rutas de solo lectura sembradas a través del grafo completo `user → department → position → vacancy → candidate`. `GET /` (200 scopeado por tenant, 401), `GET /:id` (200, 400 id malo, 404 faltante, 404 cross-tenant, 401).
- `src/tests/routes/dashboard.test.ts` — `GET /` (200 con conteos `total` precisos + `vacancyStatusBreakdown` + `monthlyActivity`, PAUSED excluido del conteo de abiertas, scoping estricto por usuario, 401).
- `src/tests/utils/pdf.util.ts` — `makePdfBuffer(text)` construye un PDF real en memoria con `pdfkit` (los tests externos de upload/complete necesitan un PDF genuino porque el controlador corre `pdf-parse` antes de llamar a OpenAI), más fixtures `SAMPLE_CV_TEXT` / `SAMPLE_POSITION_TEXT` que pasan la compuerta de calidad por conteo de caracteres del controlador.
- `src/types/pdfkit.d.ts` — una declaración ambient mínima para `pdfkit` (que no trae tipos y cuyo paquete `@types` no está instalado), cubriendo solo la superficie que usa `pdf.util.ts`, para que el código quede libre de `any` sin agregar una dependencia.

**Happy paths externos** (OpenAI/Cloudinary) viven en bloques gateados con `describe.skip` según `RUN_EXTERNAL_TESTS`, así que solo corren cuando se habilitan explícitamente (sección 9). Las aserciones de forma de respuesta matchean el cuerpo real de cada endpoint (`{ response: { data } }` para rutas de `sendResponseOr404` vs. `{ data }` para las directas).

---

## 11. Credenciales reales de OpenAI/Cloudinary para tests externos opt-in

**Archivo:** `jest.setup.ts`
**Commit:** `ed42901 test(config): load real OpenAI/Cloudinary keys for opt-in external tests`

**El problema:** `.env.test` deliberadamente contiene valores *placeholder* de `OPENAI_API_KEY` / `CLOUDINARY_URL` ("fallar ruidosamente si un test alguna vez las llama de verdad"). Así que incluso cuando una suite externa estaba habilitada, nunca podía pasar realmente — las llamadas reales fallaban con las claves placeholder.

**Qué cambió:** después de la carga existente de `.env.test` y el guard de la BD `talentmatch_test`, un nuevo bloque corre *solo* cuando `RUN_EXTERNAL_TESTS=true`. Lee el `.env` real en runtime (`dotenv.parse(fs.readFileSync(".env"))`) y copia **solo** `OPENAI_API_KEY` y `CLOUDINARY_URL` a `process.env`.

**Por qué es seguro:**

- `dotenv.parse` devuelve un objeto y **no** muta `process.env`, así que nada más allá de esas dos claves se filtra.
- `DATABASE_URL` y `JWT_SECRET` nunca se sobrescriben — el guard de `talentmatch_test` de arriba sigue siendo la única autoridad, así que los datos de dev/prod permanecen inalcanzables aunque se parsee el `.env` real (que apunta `DATABASE_URL` a la BD de dev).
- Si `.env` falta/no se puede leer, advierte y los tests externos caen a placeholders (y fallan ruidosamente). Verificado en aislamiento con un archivo de env falso que contenía un `DATABASE_URL=...PROD` trampa y `JWT_SECRET`: solo se copiaron las dos claves externas; la URL de BD se quedó en `talentmatch_test` y el secreto JWT no se filtró.

---

## 12. `npm test upload`: benchmark de throughput de subida de 100 CVs

**Commit:** `f48dc84 test(upload): add a 100-CV upload throughput benchmark`

**Objetivo:** medir qué tan rápido el pipeline de subida de CVs llama a las APIs externas, y probar cómo maneja el límite de 100 PDFs por request y el tope de concurrencia del controlador.

**Nuevos archivos:**

- `src/tests/utils/generateMockCvs.ts` — un generador en TypeScript (reemplaza al borrado `generateMockCVs.js` de la raíz). Cada corrida limpia su directorio de salida y escribe N CVs PDF aleatorizados y totalmente poblados (nombre, rol, skills técnicos/opcionales/soft, idiomas, experiencia multi-empleo, educación). Cada CV lleva una línea `Reference ID` única para que su hash SHA-256 sea único — el controlador de subida deduplica por hash de contenido, así que PDFs idénticos colapsarían en un solo candidato y frustrarían el test de carga. Verificado con el propio extractor `pdf-parse` del controlador: 10/10 archivos válidos, todos por encima de la compuerta de 500 caracteres, todos únicos.
- `src/tests/routes/upload.test.ts` — genera 100 CVs, los sube en un request y loguea tiempo transcurrido / ms-por-CV (el controlador procesa como máximo 5 concurrentes vía `p-limit(5)`, confirmado sin cambios). Un segundo caso postea 101 archivos y asevera el tope por request: `upload.array("pdfs", 100)` rechaza el 101 con `LIMIT_UNEXPECTED_FILE` **antes** de que corra el controlador (confirmado empíricamente), así que no ocurren llamadas a OpenAI y nada se persiste.

**Modificado:**

- `jest.setup.afterEnv.ts` — los hooks globales de truncación ahora son no-op cuando `KEEP_TEST_DATA=true`, así que los candidatos del benchmark persisten entre corridas. `prisma.$disconnect()` sigue corriendo siempre. El guard de la BD `talentmatch_test` queda intacto.

**Borrado:**

- `generateMockCVs.js` (raíz del proyecto) — el viejo generador standalone, reemplazado por el módulo tipado de arriba.

**Cómo funcionan la persistencia y la limpieza:** `scripts/test.ts` marca `upload.test.ts` como archivo de perf → fuerza credenciales reales **y** `KEEP_TEST_DATA=true` sin prompt. Como la truncación está deshabilitada, la suite hace su propia limpieza: `beforeAll` borra el grafo `upload-perf@test.com` de la corrida anterior en orden seguro para FK (candidatos → vacantes → posiciones → departamentos → user), luego resiembra y regenera. Solo los últimos 100 candidatos permanecen siempre, así que la BD nunca acumula basura. Corrido fuera del runner (`jest` crudo), todo el bloque está gateado con `describe.skip` y nunca toca la API — verificado: sin credenciales reporta 2 omitidos, cero llamadas a API.

**Hallazgo conocido (sin cambiar):** exceder el tope de 100 archivos actualmente aparece como un `500` (el `MulterError` no tiene `statusCode`, así que `errorHandler` cae a 500). El límite *sí* se aplica (rechazo duro, el controlador nunca corre); solo el status code no es un `4xx` limpio. Mapear `MulterError` → `413`/`400` se dejó como seguimiento opcional.

---

## 13. Retry de `pdf-parse` para dejar de perder CVs en errores transitorios

**Archivo:** `src/lib/pdfWrapper.ts`
**Commit:** `4a08ab6 fix(pdf): retry pdf-parse extraction to avoid dropping CVs on transient errors`

**El problema (encontrado al correr el benchmark de subida):** la corrida real de 100 CVs logueó `Error processing file candidate-cv-099.pdf: bad XRef entry`. La investigación mostró que `pdf-parse` (pdf.js por debajo) es **no determinístico** cuando se parsean muchos documentos en un proceso: el *mismo buffer exacto* falla en una llamada y tiene éxito en la siguiente (reproducido ~50% de fallos en un loop apretado en el mismo proceso, mientras que reusar el mismo buffer era consistentemente correcto). Los PDFs son válidos — es estado del parser, no contenido. En el controlador real cada fallo se captura por archivo (`success: false`), así que un CV legítimo se **descarta silenciosamente** del lote.

**Qué cambió:** `extract(buffer)` ahora está envuelto en un retry acotado — hasta 6 intentos, con 50 ms de separación. Como los fallos vienen en ráfagas cortas y se recuperan, reintentar el mismo buffer los limpia. Un PDF genuinamente corrupto/encriptado igual falla en todos los intentos, y el **error original se relanza sin cambios**, así que el camino `catch` existente del controlador se preserva. La firma queda sin cambios, así que no se tocó ningún llamador.

**Verificación:** el loop apretado patológico que antes fallaba ~50% ahora tiene éxito 120/120 a través de tres corridas de 40 PDFs frescos. En el flujo real cada `extract` está espaciado por el await de OpenAI, así que los fallos ya son raros (1/100 sin ningún retry) — el retry lleva la pérdida silenciosa de candidatos a efectivamente cero.

---

## 14. `CLAUDE.md` actualizado para documentar la revisión del testing

**Commit:** (este commit del changelog)

La sección **Testing** de `CLAUDE.md` se extendió para describir todo lo de arriba para que futuras sesiones tengan una referencia precisa: el layout `src/tests/` y la ubicación de helpers, el runner `npm test <name>` (guard de target, anclaje de nombre seguro para Windows, flags de un solo test), el prompt opt-in de servicios externos y los flags `--external`/`--no-external`, la superposición en runtime de claves reales de OpenAI/Cloudinary desde `.env` (y por qué el guard de BD sigue siendo autoritativo), el benchmark `npm test upload` (auto-config de archivo de perf, `KEEP_TEST_DATA`, el tope de 100 archivos, la limpieza que conserva los últimos 100) y el retry de `pdf-parse` en `src/lib/pdfWrapper.ts`.

---

## 15. Endpoint nuevo: cambio de estado de candidato con control de cupos de la vacante

**Archivos:** `src/validations/vacancy.validation.ts`, `src/controllers/vacancies.controller.ts`, `src/routes/vacancies.ts`, `src/tests/routes/vacancies.test.ts`
**Rama:** `feat/vacancy-candidate-status` (creada desde `main` después del PR #148)
**Commits:** `c3fcefb feat(vacancies): enforce slot limits and add candidate status endpoint`, `05bffe7 docs(vacancies): document candidate status endpoint and slot enforcement rule`

**El problema:** `availableSlots` de una vacante se guardaba al crear/actualizar pero nunca se aplicaba en ningún lado. No existía forma de marcar a un candidato como contratado (`Application.status: "SELECCIONADO"`), y por lo tanto ningún camino de código cerraba una vacante al llenarse sus cupos — el campo era puramente decorativo.

**Endpoint nuevo (contrato completo, para integración del frontend):**

`PATCH /api/vacancies/:vacancyId/candidates/:candidateId/status`

Misma autenticación que el resto de `/api/vacancies` — `Authorization: Bearer <token>`, acotado a `req.user.id`.

Body de la request:

```json
{ "status": "PENDIENTE" | "EN_PROCESO" | "SELECCIONADO" | "RECHAZADO" }
```

Respuesta `200`:

```json
{
  "success": true,
  "data": {
    "application": { "id": 1, "candidateId": 1, "vacancyId": 1, "status": "SELECCIONADO", "createdAt": "...", "updatedAt": "..." },
    "vacancy": { "id": 1, "availableSlots": 2, "status": "ACTIVE" }
  }
}
```

**No va doble-envuelto** — a diferencia de `PATCH /api/vacancies/:id/status` (que pasa por `sendResponseOr404` y devuelve `{ response: { success, data } }`), este devuelve `{ success, data }` directamente.

Respuestas de error (todas `{ success: false, error: "<mensaje>" }`, más el array `details[]` estándar en el `400`):

| Código | Cuándo | Mensaje `error` |
| --- | --- | --- |
| 400 | `status` inválido, o `vacancyId`/`candidateId` inválido | `"Validation error"` |
| 404 | la vacante no existe o no pertenece al usuario | `"Vacancy not found or unauthorized"` |
| 404 | el candidato no tiene `Application` para esta vacante | `"Candidate is not linked to this vacancy"` |
| 409 | la vacante ya está `CLOSED` | `"This vacancy is closed; candidate status can no longer be changed"` |
| 409 | `availableSlots` ya se alcanzó (solo se chequea en una transición *hacia* `SELECCIONADO`) | `"No available slots left for this vacancy"` |

**Comportamiento que el frontend necesita saber:**

- Solo se verifica contra `availableSlots` una transición *hacia* `SELECCIONADO` — reconfirmar a un candidato ya `SELECCIONADO`, o cualquier otra transición (`PENDIENTE`/`EN_PROCESO`/`RECHAZADO`), nunca toca el conteo de cupos ni devuelve el error `409` de "sin cupos".
- Si aceptar a este candidato llena el último cupo, `data.vacancy.status` viene `"CLOSED"` en la **misma respuesta** — el frontend no necesita una segunda request para saber que la vacante se acaba de cerrar. Usa eso para deshabilitar de inmediato más acciones de "contratar" en esa vacante en la UI, en vez de esperar a que la siguiente falle con `409`.
- **Nunca se reabre automáticamente.** Una vez que `data.vacancy.status` es `"CLOSED"`, cualquier llamada posterior a este endpoint para esa vacante devuelve `409`, sin importar qué candidato/estado se envíe. Ni des-seleccionar a un candidato contratado ni subir `availableSlots` vía `PUT /api/vacancies/:id` la reabre. Si el reclutador quiere reabrirla, el frontend debe llamar al `PATCH /api/vacancies/:id/status` ya existente con `{ "status": "ACTIVE" }` explícitamente — es una acción separada y deliberada, este endpoint nunca la dispara solo.
- Concurrencia: dos intentos de contratación casi simultáneos sobre la *misma* vacante no pueden pasar ambos el chequeo de cupos (la fila `Vacancy` se bloquea durante toda la transacción) — el que pierde recibe el `409` de arriba, no un estado corrupto.

**Tests agregados:** 11 casos nuevos en `vacancies.test.ts` que cubren el happy path, el auto-cierre en el último cupo, el no-cierre mientras quedan cupos, el rechazo `409` (y que la escritura rechazada nunca se persiste), la re-selección idempotente, el `409` sobre una vacante ya `CLOSED`, los 404 (`Application` faltante, vacante inexistente/ajena), el caso de validación `400` y el caso `401`. El helper de test `seedVacancy` recibió un parámetro opcional `availableSlots` (default `1`, así que ningún llamado existente se ve afectado) y se agregó un helper nuevo `seedApplication`.

**Detalle completo de la regla de negocio:** `api-documentation.md` §8.6 (bilingüe, en/es).

---

## 16. Fix: lista y detalle de vacantes ahora incluyen datos de la posición

**Archivo:** `src/controllers/vacancies.controller.ts`
**Commit:** `2386e9c fix(vacancies): include position role in list and detail responses` (PR #145)

**El problema:** `GET /api/vacancies` y `GET /api/vacancies/:id` solo devolvían el FK crudo `positionId` — sin datos de posición anidados. La pantalla de resultados de vacante en el frontend necesita el rol de la posición para renderizarse correctamente, y no había forma de obtenerlo sin una segunda request a `GET /api/positions/:id`.

**Qué cambió:** ambas queries de select ahora incluyen `position: { select: { id: true, role: true } }`. El objeto de posición `{ id, role }` aparece en el nivel raíz de cada vacante devuelta tanto por el listado como por el detalle.

**Impacto:** `api-documentation.md` actualizado en ambos idiomas para reflejar el nuevo campo `position` en los shapes de respuesta de `GET /api/vacancies` y `GET /api/vacancies/:id`.

---

## 17. Fix: scoping del hash de candidato por usuario y pipeline de evaluación basado en Application

**Archivos:** `prisma/schema.prisma`, `src/controllers/vacancies.controller.ts`, `src/services/cvProcessing.service.ts`, `.github/workflows/deploy.yml`
**Commit:** `04a4ad4 Fix/candidate hash per user application` (PR #146)

Este PR corrigió tres bugs distintos.

### Bug 1 — Schema: unicidad global del hash causaba pérdida silenciosa de datos y filtración entre tenants

`Candidate.hash` era `@unique` globalmente. Esto producía dos fallos:

1. **Re-uso silencioso entre vacantes del mismo usuario.** Subir un CV que el usuario ya había subido a una vacante diferente hacía que el branch de dedup reutilizara el candidato existente *sin* crear una fila `Application` para la nueva vacante. El candidato nunca era visible para las evaluaciones de esa vacante.
2. **Filtración de datos entre tenants.** Dos usuarios distintos subiendo exactamente el mismo PDF byte a byte resolverían a la fila `Candidate` del *primer* usuario. La evaluación del segundo usuario leería datos confidenciales que nunca subió.

**Fix:** cambiado a `@@unique([userId, hash])` — la unicidad ahora está scopeada por usuario, no global. También se agregó el `onDelete: Cascade` faltante en ambas relaciones de `Application` (a `Candidate` y a `Vacancy`), requerido ahora que las filas de `Application` se escriben activamente y deben limpiarse junto con su padre.

Se generó y aplicó una nueva migración de Prisma.

### Bug 2 — Service/controller: la lógica de dedup y evaluación no usaba `Application`

- `findExistingCandidateByCv` buscaba el hash sin acotar por `userId`, así que el chequeo cross-tenant del bug 1 tampoco disparaba a nivel del servicio.
- Cuando una subida deduplicaba a un candidato existente, `uploadCandidate` retornaba sin crear un `Application` para la nueva vacante — el candidato quedaba invisible para ella.
- `evaluateCandidates` obtenía sus candidatos pendientes de `Candidate.vacancyId` (un FK único), así que un candidato reutilizado solo se evaluaba en su *primera* vacante.

**Fix:** `findExistingCandidateByCv` ahora acota la búsqueda del hash por `userId`. `uploadCandidate` hace upsert de una fila `Application` (`{ candidateId, vacancyId }`) cuando hay un hit de dedup, vinculando al candidato reutilizado con la nueva vacante. `evaluateCandidates` ahora lee candidatos pendientes desde `Application` (filtrado por `vacancyId` y `status: PENDIENTE`), así que un candidato que postuló a múltiples vacantes se evalúa independientemente en cada una.

### Bug 3 — CI/CD: el paso de migración nunca corría silenciosamente en el VPS

El job de deploy llamaba `docker compose exec -T backend-service-name npx prisma migrate deploy` con un nombre de servicio placeholder que nunca coincidía con el servicio real `api` en `docker-compose.yml`. El paso fallaba, pero el script de deploy no tenía `set -e`, así que seguía ejecutando hasta el `docker system prune -af` final y el job reportaba verde — lo que significaba que cada migración de esquema desde que se configuró CI/CD había sido silenciosamente omitida en el VPS.

**Fix:** el nombre de servicio se corrige a `api` y se agrega `set -e` al script de deploy para que cualquier paso fallido aborte el job de inmediato con un fallo visible.

---

## 18. Fix: motor de scoring — cuatro defectos corregidos

**Archivos:** `src/utils/scoringEngine.ts`, `src/validations/position.validation.ts`
**Commit:** `f95b072 fix(scoring): correct experience floor, role matching and education ladder` (PR #148)

El motor de scoring (`src/utils/scoringEngine.ts`) tenía cuatro defectos independientes que distorsionaban el ranking de candidatos. Sin cambios en schema ni migraciones — el enum `EducationLevel` de Prisma no se tocó.

### Defecto 1 — Experiencia: el "lifesaver" estaba recortando puntajes, no elevándolos

El branch "lifesaver" (crédito parcial por proyectos personales destacados) era mutuamente excluyente con el cálculo proporcional. Un candidato con 2.9 de 3 años requeridos *y* highlights de proyectos recibía `WEIGHTS.EXPERIENCE * 50 = 10 pts` — menos que los `19.3 pts` que ganaría solo con los años crudos, sin highlights.

**Fix:** el valor proporcional se calcula primero (`proportionalScore = años / requeridos * weight`). El lifesaver aplica como piso con `Math.max(proportionalScore, WEIGHTS.EXPERIENCE * 50)` — solo puede elevar el puntaje, nunca reducirlo.

### Defecto 2 — Rol: igualdad estricta penalizaba variaciones menores de redacción

El match de rol usaba `===` después de pasar a minúsculas. Cualquier discrepancia semántica ("Backend Developer" vs "Senior Backend Developer") borraba los 15 puntos de rol completos, aunque el LLM que extrae el rol del candidato no puede garantizar paridad exacta con el string de la posición.

**Fix:** reemplazado con contención bidireccional por substring (`candidateRole.includes(positionRole) || positionRole.includes(candidateRole)`), ambos recortados y en minúsculas. También se agregó una guarda contra strings vacíos: `"".includes("")` es `true`, así que sin ella un candidato sin rol recibiría los puntos completos de rol.

### Defecto 3 — Educación: la escala ordinal tenía TECHNICAL por encima de BACHELOR

El mapa `EDUCATION_LEVELS` rankeaba `TECHNICAL: 3, BACHELOR: 2`, que es el inverso de la jerarquía académica real. Un candidato con un certificado técnico puntearía *más alto* en la dimensión de educación que uno con un grado universitario de licenciatura.

**Fix:** corregido a `TECHNICAL: 2, BACHELOR: 3`. Solo cambió esta constante — el orden de declaración del enum de Prisma es independiente de estos valores ordinales y no se tocó.

### Defecto 4 — Arrays de requisitos vacíos: puntos gratis para todos los candidatos

El motor trata un array de requisitos vacío como completamente satisfecho ("Suposición de Competencia"), otorgando a cada candidato el peso completo para esa dimensión. En lugar de complicar la función pura de scoring, el fix se mueve a la capa de validación: `softSkills` e `idiomas` ahora requieren **al menos un elemento** al crear una posición (`z.array(...).min(1)`), igualando la regla ya existente para `technicalSkills`. Esto evita que posiciones con arrays vacíos lleguen al motor.

**Documentación corregida:** `backend-documentation.md`, `api-documentation.md`, `readme.md` y `context/scoring-engine.md` (ambos idiomas) se actualizaron para eliminar la descripción incorrecta de una regla "guillotina" (las hard skills no llevan un flag de obligatorio; una skill faltante solo cuesta su parte lineal proporcional, no una penalización pesada automática).

---

## 19. Fix: forma de respuesta uniforme — doble envoltura de `sendResponseOr404` eliminada

**Archivo:** `src/lib/responseHandler.ts`
**Rama/PR:** Fix/backend bugs resolution (PR #150)

**El problema:** el helper `sendResponseOr404` respondía con `{ response: { success: true, data: ... } }` en el caso de éxito — un nivel extra de anidamiento respecto al patrón `{ success, data }` usado en el resto de la API. Cualquier consumidor que no implementara un workaround para esta inconsistencia recibía un envelope inesperado.

**Qué cambió:** `res.status(200).json({ response })` fue reemplazado por `res.status(200).json(response)`. El caso de error 404 ya era correcto.

**Endpoints afectados (ahora todos devuelven `{ success, data }` directamente):** `GET /positions`, `GET /positions/:id`, `GET /candidates`, `GET /candidates/:id`, `GET /departments/*`, `PUT /departments/:id`, `DELETE /departments/:id`, `GET /vacancies`, `PATCH /vacancies/:id/status`, `PUT /vacancies/:id`, `GET /dashboard`.

**Tests actualizados:** las 12 aserciones que antes usaban `res.body.response.data` fueron reescritas a `res.body.data` en `dashboard.test.ts`, `departments.test.ts`, `vacancies.test.ts`, `positions.test.ts` y `candidates.test.ts`.

---

## 20. Fix: errores de archivo de Multer ahora devuelven 400 en vez de 500

**Archivos:** `src/middlewares/upload/multerConfig.ts`, `src/middlewares/error/errorHandler.middleware.ts`
**Rama/PR:** Fix/backend bugs resolution (PR #150)

**El problema:** subir un archivo que no fuera PDF o un archivo demasiado grande a `POST /api/positions/complete` o `POST /api/vacancies/:id/upload` devolvía `500`. Había dos brechas distintas:
1. El filtro de tipo de archivo en `multerConfig` lanzaba un `Error` genérico sin `statusCode`, así que el handler global caía al branch de `500`.
2. El handler global no tenía un branch explícito para `multer.MulterError`, así que las violaciones de tamaño (código `LIMIT_FILE_SIZE`) también devolvían `500`.

**Qué cambió:**
- `multerConfig.ts`: el error del filtro de tipo de archivo ahora tiene `statusCode: 400` adjunto antes de pasarse a `cb()`.
- `errorHandler.middleware.ts`: se agregó un branch explícito para `multer.MulterError` después del block de `ZodError`. `LIMIT_FILE_SIZE` → `"File is too large. Maximum size allowed is 5 MB."`, otros códigos Multer → el mensaje crudo de Multer. Ambos casos responden `400`.

---

## 21. Fix: dashboard `vacancyStatusBreakdown` — CONTACTING reemplazado por PAUSED

**Archivos:** `src/services/dashboard.service.ts`, `src/types/dashboard.types.ts`
**Rama/PR:** Fix/backend bugs resolution (PR #150)

**El problema:** `dashboard.service.ts` hardcodeaba el array de status base como `["ACTIVE", "CLOSED", "CONTACTING"]`. `VacancyStatus` en `prisma/schema.prisma` es `ACTIVE | PAUSED | CLOSED` — `CONTACTING` no existe. Resultado: el breakdown siempre mostraba una entrada `CONTACTING: 0` y dejaba caer silenciosamente todas las vacantes en `PAUSED`.

**Qué cambió:**
- `dashboard.service.ts`: `defaultStatuses` ahora usa los valores del enum de Prisma `[VacancyStatus.ACTIVE, VacancyStatus.PAUSED, VacancyStatus.CLOSED]`.
- `dashboard.types.ts`: el tipo local de `status` en el breakdown se amplió de una unión hardcodeada a `VacancyStatus` (con el import correspondiente), para que el sistema de tipos garantice la corrección en el futuro.

---

## 22. Fix: paginación agregada a todos los endpoints de listado principales

**Archivos:** `src/controllers/vacancies.controller.ts`, `src/controllers/positions.controller.ts`, `src/controllers/departments.controller.ts`, `src/controllers/candidates.controller.ts`, `src/controllers/admin.controller.ts`
**Rama/PR:** Fix/backend bugs resolution (PR #150)

**El problema:** la mayoría de los endpoints de listado devolvía todas las filas en una sola respuesta sin límite. Los dos endpoints que ya aceptaban `limit` (`GET /api/vacancies/:id/results`, `GET /api/admin/users`) no tenían ningún clamp — un `limit` suficientemente grande devolvía toda la tabla.

**Qué cambió:** los cinco controladores ahora aplican paginación:
- `GET /api/positions`, `GET /api/vacancies`, `GET /api/candidates`: aceptan `page` (default `1`) y `limit` (default `20`, máximo `100`). La respuesta gana `meta: { total, page, limit, totalPages }`.
- `GET /api/vacancies/:id/results`: `limit` ahora se clampea con `Math.min(parseInt(limit) || 20, 100)`.
- `GET /api/admin/users`: `limit` ahora se clampea con `Math.min(limit, 100)`.
- `GET /api/departments` se dejó sin paginar — la lista es pequeña por diseño (10 departamentos creados al registrarse más los que el usuario agregue).

---

## 23. Fix: `GET /api/vacancies` ahora obtiene candidatos vía join de Application

**Archivo:** `src/controllers/vacancies.controller.ts`
**Rama/PR:** Fix/backend bugs resolution (PR #150)

**El problema:** `getAllVacancies` consultaba `candidates: true` en el select de Prisma, que resuelve candidatos por `Candidate.vacancyId` — la vacante de la subida *original*. Un candidato reutilizado en una segunda vacante por dedup de hash (vinculado solo a través de una fila `Application`) era invisible en el array `candidates` de esa segunda vacante, aun después de que los fixes del PR #146 hacían al candidato reutilizado evaluable allí.

**Qué cambió:** la query ahora selecciona `applications: { select: { candidate: true } }` y remodela el resultado para exponer `candidates` como el array plano de objetos `Candidate` de esas filas `Application`. `_count.candidates` también se obtiene de `_count.applications` para que el conteo sea consistente con lo que contiene el array. Un candidato reutilizado ahora aparece en cada vacante a la que aplicó.

---

## 24. Fix: `DELETE /api/vacancies/:id` evita la cascada multi-ruta de MySQL

**Archivo:** `src/controllers/vacancies.controller.ts`
**Commit:** `fix(vacancies): bypass MySQL multi-path cascade on vacancy delete` (PR #156)

**El problema:** borrar una vacante que tenía candidatos (es decir, con filas `Candidate` y `Application` existentes) lanzaba un error de Prisma/MySQL. MySQL InnoDB no soporta un `DELETE` que dispare CASCADE a través de dos rutas distintas hacia la misma tabla:
- Ruta A: `Vacancy → Application` (vía `Application.vacancyId ON DELETE CASCADE`)
- Ruta B: `Vacancy → Candidate → Application` (vía `Candidate.vacancyId CASCADE` + `Application.candidateId CASCADE`)

Ambas rutas apuntan a `Application`, y MySQL rechaza la ambigüedad con un error de foreign key constraint.

**Qué cambió:** `deleteVacancy` envuelve la eliminación en un `prisma.$transaction` que borra explícitamente las filas dependientes en orden seguro de FK antes de la propia Vacancy:
1. `tx.matchResult.deleteMany({ where: { vacancyId } })`
2. `tx.application.deleteMany({ where: { vacancyId } })`
3. `tx.candidate.deleteMany({ where: { vacancyId } })`
4. `tx.vacancy.delete({ where: { id } })`

MySQL nunca necesita resolver la cascada multi-ruta porque no queda nada que cascadear cuando finalmente se borra la Vacancy. Sin cambios de schema — es un fix puramente del controlador.
