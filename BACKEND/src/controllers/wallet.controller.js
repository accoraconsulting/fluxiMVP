/**
 * WALLET CONTROLLER
 * Endpoints REST para manejo de wallets
 */

import {
  getUserWallet,
  getUserWallets,
  topUpWallet,
  payFromWallet,
  getWalletTransactions,
  getWalletStats,
  transferBetweenUsers,
  getDetailedMovements  // ← NUEVO
} from '../services/wallet.service.js';

/**
 * GET /api/wallet
 * Obtener información del wallet del usuario autenticado
 */
export async function getWallet(req, res) {
  try {
    const userId = req.user.id;

    const wallet = await getUserWallet(userId);
    const stats = await getWalletStats(userId);

    res.json({
      success: true,
      data: {
        id: wallet.id,
        balance: parseFloat(wallet.balance),
        currency: wallet.symbol,
        currencyName: wallet.name,
        stats: {
          totalTransactions: stats.totalTransactions,
          totalReceived: stats.totalReceived,
          totalSent: stats.totalSent
        },
        createdAt: wallet.created_at
      }
    });

  } catch (error) {
    console.error('[WalletController] Error en getWallet:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo wallet'
    });
  }
}

/**
 * GET /api/wallet/movements
 * Obtener todos los movimientos detallados del usuario
 * 
 * Query: ?limit=50&type=all&currency=USD
 */
export async function getMovements(req, res) {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    const type = req.query.type || 'all'; // all | topup | payment | transfer
    const currency = req.query.currency || 'all'; // USD | EUR | COP | all

    const movements = await getDetailedMovements(userId, { limit, type, currency });

    res.json({
      success: true,
      data: movements,
      count: movements.length
    });

  } catch (error) {
    console.error('[WalletController] Error en getMovements:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo movimientos'
    });
  }
}


/**
 * POST /api/wallet/topup
 * Recargar saldo (simulado)
 * 
 * Body: { amount: number }
 */
export async function topUp(req, res) {
  try {
    const userId = req.user.id;
    const { amount } = req.body;

    // Validar input
    if (!amount) {
      return res.status(400).json({
        success: false,
        error: 'El campo "amount" es requerido'
      });
    }

    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'El monto debe ser un número mayor a 0'
      });
    }

    // Ejecutar recarga
    const result = await topUpWallet(userId, numAmount);

    res.json({
      success: true,
      message: `Recarga exitosa de $${numAmount.toFixed(2)}`,
      data: {
        transactionId: result.transactionId,
        amount: result.amount,
        balanceBefore: result.balanceBefore,
        balanceAfter: result.balanceAfter,
        txHash: result.txHash,
        type: result.type,
        status: result.status
      }
    });

  } catch (error) {
    console.error('[WalletController] Error en topUp:', error);
    
    // Errores de negocio (400)
    if (error.message.includes('monto')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    // Errores del servidor (500)
    res.status(500).json({
      success: false,
      error: error.message || 'Error procesando recarga'
    });
  }
}

/**
 * POST /api/wallet/pay
 * Realizar pago/retiro (simulado)
 * 
 * Body: { amount: number, description?: string }
 */
export async function pay(req, res) {
  try {
    const userId = req.user.id;
    const { amount, description } = req.body;

    // Validar input
    if (!amount) {
      return res.status(400).json({
        success: false,
        error: 'El campo "amount" es requerido'
      });
    }

    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'El monto debe ser un número mayor a 0'
      });
    }

    // Ejecutar pago
    const result = await payFromWallet(userId, numAmount, description);

    res.json({
      success: true,
      message: `Pago exitoso de $${numAmount.toFixed(2)}`,
      data: {
        transactionId: result.transactionId,
        amount: result.amount,
        balanceBefore: result.balanceBefore,
        balanceAfter: result.balanceAfter,
        txHash: result.txHash,
        type: result.type,
        status: result.status,
        description: result.description
      }
    });

  } catch (error) {
    console.error('[WalletController] Error en pay:', error);
    
    // Saldo insuficiente (400)
    if (error.message.includes('Saldo insuficiente') || error.message.includes('monto')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    // Errores del servidor (500)
    res.status(500).json({
      success: false,
      error: error.message || 'Error procesando pago'
    });
  }
}

/**
 * GET /api/wallet/transactions
 * Obtener historial de transacciones
 * 
 * Query: ?limit=10
 */
export async function getTransactions(req, res) {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;

    // Validar límite
    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        error: 'El límite debe estar entre 1 y 100'
      });
    }

    const transactions = await getWalletTransactions(userId, limit);

    res.json({
      success: true,
      data: transactions,
      count: transactions.length
    });

  } catch (error) {
    console.error('[WalletController] Error en getTransactions:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo transacciones'
    });
  }
}
/**
 * GET /api/wallet/all
 * Obtener TODAS las wallets del usuario (USD, EUR, COP)
 */
