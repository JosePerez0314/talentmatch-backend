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
