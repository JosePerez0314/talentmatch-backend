import request from "supertest";
import app from "../../app.js";
import prisma from "../../lib/prisma.js";
import {
  authHeaderFor,
  expiredTestToken,
  tokenWithWrongSecret,
  TestUserRole,
} from "../utils/jwt.util.js";
import { makePdfBuffer, SAMPLE_POSITION_TEXT } from "../utils/pdf.util.js";

// Position writes/filters by req.user!.id (a real FK against User), so every
// token here carries the id of an actually-seeded user.
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
      description: "Existing seeded position used across the read/update tests.",
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

const validPositionBody = (departmentId: number) => ({
  role: "Backend Developer",
  yearsOfExperience: 3,
  technicalSkills: ["JavaScript", "TypeScript"],
  optionalTechnicalSkills: ["Docker"],
  softSkills: ["Communication"],
  languages: ["English"],
  description: "We are hiring a backend developer for our HR platform team.",
  educationLevel: "UNIVERSITY",
  educationArea: "Computer Science",
  departmentId,
});

// Opt-in only: the /complete happy path calls pdf-parse -> OpenAI -> Cloudinary.
// scripts/test.ts sets RUN_EXTERNAL_TESTS after asking on the terminal.
const RUN_EXTERNAL = process.env.RUN_EXTERNAL_TESTS === "true";
const describeExternal = RUN_EXTERNAL ? describe : describe.skip;
// Real OpenAI + Cloudinary round-trips blow past Jest's 5s default, so the
// opt-in external tests get a generous per-test timeout.
const EXTERNAL_TIMEOUT_MS = 120_000;

describe("POST /api/positions", () => {
  it("returns 201 Created and persists the position (happy path)", async () => {
    const owner = await seedUser("owner@test.com");
    const department = await seedDepartment(owner.id, "Engineering");

    const res = await request(app)
      .post("/api/positions")
      .set("Authorization", tokenFor(owner))
      .send(validPositionBody(department.id));

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      role: "Backend Developer",
      userId: owner.id,
      departmentId: department.id,
    });

    const persisted = await prisma.position.findUnique({
      where: { id: res.body.data.id },
    });
    expect(persisted).not.toBeNull();
  });

  it("returns 401 Unauthorized when no token is provided", async () => {
    const res = await request(app)
      .post("/api/positions")
      .send(validPositionBody(1));

    expect(res.status).toBe(401);
    expect(await prisma.position.count()).toBe(0);
  });

  it("returns 404 Not Found when the department belongs to another user", async () => {
    const owner = await seedUser("owner@test.com");
    const otherUser = await seedUser("other@test.com");
    const foreignDept = await seedDepartment(otherUser.id, "Not Mine");

    const res = await request(app)
      .post("/api/positions")
      .set("Authorization", tokenFor(owner))
      .send(validPositionBody(foreignDept.id));

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(await prisma.position.count()).toBe(0);
  });

  it("returns 404 Not Found when the department does not exist", async () => {
    const owner = await seedUser("owner@test.com");

    const res = await request(app)
      .post("/api/positions")
      .set("Authorization", tokenFor(owner))
      .send(validPositionBody(999999));

    expect(res.status).toBe(404);
  });

  it("returns 400 when role is shorter than 5 characters", async () => {
    const owner = await seedUser("owner@test.com");
    const department = await seedDepartment(owner.id, "Engineering");

    const res = await request(app)
      .post("/api/positions")
      .set("Authorization", tokenFor(owner))
      .send({ ...validPositionBody(department.id), role: "Dev" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "body.role" })]),
    );
  });

  it("returns 400 when description is shorter than 25 characters", async () => {
    const owner = await seedUser("owner@test.com");
    const department = await seedDepartment(owner.id, "Engineering");

    const res = await request(app)
      .post("/api/positions")
      .set("Authorization", tokenFor(owner))
      .send({ ...validPositionBody(department.id), description: "Too short" });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "body.description" }),
      ]),
    );
  });

  it("returns 400 when technicalSkills is empty", async () => {
    const owner = await seedUser("owner@test.com");
    const department = await seedDepartment(owner.id, "Engineering");

    const res = await request(app)
      .post("/api/positions")
      .set("Authorization", tokenFor(owner))
      .send({ ...validPositionBody(department.id), technicalSkills: [] });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "body.technicalSkills" }),
      ]),
    );
  });

  it("returns 400 when educationArea is missing for a level that requires it", async () => {
    const owner = await seedUser("owner@test.com");
    const department = await seedDepartment(owner.id, "Engineering");
    const { educationArea: _omitted, ...body } = validPositionBody(
      department.id,
    );

    const res = await request(app)
      .post("/api/positions")
      .set("Authorization", tokenFor(owner))
      .send({ ...body, educationLevel: "UNIVERSITY" });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "body.educationArea" }),
      ]),
    );
  });
});

