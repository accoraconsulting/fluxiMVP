/**
 * VITAWALLET QUERIES SERVICE
 * Queries simplificadas para BD sin ORM innecesario
 * Usa execute() de CrateDB - Mantiene la lógica limpia y directa
 */

import { execute } from '../../config/crate.js';
import { randomUUID } from 'crypto';

class VitawalletQueriesService {
  /**
   * Insertar un nuevo payin en payin_requests
   * Sincronizado con payin.controller.js que también usa payin_requests
   */
  async insertPayin(payinData) {
    try {
      const {
        payin_id,  // Este será el ID de la solicitud
        user_id,
        amount,
        currency,
        country,
        payment_method,
        description,
      } = payinData;

      const id = payin_id || randomUUID();

      const query = `
        INSERT INTO doc.payin_requests (
          id, user_id, created_by,
          amount, currency, country,
          payment_method, description,
          status, created_at, updated_at
        ) VALUES (
          $1, $2, $3,
          $4, $5, $6,
          $7, $8,
          'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `;

      await execute(query, [
        id,
        user_id,
        user_id,  // created_by = user_id
        amount,
        currency,
        country,
        payment_method || 'vitawallet',
        description || 'Payment via Vita Wallet',
      ]);

      console.log(`[VitawalletQueries] ✓ Payin insertado: ${id}`);
      return { id, payin_id: id, status: 'pending' };
    } catch (error) {
      console.error('[VitawalletQueries] Error insertPayin:', error.message);
      throw error;
    }
  }

