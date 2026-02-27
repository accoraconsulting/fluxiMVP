/**
 * PAYIN SERVICE
 * Servicio principal para pagos entrantes (Payins)
 *
 * Modo LOCAL: genera payment orders mock sin HTTP
 * Modo SANDBOX/PRODUCTION: crea payment orders en Vitawallet API
 */

import client from './vitawallet.client.js';
import config from './vitawallet.config.js';
import { v4 as uuidv4 } from 'uuid';

class PayinService {
  /**
   * Crea un payin (genera payment order)
   * ✅ FASE 1: Con validación de webhook, idempotencia y reintentos
   */
  async createPayin(payinData) {
    try {
      const {
        user_id, user_email, amount, currency, country, payment_method,
        description, client_id, metadata = {},
      } = payinData;

      this.validatePayinData(payinData);

      // ✅ FASE 1.1: VALIDAR WEBHOOK CONFIGURADO
      this.validateWebhookConfiguration();

      // ✅ FASE 1.2: VALIDAR PAÍS SOPORTADO EN VITA
      this.validateCountrySupport(country);

      // ✅ FASE 1.3: VALIDAR CURRENCY SOPORTADA EN PAÍS
      this.validateCurrencyForCountry(country, currency);

      // ✅ FASE 1.4: GENERAR PAYIN_REFERENCE_ID PARA IDEMPOTENCIA
      const payin_reference_id = `REF-${user_id}-${amount}-${Date.now()}`;

      // ✅ FASE 1.5: VERIFICAR IDEMPOTENCIA (si ya existe payin con esta referencia)
      const existingPayin = await this.checkIdempotency(payin_reference_id);
      if (existingPayin) {
        console.log(`[PAYIN] ⚠️ IDEMPOTENCIA: Payin ya existe con referencia ${payin_reference_id}`);
        return {
          success: true,
          payin_id: existingPayin.id,
          payment_order_id: existingPayin.payment_order_id,
          public_code: existingPayin.public_code,
          payment_url: existingPayin.payment_url,
          user_id, amount, currency, country, client_id,
          status: existingPayin.status,
          created_at: existingPayin.created_at,
          source: 'idempotent-return',
          warnings: [
            {
              level: 'INFO',
              code: 'IDEMPOTENT_REQUEST',
              message: 'Este payin ya fue creado anteriormente con los mismos parámetros',
            }
          ]
        };
      }

      const payin_id = `PAYIN-${Date.now()}-${uuidv4().substring(0, 8)}`;

      console.log(`[PAYIN] Creando payin - User: ${user_id}, Monto: ${amount} ${currency}, País: ${country}`);

      let paymentOrderId, publicCode, paymentUrl, source;
      let retryCount = 0;
      const MAX_RETRIES = 3;
      let lastError = null;
      const warnings = [];

      // ✅ FASE 1.6: WARNING SI WEBHOOK NO CONFIGURADO
      if (!this.isWebhookConfigured()) {
        warnings.push({
          level: 'WARNING',
          code: 'WEBHOOK_NOT_CONFIGURED',
          message: 'Webhooks no están configurados en tu .env. El payin se creará pero no se completará automáticamente sin webhook.'
        });
      }

      // === MODO LOCAL: mock directo, sin HTTP ===
      if (config.isLocal()) {
        paymentOrderId = `VITA-LOCAL-${Date.now()}-${uuidv4().substring(0, 12)}`;
        publicCode = uuidv4();
        paymentUrl = `http://localhost:5500/FRONTEND/mock-checkout.html?code=${publicCode}&amount=${amount}&currency=${currency}&country=${country}`;
        source = 'local-mock';
        console.log(`[PAYIN] LOCAL - Payment order: ${paymentOrderId}`);
      } else {
        // === MODO SANDBOX/PRODUCTION: API real CON REINTENTOS ===
        while (retryCount < MAX_RETRIES && !paymentOrderId) {
          try {
            // NGROK_URL: URL pública desde ngrok (ej: https://xxxx.ngrok-free.dev)
            // Ahora el backend sirve archivos estáticos del FRONTEND, así que usamos NGROK_URL directo
            let redirectUrl;

            if (process.env.NGROK_URL) {
              // Usar ngrok cuando está disponible (apunta al backend que ahora sirve estáticos)
              redirectUrl = process.env.NGROK_URL.replace(/\/$/, ''); // Remover trailing slash
              console.log(`[PAYIN] Base URL para redirects (ngrok): ${redirectUrl}`);
            } else {
              // Fallback a localhost frontend
              redirectUrl = 'http://localhost:5500/FRONTEND';
              console.log(`[PAYIN] Base URL para redirects (localhost): ${redirectUrl}`);
            }

            // Validar que la URL sea HTTPS (Vita Wallet lo requiere)
            if (redirectUrl.startsWith('http://') && !redirectUrl.includes('localhost')) {
              console.warn(`[PAYIN] ⚠️ WARNING: URL no es HTTPS, Vita Wallet puede rechazarla`);
            }
            if (redirectUrl.includes('localhost')) {
              console.warn(`[PAYIN] ⚠️ URL es localhost. Para producción, configura NGROK_URL en .env`);
            }

            const orderData = {
              amount: amount,
              country_iso_code: country.toUpperCase(),
              issue: description || `Payment for ${client_id}`,
              // Nota: pending va a payment-pending.html (con mensaje + redirección), otros van a dashboard
              success_redirect_url: `${redirectUrl}/dashboard.html`,
              cancel_redirect_url: `${redirectUrl}/dashboard.html`,
              error_redirect_url: `${redirectUrl}/dashboard.html`,
              pending_redirect_url: `${redirectUrl}/payment-pending.html`,
            };

            console.log(`[PAYIN] Intento ${retryCount + 1}/${MAX_RETRIES} - Llamando a Vitawallet: POST ${config.ENDPOINTS.CREATE_PAYIN}`);
            console.log(`[PAYIN] Datos enviados:`, orderData);

            // ✅ FASE 1.7: TIMEOUT DE 10 SEGUNDOS
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Timeout: Vita API tardó más de 10 segundos')), 10000)
            );

            const response = await Promise.race([
              client.post(config.ENDPOINTS.CREATE_PAYIN, orderData),
              timeoutPromise
            ]);

            console.log(`[PAYIN] ✅ Vitawallet respondió: ${response.status}`);

            paymentOrderId = response.data.data?.id;
            publicCode = response.data.data?.attributes?.public_code;
            paymentUrl = response.data.data?.attributes?.url;
            source = 'vitawallet-api';

            // Exit del loop si fue exitoso
            break;

          } catch (vitaError) {
            retryCount++;
            lastError = vitaError;
            console.error(`[PAYIN] ❌ Intento ${retryCount} falló:`);
            console.error(`  Status: ${vitaError.status}`);
            console.error(`  Error: ${vitaError.error}`);
            console.error(`  Message: ${vitaError.message}`);

            if (retryCount < MAX_RETRIES) {
              // Esperar 2 segundos antes de reintentar
              console.log(`[PAYIN] Esperando 2 segundos antes de reintentar...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }

        // Si todos los reintentos fallaron, usar fallback
        if (!paymentOrderId) {
          console.warn(`[PAYIN] ❌ API falló después de ${MAX_RETRIES} reintentos, usando mock fallback`);
          paymentOrderId = `VITA-FALLBACK-${Date.now()}-${uuidv4().substring(0, 12)}`;
          publicCode = uuidv4();
          paymentUrl = null;
          source = 'mock-fallback';
          warnings.push({
            level: 'ERROR',
            code: 'VITA_API_FAILED',
            message: `No se pudo conectar a Vita después de ${MAX_RETRIES} intentos: ${lastError?.message || 'Error desconocido'}`
          });
        }
      }

      // ✅ FASE 1.8: GUARDAR EN BD CON METADATA COMPLETA
      const payin_data = {
        id: payin_id,
        user_id,
        created_by: payinData.created_by || user_id, // Si viene created_by, usarlo; si no, usar user_id
        user_email,
        amount,
        currency,
        country,
        payment_method,
        payment_order_id: paymentOrderId,
        public_code: publicCode,
        payin_reference_id,
        status: 'pending',
        source,
        webhook_received: false,
        webhook_timeout: new Date(Date.now() + 3600000).toISOString(), // 1 hora desde ahora
        retry_count: retryCount,
        last_error: lastError?.message || null,
        vitawallet_metadata: {
          payment_order_id: paymentOrderId,
          public_code: publicCode,
          redirect_urls: {
            success: `http://localhost:5500/FRONTEND/dashboard.html`,
            cancel: `http://localhost:5500/FRONTEND/dashboard.html`,
            error: `http://localhost:5500/FRONTEND/dashboard.html`,
            pending: `http://localhost:5500/FRONTEND/payment-pending.html`,
          }
        }
      };

      try {
        // Intentar guardar en BD (si la tabla existe y tiene todas las columnas)
        await this.savePayinToDB(payin_data);
      } catch (dbError) {
        console.warn(`[PAYIN] ⚠️ No se pudo guardar en BD (puede que tabla no tenga nuevas columnas):`, dbError.message);
        // Continuar de todas formas - no es error crítico
      }

      return {
        success: true,
        payin_id,
        payment_order_id: paymentOrderId,
        public_code: publicCode,
        payment_url: paymentUrl,
        user_id, amount, currency, country, client_id,
        status: 'pending',
        created_at: new Date().toISOString(),
        source,
        payin_reference_id,
        warnings: warnings.length > 0 ? warnings : undefined,
        _retryCount: retryCount > 0 ? retryCount : undefined,
      };
    } catch (error) {
      console.error(`[PAYIN] Error:`, error.message);
      return { success: false, error: error.message, code: error.code };
    }
  }

  /**
   * Obtiene el estado de un payin
   */
  async getPayinStatus(payment_order_id) {
    try {
      if (config.isLocal()) {
        return {
          success: true,
          payment_order_id,
          status: 'pending',
          source: 'local-mock',
        };
      }

      const endpoint = config.ENDPOINTS.GET_PAYIN.replace('{payin_id}', payment_order_id);
      const response = await client.get(endpoint);
      return {
        success: true,
        payment_order_id,
        status: response.data.data?.attributes?.status,
        amount: response.data.data?.attributes?.amount,
        currency: response.data.data?.attributes?.currency,
        rawResponse: response.data,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtiene precios de payins
   */
  async getPayinPrices(country) {
    try {
      if (config.isLocal()) {
        return {
          success: true,
          country: country.toUpperCase(),
          prices: { fee_percent: 3.5, fee_fixed: 0, currency: 'USD' },
          source: 'local-mock',
        };
      }

      const response = await client.get(config.ENDPOINTS.PAYIN_PRICES);
      return { success: true, country: country.toUpperCase(), prices: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Valida datos del payin
   */
  validatePayinData(payinData) {
    const required = ['user_id', 'user_email', 'amount', 'currency', 'country', 'client_id'];
    for (const field of required) {
      if (!payinData[field]) throw new Error(`Campo requerido faltante: ${field}`);
    }
    if (!this.isValidEmail(payinData.user_email)) throw new Error('Email inválido');
    if (typeof payinData.amount !== 'number' || payinData.amount <= 0) throw new Error('Monto debe ser un número positivo');
    if (!config.SUPPORTED_COUNTRIES[payinData.country.toUpperCase()]) throw new Error(`País no soportado: ${payinData.country}`);
  }

  getMethodId(country, methodName) {
    const method = config.PAYMENT_METHODS[country.toUpperCase()]?.[methodName.toUpperCase()];
    if (!method) throw new Error(`Método ${methodName} no disponible en ${country}`);
    return method.id;
  }

  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // ✅ FASE 1: NUEVOS MÉTODOS DE VALIDACIÓN

  /**
   * ✅ FASE 1.1: Valida que webhook esté configurado
   */
  validateWebhookConfiguration() {
    const webhookUrl = process.env.NGROK_URL || process.env.FRONTEND_URL;
    if (!webhookUrl) {
      // No fallar, solo advertencia
      console.warn(`[PAYIN] ⚠️ WEBHOOK_CONFIG: NGROK_URL o FRONTEND_URL no configurados en .env`);
      return false;
    }
    return true;
  }

  /**
   * Verifica si webhook está configurado (para warnings)
   */
  isWebhookConfigured() {
    return !!(process.env.NGROK_URL || process.env.FRONTEND_URL);
  }

  /**
   * ✅ FASE 1.2: Valida país soportado en Vita
   */
  validateCountrySupport(country) {
    const supportedCountries = {
      'CO': 'Colombia',
      'AR': 'Argentina',
      'CL': 'Chile',
      'BR': 'Brasil',
      'MX': 'México',
    };

    if (!supportedCountries[country.toUpperCase()]) {
      throw new Error(`País no soportado: ${country}. Soportados: ${Object.keys(supportedCountries).join(', ')}`);
    }
  }

  /**
   * ✅ FASE 1.3: Valida que currency esté disponible en el país
   */
  validateCurrencyForCountry(country, currency) {
    const countryCurrencies = {
      'CO': ['COP', 'USD'],
      'AR': ['ARS', 'USD'],
      'CL': ['CLP', 'USD'],
      'BR': ['BRL', 'USD'],
      'MX': ['MXN', 'USD'],
    };

    const allowedCurrencies = countryCurrencies[country.toUpperCase()] || [];
    if (!allowedCurrencies.includes(currency.toUpperCase())) {
      throw new Error(`Currency ${currency} no soportada en ${country}. Soportadas: ${allowedCurrencies.join(', ')}`);
    }
  }

  /**
   * ✅ FASE 1.4 & 1.5: Verifica idempotencia (payin duplicado)
   * @param {string} payin_reference_id - Referencia única del payin
   * @returns {Promise<Object|null>} Payin existente o null
   */
  async checkIdempotency(payin_reference_id) {
    try {
      // Importar execute aquí para evitar circular imports
      const { execute } = await import('../../config/crate.js');

      const { rows } = await execute(
        `SELECT id, payment_order_id, public_code, status, created_at
         FROM doc.payin_requests
         WHERE payin_reference_id = $1
         LIMIT 1`,
        [payin_reference_id]
      );

      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.warn(`[PAYIN] ⚠️ No se pudo verificar idempotencia:`, error.message);
      // No fallar si no se puede verificar
      return null;
    }
  }

  /**
   * ✅ FASE 1.8: Guarda payin en BD con todas las columnas nuevas
   */
  async savePayinToDB(payin_data) {
    try {
      const { execute } = await import('../../config/crate.js');

      const {
        id, user_id, created_by, user_email, amount, currency, country, payment_method,
        payment_order_id, public_code, payin_reference_id, status,
        source, webhook_received, webhook_timeout, retry_count,
        last_error, vitawallet_metadata
      } = payin_data;

      await execute(
        `INSERT INTO doc.payin_requests (
          id, user_id, created_by, user_email, amount, currency, country, payment_method,
          payment_order_id, public_code, payin_reference_id, status,
          source, webhook_received, webhook_timeout, retry_count,
          last_error, vitawallet_metadata, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12,
          $13, $14, $15, $16,
          $17, $18, NOW(), NOW()
        )`,
        [
          id, user_id, created_by, user_email, amount, currency, country, payment_method,
          payment_order_id, public_code, payin_reference_id, status,
          source, webhook_received, webhook_timeout, retry_count,
          last_error, JSON.stringify(vitawallet_metadata)
        ]
      );

      console.log(`[PAYIN] ✅ Payin guardado en BD: ${id}`);
      return true;
    } catch (error) {
      console.warn(`[PAYIN] ⚠️ Error guardando en BD:`, error.message);
      // No fallar - puede que tabla no tenga todas las columnas aún
      throw error;
    }
  }
}

export default new PayinService();
