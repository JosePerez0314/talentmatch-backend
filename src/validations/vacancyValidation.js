import { z } from "zod";

export const sendVacancySchema = z.object({
    body: z.object({
        title: z.string().min(1, "Title is required"),
        positionId: z.coerce.number().int().positive("Position ID must be a positive integer"),

        openDate: z.coerce.date({
            errorMap: () => ({ message: "Invalid openDate format" })
        }),
        closeDate: z.coerce.date({
            errorMap: () => ({ message: "Invalid closeDate format" })
        })
    }).refine(
        (data) => data.openDate < data.closeDate,
        {
            message: "OpenDate must be before closeDate",
            path: ["closeDate"]
        })
});

export const updateVacancySchema = z.object({
    params: z.object({
        id: z.coerce.number().int().positive("Invalid vacancy ID")
    }),

    body: z.object({
        title: z.string().min(1).optional(),

        openDate: z.coerce.date().optional(),

        closeDate: z.coerce.date().optional(),

        positionId: z.coerce.number().int().positive().optional()
    }).refine(
        (data) => {
            if (data.openDate && data.closeDate) {
                return data.openDate < data.closeDate;
            }
            return true;
        },
        {
            message: "openDate must be before closeDate",
            path: ["closeDate"]
        }
    )
});

export const getOneVacancySchema = z.object({
    params: z.object({
        id: z.coerce.number().int().positive()
    })
});


export const deleteVacancySchema = z.object({
    params: z.object({
        id: z.coerce.number().int().positive("Invalid vacancy ID")
    })
});

export const changeStatusSchema = z.object({
    params: z.object({
        id: z.coerce.number().int().positive("Invalid vacancy ID")
    }),

    body: z.object({
        status: z.enum(["OPEN", "CONTACTING", "FILLED"])
    })
});

export const getVacancyResultsSchema = z.object({
    params: z.object({
        id: z.coerce.number().int().positive()
    })
});