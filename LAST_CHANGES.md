# Registro de cambios sin commit

**Fecha:** 2026-07-01
**Alcance:** Todo lo que se hizo en esta sesión de trabajo para construir la infraestructura de testing automatizado del backend (hasta ahora el proyecto no tenía ningún test — ver el roadmap del `README.md`). Nada de esto está commiteado todavía.

Este documento explica, tema por tema, **qué se hizo, por qué era necesario, y por qué se eligió esa solución y no otra**. Está escrito para que cualquier persona del equipo (programe o no) entienda el impacto de cada cambio antes de aprobarlo.

---

## Índice

- [Registro de cambios sin commit](#registro-de-cambios-sin-commit)
  - [Índice](#índice)
  - [1. Instalar las herramientas de testing](#1-instalar-las-herramientas-de-testing)
  - [2. Base de datos exclusiva para pruebas](#2-base-de-datos-exclusiva-para-pruebas)
  - [3. Configuración de Jest para un proyecto mixto TypeScript/JavaScript](#3-configuración-de-jest-para-un-proyecto-mixto-typescriptjavascript)
  - [4. Generador de tokens de sesión falsos para pruebas (JWT helper)](#4-generador-de-tokens-de-sesión-falsos-para-pruebas-jwt-helper)
  - [5. Limpieza automática de la base de datos entre pruebas](#5-limpieza-automática-de-la-base-de-datos-entre-pruebas)
  - [6. Silenciar el registro de consultas SQL durante las pruebas](#6-silenciar-el-registro-de-consultas-sql-durante-las-pruebas)
  - [7. Separar el servidor en dos piezas (`app.ts` / `index.ts`)](#7-separar-el-servidor-en-dos-piezas-appts--indexts)
  - [8. Pruebas del panel de administración (`/api/admin/*`)](#8-pruebas-del-panel-de-administración-apiadmin)
    - [`GET /api/admin/stats` (estadísticas del sistema)](#get-apiadminstats-estadísticas-del-sistema)
    - [`PUT /api/admin/users/:id/role` (cambiar el rol de un usuario)](#put-apiadminusersidrole-cambiar-el-rol-de-un-usuario)
    - [`DELETE /api/admin/users/:id` (borrar un usuario)](#delete-apiadminusersid-borrar-un-usuario)
  - [9. Departamentos por defecto compartidos entre el registro de usuarios y el usuario admin](#9-departamentos-por-defecto-compartidos-entre-el-registro-de-usuarios-y-el-usuario-admin)
  - [10. Cambio de motor de pruebas: de `ts-jest` a `babel-jest`](#10-cambio-de-motor-de-pruebas-de-ts-jest-a-babel-jest)
  - [11. Arreglo del error falso en el editor (VS Code)](#11-arreglo-del-error-falso-en-el-editor-vs-code)
  - [12. Inventario completo de archivos](#12-inventario-completo-de-archivos)
    - [Archivos nuevos](#archivos-nuevos)
    - [Archivos modificados](#archivos-modificados)
    - [Cambios fuera del control de versiones (no aparecen en git, pero son reales)](#cambios-fuera-del-control-de-versiones-no-aparecen-en-git-pero-son-reales)
  - [13. Qué falta hacer / cómo probarlo en otra máquina](#13-qué-falta-hacer--cómo-probarlo-en-otra-máquina)

---

## 1. Instalar las herramientas de testing

**El problema:** El proyecto no tenía ninguna forma de probar automáticamente que el código funciona. El script `npm test` literalmente imprimía un error y se detenía — nunca se había configurado nada.

**Qué se instaló** (como dependencias de desarrollo, es decir, nunca viajan a producción):

- **Jest** — el programa que ejecuta las pruebas y dice cuáles pasaron o fallaron.
- **Supertest** — simula visitas a los endpoints de la API (como si un navegador les pegara) sin necesidad de levantar un servidor real en un puerto.
- Paquetes de "tipos" (`@types/jest`, `@types/supertest`) para que TypeScript entienda estas herramientas.

**Por qué esta combinación y no otra:** Jest es el estándar de la industria para proyectos Node/TypeScript, tiene la comunidad más grande y mejor documentación. Supertest es su complemento natural para probar APIs HTTP sin necesidad de un navegador ni un puerto real — es más rápido y no deja procesos colgados.

---

## 2. Base de datos exclusiva para pruebas

**El problema:** Si las pruebas usaran la misma base de datos que development/producción (`talentmatch_prod`), cada corrida de tests podría **borrar o corromper datos reales** — por ejemplo, un test que verifica "el usuario se borra correctamente" literalmente borra un usuario. Correrlo por accidente contra la base real sería catastrófico.

**Qué se hizo:**

- Se creó una base de datos nueva y separada, `talentmatch_test`, dentro del mismo motor de MySQL que ya corre en tu máquina (mismo contenedor Docker, mismo puerto 3307) — pero es un "cajón" completamente distinto, aislado de `talentmatch_prod`.
- Se creó un usuario de MySQL dedicado (`talentmatch_test`) que **solo tiene permisos sobre esa base** — ni siquiera puede leer `talentmatch_prod` aunque alguien lo intentara desde el código.
- Se aplicó el mismo historial de migraciones de Prisma (la estructura de tablas) que ya usa la base real, para que la base de test tenga exactamente las mismas tablas.
- Se creó un archivo `.env.test` (no se sube a git — está en `.gitignore`, igual que `.env` y `.env.production`) con la configuración que apunta específicamente a esa base de test.
- Se agregó un mecanismo de seguridad extra: antes de correr cualquier prueba, el código verifica explícitamente que la conexión activa efectivamente dice "talentmatch_test" en el nombre — si por error algún día apuntara a otra base, **el sistema se niega a correr y avisa el problema**, en vez de arriesgarse a tocar datos reales.

**Por qué esta opción y no otra:**

- Se consideró levantar un contenedor de Docker completamente aparte (otro MySQL, otro puerto), pero eso consume más recursos de la máquina y complica el `docker-compose` sin necesidad real: una base de datos separada dentro del mismo motor de MySQL ya da el aislamiento que se necesita (ninguna prueba puede leer o escribir en los datos reales), con muchísimo menos overhead.
- El usuario de MySQL con permisos acotados es una capa de seguridad adicional de "cinturón y tirantes": aunque haya un error de configuración humano, el motor de base de datos mismo bloquea el acceso indebido.

---

## 3. Configuración de Jest para un proyecto mixto TypeScript/JavaScript

**El problema:** Este backend está a mitad de camino entre JavaScript viejo y TypeScript nuevo (11 archivos siguen en `.js`). Además usa un formato de módulos moderno ("ESM", el mismo que usan los navegadores) en vez del formato clásico de Node ("CommonJS"). Jest, por defecto, no sabe leer ninguna de las dos cosas sin ayuda.

**Qué se hizo:** se creó `jest.config.js`, el archivo de configuración que le explica a Jest:

- Qué carpetas contienen pruebas (`src/**/*.test.ts`).
- Que las pruebas comparten una sola base de datos física y por eso deben correr **una detrás de otra, nunca en paralelo** (`maxWorkers: 1`) — si corrieran en paralelo, una prueba podría borrar los datos que otra prueba está usando en ese preciso momento, generando fallos intermitentes e imposibles de diagnosticar.
- Cómo traducir el código moderno para que Jest lo entienda (ver punto 10, donde se explica el cambio de herramienta usada para esto).

**Por qué era necesario:** sin este archivo, Jest ni siquiera puede empezar a leer los archivos de prueba — literalmente truena al importar el primer módulo.

---

## 4. Generador de tokens de sesión falsos para pruebas (JWT helper)

**El problema:** Casi todos los endpoints de la API exigen estar "logueado" (llevar un token de sesión válido, JWT). Para probar esos endpoints sin logueeearse manualmente cada vez (lo cual sería lento y frágil), se necesita una forma de generar tokens válidos directamente.

**Qué se hizo:** se creó `src/test-utils/jwt.util.ts` con funciones que generan tokens idénticos a los que emite el login real (mismo formato, mismo secreto), incluyendo variantes para casos "malos" a propósito:

- Un token válido para un usuario normal.
- Un token válido para un administrador.
- Un token ya vencido (para probar que el sistema efectivamente rechaza sesiones expiradas).
- Un token con firma inválida (para probar que el sistema rechaza tokens falsificados).

**Por qué esta opción y no otra:** la alternativa habría sido, en cada prueba, registrar un usuario de verdad y hacer login de verdad contra el endpoint antes de poder probar cualquier otra cosa — esto vuelve cada prueba mucho más lenta (dos llamadas HTTP extra + hashear una contraseña, que es intencionalmente lento por seguridad) y más frágil (si el login tiene un bug, TODAS las demás pruebas fallan aunque no tengan nada que ver con login). Generar el token directamente prueba exactamente lo que cada test necesita probar, ni más ni menos.

---

## 5. Limpieza automática de la base de datos entre pruebas

**El problema:** Si una prueba crea un usuario con el correo `test@test.com`, y la siguiente prueba intenta crear otro usuario con el mismo correo, la base de datos lo rechaza (los correos son únicos) — la segunda prueba fallaría **no por un error real del código**, sino por basura que dejó la prueba anterior.

**Qué se hizo:** se creó `jest.setup.afterEnv.ts`, que automáticamente:

- Antes de empezar cualquier archivo de pruebas: vacía la base de datos de test (por si una corrida anterior quedó a la mitad).
- Después de cada prueba individual: vacía la base de datos de nuevo.
- Al terminar todas las pruebas de un archivo: vacía la base una última vez y cierra la conexión.

Esto corre automáticamente para **todos** los archivos de prueba, sin que cada quien tenga que acordarse de llamarlo manualmente.

**Por qué esta opción y no otra:** se consideró simplemente ignorar el problema y hacer que cada prueba usara datos con nombres únicos (`test-${Date.now()}@test.com`), pero eso es frágil y no escala: hay que acordarse en cada prueba nueva, y no soluciona el problema de fondo. Vaciar la base automáticamente garantiza que cada prueba empieza "de cero", sin importar qué hicieron las pruebas anteriores — es la práctica estándar de la industria para este tipo de problema.

_Nota técnica de un bug real que se encontró y corrigió en el camino:_ la primera versión de esta limpieza fallaba de forma intermitente porque MySQL usa una conexión específica para recordar "desactivé temporalmente las reglas de integridad" — y el sistema de conexiones de Prisma a veces usaba una conexión distinta para el siguiente paso, perdiendo esa configuración a mitad de camino. Se corrigió forzando que todos los pasos de la limpieza usen la misma conexión de principio a fin.

---

## 6. Silenciar el registro de consultas SQL durante las pruebas

**El problema:** Ya existía en el código una configuración (hecha antes de esta sesión, no por mí) que imprime en pantalla cada consulta SQL que se ejecuta. Es útil para depurar mientras programás, pero durante las pruebas automáticas genera cientos de líneas de ruido que tapan la información importante (qué prueba pasó, cuál falló y por qué).

**Qué se hizo:** se ajustó `src/lib/prisma.ts` para que ese registro detallado solo aparezca fuera del modo de pruebas; durante las pruebas solo se muestran advertencias y errores reales.

**Por qué esta opción:** apagarlo completamente en todos los casos hubiera sido peor — ese registro sigue siendo útil en desarrollo normal. Condicionarlo por el modo de ejecución da lo mejor de ambos mundos sin tener que tocarlo manualmente cada vez.

---

## 7. Separar el servidor en dos piezas (`app.ts` / `index.ts`)

**El problema:** Para que Supertest pueda "visitar" los endpoints sin usar la red de verdad, necesita tener acceso directo a la aplicación de Express ya armada (con todas sus rutas y reglas de seguridad) — pero **sin que el servidor esté escuchando en un puerto real**. El código original mezclaba las dos cosas en un solo archivo (`index.ts`), así que no había forma de usar una sin la otra.

**Qué se hizo:**

- Se creó `src/app.ts`: contiene toda la configuración de la aplicación (rutas, seguridad, manejo de errores) — exactamente lo mismo que había antes, solo que ahora vive en su propio archivo y se puede "importar" desde otro lado.
- `src/index.ts` quedó reducido a dos líneas: importa esa aplicación y la pone a escuchar en un puerto. Es lo único que hace ahora.

**Por qué esta opción y no otra:** es el patrón estándar en aplicaciones Express para hacerlas comprobables — separa "cómo se arma la aplicación" de "cómo se prende el servidor". No cambia absolutamente nada del comportamiento en producción (se verificó arrancando el servidor real después del cambio y respondió idéntico a como respondía antes); simplemente lo vuelve accesible para las pruebas. Antes de tocar este archivo (que es el punto de arranque de producción), se pidió confirmación explícita, siguiendo las reglas de este proyecto sobre no modificar código existente sin aprobación.

---

## 8. Pruebas del panel de administración (`/api/admin/*`)

Se escribieron pruebas automáticas reales para los tres endpoints administrativos que se pidieron, cubriendo en cada uno tanto el "camino feliz" como los casos donde algo debe fallar a propósito:

### `GET /api/admin/stats` (estadísticas del sistema)

- Rechaza con error 401 si nadie inició sesión.
- Rechaza con error 403 si quien pide las estadísticas es un usuario normal (no administrador).
- Con un administrador real: se llenó la base de test con datos conocidos (2 usuarios, 4 vacantes con distintos estados, 3 candidatos) y se comprobó que los números que devuelve el endpoint coinciden **exactamente** con lo esperado — incluyendo un caso especial (una vacante "pausada") para confirmar que no se cuenta ni como activa ni como cerrada.

### `PUT /api/admin/users/:id/role` (cambiar el rol de un usuario)

- Se probó que si se manda un rol inválido (por ejemplo `"SUPERADMIN"`, que no existe), el sistema lo rechaza con error 400 **antes** de tocar la base de datos — y se comprobó activamente que el usuario objetivo no cambió en la base, demostrando que la validación efectivamente frena la operación a tiempo.

### `DELETE /api/admin/users/:id` (borrar un usuario)

- Rechaza sin sesión (401) y con sesión de usuario normal (403), verificando además que el usuario sigue existiendo tras el intento fallido.
- Rechaza con error 400 si el identificador no es un número válido.
- Con un administrador real, borra el usuario correctamente y se confirma en la base que ya no existe.

**Por qué se probó así:** cada endpoint sensible debe demostrar tres cosas: que la seguridad funciona (nadie no autorizado puede usarlo), que los datos de entrada se validan antes de tocar la base, y que cuando todo está bien, hace exactamente lo que promete — ni más ni menos. Probar solo el "camino feliz" hubiera dado una falsa sensación de seguridad.

---

## 9. Departamentos por defecto compartidos entre el registro de usuarios y el usuario admin

**El problema:** Cuando alguien se registra como usuario nuevo, el sistema le crea automáticamente una lista de 10 departamentos típicos (Recursos Humanos, Tecnología, Finanzas, etc.) para que no empiece con la plataforma vacía. Esa lista vivía escrita adentro del controlador de registro (`users.controller.ts`) — y el usuario administrador que se crea automáticamente al instalar el proyecto (`prisma/seed.ts`) **no** recibía esos mismos departamentos, quedando inconsistente con cualquier usuario nuevo.

**Qué se hizo:**

- Se sacó la lista de departamentos a un archivo propio y compartido (`src/utils/defaultDepartments.util.ts`).
- El registro de usuarios (`users.controller.ts`) ahora usa esa lista compartida — el comportamiento para usuarios nuevos es idéntico a como era antes.
- El script que crea el usuario administrador (`prisma/seed.ts`) ahora también usa esa misma lista, agregando cada departamento **solo si todavía no existe** para ese usuario — así el script se puede correr las veces que sea sin duplicar nada ni romper si ya existían.
- **Se ejecutó el seed contra la base de datos real local** (no la de test): se verificó antes que el admin ya tenía un departamento manual ("Engineering") — ese no se tocó — y después de correr el seed, el admin quedó con ese departamento más los 10 por defecto, sin borrar ni duplicar nada.

**Por qué esta opción y no otra:** duplicar la lista en dos archivos (una copia en el controlador, otra en el seed) es una receta clásica para que, con el tiempo, alguien actualice una lista y se olvide de la otra, generando inconsistencias silenciosas. Tener una sola fuente de verdad elimina ese riesgo estructuralmente. Usar "actualizar-si-no-existe" (upsert) en vez de "crear siempre" evita que correr el script dos veces genere errores por departamentos duplicados.

---

## 10. Cambio de motor de pruebas: de `ts-jest` a `babel-jest`

**El problema:** La primera versión de la configuración (usando una herramienta llamada `ts-jest`) solo funcionaba si las pruebas se corrían con el comando exacto `npm test`, porque ese comando incluye un "interruptor" especial (`NODE_OPTIONS=--experimental-vm-modules`) que Node necesita para entender el formato de módulos moderno del proyecto. El problema salió a la luz cuando se intentó correr **una sola prueba puntual desde el editor** (un flujo de trabajo muy común y cómodo): el editor invoca Jest directamente, sin pasar por ese comando, así que el interruptor no estaba activo y todo fallaba con un error confuso.

**Qué se hizo:** se reemplazó la herramienta de traducción de código por otra (`babel-jest`), que convierte tanto el código TypeScript como los archivos `.js` viejos a un formato clásico que Jest entiende sin necesitar ningún interruptor especial. En el camino también se encontró y corrigió un problema relacionado: una librería externa (`p-limit`, usada para el motor de matching) también usa el formato moderno y necesitaba permiso explícito para ser traducida igual que el resto.

**Por qué esta opción y no otra:**

- Se evaluó la alternativa de simplemente decirle a todo el equipo "siempre corran los tests con `npm test`, nunca desde el botón del editor" — pero eso depende de que cada persona se acuerde, es fácil de olvidar, y le quita comodidad al día a día de programar (probar un solo test rápido desde el editor es un flujo de trabajo muy valioso).
- El cambio a `babel-jest` resuelve el problema de raíz para **cualquier** forma de correr las pruebas (editor, línea de comandos, integración continua) sin depender de que nadie recuerde un paso extra.
- **Contrapartida aceptada:** esta herramienta nueva solo traduce el código, no revisa si los tipos de TypeScript están bien usados (antes `ts-jest` hacía un poco de esa revisión de paso). Para no perder esa seguridad, se mantiene un chequeo de tipos completo y separado (ver punto siguiente) que sigue cubriendo tanto el código de producción como el de las pruebas.

---

## 11. Arreglo del error falso en el editor (VS Code)

**El problema:** Aunque las pruebas corrían perfectamente por la terminal, VS Code marcaba en rojo `Cannot find name 'describe'` (y funciones similares) dentro de los archivos de prueba. Esto pasaba porque VS Code, al abrir un archivo, busca automáticamente un archivo llamado exactamente `tsconfig.json` para saber las reglas del proyecto — y ese archivo, tal como estaba configurado, **excluía explícitamente los archivos de prueba** y no sabía qué era `describe`. Había un segundo archivo de configuración (`tsconfig.test.json`) que sí lo sabía, pero VS Code nunca lo encuentra automáticamente porque no se llama `tsconfig.json`.

**Qué se hizo:** se invirtieron los roles de los dos archivos de configuración:

- `tsconfig.json` (el que el editor detecta solo) ahora **sí** incluye los archivos de prueba y sabe qué son `describe`, `it`, `expect`, etc. — así el editor deja de marcar error donde no lo hay.
- Se creó `tsconfig.build.json`, usado únicamente por el comando que arma la versión final para producción (`npm run build`) — ese sí sigue excluyendo los archivos de prueba, para que nunca terminen empaquetados junto con el código real que se sube al servidor.

**Por qué esta opción y no otra:** la alternativa hubiera sido pedirle a cada desarrollador que configure manualmente su editor para reconocer el segundo archivo — again, depende de que cada persona lo haga bien, y no es portable entre editores distintos (VS Code, WebStorm, etc.). Invertir los roles hace que el comportamiento correcto sea el que pasa "por defecto", sin configuración manual de nadie, y sigue garantizando que el código de producción (`dist/`, lo que efectivamente corre en el servidor) nunca incluya nada relacionado con pruebas. Se verificó expresamente que, tras el cambio, `npm run build` sigue generando exactamente los mismos archivos de siempre, sin nada de tests mezclado.

---

## 12. Inventario completo de archivos

### Archivos nuevos

| Archivo                                | Qué es                                                                                                                           |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `jest.config.js`                       | Configuración principal de Jest (qué archivos son pruebas, cómo traducirlos, que corran de a una)                                |
| `jest.setup.ts`                        | Carga la configuración de la base de datos de test antes de cada archivo de pruebas, con el chequeo de seguridad anti-corrupción |
| `jest.setup.afterEnv.ts`               | Limpieza automática de la base de datos antes/después de cada prueba                                                             |
| `babel.config.cjs`                     | Configuración de la herramienta que traduce el código para que Jest lo entienda                                                  |
| `tsconfig.build.json`                  | Reglas de TypeScript usadas solo para armar la versión de producción (excluye pruebas)                                           |
| `src/app.ts`                           | La aplicación de Express ya armada, sin el servidor prendido — permite que las pruebas la usen directamente                      |
| `src/test-utils/jwt.util.ts`           | Generador de tokens de sesión falsos para pruebas                                                                                |
| `src/test-utils/db.util.ts`            | Función que vacía la base de datos de test de forma segura                                                                       |
| `src/routes/admin.test.ts`             | Las pruebas automáticas del panel de administración (los 3 endpoints pedidos)                                                    |
| `src/utils/defaultDepartments.util.ts` | Lista compartida de los 10 departamentos por defecto                                                                             |
| `.env.test`                            | Configuración de conexión a la base de datos de test _(no viaja a git, contiene una contraseña local)_                           |

### Archivos modificados

| Archivo                               | Qué cambió                                                                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `package.json` / `package-lock.json`  | Nuevas herramientas de testing instaladas; nuevos comandos (`test`, `test:watch`); `build` ahora usa `tsconfig.build.json` |
| `.gitignore`                          | Se agregó `.env.test` para que nunca se suba a git                                                                         |
| `tsconfig.json`                       | Ahora incluye los archivos de prueba y reconoce sus funciones especiales (ver punto 11)                                    |
| `tsconfig.tsbuildinfo`                | Archivo de caché interno de TypeScript — se regenera solo, no requiere revisión                                            |
| `src/index.ts`                        | Reducido a solo arrancar el servidor (ver punto 7)                                                                         |
| `src/lib/prisma.ts`                   | El registro detallado de consultas SQL ahora se apaga durante las pruebas (ver punto 6)                                    |
| `src/controllers/users.controller.ts` | Usa la lista compartida de departamentos por defecto en vez de tener su propia copia (ver punto 9)                         |
| `prisma/seed.ts`                      | Ahora también le asigna los departamentos por defecto al usuario administrador (ver punto 9)                               |

### Cambios fuera del control de versiones (no aparecen en git, pero son reales)

- **Base de datos `talentmatch_test`** creada en el motor de MySQL local, con su propio usuario de acceso restringido (ver punto 2).
- **El seed se corrió contra la base real local** (`talentmatch_prod`): el usuario administrador quedó con sus departamentos por defecto además del que ya tenía (ver punto 9). Esto sí modificó datos reales de tu entorno local, de forma deliberada y verificada, no la base de producción del servidor.

---

## 13. Qué falta hacer / cómo probarlo en otra máquina

Para que otra persona (u otra máquina) pueda correr esta suite de pruebas, necesita:

1. Instalar las dependencias nuevas: `npm install`.
2. Tener el contenedor de MySQL local corriendo (`docker compose -f docker-compose.local.yml up -d`).
3. Crear su propia base `talentmatch_test` y su usuario restringido (los mismos comandos SQL usados en el punto 2 — no están automatizados en un script todavía, es un paso manual pendiente).
4. Crear su propio archivo `.env.test` (no existe una plantilla commiteada — también pendiente si se quiere automatizar esto).
5. Aplicar las migraciones sobre esa base nueva: `DATABASE_URL="<url de talentmatch_test>" npx prisma migrate deploy`.
6. Correr `npm test`.

**Nada de esto está commiteado todavía** — este documento sirve como registro de todo lo que habría que revisar antes de aprobar y subir estos cambios.
