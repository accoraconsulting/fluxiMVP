import 'dotenv/config';
import { execute } from '../config/crate.js';

const test = async () => {
  try {
    const r = await execute('SELECT 1');
    console.log('✅ Conexión OK:', r.rows);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error DB:', err);
    process.exit(1);
  }
};

test();
