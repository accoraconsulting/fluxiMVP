/**
 * ADMIN CONTROLLER
 * Endpoints exclusivos para administradores
 */

import {
  getPlatformStats,
  getAllUsers,
  getUserDetails,
  toggleUserStatus,
  toggleWalletStatus,
  getAllTransactions
} from '../services/admin.service.js';

/**
 * GET /api/admin/stats
 * Obtener estadísticas globales
 */
export async function getStats(req, res) {
  try {
    const stats = await getPlatformStats();

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('[AdminController] Error en getStats:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo estadísticas'
    });
  }
}

/**
 * GET /api/admin/users
 * Listar todos los usuarios
 * Query: ?role=fluxiUser&kycStatus=approved&status=active&search=email&limit=50
 */
export async function listUsers(req, res) {
  try {
    const filters = {
      role: req.query.role,
      kycStatus: req.query.kycStatus,
      status: req.query.status,
      search: req.query.search,
      limit: req.query.limit || 100
    };

    const users = await getAllUsers(filters);

    res.json({
      success: true,
      data: users,
      count: users.length
    });

  } catch (error) {
    console.error('[AdminController] Error en listUsers:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo usuarios'
    });
  }
}

/**
 * GET /api/admin/users/:id
 * Obtener detalles de un usuario
 */
export async function getUserDetail(req, res) {
  try {
    const { id } = req.params;

    const details = await getUserDetails(id);

    res.json({
      success: true,
      data: details
    });

  } catch (error) {
    console.error('[AdminController] Error en getUserDetail:', error);
    
    const status = error.message === 'Usuario no encontrado' ? 404 : 500;

    res.status(status).json({
      success: false,
      error: error.message || 'Error obteniendo detalles'
    });
  }
}

/**
 * PATCH /api/admin/users/:id/status
 * Cambiar estado de un usuario
 * Body: { status: 'active' | 'blocked' | 'suspended' }
 */
export async function updateUserStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'El campo status es requerido'
      });
    }

    const result = await toggleUserStatus(id, status);

    res.json({
      success: true,
      message: `Usuario ${status === 'active' ? 'activado' : 'bloqueado'} exitosamente`,
      data: result
    });

  } catch (error) {
    console.error('[AdminController] Error en updateUserStatus:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error actualizando estado'
    });
  }
}

/**
 * PATCH /api/admin/wallets/:id/status
 * Cambiar estado de una wallet
 * Body: { isActive: true | false }
 */
export async function updateWalletStatus(req, res) {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'El campo isActive debe ser boolean'
      });
    }

    const result = await toggleWalletStatus(id, isActive);

    res.json({
      success: true,
      message: `Wallet ${isActive ? 'activada' : 'bloqueada'} exitosamente`,
      data: result
    });

  } catch (error) {
    console.error('[AdminController] Error en updateWalletStatus:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error actualizando wallet'
    });
  }
}

/**
 * GET /api/admin/transactions
 * Obtener todas las transacciones
 * Query: ?currency=USD&userId=xxx&limit=100
 */
export async function listTransactions(req, res) {
  try {
    const filters = {
      currency: req.query.currency,
      userId: req.query.userId,
      limit: req.query.limit
    };

    const transactions = await getAllTransactions(filters);

    res.json({
      success: true,
      data: transactions,
      count: transactions.length
    });

  } catch (error) {
    console.error('[AdminController] Error en listTransactions:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo transacciones'
    });
  }
}