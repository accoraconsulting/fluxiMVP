/**
 * WEBHOOK SERVICE
 * Procesa webhooks de Mesta y otros proveedores
 *
 * Flujo:
 * 1. Recibe webhook → logWebhook()
 * 2. Valida firma → validateSignature()
 * 3. Procesa evento → processWebhook()
 * 4. Actualiza ledger si es confirmación
 */

import { execute } from '../../config/crate.js';
import { randomUUID } from 'crypto';
import { mestaConfig } from '../../config/mesta.config.js';
import * as externalPaymentService from './external-payment.service.js';
import crypto from 'crypto';

// Estados del webhook
export const WEBHOOK_STATUS = {
  RECEIVED: 'received',
  PROCESSING: 'processing',
  PROCESSED: 'processed',
  FAILED: 'failed',
  IGNORED: 'ignored',
};

// Eventos de Mesta que procesamos
export const MESTA_EVENTS = {
  // Órdenes
  ORDER_CREATED: 'order.created',
  ORDER_PENDING: 'order.pending',
  ORDER_PROCESSING: 'order.processing',
  ORDER_COMPLETED: 'order.completed',
  ORDER_SETTLED: 'order.settled',
  ORDER_FAILED: 'order.failed',
  ORDER_EXPIRED: 'order.expired',
  ORDER_CANCELLED: 'order.cancelled',

  // Transacciones
  TRANSACTION_COMPLETED: 'transaction.completed',
  TRANSACTION_FAILED: 'transaction.failed',
};

// Eventos que confirman el pago (deben tocar el ledger)
const SETTLEMENT_EVENTS = [
  MESTA_EVENTS.ORDER_COMPLETED,
  MESTA_EVENTS.ORDER_SETTLED,
  MESTA_EVENTS.TRANSACTION_COMPLETED,
];

// Eventos que indican fallo
const FAILURE_EVENTS = [
  MESTA_EVENTS.ORDER_FAILED,
  MESTA_EVENTS.ORDER_EXPIRED,
  MESTA_EVENTS.ORDER_CANCELLED,
  MESTA_EVENTS.TRANSACTION_FAILED,
];

/**
 * Registrar webhook en la base de datos
 */
export async function logWebhook({
  provider,
  eventType,
  eventId,
  externalTxId,
  rawPayload,
  headers = {},
  signature = null,
  ipAddress = null,
  userAgent = null,
}) {
  try {
    const webhookId = randomUUID();

    await execute(`
      INSERT INTO doc.webhook_logs (
        id,
        provider,
        event_type,
        event_id,
        external_tx_id,
        raw_payload,
        headers,
        signature,
        status,
        ip_address,
        user_agent,
        received_at,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      webhookId,
      provider,
      eventType,
      eventId,
      externalTxId,
      rawPayload,
      headers,
      signature,
      WEBHOOK_STATUS.RECEIVED,
      ipAddress,
      userAgent,
    ]);

    await execute('REFRESH TABLE doc.webhook_logs');

    console.log(`[Webhook] 📥 Webhook registrado: ${webhookId} (${eventType})`);

    return webhookId;

  } catch (error) {
    console.error('[Webhook] ❌ Error registrando webhook:', error);
    throw error;
  }
}

/**
 * Validar firma del webhook de Mesta
 * (Implementar según documentación de Mesta)
 */
export function validateMestaSignature(payload, signature, secret) {
  if (!secret) {
    console.warn('[Webhook] ⚠️ No hay webhook secret configurado, saltando validación');
    return true;
  }

  try {
    // La mayoría de proveedores usan HMAC-SHA256
    // Ajustar según documentación de Mesta
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature || ''),
      Buffer.from(expectedSignature)
    );

    if (!isValid) {
      console.error('[Webhook] ❌ Firma inválida');
    }

    return isValid;

  } catch (error) {
    console.error('[Webhook] ❌ Error validando firma:', error);
    return false;
  }
}

/**
 * Procesar webhook de Mesta
 */
export async function processMestaWebhook(webhookId, payload) {
  try {
    console.log(`[Webhook] 🔄 Procesando webhook: ${webhookId}`);

    // Marcar como procesando
    await updateWebhookStatus(webhookId, WEBHOOK_STATUS.PROCESSING);

    // Extraer datos del payload
    // NOTA: Ajustar según estructura real del webhook de Mesta
    const eventType = payload.event || payload.type || payload.event_type;
    const orderId = payload.order_id || payload.data?.order_id || payload.data?.id;
    const transactionId = payload.transaction_id || payload.data?.transaction_id;
    const status = payload.status || payload.data?.status;

    console.log(`[Webhook] 📋 Evento: ${eventType}, Order: ${orderId}, Status: ${status}`);

    // Buscar pago externo asociado
    let externalPayment = null;

    if (orderId) {
      externalPayment = await externalPaymentService.getExternalPaymentByProviderTxId(orderId);
    }

    if (!externalPayment && transactionId) {
      externalPayment = await externalPaymentService.getExternalPaymentByProviderTxId(transactionId);
    }

    if (!externalPayment) {
      console.warn(`[Webhook] ⚠️ No se encontró pago externo para: ${orderId || transactionId}`);

      await updateWebhookStatus(webhookId, WEBHOOK_STATUS.IGNORED, {
        errorMessage: 'No se encontró pago externo asociado',
      });

      return {
        success: true,
        action: 'ignored',
        reason: 'No external payment found',
      };
    }

    // Actualizar webhook con relación al pago
    await execute(`
      UPDATE doc.webhook_logs
      SET external_payment_id = $1, payment_request_id = $2
      WHERE id = $3
    `, [externalPayment.id, externalPayment.payment_request_id, webhookId]);

    // Determinar acción según evento
    let result;

    if (SETTLEMENT_EVENTS.includes(eventType)) {
      // Confirmar pago → tocar ledger
      console.log(`[Webhook] ✅ Evento de confirmación: ${eventType}`);

      result = await externalPaymentService.confirmPayment(externalPayment.id, payload);
      result.action = 'settled';

    } else if (FAILURE_EVENTS.includes(eventType)) {
      // Pago fallido → liberar lock
      console.log(`[Webhook] ❌ Evento de fallo: ${eventType}`);

      const reason = payload.failure_reason || payload.data?.failure_reason || eventType;
      result = await externalPaymentService.failPayment(externalPayment.id, reason);
      result.action = 'failed';

    } else {
      // Evento informativo (pending, processing, etc)
      console.log(`[Webhook] ℹ️ Evento informativo: ${eventType}`);

      // Actualizar provider_status
      await execute(`
        UPDATE doc.external_payments
        SET provider_status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [status || eventType, externalPayment.id]);

      await execute('REFRESH TABLE doc.external_payments');

      result = { success: true, action: 'updated' };
    }

    // Marcar webhook como procesado
    await updateWebhookStatus(webhookId, WEBHOOK_STATUS.PROCESSED);

    console.log(`[Webhook] ✅ Webhook procesado: ${result.action}`);

    return result;

  } catch (error) {
    console.error(`[Webhook] ❌ Error procesando webhook ${webhookId}:`, error);

    await updateWebhookStatus(webhookId, WEBHOOK_STATUS.FAILED, {
      errorMessage: error.message,
      errorStack: error.stack,
    });

    throw error;
  }
}

