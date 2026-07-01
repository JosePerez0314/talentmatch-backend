# TalentMatch AI - Arquitectura y Reglas de Ingeniería

## Contexto del Proyecto

- **Propósito:** Plataforma B2B para la automatización en la selección y evaluación de candidatos para Recursos Humanos.
- **Stack Backend:** Node.js con Express. Actualmente es un código híbrido entre JavaScript y TypeScript (en proceso de migración hacia TS estricto).
- **Capa de Datos:** MySQL gestionado a través de Prisma ORM.
- **Infraestructura Local:** Docker se utiliza _exclusivamente_ para levantar el motor de base de datos MySQL. El backend se ejecuta de forma nativa.
- **Infraestructura VPS:** Despliegue 100% contenerizado. Tanto el backend de Node como MySQL corren bajo Docker.

## Reglas de Ejecución Estrictas para Claude

1. **Cero Autonomía y Aprobación Obligatoria:** NO eres un agente autónomo. Tienes estrictamente prohibido modificar, sobrescribir o eliminar código sin mi aprobación explícita. Debes proponer la solución, mostrar el código y esperar mi confirmación.
2. **Bloqueo de Acciones Sensibles:** Nunca ejecutes comandos de terminal, alteraciones de esquema, migraciones de base de datos (Prisma), ni acciones destructivas sin explicarme detalladamente el impacto y obtener mi autorización previa.
3. **Transición a TypeScript:** Si editas un archivo `.js` existente, mantén la compatibilidad. Si creas o editas un archivo `.ts`, aplica tipado estricto. Evita el uso de `any`.
4. **Cero Atajos CRUD:** Prioriza el rendimiento, la escalabilidad y la separación limpia de responsabilidades (Rutas -> Middlewares de Validación -> Controladores -> Servicios -> Prisma).
5. **Validación Implacable:** Todo payload entrante (`req.body`, `req.params`, `req.query`) DEBE ser validado y sanitizado rigurosamente antes de interactuar con la base de datos. Analiza exhaustivamente casos de borde (ej. strings por defecto como "NONE").
6. **Manejo de Errores:** Utiliza el `errorHandler` y `catchAsync` ya existentes en la carpeta `src/lib/` y `src/middlewares/`. Responde siempre con códigos de estado HTTP semánticos.
7. **Transacciones de Base de Datos:** Si una operación de RRHH requiere múltiples escrituras dependientes, es obligatorio usar `$transaction` en Prisma para garantizar la consistencia en MySQL.
