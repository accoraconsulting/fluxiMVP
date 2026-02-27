import { changeUsername } from '../services/user.service.js';

/**
 * USER CONTROLLER
 * Maneja las operaciones de usuario
 */

/* =====================================================
   ACTUALIZAR USERNAME
===================================================== */
export async function updateUsername(req, res) {
  try {
    const { username } = req.body;
    const userId = req.user.id; // ✅ Corregido: usar req.user.id (del middleware authRequired)

    console.log('[UserController] 💾 Actualizando username:', { userId, username });

    // Validaciones
    if (!username || username.trim().length < 3) {
      return res.status(400).json({ 
        error: 'El nombre debe tener al menos 3 caracteres' 
      });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ 
        error: 'Solo se permiten letras, números y guiones bajos' 
      });
    }

    // Actualizar username
    const result = await changeUsername(userId, username.trim());

    console.log('[UserController] ✅ Username actualizado correctamente');

    res.json(result);

  } catch (error) {
    console.error('[UserController] ❌ Error:', error);
    
    if (error.message === 'USERNAME_ALREADY_EXISTS') {
      return res.status(400).json({ 
        error: 'Este nombre de usuario ya está en uso' 
      });
    }

    res.status(500).json({ 
      error: 'Error actualizando nombre de usuario' 
    });
  }
}