/**
 * PAYMENT REQUEST ROUTES
 * Rutas para el sistema de solicitudes de pago
 */

import express from 'express';
import { authRequired } from '../middlewares/auth.middleware.js';
import {
  create,
  getMyRequests,
  getAll,
  getPendingCount,
  approve,
  reject
} from '../controllers/payment-request.controller.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authRequired);

// POST /api/payment-requests - Crear solicitud
router.post('/', create);

// GET /api/payment-requests/my-requests - Solicitudes del usuario
router.get('/my-requests', getMyRequests);

// GET /api/payment-requests/pending-count - Contador (solo admin)
router.get('/pending-count', getPendingCount);

// GET /api/payment-requests - Todas las solicitudes (solo admin)
router.get('/', getAll);

// POST /api/payment-requests/:id/approve - Aprobar (solo admin)
router.post('/:id/approve', approve);

// POST /api/payment-requests/:id/reject - Rechazar (solo admin)
router.post('/:id/reject', reject);

export default router;