import { z } from "zod";
import { ApplicationStatus, VacancyStatus } from "@prisma/client";

const baseVacancyBody = z.object({
  title: z.string().min(1, "Role is required"),
  availableSlots: z.coerce.number().int().positive(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  status: z
    .enum(Object.values(VacancyStatus) as [string, ...string[]])
    .optional(),
  departmentId: z.coerce.number().int().positive(),
  positionId: z.coerce.number().int().positive(),
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
  body: baseVacancyBody.partial().refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.startDate < data.endDate;
      }
      return true;
    },
    {
      message: "startDate must be before endDate",
      path: ["endDate"],
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
  body: z.object({
    status: z.enum(Object.values(VacancyStatus) as [string, ...string[]]),
  }),
});

export const changeCandidateStatusSchema = z.object({
  params: z.object({
    vacancyId: z.coerce.number().int().positive("Invalid vacancy ID"),
    candidateId: z.coerce.number().int().positive("Invalid candidate ID"),
  }),
  body: z.object({
    status: z.enum(Object.values(ApplicationStatus) as [string, ...string[]]),
  }),
});
