/**
 * =====================================================
 * INSERT DEMO USERS WITH PROPER BCRYPT HASHING
 * Fluxi Fintech Platform
 * =====================================================
 *
 * Usage:
 * cd BACKEND && node scripts/insert-demo-users.js
 *
 */

import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env file directly
const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};

envContent.split('\n').forEach(line => {
  if (line && !line.startsWith('#') && line.includes('=')) {
    const eqIndex = line.indexOf('=');
    const key = line.substring(0, eqIndex).trim();
    const value = line.substring(eqIndex + 1).trim();
    if (key && value) {
      env[key] = value;
    }
  }
});

console.log('🔧 Variables de entorno cargadas:');
console.log(`   Host: ${env.CRATEDB_HOST}`);
console.log(`   Port: ${env.CRATEDB_PORT}`);
console.log(`   User: ${env.CRATEDB_USER}`);
console.log(`   Database: ${env.CRATEDB_DATABASE}\n`);

// Database Connection
const pool = new Pool({
  host: env.CRATEDB_HOST,
  port: parseInt(env.CRATEDB_PORT) || 5432,
  user: env.CRATEDB_USER,
  password: env.CRATEDB_PASSWORD,
  database: env.CRATEDB_DATABASE,
  ssl: {
    rejectUnauthorized: false
  }
});

// =====================================================
// DEMO USERS DATA
// =====================================================

const demoUsers = [
  {
    id: 'admin-user-001',
    username: 'admin_fluxi',
    email: 'admin@fluxi.com',
    password: '123456789',
    firstName: 'Administrador',
    lastName: 'Sistema',
    phone: '+57301234567',
    role: 'fluxiAdmin',
    roleId: '29d92665-18b7-46f5-9ab8-7b23c32ac5de'
  },
  {
    id: 'demo-user-001',
    username: 'demo_fluxi',
    email: 'demo@fluxi.com',
    password: '12345',
    firstName: 'Demo',
    lastName: 'Usuario',
    phone: '+57302345678',
    role: 'fluxiUser',
    roleId: '8bbbb7c9-a9f7-416a-8415-3375313e84b7'
  }
];

// =====================================================
// MAIN FUNCTION
// =====================================================

async function insertDemoUsers() {
  const client = await pool.connect();

  try {
    console.log('📊 Iniciando inserción de usuarios demo...\n');

    for (const user of demoUsers) {
      try {
        // Hash password
        const hashedPassword = await bcrypt.hash(user.password, 10);
        console.log(`\n🔐 Usuario: ${user.email}`);
        console.log(`   Contraseña hasheada: ${hashedPassword}`);

        const now = new Date();

        // 1. Insert User
        console.log(`   ↳ Insertando usuario...`);
        await client.query(
          `INSERT INTO doc.users (id, username, email, password, first_name, last_name, phone, role, kyc_status, status, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            user.id,
            user.username,
            user.email,
            hashedPassword,
            user.firstName,
            user.lastName,
            user.phone,
            user.role,
            'approved',
            'active',
            true,
            now,
            now
          ]
        );
        console.log(`   ✅ Usuario creado`);

        // 2. Insert KYC Profile
        console.log(`   ↳ Creando perfil KYC...`);
        await client.query(
          `INSERT INTO doc.kyc_profile (id, user_id, status, risk_level, verification_type, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            uuidv4(),
            user.id,
            'approved',
            'low',
            user.role === 'fluxiAdmin' ? 'admin' : 'individual',
            now,
            now
          ]
        );
        console.log(`   ✅ KYC Profile creado`);

        // 3. Insert KYC Status
        console.log(`   ↳ Actualizando estado KYC...`);
        await client.query(
          `INSERT INTO doc.kyc_status (user_id, status, current_step, last_updated)
           VALUES ($1, $2, $3, $4)`,
          [user.id, 'approved', 'completed', now]
        );
        console.log(`   ✅ KYC Status actualizado`);

        // 4. Insert User Role
        console.log(`   ↳ Asignando rol...`);
        await client.query(
          `INSERT INTO doc.user_roles (id, user_id, role_id, assigned_at)
           VALUES ($1, $2, $3, $4)`,
          [uuidv4(), user.id, user.roleId, now]
        );
        console.log(`   ✅ Rol asignado`);

        console.log(`\n✅ Usuario ${user.email} insertado correctamente`);

      } catch (error) {
        console.error(`\n❌ Error insertando usuario ${user.email}:`, error.message);
      }
    }

    console.log(`\n\n📋 =====================================================`);
    console.log(`📋 CREDENCIALES DE ACCESO`);
    console.log(`📋 =====================================================`);
    console.log(`\n👨‍💼 ADMIN:`);
    console.log(`   Email: admin@fluxi.com`);
    console.log(`   Contraseña: 123456789`);
    console.log(`   Rol: fluxiAdmin`);
    console.log(`   Estado KYC: approved`);
    console.log(`\n👤 DEMO USER:`);
    console.log(`   Email: demo@fluxi.com`);
    console.log(`   Contraseña: 12345`);
    console.log(`   Rol: fluxiUser`);
    console.log(`   Estado KYC: approved`);
    console.log(`\n✅ Todos los usuarios están listos para usar el dashboard`);
    console.log(`📋 =====================================================\n`);

  } catch (error) {
    console.error('❌ Error general:', error);
  } finally {
    await client.release();
    await pool.end();
  }
}

// =====================================================
// EXECUTE
// =====================================================

insertDemoUsers().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
