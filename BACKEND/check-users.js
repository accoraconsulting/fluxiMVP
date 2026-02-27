import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: process.env.CRATEDB_HOST,
  port: Number(process.env.CRATEDB_PORT),
  user: process.env.CRATEDB_USER,
  password: process.env.CRATEDB_PASSWORD,
  database: process.env.CRATEDB_DATABASE,
  ssl: process.env.CRATEDB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

try {
  const result = await pool.query('SELECT email, username FROM doc.users LIMIT 5');
  console.log('\n📋 Usuarios en la BD:');
  if (result.rows.length === 0) {
    console.log('❌ No hay usuarios en la BD');
  } else {
    result.rows.forEach(user => {
      console.log(`  - ${user.email} (${user.username})`);
    });
  }
} catch (err) {
  console.error('❌ Error:', err.message);
} finally {
  await pool.end();
}
