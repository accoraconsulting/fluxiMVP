/**
 * BALANCE LOCK SERVICE
 * Maneja los bloqueos de saldo para evitar doble gasto
 *
 * Flujo:
 * 1. Usuario solicita pago → createLock() → saldo bloqueado
 * 2. Pago confirmado → executeLock() → saldo debitado del ledger
 * 3. Pago fallido/expirado → releaseLock() → saldo liberado
 */

import { execute } from '../../config/crate.js';
import { randomUUID } from 'crypto';
import { mestaConfig } from '../../config/mesta.config.js';

// Estados de lock
export const LOCK_STATUS = {
  ACTIVE: 'active',       // Lock activo, saldo reservado
  EXECUTED: 'executed',   // Lock ejecutado, saldo debitado
  RELEASED: 'released',   // Lock liberado, saldo devuelto
  EXPIRED: 'expired',     // Lock expiró automáticamente
};

/**
 * Crear un lock de saldo
 * @param {Object} params
 * @param {string} params.userId - ID del usuario
 * @param {string} params.walletId - ID de la wallet a bloquear
 * @param {number} params.amount - Monto a bloquear
 * @param {string} params.currency - Moneda
 * @param {string} params.externalPaymentId - ID del pago externo
 * @param {string} params.reason - Motivo del bloqueo
 * @param {number} params.durationMinutes - Duración del lock en minutos
 */
export async function createLock({
  userId,
  walletId,
  amount,
  currency,
  externalPaymentId,
  paymentRequestId = null,
  reason = 'External payment',
  durationMinutes = mestaConfig.lockDurationMinutes,
}) {
  try {
    console.log('[BalanceLock] 🔒 Creando lock de saldo:', { userId, amount, currency });

    // 1. Verificar saldo disponible (saldo actual - locks activos)
    const availableBalance = await getAvailableBalance(userId, walletId);

    if (availableBalance < amount) {
      throw new Error(`Saldo insuficiente. Disponible: ${availableBalance.toFixed(2)} ${currency}, solicitado: ${amount.toFixed(2)} ${currency}`);
    }

    // 2. Calcular expiración
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    // 3. Crear registro de lock
    const lockId = randomUUID();

    await execute(`
      INSERT INTO doc.balance_locks (
        id,
        user_id,
        wallet_id,
        external_payment_id,
        payment_request_id,
        amount,
        currency,
        status,
        reason,
        expires_at,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
    `, [
      lockId,
      userId,
      walletId,
      externalPaymentId,
      paymentRequestId,
      amount,
      currency,
      LOCK_STATUS.ACTIVE,
      reason,
      expiresAt,
    ]);

    await execute('REFRESH TABLE doc.balance_locks');

    console.log('[BalanceLock] ✅ Lock creado:', lockId);

    return {
      success: true,
      lockId,
      amount,
      currency,
      expiresAt,
      availableBalanceAfter: availableBalance - amount,
    };

  } catch (error) {
    console.error('[BalanceLock] ❌ Error creando lock:', error);
    throw error;
  }
}

/**
 * Obtener saldo disponible (saldo - locks activos)
 */
export async function getAvailableBalance(userId, walletId) {
  try {
    // Obtener saldo actual
    const { rows: walletRows } = await execute(`
      SELECT balance FROM doc.wallets WHERE id = $1 AND user_id = $2 LIMIT 1
    `, [walletId, userId]);

    if (walletRows.length === 0) {
      throw new Error('Wallet no encontrada');
    }

    const totalBalance = parseFloat(walletRows[0].balance);

    // Obtener suma de locks activos
    const { rows: lockRows } = await execute(`
      SELECT COALESCE(SUM(amount), 0) as locked_amount
      FROM doc.balance_locks
      WHERE wallet_id = $1
        AND user_id = $2
        AND status = $3
        AND expires_at > CURRENT_TIMESTAMP
    `, [walletId, userId, LOCK_STATUS.ACTIVE]);

    const lockedAmount = parseFloat(lockRows[0].locked_amount) || 0;

    return totalBalance - lockedAmount;

  } catch (error) {
    console.error('[BalanceLock] ❌ Error obteniendo saldo disponible:', error);
    throw error;
  }
}

/**
 * Ejecutar lock (debitar saldo real del ledger)
 * Se llama cuando el webhook confirma el pago
 */
export async function executeLock(lockId, txHash = null) {
  try {
    console.log('[BalanceLock] 💰 Ejecutando lock:', lockId);

    // 1. Obtener lock
    const { rows } = await execute(`
      SELECT * FROM doc.balance_locks WHERE id = $1 LIMIT 1
    `, [lockId]);

    if (rows.length === 0) {
      throw new Error('Lock no encontrado');
    }

    const lock = rows[0];

    // 2. Validar estado
    if (lock.status !== LOCK_STATUS.ACTIVE) {
      throw new Error(`Lock no está activo (estado: ${lock.status})`);
    }

    // 3. Validar que no haya expirado
    if (new Date(lock.expires_at) < new Date()) {
      // Marcar como expirado
      await execute(`
        UPDATE doc.balance_locks
        SET status = $1, released_at = CURRENT_TIMESTAMP, released_reason = 'Expirado'
        WHERE id = $2
      `, [LOCK_STATUS.EXPIRED, lockId]);

      await execute('REFRESH TABLE doc.balance_locks');

      throw new Error('Lock expirado');
    }

    // 4. Debitar saldo real de la wallet
    const { rows: walletRows } = await execute(`
      SELECT balance FROM doc.wallets WHERE id = $1 LIMIT 1
    `, [lock.wallet_id]);

    const currentBalance = parseFloat(walletRows[0].balance);
    const newBalance = currentBalance - parseFloat(lock.amount);

    // 5. Actualizar balance
    await execute(`
      UPDATE doc.wallets
      SET balance = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [newBalance, lock.wallet_id]);

    // 6. Marcar lock como ejecutado
    await execute(`
      UPDATE doc.balance_locks
      SET status = $1, executed_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [LOCK_STATUS.EXECUTED, lockId]);

    await execute('REFRESH TABLE doc.balance_locks');
    await execute('REFRESH TABLE doc.wallets');

    console.log('[BalanceLock] ✅ Lock ejecutado. Balance:', currentBalance, '→', newBalance);

    return {
      success: true,
      lockId,
      amount: parseFloat(lock.amount),
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      walletId: lock.wallet_id,
    };

  } catch (error) {
    console.error('[BalanceLock] ❌ Error ejecutando lock:', error);
    throw error;
  }
}

