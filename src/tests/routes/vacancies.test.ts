import request from "supertest";
import app from "../../app.js";
import prisma from "../../lib/prisma.js";
import { authHeaderFor, TestUserRole } from "../utils/jwt.util.js";
import { makePdfBuffer, SAMPLE_CV_TEXT } from "../utils/pdf.util.js";
import { generateCvHash } from "../../utils/hash.util.js";
import { findExistingCandidateByCv } from "../../services/cvProcessing.service.js";
import * as extractCvPrompt from "../../prompts/extractCv.prompt.js";
import * as matchEnginePrompt from "../../prompts/matchEngine.prompt.js";
import * as cloudinaryService from "../../services/cloudinary.service.js";
import type { CandidateExtracted } from "../../types/candidates.types.js";

const seedUser = (email: string, role: TestUserRole = "USER") =>
  prisma.user.create({ data: { email, password: "hashed", role } });

const tokenFor = (user: { id: number; role: TestUserRole }) =>
  authHeaderFor({ userId: user.id, role: user.role });

const seedDepartment = (userId: number, title: string) =>
  prisma.department.create({ data: { title, userId } });

const seedPosition = (userId: number, departmentId: number) =>
  prisma.position.create({
    data: {
      role: "Backend Developer",
      yearsOfExperience: 2,
      description: "Seeded position for vacancy tests.",
      technicalSkills: ["JavaScript"],
      optionalTechnicalSkills: [],
      softSkills: ["Communication"],
      languages: ["English"],
      educationLevel: "UNIVERSITY",
      educationArea: "Computer Science",
      departmentId,
      userId,
    },
  });

const seedVacancy = (
  userId: number,
  departmentId: number,
  positionId: number,
  status: "ACTIVE" | "PAUSED" | "CLOSED" = "ACTIVE",
  title = "Backend Vacancy",
) =>
  prisma.vacancy.create({
    data: {
      title,
      availableSlots: 1,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      status,
      positionId,
      departmentId,
      userId,
    },
  });

const seedCandidate = (userId: number, vacancyId: number, hash: string) =>
  prisma.candidate.create({
    data: {
      fullName: "Test Candidate",
      email: `${hash}@test.com`,
      description: "Seeded candidate for vacancy evaluation/results tests.",
      educationLevel: "UNIVERSITY",
      educationArea: "Computer Science",
      languages: ["English"],
      optionalTechnicalSkills: [],
      softSkills: ["Communication"],
      technicalSkills: ["JavaScript"],
      role: "Backend Developer",
      yearsOfExperience: 3,
      hash,
      rawApiPayload: {},
      userId,
      vacancyId,
    },
  });

const seedMatchResult = (candidateId: number, vacancyId: number, score: number) =>
  prisma.matchResult.create({
    data: {
      matchScore: score,
      educationScore: 10,
      experienceScore: 10,
      hardSkillsScore: 10,
      languagesScore: 10,
      roleScore: 10,
      softSkillsScore: 10,
      normalizedCandidate: {},
      summary: "Seeded match result.",
      candidateId,
      vacancyId,
    },
  });

// Seeds a full owner + department + position graph, returning what most tests need.
const seedGraph = async (email = "owner@test.com") => {
  const owner = await seedUser(email);
  const department = await seedDepartment(owner.id, "Engineering");
  const position = await seedPosition(owner.id, department.id);
  return { owner, department, position };
};

const validVacancyBody = (departmentId: number, positionId: number) => ({
  title: "Backend Vacancy",
  availableSlots: 2,
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  status: "ACTIVE",
  departmentId,
  positionId,
});

// Opt-in only: upload -> OpenAI + Cloudinary, evaluations -> OpenAI.
const RUN_EXTERNAL = process.env.RUN_EXTERNAL_TESTS === "true";
const describeExternal = RUN_EXTERNAL ? describe : describe.skip;
// Real OpenAI + Cloudinary round-trips blow past Jest's 5s default, so the
// opt-in external tests get a generous per-test timeout.
const EXTERNAL_TIMEOUT_MS = 120_000;

