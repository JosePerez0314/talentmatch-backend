import jwt from "jsonwebtoken";

// Mirrors exactly the payload emitted by POST /api/users/login
// (see users.controller.ts) and expected by auth.middleware.ts.
export type TestUserRole = "ADMIN" | "USER";

export interface TestTokenPayload {
  userId: number;
  role: TestUserRole;
}

interface SignTestTokenOptions {
  expiresIn?: string | number;
  secret?: string;
}

const requireTestSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET no está definido — ¿jest.setup.ts cargó .env.test?",
    );
  }
  return secret;
};

export const signTestToken = (
  payload: TestTokenPayload,
  options: SignTestTokenOptions = {},
): string =>
  jwt.sign(payload, options.secret ?? requireTestSecret(), {
    expiresIn: options.expiresIn ?? "1d",
  } as jwt.SignOptions);

export const authHeaderFor = (
  payload: TestTokenPayload,
  options?: SignTestTokenOptions,
): string => `Bearer ${signTestToken(payload, options)}`;

// Edge cases that auth.middleware.ts explicitly distinguishes:
export const expiredTestToken = (payload: TestTokenPayload): string =>
  signTestToken(payload, { expiresIn: "-1s" });

export const tokenWithWrongSecret = (payload: TestTokenPayload): string =>
  signTestToken(payload, { secret: "wrong-secret-for-testing" });
