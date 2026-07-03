import request from "supertest";
import app from "../../app.js";
import prisma from "../../lib/prisma.js";
import { authHeaderFor, TestUserRole } from "../utils/jwt.util.js";
import { makePdfBuffer, SAMPLE_CV_TEXT } from "../utils/pdf.util.js";

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
