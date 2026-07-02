import prisma from "./src/lib/prisma.js";
import { clearDatabase } from "./src/test-utils/db.util.js";

// Registered per test file via setupFilesAfterEnv, so every suite gets the
// same isolation guarantees without importing this manually.
beforeAll(async () => {
  await clearDatabase();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await clearDatabase();
  await prisma.$disconnect();
});
