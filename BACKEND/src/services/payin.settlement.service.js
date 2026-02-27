/**
 * PAYIN SETTLEMENT SERVICE
 * Maneja la liquidación de pagos cuando se completan
 *
 * Funciones:
 * - Descontar fondos del wallet
 * - Registrar movimiento en ledger
 * - Actualizar estado del payin
 */

import { execute } from '../config/crate.js';
import { deductBalance } from './wallet.balance.service.js';
import crypto from 'crypto';

/**
 * Liquida un payin completado (descons del wallet)
 * @param {string} payinRequestId - ID del payin_request
 * @param {Object} paymentData - Datos del pago desde webhook
 * @returns {Promise<Object>} Resultado de la liquidación
 */
export async function settlePayinPayment(payinRequestId, paymentData = {}) {
  const txId = crypto.randomUUID();

  try {
    console.log(`[Settlement] Liquidando payin: ${payinRequestId}`);

    // 1. Obtener datos del payin
    const { rows: payinRows } = await execute(
      `SELECT * FROM doc.payin_requests WHERE id = $1`,
      [payinRequestId]
    );

    if (payinRows.length === 0) {
      throw new Error(`Payin no encontrado: ${payinRequestId}`);
    }

    const payin = payinRows[0];
    console.log(`[Settlement] Payin encontrado:`, {
      user_id: payin.user_id,
      amount: payin.amount,
      currency: payin.currency,
    });

    // 2. Obtener wallet del usuario
    const { rows: walletRows } = await execute(
      `SELECT w.* FROM doc.wallets w
       WHERE w.user_id = $1 AND w.is_active = true
       LIMIT 1`,
      [payin.user_id]
    );

    if (walletRows.length === 0) {
      throw new Error(`Wallet no encontrado para usuario: ${payin.user_id}`);
    }

    const wallet = walletRows[0];

    // 3. Descontar fondos
    const balanceResult = await deductBalance(wallet.id, payin.amount, {
      payin_request_id: payinRequestId,
      reason: 'payin_completion',
    });

    console.log(`[Settlement] ✅ Fondos descontados:`, balanceResult);

    // 4. Registrar en ledger
    const ledgerId = crypto.randomUUID();
    await execute(
      `INSERT INTO doc.wallet_movements
       (id, wallet_id, transaction_id, amount, balance_before, balance_after, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        ledgerId,
        wallet.id,
        payinRequestId,
        -payin.amount,
        balanceResult.balance_before,
        balanceResult.balance_after,
      ]
    );

    // 5. Actualizar estado del payin
    await execute(
      `UPDATE doc.payin_requests
       SET status = 'completed', updated_at = NOW()
       WHERE id = $1`,
      [payinRequestId]
    );

    // 6. Actualizar payin_link si existe
    await execute(
      `UPDATE doc.payin_links
       SET status = 'completed', completed_at = NOW()
       WHERE payin_request_id = $1`,
      [payinRequestId]
    );

    console.log(`[Settlement] ✅ Payin liquidado exitosamente`);

    return {
      success: true,
      settlement_id: txId,
      payin_id: payinRequestId,
      user_id: payin.user_id,
      wallet_id: wallet.id,
      amount_deducted: payin.amount,
      currency: payin.currency,
      balance_before: balanceResult.balance_before,
      balance_after: balanceResult.balance_after,
      settled_at: new Date().toISOString(),
    };

  } catch (error) {
    console.error(`[Settlement] ❌ Error liquidando payin:`, error.message);

    // Registrar error para auditoría
    try {
      await execute(
        `UPDATE doc.payin_requests
         SET status = 'settlement_failed', updated_at = NOW()
         WHERE id = $1`,
        [payinRequestId]
      );
    } catch (e) {
      console.error(`[Settlement] Error registrando fallo:`, e.message);
    }

    throw error;
  }
}

/**
 * Revierte un payin (devuelve fondos)
 * @param {string} payinRequestId - ID del payin
 * @param {string} reason - Razón de la reversión
 * @returns {Promise<Object>} Resultado
 */
export async function revertPayinPayment(payinRequestId, reason = 'refund') {
  try {
    console.log(`[Settlement] Revirtiendo payin: ${payinRequestId} - Razón: ${reason}`);

    // Obtener datos del payin
    const { rows: payinRows } = await execute(
      `SELECT * FROM doc.payin_requests WHERE id = $1`,
      [payinRequestId]
    );

    if (payinRows.length === 0) {
      throw new Error(`Payin no encontrado: ${payinRequestId}`);
    }

    const payin = payinRows[0];

    // Obtener wallet
    const { rows: walletRows } = await execute(
      `SELECT w.* FROM doc.wallets w
       WHERE w.user_id = $1 AND w.is_active = true
       LIMIT 1`,
      [payin.user_id]
    );

    if (walletRows.length === 0) {
      throw new Error(`Wallet no encontrado`);
    }

    const wallet = walletRows[0];
    const currentBalance = parseFloat(wallet.balance || 0);
    const newBalance = currentBalance + payin.amount;

    // Devolver fondos
    await execute(
      `UPDATE doc.wallets SET balance = $1, updated_at = NOW() WHERE id = $2`,
      [newBalance, wallet.id]
    );

    // Registrar movimiento
    const movementId = crypto.randomUUID();
    await execute(
      `INSERT INTO doc.wallet_movements
       (id, wallet_id, amount, balance_before, balance_after, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [movementId, wallet.id, payin.amount, currentBalance, newBalance]
    );

    // Actualizar payin
    await execute(
      `UPDATE doc.payin_requests
       SET status = 'refunded', updated_at = NOW()
       WHERE id = $1`,
      [payinRequestId]
    );

    console.log(`[Settlement] ✅ Payin revertido exitosamente`);

    return {
      success: true,
      payin_id: payinRequestId,
      amount_refunded: payin.amount,
      new_balance: newBalance,
      reason: reason,
    };

  } catch (error) {
    console.error(`[Settlement] ❌ Error revirtiendo payin:`, error.message);
    throw error;
  }
}

export default {
  settlePayinPayment,
  revertPayinPayment,
};
