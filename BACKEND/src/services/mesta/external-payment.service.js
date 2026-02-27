/**
 * EXTERNAL PAYMENT SERVICE
 * Orquesta pagos con proveedores externos (Mesta)
 *
 * Flujo completo:
 * 1. createExternalPayment() → Crea registro + lock de saldo
 * 2. initiateWithMesta() → Envía a Mesta, obtiene URL de pago
 * 3. [Usuario paga en Mesta]
 * 4. processWebhook() → Recibe confirmación, ejecuta ledger
 */

import { execute } from '../../config/crate.js';
import { randomUUID } from 'crypto';
import mestaClient from './mesta.client.js';
import { mestaConfig } from '../../config/mesta.config.js';
import * as balanceLockService from './balance-lock.service.js';

// Estados internos del pago externo
export const EXTERNAL_PAYMENT_STATUS = {
  CREATED: 'created',                 // Recién creado, sin lock
  PENDING_LOCK: 'pending_lock',       // Esperando lock de saldo
  LOCKED: 'locked',                   // Saldo bloqueado
  PENDING_EXTERNAL: 'pending_external', // Enviado a Mesta
  SETTLED: 'settled',                 // Confirmado, ledger actualizado
  FAILED: 'failed',                   // Falló
  EXPIRED: 'expired',                 // Expiró
  CANCELLED: 'cancelled',             // Cancelado
  REFUNDED: 'refunded',               // Reembolsado
};

// Estados del proveedor
export const PROVIDER_STATUS = {
  NONE: 'none',
  PENDING: 'pending',
  PROCESSING: 'processing',
  SETTLED: 'settled',
  FAILED: 'failed',
  EXPIRED: 'expired',
};

/**
 * Crear pago externo (Paso 1)
 * - Crea registro en BD
 * - Crea lock de saldo
 * - NO contacta a Mesta todavía
 */
export async function createExternalPayment({
  userId,
  paymentRequestId = null,
  amount,
  currency,
  fromWalletId,
  toUserId = null,
  toUserEmail = null,
  toWalletId = null,
  toExternalAddress = null,
  convertedAmount = null,
  convertedCurrency = null,
  exchangeRate = null,
  commission = 0,
  description = '',
  metadata = {},
}) {
  try {
    console.log('[ExternalPayment] 📝 Creando pago externo:', { userId, amount, currency });

    const externalPaymentId = randomUUID();
    const totalToLock = amount + commission;

    // 1. Crear registro inicial
    await execute(`
      INSERT INTO doc.external_payments (
        id,
        payment_request_id,
        user_id,
        provider,
        provider_status,
        amount,
        currency,
        converted_amount,
        converted_currency,
        exchange_rate,
        commission,
        lock_wallet_id,
        lock_status,
        to_user_id,
        to_user_email,
        to_wallet_id,
        to_external_address,
        internal_status,
        description,
        metadata,
        created_at,
        updated_at,
        expires_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $21
      )
    `, [
      externalPaymentId,
      paymentRequestId,
      userId,
      'mesta',
      PROVIDER_STATUS.NONE,
      amount,
      currency,
      convertedAmount,
      convertedCurrency,
      exchangeRate,
      commission,
      fromWalletId,
      'none',
      toUserId,
      toUserEmail,
      toWalletId,
      toExternalAddress,
      EXTERNAL_PAYMENT_STATUS.CREATED,
      description,
      metadata,
      new Date(Date.now() + mestaConfig.paymentTimeoutMinutes * 60 * 1000), // expires_at
    ]);

    await execute('REFRESH TABLE doc.external_payments');

    // 2. Crear lock de saldo
    const lockResult = await balanceLockService.createLock({
      userId,
      walletId: fromWalletId,
      amount: totalToLock,
      currency,
      externalPaymentId,
      paymentRequestId,
      reason: `Pago externo: ${description || externalPaymentId}`,
    });

    // 3. Actualizar registro con lock
    await execute(`
      UPDATE doc.external_payments
      SET lock_id = $1,
          locked_amount = $2,
          lock_status = 'active',
          lock_expires_at = $3,
          internal_status = $4,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
    `, [
      lockResult.lockId,
      totalToLock,
      lockResult.expiresAt,
      EXTERNAL_PAYMENT_STATUS.LOCKED,
      externalPaymentId,
    ]);

    await execute('REFRESH TABLE doc.external_payments');

    console.log('[ExternalPayment] ✅ Pago externo creado:', externalPaymentId);

    return {
      success: true,
      externalPaymentId,
      lockId: lockResult.lockId,
      amount,
      totalLocked: totalToLock,
      currency,
      status: EXTERNAL_PAYMENT_STATUS.LOCKED,
      expiresAt: lockResult.expiresAt,
    };

  } catch (error) {
    console.error('[ExternalPayment] ❌ Error creando pago:', error);
    throw error;
  }
}

