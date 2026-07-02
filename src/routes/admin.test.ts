import request from "supertest";
import app from "../app.js";
import prisma from "../lib/prisma.js";
import { authHeaderFor } from "../test-utils/jwt.util.js";

const adminToken = () => authHeaderFor({ userId: 1, role: "ADMIN" });
const userToken = () => authHeaderFor({ userId: 1, role: "USER" });

const seedUser = (email: string) =>
  prisma.user.create({
    data: { email, password: "hashed", role: "USER" },
  });

const seedDepartment = (userId: number, title: string) =>
  prisma.department.create({ data: { title, userId } });

const seedPosition = (userId: number, departmentId: number) =>
  prisma.position.create({
    data: {
      role: "Backend Developer",
      yearsOfExperience: 2,
      description: "Test position",
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
  status: "ACTIVE" | "PAUSED" | "CLOSED",
  title: string,
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
      description: "Test candidate",
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

describe("GET /api/admin/stats", () => {
  it("returns 401 Unauthorized when no token is provided", async () => {
    const res = await request(app).get("/api/admin/stats");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("returns 403 Forbidden when a standard USER token attempts access", async () => {
    const res = await request(app)
      .get("/api/admin/stats")
      .set("Authorization", userToken());

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("returns 200 OK with accurate database aggregate metrics (happy path)", async () => {
    const owner = await seedUser("owner@test.com");
    await seedUser("second-user@test.com");

    const department = await seedDepartment(owner.id, "Engineering");
    const position = await seedPosition(owner.id, department.id);

    const activeVacancyOne = await seedVacancy(
      owner.id,
      department.id,
      position.id,
      "ACTIVE",
      "Backend Dev I",
    );
    const activeVacancyTwo = await seedVacancy(
      owner.id,
      department.id,
      position.id,
      "ACTIVE",
      "Backend Dev II",
    );
    const closedVacancy = await seedVacancy(
      owner.id,
      department.id,
      position.id,
      "CLOSED",
      "Backend Dev III",
    );
    // PAUSED on purpose — must not be counted as active nor closed.
    await seedVacancy(
      owner.id,
      department.id,
      position.id,
      "PAUSED",
      "Backend Dev IV",
    );

    await seedCandidate(owner.id, activeVacancyOne.id, "hash-1");
    await seedCandidate(owner.id, activeVacancyTwo.id, "hash-2");
    await seedCandidate(owner.id, closedVacancy.id, "hash-3");

    const res = await request(app)
      .get("/api/admin/stats")
      .set("Authorization", adminToken());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: {
        usersCount: 2,
        candidatesCount: 3,
        positionsCount: 1,
        vacanciesCount: 4,
        activeVacancies: 2,
        closedVacancies: 1,
      },
    });
  });
});

describe("PUT /api/admin/users/:id/role", () => {
  it("returns 400 Bad Request when an invalid role enum is provided", async () => {
    const target = await seedUser("target@test.com");

    const res = await request(app)
      .put(`/api/admin/users/${target.id}/role`)
      .set("Authorization", adminToken())
      .send({ role: "SUPERADMIN" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe("Validation error");
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "body.role" })]),
    );

    // The row must be untouched — proves Zod rejected the request before
    // the controller ever called prisma.user.update.
    const unchanged = await prisma.user.findUniqueOrThrow({
      where: { id: target.id },
    });
    expect(unchanged.role).toBe("USER");
  });
});

describe("DELETE /api/admin/users/:id", () => {
  it("returns 401 Unauthorized when no token is provided", async () => {
    const target = await seedUser("target@test.com");

    const res = await request(app).delete(`/api/admin/users/${target.id}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("returns 403 Forbidden when a standard USER token attempts access", async () => {
    const target = await seedUser("target@test.com");

    const res = await request(app)
      .delete(`/api/admin/users/${target.id}`)
      .set("Authorization", userToken());

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);

    // Neither auth failure should touch the row.
    const unchanged = await prisma.user.findUniqueOrThrow({
      where: { id: target.id },
    });
    expect(unchanged).not.toBeNull();
  });

  it("returns 400 Bad Request when the id param is not a valid number", async () => {
    const res = await request(app)
      .delete("/api/admin/users/not-a-number")
      .set("Authorization", adminToken());

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe("Validation error");
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "params.id" })]),
    );
  });

  it("returns 200 OK and removes the user (happy path)", async () => {
    const target = await seedUser("target@test.com");

    const res = await request(app)
      .delete(`/api/admin/users/${target.id}`)
      .set("Authorization", adminToken());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { deleteId: target.id },
    });

    const deleted = await prisma.user.findUnique({ where: { id: target.id } });
    expect(deleted).toBeNull();
  });
});
