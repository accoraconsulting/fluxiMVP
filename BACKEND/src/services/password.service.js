import { execute } from '../config/crate.js';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import { sendPasswordResetEmail } from './email.service.js';

/**
 * PASSWORD RESET SERVICE
 * Adaptado para usar tabla password_resets existente
 */

const TOKEN_EXPIRY_MINUTES = 30; // Token válido por 30 minutos

/* =====================================================
   SOLICITAR RESET DE CONTRASEÑA
===================================================== */
export async function requestPasswordReset(email) {
  try {
    console.log('[PasswordService] 🔍 Buscando usuario:', email);

    // 1. Buscar usuario
    const { rows: users } = await execute(
      `SELECT id, email, username 
       FROM doc.users 
       WHERE email = $1 
       LIMIT 1`,
      [email.toLowerCase().trim()]
    );

    if (users.length === 0) {
      console.log('[PasswordService] ⚠️ Usuario no encontrado');
      // Por seguridad, no revelamos si el email existe
      return null;
    }

    const user = users[0];
    console.log('[PasswordService] ✅ Usuario encontrado:', user.id);

    // 2. Generar token único
    const token = randomUUID();
    const tokenHash = await bcrypt.hash(token, 10); // Hashear el token
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

    console.log('[PasswordService] 🔑 Token generado:', token);
    console.log('[PasswordService] ⏰ Expira en:', TOKEN_EXPIRY_MINUTES, 'minutos');

    // 3. Guardar token en BD usando la tabla password_resets existente
    await execute(
      `INSERT INTO doc.password_resets (
        id, user_id, token_hash, expires_at, used, created_at
      ) VALUES ($1, $2, $3, $4, false, CURRENT_TIMESTAMP)`,
      [randomUUID(), user.id, tokenHash, expiresAt.toISOString()]
    );

    await execute('REFRESH TABLE doc.password_resets');

    console.log('[PasswordService] 💾 Token guardado en BD');

    // 4. Enviar email
    console.log('[PasswordService] 📧 Enviando email...');
    
    await sendPasswordResetEmail(
      user.email, 
      token, // Enviamos el token SIN hashear por email
      TOKEN_EXPIRY_MINUTES
    );

    console.log('[PasswordService] ✅ Email enviado correctamente');

    return {
      success: true,
      email: user.email
    };

  } catch (error) {
    console.error('[PasswordService] ❌ Error:', error);
    throw error;
  }
}

/* =====================================================
   VALIDAR TOKEN
===================================================== */
export async function validateResetToken(token) {
  try {
    console.log('[PasswordService] 🔍 Validando token...');

    // Obtener todos los tokens activos (no usados y no expirados)
    const { rows: tokens } = await execute(
      `SELECT id, user_id, token_hash, expires_at, used 
       FROM doc.password_resets 
       WHERE used = false 
       AND expires_at > CURRENT_TIMESTAMP
       ORDER BY created_at DESC`
    );

    if (tokens.length === 0) {
      console.log('[PasswordService] ❌ No hay tokens activos');
      return false;
    }

    // Buscar el token que coincida
    for (const tokenData of tokens) {
      const isMatch = await bcrypt.compare(token, tokenData.token_hash);
      
      if (isMatch) {
        console.log('[PasswordService] ✅ Token válido encontrado');
        return true;
      }
    }

    console.log('[PasswordService] ❌ Token no encontrado o inválido');
    return false;

  } catch (error) {
    console.error('[PasswordService] ❌ Error validando token:', error);
    return false;
  }
}

/* =====================================================
   CAMBIAR CONTRASEÑA
===================================================== */
export async function resetPassword(token, newPassword) {
  try {
    console.log('[PasswordService] 🔐 Cambiando contraseña...');

    // 1. Buscar y validar token
    const { rows: tokens } = await execute(
      `SELECT id, user_id, token_hash, expires_at, used 
       FROM doc.password_resets 
       WHERE used = false 
       AND expires_at > CURRENT_TIMESTAMP
       ORDER BY created_at DESC`
    );

    if (tokens.length === 0) {
      console.log('[PasswordService] ❌ No hay tokens activos');
      return false;
    }

    // Buscar el token que coincida
    let matchedToken = null;
    for (const tokenData of tokens) {
      const isMatch = await bcrypt.compare(token, tokenData.token_hash);
      
      if (isMatch) {
        matchedToken = tokenData;
        break;
      }
    }

    if (!matchedToken) {
      console.log('[PasswordService] ❌ Token no encontrado');
      return false;
    }

    const userId = matchedToken.user_id;
    console.log('[PasswordService] 👤 User ID:', userId);

    // 2. Hashear nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log('[PasswordService] 🔒 Contraseña hasheada');

    // 3. Actualizar contraseña en BD
    await execute(
      `UPDATE doc.users 
       SET password = $1 
       WHERE id = $2`,
      [hashedPassword, userId]
    );

    await execute('REFRESH TABLE doc.users');

    console.log('[PasswordService] ✅ Contraseña actualizada en BD');

    // 4. Marcar token como usado
    await execute(
      `UPDATE doc.password_resets 
       SET used = true 
       WHERE id = $1`,
      [matchedToken.id]
    );

    await execute('REFRESH TABLE doc.password_resets');

    console.log('[PasswordService] 🔒 Token marcado como usado');

    return true;

  } catch (error) {
    console.error('[PasswordService] ❌ Error:', error);
    throw error;
  }
}