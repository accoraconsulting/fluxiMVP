/**
 * VITAWALLET TESTING CONTROLLER
 * Endpoints para testing sin conectar a Vitawallet real
 * Simula todo el flujo: payin → webhook → ledger
 */

import { payinService, webhookService, vitawalletQueries } from '../services/vitawallet/index.js';
import { randomUUID } from 'crypto';

/**
 * POST /api/vitawallet-testing/full-flow
 * Simula el flujo COMPLETO: crear payin + webhook + ledger
 *
 * Body: {
 *   amount: 1000,
 *   currency: "USD",
 *   country: "CO",
 *   payment_method: "PSE"
 * }
 */
export async function testFullPayinFlow(req, res) {
  try {
    const userId = req.user?.id;
    const userEmail = req.user?.email;
    const { amount, currency, country, payment_method } = req.body;

    if (!userId || !userEmail) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado',
      });
    }

    if (!amount || !currency || !country || !payment_method) {
      return res.status(400).json({
        success: false,
        error: 'Campos requeridos: amount, currency, country, payment_method',
      });
    }

    console.log('\n' + '═'.repeat(70));
    console.log('🧪 TEST: FLUJO COMPLETO DE PAYIN');
    console.log('═'.repeat(70));

    // ═══════════════════════════════════════════════════════════════
    // STEP 1: Crear Payin
    // ═══════════════════════════════════════════════════════════════

    console.log('\n✓ STEP 1: Creando payin...');

    const payinResult = await payinService.createPayin({
      user_id: userId,
      user_email: userEmail,
      amount: parseFloat(amount),
      currency: currency.toUpperCase(),
      country: country.toUpperCase(),
      description: `Test payin - ${amount} ${currency}`,
      client_id: 'TEST',
      metadata: { test: true },
    });

    if (!payinResult.success) {
      console.log('  ❌ Error creando payin');
      return res.status(400).json({
        success: false,
        error: payinResult.error,
      });
    }

    const payin_id = payinResult.payin_id;
    const payment_order_id = payinResult.payment_order_id;

    console.log(`  ✅ Payin creado: ${payin_id}`);
    console.log(`     Payment Order: ${payment_order_id}`);

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: Simular que el usuario pagó en Vitawallet
    // ═══════════════════════════════════════════════════════════════

    console.log('\n✓ STEP 2: Simulando pago en Vitawallet...');

    const attempt_id = `ATTEMPT-${randomUUID().substring(0, 8)}`;

    // Insertar intento de pago
    await vitawalletQueries.insertPaymentAttempt({
      payin_id,
      payment_order_id,
      attempt_id,
      payment_method: payment_method.toUpperCase(),
      payment_method_data: { test: true },
      status: 'success',
      provider_url: `https://vitawallet.test/pay/${payment_order_id}`,
      provider_payment_id: `VITA-${randomUUID().substring(0, 12)}`,
      provider_response: { status: 'approved', test: true },
      spread: 2.5,
      spread_type: 'percentage',
      fixed_cost: 0.5,
    });

    console.log(`  ✅ Intento de pago simulado: ${attempt_id}`);
    console.log(`     Método: ${payment_method}`);
    console.log(`     Status: SUCCESS`);

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: Simular Webhook de Vitawallet
    // ═══════════════════════════════════════════════════════════════

    console.log('\n✓ STEP 3: Procesando webhook de Vitawallet...');

    const mockWebhookPayload = {
      event: 'payin.completed',
      payin_id: payin_id,
      payment_order_id: payment_order_id,
      attempt_id: attempt_id,
      amount: amount,
      currency: currency.toUpperCase(),
      status: 'success',
      user_email: userEmail,
      timestamp: new Date().toISOString(),
    };

    // Registrar webhook
    await vitawalletQueries.logWebhook({
      event_type: 'payin.completed',
      payin_id: payin_id,
      payment_order_id: payment_order_id,
      attempt_id: attempt_id,
      payload: mockWebhookPayload,
      signature_valid: true,
    });

    // Procesar webhook
    const webhookResult = await webhookService.processWebhook(mockWebhookPayload);

    console.log(`  ✅ Webhook procesado: ${webhookResult.event}`);
    console.log(`     Status: ${webhookResult.status}`);

    // ═══════════════════════════════════════════════════════════════
    // STEP 4: Actualizar status a completed
    // ═══════════════════════════════════════════════════════════════

    console.log('\n✓ STEP 4: Actualizando status de payin...');

    await vitawalletQueries.updatePayinStatus(payin_id, 'completed');

    console.log(`  ✅ Payin actualizado a: COMPLETED`);

    // ═══════════════════════════════════════════════════════════════
    // STEP 5: Registrar en Ledger
    // ═══════════════════════════════════════════════════════════════

    console.log('\n✓ STEP 5: Registrando en ledger...');

    const ledger_id = randomUUID();

    await vitawalletQueries.insertVitawalletLedgerEntry({
      ledger_id: ledger_id,
      payin_id: payin_id,
      payment_order_id: payment_order_id,
      attempt_id: attempt_id,
      movement_type: 'payin_received',
      amount: parseFloat(amount),
      fee: parseFloat(amount) * 0.025, // 2.5% fee
      net_amount: parseFloat(amount) * 0.975,
      description: `Payin received from Vitawallet - ${currency}`,
      metadata: { test: true, method: payment_method },
    });

    console.log(`  ✅ Ledger entry creado: ${ledger_id}`);
    console.log(`     Monto: ${amount} ${currency}`);
    console.log(`     Fee: ${(parseFloat(amount) * 0.025).toFixed(2)} ${currency}`);
    console.log(`     Neto: ${(parseFloat(amount) * 0.975).toFixed(2)} ${currency}`);

    // ═══════════════════════════════════════════════════════════════
    // SUCCESS
    // ═══════════════════════════════════════════════════════════════

    console.log('\n' + '═'.repeat(70));
    console.log('✅ FLUJO COMPLETO EXITOSO');
    console.log('═'.repeat(70) + '\n');

    res.json({
      success: true,
      test_summary: {
        payin_id: payin_id,
        payment_order_id: payment_order_id,
        attempt_id: attempt_id,
        ledger_id: ledger_id,
        amount: parseFloat(amount),
        currency: currency.toUpperCase(),
        payment_method: payment_method.toUpperCase(),
        status: 'completed',
        steps_completed: 5,
        message: 'Flujo completo de payin simulado exitosamente',
      },
    });
  } catch (error) {
    console.error('[VitawalletTesting] Error en testFullPayinFlow:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error en test',
    });
  }
}

