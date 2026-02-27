/**
 * ADMIN ROUTES
 * Rutas exclusivas para FluxiAdmin
 */

import express from 'express';
import { authRequired } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/role.middleware.js';
import {
  getStats,
  listUsers,
  getUserDetail,
  updateUserStatus,
  updateWalletStatus,
  listTransactions
} from '../controllers/admin.controller.js';

const router = express.Router();

// Todas las rutas requieren autenticación Y ser admin
router.use(authRequired);
router.use(requireAdmin);

// Estadísticas globales
router.get('/stats', getStats);

// Gestión de usuarios
router.get('/users', listUsers);
router.get('/users/:id', getUserDetail);
router.patch('/users/:id/status', updateUserStatus);

// Gestión de wallets
router.patch('/wallets/:id/status', updateWalletStatus);

// Transacciones
router.get('/transactions', listTransactions);

export default router;