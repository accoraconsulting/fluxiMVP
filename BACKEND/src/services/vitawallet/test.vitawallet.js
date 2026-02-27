/**
 * TEST VITAWALLET CLIENT
 * Prueba la conexión y autenticación con Vitawallet
 *
 * EJECUTAR CON:
 * node /BACKEND/src/services/vitawallet/test.vitawallet.js
 */

import client from './vitawallet.client.js';
import config from './vitawallet.config.js';

async function testVitawalletConnection() {
  console.log('\n🧪 TESTING VITAWALLET CONNECTION\n');
  console.log('═'.repeat(60));

  try {
    // Test 1: Información del cliente
    console.log('\n✓ TEST 1: Client Configuration');
    const env = client.getEnvironment();
    console.log(`  Environment: ${env.environment}`);
    console.log(`  Base URL: ${env.baseUrl}`);
    console.log(`  Merchant ID: ${env.merchant}`);

    // Test 2: GET Payment Methods para Colombia
    console.log('\n✓ TEST 2: Getting Payment Methods for Colombia');
    const endpoint = '/api/businesses/payment_methods/co';

    console.log(`  Calling: GET ${endpoint}`);
    const response = await client.get(endpoint);

    console.log(`  Status: ${response.status}`);
    console.log(`  Methods found: ${response.data.payment_methods?.length || 0}`);

    if (response.data.payment_methods && response.data.payment_methods.length > 0) {
      console.log('\n  Available methods:');
      response.data.payment_methods.forEach(method => {
        console.log(`    - ${method.name}: ${method.description}`);
        console.log(`      Required fields: ${method.required_fields.map(f => f.name).join(', ')}`);
      });
    }

    console.log('\n' + '═'.repeat(60));
    console.log('\n✅ CONNECTION SUCCESSFUL!\n');
    console.log('Summary:');
    console.log('  ✓ Client initialized');
    console.log('  ✓ Authentication headers generated');
    console.log('  ✓ HMAC-SHA256 signature working');
    console.log('  ✓ Payment methods retrieved from Vitawallet');
    console.log('\nREADY FOR INTEGRATION!\n');

    return true;

  } catch (error) {
    console.log('\n' + '═'.repeat(60));
    console.log('\n❌ CONNECTION FAILED!\n');
    console.log('Error Details:');
    console.log(JSON.stringify(error, null, 2));
    console.log('\nTroubleshooting:');
    console.log('  1. Verify credentials in vitawallet.config.js');
    console.log('  2. Check environment variables (VITAWALLET_SANDBOX_LOGIN, etc)');
    console.log('  3. Ensure Vitawallet sandbox is accessible');
    console.log('  4. Check internet connection\n');

    return false;
  }
}

// Ejecutar test
testVitawalletConnection().then(success => {
  process.exit(success ? 0 : 1);
});
