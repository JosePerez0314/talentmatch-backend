# TalentMatch AI — Backend

[🇬🇧 English](./README.md) · 🇪🇸 Español

> API de un SaaS B2B de RRHH que lee CVs en PDF con la API de OpenAI, puntúa a cada candidato contra una vacante con un algoritmo determinístico y devuelve un ranking explicable para revisión humana.

**Repo del frontend:** [talentmatch-frontend](https://github.com/JosePerez0314/talentmatch-frontend)

**Stack:** Node.js · Express 5 · TypeScript · MySQL · Prisma · Zod · OpenAI API · Cloudinary · Docker

---

## Qué hace

- **Espacios multi-tenant:** cada reclutador/empresa gestiona un espacio aislado de Departamentos → Posiciones → Vacantes → Candidatos.
- **Auth JWT + RBAC:** roles `USER` y `ADMIN`; estadísticas globales y gestión de usuarios solo para admin.
- **Ingesta de CVs:** hasta 100 PDFs por solicitud; el texto se extrae, se valida su calidad y la IA lo estructura. Los CVs duplicados se detectan por hash SHA-256 y nunca se reprocesan.
- **Scoring determinístico (0–100):** la IA estructura el perfil, pero nunca asigna el puntaje.
- **Flujo de contratación:** estado de aplicación por candidato con control de cupos (la vacante se cierra sola al llenarse).
- **Dashboards:** métricas por tenant para usuarios y métricas globales para admins.

## Arquitectura

```
Cliente ──► API Express ──► Prisma ──► MySQL
               │
               ├──► OpenAI API   (texto del CV → perfil estructurado)
               └──► Cloudinary   (almacenamiento de PDFs)
```

Toda solicitud atraviesa las mismas capas, sin saltarse ninguna:
`Ruta → Seguridad (CORS/Helmet/rate limit) → Auth (JWT) → Validación Zod → Controller → Service → Prisma`.

**Flujo del CV:** subida del PDF → dedup SHA-256 → extracción de texto (`pdf-parse`) → filtro de calidad (< 500 caracteres se rechaza) → OpenAI estructura el perfil → PDF a Cloudinary → se guarda el `Candidate`. La evaluación es un paso separado y explícito (`POST /api/vacancies/:id/evaluations`) que puntúa a los candidatos y arma el ranking.

## Stack tecnológico

| Categoría | Tecnología |
| --- | --- |
| Runtime / framework | Node.js 20.20.1, Express 5 |
| Lenguaje | TypeScript (estricto; JS legacy en migración) |
| Base de datos / ORM | MySQL 8, Prisma |
| Validación | Zod |
| Autenticación | JWT + bcrypt |
| IA | OpenAI API |
| Almacenamiento | Cloudinary |
| Seguridad | Helmet, whitelist CORS, `express-rate-limit` |
| Testing | Jest + Supertest |
| Infra | Docker (MySQL en local; stack completo en el VPS) |

## Primeros pasos

**Requisitos:** Node.js `20.20.1`+, npm, Docker (solo para MySQL en desarrollo local).

```bash
git clone https://github.com/JosePerez0314/talentmatch-backend.git
cd talentmatch-backend
npm install
cp .env.example .env                                # luego completa las variables
docker compose -f docker-compose.local.yml up -d    # solo MySQL
npx prisma generate && npx prisma migrate dev
npx prisma db seed                                  # opcional: admin de desarrollo + departamentos por defecto
npm run dev
```

La API corre en `http://localhost:3000` (o tu `PORT`).
> El seed crea una cuenta admin de desarrollo. Cambia su contraseña en cualquier entorno que no sea local.

## Variables de entorno

Copia `.env.example` a `.env` en la raíz del proyecto. **Nunca lo subas al repo**: `.env`, `.env.production` y `.env.test` están en `.gitignore`.

| Variable | Qué es | Ejemplo |
| --- | --- | --- |
| `MYSQL_ROOT_PASSWORD` | Contraseña root del contenedor MySQL (la lee Docker Compose). | `<contraseña-segura>` |
| `MYSQL_DATABASE` | Nombre de la base de datos creada en el primer arranque. | `talentmatch` |
| `MYSQL_USER` | Usuario de la aplicación creado en el primer arranque. | `talentmatch_user` |
| `MYSQL_PASSWORD` | Contraseña de `MYSQL_USER`. | `<contraseña-segura>` |
| `DATABASE_URL` | Cadena de conexión de Prisma. En local el puerto del host es `3307`. | `mysql://USER:PASSWORD@localhost:3307/DATABASE` |
| `NODE_ENV` | `development` o `production`. En producción los errores 5xx ocultan el mensaje interno. | `development` |
| `PORT` | Puerto en el que escucha la API. | `3000` |
| `JWT_SECRET` | Secreto para firmar y verificar los JWT. Usa una cadena larga y aleatoria. | `<cadena-larga-aleatoria>` |
| `OPENAI_API_KEY` | Clave de OpenAI para extraer datos estructurados de los CVs. | `sk-...` |
| `CLOUDINARY_URL` | Credencial de Cloudinary para guardar los PDFs de los CVs. | `cloudinary://API_KEY:API_SECRET@CLOUD_NAME` |
| `ALLOWED_ORIGINS` | Orígenes del frontend permitidos por CORS, separados por coma. | `http://localhost:5173` |

Flags del runner de tests (no se necesitan para correr la API): `RUN_EXTERNAL_TESTS` (activa los tests que llaman a OpenAI/Cloudinary) y `KEEP_TEST_DATA` (omite el truncado de la BD entre tests).

## API

Todas las rutas cuelgan de `/api`. Las respuestas siguen `{ success, data }`; las listas paginadas añaden `meta`. Contrato completo: [`docs/es/api-documentation.md`](./docs/es/api-documentation.md).

| Método | Ruta | Qué hace | Auth |
| --- | --- | --- | --- |
| POST | `/api/users` · `/api/users/login` | Registro / login | Pública |
| GET·POST·PUT·DELETE | `/api/departments` | CRUD de departamentos | JWT |
| GET·POST·PUT·DELETE | `/api/positions` | CRUD de posiciones (requisitos del puesto) | JWT |
| POST | `/api/positions/complete` | Autocompleta una posición desde un PDF de descripción | JWT |
| POST | `/api/positions/duplicate/:id` | Duplica una posición | JWT |
| GET·POST·PUT·DELETE | `/api/vacancies` | CRUD de vacantes | JWT |
| POST | `/api/vacancies/:id/upload` | Sube PDFs de CVs (hasta 100, 5 MB c/u) | JWT |
| POST | `/api/vacancies/:id/evaluations` | Puntúa a los candidatos pendientes | JWT |
| GET | `/api/vacancies/:id/results` | Resultados rankeados | JWT |
| PATCH | `/api/vacancies/:id/status` | Cambia el estado de la vacante | JWT |
| PATCH | `/api/vacancies/:vacancyId/candidates/:candidateId/status` | Cambia el estado de aplicación de un candidato | JWT |
| GET | `/api/candidates` · `/api/candidates/:id` | Lectura de candidatos | JWT |
| GET | `/api/dashboard` | Métricas del usuario | JWT |
| GET·PUT·DELETE | `/api/admin/stats` · `/users` · `/users/:id/role` · `/users/:id` | Estadísticas globales, gestión de usuarios | JWT + `ADMIN` |

## Base de datos

Siete modelos en `prisma/schema.prisma`:

```
User ─┬─ Department ── Position ── Vacancy ─┬─ Application ── Candidate
      │                                      └─ MatchResult ── Candidate
      └─ (también es dueño de Position, Vacancy, Candidate vía userId)
```

- `User`, `Department`, `Position`, `Vacancy`, `Candidate`: cada fila lleva un `userId` para el aislamiento por tenant.
- `Application`: vincula un candidato con una vacante (estado, único por par).
- `MatchResult`: el puntaje y su desglose por criterio, único por candidato + vacante.
- `Candidate` tiene `@@unique([userId, hash])` para deduplicar CVs por tenant.

## Decisiones de diseño y tradeoffs

**La IA estructura, el código puntúa.** El modelo solo convierte el texto del CV en un perfil estructurado; una función pura calcula el puntaje. Así los rankings son reproducibles y explicables y no hay puntajes alucinados. El costo: la calidad del puntaje depende de la calidad de la extracción, y las reglas se codifican a mano.

**Arquitectura estricta por capas.** Rutas → validación → controllers → services → Prisma, con `app.ts` separado de `index.ts` para que los tests importen la app sin abrir un puerto. Más archivos que un CRUD rápido, pero cada capa es testeable y reemplazable.

**Validar todo con Zod, en el borde.** `body`, `params` y `query` se parsean y convierten antes de que corra cualquier controller. Cuesta algo de boilerplate por recurso, pero los datos inválidos nunca llegan a la base de datos.

**Multi-tenancy por columna `userId`.** Una base de datos compartida, cada consulta filtrada por el id del usuario del JWT; el acceso entre tenants devuelve `404`, no `403`. Simple y barato de operar, pero el aislamiento depende de que cada consulta recuerde el filtro (cubierto por tests).

**Concurrencia acotada y aislamiento de fallos por archivo.** Los CVs se procesan con `p-limit(5)` para que un PDF malo no bloquee un lote de 100 y no se sature la API de OpenAI. El throughput queda limitado por diseño.

**Transacciones explícitas donde MySQL no puede hacer cascade.** Borrar una vacante elimina `MatchResult`, `Application` y `Candidate` dentro de un `$transaction`, porque InnoDB no resuelve el cascade de múltiples caminos. Más código, pero borrados seguros.

## Motor de scoring

Cada candidato recibe un puntaje de 0–100 calculado a partir del perfil estructurado por la IA:

| Criterio | Peso |
| --- | --- |
| Hard skills | 30% |
| Experiencia | 20% |
| Rol | 15% |
| Idiomas | 15% |
| Educación | 10% |
| Soft skills | 10% |

Las habilidades, idiomas y soft skills se puntúan según la proporción de requisitos que el candidato cumple. La experiencia es proporcional a los años requeridos, con una regla especial: un candidato con buenos proyectos personales tiene garantizada al menos la mitad de los puntos de experiencia (un piso, nunca una penalización). El rol coincide si uno de los títulos contiene al otro. Una habilidad faltante solo cuesta su parte proporcional: no hay descalificación automática. Detalles: [`docs/es/context/scoring-engine.md`](./docs/es/context/scoring-engine.md).

## Tests

Jest + Supertest contra una base de datos dedicada `talentmatch_test`. `npm test` siempre requiere un objetivo explícito:

```bash
npm test admin                                     # nombre corto -> admin.test.ts
npm test -- src/tests/routes/departments.test.ts   # ruta completa
npm test departments -t "returns 201"              # un solo test
```

Los tests que llaman a OpenAI/Cloudinary son opt-in (el runner pregunta, o usa `--external`). Una guarda de seguridad se niega a correr si `DATABASE_URL` no contiene `talentmatch_test`. Ver [`docs/es/backend-documentation.md`](./docs/es/backend-documentation.md) §18.

## Estado

- **Hecho:** auth + RBAC, CRUD completo, pipeline de CVs con dedup, motor de scoring, control de cupos, dashboards, tests automatizados, CI (type-check + tests) y despliegue containerizado en el VPS.
- **Pendiente:** especificación OpenAPI/Swagger, reporte de cobertura de tests en CI, regla de habilidad obligatoria ("guillotina") en el scoring.
- **Qué haría distinto:** introducir `.env.example` y la suite de tests desde el día uno, y terminar antes la migración a TypeScript.

## Documentación

La documentación completa vive en [`docs/`](./docs/) en inglés y español: [arquitectura del backend](./docs/es/backend-documentation.md), [referencia de la API](./docs/es/api-documentation.md), [changelog para frontend](./docs/es/changelog-frontend.md), [cambios recientes](./docs/es/last-changes.md). Reglas de contribución: [`CLAUDE.md`](./CLAUDE.md).

## Equipo

| Nombre | Rol |
| --- | --- |
| **José Gabriel Pérez Calcaño** — [LinkedIn](https://www.linkedin.com/in/im-jose/) | Tech Lead. Arquitectura, backend completo y supervisión del trabajo del equipo. |
| Justin Antonio Sánchez Melo | Frontend |
| Bryam Smith Pérez Hernández | Prompts de IA y apoyo en frontend |

## Licencia

ISC — ver `package.json`.
