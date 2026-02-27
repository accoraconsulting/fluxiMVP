/**
 * PAYIN ROUTES
 * Rutas para endpoints de pagos entrantes (Payins)
 */

import express from 'express';
import { authRequired } from '../middlewares/auth.middleware.js';
import {
  getPaymentMethods,
  generatePaymentLink,
  getPayinStatus,
  validatePaymentData,
  getPayinPrices,
  getPayinRequests,
  approvePayinRequest,
  rejectPayinRequest,
  getPayinEvents,
} from '../controllers/payin.controller.js';
import {
  receiveWebhook,
  testWebhook,
  manualWebhook,
} from '../controllers/webhook.controller.js';

const router = express.Router();

// ===== DEBUG ENDPOINTS (TESTING) =====

/**
 * GET /api/payin-test
 * Endpoint de test para verificar autenticación
 */
router.get('/payin-test', authRequired, (req, res) => {
  res.json({
    success: true,
    message: 'Autenticación funcionando',
    user: req.user,
    headers: {
      authorization: req.headers.authorization ? 'Present' : 'Missing',
    },
  });
});

/**
 * GET /api/vitawallet-debug
 * Endpoint DEBUG para ver exactamente qué pasa con Vita Wallet
 * SIN AUTENTICACIÓN - Solo para debugging
 */
