/**
 * PAYMENT LINKS ROUTES
 * Rutas para creación y gestión de links de pago (Vita Wallet)
 */

import express from 'express';
import { authRequired } from '../middlewares/auth.middleware.js';
import {
  generatePaymentLink,
  validatePaymentLink,
  getPaymentMethods,
  getPaymentPrices,
} from '../controllers/payment-links.controller.js';

const router = express.Router();

// ═════════════════════════════════════════════════════════════
// PUBLIC ENDPOINTS
// ═════════════════════════════════════════════════════════════

/**
 * GET /api/payment-links/methods/:country
 * Obtiene métodos de pago disponibles
 * Acceso: Público (sin auth)
 */
router.get('/payment-links/methods/:country', getPaymentMethods);

/**
 * GET /api/payment-links/prices/:country
 * Obtiene precios por país
 * Acceso: Público (sin auth)
 */
router.get('/payment-links/prices/:country', getPaymentPrices);

// ═════════════════════════════════════════════════════════════
// PROTECTED ENDPOINTS
// ═════════════════════════════════════════════════════════════

/**
 * POST /api/payment-links/validate
 * Valida datos de un payin antes de crear
 * Acceso: Autenticado
 */
router.post('/payment-links/validate', authRequired, validatePaymentLink);

/**
 * POST /api/payment-links/generate
 * Crea un nuevo link de pago en Vita Wallet
 * Acceso: Autenticado
 */
router.post('/payment-links/generate', authRequired, generatePaymentLink);

export default router;
