/**
 * EXTERNAL PAYMENT ROUTES
 * Rutas para pagos externos (Mesta)
 */

import { Router } from 'express';
import { authRequired } from '../middlewares/auth.middleware.js';
import * as externalPaymentController from '../controllers/external-payment.controller.js';

const router = Router();

// ═══════════════════════════════════════════════════════════════
// RUTAS PROTEGIDAS (requieren autenticación)
// ═══════════════════════════════════════════════════════════════

// Crear pago externo
router.post('/', authRequired, externalPaymentController.createPayment);

// Iniciar pago con Mesta (obtener URL de pago)
router.post('/:id/initiate', authRequired, externalPaymentController.initiatePayment);

// Cancelar pago
router.post('/:id/cancel', authRequired, externalPaymentController.cancelPayment);

// Obtener detalle de pago
router.get('/:id', authRequired, externalPaymentController.getPayment);

// Listar pagos del usuario
router.get('/', authRequired, externalPaymentController.listPayments);

// Obtener saldo disponible (considerando locks)
router.get('/balance/:walletId', authRequired, externalPaymentController.getAvailableBalance);

// Obtener locks activos
router.get('/locks/active', authRequired, externalPaymentController.getActiveLocks);

// Health check de Mesta
router.get('/mesta/health', authRequired, externalPaymentController.mestaHealthCheck);

export default router;
