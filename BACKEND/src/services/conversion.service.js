import { execute } from '../config/crate.js';
import { randomUUID } from 'crypto';

/**
 * CONVERSION SERVICE - SISTEMA DE CONVERSIÓN DE DIVISAS
 * Maneja conversiones entre wallets del usuario
 */

/* ============================
   TASAS DE CAMBIO
============================ */

/**
 * Tasas de cambio (valor de 1 unidad en USD)
 */
const EXCHANGE_RATES = {
  'USD': 1.0,
  'EUR': 0.92,        // 1 EUR = 0.92 USD
  'GBP': 0.79,        // 1 GBP = 0.79 USD
  'COP': 0.00025,     // 1 COP = 0.00025 USD (4000 COP = 1 USD)
  'JPY': 0.0067,      // 1 JPY = 0.0067 USD (150 JPY = 1 USD)
  'CAD': 0.74,        // 1 CAD = 0.74 USD
  'AUD': 0.66,        // 1 AUD = 0.66 USD
  'BTC': 43000,       // 1 BTC = 43000 USD
  'ETH': 2200,        // 1 ETH = 2200 USD
  'USDT': 1.0         // 1 USDT = 1 USD (stablecoin)
};

/* ============================
   FUNCIONES DE CONVERSIÓN
============================ */

/**
 * Convertir monto entre dos monedas
 * @param {number} amount - Monto a convertir
 * @param {string} fromCurrency - Moneda origen
 * @param {string} toCurrency - Moneda destino
 * @returns {number} - Monto convertido
 */
function convertAmount(amount, fromCurrency, toCurrency) {
  const fromRate = EXCHANGE_RATES[fromCurrency] || 1;
  const toRate = EXCHANGE_RATES[toCurrency] || 1;

  // Paso 1: Convertir a USD (moneda base)
  const amountInUSD = amount * fromRate;

  // Paso 2: Convertir de USD a moneda destino
  const convertedAmount = amountInUSD / toRate;

  console.log(`[Conversion] 📊 ${amount} ${fromCurrency} = ${amountInUSD.toFixed(6)} USD = ${convertedAmount.toFixed(6)} ${toCurrency}`);
  console.log(`[Conversion] 🔢 Tasas: ${fromCurrency}=${fromRate}, ${toCurrency}=${toRate}`);

  return convertedAmount;
}

/**
 * Obtener tasa de cambio entre dos monedas
 * @param {string} fromCurrency - Moneda origen
 * @param {string} toCurrency - Moneda destino
 * @returns {number} - Tasa de cambio (1 FROM = X TO)
 */
function getExchangeRate(fromCurrency, toCurrency) {
  const fromRate = EXCHANGE_RATES[fromCurrency] || 1;
  const toRate = EXCHANGE_RATES[toCurrency] || 1;

  // Tasa: cuánto vale 1 unidad de fromCurrency en toCurrency
  const rate = fromRate / toRate;

  console.log(`[Conversion] 💱 Tasa: 1 ${fromCurrency} = ${rate.toFixed(8)} ${toCurrency}`);

  return rate;
}

/* ============================
   PREVIEW/CÁLCULO DE CONVERSIÓN
============================ */

/**
 * SOLO CALCULAR la conversión (sin ejecutar transacciones)
 * @param {string} userId - ID del usuario
 * @param {string} fromCurrency - Moneda origen
 * @param {string} toCurrency - Moneda destino
 * @param {number} amount - Monto a convertir
 * @returns {Object} - Detalles del cálculo (rate, fee, total, etc)
 */