  /**
   * Obtener payin por ID desde payin_requests
   */
  async getPayinById(payin_id) {
    try {
      const query = `
        SELECT * FROM doc.payin_requests
        WHERE id = $1
      `;

      const result = await execute(query, [payin_id]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('[VitawalletQueries] Error getPayinById:', error.message);
      throw error;
    }
  }

  /**
   * Obtener payins del usuario desde payin_requests
   */
  async getPayinsByUserId(user_id, limit = 50) {
    try {
      const query = `
        SELECT * FROM doc.payin_requests
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `;

      const result = await execute(query, [user_id, limit]);
      return result.rows;
    } catch (error) {
      console.error('[VitawalletQueries] Error getPayinsByUserId:', error.message);
      throw error;
    }
  }

  /**
   * Actualizar status de payin en payin_requests
   */
  async updatePayinStatus(payin_id, status) {
    try {
      const query = `
        UPDATE doc.payin_requests
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;

      const result = await execute(query, [status, payin_id]);
      console.log(`[VitawalletQueries] Payin ${payin_id} actualizado a ${status}`);
      return result.rows[0];
    } catch (error) {
      console.error('[VitawalletQueries] Error updatePayinStatus:', error.message);
      throw error;
    }
  }

  /**
   * Insertar intento de pago en payin_links
   * Crea el vínculo entre payin_request y el payment_order de Vita Wallet
   */
  async insertPaymentAttempt(attemptData) {
    try {
      const {
        payin_id,              // payin_request_id
        payment_order_id,      // vitawallet_payin_id
        payin_url,
        public_code,
        amount,
        currency,
        user_id,
      } = attemptData;

      const id = randomUUID();

      const query = `
        INSERT INTO doc.payin_links (
          id, payin_request_id, user_id,
          vitawallet_payin_id, payin_url, public_code,
          amount, currency,
          status, created_at
        ) VALUES (
          $1, $2, $3,
          $4, $5, $6,
          $7, $8,
          'pending', CURRENT_TIMESTAMP
        )
        RETURNING *
      `;

      const result = await execute(query, [
        id,
        payin_id,                    // payin_request_id
        user_id,
        payment_order_id,            // vitawallet_payin_id (ID de Vita)
        payin_url,
        public_code,
        amount,
        currency,
      ]);

      console.log(`[VitawalletQueries] Link de pago creado: ${id}`);
      return result.rows[0];
    } catch (error) {
      console.error('[VitawalletQueries] Error insertPaymentAttempt:', error.message);
      throw error;
    }
  }

  /**
   * Registrar webhook recibido
   * NOTA: Para tablas Vita Webhook dedicadas (futuro)
   * Por ahora solo hace logging en consola
   */
  async logWebhook(webhookData) {
    try {
      const {
        event_type,
        payin_id,
        payload,
        signature_valid,
      } = webhookData;

      console.log(`[VitawalletQueries] Webhook recibido: ${event_type} - Payin: ${payin_id} - Válido: ${signature_valid}`);
      // TODO: Crear tabla vitawallet_webhooks para auditoría completa
      return { event_type, payin_id, logged: true };
    } catch (error) {
      console.error('[VitawalletQueries] Error logWebhook:', error.message);
      throw error;
    }
  }

  /**
   * Marcar webhook como procesado
   * NOTA: Para tablas Vita Webhook dedicadas (futuro)
   */
  async markWebhookProcessed(webhook_id, result) {
    try {
      console.log(`[VitawalletQueries] Webhook procesado: ${webhook_id}`);
      // TODO: Implementar con tabla vitawallet_webhooks
      return { webhook_id, processed: true };
    } catch (error) {
      console.error('[VitawalletQueries] Error markWebhookProcessed:', error.message);
      throw error;
    }
  }

  /**
   * Insertar entrada en ledger de Vitawallet
   * NOTA: Para tabla vitawallet_ledger_entries dedicada (futuro)
   * Por ahora solo hace logging
   */
  async insertVitawalletLedgerEntry(ledgerData) {
    try {
      const {
        payin_id,
        movement_type,
        amount,
      } = ledgerData;

      console.log(`[VitawalletQueries] Ledger entry: ${movement_type} - Payin: ${payin_id} - Amount: ${amount}`);
      // TODO: Crear tabla vitawallet_ledger_entries para auditoría financiera
      return { payin_id, movement_type, amount, logged: true };
    } catch (error) {
      console.error('[VitawalletQueries] Error insertVitawalletLedgerEntry:', error.message);
      throw error;
    }
  }

  /**
   * Obtener payins pendientes (para sincronización)
   */
  async getPendingPayins(limit = 100) {
    try {
      const query = `
        SELECT * FROM doc.payin_requests
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT $1
      `;

      const result = await execute(query, [limit]);
      return result.rows;
    } catch (error) {
      console.error('[VitawalletQueries] Error getPendingPayins:', error.message);
      throw error;
    }
  }

  /**
   * Obtener webhooks sin procesar
   * NOTA: Para tabla vitawallet_webhooks dedicada (futuro)
   */
  async getUnprocessedWebhooks(limit = 50) {
    try {
      console.log(`[VitawalletQueries] getUnprocessedWebhooks: tabla no creada aún`);
      // TODO: Crear tabla vitawallet_webhooks
      return [];
    } catch (error) {
      console.error('[VitawalletQueries] Error getUnprocessedWebhooks:', error.message);
      throw error;
    }
  }

  /**
   * Registrar sincronización
   * NOTA: Para tabla vitawallet_sync_log dedicada (futuro)
   */
  async logSyncOperation(syncData) {
    try {
      const { sync_type, status, message } = syncData;
      console.log(`[VitawalletQueries] Sync: ${sync_type} - ${status} - ${message}`);
      // TODO: Crear tabla vitawallet_sync_log
      return { sync_type, status, logged: true };
    } catch (error) {
      console.error('[VitawalletQueries] Error logSyncOperation:', error.message);
      throw error;
    }
  }

  /**
   * Obtener estadísticas rápidas desde payin_requests
   */
  async getQuickStats() {
    try {
      const query = `
        SELECT
          COUNT(*) as total_payins,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_payins,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_payins,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_payins,
          SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as total_amount,
          MAX(created_at) as last_payin
        FROM doc.payin_requests
      `;

      const result = await execute(query);
      return result.rows[0];
    } catch (error) {
      console.error('[VitawalletQueries] Error getQuickStats:', error.message);
      throw error;
    }
  }
}

export default new VitawalletQueriesService();
