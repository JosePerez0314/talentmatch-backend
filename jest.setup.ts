import dotenv from "dotenv";
import fs from "node:fs";

// Runs before every test file, and before any app import.
// override:true ensures .env.test wins even if the shell already has a
// development/production DATABASE_URL exported.
dotenv.config({ path: ".env.test", override: true });

if (!process.env.DATABASE_URL?.includes("talentmatch_test")) {
  throw new Error(
    "DATABASE_URL no apunta a talentmatch_test — abortando para evitar tocar development/production."
  );
}

// Opt-in external-service tests (RUN_EXTERNAL_TESTS=true, set by scripts/test.ts)
// need REAL OpenAI/Cloudinary credentials — the values in .env.test are
// placeholders. We pull ONLY those two keys from `.env` at runtime; DATABASE_URL
// and JWT_SECRET are never overridden, so the test-DB guard above stays the sole
// authority and dev/prod data can never be touched. `.env.parse` does not mutate
// process.env, so nothing else from `.env` leaks in.
if (process.env.RUN_EXTERNAL_TESTS === "true") {
  const EXTERNAL_KEYS = ["OPENAI_API_KEY", "CLOUDINARY_URL"] as const;
  try {
    const realEnv = dotenv.parse(fs.readFileSync(".env"));
    for (const key of EXTERNAL_KEYS) {
      const value = realEnv[key];
      if (value) process.env[key] = value;
    }
  } catch {
    console.warn(
      "[test] RUN_EXTERNAL_TESTS=true pero no se pudo leer .env — los tests externos usarán claves placeholder y fallarán.",
    );
  }
}
