/**
 * VITAWALLET WALLET CONTROLLER
 * Endpoints para obtener balance de Vita Wallet
 *
 * Endpoints:
 * - GET /api/vitawallet/balance - Balance de la wallet madre en Vita
 * - GET /api/vitawallet/wallets - Todas las wallets del negocio
 * - GET /api/vitawallet/wallets/:uuid - Balance de una wallet específica
 */

import walletService from '../services/vitawallet/wallet.service.js';

/**
 * GET /api/vitawallet/balance
 * Obtiene el balance de la wallet madre de Vita (la principal)
 * ADMIN ONLY: Solo fluxiAdmin puede ver el saldo de Vita Wallet
 */
export async function getVitaBalance(req, res) {
  try {
    console.log(`[VitaWalletController] GET /api/vitawallet/balance`);

    // Verificar que el usuario esté autenticado
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Autenticación requerida',
      });
    }

    // Verificar que sea fluxiAdmin
    if (req.user.role !== 'fluxiAdmin') {
      console.warn(`[VitaWalletController] ⚠️ Intento no autorizado por usuario: ${req.user.username} (${req.user.role})`);
      return res.status(403).json({
        success: false,
        error: 'Se requieren permisos de administrador para ver el saldo de Vita Wallet',
      });
    }

    const balance = await walletService.getDashboardBalance();

    res.json({
      success: balance.success,
      data: {
        balances: balance.balances,
        walletUuid: balance.wallet_uuid,
        lastUpdate: balance.lastUpdate,
      },
      error: balance.error || null,
    });
  } catch (error) {
    console.error(`[VitaWalletController] Error en getVitaBalance:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo balance de Vita',
    });
  }
}

/**
 * GET /api/vitawallet/wallets
 * Obtiene todas las wallets del negocio
 * ADMIN ONLY: Solo administradores pueden ver todas
 */
export async function getVitaWallets(req, res) {
  try {
    console.log(`[VitaWalletController] GET /api/vitawallet/wallets`);

    // Opcional: verificar que sea admin
    if (req.user && req.user.role !== 'fluxiAdmin') {
      return res.status(403).json({
        success: false,
        error: 'Se requieren permisos de administrador',
      });
    }

    const result = await walletService.getBusinessWallets();

    res.json({
      success: result.success,
      data: {
        total: result.total,
        wallets: result.wallets,
      },
      error: result.error || null,
    });
  } catch (error) {
    console.error(`[VitaWalletController] Error en getVitaWallets:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo wallets de Vita',
    });
  }
}

/**
 * GET /api/vitawallet/wallets/:uuid
 * Obtiene el balance de una wallet específica
 * ADMIN ONLY
 */
export async function getVitaWalletBalance(req, res) {
  try {
    const { uuid } = req.params;
    console.log(`[VitaWalletController] GET /api/vitawallet/wallets/${uuid}`);

    // Opcional: verificar que sea admin
    if (req.user && req.user.role !== 'fluxiAdmin') {
      return res.status(403).json({
        success: false,
        error: 'Se requieren permisos de administrador',
      });
    }

    const result = await walletService.getWalletBalance(uuid);

    res.json({
      success: result.success,
      data: {
        uuid: result.uuid,
        balances: result.balances,
        wallet: result.wallet,
      },
      error: result.error || null,
    });
  } catch (error) {
    console.error(`[VitaWalletController] Error en getVitaWalletBalance:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo balance de wallet',
    });
  }
}

/**
 * GET /api/vitawallet/summary
 * Obtiene resumen de todas las wallets con totales
 * ADMIN ONLY
 */
export async function getVitaWalletsSummary(req, res) {
  try {
    console.log(`[VitaWalletController] GET /api/vitawallet/summary`);

    // Opcional: verificar que sea admin
    if (req.user && req.user.role !== 'fluxiAdmin') {
      return res.status(403).json({
        success: false,
        error: 'Se requieren permisos de administrador',
      });
    }

    const result = await walletService.getWalletsSummary();

    res.json({
      success: result.success,
      data: {
        totalWallets: result.totalWallets,
        totalsByCurrency: result.totalsByCurrency,
        wallets: result.wallets,
      },
      error: result.error || null,
    });
  } catch (error) {
    console.error(`[VitaWalletController] Error en getVitaWalletsSummary:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo resumen de wallets',
    });
  }
}

/**
 * GET /api/vitawallet/health
 * Verifica que la conexión a Vita esté activa
 */
export async function checkVitaHealth(req, res) {
  try {
    console.log(`[VitaWalletController] GET /api/vitawallet/health`);

    const balance = await walletService.getDashboardBalance();

    res.json({
      success: true,
      data: {
        status: balance.success ? 'connected' : 'disconnected',
        vitaConnected: balance.success,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(`[VitaWalletController] Error en checkVitaHealth:`, error);
    res.json({
      success: false,
      data: {
        status: 'error',
        vitaConnected: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
