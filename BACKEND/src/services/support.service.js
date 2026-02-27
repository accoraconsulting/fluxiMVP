import { execute } from '../config/crate.js';
import { randomUUID } from 'crypto';
import { sendSupportConfirmationEmail, sendSupportNotificationToAdmin } from './email.service.js';

/**
 * SUPPORT SERVICE
 * Maneja crear y gestionar mensajes de soporte
 */

/* =====================================================
   CREAR NUEVO MENSAJE DE SOPORTE
===================================================== */
export async function createSupportMessage(userId, data) {
  try {
    console.log('[SupportService] 📝 Creando nuevo mensaje de soporte');
    console.log('[SupportService] Usuario:', userId);

    const {
      email,
      name,
      category,
      subject,
      message
    } = data;

    // Validaciones básicas
    if (!email || !name || !category || !subject || !message) {
      throw new Error('Faltan datos requeridos');
    }

    // ID único
    const messageId = randomUUID();

    // 1. Guardar en BD
    await execute(
      `INSERT INTO doc.support_messages (
        id, user_id, email, name, category, subject, message, status, priority, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        messageId,
        userId,
        email.toLowerCase().trim(),
        name.trim(),
        category,
        subject.trim(),
        message.trim(),
        'open',
        'normal'
      ]
    );

    await execute('REFRESH TABLE doc.support_messages');

    console.log('[SupportService] ✅ Mensaje guardado en BD:', messageId);

    // 2. Enviar email de CONFIRMACIÓN al usuario
    console.log('[SupportService] 📧 Enviando confirmación al usuario...');

    try {
      await sendSupportConfirmationEmail(
        email,
        name,
        subject,
        messageId
      );
      console.log('[SupportService] ✅ Email de confirmación enviado');
    } catch (emailError) {
      console.error('[SupportService] ⚠️ Error enviando confirmación:', emailError.message);
      // No fallar la transacción si el email falla
    }

    // 3. Enviar email de NOTIFICACIÓN al admin
    console.log('[SupportService] 📧 Notificando al admin...');

    try {
      await sendSupportNotificationToAdmin(
        name,
        email,
        category,
        subject,
        message,
        messageId
      );
      console.log('[SupportService] ✅ Notificación enviada al admin');
    } catch (emailError) {
      console.error('[SupportService] ⚠️ Error notificando admin:', emailError.message);
      // No fallar la transacción si el email falla
    }

    return {
      success: true,
      messageId,
      message: 'Mensaje enviado correctamente. Nuestro equipo te contactará pronto.'
    };

  } catch (error) {
    console.error('[SupportService] ❌ Error:', error);
    throw error;
  }
}

/* =====================================================
   OBTENER MENSAJES DE UN USUARIO
===================================================== */
export async function getUserMessages(userId) {
  try {
    console.log('[SupportService] 🔍 Obteniendo mensajes de:', userId);

    const { rows } = await execute(
      `SELECT id, email, name, category, subject, status, priority, created_at, response_count
       FROM doc.support_messages
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    console.log('[SupportService] ✅ Se encontraron', rows.length, 'mensajes');

    return rows;

  } catch (error) {
    console.error('[SupportService] ❌ Error:', error);
    throw error;
  }
}

/* =====================================================
   OBTENER DETALLE DE UN MENSAJE
===================================================== */
export async function getMessageDetail(messageId) {
  try {
    console.log('[SupportService] 🔍 Obteniendo detalles de:', messageId);

    const { rows: messages } = await execute(
      `SELECT * FROM doc.support_messages WHERE id = $1`,
      [messageId]
    );

    if (messages.length === 0) {
      return null;
    }

    const message = messages[0];

    // Obtener respuestas
    const { rows: responses } = await execute(
      `SELECT id, user_id, email, response, created_at
       FROM doc.support_messages_responses
       WHERE message_id = $1
       ORDER BY created_at ASC`,
      [messageId]
    );

    message.responses = responses;

    console.log('[SupportService] ✅ Mensaje obtenido con', responses.length, 'respuestas');

    return message;

  } catch (error) {
    console.error('[SupportService] ❌ Error:', error);
    throw error;
  }
}

/* =====================================================
   AGREGAR RESPUESTA A MENSAJE
===================================================== */
export async function addMessageResponse(messageId, userId, email, responseText) {
  try {
    console.log('[SupportService] 💬 Agregando respuesta a:', messageId);

    const responseId = randomUUID();

    // 1. Guardar respuesta
    await execute(
      `INSERT INTO doc.support_messages_responses (
        id, message_id, user_id, email, response, created_at
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [
        responseId,
        messageId,
        userId,
        email,
        responseText.trim()
      ]
    );

    // 2. Actualizar contador y última respuesta
    await execute(
      `UPDATE doc.support_messages
       SET response_count = response_count + 1,
           last_response_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [messageId]
    );

    await execute('REFRESH TABLE doc.support_messages_responses');
    await execute('REFRESH TABLE doc.support_messages');

    console.log('[SupportService] ✅ Respuesta guardada');

    return {
      success: true,
      responseId
    };

  } catch (error) {
    console.error('[SupportService] ❌ Error:', error);
    throw error;
  }
}

/* =====================================================
   ACTUALIZAR ESTADO DE MENSAJE
===================================================== */
export async function updateMessageStatus(messageId, newStatus) {
  try {
    console.log('[SupportService] 📌 Actualizando estado de:', messageId, 'a', newStatus);

    let updateQuery = `UPDATE doc.support_messages
                       SET status = $1, updated_at = CURRENT_TIMESTAMP`;
    let params = [newStatus, messageId];

    // Si se resuelve, guardar fecha de resolución
    if (newStatus === 'resolved') {
      updateQuery += `, resolved_at = CURRENT_TIMESTAMP`;
    }

    updateQuery += ` WHERE id = $2`;

    await execute(updateQuery, params);
    await execute('REFRESH TABLE doc.support_messages');

    console.log('[SupportService] ✅ Estado actualizado');

    return { success: true };

  } catch (error) {
    console.error('[SupportService] ❌ Error:', error);
    throw error;
  }
}
