/**
 * VITAWALLET WALLET SERVICE
 * Obtiene información de wallets (saldo, activos, etc)
 *
 * Servicios:
 * - getBusinessWallets() - Obtiene todas las wallets del negocio
 * - getMasterWallet() - Obtiene la wallet madre (cuenta principal)
 * - getWalletBalance() - Obtiene el balance de una wallet específica
 */

import client from './vitawallet.client.js';
import config from './vitawallet.config.js';

class WalletService {
  /**
   * Obtiene todas las wallets del negocio (incluyendo sub-wallets)
   * @returns {Promise<Object>} Lista de wallets con balances
   */
  async getBusinessWallets() {
    try {
      console.log(`[VitaWallet] Obteniendo wallets del negocio...`);

      if (config.isLocal()) {
        return getMockWallets();
      }

      const endpoint = config.ENDPOINTS.WALLETS;
      const response = await client.get(endpoint);

      console.log(`[VitaWallet] ✅ Wallets obtenidas`);
      console.log(`[VitaWallet] Total wallets:`, response.data?.data?.length || 0);

      return {
        success: true,
        wallets: response.data?.data || [],
        total: response.data?.data?.length || 0,
      };
    } catch (error) {
      console.error(`[VitaWallet] ❌ Error obteniendo wallets:`, error.message);
      return {
        success: false,
        error: error.message,
        wallets: [],
        total: 0,
      };
    }
  }

  /**
   * Obtiene la wallet madre (master wallet) del negocio
   * Esta es la wallet principal donde entra todo el dinero
   * @returns {Promise<Object>} Master wallet con balance detallado
   */
  async getMasterWallet() {
    try {
      console.log(`[VitaWallet] Obteniendo master wallet...`);

      if (config.isLocal()) {
        return getMockMasterWallet();
      }

      // Intentar primero el endpoint directo de master
      try {
        const endpoint = config.ENDPOINTS.MASTER_WALLET;
        const response = await client.get(endpoint);
        console.log(`[VitaWallet] ✅ Master wallet obtenida vía /wallets/master`);

        // La respuesta viene como: { wallet: { uuid, attributes: { balances } } }
        const walletData = response.data?.wallet || response.data?.data || response.data;
        const uuid = walletData?.uuid || response.data?.wallet?.uuid;
        const balances = walletData?.attributes?.balances || walletData?.balances || {};

        console.log(`[VitaWallet] 🔍 Estructura parseada - UUID: ${uuid}, Balances:`, balances);

        return {
          success: true,
          wallet: walletData,
          uuid: uuid,
          balances: balances,
        };
      } catch (masterError) {
        // Si falla, obtener todas las wallets y usar la primera (generalmente es la master)
        console.warn(`[VitaWallet] ⚠️ /wallets/master falló, intentando /wallets`);
        const allWallets = await this.getBusinessWallets();
        if (allWallets.success && allWallets.wallets.length > 0) {
          const masterWallet = allWallets.wallets[0];
          console.log(`[VitaWallet] ✅ Master wallet obtenida de lista (primera wallet)`);
          return {
            success: true,
            wallet: masterWallet,
            uuid: masterWallet.uuid,
            balances: masterWallet.attributes?.balances || masterWallet.balances || {},
            note: 'Obtenida de lista de wallets (primera)',
          };
        }
        throw masterError;
      }
    } catch (error) {
      console.error(`[VitaWallet] ❌ Error obteniendo master wallet:`, error.message);
      return {
        success: false,
        error: error.message,
        wallet: null,
        balances: {},
      };
    }
  }

  /**
   * Obtiene el balance de una wallet específica
   * @param {string} uuid - UUID de la wallet
   * @returns {Promise<Object>} Balance detallado
   */
  async getWalletBalance(uuid) {
    try {
      console.log(`[VitaWallet] Obteniendo balance de wallet: ${uuid}`);

      if (config.isLocal()) {
        return {
          success: true,
          uuid,
          balances: getMockMasterWallet().wallet.balances,
          source: 'local-mock',
        };
      }

      const endpoint = config.ENDPOINTS.GET_WALLET.replace('{uuid}', uuid);
      const response = await client.get(endpoint);

      const balances = response.data?.data?.balances || {};
      console.log(`[VitaWallet] ✅ Balance obtenido para wallet ${uuid}`);
      console.log(`[VitaWallet] Monedas disponibles:`, Object.keys(balances).join(', '));

      return {
        success: true,
        uuid,
        balances,
        wallet: response.data?.data,
      };
    } catch (error) {
      console.error(`[VitaWallet] ❌ Error obteniendo balance:`, error.message);
      return {
        success: false,
        error: error.message,
        uuid,
        balances: {},
      };
    }
  }

