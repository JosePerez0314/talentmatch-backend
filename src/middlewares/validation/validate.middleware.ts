import { Request, Response, NextFunction } from "express";
import { z } from "zod";

export const validate =
  (schema: z.ZodObject<any>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse({
        body: req.body,
        params: req.params,
        query: req.query,
      });

      req.body = parsed.body;
      if (parsed.params) req.params = parsed.params as Record<string, string>;
      if (parsed.query) req.query = parsed.query as Record<string, string>;

      next();
    } catch (error) {
      next(error);
    }
  };
