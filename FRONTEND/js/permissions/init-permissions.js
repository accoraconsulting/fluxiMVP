/**
 * 🔐 INICIALIZADOR GLOBAL DE PERMISOS
 * Se ejecuta automáticamente en TODAS las vistas
 * Coordina: bloqueo de rutas + actualización de navbar + monitoreo KYC
 */

import { guardRoute } from './route-guard.js';
import { initializePermissions, updateNavbarByPermissions } from './navbar-updater.js';
import { startKYCMonitoring } from './kyc-status-monitor.js';
import { updateNavbarWithPermissions } from '../navbar-permissions-integration.js';
import { initSidebarPermissions } from './sidebar-permissions.js';

/**
 * Mapeo de archivos HTML a nombres de vistas
 */
const PAGE_VIEW_MAP = {
  'dashboard.html': 'dashboard',
  'wallet.html': 'wallet',
  'send.html': 'send',
  'withdraw.html': 'withdraw',
  'deposit.html': 'deposit',
  'moviments.html': 'movements',
  'myaccount.html': 'myAccount',
  'support.html': 'support',
  'index.html': 'kyc',
  'kyc-management.html': 'kycManagement',
  'admin-panel.html': 'admin',
  'enrolled.html': 'enrolled',
  'kyc-processing.html': 'kyc',
  'kyc-review.html': 'kycManagement',
  // Páginas públicas (sin protección):
  'login.html': null,
  'singup.html': null,
  'registerkyc.html': null,
  'reset-password.html': null
};

/**
 * Obtener nombre de vista actual
 */
function getCurrentViewName() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  return PAGE_VIEW_MAP[currentPage] || null;
}

/**
 * Inicializar permisos en la página actual
 */
export function initPermissions() {
  console.log('🔐 Inicializando sistema de permisos global...');

  const viewName = getCurrentViewName();

  // Si es página pública, no proteger
  if (viewName === null) {
    console.log(`✅ Página pública: ${window.location.pathname}`);
    return;
  }

  // Proteger ruta
  console.log(`🛡️ Protegiendo vista: ${viewName}`);
  const hasAccess = guardRoute(viewName, 'index.html');

  if (!hasAccess) {
    // Si no tiene acceso, guardRoute ya redirige
    return;
  }

  // Actualizar navbar
  console.log('📍 Actualizando navbar...');
  initializePermissions();
  updateNavbarByPermissions();
  updateNavbarWithPermissions(); // Integración con permisos

  // Actualizar sidebar (puede fallar si el sidebar aún no se cargó vía fetch)
  console.log('📋 Actualizando sidebar...');
  initSidebarPermissions();

  // Re-aplicar permisos cuando el sidebar termine de cargarse vía sidebar-loader.js
  document.addEventListener('sidebar:loaded', () => {
    console.log('📋 Sidebar cargado, re-aplicando permisos...');
    initSidebarPermissions();
  });

  // Iniciar monitoreo KYC
  startKYCMonitoring(30);

  // Escuchar cambios de permisos
  window.addEventListener('kycStatusChanged', (event) => {
    console.log('🔄 Cambio de KYC detectado, actualizando UI...');
    updateNavbarByPermissions();
    initSidebarPermissions();
  });

  console.log('✅ Sistema de permisos inicializado correctamente');
}

/**
 * Auto-iniciar al cargar el documento
 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPermissions);
} else {
  initPermissions();
}
