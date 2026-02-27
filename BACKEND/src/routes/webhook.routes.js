/**
 * WEBHOOK ROUTES - VITAWALLET
 * Rutas para recibir webhooks de Vitawallet
 */

import { Router } from 'express';
import { authRequired } from '../middlewares/auth.middleware.js';
import { receiveWebhook, testWebhook, manualWebhook, configureWebhook, getWebhookConfig } from '../controllers/webhook.controller.js';
import { validateWebhookMiddleware } from '../services/webhook.signature.service.js';

const router = Router();

// ═══════════════════════════════════════════════════════════════
// VITAWALLET WEBHOOK ENDPOINTS
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/webhooks/vitawallet
 * Recibir webhooks de Vitawallet (sin autenticación - los llama Vitawallet)
 */
router.post('/vitawallet', validateWebhookMiddleware, receiveWebhook);

/**
 * GET /api/webhooks/vitawallet/test
 * Endpoint de prueba para validar webhook
 */
router.get('/vitawallet/test', testWebhook);

/**
 * POST /api/webhooks/vitawallet/manual
 * Simular webhook manualmente (para testing)
 */
router.post('/vitawallet/manual', manualWebhook);

/**
 * PATCH /api/webhooks/vitawallet/configure
 * Configurar webhook URL en Vita Wallet (ADMIN ONLY)
 */
router.patch('/vitawallet/configure', authRequired, configureWebhook);

/**
 * GET /api/webhooks/vitawallet/config
 * Obtener configuración actual de webhooks (ADMIN ONLY)
 */
router.get('/vitawallet/config', authRequired, getWebhookConfig);

export default router;
