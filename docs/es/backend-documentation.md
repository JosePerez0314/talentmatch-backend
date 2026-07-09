# Documentación del Backend — TalentMatch AI

> Referencia técnica completa del backend de TalentMatch AI. Está escrita para que un ingeniero **sin exposición previa al proyecto** pueda leerla de principio a fin y entender qué hace el sistema, cómo está estructurado, cómo fluye un request, cómo se modelan los datos y cómo ejecutarlo, testearlo y desplegarlo.

**Audiencia:** ingenieros backend, personas que se integran al equipo, integradores y revisores.
**Documentos complementarios:** [`api-documentation.md`](./api-documentation.md) (contrato endpoint por endpoint), [`readme.md`](./readme.md) (arranque rápido), [`changelog-frontend.md`](./changelog-frontend.md) (cambios de contrato para el equipo de frontend), [`last-changes.md`](./last-changes.md) (bitácora de ingeniería reciente).

---

## Tabla de contenidos

1. [Qué hace el sistema](#1-qué-hace-el-sistema)
2. [Stack tecnológico](#2-stack-tecnológico)
3. [Arquitectura de alto nivel](#3-arquitectura-de-alto-nivel)
4. [Ciclo de vida de un request](#4-ciclo-de-vida-de-un-request)
5. [Estructura del proyecto](#5-estructura-del-proyecto)
6. [Modelo de dominio y esquema de base de datos](#6-modelo-de-dominio-y-esquema-de-base-de-datos)
7. [Multi-tenancy y aislamiento de datos](#7-multi-tenancy-y-aislamiento-de-datos)
8. [Autenticación y autorización (RBAC)](#8-autenticación-y-autorización-rbac)
9. [Capa de validación (Zod)](#9-capa-de-validación-zod)
10. [Manejo de errores y envolturas de respuesta](#10-manejo-de-errores-y-envolturas-de-respuesta)
11. [El pipeline de procesamiento de CVs](#11-el-pipeline-de-procesamiento-de-cvs)
12. [Integración con IA (OpenAI)](#12-integración-con-ia-openai)
13. [El motor de scoring / matching](#13-el-motor-de-scoring--matching)
14. [Analíticas de dashboard y admin](#14-analíticas-de-dashboard-y-admin)
15. [Capa de seguridad](#15-capa-de-seguridad)
16. [Configuración y variables de entorno](#16-configuración-y-variables-de-entorno)
17. [Ejecución local](#17-ejecución-local)
18. [Testing](#18-testing)
19. [CI/CD y despliegue](#19-cicd-y-despliegue)
20. [Problemas conocidos y convenciones](#20-problemas-conocidos-y-convenciones)

---

## 1. Qué hace el sistema

TalentMatch AI es una **plataforma SaaS B2B que automatiza el filtrado de candidatos para equipos de RRHH**. Cada cliente (una empresa o reclutador) opera un espacio aislado organizado como una jerarquía:

```
Usuario (tenant / reclutador)
 └── Departamento     ej. "Ingeniería"
      └── Posición    la línea base de requisitos del puesto (skills, experiencia, educación…)
           └── Vacante  una apertura activa ligada a una Posición
                └── Candidato  un CV parseado desde un PDF, más su evaluación por IA
```

La propuesta de valor central: en lugar de que un reclutador lea decenas de CVs no calificados, sube los PDFs a una vacante y recibe un **ranking ordenado y explicable** de los candidatos que mejor encajan.

El backend es el "cerebro": ingiere CVs, usa un LLM para convertir el texto no estructurado del currículum en un perfil estructurado y luego calcula un **puntaje de match determinístico de 0 a 100** contra la Posición de la vacante — la IA nunca asigna el puntaje por sí misma.

## 2. Stack tecnológico

| Capa | Tecnología |
| --- | --- |
| Runtime | Node.js `20.20.1` (ver `engines` en `package.json`) |
| Framework web | Express 5 |
| Lenguaje | TypeScript (estricto, sin `any`) — migrado desde una base híbrida JS/TS |
| Base de datos | MySQL 8 |
| ORM | Prisma 6 |
| Validación | Zod 4 |
| Auth | JSON Web Tokens (`jsonwebtoken`) + hashing de contraseñas con `bcrypt` |
| IA / NLP | OpenAI API (Responses API, prompts almacenados en el servidor) |
| Almacenamiento de archivos | Cloudinary |
| Parsing de PDF | `pdf-parse` (envuelto con un retry acotado) |
| Subida de archivos | Multer (almacenamiento en memoria) |
| Seguridad HTTP | Helmet, `express-rate-limit`, whitelist de CORS |
| Concurrencia acotada | `p-limit` |
| Testing | Jest + Supertest (vía `babel-jest`) |
| Runner de desarrollo | `tsx` (hot reload, ejecución de scripts) |

**Modelo de infraestructura — distinción importante:**

- **Desarrollo local:** Docker corre **solo MySQL**. El backend Node.js corre **nativo** (`npm run dev`).
- **VPS (producción):** 100% contenerizado — backend y MySQL corren en Docker vía `docker-compose.yml`.

## 3. Arquitectura de alto nivel

El backend es una única aplicación Express que expone una API REST JSON bajo `/api`. Sigue una **arquitectura estricta por capas** y cada request atraviesa las capas en orden — nunca se salta una capa:

```
Ruta  →  Middleware de seguridad  →  Middleware de auth  →  Validación Zod  →  Controlador  →  Servicio  →  Prisma  →  MySQL
```

- **Rutas** (`src/routes/`) declaran los endpoints y arman la cadena de middlewares.
- **Middleware de validación** (`src/middlewares/validation/`) ejecuta el schema de Zod para `body`/`params`/`query` antes de que corra cualquier código del controlador.
- **Controladores** (`src/controllers/`) orquestan el request: son dueños del modelado de request/response y del scoping por tenant.
- **Servicios** (`src/services/`) contienen lógica de negocio reutilizable (dedup de CVs, subidas a Cloudinary, validación de candidatos, agregación del dashboard).
- **Prisma** (`src/lib/prisma.ts`) es el único cliente de base de datos.

**`app.ts` vs `index.ts` — una separación deliberada:**

- `src/app.ts` construye la app de Express (middlewares + rutas) y **la exporta sin llamar a `listen`**.
- `src/index.ts` es el **único** archivo que llama a `app.listen`.

Esta separación existe para que Supertest pueda hacer `import app` directamente en los tests sin abrir un puerto de red real. **No los vuelvas a fusionar.**

## 4. Ciclo de vida de un request

Tomando `app.ts` como fuente de verdad, cada request entrante se procesa en este orden exacto:

1. **CORS** (`corsMiddleware`) — rechaza orígenes que no estén en la whitelist `ALLOWED_ORIGINS`.
2. **Helmet** (`helmetMiddleware`) — fija cabeceras HTTP seguras.
3. **Rate limit** (`rateLimitMiddleware`) — 100 requests / 15 minutos por IP.
4. **Parseo del body** — `express.json()`.
5. **Rutas públicas** — `POST /api/users` (registro) y `POST /api/users/login` se montan **antes** del gate de auth, así que no requieren token.
6. **Gate de auth** (`authMiddleware`) — a partir de aquí, toda ruta requiere un JWT válido. Decodifica el token y adjunta `req.user = { id, role }`.
7. **Rutas de features** — `/api/admin`, `/api/departments`, `/api/positions`, `/api/vacancies`, `/api/candidates`, `/api/dashboard`.
8. **Handler 404** (`notFoundMiddleware`) — para rutas no coincidentes.
9. **Handler global de errores** (`errorHandler`) — el único lugar que convierte errores lanzados en respuestas HTTP (ver [§10](#10-manejo-de-errores-y-envolturas-de-respuesta)).

Los controladores se envuelven para que los errores lanzados/rechazados se propaguen al handler global en vez de crashear el proceso. El helper `catchAsync` (`src/lib/catchAsync.ts`) envuelve un handler async y reenvía cualquier rechazo a `next()`:

```ts
export const catchAsync = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
```

## 5. Estructura del proyecto

```
src/
├── app.ts               # Construye la app de Express (sin listen) — importado por los tests
├── index.ts             # El único entrypoint que llama a app.listen
├── routes/              # Definición de endpoints + wiring de middlewares (por recurso)
├── controllers/         # Orquestación request/response + scoping por tenant
├── services/            # Lógica de negocio reutilizable (dedup de CVs, Cloudinary, dashboard…)
├── prompts/             # Wrappers de llamadas a OpenAI (extractCv, matchEngine, autoComplete)
├── validations/         # Schemas de Zod para body/params/query (por recurso)
├── middlewares/
│   ├── auth/            # Auth JWT + guard de roles (RBAC)
│   ├── error/           # Handler global de errores + handler 404
│   ├── security/        # CORS, Helmet, rate limiting
│   ├── upload/          # Multer (subidas de PDF en memoria)
│   └── validation/      # Middleware genérico que aplica Zod
├── utils/               # Motor de scoring determinístico, hashing de CVs, departamentos default
├── lib/                 # Cliente Prisma, catchAsync, helper de respuesta, wrapper de pdf, config de Cloudinary
├── types/               # Tipos TypeScript compartidos y declaraciones ambient
└── tests/               # Suites Jest/Supertest + helpers (espeja el árbol de código)

prisma/
├── schema.prisma        # Modelo de datos (MySQL)
├── migrations/          # Historial de migraciones (11 migraciones)
└── seed.ts              # Siembra admin@admin.ai / Admin123 + departamentos default

scripts/
└── test.ts              # Runner de tests personalizado (guard de target, atajo por nombre, prompt externo)
```

## 6. Modelo de dominio y esquema de base de datos

El esquema vive en `prisma/schema.prisma` (MySQL). Seis modelos y cinco enums.

### Enums

| Enum | Valores |
| --- | --- |
| `UserRole` | `ADMIN`, `USER` |
| `EducationLevel` | `NONE`, `HIGH_SCHOOL`, `BACHELOR`, `TECHNICAL`, `UNIVERSITY`, `MASTER`, `DOCTORATE` |
| `VacancyStatus` | `ACTIVE`, `PAUSED`, `CLOSED` |
| `CandidateStatus` | `DISPONIBLE`, `CONTRATADO` |
| `ApplicationStatus` | `PENDIENTE`, `EN_PROCESO`, `SELECCIONADO`, `RECHAZADO` |

### Modelos

- **`User`** — el tenant (admin de RRHH / reclutador). Es dueño de departamentos, posiciones, vacantes y candidatos. `email` es único; `password` es un hash bcrypt; `role` por defecto es `USER`.
- **`Department`** — agrupa posiciones bajo una unidad de negocio. `@@unique([title, userId])` (el título es único por tenant), indexado por `userId`.
- **`Position`** — la línea base de requisitos que la IA usa para evaluar candidatos: `role`, `yearsOfExperience` (Int, `≥ 0`), `description` (Text), arrays de skills almacenados como **JSON** (`technicalSkills`, `optionalTechnicalSkills`, `softSkills`, `languages`), `educationLevel` (enum), `educationArea` y un `positionPdfUrl` opcional (Cloudinary). **La relación `department` es `onDelete: Cascade`** — borrar un Departamento cascadea a sus Posiciones (ver [§20](#20-problemas-conocidos-y-convenciones)).
- **`Vacancy`** — una apertura activa ligada a una Posición: `title`, `availableSlots`, `startDate`/`endDate`, `status` (default `ACTIVE`). Cascadea al borrar la Posición y al borrar el Usuario.
- **`Candidate`** — un CV parseado desde un PDF: identidad + los mismos campos estructurados de skills/experiencia/educación que una Posición, más `fileUrl` (Cloudinary), un **`hash` único** (SHA-256 del CV, para dedup) y `rawApiPayload` (el JSON crudo de la IA, conservado para auditoría). `status` por defecto es `DISPONIBLE`.
- **`MatchResult`** — la evaluación determinística que une un Candidato con una Vacante. Guarda el `matchScore` total más un desglose por criterio (`hardSkillsScore`, `experienceScore`, `roleScore`, `languagesScore`, `educationScore`, `softSkillsScore`), un snapshot JSON `normalizedCandidate` (congelado al momento de la evaluación para auditabilidad), un `summary` y `redFlags` opcionales. **`@@unique([candidateId, vacancyId])`** — un candidato tiene como máximo una evaluación por vacante.
- **`Application`** — está definido en el esquema (con `ApplicationStatus`) pero **no tiene rutas ni controlador activos**. No asumir que existe un endpoint `/api/applications`.

### Estrategia de indexación

El esquema usa índices compuestos afinados para los caminos de consulta comunes, ej. `Vacancy @@index([userId, status])` para dashboards, `Position @@index([userId, createdAt])`, `Candidate @@index([userId, createdAt])`. Las consultas nuevas deben escribirse para usar estos índices en vez de disparar full table scans. Los arrays de skills se almacenan como blobs JSON — el motor de scoring determinístico los lee en la capa de aplicación en vez de filtrar dentro del JSON en SQL.

## 7. Multi-tenancy y aislamiento de datos

Todo recurso **excepto** `/api/admin/*` está scopeado por el usuario autenticado. `Department`, `Position`, `Vacancy` y `Candidate` cargan una columna `userId`, y los controladores **filtran y escriben por `req.user!.id`** en cada operación.

Consecuencias:

- Un usuario nunca puede leer ni modificar datos de otro usuario. Un `:id` cross-tenant devuelve **`404`, no `403`** — la API no revela si el recurso existe para otro tenant.
- Las relaciones entre entidades se validan contra el tenant antes de escribir. Ejemplo: crear una Vacante verifica que el `departmentId` pertenezca al que llama, que el departamento tenga al menos una Posición y que el `positionId` pertenezca a ese departamento — de lo contrario rechaza con `404`/`400`.

## 8. Autenticación y autorización (RBAC)

**Autenticación** — tokens JWT bearer.

- Un token se emite en `POST /api/users/login` y contiene `{ userId, role }`.
- `authMiddleware` (`src/middlewares/auth/auth.middleware.ts`) exige un header `Authorization: Bearer <token>`, lo verifica con `JWT_SECRET`, comprueba que el payload tenga `userId` y `role`, y adjunta `req.user = { id, role }`.
- Todos los modos de fallo devuelven `401` con un mensaje específico: header ausente/sin `Bearer` → `Unauthorized`; token malformado → `Malformed Token`; expirado → `Session expired`; en otro caso → `Invalid or expired token`.

**Autorización (RBAC)** — dos roles, `USER` y `ADMIN`.

- El guard de roles (`src/middlewares/auth/roleMiddleware.ts`) protege `/api/admin/*`. Un `USER` que golpee una ruta admin recibe `403`.
- Los endpoints de admin agregan a través de **todos** los tenants y nunca usan `req.user.id` como foreign key — son la única excepción al scoping por tenant.

## 9. Capa de validación (Zod)

Toda entrada externa (`req.body`, `req.params`, `req.query`) se valida **antes** de llegar a un controlador. El middleware genérico (`src/middlewares/validation/validate.middleware.ts`) parsea un único objeto `{ body, params, query }` contra un schema de Zod y, si tiene éxito, **reemplaza `req.body/params/query` con los valores parseados (coercionados y saneados)**:

```ts
const parsed = schema.parse({ body: req.body, params: req.params, query: req.query });
req.body = parsed.body; // los valores coercionados fluyen hacia abajo
```

Si falla, reenvía el `ZodError` al handler global, que devuelve un `400` estructurado (ver [§10](#10-manejo-de-errores-y-envolturas-de-respuesta)). Los schemas viven en `src/validations/` por recurso. Reglas destacadas:

- **Password:** 10–100 caracteres, al menos una mayúscula, una minúscula y un dígito.
- **Email:** normalizado a minúsculas + trim.
- **`Position.yearsOfExperience`:** entero `≥ 0` (acepta `0` para roles entry-level; coercionado desde string).
- **Regla condicional de `Position.educationArea`:** requerido salvo que `educationLevel` sea `NONE`/`HIGH_SCHOOL` — ver [§20](#20-problemas-conocidos-y-convenciones).

## 10. Manejo de errores y envolturas de respuesta

### Handler global de errores

`src/middlewares/error/errorHandler.middleware.ts` es el **único** lugar que mapea errores lanzados a respuestas HTTP:

| Error lanzado | Status HTTP | `error` del body |
| --- | --- | --- |
| `ZodError` | `400` | `"Validation error"` + `details[]` (field/message) |
| Prisma `P2002` (constraint único) | `409` | `"A record with this data already exists"` |
| Prisma `P2025` (registro no encontrado) | `404` | `"Record not found"` |
| Otro `PrismaClientValidationError` / known request error | `400` | `"Invalid data sent to the database"` |
| Cualquier error que cargue un `statusCode` | ese código | el mensaje (o genérico en prod) |
| Cualquier otra cosa | `500` | `"Internal server error"` |

**La severidad del log coincide con la severidad real:** todo lo que resuelve a `5xx` (y el caso límite `headersSent`) se loguea con `console.error`; los errores de cliente `4xx` esperados se loguean con `console.warn`. En producción (`NODE_ENV=production`) un `5xx` nunca filtra el mensaje interno — siempre devuelve `"Internal server error"`. En desarrollo se devuelve el mensaje real para facilitar el debugging.

### Formas de respuesta exitosa (y una inconsistencia conocida)

La mayoría de los controladores responde directamente:

```json
{ "success": true, "data": { ... } }
```

Pero los endpoints que usan el helper `sendResponseOr404` (`src/lib/responseHandler.ts`) **envuelven doble** el caso de éxito:

```json
{ "response": { "success": true, "data": { ... } } }
```

y su caso 404 devuelve `{ "success": false, "error": "<Entidad> not found" }`. Esta inconsistencia es intencional-por-ahora y está documentada; los consumidores deben verificar la forma exacta por endpoint en [`api-documentation.md`](./api-documentation.md). Los errores de validación siempre agregan un array `details`:

```json
{ "success": false, "error": "Validation error", "details": [{ "field": "…", "message": "…" }] }
```

## 11. El pipeline de procesamiento de CVs

Disparado por `POST /api/vacancies/:id/upload` (`multipart/form-data`, campo `pdfs`, hasta 100 archivos, máx. 5MB cada uno, solo `application/pdf`). Cada archivo se procesa **de forma independiente con un tope de concurrencia de 5** (`p-limit(5)`) — un archivo que falla nunca bloquea el lote. Para cada PDF:

1. **Dedup primero (SHA-256).** `findExistingCandidateByCv` hashea el buffer crudo del PDF y busca un `Candidate` existente por `hash`. Si lo encuentra, el pipeline **corta en corto** y devuelve el candidato existente — sin extracción de texto, sin llamada a OpenAI, sin subida a Cloudinary.
2. **Extracción de texto.** `extract()` (de `src/lib/pdfWrapper.ts`) ejecuta `pdf-parse`. El wrapper agrega un **retry acotado (hasta 6 intentos, con 50ms de separación)** porque `pdf-parse` es no determinístico en ráfagas apretadas dentro del mismo proceso (intermitente "bad XRef entry" en PDFs válidos); un PDF genuinamente corrupto igual falla en todos los intentos y se relanza sin cambios.
3. **Compuerta de calidad.** Si el texto extraído tiene `< 500` caracteres (escaneado/corrupto/ilegible), el archivo se rechaza con una entrada de error — sin bloquear el resto del lote.
4. **Extracción por IA.** El texto se envía a OpenAI, que devuelve un perfil de candidato estructurado.
5. **Rechazo de no-CV.** `assertCandidateIsCv` (`candidateValidation.service.ts`) rechaza el archivo si la IA devolvió un **perfil totalmente en blanco** (campos de texto vacíos, `educationLevel NONE`, sin skills, `yearsOfExperience 0`) — es decir, el PDF no era un currículum — **antes** de gastar una subida a Cloudinary. Un CV real al que le falta un solo campo nunca se rechaza (todos los campos significativos deben estar en blanco).
6. **Subida a Cloudinary.** El PDF original se almacena; la URL se guarda en el candidato.
7. **Persistencia.** Se crea una fila `Candidate` con el perfil estructurado, el `hash`, la URL de Cloudinary y el JSON crudo de la IA (`rawApiPayload`). Una carrera que inserta un hash duplicado se captura (`P2002`) y resuelve al candidato existente.

**La evaluación es un paso separado y explícito** (`POST /api/vacancies/:id/evaluations`): corre el motor de matching sobre los candidatos de la vacante que aún no tienen `MatchResult`, de nuevo con `p-limit(5)`.

## 12. Integración con IA (OpenAI)

El cliente de OpenAI es un singleton delgado (`src/services/openai.service.ts`) construido a partir de `OPENAI_API_KEY`. Dos puntos de llamada, ambos usando la **Responses API con IDs de prompt almacenados en el servidor** y el modelo `gpt-5.4-nano`, y ambos forzando salida JSON vía un mensaje `system` ("Return only valid JSON"):

- **`extractCandidateData`** (`src/prompts/extractCv.prompt.ts`) — convierte el texto crudo del CV en un perfil `CandidateExtracted` estructurado.
- **`matchEngine`** (`src/prompts/matchEngine.prompt.ts`) — dada la Posición y el candidato extraído, devuelve un `NormalizedCandidate` (que también trae un bloque `aiAnalysis` con `projectHighlights`, `redFlags` y un `rawTextSummary`).
- **`autoCompletePosition`** (`src/prompts/`) — respalda `POST /api/positions/complete`, que extrae campos de Posición desde un PDF de descripción de puesto (sin escritura en BD).

**Principio clave:** la IA solo **estructura y normaliza** datos. Nunca asigna el puntaje de match. Cualquier fallo de OpenAI se envuelve como `"Failed to process resume with AI"` y, en el pipeline de subida, queda contenido al archivo individual.

## 13. El motor de scoring / matching

`src/utils/scoringEngine.ts` — `calculateMatchScore(position, normalizedCandidate)` — es una **función pura y determinística** que devuelve un `totalScore` (0–100, redondeado) más un `breakdown` por criterio. Lee solo el JSON producido por la fase de extracción por IA, así que el ranking es matemático, no alucinado.

**Pesos (suman 100%):**

| Criterio | Peso | Cómo se calcula |
| --- | --- | --- |
| Habilidades técnicas (hard skills) | 30% | Ratio lineal `matched / required × 30`. Si la Posición no lista skills requeridas, puntaje completo. El match es case-insensitive. |
| Experiencia | 20% | 20 completos si los años del candidato ≥ los requeridos. Si no, el **"lifesaver"**: si la IA marcó `projectHighlights`, se otorga la mitad (10) en vez de un recorte proporcional; si no, ratio proporcional (0 si el requisito es `0`). |
| Rol | 15% | Binario: match exacto (case-insensitive) del string de rol → 15, si no 0. |
| Idiomas | 15% | Ratio lineal `matched / required × 15` (puntaje completo si no se requiere ninguno). |
| Educación | 10% | Niveles rankeados `NONE(0) … DOCTORATE(6)`. 10 completos si la Posición requiere `NONE` o el nivel del candidato ≥ el requerido; si no, proporcional. |
| Soft skills | 10% | Ratio lineal `matched / required × 10` (puntaje completo si no se requiere ninguna). |

**Reglas especiales señaladas en el código:**

- **"Lifesaver":** un candidato corto en años formales pero con proyectos personales sólidos recibe crédito parcial de experiencia en vez de un rechazo automático.
- **"Guillotina":** una habilidad técnica obligatoria faltante arrastra hacia abajo la contribución de hard skills de forma proporcional (es el mayor peso), empujando al candidato hacia abajo en el ranking.

En el controlador de evaluación, el puntaje redondeado de cada criterio más el total se persiste en un `MatchResult`, junto con el snapshot congelado `normalizedCandidate`, el `summary` de la IA y cualquier `redFlags`.

## 14. Analíticas de dashboard y admin

Dos superficies de analítica distintas — **no confundirlas**:

- **`GET /api/dashboard`** — métricas **por tenant** para el usuario autenticado: totales (posiciones, departamentos, candidatos, vacantes abiertas), un desglose de estado de vacantes con porcentajes y actividad mensual. La actividad mensual se calcula con una única consulta SQL cruda (`prisma.$queryRaw`) que hace `UNION ALL` de los eventos de creación de Position/Candidate/Vacancy y los agrupa por `YYYY-MM` — un solo viaje en vez de tres (`src/services/dashboard.service.ts`).
- **`GET /api/admin/stats`** — totales **a nivel de toda la plataforma** entre todos los tenants (usuarios, candidatos, posiciones, vacantes, vacantes activas/cerradas). Solo admin.

## 15. Capa de seguridad

- **Contraseñas** — hasheadas con `bcrypt` antes de persistir; el login nunca revela qué campo estuvo mal (`401` genérico).
- **JWT** — firmado con `JWT_SECRET`; payload validado en cada request.
- **CORS** — whitelist explícita de orígenes desde `ALLOWED_ORIGINS` (separados por coma). Los requests sin `Origin` (ej. mismo origen/servidor a servidor) se permiten; los orígenes desconocidos se rechazan. `credentials: true`; métodos limitados a `GET/POST/PUT/DELETE/PATCH/OPTIONS`.
- **Helmet** — cabeceras HTTP seguras en cada respuesta.
- **Rate limiting** — 100 requests / 15 min por IP (`express-rate-limit`), con cabeceras estándar activadas.
- **Hardening de subidas** — Multer usa almacenamiento en memoria, un límite de 5MB por archivo y un filtro que solo admite `application/pdf`.
- **Enmascaramiento de errores en producción** — las respuestas `5xx` nunca exponen mensajes internos en producción.

## 16. Configuración y variables de entorno

Actualmente **no hay un `.env.example` versionado**. Crea un `.env` en la raíz del proyecto:

```env
# Init de MySQL (usado por docker-compose para el contenedor de BD local)
MYSQL_ROOT_PASSWORD=
MYSQL_DATABASE=
MYSQL_USER=
MYSQL_PASSWORD=

# Conexión de Prisma (apunta al MySQL dockerizado; puerto host 3307 → contenedor 3306)
DATABASE_URL=

# Core de Node / Express
NODE_ENV=development
PORT=3000
JWT_SECRET=

# Integraciones externas
OPENAI_API_KEY=
CLOUDINARY_URL=
ALLOWED_ORIGINS=http://localhost:5173
```

Archivos de entorno adicionales: `.env.production` (VPS) y `.env.test` (BD de test + claves externas placeholder — ver [§18](#18-testing)).

## 17. Ejecución local

Sigue la separación de infraestructura del proyecto — **Docker corre solo MySQL**, el backend corre nativo.

```bash
npm install                                       # instalar dependencias

docker compose -f docker-compose.local.yml up -d  # levantar solo MySQL

# configurar tu .env (ver §16)

npx prisma generate                               # generar el cliente de Prisma
npx prisma migrate dev                            # aplicar el esquema a tu BD local
npx prisma db seed                                # (opcional) admin@admin.ai / Admin123 + departamentos default

npm run dev                                        # arrancar el servidor de dev (hot reload, tsx watch)
```

El servidor escucha en `http://localhost:<PORT>` (por defecto `3000`).

**Scripts (`package.json`):**

| Script | Propósito |
| --- | --- |
| `npm run dev` | Servidor de dev con hot reload (`tsx watch`) |
| `npm run build` | Compila TypeScript a `dist/` (`tsconfig.build.json`, tests excluidos) |
| `npm start` | Corre el build compilado (`node dist/index.js`) — producción |
| `npm run type-check` | `tsc --noEmit` — **el gate de CI**; un error de tipos detiene el pipeline de despliegue |
| `npm run check-js` | Type-check de los archivos `.js` legacy restantes |
| `npm test <target>` | Runner personalizado — requiere un target explícito (ver [§18](#18-testing)) |

## 18. Testing

- **Stack:** Jest + Supertest, transpilados por `babel-jest` (no `ts-jest`), así que los tests se comportan igual vía `npm test`, CI o el runner de un solo test del editor. Config en `jest.config.js`.
- **Ejecución serial (`maxWorkers: 1`):** todas las suites comparten una única base de datos física `talentmatch_test` y la truncan entre tests (`beforeAll`/`afterEach`/`afterAll` globales en `jest.setup.afterEnv.ts`). Correr en paralelo dejaría que la limpieza de una suite borrara los fixtures de otra.
- **Guard de seguridad:** `jest.setup.ts` carga `.env.test` y **falla en duro si `DATABASE_URL` no contiene `talentmatch_test`**, así que un entorno mal configurado nunca puede truncar datos de dev/prod. La BD/usuario de test se crea manualmente por máquina (no es parte de la automatización del repo).
- **Helper JWT de test:** `src/tests/utils/jwt.util.ts` acuña JWTs reales (`authHeaderFor({ userId, role })`) firmados con el secreto de test — sin viaje al login. También expone `expiredTestToken` y `tokenWithWrongSecret`.
- **Árbol de tests:** las suites viven bajo `src/tests/` espejando el código fuente (`src/routes/admin.ts` → `src/tests/routes/admin.test.ts`), matcheadas por `src/**/*.test.ts` — mantenidas fuera del build de producción.
- **Runner personalizado (`scripts/test.ts`, vía `tsx`):** `npm test` **requiere un target explícito** (la BD compartida no es para corridas casuales de toda la suite). Un **nombre pelado es un atajo** anclado al nombre del archivo (`npm test positions` → `positions.test.ts`) — el anclaje importa en Windows, donde la ruta absoluta empieza con `C:\Users\...`. Rutas completas y flags de Jest (`-t "…"`) pasan intactos.
- **Tests de servicios externos (opt-in):** los happy paths que llaman a OpenAI/Cloudinary (`positions.test.ts`, `vacancies.test.ts`) están gateados con `describe.skip`. El runner pregunta en una shell interactiva y siempre los omite en no-interactiva (CI); `--external`/`--no-external` saltan el prompt. Las claves reales se superponen en runtime desde `.env` solo para `OPENAI_API_KEY`/`CLOUDINARY_URL` — `DATABASE_URL`/`JWT_SECRET` nunca se sobrescriben.
- **`npm test upload`** es un benchmark de throughput (no un test unitario): fuerza credenciales reales + `KEEP_TEST_DATA=true`, genera 100 CVs PDF únicos, los sube en un request y loguea ms-por-CV. También prueba el tope de 100 archivos por request (`upload.array("pdfs", 100)` rechaza el 101 antes de que corra el controlador).

## 19. CI/CD y despliegue

`.github/workflows/deploy.yml` corre sobre `main`:

1. **Gate de validación:** `npm ci` + `npm run type-check`. Si el proyecto no compila, el pipeline se detiene aquí — **el type-check es el gate de despliegue** (aún no hay gate de tests).
2. **Despliegue (solo si el gate pasa):** SSH al VPS, `git reset --hard origin/main`, reconstruir la imagen con `docker compose`, correr `npx prisma migrate deploy` dentro del contenedor activo y purgar imágenes viejas.

En el VPS **todo corre contenerizado** (backend + MySQL vía `docker-compose.yml`), a diferencia de local donde solo la BD está dockerizada.

## 20. Problemas conocidos y convenciones

- **Regla "NONE" de `educationArea`:** en `POST /api/positions`, si `educationLevel` es `NONE`/`HIGH_SCHOOL` y se omite `educationArea`, el backend asigna automáticamente `"N/A"` (nunca `null`/`""`). Para los niveles que sí requieren área (`BACHELOR`…`DOCTORATE`), omitirla devuelve `400 "Education area is required for this education level"`. En `PUT` (actualización parcial) un `educationArea` omitido se deja intacto — el sentinel `"N/A"` no se reaplica. Los frontends deben renderizar `"N/A"` como "No aplica".
- **`PUT` es un parche parcial real:** en `PUT /api/positions/:id` y `PUT /api/vacancies/:id`, solo se actualizan los campos presentes en el body; los omitidos conservan su valor almacenado. Para vaciar un array opcional hay que enviarlo explícitamente.
- **El borrado de `Department` cascadea:** `Position.department` es `onDelete: Cascade`, así que borrar un Departamento borra sus Posiciones en vez de bloquearse. Hacer el borrado bloqueante requeriría un cambio de esquema a `onDelete: Restrict` + una nueva migración.
- **Inconsistencia en la forma de respuesta:** `sendResponseOr404` envuelve doble el éxito como `{ response: { success, data } }`; el resto devuelve `{ success, data }`. Registrado, aún no unificado.
- **Los errores de Multer aparecen como `500`:** una violación de tipo/tamaño/cantidad de archivo lanza un `Error`/`MulterError` genérico sin `statusCode`, así que el handler global cae a `500` en vez de un `4xx` limpio. El límite **sí** se aplica; solo el status code es imperfecto.
- **El modelo `Application` está latente:** presente en el esquema, sin rutas/controlador.
- **Comentarios de código solo en inglés:** todos los comentarios inline/block/JSDoc deben estar en inglés, sin importar el idioma de trabajo (convención del proyecto).
- **Sin `any` en TypeScript:** se aplica tipado estricto; la base está en migración de JS a TS.

---

_Este documento refleja el estado de la rama `main` al momento de escribirse. Cuando el backend o el esquema de base de datos cambie, actualiza este documento (y su contraparte en inglés `../en/backend-documentation.md`) junto con el código._
