// Shared between users.controller.ts (new signups) and prisma/seed.ts
// (default admin) so both provision the exact same starter departments.
export const DEFAULT_DEPARTMENTS: readonly string[] = [
  "Recursos Humanos (HR)",
  "Tecnología / TI",
  "Finanzas",
  "Marketing",
  "Ventas",
  "Operaciones",
  "Atención al Cliente",
  "Legal",
  "Servicio al Cliente",
  "Logística",
];
