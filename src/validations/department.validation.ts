import { z } from "zod";

const baseDepartmentBody = z.object({
  title: z.string().min(3, "Title must be at least 3 characters long"),
});

export const sendDepartmentSchema = z.object({
  body: baseDepartmentBody,
});

export const getOneDepartmentSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive("Invalid Department ID"),
  }),
});

export const updateDepartmentSchema = z.object({
  body: baseDepartmentBody.partial(),

  params: z.object({
    id: z.coerce.number().int().positive("Invalid Department ID"),
  }),
});

export const deleteDepartmentSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive("Invalid Department ID"),
  }),
});
