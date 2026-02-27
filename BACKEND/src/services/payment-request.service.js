/**
 * PAYMENT REQUEST SERVICE - CON INTEGRACIÓN MESTA
 * Sistema de solicitudes de pago con aprobación de admin
 *
 * FLUJO NUEVO (con Mesta):
 * 1. Usuario crea solicitud → status: pending
 * 2. Admin aprueba → crea external_payment + lock → status: approved_pending_payment
 * 3. Usuario paga en Mesta
 * 4. Webhook confirma → ejecuta ledger → status: completed
 *
 * FLUJO LEGACY (sin Mesta):
 * 1. Usuario crea solicitud → status: pending
 * 2. Admin aprueba → ejecuta inmediatamente → status: approved
 */

import { execute } from '../config/crate.js';
import { randomUUID } from 'crypto';

// ✅ IMPORTS DE NOTIFICACIONES
import { onPaymentPending, onPaymentApproved, onPaymentRejected } from './notification-events.service.js';

// ✅ IMPORTS DE MESTA
import * as externalPaymentService from './mesta/external-payment.service.js';
import { mestaConfig } from '../config/mesta.config.js';

/**
 * Crear solicitud de pago (requiere aprobación de admin)
 */
export async function createPaymentRequest({
  fromUserId,
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
}) {
  try {
    console.log('[PaymentRequest] 📝 Creando solicitud de pago...');

    // 1. Validar que el destinatario existe
    const { rows: toUserRows } = await execute(
      `SELECT id, email FROM doc.users WHERE email = $1 LIMIT 1`,
      [toUserEmail]
    );

    if (toUserRows.length === 0) {
      throw new Error('Usuario destinatario no encontrado');
    }

    const toUserId = toUserRows[0].id;

    // 2. Validar que el emisor tiene saldo suficiente
    const { rows: walletRows } = await execute(
      `SELECT balance FROM doc.wallets WHERE id = $1 LIMIT 1`,
      [fromWalletId]
    );

    if (walletRows.length === 0) {
      throw new Error('Wallet origen no encontrada');
    }

    const balance = parseFloat(walletRows[0].balance);
    const totalRequired = amount + commission;

    if (balance < totalRequired) {
      throw new Error(`Saldo insuficiente. Disponible: ${balance.toFixed(2)}, necesitas: ${totalRequired.toFixed(2)}`);
    }

    // 3. Obtener email del emisor
    const { rows: fromUserRows } = await execute(
      `SELECT email FROM doc.users WHERE id = $1 LIMIT 1`,
      [fromUserId]
    );

    const fromUserEmail = fromUserRows[0].email;

    // 4. Crear solicitud de pago
    const paymentRequestId = randomUUID();

    // ✅ FIX: Agregar to_user_email y updated_at al INSERT
    await execute(
      `INSERT INTO doc.payment_requests (
        id,
        from_user_id,
        to_user_id,
        to_user_email,
        from_wallet_id,
        to_wallet_id,
        amount,
        from_currency,
        to_currency,
        converted_amount,
        exchange_rate,
        commission,
        status,
        description,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending', $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )`,
      [
        paymentRequestId,
        fromUserId,
        toUserId,
        toUserEmail,  // ✅ AGREGADO
        fromWalletId,
        toWalletId,
        amount,
        fromCurrency,
        toCurrency,
        convertedAmount,
        exchangeRate,
        commission,
        description
      ]
    );

    await execute('REFRESH TABLE doc.payment_requests');

    console.log('[PaymentRequest] ✅ Solicitud creada:', paymentRequestId);

    // 5. 🔔 DISPARAR NOTIFICACIONES
    try {
      await onPaymentPending({
        paymentId: paymentRequestId,
        fromUserId,
        fromUserEmail,
        toUserEmail,
        amount,
        currency: fromCurrency
      });
    } catch (notifError) {
      console.error('[PaymentRequest] ⚠️ Error enviando notificaciones (no crítico):', notifError);
    }

    return {
      id: paymentRequestId,
      status: 'pending',
      message: 'Solicitud de pago creada. Esperando aprobación del administrador.'
    };

  } catch (error) {
    console.error('[PaymentRequest] ❌ Error creando solicitud:', error);
    throw error;
  }
}

/**
 * Aprobar solicitud de pago CON MESTA (NUEVO FLUJO)
 * - Crea external_payment con lock de saldo
 * - Genera URL de pago de Mesta
 * - El ledger se actualiza cuando llega el webhook
 */