describe("POST /api/vacancies", () => {
  it("returns 201 Created and persists the vacancy (happy path)", async () => {
    const { owner, department, position } = await seedGraph();

    const res = await request(app)
      .post("/api/vacancies")
      .set("Authorization", tokenFor(owner))
      .send(validVacancyBody(department.id, position.id));

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      title: "Backend Vacancy",
      userId: owner.id,
      positionId: position.id,
    });
  });

  it("returns 401 Unauthorized when no token is provided", async () => {
    const res = await request(app)
      .post("/api/vacancies")
      .send(validVacancyBody(1, 1));
    expect(res.status).toBe(401);
    expect(await prisma.vacancy.count()).toBe(0);
  });

  it("returns 404 when the department does not belong to the user", async () => {
    const owner = await seedUser("owner@test.com");
    const other = await seedGraph("other@test.com");

    const res = await request(app)
      .post("/api/vacancies")
      .set("Authorization", tokenFor(owner))
      .send(validVacancyBody(other.department.id, other.position.id));

    expect(res.status).toBe(404);
  });

  it("returns 400 when the department has no positions", async () => {
    const owner = await seedUser("owner@test.com");
    const emptyDept = await seedDepartment(owner.id, "Empty");

    const res = await request(app)
      .post("/api/vacancies")
      .set("Authorization", tokenFor(owner))
      .send(validVacancyBody(emptyDept.id, 999999));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Department has no positions");
  });

  it("returns 400 when the position does not belong to the department", async () => {
    const { owner, department } = await seedGraph();
    const otherDept = await seedDepartment(owner.id, "Marketing");
    const foreignPosition = await seedPosition(owner.id, otherDept.id);

    const res = await request(app)
      .post("/api/vacancies")
      .set("Authorization", tokenFor(owner))
      .send(validVacancyBody(department.id, foreignPosition.id));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Position does not belong to this department");
  });

  it("returns 400 when startDate is not before endDate", async () => {
    const { owner, department, position } = await seedGraph();

    const res = await request(app)
      .post("/api/vacancies")
      .set("Authorization", tokenFor(owner))
      .send({
        ...validVacancyBody(department.id, position.id),
        startDate: "2026-12-31",
        endDate: "2026-01-01",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
  });

  it("returns 400 when the title is empty", async () => {
    const { owner, department, position } = await seedGraph();

    const res = await request(app)
      .post("/api/vacancies")
      .set("Authorization", tokenFor(owner))
      .send({ ...validVacancyBody(department.id, position.id), title: "" });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "body.title" }),
      ]),
    );
  });
});

describe("GET /api/vacancies", () => {
  it("returns 401 Unauthorized when no token is provided", async () => {
    const res = await request(app).get("/api/vacancies");
    expect(res.status).toBe(401);
  });

  it("returns 200 with only the requesting user's vacancies", async () => {
    const { owner, department, position } = await seedGraph();
    const other = await seedGraph("other@test.com");
    await seedVacancy(owner.id, department.id, position.id, "ACTIVE", "Mine A");
    await seedVacancy(owner.id, department.id, position.id, "ACTIVE", "Mine B");
    await seedVacancy(
      other.owner.id,
      other.department.id,
      other.position.id,
      "ACTIVE",
      "Not Mine",
    );

    const res = await request(app)
      .get("/api/vacancies")
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(200);
    expect(res.body.response.data).toHaveLength(2);
  });
});

