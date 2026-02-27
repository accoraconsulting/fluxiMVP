/**
 * TEST MESTA ENDPOINTS
 * Probar diferentes endpoints para verificar autenticación
 */

import 'dotenv/config';

const API_URL = process.env.MESTA_SANDBOX_API_URL || 'https://api.stg.mesta.xyz';
const API_KEY = process.env.MESTA_SANDBOX_API_KEY;
const API_SECRET = process.env.MESTA_SANDBOX_API_SECRET;

console.log('╔════════════════════════════════════════════╗');
console.log('║     TEST ENDPOINTS MESTA API               ║');
console.log('╚════════════════════════════════════════════╝\n');

console.log('📋 Configuración:');
console.log(`   API URL: ${API_URL}`);
console.log(`   API Key: ${API_KEY?.substring(0, 8)}...`);
console.log(`   API Secret: ${API_SECRET?.substring(0, 8)}...`);
console.log('');

// Headers de autenticación
const headers = {
  'Content-Type': 'application/json',
  'x-api-key': API_KEY,
  'x-api-secret': API_SECRET,
};

// Endpoints a probar
const endpoints = [
  { method: 'GET', path: '/v1/merchants', name: 'Listar Merchants' },
  { method: 'GET', path: '/v1/orders', name: 'Listar Orders' },
  { method: 'GET', path: '/v1/quotes', name: 'Listar Quotes' },
  { method: 'GET', path: '/v1/beneficiaries', name: 'Listar Beneficiaries' },
  { method: 'GET', path: '/v1/senders', name: 'Listar Senders' },
];

async function testEndpoint(endpoint) {
  const url = `${API_URL}${endpoint.path}`;

  try {
    const response = await fetch(url, {
      method: endpoint.method,
      headers,
    });

    const status = response.status;
    let data;

    try {
      data = await response.json();
    } catch {
      data = await response.text();
    }

    const icon = status < 400 ? '✅' : '❌';
    console.log(`${icon} ${endpoint.method} ${endpoint.path}`);
    console.log(`   Status: ${status}`);

    if (status < 400) {
      console.log(`   Response: ${JSON.stringify(data).substring(0, 100)}...`);
    } else {
      console.log(`   Error: ${JSON.stringify(data)}`);
    }
    console.log('');

    return { endpoint, status, data };

  } catch (error) {
    console.log(`❌ ${endpoint.method} ${endpoint.path}`);
    console.log(`   Error: ${error.message}`);
    console.log('');
    return { endpoint, error: error.message };
  }
}

async function runTests() {
  console.log('🔌 Probando endpoints...\n');

  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
  }

  // Probar también con header alternativo (Authorization)
  console.log('\n📋 Probando con header Authorization alternativo...\n');

  const altHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
  };

  try {
    const response = await fetch(`${API_URL}/v1/merchants`, {
      method: 'GET',
      headers: altHeaders,
    });
    console.log(`Authorization Bearer: Status ${response.status}`);
  } catch (e) {
    console.log(`Authorization Bearer: Error ${e.message}`);
  }

  // Probar con Basic Auth
  const basicAuth = Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64');
  const basicHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Basic ${basicAuth}`,
  };

  try {
    const response = await fetch(`${API_URL}/v1/merchants`, {
      method: 'GET',
      headers: basicHeaders,
    });
    console.log(`Authorization Basic: Status ${response.status}`);
  } catch (e) {
    console.log(`Authorization Basic: Error ${e.message}`);
  }

  console.log('\n════════════════════════════════════════════════');
}

runTests().catch(console.error);
