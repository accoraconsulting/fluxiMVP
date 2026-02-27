import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';

const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const pool = new Pool({
  host: process.env.CRATEDB_HOST,
  port: Number(process.env.CRATEDB_PORT),
  user: process.env.CRATEDB_USER,
  password: process.env.CRATEDB_PASSWORD,
  database: process.env.CRATEDB_DATABASE,
  ssl: process.env.CRATEDB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

console.log('\n📋 Verificando kyc_status de usuarios en la BD...\n');

try {
  const result = await pool.query(`
    SELECT
      id,
      email,
      username,
      kyc_status,
      status,
      created_at
    FROM doc.users
    LIMIT 10
  `);

  console.log('═'.repeat(80));
  console.log('USUARIOS EN LA BD:');
  console.log('═'.repeat(80));

  result.rows.forEach((user, i) => {
    console.log(`\n${i + 1}. ${user.email}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   KYC Status: ${user.kyc_status || 'NULL'} ${user.kyc_status ? '✅' : '❌'}`);
    console.log(`   Status: ${user.status}`);
    console.log(`   Created: ${user.created_at}`);
  });

  console.log('\n' + '═'.repeat(80));
  console.log(`Total: ${result.rows.length} usuarios\n`);

  await pool.end();
} catch (err) {
  console.error('❌ Error:', err.message);
  await pool.end();
}
