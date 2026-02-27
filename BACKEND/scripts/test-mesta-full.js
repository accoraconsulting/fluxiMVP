/**
 * TEST MESTA - PRUEBA COMPLETA
 * Probar diferentes endpoints y formatos de autenticación
 */

import 'dotenv/config';

const API_URL = process.env.MESTA_SANDBOX_API_URL || 'https://api.stg.mesta.xyz';
const API_KEY = process.env.MESTA_SANDBOX_API_KEY;
const API_SECRET = process.env.MESTA_SANDBOX_API_SECRET;

console.log('╔════════════════════════════════════════════╗');
console.log('║     MESTA API - PRUEBA COMPLETA            ║');
console.log('╚════════════════════════════════════════════╝\n');

console.log('📋 Credenciales:');
console.log(`   API Key: ${API_KEY}`);
console.log(`   API Secret: ${API_SECRET}`);
console.log(`   URL: ${API_URL}`);
console.log('');

async function testRequest(name, url, options) {
  console.log(`\n🔄 ${name}`);
  console.log(`   URL: ${url}`);
  console.log(`   Headers:`, JSON.stringify(options.headers, null, 2));

  try {
    const response = await fetch(url, options);
    const status = response.status;

    let data;
    const text = await response.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    const icon = status < 400 ? '✅' : '❌';
    console.log(`   ${icon} Status: ${status}`);
    console.log(`   Response:`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data);

    return { status, data };
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { error: error.message };
  }
}

async function runTests() {
  // Test 1: Headers estándar
  await testRequest('Test 1: x-api-key + x-api-secret', `${API_URL}/v1/merchants`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'x-api-secret': API_SECRET,
    },
  });

  // Test 2: Headers en mayúsculas
  await testRequest('Test 2: X-Api-Key + X-Api-Secret', `${API_URL}/v1/merchants`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': API_KEY,
      'X-Api-Secret': API_SECRET,
    },
  });

  // Test 3: Usando apiKey y apiSecret
  await testRequest('Test 3: apiKey + apiSecret', `${API_URL}/v1/merchants`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'apiKey': API_KEY,
      'apiSecret': API_SECRET,
    },
  });

  // Test 4: Query params
  await testRequest('Test 4: Query Params', `${API_URL}/v1/merchants?apiKey=${API_KEY}&apiSecret=${API_SECRET}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Test 5: Probar endpoint /v1/account
  await testRequest('Test 5: /v1/account', `${API_URL}/v1/account`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'x-api-secret': API_SECRET,
    },
  });

  // Test 6: Probar endpoint /v1/me
  await testRequest('Test 6: /v1/me', `${API_URL}/v1/me`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'x-api-secret': API_SECRET,
    },
  });

  // Test 7: Probar /health o similar
  await testRequest('Test 7: /health', `${API_URL}/health`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Test 8: Probar /v1 base
  await testRequest('Test 8: /v1', `${API_URL}/v1`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'x-api-secret': API_SECRET,
    },
  });

  // Test 9: Probar creando un quote (POST)
  await testRequest('Test 9: POST /v1/quotes', `${API_URL}/v1/quotes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'x-api-secret': API_SECRET,
    },
    body: JSON.stringify({
      source_currency: 'USDT',
      target_currency: 'USD',
      amount: 100,
    }),
  });

  // Test 10: Probar URL de producción
  console.log('\n\n🔄 Probando URL de PRODUCCIÓN...');
  await testRequest('Test 10: PROD /v1/merchants', 'https://api.mesta.xyz/v1/merchants', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'x-api-secret': API_SECRET,
    },
  });

  console.log('\n════════════════════════════════════════════════');
}

runTests().catch(console.error);
