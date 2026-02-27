/**
 * SETUP VITAWALLET TABLES
 * Crea las tablas necesarias para Vitawallet en CrateDB
 *
 * EJECUTAR UNA SOLA VEZ:
 * node src/scripts/setup-vitawallet-tables.js
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Cargar .env primero
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Ahora importar execute
import { execute } from '../config/crate.js';

// ═══════════════════════════════════════════════════════════════

async function createTables() {
  try {
    console.log('🗄️  Creando tablas Vitawallet en CrateDB...\n');

    // ═══════════════════════════════════════════════════════════════
    // TABLA 1: doc.vitawallet_payins
    // Registra todos los payins (pagos entrantes) creados
    // ═══════════════════════════════════════════════════════════════

    const vitawalletPayinsSQL = `
      CREATE TABLE IF NOT EXISTS doc.vitawallet_payins (
        id TEXT PRIMARY KEY,
        payin_id TEXT NOT NULL,
        payment_order_id TEXT NOT NULL,
        public_code TEXT,
        user_id TEXT NOT NULL,
        user_email TEXT NOT NULL,
        amount DECIMAL(20, 2) NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        country TEXT,
        client_id TEXT DEFAULT 'FLUXI',
        description TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        metadata OBJECT
      );
    `;

    console.log('  📝 Creando tabla: doc.vitawallet_payins');
    await execute(vitawalletPayinsSQL);
    console.log('  ✅ doc.vitawallet_payins creada\n');

    // ═══════════════════════════════════════════════════════════════
    // TABLA 2: doc.vitawallet_payment_attempts
    // Registra intentos de pago (cada payin puede tener múltiples intentos)
    // ═══════════════════════════════════════════════════════════════

    const vitawalletAttemptsSQL = `
      CREATE TABLE IF NOT EXISTS doc.vitawallet_payment_attempts (
        id TEXT PRIMARY KEY,
        payin_id TEXT NOT NULL,
        payment_order_id TEXT NOT NULL,
        attempt_id TEXT NOT NULL,
        payment_method TEXT,
        payment_method_data OBJECT,
        status TEXT DEFAULT 'pending',
        provider_url TEXT,
        provider_payment_id TEXT,
        provider_response OBJECT,
        spread DECIMAL(10, 2),
        spread_type TEXT,
        fixed_cost DECIMAL(20, 2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      );
    `;

    console.log('  📝 Creando tabla: doc.vitawallet_payment_attempts');
    await execute(vitawalletAttemptsSQL);
    console.log('  ✅ doc.vitawallet_payment_attempts creada\n');

    // ═══════════════════════════════════════════════════════════════
    // TABLA 3: doc.vitawallet_webhooks
    // Log de todos los webhooks recibidos (para auditoría y debugging)
    // ═══════════════════════════════════════════════════════════════

    const vitawalletWebhooksSQL = `
      CREATE TABLE IF NOT EXISTS doc.vitawallet_webhooks (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        payin_id TEXT,
        payment_order_id TEXT,
        attempt_id TEXT,
        payload OBJECT NOT NULL,
        processed BOOLEAN DEFAULT FALSE,
        processing_result OBJECT,
        signature_valid BOOLEAN,
        received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP
      );
    `;

    console.log('  📝 Creando tabla: doc.vitawallet_webhooks');
    await execute(vitawalletWebhooksSQL);
    console.log('  ✅ doc.vitawallet_webhooks creada\n');

    // ═══════════════════════════════════════════════════════════════
    // TABLA 4: doc.vitawallet_ledger_entries
    // Extensión del ledger para registrar movimientos de Vitawallet
    // (Se vincula con la tabla ledger existente)
    // ═══════════════════════════════════════════════════════════════

    const vitawalletLedgerSQL = `
      CREATE TABLE IF NOT EXISTS doc.vitawallet_ledger_entries (
        id TEXT PRIMARY KEY,
        ledger_id TEXT NOT NULL,
        payin_id TEXT,
        payment_order_id TEXT,
        attempt_id TEXT,
        movement_type TEXT,
        amount DECIMAL(20, 2),
        fee DECIMAL(20, 2),
        net_amount DECIMAL(20, 2),
        description TEXT,
        metadata OBJECT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    console.log('  📝 Creando tabla: doc.vitawallet_ledger_entries');
    await execute(vitawalletLedgerSQL);
    console.log('  ✅ doc.vitawallet_ledger_entries creada\n');

    // ═══════════════════════════════════════════════════════════════
    // TABLA 5: doc.vitawallet_sync_log
    // Log de sincronizaciones con Vitawallet (para monitoreo)
    // ═══════════════════════════════════════════════════════════════

    const vitawalletSyncLogSQL = `
      CREATE TABLE IF NOT EXISTS doc.vitawallet_sync_log (
        id TEXT PRIMARY KEY,
        sync_type TEXT,
        status TEXT,
        total_records BIGINT,
        processed_records BIGINT,
        failed_records BIGINT,
        message TEXT,
        error_details OBJECT,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        duration_ms BIGINT
      );
    `;

    console.log('  📝 Creando tabla: doc.vitawallet_sync_log');
    await execute(vitawalletSyncLogSQL);
    console.log('  ✅ doc.vitawallet_sync_log creada\n');

    // ═══════════════════════════════════════════════════════════════
    // REFRESH TABLES (para CrateDB)
    // ═══════════════════════════════════════════════════════════════

    console.log('  🔄 Refrescando tablas...');
    await execute('REFRESH TABLE doc.vitawallet_payins');
    await execute('REFRESH TABLE doc.vitawallet_payment_attempts');
    await execute('REFRESH TABLE doc.vitawallet_webhooks');
    await execute('REFRESH TABLE doc.vitawallet_ledger_entries');
    await execute('REFRESH TABLE doc.vitawallet_sync_log');
    console.log('  ✅ Tablas refrescadas\n');

    // ═══════════════════════════════════════════════════════════════
    // SUCCESS
    // ═══════════════════════════════════════════════════════════════

    console.log('═'.repeat(60));
    console.log('\n✅ TODAS LAS TABLAS CREADAS EXITOSAMENTE EN CRATEDB\n');
    console.log('Tablas creadas en schema "doc":');
    console.log('  1. doc.vitawallet_payins');
    console.log('  2. doc.vitawallet_payment_attempts');
    console.log('  3. doc.vitawallet_webhooks');
    console.log('  4. doc.vitawallet_ledger_entries');
    console.log('  5. doc.vitawallet_sync_log\n');
    console.log('Ahora puedes usar estos servicios:');
    console.log('  - payinService.createPayin()');
    console.log('  - payinService.getPayinStatus()');
    console.log('  - webhookService.processWebhook()');
    console.log('\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR CREANDO TABLAS:\n', error.message);
    console.error('\nDetalles:', error);
    process.exit(1);
  }
}

// Ejecutar
createTables();
