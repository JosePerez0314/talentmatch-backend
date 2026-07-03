import request from "supertest";
import app from "../../app.js";
import prisma from "../../lib/prisma.js";

// /api/users is mounted BEFORE the auth middleware, so these endpoints are
// public — there is no 401 path to cover here. createUser hashes the password
// with bcrypt and also seeds the default departments, so the login tests build
// their user through the real endpoint rather than a raw prisma insert.
const validCredentials = {
  email: "recruiter@test.com",
  password: "Password123",
};

const createViaApi = (body: { email: string; password: string }) =>
  request(app).post("/api/users").send(body);

describe("POST /api/users", () => {
  it("returns 201, creates the user and seeds default departments (happy path)", async () => {
    const res = await createViaApi(validCredentials);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.userId).toBe("number");

    const persisted = await prisma.user.findUniqueOrThrow({
      where: { id: res.body.userId },
    });
    expect(persisted.email).toBe("recruiter@test.com");
    // Password must be hashed, never stored in plain text.
    expect(persisted.password).not.toBe(validCredentials.password);

    const departmentCount = await prisma.department.count({
      where: { userId: res.body.userId },
    });
    expect(departmentCount).toBeGreaterThan(0);
  });

  it("normalizes the email to lowercase and trims it", async () => {
    const res = await createViaApi({
      email: "  MixedCase@Test.com  ",
      password: "Password123",
    });

    expect(res.status).toBe(201);
    const persisted = await prisma.user.findUniqueOrThrow({
      where: { id: res.body.userId },
    });
    expect(persisted.email).toBe("mixedcase@test.com");
  });

  it("returns 409 when the email already exists", async () => {
    await createViaApi(validCredentials);
    const res = await createViaApi(validCredentials);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(await prisma.user.count()).toBe(1);
  });

  it("returns 400 when the email format is invalid", async () => {
    const res = await createViaApi({
      email: "not-an-email",
      password: "Password123",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "body.email" }),
      ]),
    );
    expect(await prisma.user.count()).toBe(0);
  });

  it("returns 400 when the password is too weak (no uppercase/number, too short)", async () => {
    const res = await createViaApi({
      email: "weakpass@test.com",
      password: "abc",
    });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "body.password" }),
      ]),
    );
    expect(await prisma.user.count()).toBe(0);
  });
});

describe("POST /api/users/login", () => {
  it("returns 200 with a token and user payload (happy path)", async () => {
    await createViaApi(validCredentials);

    const res = await request(app)
      .post("/api/users/login")
      .send(validCredentials);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.user).toMatchObject({
      email: "recruiter@test.com",
      role: "USER",
    });
    // The password must never be returned in the response.
    expect(res.body.user.password).toBeUndefined();
  });

  it("logs in case-insensitively against the normalized email", async () => {
    await createViaApi(validCredentials);

    const res = await request(app)
      .post("/api/users/login")
      .send({ email: "RECRUITER@TEST.COM", password: "Password123" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it("returns 401 when the email does not exist", async () => {
    const res = await request(app)
      .post("/api/users/login")
      .send({ email: "ghost@test.com", password: "Password123" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.token).toBeUndefined();
  });

  it("returns 401 when the password is incorrect", async () => {
    await createViaApi(validCredentials);

    const res = await request(app)
      .post("/api/users/login")
      .send({ email: validCredentials.email, password: "WrongPassword9" });

    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });

  it("returns 400 when the payload fails validation", async () => {
    const res = await request(app)
      .post("/api/users/login")
      .send({ email: "not-an-email", password: "" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
  });
});