describe("GET /api/positions", () => {
  it("returns 401 Unauthorized when no token is provided", async () => {
    const res = await request(app).get("/api/positions");
    expect(res.status).toBe(401);
  });

  it("returns 200 with only the requesting user's positions", async () => {
    const owner = await seedUser("owner@test.com");
    const otherUser = await seedUser("other@test.com");
    const dept = await seedDepartment(owner.id, "Engineering");
    const foreignDept = await seedDepartment(otherUser.id, "Other");

    await seedPosition(owner.id, dept.id, "Backend Developer");
    await seedPosition(owner.id, dept.id, "Frontend Developer");
    await seedPosition(otherUser.id, foreignDept.id, "Not Mine");

    const res = await request(app)
      .get("/api/positions")
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(200);
    const positions = res.body.response.data;
    expect(positions).toHaveLength(2);
    expect(positions.map((p: { role: string }) => p.role).sort()).toEqual([
      "Backend Developer",
      "Frontend Developer",
    ]);
  });

  it("returns 401 for an expired token", async () => {
    const owner = await seedUser("owner@test.com");
    const res = await request(app)
      .get("/api/positions")
      .set(
        "Authorization",
        `Bearer ${expiredTestToken({ userId: owner.id, role: "USER" })}`,
      );
    expect(res.status).toBe(401);
  });

  it("returns 401 for a token signed with the wrong secret", async () => {
    const owner = await seedUser("owner@test.com");
    const res = await request(app)
      .get("/api/positions")
      .set(
        "Authorization",
        `Bearer ${tokenWithWrongSecret({ userId: owner.id, role: "USER" })}`,
      );
    expect(res.status).toBe(401);
  });
});

describe("GET /api/positions/:id", () => {
  it("returns 401 Unauthorized when no token is provided", async () => {
    const owner = await seedUser("owner@test.com");
    const dept = await seedDepartment(owner.id, "Engineering");
    const position = await seedPosition(owner.id, dept.id, "Backend Developer");

    const res = await request(app).get(`/api/positions/${position.id}`);
    expect(res.status).toBe(401);
  });

  it("returns 200 with the requested position (happy path)", async () => {
    const owner = await seedUser("owner@test.com");
    const dept = await seedDepartment(owner.id, "Engineering");
    const position = await seedPosition(owner.id, dept.id, "Backend Developer");

    const res = await request(app)
      .get(`/api/positions/${position.id}`)
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(200);
    expect(res.body.response.data).toMatchObject({
      id: position.id,
      role: "Backend Developer",
    });
  });

  it("returns 400 when the id param is not a valid number", async () => {
    const owner = await seedUser("owner@test.com");

    const res = await request(app)
      .get("/api/positions/not-a-number")
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "params.id" })]),
    );
  });

  it("returns 404 when the id does not exist", async () => {
    const owner = await seedUser("owner@test.com");

    const res = await request(app)
      .get("/api/positions/999999")
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(404);
  });

  it("returns 404 when the position belongs to another user", async () => {
    const owner = await seedUser("owner@test.com");
    const otherUser = await seedUser("other@test.com");
    const foreignDept = await seedDepartment(otherUser.id, "Other");
    const position = await seedPosition(
      otherUser.id,
      foreignDept.id,
      "Not Mine",
    );

    const res = await request(app)
      .get(`/api/positions/${position.id}`)
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(404);
  });
});

describe("PUT /api/positions/:id", () => {
  it("returns 401 Unauthorized when no token is provided", async () => {
    const owner = await seedUser("owner@test.com");
    const dept = await seedDepartment(owner.id, "Engineering");
    const position = await seedPosition(owner.id, dept.id, "Backend Developer");

    const res = await request(app)
      .put(`/api/positions/${position.id}`)
      .send({ role: "Lead Backend Developer" });

    expect(res.status).toBe(401);
  });

  it("returns 200 and updates the record (happy path)", async () => {
    const owner = await seedUser("owner@test.com");
    const dept = await seedDepartment(owner.id, "Engineering");
    const position = await seedPosition(owner.id, dept.id, "Backend Developer");

    const res = await request(app)
      .put(`/api/positions/${position.id}`)
      .set("Authorization", tokenFor(owner))
      .send({ role: "Lead Backend Developer", yearsOfExperience: 5 });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: position.id,
      role: "Lead Backend Developer",
      yearsOfExperience: 5,
    });

    const persisted = await prisma.position.findUniqueOrThrow({
      where: { id: position.id },
    });
    expect(persisted.role).toBe("Lead Backend Developer");
  });

  it("returns 400 when a provided field fails validation", async () => {
    const owner = await seedUser("owner@test.com");
    const dept = await seedDepartment(owner.id, "Engineering");
    const position = await seedPosition(owner.id, dept.id, "Backend Developer");

    const res = await request(app)
      .put(`/api/positions/${position.id}`)
      .set("Authorization", tokenFor(owner))
      .send({ yearsOfExperience: -3 });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "body.yearsOfExperience" }),
      ]),
    );
  });

  it("returns 404 when the position does not exist", async () => {
    const owner = await seedUser("owner@test.com");

    const res = await request(app)
      .put("/api/positions/999999")
      .set("Authorization", tokenFor(owner))
      .send({ role: "Lead Backend Developer" });

    expect(res.status).toBe(404);
  });

  it("returns 404 when the position belongs to another user", async () => {
    const owner = await seedUser("owner@test.com");
    const otherUser = await seedUser("other@test.com");
    const foreignDept = await seedDepartment(otherUser.id, "Other");
    const position = await seedPosition(
      otherUser.id,
      foreignDept.id,
      "Not Mine",
    );

    const res = await request(app)
      .put(`/api/positions/${position.id}`)
      .set("Authorization", tokenFor(owner))
      .send({ role: "Hijacked" });

    expect(res.status).toBe(404);
    const unchanged = await prisma.position.findUniqueOrThrow({
      where: { id: position.id },
    });
    expect(unchanged.role).toBe("Not Mine");
  });
});

