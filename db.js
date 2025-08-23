// ESM
import pkg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false } // nécessaire sur Render/Supabase
});

export default pool;

/* CJS:
const { Pool } = require("pg");
require("dotenv").config();
module.exports = new Pool({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
*/
