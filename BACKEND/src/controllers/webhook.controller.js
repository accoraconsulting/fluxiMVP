/**
 * WEBHOOK CONTROLLER
 * Endpoints REST para recibir webhooks de Vitawallet
 */

import { webhookService } from '../services/vitawallet/index.js';

/**
 * POST /api/webhooks/vitawallet
 * Recibir y procesar webhooks de Vitawallet
 *
 * Headers:
 *   - x-vitawallet-signature: Firma HMAC-SHA256 del payload
 *
 * Body: {
 *   event: string,
 *   payin_id?: string,
 *   payment_id?: string,
 *   order_id?: string,
 *   amount?: number,
 *   currency?: string,
 *   status?: string,
 *   timestamp?: string,
 *   [otros campos según evento]
 * }
 */
export async function receiveWebhook(req, res) {
  try {
    const payload = req.body;
    const signature = req.headers['x-vitawallet-signature'];
    const { event } = payload;

    console.log(`[WebhookController] Webhook recibido: ${event}`);
    console.log(`[WebhookController] Validando firma...`);

    // Validar firma del webhook (si signature viene en header)
    if (signature) {
      const isValidSignature = webhookService.validateWebhookSignature(payload, signature);

      if (!isValidSignature) {
        console.warn(`[WebhookController] ✗ Firma inválida para evento: ${event}`);
        return res.status(401).json({
          success: false,
          error: 'Firma del webhook inválida',
        });
      }

      console.log(`[WebhookController] ✓ Firma validada`);
    } else {
      console.warn(`[WebhookController] ⚠️ Sin firma en webhook (dev mode)`);
    }

    // Procesar webhook
    const result = await webhookService.processWebhook(payload);

    if (!result.success) {
      console.error(`[WebhookController] Error procesando webhook:`, result.error);
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    console.log(`[WebhookController] ✓ Webhook procesado exitosamente`);

    // Retornar confirmación a Vitawallet
    res.json(webhookService.generateWebhookResponse(true));
  } catch (error) {
    console.error('[WebhookController] Error en receiveWebhook:', error);

    // Retornar error pero no fallar completamente (para que Vita no reintente)
    res.status(200).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * GET /api/webhooks/vitawallet/test
 * Endpoint de prueba para validar que el webhook funciona
 * (Útil para testing en sandbox)
 */
export async function testWebhook(req, res) {
  try {
    console.log(`[WebhookController] Webhook de prueba recibido`);

    const testPayload = {
      event: 'payin.completed',
      payin_id: 'TEST-PAYIN-123',
      payment_order_id: 'TEST-ORDER-456',
      amount: 1000,
      currency: 'USD',
      status: 'success',
      user_email: 'test@example.com',
      timestamp: new Date().toISOString(),
    };

    const result = await webhookService.processWebhook(testPayload);

    res.json({
      success: true,
      message: 'Webhook de prueba procesado exitosamente',
      test_payload: testPayload,
      result: result,
    });
  } catch (error) {
    console.error('[WebhookController] Error en testWebhook:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error procesando webhook de prueba',
    });
  }
}

/**
 * POST /api/webhooks/vitawallet/manual
 * Endpoint para simular webhooks manualmente (testing)
 *
 * Body: {
 *   event: string,
 *   [otros campos]
 * }
 */
export async function manualWebhook(req, res) {
  try {
    const payload = req.body;

    if (!payload.event) {
      return res.status(400).json({
        success: false,
        error: 'Campo "event" es requerido',
      });
    }

    console.log(`[WebhookController] Webhook manual recibido: ${payload.event}`);

    const result = await webhookService.processWebhook(payload);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    res.json({
      success: true,
      message: 'Webhook procesado exitosamente',
      event: payload.event,
      result: result,
    });
  } catch (error) {
    console.error('[WebhookController] Error en manualWebhook:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error procesando webhook',
    });
  }
}

/**
 * PATCH /api/webhooks/vitawallet/configure
 * Configurar webhook URL en Vita Wallet
 *
 * Solo admins pueden configurar webhooks
 *
 * Body: {
 *   webhook_url: string (HTTPS URL con ngrok o dominio real),
 *   categories: string[] (eventos a recibir: payment, deposit, etc.)
 * }
 *
 * Retorna: Confirmación de configuración en Vita Wallet
 */
export async function configureWebhook(req, res) {
  try {
    const adminId = req.user?.id;
    const adminRole = req.user?.role;
    const { webhook_url, categories } = req.body;

    // Solo admins
    if (adminRole !== 'fluxiAdmin' && adminRole !== 'fluxiDev') {
      return res.status(403).json({
        success: false,
        error: 'Solo administradores pueden configurar webhooks',
      });
    }

    // Validar datos
    if (!webhook_url || !categories || !Array.isArray(categories)) {
      return res.status(400).json({
        success: false,
        error: 'Campos requeridos: webhook_url (string), categories (array)',
      });
    }

    // Validar que sea HTTPS
    if (!webhook_url.startsWith('https://')) {
      return res.status(400).json({
        success: false,
        error: 'webhook_url debe ser HTTPS (para producción)',
      });
    }

    console.log(`[WebhookController] Configurando webhook...`);
    console.log(`  URL: ${webhook_url}`);
    console.log(`  Categorías: ${categories.join(', ')}`);
    console.log(`  Admin: ${adminId}`);

    // Llamar a webhookService para configurar en Vita Wallet
    const result = await webhookService.configureWebhookInVita(webhook_url, categories);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        details: result.details,
      });
    }

    console.log(`[WebhookController] ✅ Webhook configurado exitosamente en Vita Wallet`);

    res.json({
      success: true,
      message: 'Webhook configurado en Vita Wallet',
      webhook_url: result.webhook_url,
      categories: result.categories,
      configured_at: result.configured_at,
      configured_by: adminId,
    });

  } catch (error) {
    console.error('[WebhookController] Error en configureWebhook:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error configurando webhook',
    });
  }
}

