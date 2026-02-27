/**
 * NOTIFICATION SERVICE
 * Servicio centralizado para manejar todas las notificaciones
 */

import { execute } from '../config/crate.js';
import { randomUUID } from 'crypto';
import { NOTIFICATION_TYPES } from './notification-types.js';

/**
 * CREAR NOTIFICACIÓN
 * Función principal para crear cualquier notificación
 */
export async function createNotification({
  userId,
  type,
  category,
  title,
  message,
  metadata = {},
  priority = 'normal',
  actionUrl = null,
  actionLabel = null,
  expiresAt = null
}) {
  try {
    const notificationId = randomUUID();

    await execute(
      `INSERT INTO doc.notifications (
        id, user_id, type, category, title, message,
        metadata, priority, action_url, action_label,
        is_read, is_deleted, created_at, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false, false, CURRENT_TIMESTAMP, $11)`,
      [
        notificationId,
        userId,
        type,
        category,
        title,
        message,
        metadata,
        priority,
        actionUrl,
        actionLabel,
        expiresAt
      ]
    );

    await execute('REFRESH TABLE doc.notifications');

    console.log(`[Notification] ✅ Notificación creada: ${type} | Usuario: ${userId} | Prioridad: ${priority} | ID: ${notificationId}`);

    return {
      id: notificationId,
      userId,
      type,
      title,
      message,
      priority
    };

  } catch (error) {
    console.error('[Notification] ❌ Error creando notificación:', error);
    throw error;
  }
}

/**
 * CREAR NOTIFICACIÓN DESDE TEMPLATE
 * Usa los tipos predefinidos y reemplaza variables
 */
export async function createNotificationFromTemplate({
  userId,
  role,
  templateKey,  // e.g., 'TRANSFER_RECEIVED'
  variables = {}  // Variables para reemplazar en el template
}) {
  try {
    // Obtener template
    const roleTemplates = NOTIFICATION_TYPES[role];
    if (!roleTemplates) {
      throw new Error(`Rol ${role} no tiene templates definidos`);
    }

    const template = roleTemplates[templateKey];
    if (!template) {
      throw new Error(`Template ${templateKey} no existe para rol ${role}`);
    }

    // Reemplazar variables en título y mensaje
    let title = template.title;
    let message = template.message;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      title = title.replace(regex, value);
      message = message.replace(regex, value);
    }

    // Crear notificación
    return await createNotification({
      userId,
      type: template.type,
      category: template.category,
      title,
      message,
      metadata: { ...variables, role, templateKey },
      priority: template.priority,
      actionUrl: template.action,
      actionLabel: getActionLabel(template.action)
    });

  } catch (error) {
    console.error('[Notification] ❌ Error creando desde template:', error);
    throw error;
  }
}

/**
 * OBTENER NOTIFICACIONES DE UN USUARIO
 */
export async function getUserNotifications(userId, options = {}) {
  try {
    const {
      limit = 20,
      offset = 0,
      unreadOnly = false,
      category = null
    } = options;

    let query = `
      SELECT 
        id, type, category, title, message, metadata,
        priority, action_url, action_label,
        is_read, created_at, read_at, expires_at
      FROM doc.notifications
      WHERE user_id = $1
        AND is_deleted = false
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    `;

    const params = [userId];
    let paramIndex = 2;

    if (unreadOnly) {
      query += ` AND is_read = false`;
    }

    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const { rows } = await execute(query, params);

    return rows;

  } catch (error) {
    console.error('[Notification] ❌ Error obteniendo notificaciones:', error);
    throw error;
  }
}

/**
 * CONTAR NOTIFICACIONES NO LEÍDAS
 */
export async function getUnreadCount(userId) {
  try {
    const { rows } = await execute(
      `SELECT COUNT(*) as count
       FROM doc.notifications
       WHERE user_id = $1
         AND is_read = false
         AND is_deleted = false
         AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
      [userId]
    );

    return parseInt(rows[0].count) || 0;

  } catch (error) {
    console.error('[Notification] ❌ Error contando no leídas:', error);
    return 0;
  }
}

/**
 * MARCAR COMO LEÍDA
 */
export async function markAsRead(notificationId, userId) {
  try {
    await execute(
      `UPDATE doc.notifications
       SET is_read = true, read_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2`,
      [notificationId, userId]
    );

    await execute('REFRESH TABLE doc.notifications');

    console.log(`[Notification] ✅ Notificación ${notificationId} marcada como leída`);

    return { success: true };

  } catch (error) {
    console.error('[Notification] ❌ Error marcando como leída:', error);
    throw error;
  }
}

/**
 * MARCAR TODAS COMO LEÍDAS
 */
export async function markAllAsRead(userId) {
  try {
    await execute(
      `UPDATE doc.notifications
       SET is_read = true, read_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );

    await execute('REFRESH TABLE doc.notifications');

    console.log(`[Notification] ✅ Todas las notificaciones de ${userId} marcadas como leídas`);

    return { success: true };

  } catch (error) {
    console.error('[Notification] ❌ Error marcando todas como leídas:', error);
    throw error;
  }
}

/**
 * ELIMINAR NOTIFICACIÓN (SOFT DELETE)
 */
export async function deleteNotification(notificationId, userId) {
  try {
    await execute(
      `UPDATE doc.notifications
       SET is_deleted = true
       WHERE id = $1 AND user_id = $2`,
      [notificationId, userId]
    );

    await execute('REFRESH TABLE doc.notifications');

    console.log(`[Notification] ✅ Notificación ${notificationId} eliminada`);

    return { success: true };

  } catch (error) {
    console.error('[Notification] ❌ Error eliminando notificación:', error);
    throw error;
  }
}

/**
 * LIMPIAR NOTIFICACIONES EXPIRADAS
 * Ejecutar diariamente con cron
 */
export async function cleanExpiredNotifications() {
  try {
    await execute(
      `DELETE FROM doc.notifications
       WHERE expires_at IS NOT NULL
         AND expires_at < CURRENT_TIMESTAMP`
    );

    await execute('REFRESH TABLE doc.notifications');

    console.log('[Notification] ✅ Notificaciones expiradas limpiadas');

  } catch (error) {
    console.error('[Notification] ❌ Error limpiando expiradas:', error);
  }
}

/**
 * HELPERS
 */
function getActionLabel(actionUrl) {
  if (!actionUrl) return null;

  if (actionUrl.includes('/kyc')) return 'Ver KYC';
  if (actionUrl.includes('/wallet')) return 'Ver Wallet';
  if (actionUrl.includes('/transactions')) return 'Ver Transacciones';
  if (actionUrl.includes('/security')) return 'Ir a Seguridad';
  if (actionUrl.includes('/admin')) return 'Ir al Panel';

  return 'Ver Detalles';
}
