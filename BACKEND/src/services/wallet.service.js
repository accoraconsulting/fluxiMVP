/**
 * WALLET SERVICE - LEDGER BANCARIO REAL
 * Sistema de doble entrada para transacciones financieras
 */

import { execute } from '../config/crate.js';
import { randomUUID } from 'crypto';
import { onTransferReceived, onTopupCompleted, onLargeTransaction, onMoneyTransfer } from './notification-events.service.js';

/**
 * ✅ FUNCIÓN CRÍTICA: Asegurar que el usuario tenga todas las wallets activas
 * Se ejecuta automáticamente al obtener wallet del usuario
 */
async function ensureUserWallets(userId) {
  try {
    console.log('[WalletService] 🔍 Verificando wallets para usuario:', userId);

    // 1. Traer todos los assets activos
    const assetsResult = await execute(`
      SELECT id, symbol, name
      FROM doc.assets
      WHERE is_active = true
    `);

    console.log('[WalletService] 📊 Assets activos encontrados:', assetsResult.rows.length);

    for (const asset of assetsResult.rows) {
      // 2. Verificar si ya existe wallet para este asset (sin importar si está activa o bloqueada)
      const exists = await execute(`
        SELECT id, is_active
        FROM doc.wallets
        WHERE user_id = $1
          AND asset_id = $2
        LIMIT 1
      `, [userId, asset.id]);

      // 3. Si no existe NINGUNA wallet (ni activa ni bloqueada), crear nueva
      if (exists.rows.length === 0) {
        console.log(`[WalletService] 🆕 Creando wallet ${asset.symbol} para usuario ${userId}`);

        await execute(`
          INSERT INTO doc.wallets (
            id, user_id, asset_id, address, balance, is_active, created_at
          ) VALUES ($1, $2, $3, $4, 0, true, CURRENT_TIMESTAMP)
        `, [
          randomUUID(),
          userId,
          asset.id,
          `wallet_${userId.substring(0, 8)}_${asset.symbol}`
        ]);

        console.log(`[WalletService] ✅ Wallet ${asset.symbol} creada correctamente`);
      }
    }

    await execute('REFRESH TABLE doc.wallets');
    console.log('[WalletService] ✅ Todas las wallets verificadas/creadas');

  } catch (error) {
    console.error('[WalletService] ❌ Error en ensureUserWallets:', error);
    throw error;
  }
}

/**
 * Obtener wallet PRINCIPAL del usuario (USD)
 */
export async function getUserWallet(userId) {
  try {
    // Asegurar que existan todas las wallets
    await ensureUserWallets(userId);

    // Obtener wallet USD
    const result = await execute(`
      SELECT
        w.id,
        w.user_id,
        w.balance,
        w.asset_id,
        a.symbol,
        a.name,
        a.decimals,
        w.created_at
      FROM doc.wallets w
      JOIN doc.assets a ON w.asset_id = a.id
      WHERE w.user_id = $1
        AND a.symbol = 'USD'
        AND w.is_active = true
      LIMIT 1
    `, [userId]);

    if (result.rows.length === 0) {
      throw new Error('Wallet USD no encontrada');
    }

    return result.rows[0];

  } catch (error) {
    console.error('[WalletService] Error obteniendo wallet USD:', error);
    throw error;
  }
}

/**
 * ✅ OBTENER TODAS LAS WALLETS DEL USUARIO (USD, EUR, COP)
 */
export async function getUserWallets(userId) {
  try {
    console.log('[WalletService] 🔍 Obteniendo wallets del usuario:', userId);

    // Asegurar que existan todas las wallets
    await ensureUserWallets(userId);

    const { rows } = await execute(
      `SELECT 
        w.id,
        w.user_id,
        w.asset_id,
        w.balance,
        w.is_active,
        w.created_at,
        a.symbol,
        a.name,
        a.decimals
       FROM doc.wallets w
       JOIN doc.assets a ON w.asset_id = a.id
       WHERE w.user_id = $1
       ORDER BY a.symbol`,
      [userId]
    );

    console.log('[WalletService] 📊 Wallets encontradas:', rows.length);

    return rows.map(row => ({
      id: row.id,
      asset_id: row.asset_id,
      symbol: row.symbol,
      name: row.name,
      balance: row.balance,
      is_active: row.is_active,
      created_at: row.created_at
    }));

  } catch (error) {
    console.error('[WalletService] ❌ Error obteniendo wallets:', error);
    throw error;
  }
}

