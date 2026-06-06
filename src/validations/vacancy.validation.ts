import { z } from "zod";
import { VacancyStatus } from "@prisma/client";

const baseVacancyBody = z.object({
  title: z.string().min(1, "Role is required"),
  availableSlots: z.coerce.number().int().positive(),
  startDate: z.coerce.date({ error: "Invalid startDate format" }),
  endDate: z.coerce.date({ error: "Invalid endDate format" }),
  status: z
    .enum(Object.values(VacancyStatus) as [string, ...string[]])
    .optional(),
  departmentId: z.number().int().positive(),
  positionId: z.number().int().positive(),
});

export const sendVacancySchema = z.object({
  body: baseVacancyBody.refine((data) => data.startDate < data.endDate, {
    message: "OpenData must be before closeDate",
    path: ["closeDate"],
  }),
});

export const updateVacancySchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive("Invalid vacancy ID"),
  }),

  body: baseVacancyBody.refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.startDate < data.endDate;
      }
      return true;
    },
    {
      message: "openDate must be before closeDate",
      path: ["closeDate"],
    },
  ),
});

export const vacanciesParamsSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
});

export const changeStatusSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive("Invalid vacancy ID"),
  }),

  body: z.enum(Object.values(VacancyStatus) as [string, ...string[]]),
});