/**
 * Iniciar pago con Mesta (Paso 2)
 * - Envía orden a Mesta
 * - Obtiene URL de pago
 */
export async function initiateWithMesta(externalPaymentId, mestaOrderData = {}) {
  try {
    console.log('[ExternalPayment] 🚀 Iniciando con Mesta:', externalPaymentId);

    // 1. Obtener pago externo
    const payment = await getExternalPayment(externalPaymentId);

    if (!payment) {
      throw new Error('Pago externo no encontrado');
    }

    if (payment.internal_status !== EXTERNAL_PAYMENT_STATUS.LOCKED) {
      throw new Error(`Estado inválido para iniciar: ${payment.internal_status}`);
    }

    // 2. Construir orden para Mesta
    const orderData = {
      amount: payment.amount,
      currency: payment.currency,
      reference: externalPaymentId,
      description: payment.description,
      // Datos adicionales según requiera Mesta
      ...mestaOrderData,
    };

    // 3. Crear orden en Mesta
    const mestaResponse = await mestaClient.createOrder(orderData);

    if (!mestaResponse.success) {
      throw new Error('Error creando orden en Mesta');
    }

    const mestaOrder = mestaResponse.data;

    // 4. Actualizar registro con datos de Mesta
    await execute(`
      UPDATE doc.external_payments
      SET provider_tx_id = $1,
          provider_reference = $2,
          provider_status = $3,
          provider_payment_url = $4,
          provider_metadata = $5,
          internal_status = $6,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
    `, [
      mestaOrder.id || mestaOrder.order_id,
      mestaOrder.reference,
      PROVIDER_STATUS.PENDING,
      mestaOrder.payment_url || mestaOrder.checkout_url,
      mestaOrder,
      EXTERNAL_PAYMENT_STATUS.PENDING_EXTERNAL,
      externalPaymentId,
    ]);

    await execute('REFRESH TABLE doc.external_payments');

    console.log('[ExternalPayment] ✅ Orden creada en Mesta:', mestaOrder.id);

    return {
      success: true,
      externalPaymentId,
      mestaOrderId: mestaOrder.id || mestaOrder.order_id,
      paymentUrl: mestaOrder.payment_url || mestaOrder.checkout_url,
      status: EXTERNAL_PAYMENT_STATUS.PENDING_EXTERNAL,
    };

  } catch (error) {
    console.error('[ExternalPayment] ❌ Error iniciando con Mesta:', error);

    // Marcar como fallido
    await updatePaymentStatus(externalPaymentId, EXTERNAL_PAYMENT_STATUS.FAILED, {
      errorCode: error.code || 'MESTA_ERROR',
      errorMessage: error.message,
    });

    throw error;
  }
}

/**
 * Confirmar pago (Paso 3 - llamado por webhook)
 * - Ejecuta el lock (debita saldo real)
 * - Crea movimiento en ledger
 * - Actualiza estado a settled
 */