export async function getWallets(req, res) {
  try {
    const userId = req.user.id;

    console.log('[WalletController] 🔍 Usuario solicitando wallets:', userId);

    const wallets = await getUserWallets(userId);

    console.log('[WalletController] 📊 Wallets obtenidas (raw):', wallets.length);

    // 🔒 PASO 1: MAPEAR Y NORMALIZAR BOOLEANOS
    const mappedWallets = wallets.map(w => {
      let isActive = true; // Por defecto, activa
      if (w.is_active === false || w.is_active === 0 || w.is_active === 'false') {
        isActive = false;
      }

      return {
        id: w.id,
        assetId: w.asset_id,
        symbol: w.symbol,
        name: w.name,
        balance: parseFloat(w.balance),
        isActive: isActive,
        createdAt: w.created_at
      };
    });

    // 🔒 PASO 2: DEDUPLICAR POR SYMBOL - MANTENER ACTIVA, LUEGO PRIMERA
    const deduplicatedMap = new Map();
    for (const wallet of mappedWallets) {
      const key = wallet.symbol;

      if (!deduplicatedMap.has(key)) {
        // Primera vez que vemos este symbol
        deduplicatedMap.set(key, wallet);
      } else {
        // Ya existe, mantener la activa si la nueva es activa
        const existing = deduplicatedMap.get(key);
        if (wallet.isActive === true && existing.isActive === false) {
          // Reemplazar por la activa
          deduplicatedMap.set(key, wallet);
        }
        // Si ambas están activas o ambas inactivas, mantener la primera
      }
    }

    const finalWallets = Array.from(deduplicatedMap.values());

    console.log('[WalletController] ✅ DEDUPLICACIÓN:');
    console.log(`  📥 Entrada: ${mappedWallets.length} wallets`);
    console.log(`  📤 Salida: ${finalWallets.length} wallets`);
    finalWallets.forEach(w => {
      const status = w.isActive ? '✅ ACTIVA' : '🔒 BLOQUEADA';
      console.log(`  ${w.symbol}: ${status}`);
    });

    res.json({
      success: true,
      data: finalWallets
    });

  } catch (error) {
    console.error('[WalletController] ❌ Error en getWallets:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo wallets'
    });
  }
}


/**
 * POST /api/wallet/cleanup-duplicates
 * 🧹 LIMPIAR WALLETS DUPLICADAS (Solo Admin)
 */
