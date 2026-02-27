import { execute } from '../config/crate.js';

/**
 * USER SERVICE
 * Lógica de negocio de usuarios
 */

/* =====================================================
   CAMBIAR USERNAME
===================================================== */
export async function changeUsername(userId, newUsername) {
  try {
    console.log('[UserService] 🔍 Verificando disponibilidad de username:', newUsername);

    // 1. Verificar que el username no esté en uso por otro usuario
    const { rows: existing } = await execute(
      `SELECT id, username 
       FROM doc.users 
       WHERE username = $1 
       LIMIT 1`,
      [newUsername]
    );

    if (existing.length > 0 && existing[0].id !== userId) {
      console.log('[UserService] ❌ Username ya existe');
      throw new Error('USERNAME_ALREADY_EXISTS');
    }

    console.log('[UserService] ✅ Username disponible');

    // 2. Actualizar username
    await execute(
      `UPDATE doc.users 
       SET username = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [newUsername, userId]
    );

    await execute('REFRESH TABLE doc.users');

    console.log('[UserService] ✅ Username actualizado en BD');

    // 3. Obtener usuario actualizado
    const { rows: updated } = await execute(
      `SELECT id, email, username, role, kyc_status 
       FROM doc.users 
       WHERE id = $1 
       LIMIT 1`,
      [userId]
    );

    if (updated.length === 0) {
      throw new Error('Usuario no encontrado después de actualizar');
    }

    return {
      success: true,
      username: updated[0].username,
      message: 'Nombre de usuario actualizado correctamente'
    };

  } catch (error) {
    console.error('[UserService] ❌ Error:', error);
    throw error;
  }
}