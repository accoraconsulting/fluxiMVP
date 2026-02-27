/**
 * VITAWALLET TESTING ROUTES
 * Rutas para testing sin Vitawallet real
 * SOLO para desarrollo, desactivar en producción
 */

import express from 'express';
import { authRequired } from '../middlewares/auth.middleware.js';
import {
  testFullPayinFlow,
  getTestingStats,
  sendManualWebhook,
  clearTestingTables,
} from '../controllers/vitawallet-testing.controller.js';

const router = express.Router();

// ===== TESTING ENDPOINTS (Solo en desarrollo) =====

/**
 * POST /api/vitawallet-testing/full-flow
 * Simula flujo completo: payin → webhook → ledger
 */
router.post('/vitawallet-testing/full-flow', authRequired, testFullPayinFlow);

/**
 * GET /api/vitawallet-testing/stats
 * Obtener estadísticas de testing
 */
router.get('/vitawallet-testing/stats', getTestingStats);

/**
 * POST /api/vitawallet-testing/webhook-manual
 * Enviar webhook manualmente
 */
router.post('/vitawallet-testing/webhook-manual', sendManualWebhook);

/**
 * DELETE /api/vitawallet-testing/clear-tables
 * Limpiar tablas de testing (SOLO DEV)
 */
router.delete('/vitawallet-testing/clear-tables', clearTestingTables);

export default router;
