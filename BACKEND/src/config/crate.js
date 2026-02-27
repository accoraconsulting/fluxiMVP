import pkg from 'pg';
const { Pool } = pkg;

let pool = null;

function initializePool() {
  if (pool) return pool;

  console.log('[DB] Inicializando Pool de conexiones a CrateDB...');

  pool = new Pool({
    host: process.env.CRATEDB_HOST,
    port: Number(process.env.CRATEDB_PORT),
    user: process.env.CRATEDB_USER,
    password: process.env.CRATEDB_PASSWORD,
    database: process.env.CRATEDB_DATABASE,
    ssl: process.env.CRATEDB_SSL === 'true'
      ? { rejectUnauthorized: false }
      : false,
    // Opciones para mejorar la resiliencia
    max: 20,                          // máximo de clientes en el pool
    idleTimeoutMillis: 30000,         // timeout para clientes inactivos
    connectionTimeoutMillis: 5000     // timeout para establecer conexión
  });

  // Manejar errores del pool
  pool.on('error', (err) => {
    console.error('❌ Error del pool de BD:', err.code, '-', err.message);
  });

  pool.on('connect', () => {
    console.log('[DB] ✅ Nuevo cliente conectado al pool');
  });

  console.log('[DB] ✅ Pool inicializado correctamente');
  return pool;
}

export async function execute(query, params = []) {
  try {
    const thePool = initializePool();
    const client = await thePool.connect();
    try {
      const result = await client.query(query, params);
      return {
        rows: result.rows,
        rowCount: result.rowCount
      };
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ Error ejecutando query:');
    console.error('   Mensaje:', err.message);
    console.error('   Código:', err.code);
    console.error('   Stack:', err.stack);
    throw err;
  }
}
