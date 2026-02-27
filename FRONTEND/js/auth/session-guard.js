/**
 * 🛡️ SESSION GUARD - Protege páginas contra sesiones inválidas
 * Previene que usuarios vuelvan atrás después de logout
 *
 * Uso en cada página protegida:
 * import { guardPage } from '../auth/session-guard.js';
 * guardPage(); // Al inicio del DOMContentLoaded
 */

import { getSession, isSessionValid, clearSession } from './session.js';

/**
 * 🛡️ Proteger una página - Verificar sesión válida
 * Si no hay sesión o es inválida, redirige a login sin permitir volver atrás
 */
export function guardPage() {
  const session = getSession();
  const isValid = isSessionValid();

  // 1️⃣ Verificar si hay sesión
  if (!session) {
    console.warn('[Guard] ⚠️ No hay sesión activa');
    redirectToLogin('sesión expirada');
    return false;
  }

  // 2️⃣ Verificar si la sesión es válida (no fue hecha logout)
  if (!isValid) {
    console.warn('[Guard] ⚠️ Sesión inválida (se cerró sesión)');
    redirectToLogin('sesión cerrada');
    return false;
  }

  console.log('[Guard] ✅ Sesión válida para:', session.user?.email);

  // 3️⃣ Prevenir volver atrás (reemplazar historial)
  window.history.replaceState(null, '', window.location.pathname);

  return true;
}

/**
 * 🚪 Redirigir a login SIN permitir volver atrás (REPLACE, no push)
 * window.location.replace() NO agrega al historial
 */
function redirectToLogin(reason = '') {
  console.log(`[Guard] 🚪 [${reason}] Bloqueando acceso, forzando login...`);

  // Limpiar datos ANTES de redirect
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
  sessionStorage.clear();

  // 🚫 CRÍTICO: Usar window.location.replace() NO window.location.href
  // replace() NO agrega al historial del navegador
  // href SÍ agrega al historial (permite volver atrás)
  window.location.replace('./login.html');
}

/**
 * ⏱️ Validación continua - Revisar sesión cada 5 segundos
 * Si se cierra sesión en otra pestaña, sincroniza aquí también
 */
export function startSessionMonitor(intervalMs = 5000) {
  setInterval(() => {
    const session = getSession();
    const isValid = isSessionValid();

    // Si la sesión se volvió inválida, redirigir
    if (!session || !isValid) {
      console.warn('[Guard] ⚠️ Sesión perdida en monitor');
      redirectToLogin('sesión perdida en otro sitio');
    }
  }, intervalMs);

  console.log('[Guard] 👁️ Monitor de sesión iniciado cada', intervalMs, 'ms');
}

/**
 * 🚪 Logout seguro (para uso en página)
 */
export function safeLogout() {
  if (confirm('¿Cerrar sesión? Tendrás que iniciar sesión de nuevo.')) {
    clearSession();
  }
}
