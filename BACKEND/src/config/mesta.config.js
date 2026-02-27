/**
 * MESTA CONFIGURATION
 * Configuración para integración con Mesta.xyz
 *
 * Environments:
 *   - sandbox: https://api.stg.mesta.xyz (staging/testing)
 *   - production: https://api.mesta.xyz (live)
 */

// dotenv ya está cargado en server.js, no necesitamos cargarlo aquí

// Determinar ambiente
const ENV = process.env.MESTA_ENV || 'sandbox';
const IS_SANDBOX = ENV === 'sandbox';

// Configuración por ambiente
const config = {
  sandbox: {
    apiUrl: process.env.MESTA_SANDBOX_API_URL || 'https://api.stg.mesta.xyz',
    apiKey: process.env.MESTA_SANDBOX_API_KEY,
    apiSecret: process.env.MESTA_SANDBOX_API_SECRET,
  },
  production: {
    apiUrl: process.env.MESTA_PROD_API_URL || 'https://api.mesta.xyz',
    apiKey: process.env.MESTA_PROD_API_KEY,
    apiSecret: process.env.MESTA_PROD_API_SECRET,
  }
};

// Configuración activa
const activeConfig = config[ENV];

// Exportar configuración
export const mestaConfig = {
  // Ambiente
  env: ENV,
  isSandbox: IS_SANDBOX,
  isProduction: !IS_SANDBOX,

  // Merchant
  merchantId: process.env.MESTA_MERCHANT_ID,

  // API
  apiUrl: activeConfig.apiUrl,
  apiKey: activeConfig.apiKey,
  apiSecret: activeConfig.apiSecret,
  apiVersion: 'v1',

  // Headers de autenticación
  getHeaders: () => ({
    'Content-Type': 'application/json',
    'x-api-key': activeConfig.apiKey,
    'x-api-secret': activeConfig.apiSecret,
  }),

  // Endpoints
  endpoints: {
    // Merchants
    merchants: '/v1/merchants',
    merchantById: (id) => `/v1/merchants/${id}`,

    // Quotes (cotizaciones)
    quotes: '/v1/quotes',
    quoteById: (id) => `/v1/quotes/${id}`,

    // Orders (órdenes de pago)
    orders: '/v1/orders',
    orderById: (id) => `/v1/orders/${id}`,

    // Transactions
    transactions: '/v1/transactions',
    transactionById: (id) => `/v1/transactions/${id}`,

    // Senders (remitentes)
    senders: '/v1/senders',
    senderById: (id) => `/v1/senders/${id}`,

    // Beneficiaries (beneficiarios)
    beneficiaries: '/v1/beneficiaries',
    beneficiaryById: (id) => `/v1/beneficiaries/${id}`,

    // Webhooks
    webhooks: '/v1/webhooks',
    webhookById: (id) => `/v1/webhooks/${id}`,
  },

  // Webhook
  webhookSecret: process.env.MESTA_WEBHOOK_SECRET,
  webhookUrl: process.env.MESTA_WEBHOOK_URL,

  // Timeouts y locks
  lockDurationMinutes: parseInt(process.env.MESTA_LOCK_DURATION_MINUTES) || 30,
  paymentTimeoutMinutes: parseInt(process.env.MESTA_PAYMENT_TIMEOUT_MINUTES) || 60,

  // Monedas soportadas
  supportedCurrencies: ['USD', 'USDT', 'USDC'],

  // Límites
  minAmount: 1.0,
  maxAmount: 100000.0,

  // Estados de Mesta mapeados a nuestros estados
  statusMapping: {
    // Mesta status → Internal status
    'pending': 'pending_external',
    'processing': 'pending_external',
    'completed': 'settled',
    'settled': 'settled',
    'failed': 'failed',
    'expired': 'expired',
    'cancelled': 'cancelled',
    'refunded': 'refunded',
  },

  // Eventos de webhook
  webhookEvents: {
    ORDER_CREATED: 'order.created',
    ORDER_PENDING: 'order.pending',
    ORDER_PROCESSING: 'order.processing',
    ORDER_COMPLETED: 'order.completed',
    ORDER_FAILED: 'order.failed',
    ORDER_EXPIRED: 'order.expired',
    ORDER_CANCELLED: 'order.cancelled',
    TRANSACTION_COMPLETED: 'transaction.completed',
    TRANSACTION_FAILED: 'transaction.failed',
  },
};

// Validar configuración al cargar
export function validateMestaConfig() {
  const errors = [];

  if (!activeConfig.apiKey) {
    errors.push(`MESTA_${ENV.toUpperCase()}_API_KEY no está configurada`);
  }

  if (!activeConfig.apiSecret) {
    errors.push(`MESTA_${ENV.toUpperCase()}_API_SECRET no está configurada`);
  }

  if (errors.length > 0) {
    console.warn('[MestaConfig] ⚠️ Advertencias de configuración:');
    errors.forEach(e => console.warn(`  - ${e}`));
    return false;
  }

  console.log(`[MestaConfig] ✅ Configuración cargada (${ENV})`);
  console.log(`[MestaConfig] 📡 API URL: ${activeConfig.apiUrl}`);

  return true;
}

// Log de configuración (sin secretos)
export function logMestaConfig() {
  console.log('[MestaConfig] Configuración actual:');
  console.log({
    env: mestaConfig.env,
    isSandbox: mestaConfig.isSandbox,
    apiUrl: mestaConfig.apiUrl,
    apiKeyConfigured: !!mestaConfig.apiKey,
    apiSecretConfigured: !!mestaConfig.apiSecret,
    webhookUrl: mestaConfig.webhookUrl,
    lockDurationMinutes: mestaConfig.lockDurationMinutes,
  });
}

export default mestaConfig;
