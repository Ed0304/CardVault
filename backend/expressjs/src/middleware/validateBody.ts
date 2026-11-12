import type { RequestHandler } from "express";
import type { z } from "zod";
import { AppError } from "../lib/errors.js";

/** Validates req.body with a Zod schema and replaces it with the parsed result. */
export function validateBody(schema: z.ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      next(new AppError(400, "VALIDATION_ERROR", "Invalid request data", details));
      return;
    }
    req.body = result.data;
    next();
  };
}
