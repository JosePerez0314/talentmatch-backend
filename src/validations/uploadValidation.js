import { z } from "zod";

export const processResumesSchema = z.object({
    body: z.object({
        positionId: z.coerce.number().int().positive().optional()
    })
});