/**
 * GET /api/webhooks/vitawallet/config
 * Obtener configuración actual de webhooks en Vita Wallet
 *
 * Solo admins
 */
export async function getWebhookConfig(req, res) {
  try {
    const adminRole = req.user?.role;
    const userId = req.user?.id;

    // Validar permiso
    if (adminRole !== 'fluxiAdmin' && adminRole !== 'fluxiDev') {
      console.warn(`[WebhookController] Acceso denegado para usuario: ${userId}`);
      return res.status(403).json({
        success: false,
        error: 'Solo administradores pueden ver configuración',
      });
    }

    console.log(`[WebhookController] Obteniendo configuración de webhook...`);

    // Llamar a servicio (con timeout de seguridad)
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), 5000)
    );

    const result = await Promise.race([
      webhookService.getWebhookConfigFromVita(),
      timeoutPromise
    ]);

    if (!result.success) {
      // Si falla, retornar config vacía (sin error crítico)
      console.warn(`[WebhookController] No se pudo obtener configuración de Vita:`, result.error);
      return res.json({
        success: true,
        webhook_url: null,
        configured_categories: [],
        available_categories: ['payment', 'deposit', 'withdrawal', 'transfer'],
        note: 'No configurado aún',
      });
    }

    res.json({
      success: true,
      webhook_url: result.webhook_url,
      configured_categories: result.configured_categories,
      available_categories: result.available_categories,
    });

  } catch (error) {
    console.error('[WebhookController] Error en getWebhookConfig:', error.message);
    // Retornar configuración vacía en caso de error (graceful degradation)
    res.json({
      success: true,
      webhook_url: null,
      configured_categories: [],
      available_categories: ['payment', 'deposit', 'withdrawal', 'transfer'],
      note: 'Configuración no disponible en este momento',
    });
  }
}
