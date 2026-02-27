/**
 * =====================================================
 * API CONFIGURATION - DINÁMICO SEGÚN AMBIENTE
 * =====================================================
 *
 * Detecta automáticamente si está en:
 * - Localhost/desarrollo: http://localhost:3000
 * - Render/producción: https://[tu-dominio].onrender.com
 */

const isDevelopment = window.location.hostname === 'localhost' ||
                      window.location.hostname === '127.0.0.1';

export const API_CONFIG = {
  // URL base de la API
  BASE_URL: isDevelopment
    ? 'http://localhost:3000'
    : window.location.origin,

  // Endpoint de la API
  API_ENDPOINT: isDevelopment
    ? 'http://localhost:3000/api'
    : `${window.location.origin}/api`,

  // Para debug
  isDevelopment: isDevelopment,

  // URLs comunes
  AUTH_LOGIN: isDevelopment
    ? 'http://localhost:3000/api/auth/login'
    : `${window.location.origin}/api/auth/login`,

  AUTH_REGISTER: isDevelopment
    ? 'http://localhost:3000/api/auth/register'
    : `${window.location.origin}/api/auth/register`,
};

// Para compatibilidad con imports antiguos
export const API_BASE = API_CONFIG.API_ENDPOINT;

console.log(`🔧 [API Config] Ambiente: ${API_CONFIG.isDevelopment ? 'DESARROLLO' : 'PRODUCCIÓN'}`);
console.log(`🔧 [API Config] Base URL: ${API_CONFIG.BASE_URL}`);
console.log(`🔧 [API Config] API Endpoint: ${API_CONFIG.API_ENDPOINT}`);
