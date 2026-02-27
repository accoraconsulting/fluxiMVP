/**
 * 🚪 LOGOUT MODAL - Reutilizable para Navbar y Sidebar
 * Modal hermoso con estilo FLUXI para confirmar logout
 */

console.log('[LogoutModal] 🚀 Módulo cargado, asignando funciones a window...');

// NO importar aquí - importar en executeLogout() para evitar errores al cargar el módulo

// Crear el modal UNA SOLA VEZ
function createLogoutModal() {
  const existingModal = document.getElementById('logoutModal');
  if (existingModal) return;

  const modal = document.createElement('div');
  modal.id = 'logoutModal';
  modal.className = 'modern-modal';
  modal.innerHTML = `
    <div class="modern-modal-backdrop" onclick="closeLogoutModal()"></div>
    <div class="modern-modal-card" style="max-width: 400px;">
      <div class="modern-modal-header">
        <div class="modern-modal-icon warning">
          <i class="bx bx-log-out"></i>
        </div>
        <h3>¿Cerrar sesión?</h3>
        <button class="modern-modal-close" onclick="closeLogoutModal()">
          <i class="bx bx-x"></i>
        </button>
      </div>

      <div class="modern-modal-body">
        <p style="text-align: center; color: #475569; line-height: 1.6;">
          Tendrás que iniciar sesión de nuevo para acceder a tu cuenta.
        </p>
      </div>

      <div class="modern-modal-footer">
        <button class="modern-btn secondary" onclick="closeLogoutModal()">
          <i class="bx bx-x"></i>
          Cancelar
        </button>
        <button class="modern-btn danger" id="confirmLogoutBtn" onclick="executeLogout()">
          <i class="bx bx-check"></i>
          Cerrar sesión
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  console.log('[LogoutModal] ✅ Modal creado');
}

/**
 * Mostrar el modal de logout
 */
window.showLogoutModal = function() {
  console.log('[LogoutModal] ✅ window.showLogoutModal() ejecutada');
  createLogoutModal();
  const modal = document.getElementById('logoutModal');
  if (modal) {
    modal.classList.add('active');
    console.log('[LogoutModal] 📋 Modal mostrado');
  }
};

console.log('[LogoutModal] ✅ Funciones asignadas a window: showLogoutModal, closeLogoutModal, executeLogout');

/**
 * Cerrar el modal de logout
 */
window.closeLogoutModal = function() {
  const modal = document.getElementById('logoutModal');
  if (modal) {
    modal.classList.remove('active');
    console.log('[LogoutModal] ✅ Modal cerrado');
  }
};

/**
 * Ejecutar logout cuando usuario confirma
 */
window.executeLogout = async function() {
  try {
    const btn = document.getElementById('confirmLogoutBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Cerrando sesión...';
    }

    console.log('[LogoutModal] 🚪 Ejecutando logout...');

    // Importar clearSession AQUÍ para evitar errores al cargar el módulo
    const { clearSession } = await import('./auth/session.js');
    clearSession();

  } catch (error) {
    console.error('[LogoutModal] ❌ Error en logout:', error);
    // Fallback: logout manual sin cerrar sesión
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace('./login.html');
  }
};

// Exportar para uso en otros módulos
export { createLogoutModal };
