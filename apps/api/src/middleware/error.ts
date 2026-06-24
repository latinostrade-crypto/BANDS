import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "error"
  ) {
    super(message);
  }
}

export const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = error instanceof HttpError ? error.status : error instanceof ZodError ? 400 : 500;
  const message =
    error instanceof ZodError
      ? "Invalid request body or parameters"
      : error instanceof Error
        ? error.message
        : "Unexpected error";
  const code = error instanceof HttpError ? error.code : error instanceof ZodError ? "validation_error" : "internal_error";
  if (status >= 500) console.error(error);
  res.status(status).json({ error: { code, message } });
};
