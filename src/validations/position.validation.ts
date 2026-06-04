import { z } from "zod";
import { EducationLevel } from "@prisma/client";

const basePositionBody = z
  .object({
    role: z.string().min(5, "Role is required"),

    yearsOfExperience: z.coerce.number().int().positive(),

    technicalSkills: z.array(z.string()).min(1),

    optionalTechnicalSkills: z.array(z.string()).optional(),

    softSkills: z.array(z.string()),

    languages: z.array(z.string()).optional(),

    description: z
      .string()
      .min(25, "Description must be at least 25 characters long"),

    educationLevel: z.enum(
      Object.values(EducationLevel) as [string, ...string[]],
    ),
    educationArea: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const requiredAreas = [
      "BACHELOR",
      "TECHNICAL",
      "UNIVERSITY",
      "MASTER",
      "DOCTORATE",
    ];

    if (requiredAreas.includes(data.educationLevel) && !data.educationArea) {
      ctx.addIssue({
        code: "custom",
        path: ["educationArea"],
        message: "Education area is required for this education level",
      });
    }
  });

export const sendPositionSchema = z.object({
  body: basePositionBody,
});

export const positionsParamsSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive("Invalid Position ID"),
  }),
});

export const updatePositionSchema = z.object({
  body: basePositionBody.partial(),

  params: z.object({
    id: z.coerce.number().int().positive("Invalid Position ID"),
  }),
});
