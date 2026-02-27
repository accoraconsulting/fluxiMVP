const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const LOGOUT_KEY = 'logout_timestamp';

export function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  // Limpiar marca de logout si existe
  localStorage.removeItem(LOGOUT_KEY);
}

export function getSession() {
  const token = localStorage.getItem(TOKEN_KEY);
  const user = localStorage.getItem(USER_KEY);

  if (!token || !user) return null;

  return {
    token,
    user: JSON.parse(user)
  };
}

/**
 * 🚪 LOGOUT ROBUSTO - Destruye sesión completamente
 * Impide volver atrás y obliga a iniciar sesión de nuevo
 * Usa window.location.replace() para NO permitir historial
 */
export function clearSession() {
  try {
    console.log('[Session] 🚪 Iniciando logout destructivo...');

    // 1️⃣ Limpiar todos los datos de sesión PRIMERO
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.clear();

    // 2️⃣ Marcar que se hizo logout (para que validateSession.js lo detecte)
    // Este es el flag crítico que el script <head> detecta
    localStorage.setItem(LOGOUT_KEY, Date.now().toString());

    console.log('[Session] 🚪 Sesión destruida completamente');
    console.log('[Session] 🚪 logout_timestamp seteado en localStorage');

    // 3️⃣ Redirigir a login REEMPLAZANDO el historial
    // 🚫 window.location.replace() NO agrega al historial
    // 🚫 window.location.href SÍ agrega al historial (PERMITIRÍA volver atrás)
    window.location.replace('./login.html');

    return true;
  } catch (error) {
    console.error('[Session] ❌ Error al limpiar sesión:', error);
    // Fallback: intentar redirect de todas formas
    window.location.replace('./login.html');
    return false;
  }
}

/**
 * ✅ Validar que la sesión es válida (no expirada, no hace logout)
 */
export function isSessionValid() {
  const session = getSession();
  const logoutTime = localStorage.getItem(LOGOUT_KEY);

  // Si no hay sesión, no es válida
  if (!session) return false;

  // Si hay marca de logout, no es válida
  if (logoutTime) return false;

  return true;
}
