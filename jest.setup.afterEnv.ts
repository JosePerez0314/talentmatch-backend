import prisma from "./src/lib/prisma.js";
import { clearDatabase } from "./src/tests/utils/db.util.js";

// The upload throughput test (`npm test upload`) opts out of truncation via
// KEEP_TEST_DATA=true (set by scripts/test.ts) so its generated candidates
// persist across runs — it manages its own cleanup, keeping only the latest
// batch. Every other run keeps the normal per-test isolation. The DB guard in
// db.util.ts still refuses to touch anything but talentmatch_test either way.
const KEEP_TEST_DATA = process.env.KEEP_TEST_DATA === "true";

// Registered per test file via setupFilesAfterEnv, so every suite gets the
// same isolation guarantees without importing this manually.
beforeAll(async () => {
  if (!KEEP_TEST_DATA) await clearDatabase();
});

afterEach(async () => {
  if (!KEEP_TEST_DATA) await clearDatabase();
});

afterAll(async () => {
  if (!KEEP_TEST_DATA) await clearDatabase();
  await prisma.$disconnect();
});
