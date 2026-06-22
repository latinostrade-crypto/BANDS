import type { NextFunction, Request, Response } from "express";

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
  const status = error instanceof HttpError ? error.status : 500;
  const message = error instanceof Error ? error.message : "Unexpected error";
  const code = error instanceof HttpError ? error.code : "internal_error";
  if (status >= 500) console.error(error);
  res.status(status).json({ error: { code, message } });
};
