# TalentMatch AI — Backend

> API REST para automatizar la selección y evaluación de candidatos para equipos de RRHH: extrae datos de CVs en PDF con IA, los compara matemáticamente contra los requisitos de una vacante, y entrega un ranking de candidatos listo para revisión humana.

**Stack:** Node.js · Express 5 · TypeScript (migración en curso desde JS) · MySQL · Prisma · Zod · OpenAI API · Cloudinary
**Estado del proyecto:** funcionalidad core completa (auth, CRUD, motor de matching) y **suite de tests automatizados (Jest + Supertest)** ya implementada — ver [Testing](#-testing).

> Para la referencia técnica profunda del backend (arquitectura, ciclo de request, modelo de datos, pipeline de CVs, motor de scoring, seguridad, despliegue) ver **[`backend-documentation.md`](./backend-documentation.md)**.

---

## Tabla de contenidos

- [Resumen del sistema](#resumen-del-sistema)
- [Pipeline de procesamiento de CVs](#pipeline-de-procesamiento-de-cvs)
- [Motor de Matching](#motor-de-matching)
- [Arquitectura y seguridad](#arquitectura-y-seguridad)
- [Stack técnico](#stack-técnico)
- [Requisitos previos](#requisitos-previos)
- [Variables de entorno](#variables-de-entorno)
- [Puesta en marcha (local)](#puesta-en-marcha-local)
- [Scripts disponibles](#scripts-disponibles)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Referencia de la API](#referencia-de-la-api)
- [CI/CD y despliegue](#cicd-y-despliegue)
- [🧪 Testing](#-testing)
- [Convenciones de desarrollo](#convenciones-de-desarrollo)
- [Roadmap](#roadmap)
- [Licencia](#licencia)

---

## Resumen del sistema

TalentMatch AI es una plataforma B2B multi-tenant: cada usuario (empresa/reclutador) gestiona su propio espacio de **Departamentos → Posiciones → Vacantes → Candidatos**, completamente aislado del resto de los usuarios. Este repositorio es el backend — el "cerebro" que recibe los CVs, los interpreta con IA y calcula qué tan bien encaja cada candidato con una vacante específica.

El objetivo es eliminar las horas que un equipo de RRHH gasta leyendo CVs no calificados, entregando en su lugar un ranking ordenado y explicable de los mejores candidatos.

## Pipeline de procesamiento de CVs

Cuando un reclutador sube uno o varios CVs a una vacante (`POST /api/vacancies/:id/upload`), cada archivo pasa por:

1. **Deduplicación (primero):** se calcula un hash SHA-256 del PDF; si ya existe un candidato con ese hash, se reutiliza sin llamar a la IA ni a Cloudinary.
2. **Extracción de texto:** se lee el contenido crudo del PDF (`pdf-parse`, con retry acotado ante errores transitorios).
3. **Control de calidad:** si el texto extraído tiene menos de 500 caracteres (CV escaneado/corrupto/ilegible), se descarta y se reporta el error para ese archivo puntual — sin bloquear el resto del lote.
4. **Lectura por IA:** el texto se envía a un modelo de OpenAI, que extrae habilidades, experiencia, educación e idiomas en un perfil estructurado.
5. **Rechazo de no-CV:** si la IA devuelve un perfil totalmente en blanco (el PDF no era un currículum), se rechaza antes de gastar una subida a Cloudinary.
6. **Subida segura + persistencia:** el PDF se guarda en Cloudinary y el perfil normalizado del candidato se persiste en MySQL, asociado a la vacante y al usuario.

La evaluación (`POST /api/vacancies/:id/evaluations`) es un paso separado y explícito: corre el motor de matching sobre los candidatos de la vacante que aún no tengan un resultado, con concurrencia limitada (`p-limit(5)`).

## Motor de Matching

La IA **no asigna el puntaje** — solo estructura el perfil. El puntaje final (0–100) lo calcula un algoritmo determinístico (`src/utils/scoringEngine.ts`) con estos pesos:

| Criterio | Peso |
| ----------------------------------------------- | ---- |
| Hard Skills (habilidades técnicas obligatorias) | 30% |
| Experiencia (años requeridos) | 20% |
| Coincidencia de rol | 15% |
| Idiomas | 15% |
| Educación | 10% |
| Soft Skills | 10% |

**Reglas de negocio especiales:**

- **"Lifesaver":** si al candidato le faltan años de experiencia formal pero tiene proyectos personales sólidos, recibe puntos parciales de experiencia en vez de ser descartado automáticamente.
- **"Guillotina":** si al candidato le falta una habilidad técnica obligatoria, la contribución de hard skills se reduce proporcionalmente y lo saca del top del ranking.

## Arquitectura y seguridad

Capas obligatorias en cada request: **Rutas → Middleware de validación (Zod) → Controlador → Servicio → Prisma**.

- **Autenticación:** JWT (`Authorization: Bearer <token>`), emitido en `POST /api/users/login`.
- **RBAC:** roles `USER` y `ADMIN`. Solo `ADMIN` accede a `/api/admin/*` (estadísticas globales, gestión de usuarios).
- **Aislamiento multi-tenant:** toda consulta (excepto `/api/admin`) está filtrada por el `userId` del token — un usuario nunca puede leer ni modificar recursos de otro.
- **Validación de payloads:** Zod valida `body`, `params` y `query` antes de que cualquier controlador los toque.
- **Manejo de errores centralizado:** un único `errorHandler` traduce errores de Zod y de Prisma a respuestas HTTP consistentes, y oculta el detalle interno cuando `NODE_ENV=production`.
- **Cabeceras y CORS:** Helmet + una whitelist explícita de orígenes (`ALLOWED_ORIGINS`).
- **Rate limiting:** 100 requests / 15 minutos por IP (`express-rate-limit`).
- **Contraseñas:** hasheadas con `bcrypt` antes de persistir.

Para el detalle completo de cada endpoint ver **[`api-documentation.md`](./api-documentation.md)**; para la arquitectura completa, **[`backend-documentation.md`](./backend-documentation.md)**.

## Stack técnico

| Categoría | Tecnología |
| -------------------------- | -------------------------------------------------- |
| Runtime | Node.js 20+ |
| Framework | Express 5 |
| Lenguaje | TypeScript (migración progresiva desde JavaScript) |
| Base de datos | MySQL 8 |
| ORM | Prisma |
| Validación | Zod |
| Autenticación | JSON Web Tokens (`jsonwebtoken`) + `bcrypt` |
| IA / NLP | OpenAI API |
| Almacenamiento de archivos | Cloudinary |
| Parsing de PDF | `pdf-parse` |
| Subida de archivos | Multer |
| Seguridad HTTP | Helmet, `express-rate-limit`, CORS |
| Concurrencia controlada | `p-limit` |
| Testing | Jest + Supertest (vía `babel-jest`) |

## Requisitos previos

- **Node.js** `20.20.1` o superior (ver `engines` en `package.json`)
- **Docker** (solo para levantar MySQL en local — el backend corre nativo, nunca dentro de un contenedor en desarrollo)
- **npm**
- Credenciales de OpenAI y Cloudinary si vas a probar los flujos de IA/subida de archivos

## Variables de entorno

No existe actualmente un `.env.example` en el repo — crea un `.env` en la raíz con estas variables:

```env
# 1. Inicialización de MySQL vía Docker (usado por docker-compose)
MYSQL_ROOT_PASSWORD=
MYSQL_DATABASE=
MYSQL_USER=
MYSQL_PASSWORD=

# 2. Conexión de Prisma hacia la base de datos
DATABASE_URL=

# 3. Core de Node/Express
NODE_ENV=development
PORT=3000
JWT_SECRET=

# 4. Integraciones externas
OPENAI_API_KEY=
CLOUDINARY_URL=
ALLOWED_ORIGINS=http://localhost:5173
```

> `DATABASE_URL` debe apuntar al MySQL que levantes con Docker — usando el puerto expuesto en `docker-compose.local.yml` (`3307` en el host, `3306` dentro del contenedor).

## Puesta en marcha (local)

Sigue la separación de infraestructura del proyecto: **Docker solo corre MySQL**, el backend se ejecuta nativo con Node.

```bash
# 1. Clonar e instalar dependencias
git clone <repo-url>
cd talentmatch-backend
npm install

# 2. Levantar únicamente la base de datos MySQL
docker compose -f docker-compose.local.yml up -d

# 3. Configurar tu .env (ver sección anterior)

# 4. Generar el cliente de Prisma y aplicar el schema
npx prisma generate
npx prisma migrate dev

# 5. (Opcional) Sembrar un usuario administrador de prueba
npx prisma db seed
# Crea admin@admin.ai / Admin123 — cambia esta contraseña de inmediato
# en cualquier entorno que no sea tu máquina local.

# 6. Levantar el servidor en modo desarrollo (hot reload)
npm run dev
```

El servidor queda escuchando en `http://localhost:<PORT>` (por defecto `3000`).

## Scripts disponibles

| Script | Descripción |
| -------------------------- | ---------------------------------------------------------------------- |
| `npm run dev` | Arranca el servidor con recarga automática (`tsx watch`) |
| `npm run build` | Compila TypeScript a `dist/` |
| `npm start` | Corre el build compilado (`node dist/index.js`) — usado en producción |
| `npm run type-check` | Verifica tipos sin emitir archivos (`tsc --noEmit`) — es el gate de CI |
| `npm run check-js` | Chequea los archivos `.js` restantes de la migración a TS |
| `npm test <target>` | Runner de tests personalizado — requiere un target explícito (ver [Testing](#-testing)) |

## Estructura del proyecto

```
src/
├── controllers/     # Lógica de request/response por recurso
├── routes/          # Definición de endpoints + wiring de middlewares
├── validations/     # Schemas de Zod (body/params/query) por recurso
├── middlewares/
│   ├── auth/        # JWT, RBAC
│   ├── error/       # Manejador global de errores + 404
│   ├── security/    # Helmet, CORS, rate limiting
│   ├── upload/      # Configuración de Multer
│   └── validation/  # Middleware genérico que aplica los schemas de Zod
├── services/        # Lógica de negocio reutilizable (matching, Cloudinary, CVs)
├── prompts/         # Prompts y wrappers de las llamadas a OpenAI
├── utils/           # Algoritmo de scoring, hashing, etc.
├── types/           # Tipos e interfaces compartidas
├── lib/             # Cliente de Prisma, catchAsync, response helpers, pdf wrapper
└── tests/           # Suites de Jest/Supertest + helpers (espeja el árbol de código)

prisma/
├── schema.prisma    # Modelo de datos (MySQL)
├── migrations/      # Historial de migraciones
└── seed.ts          # Seed del usuario admin de desarrollo
```

## Referencia de la API

La documentación completa de cada endpoint (método, auth requerida, parámetros, tipos de body, y códigos de error posibles) vive en **[`api-documentation.md`](./api-documentation.md)**. Resumen de recursos:

| Recurso | Base path | Auth |
| ------------------------------------------------------- | ------------------ | -------------------------- |
| Usuarios / Auth | `/api/users` | Pública (registro y login) |
| Departamentos | `/api/departments` | JWT |
| Posiciones | `/api/positions` | JWT |
| Vacantes | `/api/vacancies` | JWT |
| Candidatos (solo lectura) | `/api/candidates` | JWT |
| Dashboard (métricas por usuario) | `/api/dashboard` | JWT |
| Administración (métricas globales, gestión de usuarios) | `/api/admin` | JWT + rol `ADMIN` |

Los cambios de contrato más recientes (para el equipo de frontend) están en **[`changelog-frontend.md`](./changelog-frontend.md)**.

## CI/CD y despliegue

`.github/workflows/deploy.yml` define el pipeline sobre `main`:

1. **Gate de validación:** `npm ci` + `npm run type-check`. Si el proyecto no compila, el pipeline se detiene aquí.
2. **Despliegue:** solo si el gate anterior pasa, se conecta por SSH al VPS, hace `git reset --hard origin/main`, reconstruye la imagen con `docker compose` y aplica `npx prisma migrate deploy` dentro del contenedor activo. Termina purgando imágenes viejas para no saturar disco.

En el VPS, **todo corre contenerizado** (backend + MySQL vía `docker-compose.yml`), a diferencia del entorno local donde solo la base de datos vive en Docker.

## 🧪 Testing

**Suite de tests automatizados con Jest + Supertest** (transpilada por `babel-jest`), corriendo contra una base MySQL dedicada `talentmatch_test`. Cubre todas las rutas (admin, departments, positions, vacancies, users, candidates, dashboard) en happy path y caminos de error, con aislamiento multi-tenant verificado.

Puntos clave (detalle completo en [`backend-documentation.md`](./backend-documentation.md) §18 y en [`last-changes.md`](./last-changes.md)):

- Ejecución serial (`maxWorkers: 1`) sobre una única BD compartida que se trunca entre tests.
- Guard de seguridad: `jest.setup.ts` falla en duro si `DATABASE_URL` no contiene `talentmatch_test`.
- Runner personalizado (`npm test <target>`) que requiere un target explícito, con atajo por nombre y prompt opt-in para los tests que llaman a OpenAI/Cloudinary.
- Benchmark de throughput `npm test upload` (100 CVs reales).

## Convenciones de desarrollo

Las reglas de arquitectura, migración JS→TS, y manejo de errores/transacciones que sigue este repo están documentadas en **[`CLAUDE.md`](../../CLAUDE.md)**. En resumen:

- El proyecto está en migración activa de JavaScript a TypeScript estricto — el código nuevo se escribe en `.ts` sin `any`.
- Toda entrada externa (`body`, `params`, `query`) se valida con Zod antes de tocar la base de datos.
- Operaciones de RRHH con múltiples escrituras dependientes deben usar `$transaction` de Prisma.
- Todos los comentarios de código se escriben en inglés.

## Roadmap

- [x] Definición de esquema de base de datos (Prisma/MySQL)
- [x] Sistema de autenticación y RBAC (`USER` / `ADMIN`)
- [x] CRUD de Departamentos, Posiciones y Vacantes
- [x] Subida y extracción de CVs (PDF → IA → perfil estructurado)
- [x] Motor de scoring/matching determinístico
- [x] Hardening de validación y manejo de errores (ver `changelog-frontend.md`)
- [x] Suite de tests automatizados (unitarios + integración)
- [ ] Cobertura de tests en el pipeline de CI (hoy el gate es solo `type-check`)
- [ ] `.env.example` versionado

## Licencia

ISC — ver `package.json`.
