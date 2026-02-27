import {
  createSupportMessage,
  getUserMessages,
  getMessageDetail,
  addMessageResponse,
  updateMessageStatus
} from '../services/support.service.js';

/**
 * SUPPORT CONTROLLER
 * Maneja solicitudes de soporte
 */

/* =====================================================
   CREAR NUEVO MENSAJE DE SOPORTE
===================================================== */
export async function createMessage(req, res) {
  try {
    const { email, name, category, subject, message } = req.body;
    const userId = req.user?.id;

    console.log('[Support] 📝 Nuevo mensaje de soporte de:', email);

    if (!userId) {
      return res.status(401).json({
        error: 'No autorizado'
      });
    }

    if (!email || !name || !category || !subject || !message) {
      return res.status(400).json({
        error: 'Faltan datos requeridos'
      });
    }

    if (message.length < 20) {
      return res.status(400).json({
        error: 'El mensaje debe tener al menos 20 caracteres'
      });
    }

    // Crear mensaje
    const result = await createSupportMessage(userId, {
      email,
      name,
      category,
      subject,
      message
    });

    console.log('[Support] ✅ Mensaje creado exitosamente');

    res.json({
      success: true,
      message: result.message,
      messageId: result.messageId
    });

  } catch (error) {
    console.error('[Support] ❌ Error:', error);
    res.status(500).json({
      error: 'Error procesando solicitud'
    });
  }
}

/* =====================================================
   OBTENER MIS MENSAJES
===================================================== */
export async function getMyMessages(req, res) {
  try {
    const userId = req.user?.id;

    console.log('[Support] 🔍 Obteniendo mensajes de:', userId);

    if (!userId) {
      return res.status(401).json({
        error: 'No autorizado'
      });
    }

    const messages = await getUserMessages(userId);

    res.json({
      success: true,
      messages,
      count: messages.length
    });

  } catch (error) {
    console.error('[Support] ❌ Error:', error);
    res.status(500).json({
      error: 'Error obteniendo mensajes'
    });
  }
}

/* =====================================================
   OBTENER DETALLE DE UN MENSAJE
===================================================== */
export async function getMessageById(req, res) {
  try {
    const { messageId } = req.params;
    const userId = req.user?.id;

    console.log('[Support] 🔍 Obteniendo detalle de:', messageId);

    if (!userId) {
      return res.status(401).json({
        error: 'No autorizado'
      });
    }

    const message = await getMessageDetail(messageId);

    if (!message) {
      return res.status(404).json({
        error: 'Mensaje no encontrado'
      });
    }

    // Verificar que el usuario es el dueño del mensaje
    if (message.user_id !== userId) {
      return res.status(403).json({
        error: 'No tienes acceso a este mensaje'
      });
    }

    res.json({
      success: true,
      message
    });

  } catch (error) {
    console.error('[Support] ❌ Error:', error);
    res.status(500).json({
      error: 'Error obteniendo mensaje'
    });
  }
}

/* =====================================================
   AGREGAR RESPUESTA A MENSAJE
===================================================== */
export async function addResponse(req, res) {
  try {
    const { messageId } = req.params;
    const { response } = req.body;
    const userId = req.user?.id;
    const email = req.user?.email;

    console.log('[Support] 💬 Agregando respuesta a:', messageId);

    if (!userId || !email) {
      return res.status(401).json({
        error: 'No autorizado'
      });
    }

    if (!response || response.length < 5) {
      return res.status(400).json({
        error: 'La respuesta debe tener al menos 5 caracteres'
      });
    }

    // Verificar que el mensaje existe y pertenece al usuario
    const message = await getMessageDetail(messageId);
    if (!message) {
      return res.status(404).json({
        error: 'Mensaje no encontrado'
      });
    }

    if (message.user_id !== userId) {
      return res.status(403).json({
        error: 'No tienes acceso a este mensaje'
      });
    }

    // Agregar respuesta
    await addMessageResponse(messageId, userId, email, response);

    console.log('[Support] ✅ Respuesta agregada');

    res.json({
      success: true,
      message: 'Respuesta enviada correctamente'
    });

  } catch (error) {
    console.error('[Support] ❌ Error:', error);
    res.status(500).json({
      error: 'Error agregando respuesta'
    });
  }
}

/* =====================================================
   ACTUALIZAR ESTADO DE MENSAJE (ADMIN)
===================================================== */
export async function updateStatus(req, res) {
  try {
    const { messageId } = req.params;
    const { status } = req.body;

    console.log('[Support] 📌 Actualizando estado de:', messageId);

    // Validar que sea admin (esto debería hacerse con middleware)
    if (req.user?.role !== 'fluxiAdmin') {
      return res.status(403).json({
        error: 'No tienes permisos para esta acción'
      });
    }

    if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      return res.status(400).json({
        error: 'Estado inválido'
      });
    }

    await updateMessageStatus(messageId, status);

    console.log('[Support] ✅ Estado actualizado');

    res.json({
      success: true,
      message: 'Estado actualizado correctamente'
    });

  } catch (error) {
    console.error('[Support] ❌ Error:', error);
    res.status(500).json({
      error: 'Error actualizando estado'
    });
  }
}
