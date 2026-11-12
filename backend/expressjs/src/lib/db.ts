import { Pool } from "pg";
import { config } from "./config.js";

export const pool = new Pool({ connectionString: config.databaseUrl });

// Idle client errors must not crash the process or leak connection details.
pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL pool error:", err.message);
});
