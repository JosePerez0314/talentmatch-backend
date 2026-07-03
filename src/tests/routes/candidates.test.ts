import request from "supertest";
import app from "../../app.js";
import prisma from "../../lib/prisma.js";
import { authHeaderFor, TestUserRole } from "../utils/jwt.util.js";

// Candidates are read-only over the API (they are created by the CV upload
// pipeline), so tests seed the full owner -> department -> position -> vacancy
// -> candidate graph directly with Prisma.
const seedUser = (email: string, role: TestUserRole = "USER") =>
  prisma.user.create({ data: { email, password: "hashed", role } });

const tokenFor = (user: { id: number; role: TestUserRole }) =>
  authHeaderFor({ userId: user.id, role: user.role });

const seedCandidateGraph = async (email: string, fullName: string) => {
  const user = await seedUser(email);
  const department = await prisma.department.create({
    data: { title: "Engineering", userId: user.id },
  });
  const position = await prisma.position.create({
    data: {
      role: "Backend Developer",
      yearsOfExperience: 2,
      description: "Seeded position for candidate tests.",
      technicalSkills: ["JavaScript"],
      optionalTechnicalSkills: [],
      softSkills: ["Communication"],
      languages: ["English"],
      educationLevel: "UNIVERSITY",
      educationArea: "Computer Science",
      departmentId: department.id,
      userId: user.id,
    },
  });
  const vacancy = await prisma.vacancy.create({
    data: {
      title: "Backend Vacancy",
      availableSlots: 1,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      status: "ACTIVE",
      positionId: position.id,
      departmentId: department.id,
      userId: user.id,
    },
  });
  const candidate = await prisma.candidate.create({
    data: {
      fullName,
      email: `${fullName.replace(/\s+/g, ".").toLowerCase()}@test.com`,
      description: "Seeded candidate for the read endpoints.",
      educationLevel: "UNIVERSITY",
      educationArea: "Computer Science",
      languages: ["English"],
      optionalTechnicalSkills: [],
      softSkills: ["Communication"],
      technicalSkills: ["JavaScript"],
      role: "Backend Developer",
      yearsOfExperience: 3,
      hash: `hash-${fullName.replace(/\s+/g, "-").toLowerCase()}`,
      rawApiPayload: {},
      userId: user.id,
      vacancyId: vacancy.id,
    },
  });

  return { user, candidate };
};

describe("GET /api/candidates", () => {
  it("returns 401 Unauthorized when no token is provided", async () => {
    const res = await request(app).get("/api/candidates");
    expect(res.status).toBe(401);
  });

  it("returns 200 with only the requesting user's candidates", async () => {
    const { user: owner } = await seedCandidateGraph(
      "owner@test.com",
      "Alice Owner",
    );
    await seedCandidateGraph("other@test.com", "Bob Other");

    const res = await request(app)
      .get("/api/candidates")
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(200);
    const candidates = res.body.response.data;
    expect(candidates).toHaveLength(1);
    expect(candidates[0].fullName).toBe("Alice Owner");
  });
});

describe("GET /api/candidates/:id", () => {
  it("returns 200 with the requested candidate (happy path)", async () => {
    const { user: owner, candidate } = await seedCandidateGraph(
      "owner@test.com",
      "Alice Owner",
    );

    const res = await request(app)
      .get(`/api/candidates/${candidate.id}`)
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(200);
    expect(res.body.response.data).toMatchObject({
      id: candidate.id,
      fullName: "Alice Owner",
    });
  });

  it("returns 400 when the id param is not a valid number", async () => {
    const { user: owner } = await seedCandidateGraph(
      "owner@test.com",
      "Alice Owner",
    );

    const res = await request(app)
      .get("/api/candidates/not-a-number")
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "params.id" })]),
    );
  });

  it("returns 404 when the candidate does not exist", async () => {
    const owner = await seedUser("owner@test.com");

    const res = await request(app)
      .get("/api/candidates/999999")
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(404);
  });

  it("returns 404 when the candidate belongs to another user", async () => {
    const owner = await seedUser("owner@test.com");
    const { candidate: foreignCandidate } = await seedCandidateGraph(
      "other@test.com",
      "Bob Other",
    );

    const res = await request(app)
      .get(`/api/candidates/${foreignCandidate.id}`)
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(404);
  });

  it("returns 401 when no token is provided", async () => {
    const { candidate } = await seedCandidateGraph(
      "owner@test.com",
      "Alice Owner",
    );

    const res = await request(app).get(`/api/candidates/${candidate.id}`);
    expect(res.status).toBe(401);
  });
});
