import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

// ⚠️ Mets ceci dans ton fichier .env (Render > Environment Variables) :
// SUPABASE_DB_URL=postgresql://postgres:password@host:5432/postgres

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false } // obligatoire sur Render/Supabase
});

export default pool;
