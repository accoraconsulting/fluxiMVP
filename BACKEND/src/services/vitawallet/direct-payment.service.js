/**
 * DIRECT PAYMENT SERVICE
 * Procesa pagos directos sin redirección
 */

import client from './vitawallet.client.js';
import config from './vitawallet.config.js';
import { v4 as uuidv4 } from 'uuid';

class DirectPaymentService {
  /**
   * Procesa un pago directo
   * @param {Object} paymentData - Datos del pago
   *   - payment_order_id: ID de la orden de pago
   *   - method_id: ID del método de pago
   *   - payment_data: Datos específicos del método
   *   - user_id: ID del usuario en FLUXI (para tracking)
   *   - amount: Monto del pago
   *   - currency: Moneda (USD, COP, etc)
   * @returns {Promise<Object>} Resultado del pago
   */
  async processDirectPayment(paymentData) {
    try {
      const {
        payment_order_id, method_id, payment_data: methodPaymentData,
        user_id, amount, currency,
      } = paymentData;

      this.validatePaymentData(paymentData);

      // === MODO LOCAL: mock directo ===
      if (config.isLocal()) {
        const attemptId = `ATTEMPT-LOCAL-${uuidv4().substring(0, 12)}`;
        console.log(`[DIRECT_PAYMENT] LOCAL - Pago mock: ${attemptId}`);
        return {
          success: true,
          payment_order_id, user_id, amount, currency,
          attempt_id: attemptId,
          status: 'processing',
          payment_info: { provider_url: null, provider_payment_id: null },
          source: 'local-mock',
        };
      }

      // === MODO SANDBOX/PRODUCTION ===
      console.log(`[DIRECT_PAYMENT] Procesando pago directo - Order: ${payment_order_id}`);

      const endpoint = `/payment_orders/${payment_order_id}/direct_payment`;
      const response = await client.post(endpoint, { method_id, payment_data: methodPaymentData });

      return {
        success: true,
        payment_order_id, user_id, amount, currency,
        attempt_id: response.data.data?.attributes?.payment_order_attempt_id,
        status: response.data.data?.attributes?.status,
        payment_info: {
          provider_url: response.data.data?.attributes?.payment_info?.provider_url,
          provider_payment_id: response.data.data?.attributes?.payment_info?.provider_payment_id,
        },
        rawResponse: response.data,
      };
    } catch (error) {
      console.error(`[DIRECT_PAYMENT] Error:`, error.message);
      return { success: false, error: error.message, code: error.code };
    }
  }

  /**
   * Obtiene el estado de un intento de pago
   * @param {string} payment_order_id - ID de la orden
   * @param {string} attempt_id - ID del intento
   * @returns {Promise<Object>} Estado del pago
   */
  async getPaymentAttemptStatus(payment_order_id, attempt_id) {
    try {
      // === MODO LOCAL: mock directo ===
      if (config.isLocal()) {
        console.log(`[DIRECT_PAYMENT] LOCAL - Estado mock para attempt: ${attempt_id}`);
        return {
          success: true,
          payment_order_id,
          attempt_id,
          status: 'processing',
          payment_reference: null,
          payer: null,
          costs: null,
          redirect_urls: null,
          provider_data: null,
          source: 'local-mock',
        };
      }

      // === MODO SANDBOX/PRODUCTION ===
      console.log(`[DIRECT_PAYMENT] Obteniendo estado del intento - Order: ${payment_order_id}, Attempt: ${attempt_id}`);

      const endpoint = config.ENDPOINTS.GET_PAYMENT_ATTEMPT
        .replace('{payment_order_id}', payment_order_id)
        .replace('{attempt_id}', attempt_id);

      const response = await client.get(endpoint);

      return {
        success: true,
        payment_order_id,
        attempt_id,
        status: response.data.data?.attributes?.status,
        payment_reference: response.data.data?.attributes?.payment_reference,
        payer: response.data.data?.attributes?.payer,
        costs: response.data.data?.attributes?.costs,
        redirect_urls: response.data.data?.attributes?.redirect_urls,
        provider_data: response.data.data?.attributes?.provider_data,
        rawResponse: response.data,
      };
    } catch (error) {
      console.error(`[DIRECT_PAYMENT] Error:`, error.message);
      return { success: false, error: error.message, code: error.code };
    }
  }

  /**
   * Valida los datos del pago
   * @param {Object} paymentData - Datos a validar
   * @throws {Error} Si faltan datos requeridos
   */
  validatePaymentData(paymentData) {
    const required = ['payment_order_id', 'method_id', 'payment_data', 'user_id', 'amount', 'currency'];

    for (const field of required) {
      if (!paymentData[field]) {
        throw new Error(`Campo requerido faltante: ${field}`);
      }
    }

    // Validar que payment_data sea un objeto
    if (typeof paymentData.payment_data !== 'object') {
      throw new Error('payment_data debe ser un objeto');
    }

    // Validar monto
    if (typeof paymentData.amount !== 'number' || paymentData.amount <= 0) {
      throw new Error('Monto debe ser un número positivo');
    }
  }

  /**
   * Valida campos de pago según el método
   * @param {string} method - Nombre del método
   * @param {Object} paymentData - Datos a validar
   * @returns {Object} { isValid: boolean, errors: [] }
   */
  validateMethodPaymentData(method, paymentData) {
    const errors = [];
    const methodUpper = method.toUpperCase();

    const validationRules = {
      PSE: {
        required: ['bank_id', 'document_number', 'document_type', 'first_name', 'last_name', 'phone'],
      },
      NEQUI: {
        required: ['phone', 'email'],
      },
      DAVIPLATA: {
        required: ['document_type', 'document_number', 'email'],
      },
      BANCOLOMBIA: {
        required: ['email'],
      },
      TDC: {
        required: ['card_number', 'cvc', 'exp_month', 'exp_year', 'card_holder', 'installments', 'email'],
      },
      BNPL: {
        required: ['first_name', 'last_name', 'document_number', 'document_type', 'phone'],
      },
    };

    const rules = validationRules[methodUpper];

    if (!rules) {
      errors.push(`Método ${method} no reconocido`);
      return { isValid: false, errors };
    }

    // Validar campos requeridos
    for (const field of rules.required) {
      if (!paymentData[field]) {
        errors.push(`Campo requerido para ${method}: ${field}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
    };
  }
}

export default new DirectPaymentService();
