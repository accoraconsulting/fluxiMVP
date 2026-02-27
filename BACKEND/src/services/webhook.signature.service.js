/**
 * WEBHOOK SIGNATURE SERVICE
 * Valida autenticidad de webhooks usando HMAC-SHA256
 *
 * Soporta:
 * - Vitawallet (V2-HMAC-SHA256)
 * - Mesta y otros providers
 */

import crypto from 'crypto';
import config from './vitawallet/vitawallet.config.js';

/**
 * Valida firma HMAC de webhook Vitawallet
 * @param {Object} headers - Headers del request
 * @param {string} rawBody - Body crudo (string, no JSON)
 * @returns {boolean} true si la firma es válida
 */
export function validateVitawalletSignature(headers, rawBody) {
  try {
    const signature = headers['x-signature'] || headers['X-Signature'];

    if (!signature) {
      console.warn('[WebhookSig] ⚠️ No hay firma en headers');
      return false;
    }

    console.log('[WebhookSig] Validando firma Vitawallet...');

    // Obtener secret key del config
    const secretKey = config.WEBHOOK_SECRET;
    if (!secretKey) {
      console.error('[WebhookSig] ❌ WEBHOOK_SECRET no configurado');
      return false;
    }

    // Convertir secret a buffer si es necesario
    const secret = Buffer.isBuffer(secretKey) ? secretKey : Buffer.from(secretKey, 'utf8');

    // Crear HMAC-SHA256 del body
    const hash = crypto
      .createHmac('sha256', secret)
      .update(rawBody, 'utf8')
      .digest('hex');

    // Comparar de forma segura (timing-safe)
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(hash)
    );

    if (isValid) {
      console.log('[WebhookSig] ✅ Firma válida');
      return true;
    } else {
      console.warn('[WebhookSig] ❌ Firma inválida');
      console.warn(`  Expected: ${hash}`);
      console.warn(`  Got: ${signature}`);
      return false;
    }

  } catch (error) {
    console.error('[WebhookSig] Error validando firma:', error.message);
    return false;
  }
}

/**
 * Valida firma de Mesta (si aplica)
 * @param {Object} headers - Headers del request
 * @param {string} rawBody - Body crudo
 * @returns {boolean} true si válido
 */
export function validateMestaSignature(headers, rawBody) {
  try {
    const signature = headers['x-mesta-signature'] || headers['X-Mesta-Signature'];

    if (!signature) {
      console.warn('[WebhookSig] ⚠️ No hay firma Mesta en headers');
      return false;
    }

    console.log('[WebhookSig] Validando firma Mesta...');

    // Mesta usa su propia format, ajusta según necesidad
    // Por ahora asumimos HMAC-SHA256 similar a Vitawallet
    const mestaMestaSecret = process.env.MESTA_WEBHOOK_SECRET || '';

    if (!mestaMestaSecret) {
      console.error('[WebhookSig] ❌ MESTA_WEBHOOK_SECRET no configurado');
      return false;
    }

    const hash = crypto
      .createHmac('sha256', mestaMestaSecret)
      .update(rawBody, 'utf8')
      .digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(hash)
    );

    if (isValid) {
      console.log('[WebhookSig] ✅ Firma Mesta válida');
      return true;
    } else {
      console.warn('[WebhookSig] ❌ Firma Mesta inválida');
      return false;
    }

  } catch (error) {
    console.error('[WebhookSig] Error validando firma Mesta:', error.message);
    return false;
  }
}

/**
 * Middleware para validar webhook
 * Uso: app.post('/api/webhooks/vitawallet', validateWebhookMiddleware, handler)
 */
export function validateWebhookMiddleware(req, res, next) {
  try {
    // Obtener raw body (debe estar disponible antes de JSON parse)
    const rawBody = req.rawBody || JSON.stringify(req.body);

    // Determinar proveedor por ruta
    const path = req.path || req.originalUrl;
    const isVitawallet = path.includes('vitawallet');
    const isMesta = path.includes('mesta');

    let isValid = false;

    if (isVitawallet) {
      isValid = validateVitawalletSignature(req.headers, rawBody);
    } else if (isMesta) {
      isValid = validateMestaSignature(req.headers, rawBody);
    } else {
      console.warn('[WebhookSig] Proveedor desconocido, aceptando webhook');
      isValid = true; // Por defecto, aceptar si no hay validación
    }

    if (!isValid) {
      console.error('[WebhookSig] ❌ Webhook rechazado por firma inválida');
      return res.status(401).json({
        success: false,
        error: 'SIGNATURE_INVALID',
        message: 'Firma webhook inválida',
      });
    }

    // Firma válida, continuar
    console.log('[WebhookSig] ✅ Webhook autenticado, procesando...');
    next();

  } catch (error) {
    console.error('[WebhookSig] Error en middleware:', error.message);
    res.status(500).json({
      success: false,
      error: 'SIGNATURE_VALIDATION_ERROR',
      message: error.message,
    });
  }
}

export default {
  validateVitawalletSignature,
  validateMestaSignature,
  validateWebhookMiddleware,
};
