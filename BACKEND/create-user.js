import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

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
  const email = 'juato6001@gmail.com';
  const password = '123456789';
  const username = 'juato6001';
  
  console.log(`\n✨ Creando usuario: ${email}`);
  
  // Hashear contraseña
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // Crear usuario
  const userId = randomUUID();
  const result = await pool.query(
    `INSERT INTO doc.users (id, email, password, username, role, kyc_status, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
    [userId, email, hashedPassword, username, 'fluxiUser', 'unapproved', 'active']
  );
  
  console.log(`✅ Usuario creado exitosamente!`);
  console.log(`\n📧 Email: ${email}`);
  console.log(`🔑 Contraseña: ${password}`);
  console.log(`👤 Username: ${username}`);
  console.log(`🎯 Rol: fluxiUser`);
  console.log(`✓ Estado: active`);
  console.log(`⏳ KYC Status: unapproved\n`);
  
} catch (err) {
  console.error('❌ Error:', err.message);
} finally {
  await pool.end();
}
