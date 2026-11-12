import { pool } from "../lib/db.js";

export interface UserRecord {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

interface UserRow {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  created_at: Date;
}

function toUserRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
}

/** Inserts a user. Rejects with a PostgreSQL 23505 error if the email exists. */
export async function createUser(input: {
  username: string;
  email: string;
  passwordHash: string;
}): Promise<UserRecord> {
  const result = await pool.query<UserRow>(
    `INSERT INTO users (username, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, username, email, password_hash, created_at`,
    [input.username, input.email, input.passwordHash],
  );
  const row = result.rows[0];
  if (!row) throw new Error("User insert returned no row");
  return toUserRecord(row);
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  const result = await pool.query<UserRow>(
    `SELECT id, username, email, password_hash, created_at
     FROM users
     WHERE id = $1`,
    [id],
  );
  const row = result.rows[0];
  return row ? toUserRecord(row) : null;
}

export async function findUserByEmail(
  email: string,
): Promise<UserRecord | null> {
  const result = await pool.query<UserRow>(
    `SELECT id, username, email, password_hash, created_at
     FROM users
     WHERE email = $1`,
    [email],
  );
  const row = result.rows[0];
  return row ? toUserRecord(row) : null;
}