/**
 * Actualizar estado del webhook
 */
async function updateWebhookStatus(webhookId, status, extras = {}) {
  const updates = ['status = $1'];
  const params = [status];
  let paramIndex = 2;

  if (status === WEBHOOK_STATUS.PROCESSED) {
    updates.push('processed_at = CURRENT_TIMESTAMP');
  }

  if (extras.errorMessage) {
    updates.push(`error_message = $${paramIndex}`);
    params.push(extras.errorMessage);
    paramIndex++;
  }

  if (extras.errorStack) {
    updates.push(`error_stack = $${paramIndex}`);
    params.push(extras.errorStack);
    paramIndex++;
  }

  params.push(webhookId);

  await execute(`
    UPDATE doc.webhook_logs
    SET ${updates.join(', ')}
    WHERE id = $${paramIndex}
  `, params);

  await execute('REFRESH TABLE doc.webhook_logs');
}

/**
 * Obtener webhook por ID
 */
export async function getWebhook(webhookId) {
  const { rows } = await execute(`
    SELECT * FROM doc.webhook_logs WHERE id = $1 LIMIT 1
  `, [webhookId]);

  return rows.length > 0 ? rows[0] : null;
}

/**
 * Obtener webhooks recientes
 */
export async function getRecentWebhooks(limit = 50) {
  const { rows } = await execute(`
    SELECT * FROM doc.webhook_logs
    ORDER BY created_at DESC
    LIMIT $1
  `, [limit]);

  return rows;
}

/**
 * Obtener webhooks fallidos (para reintentar)
 */
export async function getFailedWebhooks(limit = 20) {
  const { rows } = await execute(`
    SELECT * FROM doc.webhook_logs
    WHERE status = $1
      AND retry_count < 3
    ORDER BY created_at DESC
    LIMIT $2
  `, [WEBHOOK_STATUS.FAILED, limit]);

  return rows;
}

/**
 * Reintentar webhook fallido
 */
export async function retryWebhook(webhookId) {
  try {
    const webhook = await getWebhook(webhookId);

    if (!webhook) {
      throw new Error('Webhook no encontrado');
    }

    if (webhook.status !== WEBHOOK_STATUS.FAILED) {
      throw new Error(`Webhook no está en estado fallido: ${webhook.status}`);
    }

    // Incrementar contador de reintentos
    await execute(`
      UPDATE doc.webhook_logs
      SET retry_count = retry_count + 1, status = $1
      WHERE id = $2
    `, [WEBHOOK_STATUS.RECEIVED, webhookId]);

    await execute('REFRESH TABLE doc.webhook_logs');

    // Procesar de nuevo
    return processMestaWebhook(webhookId, webhook.raw_payload);

  } catch (error) {
    console.error('[Webhook] ❌ Error reintentando webhook:', error);
    throw error;
  }
}

/**
 * Verificar si un webhook es duplicado
 */
export async function isDuplicateWebhook(eventId, provider = 'mesta') {
  if (!eventId) return false;

  const { rows } = await execute(`
    SELECT id FROM doc.webhook_logs
    WHERE event_id = $1 AND provider = $2
    LIMIT 1
  `, [eventId, provider]);

  return rows.length > 0;
}

export default {
  logWebhook,
  validateMestaSignature,
  processMestaWebhook,
  getWebhook,
  getRecentWebhooks,
  getFailedWebhooks,
  retryWebhook,
  isDuplicateWebhook,
  WEBHOOK_STATUS,
  MESTA_EVENTS,
};
