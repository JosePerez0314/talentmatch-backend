import dotenv from "dotenv";

// Runs before every test file, and before any app import.
// override:true ensures .env.test wins even if the shell already has a
// development/production DATABASE_URL exported.
dotenv.config({ path: ".env.test", override: true });

if (!process.env.DATABASE_URL?.includes("talentmatch_test")) {
  throw new Error(
    "DATABASE_URL no apunta a talentmatch_test — abortando para evitar tocar development/production."
  );
}