router.get('/vitawallet-debug', async (req, res) => {
  try {
    const { default: vitaClient } = await import('../services/vitawallet/vitawallet.client.js');
    const { default: config } = await import('../services/vitawallet/vitawallet.config.js');

    const debugInfo = {
      mode: config.MODE,
      environment: config.ENVIRONMENT,
      baseUrl: config[config.ENVIRONMENT].BASE_URL,
      hasLogin: !!config[config.ENVIRONMENT].LOGIN,
      hasSecret: !!config[config.ENVIRONMENT].SECRET_KEY,
      loginLength: config[config.ENVIRONMENT].LOGIN?.length || 0,
      secretKeyLength: config[config.ENVIRONMENT].SECRET_KEY?.length || 0,
    };

    // Intentar hacer UN request simple
    try {
      console.log('[DEBUG] Intentando GET /prices...');
      const response = await vitaClient.get('/prices');
      debugInfo.pricesTest = { success: true, status: response.status };
    } catch (error) {
      debugInfo.pricesTest = {
        success: false,
        status: error.status,
        error: error.error,
        message: error.message
      };
    }

    res.json({
      success: true,
      debug: debugInfo,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

/**
 * GET /api/vitawallet-debug-payin
 * TEST: Intenta crear un payin directamente para ver el error exacto
 */
router.get('/vitawallet-debug-payin', async (req, res) => {
  try {
    const { default: vitaClient } = await import('../services/vitawallet/vitawallet.client.js');
    const { default: config } = await import('../services/vitawallet/vitawallet.config.js');

    const testPayinData = {
      amount: 100000,
      country_iso_code: 'CO',
      issue: 'DEBUG TEST PAYIN',
      success_redirect_url: 'http://localhost:5500/success',
      cancel_redirect_url: 'http://localhost:5500/cancel',
      error_redirect_url: 'http://localhost:5500/error',
      pending_redirect_url: 'http://localhost:5500/pending',
    };

    console.log('[DEBUG-PAYIN] Intentando crear payin con datos:', testPayinData);

    try {
      const response = await vitaClient.post('/payment_orders', testPayinData);
      console.log('[DEBUG-PAYIN] ✅ Éxito:', response);

      res.json({
        success: true,
        message: 'PAYIN CREADO EXITOSAMENTE',
        response: response.data,
      });
    } catch (payinError) {
      console.error('[DEBUG-PAYIN] ❌ Error detallado:', payinError);

      res.json({
        success: false,
        message: 'ERROR creando payin',
        error: {
          status: payinError.status,
          error: payinError.error,
          data: payinError.data,
          endpoint: payinError.endpoint,
        },
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/vitawallet-test
 * Endpoint para probar conectividad con Vitawallet SANDBOX
 * ⚠️ SOLO PARA DESARROLLO - Testa endpoints de Vitawallet
 */
router.get('/vitawallet-test', authRequired, async (req, res) => {
  try {
    console.log('[VitawalletTest] ⚙️ Iniciando prueba de Vitawallet...');

    // Importar dinámicamente para evitar errores de circular dependency
    const { default: vitaClient } = await import('../services/vitawallet/vitawallet.client.js');
    const { default: config } = await import('../services/vitawallet/vitawallet.config.js');

    // Test 1: GET /api/businesses/prices
    console.log('[VitawalletTest] Test 1: Obteniendo precios...');
    const pricesResponse = await vitaClient.get('/prices');
    console.log('[VitawalletTest] ✅ Respuesta de precios:', pricesResponse.status);

    // Test 2: GET /api/businesses/payins_prices
    console.log('[VitawalletTest] Test 2: Obteniendo precios de payins...');
    const payinPricesResponse = await vitaClient.get('/payins_prices');
    console.log('[VitawalletTest] ✅ Respuesta de payin prices:', payinPricesResponse.status);

    // Test 3: GET /api/businesses/payment_methods/CO
    console.log('[VitawalletTest] Test 3: Obteniendo métodos de pago (CO)...');
    const methodsResponse = await vitaClient.get('/payment_methods/CO');
    console.log('[VitawalletTest] ✅ Respuesta de métodos:', methodsResponse.status);

    res.json({
      success: true,
      message: 'Vitawallet SANDBOX está respondiendo correctamente',
      tests: {
        prices: { status: pricesResponse.status, ok: true },
        payinPrices: { status: payinPricesResponse.status, ok: true },
        methods: { status: methodsResponse.status, ok: true },
      },
      config: {
        environment: config.ENVIRONMENT,
        baseUrl: config[config.ENVIRONMENT].BASE_URL,
        hasCredentials: !!config[config.ENVIRONMENT].LOGIN,
      },
    });
  } catch (error) {
    console.error('[VitawalletTest] ❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      hint: 'Verifica que las credenciales de Vitawallet en .env sean válidas',
      config: {
        environment: config?.ENVIRONMENT,
        baseUrl: config?.[config?.ENVIRONMENT]?.BASE_URL,
      },
    });
  }
});

// ===== PAYMENT METHODS (SIN AUTENTICACIÓN - PÚBLICOS) =====

/**
 * GET /api/payment-links/methods/:country
 * Obtener métodos de pago disponibles
 */
router.get('/payment-links/methods/:country', getPaymentMethods);

/**
 * GET /api/payment-links/prices/:country
 * Obtener información de precios/comisiones
 */
router.get('/payment-links/prices/:country', getPayinPrices);

/**
 * POST /api/payment-links/validate
 * Validar datos de pago
 */
router.post('/payment-links/validate', validatePaymentData);

// ===== PAYIN REQUESTS - CRUD (REQUIEREN AUTENTICACIÓN) =====

/**
 * GET /api/payin-requests
 * Listar solicitudes de payins (admin ve todos, user ve los suyos)
 */
router.get('/payin-requests', authRequired, getPayinRequests);

/**
 * PATCH /api/payin-requests/:id/approve
 * Aprobar un payin pendiente (solo admin)
 */
router.patch('/payin-requests/:id/approve', authRequired, approvePayinRequest);

/**
 * PATCH /api/payin-requests/:id/reject
 * Rechazar un payin pendiente (solo admin)
 */
router.patch('/payin-requests/:id/reject', authRequired, rejectPayinRequest);

/**
 * GET /api/payin-events
 * Obtener eventos recientes de payins (para real-time updates)
 */
router.get('/payin-events', authRequired, getPayinEvents);

// ===== PAYMENT LINKS (REQUIEREN AUTENTICACIÓN) =====

/**
 * POST /api/payment-links/generate
 * Generar link de pago
 */
router.post('/payment-links/generate', authRequired, generatePaymentLink);

/**
 * GET /api/payment-links/:payin_id
 * Obtener estado de un payin
 * NOTA: Esta ruta con parámetro debe estar AL FINAL para no capturar otras rutas
 */
router.get('/payment-links/:payin_id', authRequired, getPayinStatus);

// ===== WEBHOOKS =====

/**
 * POST /api/webhooks/vitawallet
 * Recibir webhooks de Vitawallet (SIN AUTENTICACIÓN)
 */
router.post('/webhooks/vitawallet', receiveWebhook);

/**
 * GET /api/webhooks/vitawallet/test
 * Endpoint de prueba (SIN AUTENTICACIÓN)
 */
router.get('/webhooks/vitawallet/test', testWebhook);

/**
 * POST /api/webhooks/vitawallet/manual
 * Simular webhooks manualmente (SIN AUTENTICACIÓN - solo para testing)
 */
router.post('/webhooks/vitawallet/manual', manualWebhook);

export default router;
