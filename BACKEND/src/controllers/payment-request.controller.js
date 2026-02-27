/**
 * PAYMENT REQUEST CONTROLLER
 * Controladores para el sistema de solicitudes de pago
 */

import {
  createPaymentRequest,
  approvePaymentRequest,
  approvePaymentRequestLegacy,
  rejectPaymentRequest,
  getUserPaymentRequests,
  getAllPaymentRequests,
  getPendingPaymentsCount
} from '../services/payment-request.service.js';

/**
 * POST /api/payment-requests
 * Crear solicitud de pago
 */
export async function create(req, res) {
  try {
    const userId = req.user.id;
    
    const {
      toUserEmail,
      fromWalletId,
      toWalletId,
      amount,
      fromCurrency,
      toCurrency,
      convertedAmount,
      exchangeRate,
      commission,
      description
    } = req.body;

    // Validaciones
    if (!toUserEmail || !fromWalletId || !toWalletId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Faltan datos requeridos'
      });
    }

    const result = await createPaymentRequest({
      fromUserId: userId,
      toUserEmail,
      fromWalletId,
      toWalletId,
      amount: parseFloat(amount),
      fromCurrency,
      toCurrency,
      convertedAmount: parseFloat(convertedAmount),
      exchangeRate: parseFloat(exchangeRate),
      commission: parseFloat(commission),
      description
    });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[PaymentRequestController] Error en create:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error creando solicitud de pago'
    });
  }
}

/**
 * GET /api/payment-requests/my-requests
 * Obtener solicitudes del usuario autenticado
 */
export async function getMyRequests(req, res) {
  try {
    const userId = req.user.id;
    const { limit = 20 } = req.query;

    const requests = await getUserPaymentRequests(userId, parseInt(limit));

    res.json({
      success: true,
      data: requests
    });

  } catch (error) {
    console.error('[PaymentRequestController] Error en getMyRequests:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo solicitudes'
    });
  }
}

/**
 * GET /api/payment-requests
 * Obtener TODAS las solicitudes (solo admin)
 */
export async function getAll(req, res) {
  try {
    // Verificar que sea admin
    if (req.user.role !== 'fluxiAdmin') {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado. Solo administradores.'
      });
    }

    const { status, limit } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (limit) filters.limit = parseInt(limit);

    const requests = await getAllPaymentRequests(filters);

    res.json({
      success: true,
      data: requests
    });

  } catch (error) {
    console.error('[PaymentRequestController] Error en getAll:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo solicitudes'
    });
  }
}

/**
 * GET /api/payment-requests/pending-count
 * Obtener contador de pagos pendientes (solo admin)
 */
export async function getPendingCount(req, res) {
  try {
    // Verificar que sea admin
    if (req.user.role !== 'fluxiAdmin') {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado'
      });
    }

    const count = await getPendingPaymentsCount();

    res.json({
      success: true,
      count
    });

  } catch (error) {
    console.error('[PaymentRequestController] Error en getPendingCount:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo contador'
    });
  }
}

/**
 * POST /api/payment-requests/:id/approve
 * Aprobar solicitud (solo admin)
 */
export async function approve(req, res) {
  try {
    // Verificar que sea admin
    if (req.user.role !== 'fluxiAdmin') {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado. Solo administradores.'
      });
    }

    const { id } = req.params;
    const adminId = req.user.id;

    // 🔧 Usar versión LEGACY sin Mesta (temporal)
    const result = await approvePaymentRequestLegacy(id, adminId);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[PaymentRequestController] Error en approve:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error aprobando solicitud'
    });
  }
}

/**
 * POST /api/payment-requests/:id/reject
 * Rechazar solicitud (solo admin)
 */
export async function reject(req, res) {
  try {
    // Verificar que sea admin
    if (req.user.role !== 'fluxiAdmin') {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado. Solo administradores.'
      });
    }

    const { id } = req.params;
    const adminId = req.user.id;
    const { reason } = req.body;

    const result = await rejectPaymentRequest(id, adminId, reason);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[PaymentRequestController] Error en reject:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error rechazando solicitud'
    });
  }
}