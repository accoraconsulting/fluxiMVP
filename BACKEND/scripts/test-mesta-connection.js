/**
 * TEST MESTA CONNECTION
 * Script para verificar conexión con Mesta API
 */

import 'dotenv/config';
import mestaClient from '../src/services/mesta/mesta.client.js';
import { mestaConfig, logMestaConfig } from '../src/config/mesta.config.js';

async function testConnection() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║      TEST DE CONEXIÓN CON MESTA API        ║');
  console.log('╚════════════════════════════════════════════╝\n');

  // 1. Mostrar configuración
  console.log('📋 Configuración actual:');
  logMestaConfig();
  console.log('');

  // 2. Inicializar cliente
  console.log('🔄 Inicializando cliente...');
  const isConfigured = mestaClient.init();

  if (!isConfigured) {
    console.error('❌ Cliente no configurado correctamente');
    process.exit(1);
  }

  // 3. Probar conexión
  console.log('\n🔌 Probando conexión con Mesta...');

  try {
    const healthResult = await mestaClient.healthCheck();

    if (healthResult.success) {
      console.log('✅ CONEXIÓN EXITOSA!\n');
      console.log('📊 Detalles:');
      console.log(`   • Ambiente: ${healthResult.env}`);
      console.log(`   • API URL: ${healthResult.apiUrl}`);
      console.log(`   • Mensaje: ${healthResult.message}`);
    } else {
      console.log('❌ CONEXIÓN FALLIDA\n');
      console.log('📊 Detalles:');
      console.log(`   • Ambiente: ${healthResult.env}`);
      console.log(`   • API URL: ${healthResult.apiUrl}`);
      console.log(`   • Error: ${healthResult.error}`);
    }

  } catch (error) {
    console.error('❌ Error de conexión:', error.message);

    if (error.status === 401) {
      console.log('\n⚠️  Las credenciales parecen ser inválidas.');
      console.log('   Verifica tu API_KEY y API_SECRET en el .env');
    }

    if (error.status === 403) {
      console.log('\n⚠️  Acceso denegado. Verifica los permisos de tu API Key.');
    }
  }

  console.log('\n════════════════════════════════════════════════');
}

testConnection().catch(console.error);