export async function calculateConversionPreview(userId, fromCurrency, toCurrency, amount) {
  try {
    console.log('[ConversionService] 📊 Calculando preview:', {
      userId,
      fromCurrency,
      toCurrency,
      amount
    });

    // ===================================
    // 1. OBTENER WALLET ORIGEN
    // ===================================
    const { rows: fromWallets } = await execute(
      `SELECT w.id, w.balance
       FROM doc.wallets w
       JOIN doc.assets a ON w.asset_id = a.id
       WHERE w.user_id = $1 AND a.symbol = $2 AND w.is_active = true
       LIMIT 1`,
      [userId, fromCurrency]
    );

    if (fromWallets.length === 0) {
      throw new Error(`No tienes una wallet activa de ${fromCurrency}`);
    }

    const fromWallet = fromWallets[0];
    const fromBalance = parseFloat(fromWallet.balance);

    // ===================================
    // 2. VALIDAR SALDO SUFICIENTE
    // ===================================
    const fee = amount * 0.005; // Comisión 0.5%
    const totalRequired = amount + fee;

    console.log(`[ConversionService] 💰 Validación: Balance=${fromBalance}, Requerido=${totalRequired}`);

    if (fromBalance < totalRequired) {
      throw new Error(
        `Saldo insuficiente en ${fromCurrency}. Necesitas ${totalRequired.toFixed(2)} pero tienes ${fromBalance.toFixed(2)}`
      );
    }

    // ===================================
    // 3. OBTENER WALLET DESTINO
    // ===================================
    const { rows: toWallets } = await execute(
      `SELECT w.id, w.balance
       FROM doc.wallets w
       JOIN doc.assets a ON w.asset_id = a.id
       WHERE w.user_id = $1 AND a.symbol = $2 AND w.is_active = true
       LIMIT 1`,
      [userId, toCurrency]
    );

    if (toWallets.length === 0) {
      throw new Error(`No tienes una wallet activa de ${toCurrency}`);
    }

    const toWallet = toWallets[0];
    const toBalance = parseFloat(toWallet.balance);

    // ===================================
    // 4. CALCULAR CONVERSIÓN
    // ===================================
    const convertedAmount = convertAmount(amount, fromCurrency, toCurrency);
    const rate = getExchangeRate(fromCurrency, toCurrency);

    console.log(`[ConversionService] 📊 Preview: ${amount} ${fromCurrency} = ${convertedAmount.toFixed(2)} ${toCurrency} (tasa: ${rate.toFixed(6)})`);

    // ===================================
    // 5. RETORNAR PREVIEW (SIN EJECUTAR)
    // ===================================
    return {
      success: true,
      fromCurrency,
      toCurrency,
      amount,
      convertedAmount: parseFloat(convertedAmount.toFixed(2)),
      exchangeRate: parseFloat(rate.toFixed(6)),
      commission: parseFloat(fee.toFixed(2)),
      totalDebit: parseFloat(totalRequired.toFixed(2)),
      fromBalance,
      toBalance,
      message: 'Preview calculado correctamente (sin ejecutar)'
    };

  } catch (error) {
    console.error('[ConversionService] ❌ Error en preview:', error);
    throw error;
  }
}

/* ============================
   EJECUCIÓN DE CONVERSIÓN
============================ */

/**
 * Ejecutar conversión entre wallets
 * @param {string} userId - ID del usuario
 * @param {string} fromCurrency - Moneda origen
 * @param {string} toCurrency - Moneda destino
 * @param {number} amount - Monto a convertir
 * @returns {Object} - Datos de la conversión completada
 */
