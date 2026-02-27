import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

// Importar loginUser directamente
import { loginUser } from './src/services/auth.service.js';

try {
  console.log('\n🔑 Probando login directo...\n');

  const result = await loginUser('juato6001@gmail.com', '123456789');

  console.log('✅ LOGIN EXITOSO!\n');
  console.log('Token:', result.token.substring(0, 30) + '...');
  console.log('Usuario:', result.user);

} catch (error) {
  console.error('❌ ERROR:', error.message);
  console.error('Stack:', error.stack);
}
