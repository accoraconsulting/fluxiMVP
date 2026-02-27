import { 
  requestPasswordReset, 
  validateResetToken, 
  resetPassword 
} from '../services/password.service.js';

/**
 * PASSWORD RESET CONTROLLER
 * Maneja las solicitudes de recuperación de contraseña
 */

/* =====================================================
   SOLICITAR RESET DE CONTRASEÑA
===================================================== */
export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;

    console.log('[Password] 📧 Solicitud de reset para:', email);

    if (!email || !email.includes('@')) {
      return res.status(400).json({ 
        error: 'Email inválido' 
      });
    }

    // Generar token y enviar email
    const result = await requestPasswordReset(email);

    if (!result) {
      // Por seguridad, siempre retornamos OK aunque el email no exista
      return res.json({ 
        success: true, 
        message: 'Si el email existe, recibirás un enlace de recuperación' 
      });
    }

    console.log('[Password] ✅ Email enviado correctamente');

    res.json({ 
      success: true, 
      message: 'Email de recuperación enviado' 
    });

  } catch (error) {
    console.error('[Password] ❌ Error:', error);
    res.status(500).json({ 
      error: 'Error procesando solicitud' 
    });
  }
}

/* =====================================================
   VALIDAR TOKEN DE RESET
===================================================== */
export async function checkResetToken(req, res) {
  try {
    const { token } = req.query;

    console.log('[Password] 🔍 Validando token...');

    if (!token) {
      return res.status(400).json({ 
        error: 'Token no proporcionado' 
      });
    }

    const isValid = await validateResetToken(token);

    if (!isValid) {
      return res.status(400).json({ 
        error: 'Token inválido o expirado' 
      });
    }

    console.log('[Password] ✅ Token válido');

    res.json({ 
      success: true, 
      message: 'Token válido' 
    });

  } catch (error) {
    console.error('[Password] ❌ Error validando token:', error);
    res.status(500).json({ 
      error: 'Error validando token' 
    });
  }
}

/* =====================================================
   CONFIRMAR NUEVO PASSWORD
===================================================== */
export async function confirmPasswordReset(req, res) {
  try {
    const { token, newPassword } = req.body;

    console.log('[Password] 🔐 Confirmando cambio de contraseña...');

    if (!token || !newPassword) {
      return res.status(400).json({ 
        error: 'Token y contraseña son requeridos' 
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ 
        error: 'La contraseña debe tener al menos 8 caracteres' 
      });
    }

    // Cambiar contraseña
    const result = await resetPassword(token, newPassword);

    if (!result) {
      return res.status(400).json({ 
        error: 'Token inválido o expirado' 
      });
    }

    console.log('[Password] ✅ Contraseña actualizada correctamente');

    res.json({ 
      success: true, 
      message: 'Contraseña actualizada exitosamente' 
    });

  } catch (error) {
    console.error('[Password] ❌ Error:', error);
    res.status(500).json({ 
      error: 'Error cambiando contraseña' 
    });
  }
}