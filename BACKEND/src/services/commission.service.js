/**
 * COMMISSION SERVICE
 * Gestión de comisiones del sistema
 */

import { execute } from '../config/crate.js';
import { randomUUID } from 'crypto';

// IDs de las wallets del sistema (hardcoded para performance)
const SYSTEM_WALLETS = {
  'USD': '10000000-0000-0000-0000-000000000001',
  'EUR': '10000000-0000-0000-0000-000000000002',
  'COP': '10000000-0000-0000-0000-000000000003',
  'BTC': '10000000-0000-0000-0000-000000000004',
  'ETH': '10000000-0000-0000-0000-000000000005',
  'USDT': '10000000-0000-0000-0000-000000000006'
};

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Registrar comisión en la wallet del sistema
 */
export async function recordCommission(
  fromUserId,
  amount,
  currency,
  transactionType,
  relatedTxHash,
  metadata = {}
) {
  try {
    const systemWalletId = SYSTEM_WALLETS[currency];

    if (!systemWalletId) {
      throw new Error(`No existe wallet del sistema para la moneda: ${currency}`);
    }

    console.log('[CommissionService] 💰 Registrando comisión:', {
      amount,
      currency,
      systemWalletId,
      type: transactionType
    });

    // 1. Obtener balance actual de la wallet del sistema
    const { rows: walletRows } = await execute(
      `SELECT id, balance 
       FROM doc.wallets 
       WHERE id = $1 AND is_active = true 
       LIMIT 1`,
      [systemWalletId]
    );

    if (walletRows.length === 0) {
      throw new Error(`Wallet del sistema no encontrada para ${currency}`);
    }

    const systemWallet = walletRows[0];
    const balanceBefore = parseFloat(systemWallet.balance);
    const balanceAfter = balanceBefore + amount;

    // 2. Obtener status completado
    const { rows: statusRows } = await execute(
      `SELECT id FROM doc.transaction_status WHERE id = 'completed' LIMIT 1`
    );

    if (statusRows.length === 0) {
      throw new Error('Status completed no existe');
    }

    const statusId = statusRows[0].id;
    const commissionTxId = randomUUID();
    const txHash = `commission_${Date.now()}_${commissionTxId.substring(0, 8)}`;

    // 3. Crear transacción de comisión
    await execute(
      `INSERT INTO doc.transactions (
        id, wallet_id, status_id, amount, tx_hash, created_at
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [commissionTxId, systemWalletId, statusId, amount, txHash]
    );

    // 4. Crear movimiento en wallet del sistema
    await execute(
      `INSERT INTO doc.wallet_movements (
        id, wallet_id, transaction_id, amount,
        balance_before, balance_after,
        movement_type, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
      [
        randomUUID(),
        systemWalletId,
        commissionTxId,
        amount,
        balanceBefore,
        balanceAfter,
        'commission'
      ]
    );

    // 5. Actualizar balance de la wallet del sistema
    await execute(
      `UPDATE doc.wallets 
       SET balance = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [balanceAfter, systemWalletId]
    );

    // 6. Refrescar tablas
    await execute('REFRESH TABLE doc.transactions');
    await execute('REFRESH TABLE doc.wallet_movements');
    await execute('REFRESH TABLE doc.wallets');

    console.log('[CommissionService] ✅ Comisión registrada:', {
      amount,
      currency,
      balanceBefore,
      balanceAfter,
      txHash
    });

    return {
      commissionTxId,
      txHash,
      amount,
      currency,
      balanceBefore,
      balanceAfter
    };

  } catch (error) {
    console.error('[CommissionService] ❌ Error registrando comisión:', error);
    throw error;
  }
}

/**
 * Obtener estadísticas de comisiones
 */
export async function getCommissionStats(currency = null) {
  try {
    let query = `
      SELECT 
        a.symbol as currency,
        w.balance as total_collected,
        COUNT(wm.id) as total_transactions
      FROM doc.wallets w
      JOIN doc.assets a ON w.asset_id = a.id
      LEFT JOIN doc.wallet_movements wm ON w.id = wm.wallet_id
      WHERE w.user_id = $1
        AND w.is_active = true
    `;

    const params = [SYSTEM_USER_ID];

    if (currency) {
      query += ` AND a.symbol = $2`;
      params.push(currency);
    }

    query += `
      GROUP BY a.symbol, w.balance
      ORDER BY w.balance DESC
    `;

    const { rows } = await execute(query, params);

    return rows.map(r => ({
      currency: r.currency,
      totalCollected: parseFloat(r.total_collected),
      totalTransactions: parseInt(r.total_transactions)
    }));

  } catch (error) {
    console.error('[CommissionService] Error obteniendo stats:', error);
    throw new Error('Error obteniendo estadísticas de comisiones');
  }
}

/**
 * Obtener historial de comisiones
 */
export async function getCommissionHistory(limit = 50, currency = null) {
  try {
    let query = `
      SELECT
        wm.created_at,
        wm.amount,
        wm.balance_after,
        wm.movement_type,
        a.symbol as currency,
        t.tx_hash
      FROM doc.wallet_movements wm
      JOIN doc.wallets w ON wm.wallet_id = w.id
      JOIN doc.assets a ON w.asset_id = a.id
      JOIN doc.transactions t ON wm.transaction_id = t.id
      WHERE w.user_id = $1
        AND w.is_active = true
    `;

    const params = [SYSTEM_USER_ID];

    if (currency) {
      query += ` AND a.symbol = $2`;
      params.push(currency);
    }

    query += `
      ORDER BY wm.created_at DESC
      LIMIT $${params.length + 1}
    `;

    params.push(limit);

    const { rows } = await execute(query, params);

    return rows.map(r => ({
      timestamp: r.created_at,
      amount: parseFloat(r.amount),
      balanceAfter: parseFloat(r.balance_after),
      currency: r.currency,
      txHash: r.tx_hash,
      movementType: r.movement_type
    }));

  } catch (error) {
    console.error('[CommissionService] Error obteniendo historial:', error.message || error);
    throw new Error(`Error obteniendo historial de comisiones: ${error.message || error}`);
  }
}

/**
 * Obtener balance total del sistema por moneda
 */
export async function getSystemBalances() {
  try {
    const { rows } = await execute(
      `SELECT 
        a.symbol as currency,
        a.name as currency_name,
        w.balance,
        w.updated_at as last_update
      FROM doc.wallets w
      JOIN doc.assets a ON w.asset_id = a.id
      WHERE w.user_id = $1
        AND w.is_active = true
      ORDER BY 
        CASE a.symbol
          WHEN 'USD' THEN 1
          WHEN 'EUR' THEN 2
          WHEN 'COP' THEN 3
          WHEN 'BTC' THEN 4
          WHEN 'ETH' THEN 5
          WHEN 'USDT' THEN 6
          ELSE 7
        END`,
      [SYSTEM_USER_ID]
    );

    return rows.map(r => ({
      currency: r.currency,
      currencyName: r.currency_name,
      balance: parseFloat(r.balance),
      lastUpdate: r.last_update
    }));

  } catch (error) {
    console.error('[CommissionService] Error obteniendo balances:', error);
    throw new Error('Error obteniendo balances del sistema');
  }
}