/**
 * Liberar lock (devolver saldo al disponible)
 * Se llama cuando el pago falla o es cancelado
 */
export async function releaseLock(lockId, reason = 'Released') {
  try {
    console.log('[BalanceLock] 🔓 Liberando lock:', lockId);

    // 1. Obtener lock
    const { rows } = await execute(`
      SELECT * FROM doc.balance_locks WHERE id = $1 LIMIT 1
    `, [lockId]);

    if (rows.length === 0) {
      throw new Error('Lock no encontrado');
    }

    const lock = rows[0];

    // 2. Validar estado
    if (lock.status !== LOCK_STATUS.ACTIVE) {
      console.log(`[BalanceLock] ⚠️ Lock ya no está activo (estado: ${lock.status})`);
      return {
        success: true,
        message: `Lock ya estaba en estado: ${lock.status}`,
        lockId,
      };
    }

    // 3. Marcar como liberado
    await execute(`
      UPDATE doc.balance_locks
      SET status = $1, released_at = CURRENT_TIMESTAMP, released_reason = $2
      WHERE id = $3
    `, [LOCK_STATUS.RELEASED, reason, lockId]);

    await execute('REFRESH TABLE doc.balance_locks');

    console.log('[BalanceLock] ✅ Lock liberado');

    return {
      success: true,
      lockId,
      amount: parseFloat(lock.amount),
      reason,
    };

  } catch (error) {
    console.error('[BalanceLock] ❌ Error liberando lock:', error);
    throw error;
  }
}

/**
 * Obtener lock por ID
 */
export async function getLock(lockId) {
  const { rows } = await execute(`
    SELECT * FROM doc.balance_locks WHERE id = $1 LIMIT 1
  `, [lockId]);

  return rows.length > 0 ? rows[0] : null;
}

/**
 * Obtener lock por external_payment_id
 */
export async function getLockByExternalPayment(externalPaymentId) {
  const { rows } = await execute(`
    SELECT * FROM doc.balance_locks WHERE external_payment_id = $1 LIMIT 1
  `, [externalPaymentId]);

  return rows.length > 0 ? rows[0] : null;
}

/**
 * Obtener locks activos de un usuario
 */
export async function getUserActiveLocks(userId) {
  const { rows } = await execute(`
    SELECT bl.*, w.balance as wallet_balance, a.symbol
    FROM doc.balance_locks bl
    JOIN doc.wallets w ON bl.wallet_id = w.id
    JOIN doc.assets a ON w.asset_id = a.id
    WHERE bl.user_id = $1
      AND bl.status = $2
      AND bl.expires_at > CURRENT_TIMESTAMP
    ORDER BY bl.created_at DESC
  `, [userId, LOCK_STATUS.ACTIVE]);

  return rows;
}

/**
 * Expirar locks vencidos (job automático)
 */
export async function expireOldLocks() {
  try {
    const { rows } = await execute(`
      SELECT id FROM doc.balance_locks
      WHERE status = $1
        AND expires_at < CURRENT_TIMESTAMP
    `, [LOCK_STATUS.ACTIVE]);

    let expiredCount = 0;

    for (const lock of rows) {
      await execute(`
        UPDATE doc.balance_locks
        SET status = $1, released_at = CURRENT_TIMESTAMP, released_reason = 'Auto-expired'
        WHERE id = $2
      `, [LOCK_STATUS.EXPIRED, lock.id]);
      expiredCount++;
    }

    if (expiredCount > 0) {
      await execute('REFRESH TABLE doc.balance_locks');
      console.log(`[BalanceLock] ⏰ ${expiredCount} locks expirados automáticamente`);
    }

    return { expiredCount };

  } catch (error) {
    console.error('[BalanceLock] ❌ Error expirando locks:', error);
    return { expiredCount: 0, error: error.message };
  }
}

/**
 * Obtener resumen de locks por usuario
 */
export async function getUserLocksSummary(userId) {
  const { rows } = await execute(`
    SELECT
      status,
      currency,
      COUNT(*) as count,
      SUM(amount) as total_amount
    FROM doc.balance_locks
    WHERE user_id = $1
    GROUP BY status, currency
  `, [userId]);

  return rows;
}

export default {
  createLock,
  executeLock,
  releaseLock,
  getLock,
  getLockByExternalPayment,
  getAvailableBalance,
  getUserActiveLocks,
  expireOldLocks,
  getUserLocksSummary,
  LOCK_STATUS,
};
