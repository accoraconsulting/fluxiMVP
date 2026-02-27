/**
 * ✅ FASE 1: Aplicar migración de BD para payin refactorization
 * Ejecuta el script SQL que agrega las columnas necesarias
 *
 * Uso:
 *   node scripts/apply-payin-migration.js
 */

import { execute } from '../src/config/crate.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function applyMigration() {
  try {
    console.log('🚀 [MIGRATION] Iniciando aplicación de FASE 1 refactorización de payins...\n');

    // Leer el script SQL
    const migrationPath = path.join(__dirname, '../migrations/add_payin_refactorization_fase1.sql');
    const sqlScript = fs.readFileSync(migrationPath, 'utf-8');

    // Dividir el script en comandos individuales
    const commands = sqlScript
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('/**') && !cmd.startsWith('*'));

    let successCount = 0;
    let errorCount = 0;

    console.log(`📝 Total de comandos a ejecutar: ${commands.length}\n`);

    // Ejecutar cada comando
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];

      try {
        console.log(`[${i + 1}/${commands.length}] Ejecutando...`);
        console.log(`SQL: ${command.substring(0, 60)}...`);

        await execute(command);

        console.log(`✅ Comando ${i + 1} completado\n`);
        successCount++;
      } catch (error) {
        console.error(`❌ Error en comando ${i + 1}:`, error.message);
        console.error(`SQL: ${command}\n`);

        // No fallar completamente - algunas alteraciones pueden fallar si columnas ya existen
        if (error.message.includes('already exists') || error.message.includes('duplicate column')) {
          console.log(`ℹ️ Columna/índice ya existe, continuando...\n`);
          successCount++;
        } else {
          errorCount++;
        }
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMEN DE MIGRACIÓN');
    console.log('='.repeat(50));
    console.log(`✅ Completados: ${successCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    console.log('='.repeat(50));

    if (errorCount === 0) {
      console.log('\n🎉 ¡MIGRACIÓN COMPLETADA EXITOSAMENTE!');
      console.log('\nNuevas columnas agregadas:');
      console.log('  ✅ payin_reference_id (UNIQUE) - Para idempotencia');
      console.log('  ✅ webhook_received (BOOLEAN) - Confirmó webhook?');
      console.log('  ✅ webhook_timestamp (TIMESTAMP) - Cuándo llegó webhook');
      console.log('  ✅ webhook_timeout (TIMESTAMP) - Cuándo expira (1 hora)');
      console.log('  ✅ retry_count (INT) - Intentos de creación');
      console.log('  ✅ last_error (TEXT) - Último error si hubo');
      console.log('  ✅ vitawallet_metadata (JSONB) - Metadata de Vita');
      console.log('\nNuevos índices creados:');
      console.log('  ✅ idx_payin_requests_payment_order_id');
      console.log('  ✅ idx_payin_requests_payin_reference_id');
      console.log('  ✅ idx_payin_requests_webhook_received');
      console.log('  ✅ idx_payin_requests_webhook_timeout');
      console.log('\nNuevas tablas creadas:');
      console.log('  ✅ doc.payin_events (auditoría)');
      console.log('\n✨ BD preparada para FASE 1. Ahora puedes usar la nueva funcionalidad.');
    } else {
      console.log('\n⚠️ Algunos comandos fallaron. Revisa los errores arriba.');
    }

    process.exit(errorCount === 0 ? 0 : 1);

  } catch (error) {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  }
}

// Ejecutar
applyMigration();
