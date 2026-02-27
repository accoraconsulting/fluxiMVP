/**
 * ENROLLED RECIPIENTS SERVICE
 * Gestión de destinatarios inscritos
 */

import { execute } from '../config/crate.js';
import { randomUUID } from 'crypto';

/**
 * Inscribir un nuevo destinatario
 */
/**
 * Inscribir un nuevo destinatario (o reactivar si existe inactivo)
 */
export async function enrollRecipient(userId, recipientEmail, alias, relationship = 'other') {
  try {
    // Validar que el alias no esté vacío
    if (!alias || alias.trim() === '') {
      throw new Error('El alias es obligatorio');
    }

    // Validar longitud del alias
    if (alias.length > 50) {
      throw new Error('El alias no puede tener más de 50 caracteres');
    }

    // Verificar que el destinatario existe en la plataforma
    const { rows: recipientRows } = await execute(
      `SELECT id, email FROM doc.users WHERE email = $1 LIMIT 1`,
      [recipientEmail]
    );

    if (recipientRows.length === 0) {
      throw new Error('El usuario destinatario no existe en la plataforma');
    }

    const recipientUser = recipientRows[0];

    // Verificar que no se inscribe a sí mismo
    if (recipientUser.id === userId) {
      throw new Error('No puedes inscribirte a ti mismo');
    }

    // Verificar si ya está inscrito (activo o inactivo)
    const { rows: existingRows } = await execute(
      `SELECT id, is_active FROM doc.enrolled_recipients 
       WHERE user_id = $1 AND recipient_user_id = $2 
       LIMIT 1`,
      [userId, recipientUser.id]
    );

    // SI YA EXISTE
    if (existingRows.length > 0) {
      const existing = existingRows[0];

      // Si está ACTIVO, error
      if (existing.is_active) {
        throw new Error('Este destinatario ya está inscrito');
      }

      // Si está INACTIVO, REACTIVAR
      console.log('[EnrolledService] ♻️ Reactivando destinatario existente:', existing.id);

      await execute(
        `UPDATE doc.enrolled_recipients 
         SET is_active = true, 
             alias = $1,
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [alias, existing.id]
      );

      await execute('REFRESH TABLE doc.enrolled_recipients');

      console.log('[EnrolledService] ✅ Destinatario reactivado:', {
        enrolledId: existing.id,
        recipientEmail,
        alias
      });

      return {
        id: existing.id,
        recipientEmail,
        recipientUserId: recipientUser.id,
        alias,
        reactivated: true,
        createdAt: new Date().toISOString()
      };
    }

    // SI NO EXISTE, CREAR NUEVO
    const enrolledId = randomUUID();

    await execute(
      `INSERT INTO doc.enrolled_recipients (
        id,
        user_id,
        recipient_user_id,
        alias,
        is_active,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [enrolledId, userId, recipientUser.id, alias, true]
    );

    await execute('REFRESH TABLE doc.enrolled_recipients');

    console.log('[EnrolledService] ✅ Destinatario inscrito:', {
      enrolledId,
      recipientUserId: recipientUser.id,
      recipientEmail,
      alias
    });

    return {
      id: enrolledId,
      recipientEmail,
      recipientUserId: recipientUser.id,
      alias,
      createdAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('[EnrolledService] Error inscribiendo destinatario:', error);
    throw error;
  }
}

/**
 * Obtener lista de destinatarios inscritos
 */
/**
 * Obtener lista de destinatarios inscritos
 */
export async function getEnrolledRecipients(userId) {
  try {
    console.log('[EnrolledService] 🔍 Obteniendo destinatarios del usuario:', userId);

    const { rows } = await execute(
      `SELECT 
        e.id,
        e.recipient_user_id as "recipientUserId",
        e.alias,
        e.is_active as "isActive",
        e.created_at as "createdAt",
        u.email as "recipientEmail",
        u.username as "recipientUsername",
        u.status as "recipientStatus"
       FROM doc.enrolled_recipients e
       JOIN doc.users u ON e.recipient_user_id = u.id
       WHERE e.user_id = $1
       ORDER BY e.created_at DESC`,
      [userId]
    );

    console.log('[EnrolledService] 📊 Destinatarios encontrados (TODOS):', rows.length);
    console.log('[EnrolledService] 📋 Detalle:');
    rows.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.alias} (${r.recipientEmail}) - isActive: ${r.isActive}`);
    });

    return rows;

  } catch (error) {
    console.error('[EnrolledService] Error obteniendo destinatarios:', error);
    throw new Error('Error obteniendo destinatarios');
  }
}
/**
 * Obtener detalle de un destinatario inscrito CON SUS WALLETS
 */
/**
 * Obtener detalle de un destinatario inscrito CON SUS WALLETS
 */
export async function getEnrolledDetail(enrolledId, userId) {
  try {
    console.log('═══════════════════════════════════════════════');
    console.log('[EnrolledService] 🔍 INICIANDO getEnrolledDetail');
    console.log('[EnrolledService] enrolledId:', enrolledId);
    console.log('[EnrolledService] userId:', userId);
    console.log('═══════════════════════════════════════════════');

    // 1. Obtener datos del enrolled recipient
    const { rows } = await execute(
      `SELECT 
        e.id,
        e.recipient_user_id,
        e.alias,
        e.is_active,
        e.created_at,
        u.id as user_id_from_join,
        u.email as recipient_email,
        u.username as recipient_username,
        u.status as recipient_status
       FROM doc.enrolled_recipients e
       JOIN doc.users u ON e.recipient_user_id = u.id
       WHERE e.id = $1 AND e.user_id = $2
       LIMIT 1`,
      [enrolledId, userId]
    );

    console.log('[EnrolledService] 📊 Enrolled rows:', rows.length);

    if (rows.length === 0) {
      throw new Error('Destinatario no encontrado');
    }

    const enrolled = rows[0];
    const recipientUserId = enrolled.recipient_user_id || enrolled.user_id_from_join;

    console.log('═══════════════════════════════════════════════');
    console.log('[EnrolledService] ✅ Enrolled encontrado:');
    console.log('  - Email:', enrolled.recipient_email);
    console.log('  - Alias:', enrolled.alias);
    console.log('  - Recipient User ID:', recipientUserId);
    console.log('═══════════════════════════════════════════════');

    // 2. Obtener wallets del destinatario (SIN asset_type)
    console.log('[EnrolledService] 💳 Cargando wallets del usuario:', recipientUserId);

    const { rows: walletRows } = await execute(
      `SELECT 
        w.id,
        w.user_id,
        w.balance,
        w.is_active,
        w.created_at,
        a.id as asset_id,
        a.symbol,
        a.name,
        a.decimals
       FROM doc.wallets w
       JOIN doc.assets a ON w.asset_id = a.id
       WHERE w.user_id = $1
       ORDER BY a.symbol`,
      [recipientUserId]
    );

    console.log('═══════════════════════════════════════════════');
    console.log('[EnrolledService] 📊 WALLETS ENCONTRADAS:', walletRows.length);
    console.log('[EnrolledService] 📦 Wallets RAW:');
    walletRows.forEach(w => {
      console.log(`  - ${w.symbol}: balance=${w.balance}, isActive=${w.is_active}, id=${w.id}`);
    });
    console.log('═══════════════════════════════════════════════');

    // Filtrar solo activas
    const activeWallets = walletRows.filter(w => w.is_active === true);

    console.log('[EnrolledService] ✅ Wallets ACTIVAS:', activeWallets.length);

    const wallets = activeWallets.map(w => ({
      id: w.id,
      walletId: w.id, // Importante: ambos campos para compatibilidad
      symbol: w.symbol,
      name: w.name,
      decimals: w.decimals,
      balance: parseFloat(w.balance),
      isActive: w.is_active,
      createdAt: w.created_at
    }));

    console.log('[EnrolledService] 🗺️  Wallets mapeadas:', wallets.length);

    const result = {
      id: enrolled.id,
      recipientEmail: enrolled.recipient_email,
      recipientUserId: recipientUserId,
      alias: enrolled.alias,
      isActive: enrolled.is_active,
      createdAt: enrolled.created_at,
      recipientUsername: enrolled.recipient_username,
      recipientStatus: enrolled.recipient_status,
      isRegisteredUser: true,
      wallets
    };

    console.log('═══════════════════════════════════════════════');
    console.log('[EnrolledService] 🎯 RESULTADO FINAL:');
    console.log('  - Email:', result.recipientEmail);
    console.log('  - Wallets count:', result.wallets.length);
    console.log('═══════════════════════════════════════════════');

    return result;

  } catch (error) {
    console.error('═══════════════════════════════════════════════');
    console.error('[EnrolledService] ❌ ERROR:');
    console.error(error);
    console.error('═══════════════════════════════════════════════');
    throw error;
  }
}

/**
 * Actualizar alias de destinatario
 */
export async function updateRecipientAlias(userId, enrolledId, newAlias) {
  try {
    // Validar alias
    if (!newAlias || newAlias.trim() === '') {
      throw new Error('El alias es obligatorio');
    }

    if (newAlias.length > 50) {
      throw new Error('El alias no puede tener más de 50 caracteres');
    }

    // Verificar que el destinatario existe y pertenece al usuario
    const { rows } = await execute(
      `SELECT id FROM doc.enrolled_recipients 
       WHERE id = $1 AND user_id = $2 
       LIMIT 1`,
      [enrolledId, userId]
    );

    if (rows.length === 0) {
      throw new Error('Destinatario no encontrado');
    }

    // Actualizar alias
    await execute(
      `UPDATE doc.enrolled_recipients 
       SET alias = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [newAlias, enrolledId]
    );

    await execute('REFRESH TABLE doc.enrolled_recipients');

    console.log('[EnrolledService] ✅ Alias actualizado:', {
      enrolledId,
      newAlias
    });

    return {
      id: enrolledId,
      alias: newAlias,
      updatedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('[EnrolledService] Error actualizando alias:', error);
    throw error;
  }
}

/**
 * Eliminar destinatario inscrito
 */
export async function deleteRecipient(userId, enrolledId) {
  try {
    // Verificar que existe y pertenece al usuario
    const { rows } = await execute(
      `SELECT id FROM doc.enrolled_recipients 
       WHERE id = $1 AND user_id = $2 
       LIMIT 1`,
      [enrolledId, userId]
    );

    if (rows.length === 0) {
      throw new Error('Destinatario no encontrado');
    }

    // Marcar como inactivo en lugar de eliminar
    await execute(
      `UPDATE doc.enrolled_recipients 
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [enrolledId]
    );

    await execute('REFRESH TABLE doc.enrolled_recipients');

    console.log('[EnrolledService] ✅ Destinatario desactivado:', enrolledId);

    return { success: true };

  } catch (error) {
    console.error('[EnrolledService] Error eliminando destinatario:', error);
    throw error;
  }
}

/**
 * Validar que un usuario existe en la plataforma
 */
export async function validateUserExists(email) {
  try {
    const { rows } = await execute(
      `SELECT 
        id,
        email,
        username,
        status,
        kyc_status
       FROM doc.users 
       WHERE email = $1 
       LIMIT 1`,
      [email]
    );

    if (rows.length === 0) {
      return {
        exists: false,
        message: 'El usuario no está registrado en la plataforma'
      };
    }

    const user = rows[0];

    return {
      exists: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        status: user.status,
        kycStatus: user.kyc_status
      },
      message: 'Usuario encontrado'
    };

  } catch (error) {
    console.error('[EnrolledService] Error validando usuario:', error);
    throw new Error('Error validando usuario');
  }
}

/**
 * Reactivar destinatario eliminado (soft delete)
 */
export async function reactivateRecipient(userId, enrolledId) {
  try {
    console.log('[EnrolledService] ♻️ Reactivando destinatario:', enrolledId);

    // Verificar que existe y pertenece al usuario
    const { rows } = await execute(
      `SELECT id, is_active FROM doc.enrolled_recipients 
       WHERE id = $1 AND user_id = $2 
       LIMIT 1`,
      [enrolledId, userId]
    );

    if (rows.length === 0) {
      throw new Error('Destinatario no encontrado');
    }

    if (rows[0].is_active) {
      throw new Error('El destinatario ya está activo');
    }

    // Reactivar
    await execute(
      `UPDATE doc.enrolled_recipients 
       SET is_active = true, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [enrolledId]
    );

    await execute('REFRESH TABLE doc.enrolled_recipients');

    console.log('[EnrolledService] ✅ Destinatario reactivado:', enrolledId);

    return { 
      success: true,
      id: enrolledId
    };

  } catch (error) {
    console.error('[EnrolledService] Error reactivando destinatario:', error);
    throw error;
  }
}