export async function cleanupDuplicateWallets(req, res) {
  try {
    const userId = req.user.id;

    // 🔒 Verificar que sea admin
    if (req.user.role !== 'fluxiAdmin' && req.user.role !== 'fluxiDev') {
      return res.status(403).json({
        success: false,
        error: 'Solo admins pueden limpiar duplicados'
      });
    }

    const timestamp = new Date().toLocaleTimeString('es-ES');
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`⏰ [${timestamp}] 🧹 INICIANDO LIMPIEZA DE DUPLICADOS`);

    // 1️⃣ Identificar duplicados
    const { rows: duplicates } = await execute(`
      SELECT user_id, asset_id, COUNT(*) as cantidad
      FROM doc.wallets
      GROUP BY user_id, asset_id
      HAVING COUNT(*) > 1
    `);

    console.log(`  📊 Grupos duplicados encontrados: ${duplicates.length}`);
    duplicates.forEach(d => {
      console.log(`    - User ${d.user_id.substring(0, 8)}...: Asset ${d.asset_id.substring(0, 8)}... (${d.cantidad} wallets)`);
    });

    // 2️⃣ Eliminar duplicados (mantener el más nuevo)
    const { rowCount } = await execute(`
      DELETE FROM doc.wallets
      WHERE id NOT IN (
        SELECT id FROM (
          SELECT id,
                 ROW_NUMBER() OVER (PARTITION BY user_id, asset_id ORDER BY created_at DESC) as rn
          FROM doc.wallets
        ) t
        WHERE rn = 1
      )
    `);

    console.log(`  🗑️ Wallets duplicadas eliminadas: ${rowCount}`);

    // 3️⃣ Verificar resultado
    const { rows: remaining } = await execute(`
      SELECT user_id, asset_id, COUNT(*) as cantidad
      FROM doc.wallets
      GROUP BY user_id, asset_id
      HAVING COUNT(*) > 1
    `);

    if (remaining.length === 0) {
      console.log(`  ✅ LIMPIEZA COMPLETADA: No hay más duplicados`);
    } else {
      console.log(`  ⚠️ ADVERTENCIA: Aún hay ${remaining.length} grupos duplicados`);
    }

    console.log(`✅ LIMPIEZA DE DUPLICADOS COMPLETADA\n`);

    res.json({
      success: true,
      message: `Limpieza completada. Eliminadas ${rowCount} wallets duplicadas`,
      duplicatesFound: duplicates.length,
      walletsDeleted: rowCount,
      duplicatesRemaining: remaining.length
    });

  } catch (error) {
    const timestamp = new Date().toLocaleTimeString('es-ES');
    console.error(`\n❌ [${timestamp}] ERROR EN CLEANUP:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Error limpiando duplicados'
    });
  }
}

/**
 * POST /api/wallet/transfer
 * Transferir dinero a otro usuario
 *
 * Body: { toUserEmail: string, amount: number, description?: string }
 */
export async function transfer(req, res) {
  try {
    const fromUserId = req.user.id;
    const { toUserEmail, amount, description } = req.body;

    // Validar inputs
    if (!toUserEmail) {
      return res.status(400).json({
        success: false,
        error: 'El email del destinatario es requerido'
      });
    }

    if (!amount) {
      return res.status(400).json({
        success: false,
        error: 'El monto es requerido'
      });
    }

    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'El monto debe ser un número mayor a 0'
      });
    }

    // Ejecutar transferencia
    const result = await transferBetweenUsers(fromUserId, toUserEmail, numAmount, description);

    res.json({
      success: true,
      message: `Transferencia exitosa de $${numAmount.toFixed(2)} a ${result.toUser.email}`,
      data: {
        txHash: result.txHash,
        amount: result.amount,
        balanceBefore: result.fromBalanceBefore,
        balanceAfter: result.fromBalanceAfter,
        recipient: {
          email: result.toUser.email,
          username: result.toUser.username
        },
        type: result.type,
        status: result.status,
        description: result.description
      }
    });

  } catch (error) {
    console.error('[WalletController] Error en transfer:', error);
    
    // Errores de negocio (400)
    if (
      error.message.includes('Saldo insuficiente') ||
      error.message.includes('no encontrado') ||
      error.message.includes('ti mismo') ||
      error.message.includes('monto')
    ) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    // Errores del servidor (500)
    res.status(500).json({
      success: false,
      error: error.message || 'Error procesando transferencia'
    });
  }
}



/**
 * POST /api/wallet/transfer-multi
 * Transferencia multi-moneda con conversión
 */
/**
 * POST /api/wallet/transfer-multi
 * Transferencia multi-moneda con conversión
 */
export async function transferMulti(req, res) {
  try {
    // 🔥 VALIDACIÓN CRÍTICA: Verificar que req.user existe
    if (!req.user || !req.user.id) {
      console.error('[WalletController] ❌ req.user no está definido:', req.user);
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado. req.user no está disponible.'
      });
    }

    const fromUserId = req.user.id;
    const {
      fromWalletId,
      toWalletId,
      toUserEmail,
      amount,
      fromCurrency,
      toCurrency,
      convertedAmount,
      exchangeRate,
      commission,
      description
    } = req.body;

    console.log('[WalletController] 📨 Transfer-multi request:', {
      fromUserId,
      fromWalletId,
      toWalletId,
      toUserEmail,
      amount,
      fromCurrency,
      toCurrency,
      convertedAmount,
      exchangeRate,
      commission
    });

    // Validaciones de campos requeridos
    if (!fromWalletId) {
      return res.status(400).json({
        success: false,
        error: 'fromWalletId es requerido'
      });
    }

    if (!toWalletId) {
      return res.status(400).json({
        success: false,
        error: 'toWalletId es requerido'
      });
    }

    if (!toUserEmail) {
      return res.status(400).json({
        success: false,
        error: 'toUserEmail es requerido'
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'El monto debe ser mayor a 0'
      });
    }

    if (!fromCurrency || !toCurrency) {
      return res.status(400).json({
        success: false,
        error: 'Las monedas de origen y destino son requeridas'
      });
    }

    if (!convertedAmount) {
      return res.status(400).json({
        success: false,
        error: 'convertedAmount es requerido'
      });
    }

    if (!exchangeRate) {
      return res.status(400).json({
        success: false,
        error: 'exchangeRate es requerido'
      });
    }

    // Importar la función de transferencia del service
    const { transferMultiCurrency } = await import('../services/wallet.service.js');

    // Ejecutar transferencia
    const result = await transferMultiCurrency(
      fromUserId,
      toUserEmail,
      fromWalletId,
      toWalletId,
      parseFloat(amount),
      fromCurrency,
      toCurrency,
      parseFloat(convertedAmount),
      parseFloat(exchangeRate),
      parseFloat(commission) || 0,
      description || 'Transferencia multi-moneda'
    );

    console.log('[WalletController] ✅ Transferencia exitosa:', result.txHash);

    res.json({
      success: true,
      message: `Transferencia exitosa: ${amount} ${fromCurrency} → ${parseFloat(convertedAmount).toFixed(2)} ${toCurrency}`,
      data: result
    });

  } catch (error) {
    console.error('[WalletController] ❌ Error en transfer-multi:', error);
    console.error('[WalletController] Stack trace:', error.stack);
    
    // Errores de validación o negocio
    if (
      error.message.includes('Saldo insuficiente') ||
      error.message.includes('no encontrado') ||
      error.message.includes('no encontrada') ||
      error.message.includes('no puedes')
    ) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    // Error del servidor
    res.status(500).json({
      success: false,
      error: error.message || 'Error procesando transferencia',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}