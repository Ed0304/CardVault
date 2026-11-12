export interface ErrorDetail {
  field: string;
  message: string;
}

/** An error whose message is safe to send to the client. */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ErrorDetail[] | undefined;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: ErrorDetail[],
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
