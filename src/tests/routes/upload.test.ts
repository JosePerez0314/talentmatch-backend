import path from "node:path";
import request from "supertest";
import app from "../../app.js";
import prisma from "../../lib/prisma.js";
import { authHeaderFor } from "../utils/jwt.util.js";
import { generateMockCvs } from "../utils/generateMockCvs.js";

// `npm test upload` is a throughput/benchmark test, not a correctness unit test.
// It generates 100 realistic CV PDFs, uploads them to the real endpoint (which
// calls OpenAI + Cloudinary at concurrency 5 via p-limit), and measures how long
// the batch takes. scripts/test.ts runs it with:
//   - RUN_EXTERNAL_TESTS=true  -> real OpenAI/Cloudinary keys loaded from `.env`
//   - KEEP_TEST_DATA=true      -> the global truncation hooks are disabled so the
//                                 candidates persist; this file does its own
//                                 cleanup, keeping only the latest batch.
const RUN_EXTERNAL = process.env.RUN_EXTERNAL_TESTS === "true";
const describeExternal = RUN_EXTERNAL ? describe : describe.skip;

const PERF_EMAIL = "upload-perf@test.com";
const CV_COUNT = 100; // the per-request cap enforced by multer (upload.array("pdfs", 100))
const OUT_DIR = path.join(process.cwd(), "mock_cvs");
const PERF_TIMEOUT_MS = 15 * 60 * 1000; // 100 real OpenAI+Cloudinary round-trips
const LIMIT_TIMEOUT_MS = 60 * 1000;

// Removes the previous run's perf graph so the DB never accumulates junk — only
// the latest 100 candidates survive. FK-safe order: candidates (restrict user,
// cascade vacancy) -> vacancies -> positions -> departments -> user.
const cleanupPreviousRun = async (): Promise<void> => {
  const previous = await prisma.user.findUnique({ where: { email: PERF_EMAIL } });
  if (!previous) return;

  await prisma.candidate.deleteMany({ where: { userId: previous.id } });
  await prisma.vacancy.deleteMany({ where: { userId: previous.id } });
  await prisma.position.deleteMany({ where: { userId: previous.id } });
  await prisma.department.deleteMany({ where: { userId: previous.id } });
  await prisma.user.delete({ where: { id: previous.id } });
};

const seedPerfGraph = async (): Promise<{ ownerId: number; vacancyId: number }> => {
  const owner = await prisma.user.create({
    data: { email: PERF_EMAIL, password: "hashed", role: "USER" },
  });
  const department = await prisma.department.create({
    data: { title: "Engineering", userId: owner.id },
  });
  const position = await prisma.position.create({
    data: {
      role: "Backend Developer",
      yearsOfExperience: 3,
      description: "Perf-test position used as the vacancy's requirement baseline.",
      technicalSkills: ["JavaScript", "TypeScript", "Node.js"],
      optionalTechnicalSkills: ["Docker"],
      softSkills: ["Communication"],
      languages: ["English"],
      educationLevel: "UNIVERSITY",
      educationArea: "Computer Science",
      departmentId: department.id,
      userId: owner.id,
    },
  });
  const vacancy = await prisma.vacancy.create({
    data: {
      title: "Backend Vacancy (perf)",
      availableSlots: 100,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      status: "ACTIVE",
      positionId: position.id,
      departmentId: department.id,
      userId: owner.id,
    },
  });

  return { ownerId: owner.id, vacancyId: vacancy.id };
};

describeExternal("POST /api/vacancies/:id/upload — 100-CV throughput (external)", () => {
  let token: string;
  let ownerId: number;
  let vacancyId: number;
  let cvPaths: string[];

  beforeAll(async () => {
    await cleanupPreviousRun();
    const seeded = await seedPerfGraph();
    ownerId = seeded.ownerId;
    vacancyId = seeded.vacancyId;
    token = authHeaderFor({ userId: ownerId, role: "USER" });
    cvPaths = await generateMockCvs(CV_COUNT, OUT_DIR);
  }, PERF_TIMEOUT_MS);

  it("uploads 100 CVs (max 5 processed concurrently) and persists them, measuring throughput", async () => {
    let req = request(app)
      .post(`/api/vacancies/${vacancyId}/upload`)
      .set("Authorization", token);
    for (const filePath of cvPaths) req = req.attach("pdfs", filePath);

    const start = performance.now();
    const res = await req;
    const elapsedMs = performance.now() - start;

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(CV_COUNT);

    const results = res.body.data as Array<{ success: boolean }>;
    const successes = results.filter((r) => r.success).length;
    const persisted = await prisma.candidate.count({ where: { userId: ownerId } });

    // Throughput report — the point of this test.
    console.log(
      `[upload perf] ${successes}/${CV_COUNT} CVs processed in ${(
        elapsedMs / 1000
      ).toFixed(1)}s ` +
        `(${(elapsedMs / CV_COUNT).toFixed(0)} ms/CV avg, controller concurrency = 5)`,
    );

    expect(successes).toBeGreaterThan(0);
    // Each unique CV yields one candidate row (dedup is by content hash).
    expect(persisted).toBe(successes);
  }, PERF_TIMEOUT_MS);

  it("rejects a request with more than 100 PDFs (per-request cap is 100)", async () => {
    const before = await prisma.candidate.count({ where: { userId: ownerId } });

    let req = request(app)
      .post(`/api/vacancies/${vacancyId}/upload`)
      .set("Authorization", token);
    // 101 attachments — multer errors on the 101st before the controller runs,
    // so no OpenAI calls happen and nothing new is persisted.
    for (let i = 0; i < CV_COUNT + 1; i++) {
      req = req.attach("pdfs", cvPaths[i % cvPaths.length]);
    }
    const res = await req;

    expect(res.status).not.toBe(201);
    const after = await prisma.candidate.count({ where: { userId: ownerId } });
    expect(after).toBe(before);
  }, LIMIT_TIMEOUT_MS);
});
