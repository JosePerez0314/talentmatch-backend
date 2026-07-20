import { z } from "zod";
import { EducationLevel } from "@prisma/client";

const basePositionBody = z.object({
  role: z.string().min(5, "Role is required"),

  yearsOfExperience: z.coerce.number().int().nonnegative(),

  // Empty requirement arrays are treated by the scoring engine as "fully
  // satisfied" (Assumption of Competence), which silently inflates every
  // candidate's score. The validation layer is the barrier: if a criterion is
  // weighted, the recruiter must define it when creating the position.
  technicalSkills: z.array(z.string()).min(1),

  optionalTechnicalSkills: z.array(z.string()).optional(),

  softSkills: z
    .array(z.string())
    .min(1, "At least one soft skill is required"),

  languages: z.array(z.string()).min(1, "At least one language is required"),

  description: z
    .string()
    .min(25, "Description must be at least 25 characters long"),

  educationLevel: z.enum(
    Object.values(EducationLevel) as [string, ...string[]],
  ),
  educationArea: z.string().optional(),

  departmentId: z.coerce.number().int().positive(),
});

const EXEMPT_EDUCATION_AREAS = ["NONE", "HIGH_SCHOOL"];

const withEducationRefinement = basePositionBody
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
  })
  .transform((data) => {
    if (
      EXEMPT_EDUCATION_AREAS.includes(data.educationLevel) &&
      !data.educationArea
    ) {
      return { ...data, educationArea: "N/A" };
    }
    return data;
  });

export const sendPositionSchema = z.object({
  body: withEducationRefinement,
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
