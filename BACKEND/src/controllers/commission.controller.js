/**
 * COMMISSION CONTROLLER
 * Endpoints para consultar comisiones del sistema
 */

import {
  getCommissionStats,
  getCommissionHistory,
  getSystemBalances
} from '../services/commission.service.js';

/**
 * GET /api/commission/stats
 * Obtener estadísticas de comisiones
 * Query: ?currency=USD
 */
export async function getStats(req, res) {
  try {
    // Ya está protegido por requireAdmin en las rutas
    console.log('[CommissionController] Usuario accediendo a stats:', req.user);

    const currency = req.query.currency || null;
    const stats = await getCommissionStats(currency);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('[CommissionController] Error en getStats:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo estadísticas'
    });
  }
}

/**
 * GET /api/commission/history
 * Obtener historial de comisiones
 * Query: ?limit=50&currency=USD
 */
export async function getHistory(req, res) {
  try {
    // Ya está protegido por requireAdmin en las rutas
    console.log('[CommissionController] Usuario accediendo a history:', req.user);

    const limit = parseInt(req.query.limit) || 50;
    const currency = req.query.currency || null;

    const history = await getCommissionHistory(limit, currency);

    res.json({
      success: true,
      data: history,
      count: history.length
    });

  } catch (error) {
    console.error('[CommissionController] Error en getHistory:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo historial'
    });
  }
}

/**
 * GET /api/commission/balances
 * Obtener balances del sistema
 */
export async function getBalances(req, res) {
  try {
    // Ya está protegido por requireAdmin en las rutas
    console.log('[CommissionController] 📊 Usuario accediendo a balances:', {
      userId: req.user?.id,
      role: req.user?.role,
      email: req.user?.email
    });

    const balances = await getSystemBalances();

    // Calcular total en USD (aproximado)
    let totalUSD = 0;
    const rates = {
      'USD': 1,
      'EUR': 1.09,
      'COP': 0.00025,
      'BTC': 43000,
      'ETH': 2200,
      'USDT': 1
    };

    balances.forEach(b => {
      const rate = rates[b.currency] || 1;
      totalUSD += b.balance * rate;
    });

    console.log('[CommissionController] ✅ Balances obtenidos:', balances.length);

    res.json({
      success: true,
      data: {
        balances,
        totalUSD: parseFloat(totalUSD.toFixed(2))
      }
    });

  } catch (error) {
    console.error('[CommissionController] ❌ Error en getBalances:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo balances'
    });
  }
}