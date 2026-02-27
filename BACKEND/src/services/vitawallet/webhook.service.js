/**
 * WEBHOOK SERVICE
 * Procesa webhooks recibidos desde Vitawallet
 */

import crypto from 'crypto';
import config from './vitawallet.config.js';
import { execute } from '../../config/crate.js';
import client from './vitawallet.client.js';

class WebhookService {
  /**
   * Valida que el webhook viene realmente de Vitawallet
   * @param {Object} payload - Payload del webhook
   * @param {string} signature - Signature enviada por Vitawallet
   * @returns {boolean} True si la firma es válida
   */
  validateWebhookSignature(payload, signature) {
    try {
      const webhookSecret = config[config.ENVIRONMENT].WEBHOOK_SECRET;

      // Crear firma local
      const payloadString = JSON.stringify(payload);
      const computedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payloadString)
        .digest('hex');

      // Comparar firmas (timing-safe comparison)
      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(computedSignature, 'hex')
      );

      console.log(`[WEBHOOK] Validación de firma: ${isValid ? '✓ Válida' : '✗ Inválida'}`);

      return isValid;
    } catch (error) {
      console.error(`[WEBHOOK] Error validando firma:`, error.message);
      return false;
    }
  }

  /**
   * Procesa un webhook de payin completado
   * Actualiza BD, wallet, y crea ledger entries
   * @param {Object} webhookData - Datos del webhook
   * @returns {Promise<Object>} Resultado del procesamiento
   */
  async handlePayinCompleted(webhookData) {
    try {
      const {
        event,
        payin_id,
        payment_order_id,
        amount,
        currency,
        status,
        user_email,
        timestamp,
        id: webhookId,
      } = webhookData;

      console.log(`[WEBHOOK] Procesando payin completado...`);
      console.log(`  - Payin ID: ${payin_id}`);
      console.log(`  - Status: ${status}`);
      console.log(`  - Monto: ${amount} ${currency}`);

      // Validar datos
      if (!status) {
        throw new Error('Datos incompletos en webhook');
      }

      // Si el status es 'completed' o 'success', procesar completamente
      if (status === 'completed' || status === 'success' || status === 'sent') {
        console.log(`[WEBHOOK] Status exitoso, completando payin...`);

        // Completar payin y actualizar wallet
        const completeResult = await this.completePayin(
          payment_order_id || payin_id,
          webhookData
        );

        if (!completeResult.success) {
          console.warn(`[WEBHOOK] Payin no completado:`, completeResult.error);
        }

        // Guardar evento en auditoría
        await this.saveWebhookEvent(webhookId || event, webhookData, 'processed');

        return {
          success: true,
          event: event,
          payin_id: payin_id,
          payment_order_id: payment_order_id,
          amount: amount,
          currency: currency,
          status: 'completed',
          user_email: user_email,
          timestamp: timestamp,
          processed_at: new Date().toISOString(),
          wallet_updated: completeResult.success,
          user_id: completeResult.user_id,
        };
      } else if (status === 'pending' || status === 'checking') {
        // Webhook de estado pendiente/verificación
        console.log(`[WEBHOOK] Status pendiente, esperando confirmación...`);

        // Guardar evento de estado pendiente
        await this.saveWebhookEvent(webhookId || event, webhookData, 'pending');

        return {
          success: true,
          event: event,
          payin_id: payin_id,
          status: status,
          message: 'Pago pendiente, esperando confirmación final',
          timestamp: timestamp,
          processed_at: new Date().toISOString(),
        };
      } else {
        // Otros status (failed, rejected, time_out)
        console.log(`[WEBHOOK] Status no exitoso: ${status}`);

        await this.saveWebhookEvent(webhookId || event, webhookData, 'failed');

        return {
          success: true,
          event: event,
          payin_id: payin_id,
          status: status,
          message: `Pago no completado: ${status}`,
          timestamp: timestamp,
          processed_at: new Date().toISOString(),
        };
      }

    } catch (error) {
      console.error(`[WEBHOOK] ✗ Error:`, error.message);

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Procesa un webhook de pago aprobado
   * @param {Object} webhookData - Datos del webhook
   * @returns {Promise<Object>} Resultado del procesamiento
   */
  async handlePaymentApproved(webhookData) {
    try {
      const {
        event,
        payment_id,
        order_id,
        amount,
        currency,
        provider,
        timestamp,
      } = webhookData;

      console.log(`[WEBHOOK] Procesando pago aprobado...`);
      console.log(`  - Payment ID: ${payment_id}`);
      console.log(`  - Monto: ${amount} ${currency}`);
      console.log(`  - Proveedor: ${provider}`);

      return {
        success: true,
        event: event,
        payment_id: payment_id,
        order_id: order_id,
        amount: amount,
        currency: currency,
        provider: provider,
        status: 'approved',
        timestamp: timestamp,
        processed_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[WEBHOOK] ✗ Error:`, error.message);

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Procesa un webhook de pago rechazado
   * @param {Object} webhookData - Datos del webhook
   * @returns {Promise<Object>} Resultado del procesamiento
   */
  async handlePaymentRejected(webhookData) {
    try {
      const {
        event,
        payment_id,
        order_id,
        reason,
        timestamp,
      } = webhookData;

      console.log(`[WEBHOOK] Procesando pago rechazado...`);
      console.log(`  - Payment ID: ${payment_id}`);
      console.log(`  - Razón: ${reason}`);

      return {
        success: true,
        event: event,
        payment_id: payment_id,
        order_id: order_id,
        status: 'rejected',
        reason: reason,
        timestamp: timestamp,
        processed_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[WEBHOOK] ✗ Error:`, error.message);

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Router principal para procesar cualquier webhook
   * @param {Object} webhookData - Datos del webhook
   * @returns {Promise<Object>} Resultado del procesamiento
   */
  async processWebhook(webhookData) {
    try {
      const { event } = webhookData;

      console.log(`[WEBHOOK] Recibido webhook: ${event}`);

      // Routear según tipo de evento
      switch (event) {
        case 'payin.completed':
        case 'payment.completed':
          return await this.handlePayinCompleted(webhookData);

        case 'payment.approved':
          return await this.handlePaymentApproved(webhookData);

        case 'payment.rejected':
          return await this.handlePaymentRejected(webhookData);

        default:
          console.warn(`[WEBHOOK] Evento no manejado: ${event}`);
          return {
            success: true,
            event: event,
            message: 'Evento recibido pero no procesado',
          };
      }
    } catch (error) {
      console.error(`[WEBHOOK] ✗ Error procesando webhook:`, error.message);

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Genera una respuesta de confirmación para Vitawallet
   * @param {boolean} success - Si el webhook fue procesado exitosamente
   * @returns {Object} Respuesta a enviar a Vitawallet
   */
  generateWebhookResponse(success = true) {
    return {
      status: success ? 'received' : 'error',
      timestamp: new Date().toISOString(),
      processorId: 'FLUXI-WEBHOOK-PROCESSOR',
    };
  }

  /**
   * Configura el webhook URL en Vita Wallet
   * Equivalente a: PUT /api/businesses/webhooks
   * @param {string} webhookUrl - URL HTTPS donde Vita enviará los webhooks
   * @param {Array<string>} categories - Categorías de eventos a recibir
   * @returns {Promise<Object>} Resultado de la configuración
   */
  async configureWebhookInVita(webhookUrl, categories) {
    try {
      console.log(`[WEBHOOK] Configurando webhook URL en Vita Wallet...`);

      // Si está en modo local, no hacer llamada HTTP
      if (config.isLocal()) {
        console.log(`[WEBHOOK] Modo LOCAL - Webhook mock configurado`);
        return {
          success: true,
          webhook_url: webhookUrl,
          categories: categories,
          configured_at: new Date().toISOString(),
          source: 'local-mock',
        };
      }

      // Payload para Vita Wallet
      const payload = {
        webhook_url: webhookUrl,
        categories: categories,
      };

      console.log(`[WEBHOOK] PUT /webhooks (BASE_URL ya incluye /api/businesses)`);
      const response = await client.put('/webhooks', payload);

      console.log(`[WEBHOOK] ✅ Webhook configurado en Vita:`, response.status);

      return {
        success: true,
        webhook_url: response.data.webhook_url,
        categories: response.data.categories,
        configured_at: new Date().toISOString(),
        source: 'vitawallet-api',
      };

    } catch (error) {
      console.error(`[WEBHOOK] ❌ Error configurando webhook:`, error.message);
      return {
        success: false,
        error: error.message || 'Error configurando webhook en Vita Wallet',
        details: error,
      };
    }
  }

  /**
   * Obtiene la configuración actual de webhooks en Vita Wallet
   * Equivalente a: GET /api/businesses/webhooks
   * @returns {Promise<Object>} Configuración actual
   */
  async getWebhookConfigFromVita() {
    try {
      console.log(`[WEBHOOK] Obteniendo configuración de webhooks desde Vita...`);

      if (config.isLocal()) {
        console.log(`[WEBHOOK] Modo LOCAL - Retornando config mock`);
        return {
          success: true,
          webhook_url: null,
          configured_categories: [],
          available_categories: ['payment', 'deposit', 'withdrawal', 'transfer'],
          source: 'local-mock',
        };
      }

      const response = await client.get('/webhooks');

      console.log(`[WEBHOOK] ✅ Configuración obtenida:`);
      console.log(`  URL: ${response.data.webhook_url || 'No configurada'}`);
      console.log(`  Categorías: ${response.data.configured_categories?.join(', ') || 'Ninguna'}`);

      return {
        success: true,
        webhook_url: response.data.webhook_url,
        configured_categories: response.data.configured_categories || [],
        available_categories: response.data.available_categories || [],
      };

    } catch (error) {
      console.error(`[WEBHOOK] ❌ Error obteniendo configuración:`, error.message);
      return {
        success: false,
        error: error.message || 'Error obteniendo configuración',
      };
    }
  }

  /**
   * Guarda eventos de webhook en la BD (auditoría)
   * @param {string} webhookId - ID único del webhook
   * @param {Object} payload - Datos del webhook
   * @param {string} status - Estado del procesamiento
   */
  async saveWebhookEvent(webhookId, payload, status = 'processed') {
    try {
      const eventId = `evt-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      await execute(
        `INSERT INTO doc.payin_events (id, webhook_id, payload, status, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [eventId, webhookId, JSON.stringify(payload), status]
      );

      console.log(`[WEBHOOK] ✅ Evento guardado en BD: ${eventId}`);
      return eventId;
    } catch (error) {
      console.error(`[WEBHOOK] ⚠️ Error guardando evento:`, error.message);
      // No fallar completamente si no se puede guardar el evento
      return null;
    }
  }

  /**
   * Actualiza el saldo de un usuario cuando recibe un payin
   * @param {string} userId - ID del usuario
   * @param {number} amount - Monto a agregar
   * @param {string} currency - Moneda (COP, USD, etc)
   * @param {string} referenceId - ID de referencia (payment_order_id)
   */
  async updateUserBalance(userId, amount, currency, referenceId) {
    try {
      console.log(`[WEBHOOK] Actualizando balance de usuario ${userId}...`);
      console.log(`  Monto: ${amount} ${currency}`);
      console.log(`  Referencia: ${referenceId}`);

      // 1. MAPEO: Convertir currency a asset_id
      // COP -> 'COP', USD -> 'USD', etc.
      const currencyToAssetId = {
        'COP': 'COP',
        'USD': 'USD',
        'ARS': 'ARS',
        'CLP': 'CLP',
        'BRL': 'BRL',
        'MXN': 'MXN',
      };

      const assetId = currencyToAssetId[currency.toUpperCase()] || currency.toUpperCase();

      // 2. Obtener o crear wallet del usuario POR ASSET_ID
      const { rows: walletRows } = await execute(
        `SELECT id FROM doc.wallets WHERE user_id = $1 AND asset_id = $2`,
        [userId, assetId]
      );

      let walletId = walletRows[0]?.id;

      if (!walletId) {
        // Crear wallet si no existe
        walletId = `wallet-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const address = `${userId}-${assetId}-${Date.now()}`;  // Address generada

        await execute(
          `INSERT INTO doc.wallets (id, user_id, asset_id, address, balance, is_active, created_at)
           VALUES ($1, $2, $3, $4, $5, true, NOW())`,
          [walletId, userId, assetId, address, amount]
        );
        console.log(`[WEBHOOK] ✅ Wallet creada: ${walletId} para asset ${assetId}`);
      } else {
        // Actualizar balance existente
        await execute(
          `UPDATE doc.wallets SET balance = balance + $1 WHERE id = $2`,
          [amount, walletId]
        );
        console.log(`[WEBHOOK] ✅ Balance actualizado: +${amount} ${currency}`);
      }

      // 3. Crear entrada en ledger (auditoría) - si existe tabla wallet_ledger
      try {
        const ledgerId = `ledger-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        await execute(
          `INSERT INTO doc.wallet_movements (id, wallet_id, transaction_id, amount, balance_after, created_at)
           VALUES ($1, $2, $3, $4,
           (SELECT balance FROM doc.wallets WHERE id = $2),
           NOW())`,
          [ledgerId, walletId, referenceId, amount]
        );
        console.log(`[WEBHOOK] ✅ Ledger entry creada: ${ledgerId}`);
        return { walletId, ledgerId };
      } catch (ledgerError) {
        console.warn(`[WEBHOOK] ⚠️ No se pudo crear ledger entry (tabla no existe):`, ledgerError.message);
        return { walletId, ledgerId: null };
      }

    } catch (error) {
      console.error(`[WEBHOOK] ❌ Error actualizando balance:`, error.message);
      throw error;
    }
  }

  /**
   * Marca un payin como completado en la BD
   * ✅ FASE 1.3: Búsqueda mejorada por payment_order_id + webhook_received tracking
   * @param {string} paymentOrderId - ID del payment order en Vita
   * @param {Object} webhookPayload - Datos del webhook
   */
  async completePayin(paymentOrderId, webhookPayload) {
    try {
      console.log(`[WEBHOOK] Marcando payin como completado...`);
      console.log(`  Payment Order ID: ${paymentOrderId}`);

      // ✅ FASE 1.3: BÚSQUEDA MEJORADA
      // 1. Buscar payin por payment_order_id DIRECTAMENTE
      let { rows: payinRows } = await execute(
        `SELECT id, user_id, amount, currency FROM doc.payin_requests
         WHERE payment_order_id = $1
         LIMIT 1`,
        [paymentOrderId]
      );

      // 2. Si no encuentra por payment_order_id, buscar por payin_id
      if (payinRows.length === 0) {
        const payin_id = webhookPayload.payin_id || webhookPayload.id;
        console.log(`[WEBHOOK] Payin no encontrado por payment_order_id, buscando por payin_id: ${payin_id}`);

        ({ rows: payinRows } = await execute(
          `SELECT id, user_id, amount, currency FROM doc.payin_requests
           WHERE id = $1
           LIMIT 1`,
          [payin_id]
        ));
      }

      // 3. Si aún no encuentra, buscar por email y monto (último recurso)
      if (payinRows.length === 0) {
        const { user_email, amount } = webhookPayload;
        if (user_email && amount) {
          console.log(`[WEBHOOK] Payin no encontrado, buscando por user_email + amount...`);

          ({ rows: payinRows } = await execute(
            `SELECT id, user_id, amount, currency FROM doc.payin_requests
             WHERE user_email = $1 AND amount = $2 AND status = 'pending'
             ORDER BY created_at DESC
             LIMIT 1`,
            [user_email, amount]
          ));
        }
      }

      if (payinRows.length === 0) {
        console.warn(`[WEBHOOK] ⚠️ Payin no encontrado en BD: ${paymentOrderId}`);
        return { success: false, error: 'Payin no encontrado en BD' };
      }

      const payin = payinRows[0];
      console.log(`[WEBHOOK] ✅ Payin encontrado: ${payin.id}`);

      // ✅ FASE 1.3: ACTUALIZAR WEBHOOK_RECEIVED Y STATUS
      const webhookTimestamp = webhookPayload.timestamp || new Date().toISOString();
      await execute(
        `UPDATE doc.payin_requests
         SET status = 'completed',
             webhook_received = true,
             webhook_timestamp = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [webhookTimestamp, payin.id]
      );

      console.log(`[WEBHOOK] ✅ Payin actualizado: status='completed', webhook_received=true`);

      // 3. Actualizar wallet del usuario
      const walletResult = await this.updateUserBalance(
        payin.user_id,
        payin.amount,
        payin.currency,
        paymentOrderId
      );

      return {
        success: true,
        payin_id: payin.id,
        user_id: payin.user_id,
        amount: payin.amount,
        currency: payin.currency,
        wallet_id: walletResult.walletId,
        ledger_id: walletResult.ledgerId,
      };

    } catch (error) {
      console.error(`[WEBHOOK] ❌ Error completando payin:`, error.message);
      throw error;
    }
  }
}

export default new WebhookService();
