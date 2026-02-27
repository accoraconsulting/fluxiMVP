/**
 * COMMISSION ROUTES
 */

import express from 'express';
import { authRequired } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/role.middleware.js';
import {
  getStats,
  getHistory,
  getBalances
} from '../controllers/commission.controller.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authRequired);

// 🔥 SOLO ADMIN PUEDE ACCEDER A COMISIONES
router.use(requireAdmin);

// Estadísticas de comisiones
router.get('/stats', getStats);

// Historial de comisiones
router.get('/history', getHistory);

// Balances del sistema
router.get('/balances', getBalances);

export default router;