---
name: debug-backend
description: Flujo de diagnóstico estricto para fallas de Node.js, Express y Prisma.
Usar cuando el usuario pida [debuggear una ruta, arreglar un crash del backend, rastrear un error de base de datos].
---

# Protocolo de Debugging del Backend

Al debuggear problemas en TalentMatch AI, sigue esta secuencia exacta:

1. **Rastrea el request:** analiza el controlador de Express y valida el payload entrante.
2. **Capa de base de datos:** verifica la consulta de Prisma. Busca lookups sin índice, problemas de consultas N+1 o desajustes de esquema.
3. **Fronteras de error:** identifica si el error fue capturado por el handler global de errores de Express o si crasheó el event loop de Node.
4. **El arreglo:** no te limites a mostrar el código arreglado. Explica la razón arquitectónica de la falla y cómo prevenirla en todo el sistema.