describe("DELETE /api/positions/:id", () => {
  it("returns 401 Unauthorized when no token is provided", async () => {
    const owner = await seedUser("owner@test.com");
    const dept = await seedDepartment(owner.id, "Engineering");
    const position = await seedPosition(owner.id, dept.id, "Backend Developer");

    const res = await request(app).delete(`/api/positions/${position.id}`);
    expect(res.status).toBe(401);
  });

  it("returns 200 and removes the record (happy path)", async () => {
    const owner = await seedUser("owner@test.com");
    const dept = await seedDepartment(owner.id, "Engineering");
    const position = await seedPosition(owner.id, dept.id, "Backend Developer");

    const res = await request(app)
      .delete(`/api/positions/${position.id}`)
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const deleted = await prisma.position.findUnique({
      where: { id: position.id },
    });
    expect(deleted).toBeNull();
  });

  it("returns 404 when the position does not exist", async () => {
    const owner = await seedUser("owner@test.com");

    const res = await request(app)
      .delete("/api/positions/999999")
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(404);
  });

  it("returns 404 when the position belongs to another user", async () => {
    const owner = await seedUser("owner@test.com");
    const otherUser = await seedUser("other@test.com");
    const foreignDept = await seedDepartment(otherUser.id, "Other");
    const position = await seedPosition(
      otherUser.id,
      foreignDept.id,
      "Not Mine",
    );

    const res = await request(app)
      .delete(`/api/positions/${position.id}`)
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(404);
    const stillExists = await prisma.position.findUnique({
      where: { id: position.id },
    });
    expect(stillExists).not.toBeNull();
  });
});

describe("POST /api/positions/duplicate/:id", () => {
  it("returns 401 Unauthorized when no token is provided", async () => {
    const res = await request(app).post("/api/positions/duplicate/1");
    expect(res.status).toBe(401);
  });

  it("returns 201 and creates a copy with a '(Copy)' suffix (happy path)", async () => {
    const owner = await seedUser("owner@test.com");
    const dept = await seedDepartment(owner.id, "Engineering");
    const position = await seedPosition(owner.id, dept.id, "Backend Developer");

    const res = await request(app)
      .post(`/api/positions/duplicate/${position.id}`)
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role).toBe("Backend Developer (Copy)");
    expect(res.body.data.id).not.toBe(position.id);
    expect(await prisma.position.count({ where: { userId: owner.id } })).toBe(2);
  });

  it("returns 404 when the source position does not exist", async () => {
    const owner = await seedUser("owner@test.com");

    const res = await request(app)
      .post("/api/positions/duplicate/999999")
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(404);
  });

  it("returns 404 when the source position belongs to another user", async () => {
    const owner = await seedUser("owner@test.com");
    const otherUser = await seedUser("other@test.com");
    const foreignDept = await seedDepartment(otherUser.id, "Other");
    const position = await seedPosition(
      otherUser.id,
      foreignDept.id,
      "Not Mine",
    );

    const res = await request(app)
      .post(`/api/positions/duplicate/${position.id}`)
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(404);
  });
});

describe("POST /api/positions/complete", () => {
  it("returns 401 Unauthorized when no token is provided", async () => {
    const res = await request(app).post("/api/positions/complete");
    expect(res.status).toBe(401);
  });

  it("returns 400 when no PDF file is uploaded", async () => {
    const owner = await seedUser("owner@test.com");

    const res = await request(app)
      .post("/api/positions/complete")
      .set("Authorization", tokenFor(owner));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("No PDF file uploaded");
  });

  describeExternal("external: OpenAI autocomplete + Cloudinary upload", () => {
    it("returns 200 with auto-completed position data and a Cloudinary URL", async () => {
      const owner = await seedUser("owner@test.com");
      const pdf = await makePdfBuffer(SAMPLE_POSITION_TEXT);

      const res = await request(app)
        .post("/api/positions/complete")
        .set("Authorization", tokenFor(owner))
        .attach("pdf", pdf, "position.pdf");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(typeof res.body.cloudinaryPositionUrl).toBe("string");
    }, EXTERNAL_TIMEOUT_MS);
  });
});
