/**
 * 📍 ACTUALIZADOR DE NAVBAR - Por Rol y Permisos
 * Muestra/oculta opciones de menú según rol y estado KYC
 */

import { getAllowedViews, ROLE_PERMISSIONS } from './role-permissions.js';

/**
 * Mapeo de vistas a elementos del navbar
 */
const VIEW_TO_NAVBAR_MAP = {
  dashboard: 'nav-dashboard',
  wallet: 'nav-wallet',
  send: 'nav-send',
  withdraw: 'nav-withdraw',
  deposit: 'nav-deposit',
  movements: 'nav-movements',
  myAccount: 'nav-account',
  support: 'nav-support',
  kyc: 'nav-kyc',
  kycManagement: 'nav-kyc-management',
  admin: 'nav-admin',
  enrolled: 'nav-enrolled'
};

/**
 * Actualizar navbar según permisos del usuario
 */
export function updateNavbarByPermissions() {
  try {
    // Obtener datos del usuario
    const authUser = localStorage.getItem('auth_user');
    if (!authUser) {
      console.warn('⚠️ No hay usuario en sesión');
      return;
    }

    const user = JSON.parse(authUser);
    const { role, kyc_status } = user;

    // Obtener vistas permitidas
    const allowedViews = getAllowedViews(role, kyc_status);

    console.log(`🔐 Actualizando navbar - Rol: ${role}, KYC: ${kyc_status}`);
    console.log(`✅ Vistas permitidas:`, allowedViews);

    // Recorrer todas las opciones del navbar
    Object.entries(VIEW_TO_NAVBAR_MAP).forEach(([view, elementId]) => {
      const element = document.getElementById(elementId);
      if (!element) return;

      if (allowedViews.includes(view)) {
        // Mostrar
        element.style.display = 'block';
        element.classList.remove('disabled');
        console.log(`✅ Mostrando: ${view}`);
      } else {
        // Ocultar o deshabilitar
        element.style.display = 'none';
        element.classList.add('disabled');
        element.style.pointerEvents = 'none';
        console.log(`❌ Ocultando: ${view}`);
      }
    });

    // Si es fluxiUser sin KYC, mostrar advertencia
    if (role === 'fluxiUser' && kyc_status !== 'approved') {
      showKYCAlert();
    }
  } catch (error) {
    console.error('❌ Error actualizando navbar:', error);
  }
}

/**
 * Mostrar alerta de KYC pendiente en el navbar
 */
function showKYCAlert() {
  // Buscar o crear contenedor de alertas
  let alertContainer = document.getElementById('kyc-alert-container');

  if (!alertContainer) {
    alertContainer = document.createElement('div');
    alertContainer.id = 'kyc-alert-container';
    alertContainer.style.cssText = `
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 12px 16px;
      margin: 10px 0;
      border-radius: 4px;
      font-size: 14px;
      color: #92400e;
    `;
    alertContainer.innerHTML = `
      <strong>⚠️ Verificación pendiente:</strong>
      Completa tu identificación para acceder a todas las funciones.
      <a href="index.html" style="color: #d97706; text-decoration: underline; margin-left: 10px;">Ir a verificación</a>
    `;

    // Buscar navbar y agregar alerta
    const navbar = document.querySelector('nav') || document.querySelector('.navbar');
    if (navbar) {
      navbar.insertBefore(alertContainer, navbar.firstChild);
    }
  }
}

/**
 * Actualizar título y descripción de la vista según rol
 */
export function updateViewHeader(viewName) {
  const authUser = localStorage.getItem('auth_user');
  if (!authUser) return;

  try {
    const user = JSON.parse(authUser);
    const roleInfo = ROLE_PERMISSIONS[user.role];

    if (!roleInfo) return;

    // Buscar elemento de rol en la UI
    const roleElement = document.getElementById('user-role-display');
    if (roleElement) {
      roleElement.textContent = `${roleInfo.name} • ${roleInfo.description}`;
    }
  } catch (error) {
    console.error('❌ Error actualizando header:', error);
  }
}

/**
 * Crear menú contextual según rol
 */
export function buildContextMenu() {
  const authUser = localStorage.getItem('auth_user');
  if (!authUser) return null;

  try {
    const user = JSON.parse(authUser);
    const allowedViews = getAllowedViews(user.role, user.kyc_status);

    const menuItems = [];

    // Opciones disponibles
    const options = [
      { view: 'myAccount', label: '👤 Mi Cuenta', icon: 'user' },
      { view: 'support', label: '💬 Soporte', icon: 'help' },
      { view: 'kyc', label: '📋 Verificación', icon: 'check' },
      { view: 'dashboard', label: '📊 Dashboard', icon: 'chart' },
      { view: 'wallet', label: '💳 Wallet', icon: 'wallet' }
    ];

    // Filtrar solo las permitidas
    options.forEach((option) => {
      if (allowedViews.includes(option.view)) {
        menuItems.push(option);
      }
    });

    return menuItems;
  } catch (error) {
    console.error('❌ Error creando menú:', error);
    return null;
  }
}

/**
 * Ejecutar al cargar cualquier página
 */
export function initializePermissions() {
  console.log('🔐 Inicializando sistema de permisos...');
  updateNavbarByPermissions();
  updateViewHeader();
  console.log('✅ Permisos inicializados');
}
