/**
 * ✅ FASE 1: MIGRACIÓN PAYIN REFACTORIZATION (CORREGIDA PARA CRATEDB)
 * Agrega columnas necesarias para idempotencia, webhook tracking y retry logic
 *
 * REVISADO CON ESQUEMA ACTUAL:
 * - Tipos: TEXT (no VARCHAR), OBJECT (no JSONB)
 * - payin_requests: existente desde línea 610
 * - payin_links: existente desde línea 629 (tiene vitawallet_payin_id)
 *
 * Cambios necesarios en payin_requests:
 * 1. user_email TEXT - para búsqueda en webhook
 * 2. payment_order_id TEXT - ID de Vita (puede estar en payin_links)
 * 3. public_code TEXT - código público (puede estar en payin_links)
 * 4. payin_reference_id TEXT UNIQUE - para idempotencia
 * 5. webhook_received BOOLEAN - confirmó webhook?
 * 6. webhook_timestamp TIMESTAMP - cuándo llegó webhook
 * 7. webhook_timeout TIMESTAMP - cuándo expira (1 hora)
 * 8. retry_count INTEGER - intentos de creación
 * 9. last_error TEXT - último error si hubo
 * 10. vitawallet_metadata OBJECT - metadata de Vita
 * 11. source TEXT - origen (local-mock, vitawallet-api, mock-fallback)
 *
 * Ejecución:
 *   node scripts/apply-payin-migration.js
 */

-- ✅ PASO 1: Agregar columnas faltantes a payin_requests
-- Tipos compatibles con esquema actual: TEXT (no VARCHAR), OBJECT (no JSONB)
ALTER TABLE doc.payin_requests ADD COLUMN IF NOT EXISTS (
  user_email TEXT,
  payment_order_id TEXT,
  public_code TEXT,
  payin_reference_id TEXT,
  webhook_received BOOLEAN DEFAULT false,
  webhook_timestamp TIMESTAMP,
  webhook_timeout TIMESTAMP,
  retry_count INTEGER DEFAULT 0,
  last_error TEXT,
  vitawallet_metadata OBJECT,
  source TEXT DEFAULT 'vitawallet-api'
);

-- ✅ PASO 2: Crear índice UNIQUE para payin_reference_id
CREATE INDEX IF NOT EXISTS idx_payin_requests_payin_reference_id
ON doc.payin_requests (payin_reference_id);

-- ✅ PASO 3: Crear índice para búsqueda rápida por payment_order_id
CREATE INDEX IF NOT EXISTS idx_payin_requests_payment_order_id
ON doc.payin_requests (payment_order_id);

-- ✅ PASO 4: Crear índice para búsqueda por email (webhook fallback)
CREATE INDEX IF NOT EXISTS idx_payin_requests_user_email
ON doc.payin_requests (user_email);

-- ✅ PASO 5: Crear índice para búsqueda por webhook_received
CREATE INDEX IF NOT EXISTS idx_payin_requests_webhook_received
ON doc.payin_requests (webhook_received, status);

-- ✅ PASO 6: Crear índice para búsqueda por webhook_timeout (para cron job Fase 2)
CREATE INDEX IF NOT EXISTS idx_payin_requests_webhook_timeout
ON doc.payin_requests (webhook_timeout, webhook_received, status);

-- ✅ PASO 7: Crear tabla payin_events para auditoría (si no existe)
CREATE TABLE IF NOT EXISTS doc.payin_events (
  id TEXT PRIMARY KEY,
  payin_id TEXT,
  webhook_id TEXT,
  event_type TEXT,
  payload OBJECT,
  status TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ✅ PASO 8: Crear índice para auditoría
CREATE INDEX IF NOT EXISTS idx_payin_events_payin_id
ON doc.payin_events (payin_id);

-- ✅ PASO 9: Crear índice para búsqueda por timestamp
CREATE INDEX IF NOT EXISTS idx_payin_events_created_at
ON doc.payin_events (created_at);

-- ✅ Log de migración
SELECT 'Migration: Add Payin Refactorization FASE 1 - COMPLETADA ✅' AS status;