/**
 * ⚠️ LEGACY: Crear wallet USD por defecto
 * Ya no se usa directamente. Reemplazada por ensureUserWallets()
 */
async function createDefaultWallet(userId) {
  try {
    // Obtener asset USD (debe existir en la BD)
    const assetResult = await execute(`
      SELECT id, symbol, name 
      FROM doc.assets 
      WHERE symbol = 'USD' 
      LIMIT 1
    `);

    if (assetResult.rows.length === 0) {
      throw new Error('Asset USD no encontrado. Ejecutar seed de assets primero.');
    }

    const asset = assetResult.rows[0];
    const walletId = randomUUID();
    const address = `wallet_${userId.substring(0, 8)}`;

    // Crear wallet
    await execute(`
      INSERT INTO doc.wallets (
        id, user_id, asset_id, address, balance, is_active, created_at
      ) VALUES ($1, $2, $3, $4, 0, true, CURRENT_TIMESTAMP)
    `, [walletId, userId, asset.id, address]);

    // Refrescar para retornar con JOIN
    await execute('REFRESH TABLE doc.wallets');

    return {
      id: walletId,
      user_id: userId,
      balance: 0,
      symbol: asset.symbol,
      name: asset.name,
      created_at: new Date()
    };

  } catch (error) {
    console.error('[WalletService] Error creando wallet:', error);
    throw new Error('Error creando wallet');
  }
}

/**
 * RECARGA DE SALDO (SIMULADO)
 * Simula un depósito bancario/PSE
 */