  /**
   * Obtiene balance en formato simplificado para dashboard
   * @returns {Promise<Object>} Balance agrupado por moneda
   */
  async getDashboardBalance() {
    try {
      console.log(`[VitaWallet] getDashboardBalance() iniciando...`);
      const masterWallet = await this.getMasterWallet();

      console.log(`[VitaWallet] masterWallet resultado:`, masterWallet);

      if (!masterWallet.success) {
        console.error(`[VitaWallet] ❌ getMasterWallet falló:`, masterWallet.error);
        return {
          success: false,
          error: masterWallet.error,
          balances: {},
        };
      }

      const balances = masterWallet.balances || {};
      console.log(`[VitaWallet] Balances extraídos:`, balances);

      // Formatar para dashboard: { moneda: monto }
      const formatted = {};
      for (const [currency, amount] of Object.entries(balances)) {
        formatted[currency.toUpperCase()] = parseFloat(amount) || 0;
      }

      console.log(`[VitaWallet] 💰 Balance para dashboard:`, formatted);

      return {
        success: true,
        balances: formatted,
        wallet_uuid: masterWallet.uuid,
        lastUpdate: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[VitaWallet] Error en getDashboardBalance:`, error.message);
      return {
        success: false,
        error: error.message,
        balances: {},
      };
    }
  }

  /**
   * Obtiene resumen de todas las wallets para admin
   * @returns {Promise<Object>} Resumen con totales
   */
  async getWalletsSummary() {
    try {
      const wallets = await this.getBusinessWallets();

      if (!wallets.success) {
        return {
          success: false,
          error: wallets.error,
          summary: {},
        };
      }

      // Agrupar totales por moneda
      const totals = {};
      wallets.wallets.forEach((wallet) => {
        const balances = wallet.balances || {};
        for (const [currency, amount] of Object.entries(balances)) {
          const key = currency.toUpperCase();
          totals[key] = (totals[key] || 0) + parseFloat(amount);
        }
      });

      console.log(`[VitaWallet] 📊 Resumen de wallets:`);
      console.log(`[VitaWallet]   Total wallets: ${wallets.total}`);
      console.log(`[VitaWallet]   Totales por moneda:`, totals);

      return {
        success: true,
        totalWallets: wallets.total,
        totalsByoCurrency: totals,
        wallets: wallets.wallets,
      };
    } catch (error) {
      console.error(`[VitaWallet] Error en getWalletsSummary:`, error.message);
      return {
        success: false,
        error: error.message,
        summary: {},
      };
    }
  }
}

/**
 * Mock data para modo LOCAL
 */
function getMockWallets() {
  return {
    success: true,
    wallets: [
      {
        uuid: 'mock-master-wallet-uuid',
        type: 'master',
        name: 'Master Wallet (FLUXI)',
        balances: {
          'USD': 50000.00,
          'COP': 150000000.00,
          'ARS': 2500000.00,
          'CLP': 35000000.00,
          'BRL': 250000.00,
          'MXN': 800000.00,
        },
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        uuid: 'mock-user-wallet-1',
        type: 'user',
        name: 'Wallet Usuario 1',
        balances: {
          'USD': 5000.00,
          'COP': 15000000.00,
        },
        created_at: '2024-02-01T00:00:00Z',
      },
    ],
    total: 2,
  };
}

function getMockMasterWallet() {
  return {
    success: true,
    wallet: {
      uuid: 'mock-master-wallet-uuid',
      type: 'master',
      name: 'Master Wallet (FLUXI)',
      balances: {
        'USD': 50000.00,
        'COP': 150000000.00,
        'ARS': 2500000.00,
        'CLP': 35000000.00,
        'BRL': 250000.00,
        'MXN': 800000.00,
        'BTC': 0.5,
        'USDT': 10000.00,
        'USDC': 5000.00,
      },
      created_at: '2024-01-01T00:00:00Z',
    },
    uuid: 'mock-master-wallet-uuid',
    balances: {
      'USD': 50000.00,
      'COP': 150000000.00,
      'ARS': 2500000.00,
      'CLP': 35000000.00,
      'BRL': 250000.00,
      'MXN': 800000.00,
      'BTC': 0.5,
      'USDT': 10000.00,
      'USDC': 5000.00,
    },
  };
}

export default new WalletService();
