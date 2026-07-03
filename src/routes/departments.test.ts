import request from "supertest";
import app from "../app.js";
import prisma from "../lib/prisma.js";
import { authHeaderFor, TestUserRole } from "../test-utils/jwt.util.js";

const seedUser = (email: string, role: TestUserRole = "USER") =>
  prisma.user.create({ data: { email, password: "hashed", role } });

// The department controller writes/filters by req.user!.id, which Prisma
// enforces as a real FK against User — so tokens here always carry the id
// of an actually-seeded user, unlike admin.test.ts's hardcoded userId: 1.
const tokenFor = (user: { id: number; role: TestUserRole }) =>
  authHeaderFor({ userId: user.id, role: user.role });

const seedDepartment = (userId: number, title: string) =>
  prisma.department.create({ data: { title, userId } });

const seedPosition = (userId: number, departmentId: number, role: string) =>
  prisma.position.create({
    data: {
      role,
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

describe("POST /api/departments", () => {
  it("returns 201 Created and persists the department (happy path)", async () => {
    const owner = await seedUser("owner@test.com");

    const res = await request(app)
      .post("/api/departments")
      .set("Authorization", tokenFor(owner))
      .send({ title: "Engineering" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      title: "Engineering",
      userId: owner.id,
    });

    const persisted = await prisma.department.findUnique({
      where: { id: res.body.data.id },
    });
    expect(persisted).not.toBeNull();
    expect(persisted?.title).toBe("Engineering");
  });

  it("returns 400 Bad Request when the payload fails Zod validation", async () => {
    const owner = await seedUser("owner@test.com");

    const res = await request(app)
      .post("/api/departments")
      .set("Authorization", tokenFor(owner))
      .send({ title: "AB" }); // below the 3-character minimum

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe("Validation error");
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "body.title" })]),
    );

    const count = await prisma.department.count();
    expect(count).toBe(0);
  });

  it("returns 401 Unauthorized when no token is provided", async () => {
    const res = await request(app)
      .post("/api/departments")
      .send({ title: "Engineering" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);

    const count = await prisma.department.count();
    expect(count).toBe(0);
  });

  it("returns 409 Conflict when the title already exists for that user", async () => {
    const owner = await seedUser("owner@test.com");
    await seedDepartment(owner.id, "Engineering");

    const res = await request(app)
      .post("/api/departments")
      .set("Authorization", tokenFor(owner))
      .send({ title: "Engineering" });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);

    const count = await prisma.department.count({
      where: { userId: owner.id, title: "Engineering" },
    });
    expect(count).toBe(1);
  });
});

