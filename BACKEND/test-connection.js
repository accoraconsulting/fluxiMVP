import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

console.log('\n✅ Variables cargadas:');
console.log('CRATEDB_HOST:', process.env.CRATEDB_HOST);
console.log('CRATEDB_PORT:', process.env.CRATEDB_PORT);
console.log('CRATEDB_USER:', process.env.CRATEDB_USER);
console.log('CRATEDB_DATABASE:', process.env.CRATEDB_DATABASE);
console.log('CRATEDB_SSL:', process.env.CRATEDB_SSL);

// Intentar conectar
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

console.log('\n🔌 Intentando conectar a CrateDB...');
pool.connect()
  .then(client => {
    console.log('✅ Conexión exitosa!');
    client.release();
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error de conexión:', err.message);
    process.exit(1);
  });
