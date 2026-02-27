/**
 * VITAWALLET CONFIGURATION
 * Credenciales y URLs para sandbox y producción
 *
 * VITAWALLET_MODE controla el comportamiento:
 *   - "local"      → Datos mock, cero llamadas HTTP (desarrollo sin credenciales)
 *   - "sandbox"    → API real de staging (https://api.stage.vitawallet.io)
 *   - "production" → API real de producción (https://api.vitawallet.io)
 */

import dotenv from 'dotenv';
dotenv.config();

const config = {
  // ===== MODE: local | sandbox | production =====
  MODE: (process.env.VITAWALLET_MODE || 'local').toLowerCase(),

  // ===== SANDBOX (TESTING) =====
  SANDBOX: {
    BASE_URL: process.env.VITAWALLET_SANDBOX_API_URL || 'https://api.stage.vitawallet.io/api/businesses',
    LOGIN: process.env.VITAWALLET_SANDBOX_LOGIN || '',
    TRANS_KEY: process.env.VITAWALLET_SANDBOX_TRANS_KEY || '',
    SECRET_KEY: process.env.VITAWALLET_SANDBOX_SECRET_KEY || '',
    MERCHANT_ID: process.env.VITAWALLET_SANDBOX_MERCHANT_ID || '',
    WEBHOOK_SECRET: process.env.VITAWALLET_SANDBOX_WEBHOOK_SECRET || '',
  },

  // ===== PRODUCTION =====
  PRODUCTION: {
    BASE_URL: process.env.VITAWALLET_PROD_API_URL || 'https://api.vitawallet.io/api/businesses',
    LOGIN: process.env.VITAWALLET_PROD_LOGIN || '',
    TRANS_KEY: process.env.VITAWALLET_PROD_TRANS_KEY || '',
    SECRET_KEY: process.env.VITAWALLET_PROD_SECRET_KEY || '',
    MERCHANT_ID: process.env.VITAWALLET_PROD_MERCHANT_ID || '',
    WEBHOOK_SECRET: process.env.VITAWALLET_PROD_WEBHOOK_SECRET || '',
  },

  // ===== ENVIRONMENT SELECTION =====
  ENVIRONMENT: process.env.VITAWALLET_ENV || 'SANDBOX',

  // ===== ENDPOINTS (según documentación oficial) =====
  ENDPOINTS: {
    // Wallets
    WALLETS: '/wallets',
    GET_WALLET: '/wallets/{uuid}',
    MASTER_WALLET: '/wallets/master',

    // Pricing
    PRICES: '/prices',
    PAYIN_PRICES: '/payins_prices',

    // Payment Methods
    PAYMENT_METHODS: '/payment_methods/{country}',

    // Payins
    CREATE_PAYIN: '/payment_orders',
    GET_PAYIN: '/payment_orders/{payin_id}',

    // Transactions
    TRANSACTIONS: '/transactions',
    GET_TRANSACTION: '/transactions/{id}',
  },

  // ===== SUPPORTED COUNTRIES =====
  SUPPORTED_COUNTRIES: {
    CO: 'Colombia',
    AR: 'Argentina',
    CL: 'Chile',
    BR: 'Brasil',
    MX: 'México',
  },

  // ===== PAYMENT METHODS BY COUNTRY =====
  PAYMENT_METHODS: {
    CO: {
      PSE: { id: 1, name: 'PSE', description: 'Transferencia bancaria' },
      NEQUI: { id: 2, name: 'Nequi', description: 'Billetera digital' },
      DAVIPLATA: { id: 3, name: 'Daviplata', description: 'Daviplata' },
      BANCOLOMBIA: { id: 4, name: 'Bancolombia', description: 'Bancolombia' },
      TDC: { id: 5, name: 'TDC', description: 'Tarjeta de crédito/débito' },
      BNPL: { id: 6, name: 'BNPL', description: 'Compra ahora paga después' },
    },
    AR: {
      KHIPU: { id: 1, name: 'Khipu', description: 'Transferencia bancaria' },
      BIND: { id: 2, name: 'Bind', description: 'Bind' },
    },
    CL: {
      KHIPU: { id: 1, name: 'Khipu', description: 'Transferencia bancaria' },
      WEBPAY: { id: 2, name: 'Webpay', description: 'Webpay' },
    },
    BR: {
      PIX: { id: 1, name: 'PIX QR', description: 'PIX QR' },
    },
    MX: {
      BITSO: { id: 1, name: 'Bitso', description: 'Bitso One-time CLABE' },
    },
  },

  // ===== TIMEOUTS =====
  TIMEOUT_MS: 30000,

  // ===== LOGGING =====
  DEBUG: process.env.VITAWALLET_DEBUG !== 'false',
};

// Helper
config.isLocal = () => config.MODE === 'local';

export default config;