/**
 * GET /api/vitawallet-testing/stats
 * Obtener estadísticas de la BD de testing
 */
export async function getTestingStats(req, res) {
  try {
    console.log('[VitawalletTesting] Obteniendo estadísticas...');

    const stats = await vitawalletQueries.getQuickStats();

    res.json({
      success: true,
      database_stats: {
        total_payins: stats.total_payins || 0,
        completed_payins: stats.completed_payins || 0,
        pending_payins: stats.pending_payins || 0,
        total_amount: stats.total_amount || 0,
        last_payin: stats.last_payin,
      },
    });
  } catch (error) {
    console.error('[VitawalletTesting] Error en getTestingStats:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo estadísticas',
    });
  }
}

/**
 * POST /api/vitawallet-testing/webhook-manual
 * Enviar un webhook manualmente para testing
 *
 * Body: {
 *   event: "payin.completed",
 *   payin_id: "PAYIN-xxx",
 *   amount: 1000,
 *   ...
 * }
 */
export async function sendManualWebhook(req, res) {
  try {
    const payload = req.body;

    if (!payload.event) {
      return res.status(400).json({
        success: false,
        error: 'Campo requerido: event',
      });
    }

    console.log(`[VitawalletTesting] Webhook manual: ${payload.event}`);

    const result = await webhookService.processWebhook(payload);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    res.json({
      success: true,
      webhook_result: result,
    });
  } catch (error) {
    console.error('[VitawalletTesting] Error en sendManualWebhook:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error procesando webhook',
    });
  }
}

/**
 * DELETE /api/vitawallet-testing/clear-tables
 * PELIGROSO: Limpia todas las tablas de testing (solo para dev)
 */
export async function clearTestingTables(req, res) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Este endpoint NO está permitido en producción',
      });
    }

    console.log('[VitawalletTesting] ⚠️ Limpiando tablas de testing...');

    // Nota: En CrateDB, TRUNCATE TABLE puede no funcionar bien
    // Es mejor usar DELETE FROM
    const { execute } = await import('../config/crate.js');

    await execute('DELETE FROM doc.vitawallet_ledger_entries');
    await execute('DELETE FROM doc.vitawallet_webhooks');
    await execute('DELETE FROM doc.vitawallet_payment_attempts');
    await execute('DELETE FROM doc.vitawallet_payins');

    console.log('[VitawalletTesting] ✅ Tablas limpias');

    res.json({
      success: true,
      message: 'Todas las tablas de vitawallet han sido limpiadas',
    });
  } catch (error) {
    console.error('[VitawalletTesting] Error en clearTestingTables:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error limpiando tablas',
    });
  }
}
