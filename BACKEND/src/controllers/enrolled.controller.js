/**
 * ENROLLED RECIPIENTS CONTROLLER
 */

import {
  enrollRecipient,
  getEnrolledRecipients,
  updateRecipientAlias,
  deleteRecipient,
  validateUserExists,
  getEnrolledDetail,
  reactivateRecipient
} from '../services/enrolled.service.js';

/**
 * POST /api/enrolled
 * Inscribir nuevo destinatario
 */
export async function enroll(req, res) {
  try {
    const userId = req.user.id;
    const { recipientEmail, alias } = req.body;

    if (!recipientEmail || !alias) {
      return res.status(400).json({
        success: false,
        error: 'Email y alias son obligatorios'
      });
    }

    const result = await enrollRecipient(userId, recipientEmail, alias);

    res.json({
      success: true,
      message: 'Destinatario inscrito correctamente',
      data: result
    });

  } catch (error) {
    console.error('[EnrolledController] Error en enroll:', error);
    
    const errorMessages = {
      'El usuario destinatario no existe en la plataforma': 400,
      'No puedes inscribirte a ti mismo': 400,
      'Este destinatario ya está inscrito': 400,
      'El alias es obligatorio': 400,
      'El alias no puede tener más de 50 caracteres': 400
    };

    const status = errorMessages[error.message] || 500;

    res.status(status).json({
      success: false,
      error: error.message || 'Error inscribiendo destinatario'
    });
  }
}

/**
 * GET /api/enrolled
 * Listar destinatarios inscritos
 */
export async function list(req, res) {
  try {
    const userId = req.user.id;

    const recipients = await getEnrolledRecipients(userId);

    res.json({
      success: true,
      data: recipients,
      count: recipients.length
    });

  } catch (error) {
    console.error('[EnrolledController] Error en list:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo destinatarios'
    });
  }
}

/**
 * GET /api/enrolled/:id
 * Obtener detalle de un destinatario inscrito
 */
export async function getDetails(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    console.log('[EnrolledController] Obteniendo detalle:', { enrolledId: id, userId });

    const detail = await getEnrolledDetail(id, userId);

    console.log('[EnrolledController] Detalle obtenido:', {
      email: detail.recipientEmail,
      walletsCount: detail.wallets.length,
      isRegistered: detail.isRegisteredUser
    });

    res.json({
      success: true,
      data: detail
    });

  } catch (error) {
    console.error('[EnrolledController] Error en getDetails:', error);

    if (error.message.includes('no encontrado')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Error obteniendo detalle del destinatario'
    });
  }
}

/**
 * PATCH /api/enrolled/:id
 * Actualizar alias de destinatario
 */
export async function update(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { alias } = req.body;

    if (!alias) {
      return res.status(400).json({
        success: false,
        error: 'El alias es obligatorio'
      });
    }

    const result = await updateRecipientAlias(userId, id, alias);

    res.json({
      success: true,
      message: 'Alias actualizado correctamente',
      data: result
    });

  } catch (error) {
    console.error('[EnrolledController] Error en update:', error);
    
    const status = error.message === 'Destinatario no encontrado' ? 404 : 500;

    res.status(status).json({
      success: false,
      error: error.message || 'Error actualizando destinatario'
    });
  }
}

/**
 * DELETE /api/enrolled/:id
 * Eliminar destinatario
 */
export async function remove(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    await deleteRecipient(userId, id);

    res.json({
      success: true,
      message: 'Destinatario eliminado correctamente'
    });

  } catch (error) {
    console.error('[EnrolledController] Error en remove:', error);
    
    const status = error.message === 'Destinatario no encontrado' ? 404 : 500;

    res.status(status).json({
      success: false,
      error: error.message || 'Error eliminando destinatario'
    });
  }
}

/**
 * POST /api/enrolled/validate
 * Validar que un usuario existe
 */
export async function validate(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'El email es obligatorio'
      });
    }

    const result = await validateUserExists(email);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('[EnrolledController] Error en validate:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error validando usuario'
    });
  }
}


/**
 * POST /api/enrolled/:id/reactivate
 * Reactivar destinatario eliminado
 */
export async function reactivate(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    console.log('[EnrolledController] Reactivando destinatario:', { enrolledId: id, userId });

    const result = await reactivateRecipient(userId, id);

    res.json({
      success: true,
      message: 'Destinatario reactivado correctamente',
      data: result
    });

  } catch (error) {
    console.error('[EnrolledController] Error en reactivate:', error);
    
    const status = error.message === 'Destinatario no encontrado' ? 404 : 500;

    res.status(status).json({
      success: false,
      error: error.message || 'Error reactivando destinatario'
    });
  }
}