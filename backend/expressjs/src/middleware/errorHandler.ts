import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError } from "../lib/errors.js";
import { failure } from "../lib/response.js";

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json(failure("NOT_FOUND", "Route not found"));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json(failure(err.code, err.message, err.details));
    return;
  }

  // Errors raised by express.json() for malformed or oversized bodies.
  const type = (err as { type?: unknown } | null)?.type;
  if (type === "entity.parse.failed") {
    res.status(400).json(failure("INVALID_JSON", "Request body is not valid JSON"));
    return;
  }
  if (type === "entity.too.large") {
    res.status(413).json(failure("PAYLOAD_TOO_LARGE", "Request body is too large"));
    return;
  }

  // Log the error type and message only; never request bodies or tokens.
  const summary = err instanceof Error ? `${err.name}: ${err.message}` : "unknown error";
  console.error("Unhandled error:", summary);
  res.status(500).json(failure("INTERNAL_ERROR", "Something went wrong"));
};
