/**
 * NOTIFICATION ROUTES
 * Endpoints de notificaciones
 */

import express from 'express';
import { authRequired } from '../middlewares/auth.middleware.js';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotificationById
} from '../controllers/notification.controller.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authRequired);

// GET /api/notifications - Obtener notificaciones
router.get('/', getNotifications);

// GET /api/notifications/unread-count - Contador de no leídas
router.get('/unread-count', getUnreadNotificationCount);

// PUT /api/notifications/read-all - Marcar todas como leídas
router.put('/read-all', markAllNotificationsAsRead);

// PUT /api/notifications/:id/read - Marcar una como leída
router.put('/:id/read', markNotificationAsRead);

// DELETE /api/notifications/:id - Eliminar notificación
router.delete('/:id', deleteNotificationById);

export default router;
