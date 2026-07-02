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
  if (res.headersSent) {
    console.error("[Global Error Logger]:", getMessage(err));
    next(err);
    return;
  }

  if (err instanceof ZodError) {
    console.warn("[Global Error Logger]:", getMessage(err));
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
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002"
  ) {
    console.warn("[Global Error Logger]:", getMessage(err));
    res.status(409).json({
      success: false,
      error: "A record with this data already exists",
    });
    return;
  }

  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2025"
  ) {
    console.warn("[Global Error Logger]:", getMessage(err));
    res.status(404).json({
      success: false,
      error: "Record not found",
    });
    return;
  }

  if (
    err instanceof Prisma.PrismaClientValidationError ||
    err instanceof Prisma.PrismaClientKnownRequestError
  ) {
    console.warn("[Global Error Logger]:", getMessage(err));
    res.status(400).json({
      success: false,
      error: "Invalid data sent to the database",
    });
    return;
  }

  const statusCode =
    err instanceof Error && hasStatusCode(err) ? err.statusCode! : 500;

  if (statusCode >= 500) {
    console.error("[Global Error Logger]:", getMessage(err));
  } else {
    console.warn("[Global Error Logger]:", getMessage(err));
  }

  res.status(statusCode).json({
    success: false,
    error: getClientMessage(err),
  });
};
