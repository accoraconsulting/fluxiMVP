/**
 * 🔗 INTEGRACIÓN: NAVBAR + PERMISOS
 * Asegura que el navbar solo muestre opciones permitidas
 */

import { getAllowedViews, ROLE_PERMISSIONS } from './permissions/role-permissions.js';

/**
 * Mapeo de vistas a elementos del navbar
 * ACTUALIZAR SI SE AGREGAN MÁS OPCIONES AL NAVBAR
 */
const NAVBAR_ELEMENTS = {
  dashboard: {
    id: 'nav-dashboard',
    text: 'Dashboard',
    href: 'dashboard.html'
  },
  wallet: {
    id: 'nav-wallet',
    text: 'Wallet',
    href: 'wallet.html'
  },
  send: {
    id: 'nav-send',
    text: 'Enviar',
    href: 'send.html'
  },
  withdraw: {
    id: 'nav-withdraw',
    text: 'Retirar',
    href: 'withdraw.html'
  },
  deposit: {
    id: 'nav-deposit',
    text: 'Depositar',
    href: 'deposit.html'
  },
  movements: {
    id: 'nav-movements',
    text: 'Movimientos',
    href: 'moviments.html'
  },
  enrolled: {
    id: 'nav-enrolled',
    text: 'Afiliados',
    href: 'enrolled.html'
  },
  myAccount: {
    id: 'nav-account',
    text: 'Mi Cuenta',
    href: 'myaccount.html'
  },
  support: {
    id: 'nav-support',
    text: 'Soporte',
    href: 'support.html'
  },
  kyc: {
    id: 'nav-kyc',
    text: 'Verificación',
    href: 'index.html'
  },
  kycManagement: {
    id: 'nav-kyc-management',
    text: 'Revisar KYC',
    href: 'kyc-management.html'
  },
  admin: {
    id: 'nav-admin',
    text: 'Admin',
    href: 'admin-panel.html'
  }
};

/**
 * Actualizar navbar según permisos del usuario
 */
export function updateNavbarWithPermissions() {
  try {
    const authUser = localStorage.getItem('auth_user');
    if (!authUser) {
      console.warn('⚠️ No hay usuario en sesión');
      return;
    }

    const user = JSON.parse(authUser);
    const { role, kyc_status } = user;
    const allowedViews = getAllowedViews(role, kyc_status);

    console.log(`🔐 Actualizando navbar - Rol: ${role}, KYC: ${kyc_status}`);
    console.log(`✅ Vistas permitidas:`, allowedViews);

    // Actualizar cada elemento del navbar
    Object.entries(NAVBAR_ELEMENTS).forEach(([view, config]) => {
      const element = document.getElementById(config.id);
      if (!element) return;

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
        element.style.pointerEvents = 'none';
        element.style.opacity = '0.5';
        console.log(`❌ Ocultando: ${view}`);
      }
    });

    // Actualizar información de rol en navbar si existe
    updateRoleDisplay(role, user);

    // SIN advertencia visible - solo ocultar opciones silenciosamente
  } catch (error) {
    console.error('❌ Error actualizando navbar con permisos:', error);
  }
}

/**
 * Mostrar información del rol en el navbar
 */
function updateRoleDisplay(role, user) {
  const roleInfo = ROLE_PERMISSIONS[role];
  if (!roleInfo) return;

  // Buscar elemento para mostrar rol (si existe)
  const roleElement = document.getElementById('user-role-display');
  if (roleElement) {
    roleElement.textContent = `👤 ${roleInfo.name}`;
    roleElement.title = roleInfo.description;
  }

  // Mostrar estado KYC si es fluxiUser
  if (role === 'fluxiUser') {
    const kycStatusElement = document.getElementById('user-kyc-status');
    if (kycStatusElement) {
      const statusText = user.kyc_status === 'approved' ? '✅ Verificado' : '⏳ Pendiente';
      kycStatusElement.textContent = statusText;
      kycStatusElement.style.color =
        user.kyc_status === 'approved' ? '#10b981' : '#f59e0b';
    }
  }
}

/**
 * Remover advertencia de KYC
 * (Ya no mostramos advertencia, solo ocultamos las opciones)
 */

/**
 * Remover advertencia de KYC cuando sea aprobado
 */
export function removeKYCWarning() {
  const warningContainer = document.getElementById('navbar-kyc-warning');
  if (warningContainer) {
    warningContainer.remove();
  }
}

/**
 * Crear elemento para mostrar rol actual
 */
export function createRoleIndicator() {
  const indicator = document.createElement('span');
  indicator.id = 'user-role-display';
  indicator.style.cssText = `
    display: inline-block;
    padding: 4px 10px;
    background: #ede9fe;
    color: #6d28d9;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    margin: 0 8px;
  `;
  return indicator;
}

/**
 * Inicializar integración navbar + permisos
 */
export function initNavbarPermissions() {
  console.log('🔗 Inicializando integración navbar + permisos...');

  // Actualizar navbar inmediatamente
  updateNavbarWithPermissions();

  // Actualizar cuando el navbar se inserte en el DOM
  const observer = new MutationObserver(() => {
    // Revalidar permisos cada vez que el navbar cambia
    updateNavbarWithPermissions();
  });

  const navbarContainer = document.querySelector('.fluxi-navbar') || document.querySelector('nav');
  if (navbarContainer) {
    observer.observe(navbarContainer, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });
  }

  // Escuchar cambios de KYC
  window.addEventListener('kycStatusChanged', (event) => {
    console.log('🔄 Cambio de KYC detectado, actualizando navbar...');
    updateNavbarWithPermissions();

    if (event.detail.newStatus === 'approved') {
      // Notificación discreta al aprobar KYC
      showSuccessNotification(
        '🎉 ¡Verificación Completada!',
        'Tu identificación ha sido aprobada. Ahora tienes acceso completo a la plataforma.'
      );
    }
  });

  console.log('✅ Integración navbar + permisos inicializada');
}

/**
 * Mostrar notificación de éxito
 */
function showSuccessNotification(title, message) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    padding: 16px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    z-index: 10000;
    max-width: 400px;
    font-weight: 500;
  `;

  notification.innerHTML = `
    <h4 style="margin: 0 0 4px 0; font-size: 16px;">${title}</h4>
    <p style="margin: 0; font-size: 14px;">${message}</p>
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

// Auto-inicializar cuando el document esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNavbarPermissions);
} else {
  initNavbarPermissions();
}
