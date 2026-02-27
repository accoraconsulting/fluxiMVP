/**
 * DEBUG TEST
 * Loguea EXACTAMENTE qué se está enviando a Vitawallet
 */

import client from './vitawallet.client.js';
import crypto from 'crypto';
import config from './vitawallet.config.js';

console.log('\n🔍 DEBUG - Analizando credenciales y firma\n');
console.log('═'.repeat(70));

const login = config.SANDBOX.LOGIN;
const transKey = config.SANDBOX.TRANS_KEY;

console.log('\n1️⃣ CREDENCIALES:');
console.log(`  x-login: ${login}`);
console.log(`  x-trans-key (base64): ${transKey}`);

// Decodificar
const transKeyDecoded = Buffer.from(transKey, 'base64');
console.log(`  x-trans-key (hex): ${transKeyDecoded.toString('hex')}`);
console.log(`  x-trans-key (length): ${transKeyDecoded.length} bytes`);

// Crear fecha
const dateString = new Date().toISOString();
console.log(`\n2️⃣ FECHA (x-date):`);
console.log(`  ${dateString}`);

// Crear string a firmar
const method = 'GET';
const path = '/api/businesses/payment_methods/co';
const stringToSign = `${method}\n${path}\n${dateString}`;

console.log(`\n3️⃣ STRING A FIRMAR:`);
console.log('  (raw):');
console.log(stringToSign);
console.log('\n  (con saltos visibles):');
console.log(stringToSign.split('\n').map((line, i) => `    [${i}]: "${line}"`).join('\n'));

// Generar firma
const signature = crypto
  .createHmac('sha256', transKeyDecoded)
  .update(stringToSign)
  .digest('base64');

console.log(`\n4️⃣ FIRMA GENERADA (base64):`);
console.log(`  ${signature}`);
console.log(`  (length): ${signature.length} chars`);

// Authorization header (CON COMA)
const authHeader = `V2-HMAC-SHA256, Signature:${signature}`;
console.log(`\n5️⃣ AUTHORIZATION HEADER:`);
console.log(`  ${authHeader}`);

// Headers finales
console.log(`\n6️⃣ TODOS LOS HEADERS A ENVIAR:`);
const headers = {
  'x-login': login,
  'x-trans-key': transKey,
  'x-date': dateString,
  'Authorization': authHeader,
  'Content-Type': 'application/json',
};

Object.entries(headers).forEach(([key, value]) => {
  const displayValue = key.includes('trans-key') ? value.substring(0, 20) + '...' : value;
  console.log(`  ${key}: ${displayValue}`);
});

console.log('\n7️⃣ AHORA PROBANDO SOLICITUD REAL:');
console.log('═'.repeat(70) + '\n');

try {
  const response = await client.get('/api/businesses/payment_methods/co');
  console.log('✅ SUCCESS!');
  console.log(JSON.stringify(response, null, 2));
} catch (error) {
  console.log('❌ FAILED!');
  console.log(JSON.stringify(error, null, 2));
}

console.log('\n' + '═'.repeat(70));
