import request from "supertest";
import app from "../../app.js";
import prisma from "../../lib/prisma.js";
import { authHeaderFor, TestUserRole } from "../utils/jwt.util.js";

const seedUser = (email: string, role: TestUserRole = "USER") =>
  prisma.user.create({ data: { email, password: "hashed", role } });

const tokenFor = (user: { id: number; role: TestUserRole }) =>
  authHeaderFor({ userId: user.id, role: user.role });

const seedDepartment = (userId: number, title: string) =>
  prisma.department.create({ data: { title, userId } });

const seedPosition = (userId: number, departmentId: number, role: string) =>
  prisma.position.create({
    data: {
      role,
      yearsOfExperience: 2,
      description: "Seeded position for dashboard tests.",
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
      description: "Seeded candidate for dashboard counts.",
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

describe("GET /api/dashboard", () => {
  it("returns 401 Unauthorized when no token is provided", async () => {
    const res = await request(app).get("/api/dashboard");
    expect(res.status).toBe(401);
  });

  it("returns 200 with accurate per-user aggregate metrics (happy path)", async () => {
    const owner = await seedUser("owner@test.com");
    const department = await seedDepartment(owner.id, "Engineering");
    const position = await seedPosition(owner.id, department.id, "Backend Dev");

    const activeOne = await seedVacancy(
      owner.id,
      department.id,
      position.id,
      "ACTIVE",
      "Active I",
    );
    await seedVacancy(
      owner.id,
      department.id,
      position.id,
      "ACTIVE",
      "Active II",
    );
    await seedVacancy(
      owner.id,
      department.id,
      position.id,
      "CLOSED",
      "Closed I",
    );
    // PAUSED must not be counted as open.
    await seedVacancy(
      owner.id,
      department.id,
      position.id,
      "PAUSED",
      "Paused I",
    );

    await seedCandidate(owner.id, activeOne.id, "hash-1");
    await seedCandidate(owner.id, activeOne.id, "hash-2");

    const res = await request(app)
      .get("/api/dashboard")
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(200);
    const data = res.body.response.data;

    expect(data.total).toEqual({
      positionsCount: 1,
      departmentsCount: 1,
      candidatesCount: 2,
      openVacanciesCount: 2, // only ACTIVE
    });

    const activeBreakdown = data.vacancyStatusBreakdown.find(
      (b: { status: string }) => b.status === "ACTIVE",
    );
    expect(activeBreakdown.count).toBe(2);

    const closedBreakdown = data.vacancyStatusBreakdown.find(
      (b: { status: string }) => b.status === "CLOSED",
    );
    expect(closedBreakdown.count).toBe(1);

    expect(Array.isArray(data.monthlyActivity)).toBe(true);
  });

  it("scopes every metric to the requesting user only", async () => {
    const owner = await seedUser("owner@test.com");
    const ownerDept = await seedDepartment(owner.id, "Engineering");
    const ownerPosition = await seedPosition(
      owner.id,
      ownerDept.id,
      "Backend Dev",
    );
    await seedVacancy(
      owner.id,
      ownerDept.id,
      ownerPosition.id,
      "ACTIVE",
      "Mine",
    );

    // Another user's data must never bleed into the owner's totals.
    const other = await seedUser("other@test.com");
    const otherDept = await seedDepartment(other.id, "Marketing");
    const otherPosition = await seedPosition(other.id, otherDept.id, "Designer");
    await seedVacancy(
      other.id,
      otherDept.id,
      otherPosition.id,
      "ACTIVE",
      "Not Mine",
    );

    const res = await request(app)
      .get("/api/dashboard")
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(200);
    const data = res.body.response.data;
    expect(data.total.positionsCount).toBe(1);
    expect(data.total.departmentsCount).toBe(1);
    expect(data.total.openVacanciesCount).toBe(1);
  });
});
