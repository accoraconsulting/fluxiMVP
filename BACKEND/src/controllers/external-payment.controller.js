/**
 * EXTERNAL PAYMENT CONTROLLER
 * Endpoints para pagos externos (Mesta)
 */

import * as externalPaymentService from '../services/mesta/external-payment.service.js';
import * as balanceLockService from '../services/mesta/balance-lock.service.js';
import mestaClient from '../services/mesta/mesta.client.js';
import { execute } from '../config/crate.js';

/**
 * POST /api/external-payments
 * Crear un nuevo pago externo
 */
export async function createPayment(req, res) {
  try {
    const userId = req.user.id;
    const {
      amount,
      currency,
      fromWalletId,
      toUserEmail,
      toWalletId,
      convertedAmount,
      convertedCurrency,
      exchangeRate,
      commission,
      description,
    } = req.body;

    // Validaciones
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Monto inválido' });
    }

    if (!currency) {
      return res.status(400).json({ error: 'Moneda requerida' });
    }

    if (!fromWalletId) {
      return res.status(400).json({ error: 'Wallet origen requerida' });
    }

    // Obtener usuario destino si hay email
    let toUserId = null;
    if (toUserEmail) {
      const { rows } = await execute(`
        SELECT id FROM doc.users WHERE email = $1 LIMIT 1
      `, [toUserEmail]);

      if (rows.length > 0) {
        toUserId = rows[0].id;
      }
    }

    // Crear pago externo
    const result = await externalPaymentService.createExternalPayment({
      userId,
      amount,
      currency,
      fromWalletId,
      toUserId,
      toUserEmail,
      toWalletId,
      convertedAmount,
      convertedCurrency,
      exchangeRate,
      commission: commission || 0,
      description,
    });

    res.status(201).json({
      success: true,
      message: 'Pago externo creado, saldo bloqueado',
      data: result,
    });

  } catch (error) {
    console.error('[ExternalPaymentController] ❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/external-payments/:id/initiate
 * Iniciar pago con Mesta (obtener URL de pago)
 */
export async function initiatePayment(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const mestaOrderData = req.body;

    // Verificar que el pago pertenece al usuario
    const payment = await externalPaymentService.getExternalPayment(id);

    if (!payment) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }

    if (payment.user_id !== userId) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // Iniciar con Mesta
    const result = await externalPaymentService.initiateWithMesta(id, mestaOrderData);

    res.json({
      success: true,
      message: 'Pago iniciado con Mesta',
      data: {
        externalPaymentId: result.externalPaymentId,
        mestaOrderId: result.mestaOrderId,
        paymentUrl: result.paymentUrl,
        status: result.status,
      },
    });

  } catch (error) {
    console.error('[ExternalPaymentController] ❌ Error iniciando:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/external-payments/:id/cancel
 * Cancelar pago externo
 */
export async function cancelPayment(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { reason } = req.body;

    // Verificar que el pago pertenece al usuario
    const payment = await externalPaymentService.getExternalPayment(id);

    if (!payment) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }

    if (payment.user_id !== userId) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // Cancelar
    const result = await externalPaymentService.cancelPayment(id, reason || 'Cancelled by user');

    res.json({
      success: true,
      message: 'Pago cancelado, saldo liberado',
      data: result,
    });

  } catch (error) {
    console.error('[ExternalPaymentController] ❌ Error cancelando:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/external-payments/:id
 * Obtener detalle de pago externo
 */
export async function getPayment(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const payment = await externalPaymentService.getExternalPayment(id);

    if (!payment) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }

    // Solo el dueño o admin puede ver
    if (payment.user_id !== userId && req.user.role !== 'fluxiAdmin') {
      return res.status(403).json({ error: 'No autorizado' });
    }

    res.json({
      success: true,
      data: payment,
    });

  } catch (error) {
    console.error('[ExternalPaymentController] ❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/external-payments
 * Listar pagos externos del usuario
 */
export async function listPayments(req, res) {
  try {
    const userId = req.user.id;
    const { limit = 20 } = req.query;

    const payments = await externalPaymentService.getUserExternalPayments(userId, parseInt(limit));

    res.json({
      success: true,
      data: payments,
      count: payments.length,
    });

  } catch (error) {
    console.error('[ExternalPaymentController] ❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/external-payments/balance/:walletId
 * Obtener saldo disponible (considerando locks)
 */
export async function getAvailableBalance(req, res) {
  try {
    const userId = req.user.id;
    const { walletId } = req.params;

    const availableBalance = await balanceLockService.getAvailableBalance(userId, walletId);

    // Obtener locks activos
    const activeLocks = await balanceLockService.getUserActiveLocks(userId);

    res.json({
      success: true,
      data: {
        availableBalance,
        activeLocks: activeLocks.filter(l => l.wallet_id === walletId),
      },
    });

  } catch (error) {
    console.error('[ExternalPaymentController] ❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/external-payments/locks
 * Obtener locks activos del usuario
 */
export async function getActiveLocks(req, res) {
  try {
    const userId = req.user.id;

    const locks = await balanceLockService.getUserActiveLocks(userId);
    const summary = await balanceLockService.getUserLocksSummary(userId);

    res.json({
      success: true,
      data: {
        locks,
        summary,
      },
    });

  } catch (error) {
    console.error('[ExternalPaymentController] ❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/external-payments/mesta/health
 * Health check de conexión con Mesta
 */
export async function mestaHealthCheck(req, res) {
  try {
    const result = await mestaClient.healthCheck();

    res.json({
      success: result.success,
      data: result,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

export default {
  createPayment,
  initiatePayment,
  cancelPayment,
  getPayment,
  listPayments,
  getAvailableBalance,
  getActiveLocks,
  mestaHealthCheck,
};
