import { Router } from 'express';
import { authRequired } from '../middlewares/auth.middleware.js';
import {
  createMessage,
  getMyMessages,
  getMessageById,
  addResponse,
  updateStatus
} from '../controllers/support.controller.js';

const router = Router();

// Todas las rutas de soporte requieren autenticación
router.use(authRequired);

/**
 * SUPPORT ROUTES
 * Gestión de mensajes de soporte
 */

/* =====================================================
   POST /api/support/contact
   Crear nuevo mensaje de soporte
===================================================== */
router.post('/contact', createMessage);

/* =====================================================
   GET /api/support/messages
   Obtener mis mensajes
===================================================== */
router.get('/messages', getMyMessages);

/* =====================================================
   GET /api/support/messages/:messageId
   Obtener detalle de un mensaje
===================================================== */
router.get('/messages/:messageId', getMessageById);

/* =====================================================
   POST /api/support/messages/:messageId/response
   Agregar respuesta a un mensaje
===================================================== */
router.post('/messages/:messageId/response', addResponse);

/* =====================================================
   PATCH /api/support/messages/:messageId/status
   Actualizar estado (ADMIN)
===================================================== */
router.patch('/messages/:messageId/status', updateStatus);

export default router;
