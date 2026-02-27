/**
 * NOTIFICATION CONTROLLER
 * API REST para notificaciones
 */

import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification
} from '../services/notification.service.js';

/**
 * GET /api/notifications
 * Obtener notificaciones del usuario autenticado
 */
export async function getNotifications(req, res) {
  try {
    const userId = req.user.id;
    const {
      limit = 20,
      offset = 0,
      unreadOnly = false,
      category = null
    } = req.query;

    const notifications = await getUserNotifications(userId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      unreadOnly: unreadOnly === 'true',
      category
    });

    res.json({
      success: true,
      data: notifications,
      count: notifications.length
    });

  } catch (error) {
    console.error('[NotificationController] Error en getNotifications:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo notificaciones'
    });
  }
}

/**
 * GET /api/notifications/unread-count
 * Obtener contador de notificaciones no leídas
 */
export async function getUnreadNotificationCount(req, res) {
  try {
    const userId = req.user.id;

    const count = await getUnreadCount(userId);

    res.json({
      success: true,
      count
    });

  } catch (error) {
    console.error('[NotificationController] Error en getUnreadCount:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo contador'
    });
  }
}

/**
 * PUT /api/notifications/:id/read
 * Marcar notificación como leída
 */
export async function markNotificationAsRead(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    await markAsRead(id, userId);

    res.json({
      success: true,
      message: 'Notificación marcada como leída'
    });

  } catch (error) {
    console.error('[NotificationController] Error en markAsRead:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error marcando como leída'
    });
  }
}

/**
 * PUT /api/notifications/read-all
 * Marcar todas las notificaciones como leídas
 */
export async function markAllNotificationsAsRead(req, res) {
  try {
    const userId = req.user.id;

    await markAllAsRead(userId);

    res.json({
      success: true,
      message: 'Todas las notificaciones marcadas como leídas'
    });

  } catch (error) {
    console.error('[NotificationController] Error en markAllAsRead:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error marcando todas como leídas'
    });
  }
}

/**
 * DELETE /api/notifications/:id
 * Eliminar notificación
 */
export async function deleteNotificationById(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    await deleteNotification(id, userId);

    res.json({
      success: true,
      message: 'Notificación eliminada'
    });

  } catch (error) {
    console.error('[NotificationController] Error en deleteNotification:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error eliminando notificación'
    });
  }
}