export async function topUpWallet(userId, amount) {
  // Validaciones
  if (!amount || amount <= 0) {
    throw new Error('El monto debe ser mayor a 0');
  }

  if (amount > 10000000) {
    throw new Error('El monto máximo por transacción es $10,000,000');
  }

  try {
    // 1. Obtener wallet
    const wallet = await getUserWallet(userId);

    // 2. Obtener status "completed"
    const statusResult = await execute(`
      SELECT id FROM doc.transaction_status WHERE id = 'completed' LIMIT 1
    `);

    if (statusResult.rows.length === 0) {
      throw new Error('Status de transacción no configurado');
    }

    const statusId = statusResult.rows[0].id;

    // 3. Calcular balances
    const balanceBefore = parseFloat(wallet.balance);
    const balanceAfter = balanceBefore + amount;

    // 4. Crear transacción
    const transactionId = randomUUID();
    const txHash = `topup_${Date.now()}_${randomUUID().substring(0, 8)}`;

    await execute(`
      INSERT INTO doc.transactions (
        id, wallet_id, status_id, amount, tx_hash, created_at
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    `, [transactionId, wallet.id, statusId, amount, txHash]);

    // 5. Crear movimiento (ledger)
    const movementId = randomUUID();

    await execute(`
      INSERT INTO doc.wallet_movements (
        id, wallet_id, transaction_id, amount, 
        balance_before, balance_after, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    `, [movementId, wallet.id, transactionId, amount, balanceBefore, balanceAfter]);

    // 6. Actualizar balance del wallet
    await execute(`
      UPDATE doc.wallets 
      SET balance = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [balanceAfter, wallet.id]);

    // 7. Refrescar tablas
    await execute('REFRESH TABLE doc.transactions');
    await execute('REFRESH TABLE doc.wallet_movements');
    await execute('REFRESH TABLE doc.wallets');

    console.log(`[WalletService] ✓ TopUp exitoso: $${amount} para usuario ${userId}`);


    // 🔔 Notificación al usuario
        try {
          await onTopupCompleted({
            userId,
            amount,
            currency: 'USD'
          });
        } catch (notifError) {
          console.error('[WalletService] ⚠️ Error enviando notificación (no crítico):', notifError);
        }

    return {
      transactionId,
      walletId: wallet.id,
      amount,
      balanceBefore,
      balanceAfter,
      txHash,
      type: 'topup',
      status: 'completed'
    };

  } catch (error) {
    console.error('[WalletService] Error en topUp:', error);
    throw error;
  }
}

/**
 * PAGO/RETIRO (SIMULADO)
 * Simula un envío a cuenta bancaria externa
 */
export async function payFromWallet(userId, amount, description = 'Pago') {
  // Validaciones
  if (!amount || amount <= 0) {
    throw new Error('El monto debe ser mayor a 0');
  }

  try {
    // 1. Obtener wallet
    const wallet = await getUserWallet(userId);

    // 2. Validar saldo suficiente
    const currentBalance = parseFloat(wallet.balance);
    
    if (currentBalance < amount) {
      throw new Error(`Saldo insuficiente. Disponible: $${currentBalance.toFixed(2)}`);
    }

    // 3. Obtener status "completed"
    const statusResult = await execute(`
      SELECT id FROM doc.transaction_status WHERE id = 'completed' LIMIT 1
    `);

    if (statusResult.rows.length === 0) {
      throw new Error('Status de transacción no configurado');
    }

    const statusId = statusResult.rows[0].id;

    // 4. Calcular balances
    const balanceBefore = currentBalance;
    const balanceAfter = currentBalance - amount;

    // 5. Crear transacción
    const transactionId = randomUUID();
    const txHash = `payment_${Date.now()}_${randomUUID().substring(0, 8)}`;

    await execute(`
      INSERT INTO doc.transactions (
        id, wallet_id, status_id, amount, tx_hash, created_at
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    `, [transactionId, wallet.id, statusId, -amount, txHash]);

    // 6. Crear movimiento (ledger)
    const movementId = randomUUID();

    await execute(`
      INSERT INTO doc.wallet_movements (
        id, wallet_id, transaction_id, amount,
        balance_before, balance_after, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    `, [movementId, wallet.id, transactionId, -amount, balanceBefore, balanceAfter]);

    // 7. Actualizar balance del wallet
    await execute(`
      UPDATE doc.wallets 
      SET balance = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [balanceAfter, wallet.id]);

    // 8. Refrescar tablas
    await execute('REFRESH TABLE doc.transactions');
    await execute('REFRESH TABLE doc.wallet_movements');
    await execute('REFRESH TABLE doc.wallets');

    console.log(`[WalletService] ✓ Pago exitoso: $${amount} para usuario ${userId}`);

    return {
      transactionId,
      walletId: wallet.id,
      amount,
      balanceBefore,
      balanceAfter,
      txHash,
      type: 'payment',
      status: 'completed',
      description
    };

  } catch (error) {
    console.error('[WalletService] Error en payFromWallet:', error);
    throw error;
  }
}

/**
 * OBTENER TRANSACCIONES DEL WALLET
 */
export async function getWalletTransactions(userId, limit = 10) {
  try {
    const wallet = await getUserWallet(userId);

    const result = await execute(`
      SELECT
        t.id,
        t.amount,
        t.tx_hash,
        t.created_at,
        ts.name as status
      FROM doc.transactions t
      JOIN doc.transaction_status ts ON t.status_id = ts.id
      WHERE t.wallet_id = $1
      ORDER BY t.created_at DESC
      LIMIT $2
    `, [wallet.id, limit]);

    return result.rows;

  } catch (error) {
    console.error('[WalletService] Error obteniendo transacciones:', error);
    throw error;
  }
}

/**
 * OBTENER ESTADÍSTICAS DEL WALLET
 */
export async function getWalletStats(userId) {
  try {
    const wallet = await getUserWallet(userId);

    const result = await execute(`
      SELECT
        COUNT(*) as total_transactions,
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_received,
        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_sent
      FROM doc.transactions
      WHERE wallet_id = $1
    `, [wallet.id]);

    const stats = result.rows[0];

    return {
      totalTransactions: parseInt(stats.total_transactions) || 0,
      totalReceived: parseFloat(stats.total_received) || 0,
      totalSent: parseFloat(stats.total_sent) || 0
    };

  } catch (error) {
    console.error('[WalletService] Error obteniendo stats:', error);
    throw error;
  }
}

/**
 * TRANSFERIR DINERO ENTRE USUARIOS (MISMA MONEDA)
 */
export async function transferBetweenUsers(fromUserId, toUserEmail, amount, description = 'Transferencia') {
  if (!amount || amount <= 0) {
    throw new Error('El monto debe ser mayor a 0');
  }

  

  try {
    // 1. Obtener wallet origen
    const fromWallet = await getUserWallet(fromUserId);
    const currentBalance = parseFloat(fromWallet.balance);

    // 2. Validar saldo suficiente
    if (currentBalance < amount) {
      throw new Error(`Saldo insuficiente. Disponible: $${currentBalance.toFixed(2)}`);
    }

    // 3. Obtener usuario destinatario
    const toUserResult = await execute(`
      SELECT id, email, username
      FROM doc.users
      WHERE email = $1
      LIMIT 1
    `, [toUserEmail]);

    if (toUserResult.rows.length === 0) {
      throw new Error('Usuario destinatario no encontrado');
    }

    const toUser = toUserResult.rows[0];

    // 4. Verificar que no sea auto-transferencia
    if (toUser.id === fromUserId) {
      throw new Error('No puedes transferir dinero a ti mismo');
    }

    // 5. Obtener wallet destino
    const toWallet = await getUserWallet(toUser.id);

    // 6. Obtener status "completed"
    const statusResult = await execute(`
      SELECT id FROM doc.transaction_status WHERE id = 'completed' LIMIT 1
    `);

    if (statusResult.rows.length === 0) {
      throw new Error('Status de transacción no configurado');
    }

    const statusId = statusResult.rows[0].id;

    // 7. Generar hash único de transacción
    const txHash = `transfer_${Date.now()}_${randomUUID().substring(0, 8)}`;

    // 8. Calcular balances
    const fromBalanceBefore = currentBalance;
    const fromBalanceAfter = currentBalance - amount;
    const toBalanceBefore = parseFloat(toWallet.balance);
    const toBalanceAfter = toBalanceBefore + amount;

    // 9. Débito (usuario que envía)
    const debitTxId = randomUUID();

     

    await execute(`
      INSERT INTO doc.transactions (
        id, wallet_id, status_id, amount, tx_hash, created_at
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    `, [debitTxId, fromWallet.id, statusId, -amount, txHash]);

    await execute(`
      INSERT INTO doc.wallet_movements (
        id, wallet_id, transaction_id, amount,
        balance_before, balance_after, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    `, [randomUUID(), fromWallet.id, debitTxId, -amount, fromBalanceBefore, fromBalanceAfter]);

    await execute(`
      UPDATE doc.wallets 
      SET balance = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [fromBalanceAfter, fromWallet.id]);

    // 10. Crédito (usuario que recibe)
    const creditTxId = randomUUID();

    await execute(`
      INSERT INTO doc.transactions (
        id, wallet_id, status_id, amount, tx_hash, created_at
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    `, [creditTxId, toWallet.id, statusId, amount, txHash]);

    await execute(`
      INSERT INTO doc.wallet_movements (
        id, wallet_id, transaction_id, amount,
        balance_before, balance_after, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    `, [randomUUID(), toWallet.id, creditTxId, amount, toBalanceBefore, toBalanceAfter]);

    await execute(`
      UPDATE doc.wallets 
      SET balance = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [toBalanceAfter, toWallet.id]);

    // 11. Refrescar tablas
    await execute('REFRESH TABLE doc.transactions');
    await execute('REFRESH TABLE doc.wallet_movements');
    await execute('REFRESH TABLE doc.wallets');

    console.log(`[WalletService] ✓ Transferencia exitosa: $${amount} de ${fromUserId} a ${toUser.email}`);

 
   
    try {
      const { rows: fromUserRows } = await execute(
        `SELECT email FROM doc.users WHERE id = $1 LIMIT 1`,
        [fromUserId]
      );
      
      // Llamar función universal que notifica a TODOS
      await onMoneyTransfer({
        fromUserId,
        toUserId: toUser.id,
        fromUserEmail: fromUserRows[0].email,
        toUserEmail: toUser.email,
        amount,
        currency: 'USD',
        description,
        transactionHash: txHash,
        transactionType: 'transfer'
      });
    } catch (e) { console.error('[WalletService] ⚠️', e); }


      //  Notificación a admins si es transacción grande
      try {
        if (amount > 10000) {
          await onLargeTransaction({
            amount,
            currency: 'USD',
            fromEmail: toUserEmail,
            toEmail: toUser.email,
            txHash
          });
        }
      } catch (notifError) {
        console.error('[WalletService] ⚠️ Error enviando notificación a admins:', notifError);
      }


    return {
      txHash,
      amount,
      fromBalanceBefore,
      fromBalanceAfter,
      toBalanceBefore,
      toBalanceAfter,
      toUser: {
        id: toUser.id,
        email: toUser.email,
        username: toUser.username
      },
      type: 'transfer',
      status: 'completed',
      description
    };

  
    
    
  } catch (error) {
    console.error('[WalletService] Error en transferBetweenUsers:', error);
    throw error;
  }

 

}

/**
 * OBTENER MOVIMIENTOS DETALLADOS
 */
/**
 * FUNCIÓN MEJORADA: getDetailedMovements
 * Incluye información del destinatario/origen
 * 
 */
export async function getDetailedMovements(userId, options = {}) {
  try {
    const { limit = 50, type = 'all', currency = 'all' } = options;

    // Query mejorado con información del destinatario/origen
    let query = `
      SELECT
        wm.id,
        wm.amount,
        wm.balance_before,
        wm.balance_after,
        wm.created_at,
        t.tx_hash,
        t.status_id,
        a.symbol as currency,
        a.name as currency_name,
        
        -- Información del destinatario/origen
        CASE
          WHEN wm.amount > 0 THEN other_u.id
          ELSE NULL
        END as from_user_id,
        
        CASE
          WHEN wm.amount < 0 THEN other_u.id
          ELSE NULL
        END as to_user_id,
        
        other_u.email as other_user_email,
        other_u.username as other_user_username
        
      FROM doc.wallet_movements wm
      JOIN doc.transactions t ON wm.transaction_id = t.id
      JOIN doc.wallets w ON wm.wallet_id = w.id
      JOIN doc.assets a ON w.asset_id = a.id
      
      -- JOIN para encontrar la transacción relacionada (mismo tx_hash, wallet diferente)
      LEFT JOIN doc.transactions other_t 
        ON other_t.tx_hash = t.tx_hash 
        AND other_t.wallet_id != w.id
      LEFT JOIN doc.wallets other_w 
        ON other_t.wallet_id = other_w.id
      LEFT JOIN doc.users other_u 
        ON other_w.user_id = other_u.id
      
      WHERE w.user_id = $1
    `;

    const params = [userId];
    let paramIndex = 2;

    // Filtro por tipo
    if (type !== 'all') {
      if (type === 'transfer_in') {
        query += ` AND wm.amount > 0`;
      } else if (type === 'transfer_out') {
        query += ` AND wm.amount < 0`;
      }
    }

    // Filtro por moneda
    if (currency !== 'all') {
      query += ` AND a.symbol = $${paramIndex}`;
      params.push(currency);
      paramIndex++;
    }

    query += ` ORDER BY wm.created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await execute(query, params);

    // Procesar resultados para formato consistente
    const movements = result.rows.map(row => {
      const isIncoming = parseFloat(row.amount) > 0;
      
      return {
        id: row.id,
        amount: parseFloat(row.amount),
        balanceBefore: parseFloat(row.balance_before),
        balanceAfter: parseFloat(row.balance_after),
        createdAt: row.created_at,
        txHash: row.tx_hash,
        statusId: row.status_id,
        status: row.status_id === 'completed' ? 'Completado' : row.status_id,
        currency: row.currency,
        symbol: row.currency,
        currencyName: row.currency_name,
        
        // Tipo de transacción
        type: isIncoming ? 'transfer_in' : 'transfer_out',
        
        // Información del destinatario/origen
        recipient: row.other_user_email ? {
          id: isIncoming ? row.from_user_id : row.to_user_id,
          email: row.other_user_email,
          username: row.other_user_username,
          name: row.other_user_username || row.other_user_email
        } : null
      };
    });

    return movements;

  } catch (error) {
    console.error('[WalletService] Error obteniendo movimientos detallados:', error);
    throw error;
  }
}

/**
 * TRANSFERENCIA MULTI-MONEDA CON CONVERSIÓN
 */
export async function transferMultiCurrency(
  fromUserId,
  toUserEmail,
  fromWalletId,
  toWalletId,
  amount,
  fromCurrency,
  toCurrency,
  convertedAmount,
  exchangeRate,
  commission = 0,
  description = 'Transferencia multi-moneda'
) {
  console.log('[WalletService] 🚀 Iniciando transferencia multi-moneda:', {
    fromUserId,
    toUserEmail,
    amount,
    fromCurrency,
    toCurrency,
    convertedAmount,
    exchangeRate,
    commission
  });

  try {
    // 1. Validar montos
    if (amount <= 0) {
      throw new Error('El monto debe ser mayor a 0');
    }

    if (convertedAmount <= 0) {
      throw new Error('El monto convertido debe ser mayor a 0');
    }

    // 2. Obtener wallet origen
    const { rows: fromWalletRows } = await execute(
      `SELECT w.id, w.balance, a.symbol
       FROM doc.wallets w
       JOIN doc.assets a ON w.asset_id = a.id
       WHERE w.id = $1 AND w.user_id = $2
       LIMIT 1`,
      [fromWalletId, fromUserId]
    );

    if (fromWalletRows.length === 0) {
      throw new Error('Wallet de origen no encontrada');
    }

    const fromWallet = fromWalletRows[0];
    const fromBalance = parseFloat(fromWallet.balance);
    const totalDebit = amount + commission;

    console.log('[WalletService] 💰 Wallet origen:', {
      balance: fromBalance,
      debit: amount,
      commission,
      total: totalDebit
    });

    // 3. Validar saldo suficiente
    if (fromBalance < totalDebit) {
      throw new Error(`Saldo insuficiente. Disponible: ${fromBalance.toFixed(2)} ${fromCurrency}, necesitas: ${totalDebit.toFixed(2)} ${fromCurrency}`);
    }

    // 4. Obtener usuario destinatario
    const { rows: toUserRows } = await execute(
      `SELECT id, email, username
       FROM doc.users
       WHERE email = $1
       LIMIT 1`,
      [toUserEmail]
    );

    if (toUserRows.length === 0) {
      throw new Error('Usuario destinatario no encontrado');
    }

    const toUser = toUserRows[0];

    // 5. Verificar que no sea auto-transferencia
    if (toUser.id === fromUserId) {
      throw new Error('No puedes transferir dinero a ti mismo');
    }

    // 6. Obtener wallet destino
    const { rows: toWalletRows } = await execute(
      `SELECT w.id, w.balance, a.symbol
       FROM doc.wallets w
       JOIN doc.assets a ON w.asset_id = a.id
       WHERE w.id = $1 AND w.user_id = $2
       LIMIT 1`,
      [toWalletId, toUser.id]
    );

    if (toWalletRows.length === 0) {
      throw new Error('Wallet de destino no encontrada');
    }

    const toWallet = toWalletRows[0];

    // 7. Obtener status "completed"
    const { rows: statusRows } = await execute(
      `SELECT id FROM doc.transaction_status WHERE id = 'completed' LIMIT 1`
    );

    if (statusRows.length === 0) {
      throw new Error('Status de transacción no configurado');
    }

    const statusId = statusRows[0].id;

    // 8. Generar hash único de transacción
    const txHash = `transfer_multi_${Date.now()}_${randomUUID().substring(0, 8)}`;

    console.log('[WalletService] 🔐 TxHash generado:', txHash);

    // ==========================================
    // DÉBITO (usuario que envía)
    // ==========================================
    const fromBalanceBefore = fromBalance;
    const fromBalanceAfter = fromBalance - totalDebit;
    const debitTxId = randomUUID();

    await execute(
      `INSERT INTO doc.transactions (
        id, wallet_id, status_id, amount, tx_hash, created_at
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [debitTxId, fromWalletId, statusId, -totalDebit, txHash]
    );

    await execute(
      `INSERT INTO doc.wallet_movements (
        id, wallet_id, transaction_id, amount,
        balance_before, balance_after,
        movement_type, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
      [
        randomUUID(),
        fromWalletId,
        debitTxId,
        -totalDebit,
        fromBalanceBefore,
        fromBalanceAfter,
        'transfer_out'
      ]
    );

    await execute(
      `UPDATE doc.wallets 
       SET balance = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [fromBalanceAfter, fromWalletId]
    );

    console.log('[WalletService] ✅ Débito OK:', -totalDebit);

    // ==========================================
    // REGISTRAR COMISIÓN EN WALLET DEL SISTEMA
    // ==========================================
    if (commission > 0) {
      try {
        const { recordCommission } = await import('./commission.service.js');
        
        await recordCommission(
          fromUserId,
          commission,
          fromCurrency,
          'transfer_multi',
          txHash,
          {
            from_user_id: fromUserId,
            to_user_id: toUser.id,
            to_user_email: toUser.email,
            original_amount: amount,
            converted_amount: convertedAmount,
            from_currency: fromCurrency,
            to_currency: toCurrency,
            exchange_rate: exchangeRate
          }
        );

        console.log('[WalletService] 💰 Comisión registrada en sistema:', commission, fromCurrency);

      } catch (commError) {
        console.error('[WalletService] ⚠️ Error registrando comisión (no crítico):', commError);
        // No fallar la transferencia si falla el registro de comisión
      }
    }

    console.log('[WalletService] ✅ Débito completado:', {
      from: fromCurrency,
      amount,
      commission,
      newBalance: fromBalanceAfter
    });

    // ==========================================
    // CRÉDITO (usuario que recibe)
    // ==========================================
    const toBalanceBefore = parseFloat(toWallet.balance);
    const toBalanceAfter = toBalanceBefore + convertedAmount;
    const creditTxId = randomUUID();

    await execute(
      `INSERT INTO doc.transactions (
        id, wallet_id, status_id, amount, tx_hash, created_at
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [creditTxId, toWalletId, statusId, convertedAmount, txHash]
    );

    await execute(
      `INSERT INTO doc.wallet_movements (
        id, wallet_id, transaction_id, amount,
        balance_before, balance_after,
        movement_type, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
      [
        randomUUID(),
        toWalletId,
        creditTxId,
        convertedAmount,
        toBalanceBefore,
        toBalanceAfter,
        'transfer_in'
      ]
    );

    await execute(
      `UPDATE doc.wallets 
       SET balance = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [toBalanceAfter, toWalletId]
    );

    console.log('[WalletService] ✅ Crédito completado:', {
      to: toCurrency,
      amount: convertedAmount,
      newBalance: toBalanceAfter
    });

    // ==========================================
    // REFRESCAR TABLAS
    // ==========================================
    await execute('REFRESH TABLE doc.transactions');
    await execute('REFRESH TABLE doc.wallet_movements');
    await execute('REFRESH TABLE doc.wallets');

    console.log('[WalletService] ✅ Transferencia multi-moneda completada:', txHash);

    // ==========================================
    // RETORNAR RESULTADO
    // ==========================================
    return {
      txHash,
      fromAmount: amount,
      toAmount: convertedAmount,
      fromCurrency,
      toCurrency,
      exchangeRate,
      commission,
      fromBalanceBefore,
      fromBalanceAfter,
      toBalanceBefore,
      toBalanceAfter,
      toUser: {
        id: toUser.id,
        email: toUser.email,
        username: toUser.username
      },
      type: 'transfer_multi',
      status: 'completed',
      description
    };

  } catch (error) {
    console.error('[WalletService] ❌ Error:', error);
    throw error;
  }
}