describe("GET /api/departments", () => {
  it("returns 401 Unauthorized when no token is provided", async () => {
    const res = await request(app).get("/api/departments");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("returns 200 OK with only the requesting user's departments", async () => {
    const owner = await seedUser("owner@test.com");
    const otherUser = await seedUser("other@test.com");

    await seedDepartment(owner.id, "Engineering");
    await seedDepartment(owner.id, "Marketing");
    await seedDepartment(otherUser.id, "Not Mine");

    const res = await request(app)
      .get("/api/departments")
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(200);

    const departments = res.body.response.data;
    expect(departments).toHaveLength(2);
    expect(departments.map((d: { title: string }) => d.title).sort()).toEqual([
      "Engineering",
      "Marketing",
    ]);
  });
});

describe("GET /api/departments/:id", () => {
  it("returns 401 Unauthorized when no token is provided", async () => {
    const owner = await seedUser("owner@test.com");
    const department = await seedDepartment(owner.id, "Engineering");

    const res = await request(app).get(`/api/departments/${department.id}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("returns 200 OK with the requested department (happy path)", async () => {
    const owner = await seedUser("owner@test.com");
    const department = await seedDepartment(owner.id, "Engineering");

    const res = await request(app)
      .get(`/api/departments/${department.id}`)
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(200);
    expect(res.body.response.data).toMatchObject({
      id: department.id,
      title: "Engineering",
    });
  });

  it("returns 404 Not Found when the :id does not exist", async () => {
    const owner = await seedUser("owner@test.com");

    const res = await request(app)
      .get("/api/departments/999999")
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(404);
  });

  it("returns 404 Not Found when the department belongs to another user", async () => {
    const owner = await seedUser("owner@test.com");
    const otherUser = await seedUser("other@test.com");
    const department = await seedDepartment(otherUser.id, "Not Mine");

    const res = await request(app)
      .get(`/api/departments/${department.id}`)
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(404);
  });
});

describe("PUT /api/departments/:id", () => {
  it("returns 401 Unauthorized when no token is provided", async () => {
    const owner = await seedUser("owner@test.com");
    const department = await seedDepartment(owner.id, "Engineering");

    const res = await request(app)
      .put(`/api/departments/${department.id}`)
      .send({ title: "Tech" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("returns 200 OK and correctly updates the record (happy path)", async () => {
    const owner = await seedUser("owner@test.com");
    const department = await seedDepartment(owner.id, "Engineering");

    const res = await request(app)
      .put(`/api/departments/${department.id}`)
      .set("Authorization", tokenFor(owner))
      .send({ title: "Technology" });

    expect(res.status).toBe(200);
    expect(res.body.response.data).toMatchObject({
      id: department.id,
      title: "Technology",
    });

    const persisted = await prisma.department.findUniqueOrThrow({
      where: { id: department.id },
    });
    expect(persisted.title).toBe("Technology");
  });

  it("returns 400 Bad Request when the payload fails Zod validation", async () => {
    const owner = await seedUser("owner@test.com");
    const department = await seedDepartment(owner.id, "Engineering");

    const res = await request(app)
      .put(`/api/departments/${department.id}`)
      .set("Authorization", tokenFor(owner))
      .send({ title: "AB" }); // below the 3-character minimum

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");

    const unchanged = await prisma.department.findUniqueOrThrow({
      where: { id: department.id },
    });
    expect(unchanged.title).toBe("Engineering");
  });

  it("returns 404 Not Found when the department ID does not exist", async () => {
    const owner = await seedUser("owner@test.com");

    const res = await request(app)
      .put("/api/departments/999999")
      .set("Authorization", tokenFor(owner))
      .send({ title: "Technology" });

    expect(res.status).toBe(404);
  });

  it("returns 404 Not Found when the department belongs to another user", async () => {
    const owner = await seedUser("owner@test.com");
    const otherUser = await seedUser("other@test.com");
    const department = await seedDepartment(otherUser.id, "Not Mine");

    const res = await request(app)
      .put(`/api/departments/${department.id}`)
      .set("Authorization", tokenFor(owner))
      .send({ title: "Hijacked" });

    expect(res.status).toBe(404);

    const unchanged = await prisma.department.findUniqueOrThrow({
      where: { id: department.id },
    });
    expect(unchanged.title).toBe("Not Mine");
  });
});

describe("DELETE /api/departments/:id", () => {
  it("returns 401 Unauthorized when no token is provided", async () => {
    const owner = await seedUser("owner@test.com");
    const department = await seedDepartment(owner.id, "Engineering");

    const res = await request(app).delete(`/api/departments/${department.id}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("returns 200 OK and removes the record when it has no linked positions (happy path)", async () => {
    const owner = await seedUser("owner@test.com");
    const department = await seedDepartment(owner.id, "Engineering");

    const res = await request(app)
      .delete(`/api/departments/${department.id}`)
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(200);

    const deleted = await prisma.department.findUnique({
      where: { id: department.id },
    });
    expect(deleted).toBeNull();
  });

  it("returns 404 Not Found when the department ID does not exist", async () => {
    const owner = await seedUser("owner@test.com");

    const res = await request(app)
      .delete("/api/departments/999999")
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(404);
  });

  it("returns 404 Not Found when the department belongs to another user", async () => {
    const owner = await seedUser("owner@test.com");
    const otherUser = await seedUser("other@test.com");
    const department = await seedDepartment(otherUser.id, "Not Mine");

    const res = await request(app)
      .delete(`/api/departments/${department.id}`)
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(404);

    const stillExists = await prisma.department.findUnique({
      where: { id: department.id },
    });
    expect(stillExists).not.toBeNull();
  });

  // NOTE: Position.department currently has `onDelete: Cascade` in schema.prisma
  // (a schema/migration change, out of scope here). So deleting a Department that
  // still has Positions does NOT fail with P2003 today — it cascades and removes
  // both. This test documents that real, current behavior rather than the P2003
  // rejection the original ticket describes, since the schema wasn't changed.
  it("cascades and removes linked positions instead of blocking deletion (current schema behavior)", async () => {
    const owner = await seedUser("owner@test.com");
    const department = await seedDepartment(owner.id, "Engineering");
    const position = await seedPosition(owner.id, department.id, "Backend Developer");

    const res = await request(app)
      .delete(`/api/departments/${department.id}`)
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(200);

    const departmentAfter = await prisma.department.findUnique({
      where: { id: department.id },
    });
    const positionAfter = await prisma.position.findUnique({
      where: { id: position.id },
    });
    expect(departmentAfter).toBeNull();
    expect(positionAfter).toBeNull();
  });
});
