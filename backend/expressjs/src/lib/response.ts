import type { ErrorDetail } from "./errors.js";

/** Standard CardVault response envelope: { data, error, message }. */
export function success<T>(data: T, message = "Success") {
  return { data, error: null, message };
}

export function failure(
  code: string,
  message: string,
  details?: ErrorDetail[],
) {
  return {
    data: null,
    error: details ? { code, details } : { code },
    message,
  };
}
