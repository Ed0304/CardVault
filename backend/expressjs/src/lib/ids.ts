import { z } from "zod";

/** Ids are PostgreSQL UUIDs (gen_random_uuid()). */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: string): boolean => UUID_PATTERN.test(value);

export const uuidSchema = z.string().regex(UUID_PATTERN, "must be a valid id");
