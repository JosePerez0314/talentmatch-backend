import { z } from "zod";

export const adminParamsSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive("Invalid user ID"),
  }),
});

export const updateUserRoleSchema = z.object({
  body: z.object({
    role: z.enum(["ADMIN", "USER"]),
  }),
  params: z.object({
    id: z.coerce.number().int().positive("Invalid user ID"),
  }),
});
