import { z } from "zod";

export const createUserSchema = z.object({
  body: z.object({
    email: z.string().trim().check(z.email("Invalid Email format")),
    password: z
      .string()
      .min(10, "Password must be at least 10 characters")
      .max(100)
      .regex(/[A-Z]/, "Must include uppercase letter")
      .regex(/[a-z]/, "Must include lowercase letter")
      .regex(/[0-9]/, "Must include a number"),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().check(z.email("Invalid email format")),
    password: z.string().min(1, "Password is required"),
  }),
});
