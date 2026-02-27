/**
 * 🛡️ PROTECTOR DE RUTAS - FLUXI (SILENCIOSO)
 * Redirige silenciosamente si no tiene acceso, sin alertas ni overlays
 */

import { canAccessView, isUserBlocked } from './role-permissions.js';

/**
 * Verificar si el usuario puede acceder a una ruta
 * @param {string} viewName - Nombre de la vista (dashboard, wallet, etc)
 * @returns {object} { allowed: boolean }
 */
export function checkRouteAccess(viewName) {
  // Obtener datos del usuario del localStorage
  const authToken = localStorage.getItem('auth_token');
  const authUser = localStorage.getItem('auth_user');

  // Si no hay sesión, bloquear (solo esto redirige)
  if (!authToken || !authUser) {
    return {
      allowed: false,
      redirectTo: 'login.html'
    };
  }

  try {
    const user = JSON.parse(authUser);
    const { role, kyc_status } = user;

    // Verificar si puede acceder a esta vista específica
    if (!canAccessView(role, viewName, kyc_status)) {
      return {
        allowed: false,
        redirectTo: 'index.html' // Redirigir silenciosamente a dashboard/KYC
      };
    }

    // ✅ Acceso permitido
    return {
      allowed: true,
      user: user
    };
  } catch (error) {
    console.error('❌ Error verificando acceso:', error);
    return {
      allowed: false,
      redirectTo: 'login.html'
    };
  }
}

/**
 * Verificar acceso PERO NO REDIRIGIR
 * Solo devuelve si tiene o no acceso
 * La sidebar/navbar controlan la visibilidad
 * @param {string} viewName - Nombre de la vista
 * @returns {boolean} true si tiene acceso, false si no
 */
export function guardRoute(viewName) {
  const result = checkRouteAccess(viewName);

  if (!result.allowed) {
    // NO REDIRIGIR - Solo log, el usuario permanece en la página
    console.log(`ℹ️ Sin acceso a ${viewName}, pero permanece en sesión`);
    return false;
  }

  console.log(`✅ Acceso permitido a ${viewName}`);
  return true;
}
