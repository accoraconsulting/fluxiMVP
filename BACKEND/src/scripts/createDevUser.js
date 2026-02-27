import '../config/env.js';

import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { execute } from '../config/crate.js';

/* resto del código igual */

async function createDevUser() {
  try {
    const userId = randomUUID();
    const userRoleId = randomUUID();

    const email = 'dev@payoh.com';
    const plainPassword = 'Devpayo1234!';
    const hashedPassword = await bcrypt.hash(plainPassword, 12);

    const roleCode = 'payoDev';

    console.log('Creando usuario DEV...');

    // 1️⃣ Insertar usuario
    await execute(
      `
      INSERT INTO doc.users (
        id,
        email,
        password,
        role,
        kyc_status,
        status
      ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        userId,
        email,
        hashedPassword,
        roleCode,
        'approved',
        'active'
      ]
    );

    // 2️⃣ Obtener ID del rol real
    const roleResult = await execute(
      `
      SELECT id FROM doc.roles
      WHERE code = ?
      LIMIT 1
      `,
      [roleCode]
    );

    if (roleResult.rows.length === 0) {
      throw new Error('Rol payoDev no existe');
    }

    const roleId = roleResult.rows[0].id;

    // 3️⃣ Insertar relación user ↔ role
    await execute(
      `
      INSERT INTO doc.user_roles (
        id,
        user_id,
        role_id
      ) VALUES (?, ?, ?)
      `,
      [
        userRoleId,
        userId,
        roleId
      ]
    );

    console.log('Usuario DEV creado correctamente');
    console.log('Email:', email);
    console.log('Password:', plainPassword);

    process.exit(0);

  } catch (error) {
    console.error('Error creando usuario DEV:', error.message);
    process.exit(1);
  }
}

createDevUser();
