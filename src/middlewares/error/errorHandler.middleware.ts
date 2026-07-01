import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

interface HttpError extends Error {
  statusCode?: number;
}

const hasStatusCode = (error: Error): error is HttpError =>
  typeof (error as HttpError).statusCode === "number";

const getMessage = (err: unknown): string =>
  err instanceof Error ? err.message : "Internal server error";

const getClientMessage = (err: unknown): string =>
  process.env.NODE_ENV === "production" ? "Internal server error" : getMessage(err);

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  console.error("[Global Error Logger]:", getMessage(err));

  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: "Validation error",
      details: err.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
    return;
  }

  if (
    err instanceof Prisma.PrismaClientValidationError ||
    err instanceof Prisma.PrismaClientKnownRequestError
  ) {
    res.status(400).json({
      success: false,
      error: "Invalid data sent to the database",
    });
    return;
  }

  const statusCode =
    err instanceof Error && hasStatusCode(err) ? err.statusCode! : 500;

  res.status(statusCode).json({
    success: false,
    error: getClientMessage(err),
  });
};
