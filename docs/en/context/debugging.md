---
name: debug-backend
description: Strict diagnostic workflow for Node.js, Express, and Prisma failures.
Use when user asks to [debug a route, fix a backend crash, trace a database error].
---

# Backend Debugging Protocol
When debugging issues in TalentMatch AI, follow this exact sequence:
1. **Trace the Request:** Analyze the Express controller and validate the incoming payload.
2. **Database Layer:** Verify the Prisma query. Check for unindexed lookups, N+1 query problems, or schema mismatches.
3. **Error Boundaries:** Identify if the error was caught by the Express global error handler or if it crashed the Node event loop.
4. **The Fix:** Do not just output the fixed code. Explain the architectural reason for the failure and how to prevent it across the entire system.
