/**
 * VITAWALLET WALLET ROUTES
 * Rutas para obtener balance de wallets de Vita
 */

import express from 'express';
import {
  getVitaBalance,
  getVitaWallets,
  getVitaWalletBalance,
  getVitaWalletsSummary,
  checkVitaHealth,
} from '../controllers/vitawallet.wallet.controller.js';
import { authRequired } from '../middlewares/auth.middleware.js';

const router = express.Router();

/**
 * ADMIN ONLY (requiere autenticación y rol fluxiAdmin)
 */

/**
 * GET /api/vitawallet/balance
 * Obtiene el balance de la wallet madre en Vita
 * ADMIN ONLY: Solo fluxiAdmin
 * Usado por: Dashboard admin para ver saldo total
 */
router.get('/vitawallet/balance', authRequired, getVitaBalance);

/**
 * GET /api/vitawallet/health
 * Verifica que Vita esté accesible
 * Usado por: Health checks, monitoreo
 */
router.get('/vitawallet/health', checkVitaHealth);

/**
 * PROTEGIDOS (requieren autenticación)
 */

/**
 * GET /api/vitawallet/wallets
 * Obtiene todas las wallets del negocio
 * Admin only
 */
router.get('/vitawallet/wallets', authRequired, getVitaWallets);

/**
 * GET /api/vitawallet/wallets/:uuid
 * Obtiene balance de una wallet específica
 * Admin only
 */
router.get('/vitawallet/wallets/:uuid', authRequired, getVitaWalletBalance);

/**
 * GET /api/vitawallet/summary
 * Obtiene resumen de todas las wallets con totales
 * Admin only
 */
router.get('/vitawallet/summary', authRequired, getVitaWalletsSummary);

export default router;
