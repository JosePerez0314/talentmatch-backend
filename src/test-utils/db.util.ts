import prisma from "../lib/prisma.js";

// Refuses to run against anything but the dedicated test schema — this
// function is destructive (TRUNCATE), so a wrong DATABASE_URL here would
// wipe development/production data instead of just failing a test.
const assertTestDatabase = async (): Promise<void> => {
  const [{ db }] = await prisma.$queryRaw<{ db: string }[]>`SELECT DATABASE() AS db`;
  if (db !== "talentmatch_test") {
    throw new Error(
      `Refusing to clear database "${db}" — clearDatabase() only runs against talentmatch_test.`,
    );
  }
};

// Reads the live table list instead of hardcoding model names, so cleanup
// doesn't silently go stale when the Prisma schema grows a new model.
const getAppTableNames = async (): Promise<string[]> => {
  const rows = await prisma.$queryRaw<{ TABLE_NAME: string }[]>`
    SELECT TABLE_NAME FROM information_schema.tables
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME != '_prisma_migrations'
  `;
  return rows.map((row) => row.TABLE_NAME);
};

// Empties every application table and resets auto-increment counters, so
// each test starts from row id 1 with no leftover unique values (email,
// hash, etc.) from a previous test.
export const clearDatabase = async (): Promise<void> => {
  await assertTestDatabase();
  const tables = await getAppTableNames();

  // SET FOREIGN_KEY_CHECKS is session-scoped in MySQL, so every statement
  // here must run on the same pooled connection — an interactive
  // transaction is what guarantees that, unlike separate top-level calls.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");
    for (const table of tables) {
      await tx.$executeRawUnsafe(`TRUNCATE TABLE \`${table}\``);
    }
    await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1");
  });
};
