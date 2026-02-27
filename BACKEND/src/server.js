import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Obtener directorio actual
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar .env desde la raíz del proyecto (un nivel arriba de src)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Importar app DESPUÉS de cargar dotenv
import app from './app.js';

const PORT = process.env.PORT || 3000;

console.log(`🚀 API running on port ${PORT}`);
const server = app.listen(PORT, () => {
  console.log('📍 Server is ready for requests...');
});

// Configurar timeouts del servidor
server.keepAliveTimeout = 30000;
server.headersTimeout = 30000;

// Prevenir que Node.js cierre el proceso
// setTimeout con Infinity mantiene el event loop activo indefinidamente
const keepAliveInterval = setInterval(() => {}, 1000);

console.log('🟢 Server is running and waiting for connections...');

// Capturar errores no manejados
process.on('uncaughtException', (error) => {
  console.error('❌ UNCAUGHT EXCEPTION:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('⚠️ SIGTERM received, closing server...');
  server.close(() => {
    console.log('✅ Server closed gracefully');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('⚠️ SIGINT received (Ctrl+C), closing server...');
  server.close(() => {
    console.log('✅ Server closed gracefully');
    process.exit(0);
  });
});




