/**
 * WALLET BALANCE SERVICE
 * Servicio modular para validar y actualizar saldos de billeteras
 *
 * Funciones:
 * - Obtener saldo actual
 * - Validar si hay saldo suficiente
 * - Descontar fondos
 * - Agregar fondos
 */

import { execute } from '../config/crate.js';
import crypto from 'crypto';

/**
 * Obtiene el saldo actual de un wallet
 * @param {string} walletId - ID del wallet
 * @returns {Promise<number>} Saldo actual
 */
export async function getWalletBalance(walletId) {
  try {
    const { rows } = await execute(
      `SELECT balance FROM doc.wallets WHERE id = $1`,
      [walletId]
    );

    if (rows.length === 0) {
      throw new Error(`Wallet no encontrado: ${walletId}`);
    }

    return parseFloat(rows[0].balance || 0);
  } catch (error) {
    console.error(`[WalletBalance] Error obteniendo balance:`, error.message);
    throw error;
  }
}

/**
 * Obtiene el primer wallet del usuario (por defecto)
 * @param {string} userId - ID del usuario
 * @param {string} currency - Moneda (USD, COP, etc) - opcional
 * @returns {Promise<Object>} Wallet completo
 */
export async function getUserWallet(userId, currency = null) {
  try {
    let query = `
      SELECT w.* FROM doc.wallets w
      WHERE w.user_id = $1 AND w.is_active = true
    `;
    let params = [userId];

    if (currency) {
      query += ` AND w.asset_id = (SELECT id FROM doc.assets WHERE symbol = $2)`;
      params.push(currency);
    }

    query += ` LIMIT 1`;

    const { rows } = await execute(query, params);

    if (rows.length === 0) {
      throw new Error(`Wallet no encontrado para usuario: ${userId}`);
    }

    return rows[0];
  } catch (error) {
    console.error(`[WalletBalance] Error obteniendo wallet:`, error.message);
    throw error;
  }
}

/**
 * Valida si hay saldo suficiente
 * @param {string} walletId - ID del wallet
 * @param {number} amount - Monto a validar
 * @returns {Promise<boolean>} true si hay saldo
 */
export async function hasSufficientBalance(walletId, amount) {
  try {
    const balance = await getWalletBalance(walletId);
    return balance >= amount;
  } catch (error) {
    console.error(`[WalletBalance] Error validando balance:`, error.message);
    return false;
  }
}

/**
 * Descuenta fondos de un wallet
 * @param {string} walletId - ID del wallet
 * @param {number} amount - Monto a descontar
 * @param {Object} metadata - Metadata de la transacción
 * @returns {Promise<Object>} Resultado con balance_after
 */
export async function deductBalance(walletId, amount, metadata = {}) {
  try {
    console.log(`[WalletBalance] Descontando ${amount} de wallet ${walletId}`);

    // Validar saldo
    const currentBalance = await getWalletBalance(walletId);
    if (currentBalance < amount) {
      throw new Error(
        `Saldo insuficiente. Balance: ${currentBalance}, Requerido: ${amount}`
      );
    }

    // Descontar
    const newBalance = currentBalance - amount;
    await execute(
      `UPDATE doc.wallets SET balance = $1, updated_at = NOW() WHERE id = $2`,
      [newBalance, walletId]
    );

    // Registrar en movimientos
    const movementId = crypto.randomUUID();
    await execute(
      `INSERT INTO doc.wallet_movements (id, wallet_id, amount, balance_before, balance_after, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [movementId, walletId, -amount, currentBalance, newBalance]
    );

    console.log(`[WalletBalance] ✅ Balance actualizado: ${currentBalance} → ${newBalance}`);

    return {
      success: true,
      balance_before: currentBalance,
      balance_after: newBalance,
      amount_deducted: amount,
      movement_id: movementId,
    };
  } catch (error) {
    console.error(`[WalletBalance] ❌ Error descontando balance:`, error.message);
    throw error;
  }
}

/**
 * Agrega fondos a un wallet
 * @param {string} walletId - ID del wallet
 * @param {number} amount - Monto a agregar
 * @param {Object} metadata - Metadata de la transacción
 * @returns {Promise<Object>} Resultado
 */
export async function addBalance(walletId, amount, metadata = {}) {
  try {
    console.log(`[WalletBalance] Agregando ${amount} a wallet ${walletId}`);

    const currentBalance = await getWalletBalance(walletId);
    const newBalance = currentBalance + amount;

    // Agregar fondos
    await execute(
      `UPDATE doc.wallets SET balance = $1, updated_at = NOW() WHERE id = $2`,
      [newBalance, walletId]
    );

    // Registrar movimiento
    const movementId = crypto.randomUUID();
    await execute(
      `INSERT INTO doc.wallet_movements (id, wallet_id, amount, balance_before, balance_after, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [movementId, walletId, amount, currentBalance, newBalance]
    );

    console.log(`[WalletBalance] ✅ Balance actualizado: ${currentBalance} → ${newBalance}`);

    return {
      success: true,
      balance_before: currentBalance,
      balance_after: newBalance,
      amount_added: amount,
      movement_id: movementId,
    };
  } catch (error) {
    console.error(`[WalletBalance] ❌ Error agregando balance:`, error.message);
    throw error;
  }
}

export default {
  getWalletBalance,
  getUserWallet,
  hasSufficientBalance,
  deductBalance,
  addBalance,
};
