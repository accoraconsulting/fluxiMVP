import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { execute } from '../config/crate.js';

/* ============================
   LOGIN
============================ */

export async function loginUser(email, password) {
  const { rows } = await execute(
    `SELECT id, email, password, role, kyc_status, status, username
     FROM doc.users
     WHERE email = $1
     LIMIT 1`,
    [email]
  );

  if (rows.length === 0) {
    throw new Error('Credenciales inválidas');
  }

  const user = rows[0];

  if (!user.status || user.status.toLowerCase() !== 'active') {
    throw new Error('Usuario inactivo');
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    throw new Error('Credenciales inválidas');
  }

  
  /* ============================
     JWT
  ============================ */

  const expiresIn =
    process.env.JWT_EXPIRES?.trim() || '2h';

  const token = jwt.sign(
    {
      userId: user.id,
      role: user.role,
      kyc_status: user.kyc_status
    },
    process.env.JWT_SECRET,
    { expiresIn }
  );

    return {
    token,
    user: {
      id: user.id,
      email: user.email,
      username: user.username, // puede ser null
      role: user.role,
      kyc_status: user.kyc_status
      }
    };
}



/* =====================================================
   HELPER: GENERAR USERNAME ÚNICO
   - No depende del nombre real
   - Compatible con CrateDB
===================================================== */
async function generateUniqueUsername() {
  let username;
  let exists = true;

  while (exists) {
    username = `user_${Math.floor(100000 + Math.random() * 900000)}`;

    const { rows } = await execute(
      `SELECT 1 FROM doc.users WHERE username = $1 LIMIT 1`,
      [username]
    );

    exists = rows.length > 0;
  }

  return username;
}
/* ============================
   REGISTER
============================ */
export async function registerUser(company_name, email, password) {
  /* =====================================================
     1. VALIDAR EMAIL ÚNICO
  ===================================================== */
  const { rows: existing } = await execute(
    'SELECT id FROM doc.users WHERE email = $1',
    [email]
  );

  if (existing.length > 0) {
    throw new Error('El correo ya está registrado');
  }

  /* =====================================================
     2. ✅ OBTENER ROLE ID DE fluxiUser DINÁMICAMENTE
  ===================================================== */
  const { rows: roleRows } = await execute(
    `SELECT id FROM doc.roles WHERE code = $1 LIMIT 1`,
    ['fluxiUser']
  );

  if (roleRows.length === 0) {
    throw new Error('Rol fluxiUser no encontrado en la base de datos');
  }

  const fluxiUserRoleId = roleRows[0].id;

  /* =====================================================
     3. IDS
  ===================================================== */
  const userId = randomUUID();
  const kycProfileId = randomUUID();
  const walletId = randomUUID();
  const auditId = randomUUID();

  /* =====================================================
     4. SEGURIDAD
  ===================================================== */
  const passwordHash = await bcrypt.hash(password, 12);
  const username = await generateUniqueUsername();

  /* =====================================================
     5. USUARIO
     - ✅ Agregar role directamente en la tabla users
     - kyc_status inicial correcto
  ===================================================== */
  await execute(
    `
    INSERT INTO doc.users (
      id,
      email,
      password,
      username,
      role,
      kyc_status,
      status,
      created_at
    ) VALUES (
      $1, $2, $3, $4, $5, 'not_started', 'active', CURRENT_TIMESTAMP
    )
    `,
    [userId, email, passwordHash, username, 'fluxiUser']
  );

  /* =====================================================
     6. ✅ ROLES (TABLA RELACIONAL)
  ===================================================== */
  await execute(
    `
    INSERT INTO doc.user_roles (id, user_id, role_id)
    VALUES ($1, $2, $3)
    `,
    [randomUUID(), userId, fluxiUserRoleId]
  );

  /* =====================================================
     7. PERFIL KYC (META)
  ===================================================== */
  await execute(
    `
    INSERT INTO doc.kyc_profile (
      id,
      user_id,
      status,
      created_at
    )
    VALUES (
      $1, $2, 'draft', CURRENT_TIMESTAMP
    )
    `,
    [kycProfileId, userId]
  );

  /* =====================================================
     8. WALLET
  ===================================================== */
  await execute(
    `
    INSERT INTO doc.wallets (
      id,
      user_id,
      asset_id,
      address
    )
    VALUES (
      $1, $2, 'USD', $3
    )
    `,
    [walletId, userId, `wallet-${userId}`]
  );

  /* =====================================================
     9. AUDITORÍA
  ===================================================== */
  await execute(
    `
    INSERT INTO doc.audit_log (
      id,
      entity_name,
      entity_id,
      action,
      new_data,
      performed_at
    )
    VALUES (
      $1,
      'user',
      $2,
      'REGISTER',
      $3,
      CURRENT_TIMESTAMP
    )
    `,
    [auditId, userId, { email, company_name, username }]
  );

  /* =====================================================
     10. RESPONSE
  ===================================================== */
  return {
    message: 'Usuario creado correctamente',
    user_id: userId,
    username,
    role: 'fluxiUser',
    kyc_status: 'not_started'
  };
}