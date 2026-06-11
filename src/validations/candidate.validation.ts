import { coerce, z } from "zod";

export const candidatesParamsSchema = z.object({
  params: z.object({
    id: coerce.number().int().positive(),
  }),
});
