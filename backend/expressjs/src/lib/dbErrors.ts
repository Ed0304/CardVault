/** PostgreSQL error codes the services translate into API errors. */
const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";

const codeOf = (err: unknown): unknown =>
  typeof err === "object" && err !== null && "code" in err ? err.code : undefined;

/** A UNIQUE constraint rejected the row (for example a duplicate collection name). */
export const isUniqueViolation = (err: unknown): boolean => codeOf(err) === UNIQUE_VIOLATION;

/** A referenced row disappeared mid-request (for example a collection deleted concurrently). */
export const isForeignKeyViolation = (err: unknown): boolean => codeOf(err) === FOREIGN_KEY_VIOLATION;
