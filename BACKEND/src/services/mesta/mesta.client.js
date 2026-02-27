/**
 * MESTA API CLIENT
 * Cliente HTTP para comunicarse con la API de Mesta.xyz
 *
 * Documentación: https://docs.mesta.xyz
 * Sandbox: https://api.stg.mesta.xyz
 * Production: https://api.mesta.xyz
 */

import { mestaConfig, validateMestaConfig } from '../../config/mesta.config.js';

class MestaClient {
  constructor() {
    this.baseUrl = mestaConfig.apiUrl;
    this.headers = mestaConfig.getHeaders();
    this.isConfigured = false;
  }

  /**
   * Inicializar cliente y validar configuración
   */
  init() {
    this.isConfigured = validateMestaConfig();
    if (this.isConfigured) {
      console.log('[MestaClient] ✅ Cliente inicializado correctamente');
    }
    return this.isConfigured;
  }

  /**
   * Request genérico a la API de Mesta
   */
  async request(method, endpoint, data = null, options = {}) {
    if (!this.isConfigured) {
      this.init();
    }

    const url = `${this.baseUrl}${endpoint}`;

    const config = {
      method,
      headers: {
        ...this.headers,
        ...options.headers,
      },
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      config.body = JSON.stringify(data);
    }

    console.log(`[MestaClient] 📡 ${method} ${endpoint}`);

    try {
      const response = await fetch(url, config);

      // Parsear respuesta
      const contentType = response.headers.get('content-type');
      let responseData;

      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      // Log de respuesta
      console.log(`[MestaClient] ${response.ok ? '✅' : '❌'} Status: ${response.status}`);

      if (!response.ok) {
        const error = new Error(responseData.message || `HTTP ${response.status}`);
        error.status = response.status;
        error.code = responseData.code || 'MESTA_API_ERROR';
        error.details = responseData;
        throw error;
      }

      return {
        success: true,
        status: response.status,
        data: responseData,
      };

    } catch (error) {
      console.error(`[MestaClient] ❌ Error en ${method} ${endpoint}:`, error.message);

      // Re-throw con más contexto
      if (error.status) {
        throw error; // Ya es un error formateado
      }

      // Error de red u otro
      const networkError = new Error(`Error de conexión con Mesta: ${error.message}`);
      networkError.code = 'MESTA_NETWORK_ERROR';
      networkError.originalError = error;
      throw networkError;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // QUOTES (Cotizaciones)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Crear una cotización
   * @param {Object} quoteData - Datos de la cotización
   * @param {string} quoteData.sourceCurrency - Moneda origen (USD, USDT, etc)
   * @param {string} quoteData.targetCurrency - Moneda destino
   * @param {number} quoteData.amount - Monto a cotizar
   */
  async createQuote(quoteData) {
    return this.request('POST', mestaConfig.endpoints.quotes, {
      source_currency: quoteData.sourceCurrency,
      target_currency: quoteData.targetCurrency,
      amount: quoteData.amount,
      ...quoteData,
    });
  }

  /**
   * Obtener cotización por ID
   */
  async getQuote(quoteId) {
    return this.request('GET', mestaConfig.endpoints.quoteById(quoteId));
  }

  // ═══════════════════════════════════════════════════════════════
  // ORDERS (Órdenes de pago)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Crear una orden de pago
   * @param {Object} orderData - Datos de la orden
   */
  async createOrder(orderData) {
    return this.request('POST', mestaConfig.endpoints.orders, orderData);
  }

  /**
   * Obtener orden por ID
   */
  async getOrder(orderId) {
    return this.request('GET', mestaConfig.endpoints.orderById(orderId));
  }

  /**
   * Listar órdenes
   */
  async listOrders(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString
      ? `${mestaConfig.endpoints.orders}?${queryString}`
      : mestaConfig.endpoints.orders;

    return this.request('GET', endpoint);
  }

  /**
   * Cancelar orden
   */
  async cancelOrder(orderId) {
    return this.request('POST', `${mestaConfig.endpoints.orderById(orderId)}/cancel`);
  }

  // ═══════════════════════════════════════════════════════════════
  // TRANSACTIONS (Transacciones)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Obtener transacción por ID
   */
  async getTransaction(transactionId) {
    return this.request('GET', mestaConfig.endpoints.transactionById(transactionId));
  }

  /**
   * Listar transacciones
   */
  async listTransactions(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString
      ? `${mestaConfig.endpoints.transactions}?${queryString}`
      : mestaConfig.endpoints.transactions;

    return this.request('GET', endpoint);
  }

  // ═══════════════════════════════════════════════════════════════
  // SENDERS (Remitentes)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Crear remitente
   */
  async createSender(senderData) {
    return this.request('POST', mestaConfig.endpoints.senders, senderData);
  }

  /**
   * Obtener remitente por ID
   */
  async getSender(senderId) {
    return this.request('GET', mestaConfig.endpoints.senderById(senderId));
  }

  /**
   * Listar remitentes
   */
  async listSenders(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString
      ? `${mestaConfig.endpoints.senders}?${queryString}`
      : mestaConfig.endpoints.senders;

    return this.request('GET', endpoint);
  }

  // ═══════════════════════════════════════════════════════════════
  // BENEFICIARIES (Beneficiarios)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Crear beneficiario
   */
  async createBeneficiary(beneficiaryData) {
    return this.request('POST', mestaConfig.endpoints.beneficiaries, beneficiaryData);
  }

  /**
   * Obtener beneficiario por ID
   */
  async getBeneficiary(beneficiaryId) {
    return this.request('GET', mestaConfig.endpoints.beneficiaryById(beneficiaryId));
  }

  /**
   * Listar beneficiarios
   */
  async listBeneficiaries(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString
      ? `${mestaConfig.endpoints.beneficiaries}?${queryString}`
      : mestaConfig.endpoints.beneficiaries;

    return this.request('GET', endpoint);
  }

  // ═══════════════════════════════════════════════════════════════
  // MERCHANTS (Cuenta del comerciante)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Obtener información del merchant
   */
  async getMerchant(merchantId) {
    return this.request('GET', mestaConfig.endpoints.merchantById(merchantId));
  }

  // ═══════════════════════════════════════════════════════════════
  // WEBHOOKS (Configuración)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Registrar webhook URL
   */
  async registerWebhook(webhookData) {
    return this.request('POST', mestaConfig.endpoints.webhooks, {
      url: webhookData.url,
      events: webhookData.events || ['*'], // Todos los eventos por defecto
      ...webhookData,
    });
  }

  /**
   * Listar webhooks configurados
   */
  async listWebhooks() {
    return this.request('GET', mestaConfig.endpoints.webhooks);
  }

  /**
   * Eliminar webhook
   */
  async deleteWebhook(webhookId) {
    return this.request('DELETE', mestaConfig.endpoints.webhookById(webhookId));
  }

  // ═══════════════════════════════════════════════════════════════
  // HEALTH CHECK
  // ═══════════════════════════════════════════════════════════════

  /**
   * Verificar conexión con Mesta
   */
  async healthCheck() {
    try {
      // Intentar listar webhooks como health check
      const result = await this.listWebhooks();
      return {
        success: true,
        env: mestaConfig.env,
        apiUrl: this.baseUrl,
        message: 'Conexión exitosa con Mesta',
      };
    } catch (error) {
      return {
        success: false,
        env: mestaConfig.env,
        apiUrl: this.baseUrl,
        error: error.message,
      };
    }
  }
}

// Singleton
const mestaClient = new MestaClient();

export default mestaClient;
export { MestaClient };
