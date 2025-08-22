import pkg from "pg";
const { Pool } = pkg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Missing DATABASE_URL in environment.");
  process.exit(1);
}

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

export async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== "production") {
    console.log("executed query", { text, duration, rows: res.rowCount });
  }
  return res;
}