export async function approvePaymentRequest(paymentRequestId, adminId, options = {}) {
  const { useMesta = true } = options;

  // Si no quieren usar Mesta, usar flujo legacy
  if (!useMesta) {
    return approvePaymentRequestLegacy(paymentRequestId, adminId);
  }

  try {
    console.log('[PaymentRequest] ✅ Aprobando solicitud con Mesta:', paymentRequestId);

    // 1. Obtener detalles de la solicitud
    const { rows } = await execute(
      `SELECT
        pr.*,
        fu.email as from_user_email,
        tu.email as to_user_email
       FROM doc.payment_requests pr
       JOIN doc.users fu ON pr.from_user_id = fu.id
       JOIN doc.users tu ON pr.to_user_id = tu.id
       WHERE pr.id = $1
       LIMIT 1`,
      [paymentRequestId]
    );

    if (rows.length === 0) {
      throw new Error('Solicitud de pago no encontrada');
    }

    const request = rows[0];

    // 2. Validar que esté pendiente
    if (request.status !== 'pending') {
      throw new Error(`La solicitud ya fue procesada (estado: ${request.status})`);
    }

    // 3. Crear external_payment (esto también crea el lock de saldo)
    const externalPayment = await externalPaymentService.createExternalPayment({
      userId: request.from_user_id,
      paymentRequestId: paymentRequestId,
      amount: parseFloat(request.amount),
      currency: request.from_currency,
      fromWalletId: request.from_wallet_id,
      toUserId: request.to_user_id,
      toUserEmail: request.to_user_email,
      toWalletId: request.to_wallet_id,
      convertedAmount: parseFloat(request.converted_amount),
      convertedCurrency: request.to_currency,
      exchangeRate: parseFloat(request.exchange_rate),
      commission: parseFloat(request.commission) || 0,
      description: request.description || `Pago aprobado por admin`,
    });

    // 4. Iniciar con Mesta (obtener URL de pago)
    const mestaResult = await externalPaymentService.initiateWithMesta(
      externalPayment.externalPaymentId,
      {
        // Datos adicionales para Mesta si son necesarios
        reference: paymentRequestId,
        description: request.description,
      }
    );

    // 5. Actualizar estado de la solicitud
    await execute(
      `UPDATE doc.payment_requests
       SET status = 'approved_pending_payment',
           approved_by = $1,
           approved_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [adminId, paymentRequestId]
    );

    await execute('REFRESH TABLE doc.payment_requests');

    console.log('[PaymentRequest] ✅ Solicitud aprobada, esperando pago en Mesta');

    // 6. Notificar (opcional - el pago aún no está completo)
    try {
      await onPaymentApproved({
        paymentId: paymentRequestId,
        fromUserId: request.from_user_id,
        fromUserEmail: request.from_user_email,
        toUserId: request.to_user_id,
        toUserEmail: request.to_user_email,
        amount: request.amount,
        currency: request.from_currency,
        adminId,
        pendingExternalPayment: true,
      });
    } catch (notifError) {
      console.error('[PaymentRequest] ⚠️ Error notificación:', notifError);
    }

    return {
      success: true,
      status: 'approved_pending_payment',
      externalPaymentId: externalPayment.externalPaymentId,
      mestaOrderId: mestaResult.mestaOrderId,
      paymentUrl: mestaResult.paymentUrl,
      lockId: externalPayment.lockId,
      expiresAt: externalPayment.expiresAt,
      message: 'Solicitud aprobada. El usuario debe completar el pago en Mesta.',
    };

  } catch (error) {
    console.error('[PaymentRequest] ❌ Error aprobando con Mesta:', error);
    throw error;
  }
}

/**
 * Aprobar solicitud de pago LEGACY (sin Mesta)
 * - Ejecuta la transferencia inmediatamente
 * - Usar solo para pagos internos sin proveedor externo
 */
export async function approvePaymentRequestLegacy(paymentRequestId, adminId) {
  try {
    console.log('[PaymentRequest] ✅ Aprobando solicitud (LEGACY):', paymentRequestId);

    // 1. Obtener detalles de la solicitud
    const { rows } = await execute(
      `SELECT
        pr.*,
        fu.email as from_user_email,
        tu.email as to_user_email
       FROM doc.payment_requests pr
       JOIN doc.users fu ON pr.from_user_id = fu.id
       JOIN doc.users tu ON pr.to_user_id = tu.id
       WHERE pr.id = $1
       LIMIT 1`,
      [paymentRequestId]
    );

    if (rows.length === 0) {
      throw new Error('Solicitud de pago no encontrada');
    }

    const request = rows[0];

    // 2. Validar que esté pendiente
    if (request.status !== 'pending') {
      throw new Error(`La solicitud ya fue procesada (estado: ${request.status})`);
    }

    // 3. Validar saldo suficiente
    const { rows: walletRows } = await execute(
      `SELECT balance FROM doc.wallets WHERE id = $1 LIMIT 1`,
      [request.from_wallet_id]
    );

    const balance = parseFloat(walletRows[0].balance);
    const totalRequired = parseFloat(request.amount) + parseFloat(request.commission);

    if (balance < totalRequired) {
      throw new Error('El emisor ya no tiene saldo suficiente');
    }

    // 4. Ejecutar transferencia (DÉBITO - EMISOR)
    const debitTxId = randomUUID();
    const txHash = `payment_${Date.now()}_${randomUUID().substring(0, 8)}`;

    const fromBalanceBefore = balance;
    const fromBalanceAfter = balance - totalRequired;

    await execute(
      `INSERT INTO doc.transactions (
        id, wallet_id, status_id, amount, tx_hash, created_at
      ) VALUES ($1, $2, 'completed', $3, $4, CURRENT_TIMESTAMP)`,
      [debitTxId, request.from_wallet_id, -totalRequired, txHash]
    );

    await execute(
      `INSERT INTO doc.wallet_movements (
        id, wallet_id, transaction_id, amount, balance_before, balance_after, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [randomUUID(), request.from_wallet_id, debitTxId, -totalRequired, fromBalanceBefore, fromBalanceAfter]
    );

    await execute(
      `UPDATE doc.wallets SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [fromBalanceAfter, request.from_wallet_id]
    );

    // 5. Ejecutar transferencia (CRÉDITO - RECEPTOR)
    const creditTxId = randomUUID();

    const { rows: toWalletRows } = await execute(
      `SELECT balance FROM doc.wallets WHERE id = $1 LIMIT 1`,
      [request.to_wallet_id]
    );

    const toBalanceBefore = parseFloat(toWalletRows[0].balance);
    const toBalanceAfter = toBalanceBefore + parseFloat(request.converted_amount);

    await execute(
      `INSERT INTO doc.transactions (
        id, wallet_id, status_id, amount, tx_hash, created_at
      ) VALUES ($1, $2, 'completed', $3, $4, CURRENT_TIMESTAMP)`,
      [creditTxId, request.to_wallet_id, request.converted_amount, txHash]
    );

    await execute(
      `INSERT INTO doc.wallet_movements (
        id, wallet_id, transaction_id, amount, balance_before, balance_after, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [randomUUID(), request.to_wallet_id, creditTxId, request.converted_amount, toBalanceBefore, toBalanceAfter]
    );

    await execute(
      `UPDATE doc.wallets SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [toBalanceAfter, request.to_wallet_id]
    );

    // 6. Actualizar estado de la solicitud
    await execute(
      `UPDATE doc.payment_requests
       SET status = 'approved',
           approved_by = $1,
           approved_at = CURRENT_TIMESTAMP,
           transaction_hash = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [adminId, txHash, paymentRequestId]
    );

    // 7. Refrescar tablas
    await execute('REFRESH TABLE doc.transactions');
    await execute('REFRESH TABLE doc.wallet_movements');
    await execute('REFRESH TABLE doc.wallets');
    await execute('REFRESH TABLE doc.payment_requests');

    console.log('[PaymentRequest] ✅ Pago aprobado y ejecutado (LEGACY):', txHash);

    // 8. 🔔 DISPARAR NOTIFICACIONES
    try {
      await onPaymentApproved({
        paymentId: paymentRequestId,
        fromUserId: request.from_user_id,
        fromUserEmail: request.from_user_email,
        toUserId: request.to_user_id,
        toUserEmail: request.to_user_email,
        amount: request.amount,
        currency: request.from_currency,
        adminId
      });
    } catch (notifError) {
      console.error('[PaymentRequest] ⚠️ Error enviando notificaciones (no crítico):', notifError);
    }

    return {
      success: true,
      txHash,
      message: 'Pago aprobado y ejecutado correctamente'
    };

  } catch (error) {
    console.error('[PaymentRequest] ❌ Error aprobando solicitud (LEGACY):', error);
    throw error;
  }
}

/**
 * Rechazar solicitud de pago (solo admin)
 */
export async function rejectPaymentRequest(paymentRequestId, adminId, reason = 'No especificada') {
  try {
    console.log('[PaymentRequest] ❌ Rechazando solicitud:', paymentRequestId);

    // 1. Obtener detalles de la solicitud
    const { rows } = await execute(
      `SELECT 
        pr.*,
        fu.email as from_user_email,
        tu.email as to_user_email
       FROM doc.payment_requests pr
       JOIN doc.users fu ON pr.from_user_id = fu.id
       JOIN doc.users tu ON pr.to_user_id = tu.id
       WHERE pr.id = $1
       LIMIT 1`,
      [paymentRequestId]
    );

    if (rows.length === 0) {
      throw new Error('Solicitud de pago no encontrada');
    }

    const request = rows[0];

    // 2. Validar que esté pendiente
    if (request.status !== 'pending') {
      throw new Error(`La solicitud ya fue procesada (estado: ${request.status})`);
    }

    // 3. Actualizar estado
    await execute(
      `UPDATE doc.payment_requests 
       SET status = 'rejected',
           rejected_by = $1,
           rejected_at = CURRENT_TIMESTAMP,
           rejection_reason = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [adminId, reason, paymentRequestId]
    );

    await execute('REFRESH TABLE doc.payment_requests');

    console.log('[PaymentRequest] ✅ Solicitud rechazada');

    // 4. 🔔 DISPARAR NOTIFICACIONES
    try {
      await onPaymentRejected({
        paymentId: paymentRequestId,
        fromUserId: request.from_user_id,
        fromUserEmail: request.from_user_email,
        toUserEmail: request.to_user_email,
        amount: request.amount,
        currency: request.from_currency,
        reason,
        adminId
      });
    } catch (notifError) {
      console.error('[PaymentRequest] ⚠️ Error enviando notificaciones (no crítico):', notifError);
    }

    return {
      success: true,
      message: 'Solicitud rechazada correctamente'
    };

  } catch (error) {
    console.error('[PaymentRequest] ❌ Error rechazando solicitud:', error);
    throw error;
  }
}

/**
 * Obtener solicitudes del usuario
 */
export async function getUserPaymentRequests(userId, limit = 20) {
  try {
    const { rows } = await execute(
      `SELECT 
        pr.*,
        fu.email as from_user_email,
        fu.username as from_user_username,
        tu.email as to_user_email,
        tu.username as to_user_username
       FROM doc.payment_requests pr
       JOIN doc.users fu ON pr.from_user_id = fu.id
       JOIN doc.users tu ON pr.to_user_id = tu.id
       WHERE pr.from_user_id = $1 OR pr.to_user_id = $1
       ORDER BY pr.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return rows.map(r => ({
      id: r.id,
      fromUser: {
        id: r.from_user_id,
        email: r.from_user_email,
        username: r.from_user_username
      },
      toUser: {
        id: r.to_user_id,
        email: r.to_user_email,
        username: r.to_user_username
      },
      amount: parseFloat(r.amount),
      fromCurrency: r.from_currency,
      toCurrency: r.to_currency,
      convertedAmount: parseFloat(r.converted_amount),
      commission: parseFloat(r.commission),
      status: r.status,
      description: r.description,
      txHash: r.transaction_hash,
      createdAt: r.created_at,
      approvedAt: r.approved_at,
      rejectedAt: r.rejected_at,
      rejectionReason: r.rejection_reason
    }));

  } catch (error) {
    console.error('[PaymentRequest] ❌ Error obteniendo solicitudes:', error);
    throw error;
  }
}

/**
 * Obtener TODAS las solicitudes (para admin)
 */
export async function getAllPaymentRequests(filters = {}) {
  try {
    let query = `
      SELECT 
        pr.*,
        fu.email as from_user_email,
        fu.username as from_user_username,
        tu.email as to_user_email,
        tu.username as to_user_username
       FROM doc.payment_requests pr
       JOIN doc.users fu ON pr.from_user_id = fu.id
       JOIN doc.users tu ON pr.to_user_id = tu.id
       WHERE 1=1
    `;

    const params = [];

    if (filters.status) {
      query += ` AND pr.status = $${params.length + 1}`;
      params.push(filters.status);
    }

    query += ` ORDER BY pr.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(parseInt(filters.limit));
    } else {
      query += ` LIMIT 100`;
    }

    const { rows } = await execute(query, params);

    return rows.map(r => ({
      id: r.id,
      fromUser: {
        id: r.from_user_id,
        email: r.from_user_email,
        username: r.from_user_username
      },
      toUser: {
        id: r.to_user_id,
        email: r.to_user_email,
        username: r.to_user_username
      },
      amount: parseFloat(r.amount),
      fromCurrency: r.from_currency,
      toCurrency: r.to_currency,
      convertedAmount: parseFloat(r.converted_amount),
      commission: parseFloat(r.commission),
      status: r.status,
      description: r.description,
      txHash: r.transaction_hash,
      createdAt: r.created_at,
      approvedAt: r.approved_at,
      rejectedAt: r.rejected_at,
      rejectionReason: r.rejection_reason
    }));

  } catch (error) {
    console.error('[PaymentRequest] ❌ Error obteniendo todas las solicitudes:', error);
    throw error;
  }
}

/**
 * Obtener contador de pagos pendientes
 */
export async function getPendingPaymentsCount() {
  try {
    const { rows } = await execute(
      `SELECT COUNT(*) as count 
       FROM doc.payment_requests 
       WHERE status = 'pending'`
    );

    return parseInt(rows[0].count) || 0;

  } catch (error) {
    console.error('[PaymentRequest] ❌ Error obteniendo contador:', error);
    return 0;
  }
}