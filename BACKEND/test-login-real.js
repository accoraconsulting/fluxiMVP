import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

console.log('🔑 Probando login con credenciales existentes...\n');

// Probar con cada usuario
const usuarios = [
  { email: 'dev@fluxi.com', password: 'dev123' },
  { email: 'docs@fluxi.com', password: 'docs123' },
  { email: 'payo.project.dev@gmail.com', password: 'password123' }
];

for (const user of usuarios) {
  const response = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user)
  });

  const data = await response.json();
  console.log(`📧 ${user.email}:`);
  console.log(`   Respuesta:`, data.message || data.error || JSON.stringify(data));
  console.log('');
}