export async function executeConversion(userId, fromCurrency, toCurrency, amount) {
  try {
    console.log('[ConversionService] 🔄 Iniciando conversión:', { 
      userId, 
      fromCurrency, 
      toCurrency, 
      amount 
    });

    // ===================================
    // 1. OBTENER WALLET ORIGEN
    // ===================================
    const { rows: fromWallets } = await execute(
      `SELECT w.id, w.balance 
       FROM doc.wallets w
       JOIN doc.assets a ON w.asset_id = a.id
       WHERE w.user_id = $1 AND a.symbol = $2 AND w.is_active = true 
       LIMIT 1`,
      [userId, fromCurrency]
    );

    if (fromWallets.length === 0) {
      throw new Error(`No tienes una wallet activa de ${fromCurrency}`);
    }

    const fromWallet = fromWallets[0];
    const fromBalance = parseFloat(fromWallet.balance);

    console.log(`[ConversionService] 💼 Wallet origen: ${fromCurrency} - Balance: ${fromBalance}`);

    // ===================================
    // 2. VALIDAR SALDO SUFICIENTE
    // ===================================
    const fee = amount * 0.005; // Comisión 0.5%
    const totalRequired = amount + fee;

    console.log(`[ConversionService] 💰 Validación: Balance=${fromBalance}, Requerido=${totalRequired} (${amount} + ${fee} fee)`);

    if (fromBalance < totalRequired) {
      throw new Error(
        `Saldo insuficiente en ${fromCurrency}. Necesitas ${totalRequired.toFixed(2)} pero tienes ${fromBalance.toFixed(2)}`
      );
    }

    // ===================================
    // 3. OBTENER WALLET DESTINO
    // ===================================
    const { rows: toWallets } = await execute(
      `SELECT w.id, w.balance 
       FROM doc.wallets w
       JOIN doc.assets a ON w.asset_id = a.id
       WHERE w.user_id = $1 AND a.symbol = $2 AND w.is_active = true 
       LIMIT 1`,
      [userId, toCurrency]
    );

    if (toWallets.length === 0) {
      throw new Error(`No tienes una wallet activa de ${toCurrency}`);
    }

    const toWallet = toWallets[0];
    const toBalance = parseFloat(toWallet.balance);

    console.log(`[ConversionService] 💼 Wallet destino: ${toCurrency} - Balance: ${toBalance}`);

    // ===================================
    // 4. CALCULAR CONVERSIÓN
    // ===================================
    const convertedAmount = convertAmount(amount, fromCurrency, toCurrency);
    const rate = getExchangeRate(fromCurrency, toCurrency);

    console.log(`[ConversionService] 🔄 Conversión: ${amount} ${fromCurrency} = ${convertedAmount.toFixed(2)} ${toCurrency} (tasa: ${rate.toFixed(6)})`);

    // ===================================
    // 5. CREAR TRANSACCIÓN
    // ===================================
    const txId = randomUUID();

    await execute(
      `INSERT INTO doc.transactions (
        id, wallet_id, status_id, amount, tx_hash, created_at
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [txId, fromWallet.id, 'completed', -totalRequired, `CONVERSION_${Date.now()}`]
    );

    console.log(`[ConversionService] 📝 Transacción creada: ${txId}`);

    // ===================================
    // 6. ACTUALIZAR WALLET ORIGEN
    // ===================================
    const newFromBalance = fromBalance - totalRequired;

    await execute(
      `UPDATE doc.wallets SET balance = $1 WHERE id = $2`,
      [newFromBalance, fromWallet.id]
    );

    console.log(`[ConversionService] ✅ Wallet ${fromCurrency}: ${fromBalance.toFixed(2)} → ${newFromBalance.toFixed(2)}`);

    // ===================================
    // 7. ACTUALIZAR WALLET DESTINO
    // ===================================
    const newToBalance = toBalance + convertedAmount;

    await execute(
      `UPDATE doc.wallets SET balance = $1 WHERE id = $2`,
      [newToBalance, toWallet.id]
    );

    console.log(`[ConversionService] ✅ Wallet ${toCurrency}: ${toBalance.toFixed(2)} → ${newToBalance.toFixed(2)}`);

    // ===================================
    // 8. REGISTRAR MOVIMIENTOS
    // ===================================
    const movementOutId = randomUUID();
    const movementInId = randomUUID();

    // Movimiento de salida
    await execute(
      `INSERT INTO doc.wallet_movements (
        id, wallet_id, transaction_id, amount, balance_before, balance_after, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [movementOutId, fromWallet.id, txId, -totalRequired, fromBalance, newFromBalance]
    );

    // Movimiento de entrada
    await execute(
      `INSERT INTO doc.wallet_movements (
        id, wallet_id, transaction_id, amount, balance_before, balance_after, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [movementInId, toWallet.id, txId, convertedAmount, toBalance, newToBalance]
    );

    console.log(`[ConversionService] 📊 Movimientos registrados`);

    // ===================================
    // 9. REFRESCAR TABLAS
    // ===================================
    await execute('REFRESH TABLE doc.wallets');
    await execute('REFRESH TABLE doc.transactions');
    await execute('REFRESH TABLE doc.wallet_movements');

    console.log('[ConversionService] ✅ Conversión completada exitosamente');

    // ===================================
    // 10. RETORNAR RESULTADO
    // ===================================
    return {
      txId,
      fromCurrency,
      toCurrency,
      amount,
      convertedAmount,
      fee,
      rate,
      fromBalance,
      toBalance,
      newFromBalance,
      newToBalance,
      timestamp: new Date()
    };

  } catch (error) {
    console.error('[ConversionService] ❌ Error en conversión:', error);
    throw error;
  }
}