describe("GET /api/vacancies/:id", () => {
  it("returns 200 with the vacancy (happy path)", async () => {
    const { owner, department, position } = await seedGraph();
    const vacancy = await seedVacancy(owner.id, department.id, position.id);

    const res = await request(app)
      .get(`/api/vacancies/${vacancy.id}`)
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: vacancy.id });
  });

  it("returns 400 when the id param is invalid", async () => {
    const owner = await seedUser("owner@test.com");
    const res = await request(app)
      .get("/api/vacancies/not-a-number")
      .set("Authorization", tokenFor(owner));
    expect(res.status).toBe(400);
  });

  it("returns 404 when the vacancy does not exist", async () => {
    const owner = await seedUser("owner@test.com");
    const res = await request(app)
      .get("/api/vacancies/999999")
      .set("Authorization", tokenFor(owner));
    expect(res.status).toBe(404);
  });

  it("returns 404 when the vacancy belongs to another user", async () => {
    const owner = await seedUser("owner@test.com");
    const other = await seedGraph("other@test.com");
    const vacancy = await seedVacancy(
      other.owner.id,
      other.department.id,
      other.position.id,
    );

    const res = await request(app)
      .get(`/api/vacancies/${vacancy.id}`)
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(404);
  });

  it("returns 401 when no token is provided", async () => {
    const res = await request(app).get("/api/vacancies/1");
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/vacancies/:id/status", () => {
  it("returns 200 and updates the status (happy path)", async () => {
    const { owner, department, position } = await seedGraph();
    const vacancy = await seedVacancy(owner.id, department.id, position.id);

    const res = await request(app)
      .patch(`/api/vacancies/${vacancy.id}/status`)
      .set("Authorization", tokenFor(owner))
      .send({ status: "PAUSED" });

    expect(res.status).toBe(200);
    expect(res.body.response.data.status).toBe("PAUSED");
  });

  it("returns 400 for an invalid status value", async () => {
    const { owner, department, position } = await seedGraph();
    const vacancy = await seedVacancy(owner.id, department.id, position.id);

    const res = await request(app)
      .patch(`/api/vacancies/${vacancy.id}/status`)
      .set("Authorization", tokenFor(owner))
      .send({ status: "OPEN" });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "body.status" }),
      ]),
    );
  });

  it("returns 404 when the vacancy does not exist", async () => {
    const owner = await seedUser("owner@test.com");
    const res = await request(app)
      .patch("/api/vacancies/999999/status")
      .set("Authorization", tokenFor(owner))
      .send({ status: "CLOSED" });
    expect(res.status).toBe(404);
  });

  it("returns 401 when no token is provided", async () => {
    const res = await request(app)
      .patch("/api/vacancies/1/status")
      .send({ status: "CLOSED" });
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/vacancies/:id", () => {
  it("returns 200 and updates the vacancy (happy path)", async () => {
    const { owner, department, position } = await seedGraph();
    const vacancy = await seedVacancy(owner.id, department.id, position.id);

    const res = await request(app)
      .put(`/api/vacancies/${vacancy.id}`)
      .set("Authorization", tokenFor(owner))
      .send({ title: "Renamed Vacancy" });

    expect(res.status).toBe(200);
    expect(res.body.response.data.title).toBe("Renamed Vacancy");
  });

  it("returns 400 when startDate is not before endDate", async () => {
    const { owner, department, position } = await seedGraph();
    const vacancy = await seedVacancy(owner.id, department.id, position.id);

    const res = await request(app)
      .put(`/api/vacancies/${vacancy.id}`)
      .set("Authorization", tokenFor(owner))
      .send({ startDate: "2026-12-31", endDate: "2026-01-01" });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "body.endDate" }),
      ]),
    );
  });

  it("returns 404 when the vacancy does not exist", async () => {
    const owner = await seedUser("owner@test.com");
    const res = await request(app)
      .put("/api/vacancies/999999")
      .set("Authorization", tokenFor(owner))
      .send({ title: "Renamed" });
    expect(res.status).toBe(404);
  });

  it("returns 404 when the vacancy belongs to another user", async () => {
    const owner = await seedUser("owner@test.com");
    const other = await seedGraph("other@test.com");
    const vacancy = await seedVacancy(
      other.owner.id,
      other.department.id,
      other.position.id,
    );

    const res = await request(app)
      .put(`/api/vacancies/${vacancy.id}`)
      .set("Authorization", tokenFor(owner))
      .send({ title: "Hijacked" });

    expect(res.status).toBe(404);
  });

  it("returns 401 when no token is provided", async () => {
    const res = await request(app)
      .put("/api/vacancies/1")
      .send({ title: "Renamed" });
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/vacancies/:id", () => {
  it("returns 200 and removes the vacancy (happy path)", async () => {
    const { owner, department, position } = await seedGraph();
    const vacancy = await seedVacancy(owner.id, department.id, position.id);

    const res = await request(app)
      .delete(`/api/vacancies/${vacancy.id}`)
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(
      await prisma.vacancy.findUnique({ where: { id: vacancy.id } }),
    ).toBeNull();
  });

  it("returns 404 when the vacancy does not exist", async () => {
    const owner = await seedUser("owner@test.com");
    const res = await request(app)
      .delete("/api/vacancies/999999")
      .set("Authorization", tokenFor(owner));
    expect(res.status).toBe(404);
  });

  it("returns 404 when the vacancy belongs to another user", async () => {
    const owner = await seedUser("owner@test.com");
    const other = await seedGraph("other@test.com");
    const vacancy = await seedVacancy(
      other.owner.id,
      other.department.id,
      other.position.id,
    );

    const res = await request(app)
      .delete(`/api/vacancies/${vacancy.id}`)
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(404);
    expect(
      await prisma.vacancy.findUnique({ where: { id: vacancy.id } }),
    ).not.toBeNull();
  });

  it("returns 401 when no token is provided", async () => {
    const res = await request(app).delete("/api/vacancies/1");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/vacancies/:id/results", () => {
  it("returns 200 with an empty list and pagination meta when there are no results", async () => {
    const { owner, department, position } = await seedGraph();
    const vacancy = await seedVacancy(owner.id, department.id, position.id);

    const res = await request(app)
      .get(`/api/vacancies/${vacancy.id}/results`)
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta).toMatchObject({ total: 0, page: 1, limit: 20 });
  });

  it("returns 200 with the vacancy's match results ordered by score", async () => {
    const { owner, department, position } = await seedGraph();
    const vacancy = await seedVacancy(owner.id, department.id, position.id);
    const candidateA = await seedCandidate(owner.id, vacancy.id, "hash-a");
    const candidateB = await seedCandidate(owner.id, vacancy.id, "hash-b");
    await seedMatchResult(candidateA.id, vacancy.id, 55);
    await seedMatchResult(candidateB.id, vacancy.id, 90);

    const res = await request(app)
      .get(`/api/vacancies/${vacancy.id}/results?page=1&limit=10`)
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].matchScore).toBe(90); // desc order
    expect(res.body.meta).toMatchObject({ total: 2, page: 1, limit: 10 });
  });

  it("does not leak match results from another user's vacancy", async () => {
    const owner = await seedUser("owner@test.com");
    const other = await seedGraph("other@test.com");
    const foreignVacancy = await seedVacancy(
      other.owner.id,
      other.department.id,
      other.position.id,
    );
    const foreignCandidate = await seedCandidate(
      other.owner.id,
      foreignVacancy.id,
      "hash-foreign",
    );
    await seedMatchResult(foreignCandidate.id, foreignVacancy.id, 80);

    const res = await request(app)
      .get(`/api/vacancies/${foreignVacancy.id}/results`)
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  it("returns 401 when no token is provided", async () => {
    const res = await request(app).get("/api/vacancies/1/results");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/vacancies/:id/evaluations", () => {
  it("returns 404 when the vacancy does not exist", async () => {
    const owner = await seedUser("owner@test.com");
    const res = await request(app)
      .post("/api/vacancies/999999/evaluations")
      .set("Authorization", tokenFor(owner));
    expect(res.status).toBe(404);
  });

  it("returns 400 when there are no candidates to evaluate", async () => {
    const { owner, department, position } = await seedGraph();
    const vacancy = await seedVacancy(owner.id, department.id, position.id);

    const res = await request(app)
      .post(`/api/vacancies/${vacancy.id}/evaluations`)
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("No candidates to evaluate");
  });

  it("returns 401 when no token is provided", async () => {
    const res = await request(app).post("/api/vacancies/1/evaluations");
    expect(res.status).toBe(401);
  });

  describeExternal("external: OpenAI match engine", () => {
    it("returns 201 and persists a match result per candidate", async () => {
      const { owner, department, position } = await seedGraph();
      const vacancy = await seedVacancy(owner.id, department.id, position.id);
      await seedCandidate(owner.id, vacancy.id, "hash-eval");

      const res = await request(app)
        .post(`/api/vacancies/${vacancy.id}/evaluations`)
        .set("Authorization", tokenFor(owner));

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const persisted = await prisma.matchResult.count({
        where: { vacancyId: vacancy.id },
      });
      expect(persisted).toBeGreaterThan(0);
    }, EXTERNAL_TIMEOUT_MS);
  });
});

describe("POST /api/vacancies/:id/upload", () => {
  it("returns 400 when the id param is invalid", async () => {
    const owner = await seedUser("owner@test.com");
    const res = await request(app)
      .post("/api/vacancies/not-a-number/upload")
      .set("Authorization", tokenFor(owner));
    expect(res.status).toBe(400);
  });

  it("returns 400 when no PDF file is uploaded", async () => {
    const { owner, department, position } = await seedGraph();
    const vacancy = await seedVacancy(owner.id, department.id, position.id);

    const res = await request(app)
      .post(`/api/vacancies/${vacancy.id}/upload`)
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("No PDF file uploaded");
  });

  it("returns 401 when no token is provided", async () => {
    const res = await request(app).post("/api/vacancies/1/upload");
    expect(res.status).toBe(401);
  });

  describeExternal("external: CV parsing via OpenAI + Cloudinary", () => {
    it("returns 201 and persists a candidate from an uploaded CV", async () => {
      const { owner, department, position } = await seedGraph();
      const vacancy = await seedVacancy(owner.id, department.id, position.id);
      const pdf = await makePdfBuffer(SAMPLE_CV_TEXT);

      const res = await request(app)
        .post(`/api/vacancies/${vacancy.id}/upload`)
        .set("Authorization", tokenFor(owner))
        .attach("pdfs", pdf, "cv.pdf");

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0].success).toBe(true);
    }, EXTERNAL_TIMEOUT_MS);
  });
});

describe("CV hashing", () => {
  // generateCvHash is a pure function: no DB, no external services.
  describe("generateCvHash (pure)", () => {
    it("is deterministic for the same string input", () => {
      expect(generateCvHash("some cv text")).toBe(generateCvHash("some cv text"));
    });

    it("is deterministic for the same buffer input", () => {
      expect(generateCvHash(Buffer.from("some cv bytes"))).toBe(
        generateCvHash(Buffer.from("some cv bytes")),
      );
    });

    it("returns a 64-char lowercase hex SHA-256 digest", () => {
      expect(generateCvHash("anything")).toMatch(/^[a-f0-9]{64}$/);
    });

    it("produces different hashes for different content", () => {
      expect(generateCvHash("alice cv")).not.toBe(generateCvHash("bob cv"));
    });

    it("trims surrounding whitespace for string inputs", () => {
      expect(generateCvHash("  cv text  ")).toBe(generateCvHash("cv text"));
    });

    it("does NOT trim buffer inputs (byte-exact)", () => {
      expect(generateCvHash(Buffer.from("  cv text  "))).not.toBe(
        generateCvHash(Buffer.from("cv text")),
      );
    });

    it("matches a trimmed string against the equivalent buffer bytes", () => {
      // A string is trimmed then hashed; an already-trimmed buffer hashes the
      // same bytes, so the two digests must line up.
      expect(generateCvHash("cv text")).toBe(
        generateCvHash(Buffer.from("cv text")),
      );
    });

    it("handles empty input without throwing", () => {
      expect(generateCvHash("")).toMatch(/^[a-f0-9]{64}$/);
      expect(generateCvHash(Buffer.alloc(0))).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  // findExistingCandidateByCv hashes the buffer and looks up the dedup row,
  // scoped to a single user — dedup must never cross tenants.
  describe("findExistingCandidateByCv (DB dedup, per user)", () => {
    it("returns the buffer's hash and null when no candidate exists (happy path)", async () => {
      const owner = await seedUser("owner@test.com");
      const buffer = Buffer.from("a brand new cv");

      const result = await findExistingCandidateByCv(buffer, owner.id);

      expect(result.hash).toBe(generateCvHash(buffer));
      expect(result.existingCandidate).toBeNull();
    });

    it("returns the existing candidate when this same user already has that hash", async () => {
      const { owner, department, position } = await seedGraph();
      const vacancy = await seedVacancy(owner.id, department.id, position.id);
      const buffer = Buffer.from("an already seen cv");
      const hash = generateCvHash(buffer);
      const seeded = await seedCandidate(owner.id, vacancy.id, hash);

      const result = await findExistingCandidateByCv(buffer, owner.id);

      expect(result.hash).toBe(hash);
      expect(result.existingCandidate).not.toBeNull();
      expect(result.existingCandidate!.id).toBe(seeded.id);
    });

    it("does not match a candidate seeded from a different CV", async () => {
      const { owner, department, position } = await seedGraph();
      const vacancy = await seedVacancy(owner.id, department.id, position.id);
      await seedCandidate(
        owner.id,
        vacancy.id,
        generateCvHash(Buffer.from("cv A")),
      );

      const result = await findExistingCandidateByCv(
        Buffer.from("cv B"),
        owner.id,
      );

      expect(result.existingCandidate).toBeNull();
    });

    it("does not match a candidate with the same hash owned by a different user (tenant isolation)", async () => {
      const { owner, department, position } = await seedGraph();
      const vacancy = await seedVacancy(owner.id, department.id, position.id);
      const buffer = Buffer.from("a cv shared across two companies");
      const hash = generateCvHash(buffer);
      await seedCandidate(owner.id, vacancy.id, hash);

      const otherUser = await seedUser("other-tenant@test.com");
      const result = await findExistingCandidateByCv(buffer, otherUser.id);

      expect(result.existingCandidate).toBeNull();
    });
  });

  // Error path: hash is unique per (userId, hash), so the *same* user can
  // never write two candidates sharing one — the second write is rejected
  // with Prisma's P2002.
  describe("hash uniqueness (error path, per user)", () => {
    it("rejects a second candidate that reuses an existing CV hash for the same user", async () => {
      const { owner, department, position } = await seedGraph();
      const vacancy = await seedVacancy(owner.id, department.id, position.id);
      const hash = generateCvHash(Buffer.from("a duplicated cv"));
      await seedCandidate(owner.id, vacancy.id, hash);

      await expect(
        seedCandidate(owner.id, vacancy.id, hash),
      ).rejects.toMatchObject({ code: "P2002" });
    });

    it("allows two different users to each have a candidate with the same hash", async () => {
      const { owner, department, position } = await seedGraph();
      const vacancy = await seedVacancy(owner.id, department.id, position.id);
      const hash = generateCvHash(Buffer.from("a cv shared across two companies"));
      await seedCandidate(owner.id, vacancy.id, hash);

      const other = await seedGraph("other-tenant@test.com");
      const otherVacancy = await seedVacancy(
        other.owner.id,
        other.department.id,
        other.position.id,
      );

      await expect(
        seedCandidate(other.owner.id, otherVacancy.id, hash),
      ).resolves.toMatchObject({ hash });
    });
  });
});

// Exercises the real upload pipeline (multer -> real PDF -> pdf-parse) but
// stubs the two external services (OpenAI extraction + Cloudinary upload) with
// jest.spyOn so the flow is deterministic and runs without network access.
// Spies are set per test and restored in afterEach, so the opt-in external
// tests above keep hitting the real services when RUN_EXTERNAL_TESTS=true.
describe("POST /api/vacancies/:id/upload — non-CV rejection (mocked AI + Cloudinary)", () => {
  const FAKE_CLOUDINARY_URL = "https://res.cloudinary.test/fake-cv.pdf";

  // A fully-populated profile, as OpenAI returns for a real CV.
  const validProfile: CandidateExtracted = {
    fullName: "Jane Doe",
    email: "jane.doe@example.com",
    role: "Backend Developer",
    yearsOfExperience: 5,
    technicalSkills: ["TypeScript", "Node.js"],
    optionalTechnicalSkills: ["Docker"],
    softSkills: ["Communication"],
    description: "Experienced backend engineer.",
    educationLevel: "UNIVERSITY",
    educationArea: "Computer Science",
    languages: ["English"],
  };

  // The all-blank shape OpenAI returns when the PDF is not a CV.
  const emptyProfile: CandidateExtracted = {
    fullName: "",
    email: "",
    role: "",
    yearsOfExperience: 0,
    technicalSkills: [],
    optionalTechnicalSkills: [],
    softSkills: [],
    description: "",
    educationLevel: "NONE",
    educationArea: "",
    languages: [],
  };

  // A non-CV document long enough to clear the controller's 500-char quality
  // gate, so it actually reaches OpenAI (which then returns the empty profile).
  const NON_CV_TEXT = [
    "RESTAURANT MENU — Bella Italia",
    "Appetizers: bruschetta, garlic bread, caprese salad, stuffed mushrooms.",
    "Pasta: spaghetti carbonara, penne arrabiata, fettuccine alfredo, lasagna.",
    "Pizza: margherita, pepperoni, four cheese, vegetarian, prosciutto.",
    "Main courses: grilled salmon, chicken parmesan, ribeye steak, risotto.",
    "Desserts: tiramisu, panna cotta, gelato, cannoli, affogato bianco.",
    "Drinks: espresso, cappuccino, red wine, white wine, sparkling water.",
    "Opening hours: Monday to Sunday, 12:00 to 23:00. Reservations recommended.",
    "This document is a food menu and holds no candidate resume information.",
  ].join("\n");

  let uploadSpy: jest.SpyInstance;

  beforeEach(() => {
    uploadSpy = jest
      .spyOn(cloudinaryService, "uploadPdfToCloudinary")
      .mockResolvedValue(FAKE_CLOUDINARY_URL);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("uploads a CV to Cloudinary, evaluates it via OpenAI and persists the candidate", async () => {
    const { owner, department, position } = await seedGraph();
    const vacancy = await seedVacancy(owner.id, department.id, position.id);
    const pdf = await makePdfBuffer(SAMPLE_CV_TEXT);

    jest
      .spyOn(extractCvPrompt, "extractCandidateData")
      .mockResolvedValue(validProfile);

    const res = await request(app)
      .post(`/api/vacancies/${vacancy.id}/upload`)
      .set("Authorization", tokenFor(owner))
      .attach("pdfs", pdf, "cv.pdf");

    expect(res.status).toBe(201);
    expect(res.body.data[0].success).toBe(true);
    expect(res.body.data[0].data.fullName).toBe("Jane Doe");
    expect(res.body.data[0].data.fileUrl).toBe(FAKE_CLOUDINARY_URL);
    expect(uploadSpy).toHaveBeenCalledTimes(1);

    const persisted = await prisma.candidate.findFirst({
      where: { vacancyId: vacancy.id, email: "jane.doe@example.com" },
    });
    expect(persisted).not.toBeNull();
  });

  it("rejects a non-CV PDF (OpenAI returns the empty profile) without persisting it", async () => {
    const { owner, department, position } = await seedGraph();
    const vacancy = await seedVacancy(owner.id, department.id, position.id);
    const pdf = await makePdfBuffer(NON_CV_TEXT);

    jest
      .spyOn(extractCvPrompt, "extractCandidateData")
      .mockResolvedValue(emptyProfile);

    const res = await request(app)
      .post(`/api/vacancies/${vacancy.id}/upload`)
      .set("Authorization", tokenFor(owner))
      .attach("pdfs", pdf, "menu.pdf");

    // Batch endpoint still returns 201, but this file failed.
    expect(res.status).toBe(201);
    expect(res.body.data[0].success).toBe(false);
    expect(res.body.data[0].error).toMatch(/not a valid CV/i);

    // Rejected before Cloudinary and never persisted.
    expect(uploadSpy).not.toHaveBeenCalled();
    const count = await prisma.candidate.count({
      where: { vacancyId: vacancy.id },
    });
    expect(count).toBe(0);
  });

  it("in a mixed batch, stops only the non-CV and still processes the valid CV", async () => {
    const { owner, department, position } = await seedGraph();
    const vacancy = await seedVacancy(owner.id, department.id, position.id);
    const cvPdf = await makePdfBuffer(SAMPLE_CV_TEXT);
    const notCvPdf = await makePdfBuffer(NON_CV_TEXT);

    // Branch on the extracted text: the menu becomes an empty profile, the CV
    // a populated one — mirroring what OpenAI would do per document.
    jest
      .spyOn(extractCvPrompt, "extractCandidateData")
      .mockImplementation(async (text: string) =>
        text.toUpperCase().includes("MENU") ? emptyProfile : validProfile,
      );

    const res = await request(app)
      .post(`/api/vacancies/${vacancy.id}/upload`)
      .set("Authorization", tokenFor(owner))
      .attach("pdfs", cvPdf, "cv.pdf")
      .attach("pdfs", notCvPdf, "menu.pdf");

    expect(res.status).toBe(201);
    const results = res.body.data as Array<{
      success: boolean;
      error?: string;
    }>;
    expect(results.filter((r) => r.success)).toHaveLength(1);
    const failed = results.filter((r) => !r.success);
    expect(failed).toHaveLength(1);
    expect(failed[0].error).toMatch(/not a valid CV/i);

    // Only the valid CV was uploaded and persisted.
    expect(uploadSpy).toHaveBeenCalledTimes(1);
    const count = await prisma.candidate.count({
      where: { vacancyId: vacancy.id },
    });
    expect(count).toBe(1);
  });
});

describe("POST /api/vacancies/:id/upload — duplicate CV dedup (mocked AI + Cloudinary)", () => {
  const FAKE_CLOUDINARY_URL = "https://res.cloudinary.test/fake-cv.pdf";
  const validProfile: CandidateExtracted = {
    fullName: "Jane Doe",
    email: "jane.doe@example.com",
    role: "Backend Developer",
    yearsOfExperience: 5,
    technicalSkills: ["TypeScript", "Node.js"],
    optionalTechnicalSkills: ["Docker"],
    softSkills: ["Communication"],
    description: "Experienced backend engineer.",
    educationLevel: "UNIVERSITY",
    educationArea: "Computer Science",
    languages: ["English"],
  };

  let uploadSpy: jest.SpyInstance;
  let extractSpy: jest.SpyInstance;

  beforeEach(() => {
    uploadSpy = jest
      .spyOn(cloudinaryService, "uploadPdfToCloudinary")
      .mockResolvedValue(FAKE_CLOUDINARY_URL);
    extractSpy = jest
      .spyOn(extractCvPrompt, "extractCandidateData")
      .mockResolvedValue(validProfile);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("re-uploading the same PDF to the same vacancy dedups instead of creating a second candidate", async () => {
    const { owner, department, position } = await seedGraph();
    const vacancy = await seedVacancy(owner.id, department.id, position.id);
    const pdf = await makePdfBuffer(SAMPLE_CV_TEXT);

    const first = await request(app)
      .post(`/api/vacancies/${vacancy.id}/upload`)
      .set("Authorization", tokenFor(owner))
      .attach("pdfs", pdf, "cv.pdf");

    expect(first.status).toBe(201);
    expect(first.body.data[0].success).toBe(true);
    const firstCandidateId = first.body.data[0].data.id;
    expect(uploadSpy).toHaveBeenCalledTimes(1);
    expect(extractSpy).toHaveBeenCalledTimes(1);

    const second = await request(app)
      .post(`/api/vacancies/${vacancy.id}/upload`)
      .set("Authorization", tokenFor(owner))
      .attach("pdfs", pdf, "cv.pdf");

    expect(second.status).toBe(201);
    expect(second.body.data[0].success).toBe(true);
    expect(second.body.data[0].data.id).toBe(firstCandidateId);
    // Deduped before extraction/upload: neither external service is called again.
    expect(uploadSpy).toHaveBeenCalledTimes(1);
    expect(extractSpy).toHaveBeenCalledTimes(1);

    const count = await prisma.candidate.count({
      where: { vacancyId: vacancy.id },
    });
    expect(count).toBe(1);
  });

  it("uploading the same PDF to a different vacancy dedups the Candidate but links it to both via Application", async () => {
    const { owner, department, position } = await seedGraph();
    const vacancyA = await seedVacancy(
      owner.id,
      department.id,
      position.id,
      "ACTIVE",
      "Vacancy A",
    );
    const vacancyB = await seedVacancy(
      owner.id,
      department.id,
      position.id,
      "ACTIVE",
      "Vacancy B",
    );
    const pdf = await makePdfBuffer(SAMPLE_CV_TEXT);

    const first = await request(app)
      .post(`/api/vacancies/${vacancyA.id}/upload`)
      .set("Authorization", tokenFor(owner))
      .attach("pdfs", pdf, "cv.pdf");

    expect(first.status).toBe(201);
    const firstCandidateId = first.body.data[0].data.id;
    expect(uploadSpy).toHaveBeenCalledTimes(1);
    expect(extractSpy).toHaveBeenCalledTimes(1);

    const second = await request(app)
      .post(`/api/vacancies/${vacancyB.id}/upload`)
      .set("Authorization", tokenFor(owner))
      .attach("pdfs", pdf, "cv.pdf");

    expect(second.status).toBe(201);
    expect(second.body.data[0].success).toBe(true);
    // Same Candidate row is reused (hash dedup) — no second AI/Cloudinary call,
    // no duplicate Candidate — but it's now also linked to vacancy B.
    expect(second.body.data[0].data.id).toBe(firstCandidateId);
    expect(second.body.data[0].data.vacancyId).toBe(vacancyA.id);
    expect(uploadSpy).toHaveBeenCalledTimes(1);
    expect(extractSpy).toHaveBeenCalledTimes(1);

    expect(await prisma.candidate.count()).toBe(1);
    const applicationForB = await prisma.application.findUnique({
      where: {
        candidateId_vacancyId: {
          candidateId: firstCandidateId,
          vacancyId: vacancyB.id,
        },
      },
    });
    expect(applicationForB).not.toBeNull();
  });

  it("re-uploading the same PDF to the same vacancy twice does not create a duplicate Application", async () => {
    const { owner, department, position } = await seedGraph();
    const vacancy = await seedVacancy(owner.id, department.id, position.id);
    const pdf = await makePdfBuffer(SAMPLE_CV_TEXT);

    await request(app)
      .post(`/api/vacancies/${vacancy.id}/upload`)
      .set("Authorization", tokenFor(owner))
      .attach("pdfs", pdf, "cv.pdf");
    await request(app)
      .post(`/api/vacancies/${vacancy.id}/upload`)
      .set("Authorization", tokenFor(owner))
      .attach("pdfs", pdf, "cv.pdf");

    const applications = await prisma.application.count({
      where: { vacancyId: vacancy.id },
    });
    expect(applications).toBe(1);
  });

  it("a candidate reused across vacancies becomes evaluable in the second vacancy too", async () => {
    const { owner, department, position } = await seedGraph();
    const vacancyA = await seedVacancy(
      owner.id,
      department.id,
      position.id,
      "ACTIVE",
      "Vacancy A",
    );
    const vacancyB = await seedVacancy(
      owner.id,
      department.id,
      position.id,
      "ACTIVE",
      "Vacancy B",
    );
    const pdf = await makePdfBuffer(SAMPLE_CV_TEXT);

    await request(app)
      .post(`/api/vacancies/${vacancyA.id}/upload`)
      .set("Authorization", tokenFor(owner))
      .attach("pdfs", pdf, "cv.pdf");
    await request(app)
      .post(`/api/vacancies/${vacancyB.id}/upload`)
      .set("Authorization", tokenFor(owner))
      .attach("pdfs", pdf, "cv.pdf");

    jest.spyOn(matchEnginePrompt, "matchEngine").mockResolvedValue({
      ...validProfile,
      aiAnalysis: { redFlags: null, rawTextSummary: "Looks solid." },
    } as never);

    const res = await request(app)
      .post(`/api/vacancies/${vacancyB.id}/evaluations`)
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const persisted = await prisma.matchResult.count({
      where: { vacancyId: vacancyB.id },
    });
    expect(persisted).toBe(1);
  });
});
