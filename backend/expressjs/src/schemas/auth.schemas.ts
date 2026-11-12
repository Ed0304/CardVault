import { z } from "zod";

// Trim and lowercase first so the same address always maps to one account.
const email = z.string().trim().toLowerCase().pipe(z.email().max(255));

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "must be at least 3 characters")
    .max(100, "must be at most 100 characters")
    .regex(
      /^[A-Za-z0-9_.-]+$/,
      "may only contain letters, numbers, underscores, dots and hyphens",
    ),
  email,
  // Length-based policy; the upper bound limits Argon2 hashing cost per request.
  password: z
    .string()
    .min(8, "must be at least 8 characters")
    .max(128, "must be at most 128 characters"),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "is required").max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
