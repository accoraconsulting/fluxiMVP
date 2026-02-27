import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';

const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar .env
dotenv.config({ path: path.resolve(__dirname, '.env') });

console.log('\n🔧 Intentando conectar a CrateDB con las siguientes credenciales:');
console.log('━'.repeat(60));
console.log('Host:', process.env.CRATEDB_HOST);
console.log('Puerto:', process.env.CRATEDB_PORT);
console.log('Usuario:', process.env.CRATEDB_USER);
console.log('Base de datos:', process.env.CRATEDB_DATABASE);
console.log('SSL:', process.env.CRATEDB_SSL);
console.log('━'.repeat(60));

const pool = new Pool({
  host: process.env.CRATEDB_HOST,
  port: Number(process.env.CRATEDB_PORT),
  user: process.env.CRATEDB_USER,
  password: process.env.CRATEDB_PASSWORD,
  database: process.env.CRATEDB_DATABASE,
  ssl: process.env.CRATEDB_SSL === 'true'
    ? { rejectUnauthorized: false }
    : false,
  // Timeout de 10 segundos
  connectionTimeoutMillis: 10000
});

// Test de conexión
try {
  console.log('\n⏳ Conectando...');
  const client = await pool.connect();
  console.log('✅ ¡Conexión exitosa!');

  // Query simple
  const result = await client.query('SELECT version()');
  console.log('\n📊 Versión de CrateDB:');
  console.log(result.rows[0].version);

  // Contar usuarios
  const userCount = await client.query('SELECT COUNT(*) as count FROM doc.users');
  console.log(`\n👥 Usuarios en BD: ${userCount.rows[0].count}`);

  client.release();
  await pool.end();
  console.log('\n✅ Test completado exitosamente\n');

} catch (err) {
  console.error('\n❌ Error de conexión:');
  console.error('   Código:', err.code);
  console.error('   Mensaje:', err.message);
  if (err.code === 'ECONNREFUSED') {
    console.error('\n💡 ECONNREFUSED significa que la conexión fue rechazada.');
    console.error('   Posibles causas:');
    console.error('   - El host/puerto son incorrectos');
    console.error('   - CrateDB no está escuchando en ese puerto');
    console.error('   - Hay un firewall bloqueando la conexión');
    console.error('   - Las credenciales son inválidas y CrateDB rechaza la conexión');
  }
  console.error('\n📍 Stack:', err.stack);

  await pool.end();
}