export async function confirmPayment(externalPaymentId, webhookData = {}) {
  try {
    console.log('[ExternalPayment] ✅ Confirmando pago:', externalPaymentId);

    // 1. Obtener pago externo
    const payment = await getExternalPayment(externalPaymentId);

    if (!payment) {
      throw new Error('Pago externo no encontrado');
    }

    if (payment.internal_status === EXTERNAL_PAYMENT_STATUS.SETTLED) {
      console.log('[ExternalPayment] ⚠️ Pago ya estaba confirmado');
      return { success: true, alreadySettled: true };
    }

    if (payment.internal_status !== EXTERNAL_PAYMENT_STATUS.PENDING_EXTERNAL) {
      throw new Error(`Estado inválido para confirmar: ${payment.internal_status}`);
    }

    // 2. Ejecutar lock (debitar saldo real)
    const lockResult = await balanceLockService.executeLock(payment.lock_id);

    // 3. Crear movimiento en ledger
    const txHash = `mesta_${Date.now()}_${randomUUID().substring(0, 8)}`;

    // Transacción de débito
    const debitTxId = randomUUID();
    await execute(`
      INSERT INTO doc.transactions (
        id, wallet_id, status_id, amount, tx_hash, created_at
      ) VALUES ($1, $2, 'completed', $3, $4, CURRENT_TIMESTAMP)
    `, [debitTxId, payment.lock_wallet_id, -payment.locked_amount, txHash]);

    // Movimiento de wallet
    await execute(`
      INSERT INTO doc.wallet_movements (
        id, wallet_id, transaction_id, amount,
        balance_before, balance_after,
        metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
    `, [
      randomUUID(),
      payment.lock_wallet_id,
      debitTxId,
      -payment.locked_amount,
      lockResult.balanceBefore,
      lockResult.balanceAfter,
      {
        type: 'external_payment',
        provider: 'mesta',
        external_payment_id: externalPaymentId,
        provider_tx_id: payment.provider_tx_id,
      },
    ]);

    // 4. Si hay destinatario interno, acreditar
    if (payment.to_wallet_id && payment.to_user_id) {
      const creditAmount = payment.converted_amount || payment.amount;

      // Obtener balance destino
      const { rows: toWalletRows } = await execute(`
        SELECT balance FROM doc.wallets WHERE id = $1 LIMIT 1
      `, [payment.to_wallet_id]);

      const toBalanceBefore = parseFloat(toWalletRows[0].balance);
      const toBalanceAfter = toBalanceBefore + creditAmount;

      // Actualizar balance destino
      await execute(`
        UPDATE doc.wallets SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
      `, [toBalanceAfter, payment.to_wallet_id]);

      // Transacción de crédito
      const creditTxId = randomUUID();
      await execute(`
        INSERT INTO doc.transactions (
          id, wallet_id, status_id, amount, tx_hash, created_at
        ) VALUES ($1, $2, 'completed', $3, $4, CURRENT_TIMESTAMP)
      `, [creditTxId, payment.to_wallet_id, creditAmount, txHash]);

      // Movimiento de crédito
      await execute(`
        INSERT INTO doc.wallet_movements (
          id, wallet_id, transaction_id, amount,
          balance_before, balance_after,
          metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      `, [
        randomUUID(),
        payment.to_wallet_id,
        creditTxId,
        creditAmount,
        toBalanceBefore,
        toBalanceAfter,
        {
          type: 'external_payment_received',
          provider: 'mesta',
          external_payment_id: externalPaymentId,
          from_user_id: payment.user_id,
        },
      ]);
    }

    // 5. Actualizar estado del pago externo
    await execute(`
      UPDATE doc.external_payments
      SET internal_status = $1,
          provider_status = $2,
          lock_status = 'executed',
          ledger_tx_hash = $3,
          ledger_executed_at = CURRENT_TIMESTAMP,
          settled_at = CURRENT_TIMESTAMP,
          webhook_received_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `, [
      EXTERNAL_PAYMENT_STATUS.SETTLED,
      PROVIDER_STATUS.SETTLED,
      txHash,
      externalPaymentId,
    ]);

    // 6. Si hay payment_request asociado, actualizarlo
    if (payment.payment_request_id) {
      await execute(`
        UPDATE doc.payment_requests
        SET status = 'approved',
            transaction_hash = $1,
            approved_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [txHash, payment.payment_request_id]);

      await execute('REFRESH TABLE doc.payment_requests');
    }

    // Refresh tables
    await execute('REFRESH TABLE doc.transactions');
    await execute('REFRESH TABLE doc.wallet_movements');
    await execute('REFRESH TABLE doc.wallets');
    await execute('REFRESH TABLE doc.external_payments');

    console.log('[ExternalPayment] ✅ Pago confirmado y ledger actualizado:', txHash);

    return {
      success: true,
      externalPaymentId,
      txHash,
      amount: payment.amount,
      status: EXTERNAL_PAYMENT_STATUS.SETTLED,
    };

  } catch (error) {
    console.error('[ExternalPayment] ❌ Error confirmando pago:', error);
    throw error;
  }
}

/**
 * Marcar pago como fallido (liberar lock)
 */
export async function failPayment(externalPaymentId, reason = 'Payment failed') {
  try {
    console.log('[ExternalPayment] ❌ Marcando pago como fallido:', externalPaymentId);

    const payment = await getExternalPayment(externalPaymentId);

    if (!payment) {
      throw new Error('Pago externo no encontrado');
    }

    // Liberar lock si está activo
    if (payment.lock_id && payment.lock_status === 'active') {
      await balanceLockService.releaseLock(payment.lock_id, reason);
    }

    // Actualizar estado
    await execute(`
      UPDATE doc.external_payments
      SET internal_status = $1,
          provider_status = $2,
          lock_status = 'released',
          error_message = $3,
          failed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `, [
      EXTERNAL_PAYMENT_STATUS.FAILED,
      PROVIDER_STATUS.FAILED,
      reason,
      externalPaymentId,
    ]);

    await execute('REFRESH TABLE doc.external_payments');

    return { success: true, status: EXTERNAL_PAYMENT_STATUS.FAILED };

  } catch (error) {
    console.error('[ExternalPayment] ❌ Error marcando como fallido:', error);
    throw error;
  }
}

/**
 * Cancelar pago
 */
export async function cancelPayment(externalPaymentId, reason = 'Cancelled by user') {
  try {
    console.log('[ExternalPayment] 🚫 Cancelando pago:', externalPaymentId);

    const payment = await getExternalPayment(externalPaymentId);

    if (!payment) {
      throw new Error('Pago externo no encontrado');
    }

    // Solo se puede cancelar si está locked o pending_external
    const cancellableStatuses = [
      EXTERNAL_PAYMENT_STATUS.LOCKED,
      EXTERNAL_PAYMENT_STATUS.PENDING_EXTERNAL,
    ];

    if (!cancellableStatuses.includes(payment.internal_status)) {
      throw new Error(`No se puede cancelar en estado: ${payment.internal_status}`);
    }

    // Cancelar en Mesta si ya se envió
    if (payment.provider_tx_id) {
      try {
        await mestaClient.cancelOrder(payment.provider_tx_id);
      } catch (e) {
        console.warn('[ExternalPayment] ⚠️ Error cancelando en Mesta:', e.message);
      }
    }

    // Liberar lock
    if (payment.lock_id) {
      await balanceLockService.releaseLock(payment.lock_id, reason);
    }

    // Actualizar estado
    await execute(`
      UPDATE doc.external_payments
      SET internal_status = $1,
          lock_status = 'released',
          cancelled_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [EXTERNAL_PAYMENT_STATUS.CANCELLED, externalPaymentId]);

    await execute('REFRESH TABLE doc.external_payments');

    return { success: true, status: EXTERNAL_PAYMENT_STATUS.CANCELLED };

  } catch (error) {
    console.error('[ExternalPayment] ❌ Error cancelando:', error);
    throw error;
  }
}

/**
 * Obtener pago externo por ID
 */
export async function getExternalPayment(externalPaymentId) {
  const { rows } = await execute(`
    SELECT * FROM doc.external_payments WHERE id = $1 LIMIT 1
  `, [externalPaymentId]);

  return rows.length > 0 ? rows[0] : null;
}

/**
 * Obtener pago externo por provider_tx_id (ID de Mesta)
 */
export async function getExternalPaymentByProviderTxId(providerTxId) {
  const { rows } = await execute(`
    SELECT * FROM doc.external_payments WHERE provider_tx_id = $1 LIMIT 1
  `, [providerTxId]);

  return rows.length > 0 ? rows[0] : null;
}

/**
 * Obtener pagos externos de un usuario
 */
export async function getUserExternalPayments(userId, limit = 20) {
  const { rows } = await execute(`
    SELECT * FROM doc.external_payments
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `, [userId, limit]);

  return rows;
}

/**
 * Actualizar estado del pago
 */
async function updatePaymentStatus(externalPaymentId, status, extras = {}) {
  const updates = ['internal_status = $1', 'updated_at = CURRENT_TIMESTAMP'];
  const params = [status];
  let paramIndex = 2;

  if (extras.errorCode) {
    updates.push(`error_code = $${paramIndex}`);
    params.push(extras.errorCode);
    paramIndex++;
  }

  if (extras.errorMessage) {
    updates.push(`error_message = $${paramIndex}`);
    params.push(extras.errorMessage);
    paramIndex++;
  }

  params.push(externalPaymentId);

  await execute(`
    UPDATE doc.external_payments
    SET ${updates.join(', ')}
    WHERE id = $${paramIndex}
  `, params);

  await execute('REFRESH TABLE doc.external_payments');
}

/**
 * Expirar pagos vencidos
 */
export async function expireOldPayments() {
  try {
    const { rows } = await execute(`
      SELECT id, lock_id FROM doc.external_payments
      WHERE internal_status IN ('locked', 'pending_external')
        AND expires_at < CURRENT_TIMESTAMP
    `);

    let expiredCount = 0;

    for (const payment of rows) {
      // Liberar lock
      if (payment.lock_id) {
        await balanceLockService.releaseLock(payment.lock_id, 'Payment expired');
      }

      // Marcar como expirado
      await execute(`
        UPDATE doc.external_payments
        SET internal_status = $1,
            lock_status = 'expired',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [EXTERNAL_PAYMENT_STATUS.EXPIRED, payment.id]);

      expiredCount++;
    }

    if (expiredCount > 0) {
      await execute('REFRESH TABLE doc.external_payments');
      console.log(`[ExternalPayment] ⏰ ${expiredCount} pagos expirados`);
    }

    return { expiredCount };

  } catch (error) {
    console.error('[ExternalPayment] ❌ Error expirando pagos:', error);
    return { expiredCount: 0, error: error.message };
  }
}

export default {
  createExternalPayment,
  initiateWithMesta,
  confirmPayment,
  failPayment,
  cancelPayment,
  getExternalPayment,
  getExternalPaymentByProviderTxId,
  getUserExternalPayments,
  expireOldPayments,
  EXTERNAL_PAYMENT_STATUS,
  PROVIDER_STATUS,
};
