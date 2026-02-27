/**
 * PAYMENT METHODS SERVICE
 * Obtiene métodos de pago disponibles por país
 *
 * Modo LOCAL: retorna datos mock directamente (sin HTTP)
 * Modo SANDBOX/PRODUCTION: consulta API de Vitawallet
 */

import client from './vitawallet.client.js';
import config from './vitawallet.config.js';

class PaymentMethodsService {
  /**
   * Obtiene métodos de pago disponibles para un país
   */
  async getPaymentMethods(country) {
    try {
      const countryCode = country.toUpperCase();

      if (!config.SUPPORTED_COUNTRIES[countryCode]) {
        throw new Error(`País no soportado: ${country}. Soportados: ${Object.keys(config.SUPPORTED_COUNTRIES).join(', ')}`);
      }

      // === MODO LOCAL: retornar mock directo, sin HTTP ===
      if (config.isLocal()) {
        const mockMethods = this.getMockPaymentMethods(countryCode);
        console.log(`[PAYMENT_METHODS] LOCAL - ${mockMethods.length} métodos para ${countryCode}`);
        return {
          success: true,
          country: countryCode,
          methods: mockMethods,
          source: 'local-mock',
        };
      }

      // === MODO SANDBOX/PRODUCTION: llamar API real ===
      const endpoint = config.ENDPOINTS.PAYMENT_METHODS.replace('{country}', countryCode);
      console.log(`[PAYMENT_METHODS] Llamando a Vitawallet: ${endpoint}`);

      try {
        const response = await client.get(endpoint);
        console.log(`[PAYMENT_METHODS] ${response.data.payment_methods?.length || 0} métodos desde API`);
        return {
          success: true,
          country: countryCode,
          methods: response.data.payment_methods || [],
          source: 'vitawallet-api',
        };
      } catch (apiError) {
        console.warn(`[PAYMENT_METHODS] API falló (${apiError.status}), usando mock`);
        return {
          success: true,
          country: countryCode,
          methods: this.getMockPaymentMethods(countryCode),
          source: 'mock-fallback',
        };
      }
    } catch (error) {
      return {
        success: false,
        country: country.toUpperCase(),
        methods: [],
        error: error.message,
      };
    }
  }

  /**
   * Métodos de pago mock por país
   */
  getMockPaymentMethods(countryCode) {
    const mockMethodsByCountry = {
      CO: [
        { method_id: 'PSE', name: 'PSE', description: 'Transferencia bancaria instantánea', required_fields: ['bank_id', 'document_number', 'document_type'] },
        { method_id: 'NEQUI', name: 'Nequi', description: 'Billetera digital', required_fields: ['phone', 'email'] },
        { method_id: 'DAVIPLATA', name: 'Daviplata', description: 'Billetera digital Davivienda', required_fields: ['document_type', 'document_number'] },
        { method_id: 'TDC', name: 'Tarjeta de Crédito/Débito', description: 'Visa, MasterCard, American Express', required_fields: ['card_number', 'cvc', 'exp_month', 'exp_year'] },
      ],
      AR: [
        { method_id: 'KHIPU', name: 'Khipu', description: 'Transferencia bancaria Argentina', required_fields: ['bank_id'] },
        { method_id: 'TDC', name: 'Tarjeta de Crédito/Débito', description: 'Visa, MasterCard', required_fields: ['card_number', 'cvc'] },
      ],
      CL: [
        { method_id: 'KHIPU', name: 'Khipu', description: 'Transferencia bancaria Chile', required_fields: ['bank_id'] },
        { method_id: 'WEBPAY', name: 'Webpay', description: 'Sistema de pagos chileno', required_fields: ['email'] },
      ],
      BR: [
        { method_id: 'PIX', name: 'PIX QR', description: 'Sistema de pagos brasileño PIX', required_fields: ['pix_key'] },
        { method_id: 'TDC', name: 'Tarjeta de Crédito/Débito', description: 'Visa, MasterCard', required_fields: ['card_number', 'cvc'] },
      ],
      MX: [
        { method_id: 'BITSO', name: 'Bitso One-time CLABE', description: 'Sistema de pagos mexicano', required_fields: ['email'] },
        { method_id: 'TDC', name: 'Tarjeta de Crédito/Débito', description: 'Visa, MasterCard', required_fields: ['card_number', 'cvc'] },
      ],
    };
    return mockMethodsByCountry[countryCode] || [];
  }

  /**
   * Obtiene métodos para todos los países
   */
  async getAllPaymentMethods() {
    const countries = Object.keys(config.SUPPORTED_COUNTRIES);
    const results = {};
    for (const country of countries) {
      results[country] = await this.getPaymentMethods(country);
    }
    return { success: true, countries: countries.length, methods: results };
  }

  /**
   * Info de un método específico
   */
  async getPaymentMethod(country, methodName) {
    const countryCode = country.toUpperCase();
    const methodKey = methodName.toUpperCase();
    const method = config.PAYMENT_METHODS[countryCode]?.[methodKey];
    if (!method) return { success: false, error: `Método ${methodName} no disponible en ${country}` };
    return { success: true, country: countryCode, method };
  }

  isValidPaymentMethod(country, methodName) {
    return !!(config.PAYMENT_METHODS[country.toUpperCase()]?.[methodName.toUpperCase()]);
  }

  async getRequiredFields(country, methodName) {
    const methodKey = methodName.toUpperCase();
    const requiredFieldsByMethod = {
      PSE: ['bank_id', 'document_number', 'document_type', 'first_name', 'last_name', 'phone'],
      NEQUI: ['phone', 'email'],
      DAVIPLATA: ['document_type', 'document_number', 'email'],
      BANCOLOMBIA: ['email'],
      TDC: ['card_number', 'cvc', 'exp_month', 'exp_year', 'card_holder', 'installments', 'email'],
      BNPL: ['first_name', 'last_name', 'document_number', 'document_type', 'phone'],
      KHIPU: ['first_name', 'last_name', 'email'],
      WEBPAY: ['first_name', 'last_name', 'email'],
      PIX: ['document_number', 'email', 'first_name', 'last_name'],
    };
    return { success: true, country: country.toUpperCase(), method: methodKey, fields: requiredFieldsByMethod[methodKey] || [] };
  }
}

export default new PaymentMethodsService();
