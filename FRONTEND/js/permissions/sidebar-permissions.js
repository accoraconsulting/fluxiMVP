/**
 * 🔐 SIDEBAR PERMISSIONS
 * Oculta/muestra opciones de la sidebar según rol y KYC del usuario
 * SIN redirigir, SIN alertas, SOLO ocultar inteligentemente
 */

import { getAllowedViews, ROLE_PERMISSIONS } from './role-permissions.js';

/**
 * Mapeo de vistas a IDs de elementos en la sidebar
 */
const SIDEBAR_ELEMENTS = {
  dashboard: 'sidebar-dashboard',
  wallet: 'sidebar-wallet',
  movements: 'sidebar-movements',
  send: 'sidebar-send',
  deposit: 'sidebar-deposit',
  withdraw: 'sidebar-withdraw',
  enrolled: 'sidebar-enrolled',
  kyc: 'sidebar-kyc',
  admin: 'sidebar-admin',
  myAccount: 'sidebar-myaccount',
  support: 'sidebar-support',
  payinsAdmin: 'sidebar-payins-admin',
  payinsPending: 'sidebar-payins-pending',
  payinsUser: 'sidebar-payins-user'
};

/**
 * Actualizar sidebar según permisos del usuario
 * Solo OCULTA/MUESTRA, sin redirigir
 */
export function updateSidebarWithPermissions() {
  try {
    const authUser = localStorage.getItem('auth_user');
    if (!authUser) {
      console.warn('⚠️ No hay usuario en sesión');
      return;
    }

    const user = JSON.parse(authUser);
    const { role, kyc_status } = user;
    const allowedViews = getAllowedViews(role, kyc_status);

    console.log(`🔐 Actualizando sidebar - Rol: ${role}, KYC: ${kyc_status}`);
    console.log(`✅ Vistas permitidas:`, allowedViews);

    // Actualizar cada elemento de la sidebar
    Object.entries(SIDEBAR_ELEMENTS).forEach(([view, elementId]) => {
      const element = document.getElementById(elementId);
      if (!element) {
        console.warn(`⚠️ Elemento no encontrado: ${elementId}`);
        return;
      }

      if (allowedViews.includes(view)) {
        // Mostrar
        element.style.display = '';
        element.classList.remove('disabled');
        element.style.pointerEvents = 'auto';
        element.style.opacity = '1';
        console.log(`✅ Mostrando: ${view}`);
      } else {
        // Ocultar
        element.style.display = 'none';
        element.classList.add('disabled');
        console.log(`❌ Ocultando: ${view}`);
      }
    });

    console.log('✅ Sidebar actualizada correctamente');
  } catch (error) {
    console.error('❌ Error actualizando sidebar:', error);
  }
}

/**
 * Mostrar opción "Verificar identidad" cuando sea necesario
 * (Para fluxiUser sin KYC)
 */
export function showKYCOptionIfNeeded() {
  try {
    const authUser = localStorage.getItem('auth_user');
    if (!authUser) return;

    const user = JSON.parse(authUser);

    // Si es fluxiUser sin KYC, mostrar "Verificar identidad"
    if (user.role === 'fluxiUser' && user.kyc_status !== 'approved') {
      const kycElement = document.getElementById('sidebar-kyc');
      if (kycElement) {
        kycElement.style.display = '';
        console.log('✅ Mostrando "Verificar identidad"');
      }
    }
  } catch (error) {
    console.error('❌ Error en showKYCOptionIfNeeded:', error);
  }
}

/**
 * Mostrar opción "Panel Admin" si es admin
 */
export function showAdminPanelIfNeeded() {
  try {
    const authUser = localStorage.getItem('auth_user');
    if (!authUser) return;

    const user = JSON.parse(authUser);

    // Si es admin, mostrar "Panel Admin" y "Sistema de Payins"
    if (user.role === 'fluxiAdmin') {
      // Mostrar Panel Admin
      const adminElement = document.getElementById('sidebar-admin');
      if (adminElement) {
        adminElement.style.display = '';
        console.log('✅ Mostrando "Panel Admin"');
      }

      // Mostrar separador de Payins
      const separatorElement = document.getElementById('sidebar-payins-separator');
      if (separatorElement) {
        separatorElement.style.display = '';
        console.log('✅ Mostrando separador de Payins');
      }

      // Mostrar links de Payins
      const payinsAdminElement = document.getElementById('sidebar-payins-admin');
      if (payinsAdminElement) {
        payinsAdminElement.style.display = '';
        console.log('✅ Mostrando "Crear Payins"');
      }

      const payinsPendingElement = document.getElementById('sidebar-payins-pending');
      if (payinsPendingElement) {
        payinsPendingElement.style.display = '';
        console.log('✅ Mostrando "Payins Pendientes"');
      }
    }
  } catch (error) {
    console.error('❌ Error en showAdminPanelIfNeeded:', error);
  }
}

/**
 * Inicializar permisos de sidebar
 */
export function initSidebarPermissions() {
  console.log('🔐 Inicializando permisos de sidebar...');

  // Actualizar sidebar inmediatamente
  updateSidebarWithPermissions();
  showKYCOptionIfNeeded();
  showAdminPanelIfNeeded();

  // Escuchar cambios de KYC
  window.addEventListener('kyc_statusChanged', (event) => {
    console.log('🔄 Cambio de KYC detectado, actualizando sidebar...');
    updateSidebarWithPermissions();
    showKYCOptionIfNeeded();
  });

  // Observar cambios en la sidebar (por si se inserta dinámicamente)
  const sidebar = document.querySelector('.sidebar-menu');
  if (sidebar) {
    const observer = new MutationObserver(() => {
      updateSidebarWithPermissions();
    });

    observer.observe(sidebar, {
      childList: true,
      subtree: true
    });
  }

  console.log('✅ Permisos de sidebar inicializados');
}

// Auto-inicializar cuando el document esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSidebarPermissions);
} else {
  initSidebarPermissions();
}
