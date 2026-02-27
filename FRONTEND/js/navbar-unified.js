/**
 * NAVBAR UNIFICADO - Script de gestión
 * Maneja: usuario, notificaciones, dropdown menu, logout
 */

// Inicializar navbar - ejecutar inmediatamente si el DOM ya está listo
// (el script se carga al final del body, así que el DOM siempre estará listo)
function initNavbarOnceReady() {
  console.log('[Navbar] 🚀 Inicializando navbar');
  initializeNavbar();

  // Intentar actualizar nombre después de varios delays
  // (asegurar que se ejecute aunque otros scripts carguen después)
  setTimeout(() => {
    console.log('[Navbar] 📍 Intento 1 (100ms)');
    updateNavbarUser();
  }, 100);

  setTimeout(() => {
    console.log('[Navbar] 📍 Intento 2 (300ms)');
    updateNavbarUser();
  }, 300);

  setTimeout(() => {
    console.log('[Navbar] 📍 Intento 3 (500ms)');
    updateNavbarUser();
  }, 500);

  setTimeout(() => {
    console.log('[Navbar] 📍 Intento 4 (1000ms)');
    updateNavbarUser();
  }, 1000);
}

// Si el DOM está listo, inicializar inmediatamente
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNavbarOnceReady);
} else {
  // El DOM ya está listo (el script está al final del body)
  initNavbarOnceReady();
}

// Actualizar nombre también cuando la página se hace visible
// (útil cuando vuelves de otra pestaña)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    updateNavbarUser();
  }
});

// Observer para detectar cuando el navbar se inserta en el DOM
// (en caso de que se cargue dinámicamente después del script)
setTimeout(() => {
  let attemptCount = 0;
  const maxAttempts = 50; // Reintentar hasta 50 veces

  const navbarObserver = new MutationObserver(() => {
    attemptCount++;
    const navUsername = document.getElementById('navUsername');

    if (navUsername) {
      console.log('[Navbar] 👁️ Elemento #navUsername detectado por MutationObserver');

      // Si sigue diciendo "Usuario", intentar actualizar
      if (navUsername.textContent === 'Usuario') {
        console.log('[Navbar] 🔄 Reintentando actualizar (MutationObserver)');
        updateNavbarUser();
      }

      // Detener observar después de encontrar el elemento 10 veces
      if (attemptCount > maxAttempts) {
        console.log('[Navbar] 🛑 MutationObserver finalizado (max attempts)');
        navbarObserver.disconnect();
      }
    }
  });

  // Observar cambios en el documento
  navbarObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });

  console.log('[Navbar] 👁️ MutationObserver iniciado');
}, 100);

// Reintento agresivo cada 500ms por 5 segundos (si el elemento existe pero está vacío)
let retryCount = 0;
const retryInterval = setInterval(() => {
  retryCount++;
  const navUsername = document.getElementById('navUsername');

  if (navUsername && navUsername.textContent === 'Usuario') {
    console.log(`[Navbar] 🔄 Reintento #${retryCount}: Actualizando desde interval`);
    updateNavbarUser();
  }

  // Parar después de 10 reintentos (5 segundos)
  if (retryCount >= 10) {
    clearInterval(retryInterval);
    console.log('[Navbar] ⏹️ Retry interval finalizado');
  }
}, 500);

/**
 * Inicializar todos los elementos del navbar
 */
function initializeNavbar() {
  updateNavbarUser();
  setupNavbarMenuToggle();
  setupNotificationIcon();
  checkAndShowPendingCount();
}

/**
 * Obtener sesión desde localStorage (claves correctas: auth_token y auth_user)
 */
function getSessionFromStorage() {
  try {
    // Obtener token y usuario usando las claves correctas
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('auth_user');

    console.log('[Navbar] 🔍 Verificando sesión - auth_token:', !!token, 'auth_user:', !!userStr);

    if (token && userStr) {
      const user = JSON.parse(userStr);
      console.log('[Navbar] ✅ Sesión encontrada (auth_token + auth_user)');
      return {
        token,
        user
      };
    } else {
      console.log('[Navbar] ⚠️ Sin sesión en localStorage');
    }
  } catch (error) {
    console.warn('[Navbar] Error parseando sesión:', error);
  }
  return null;
}

/**
 * Actualizar nombre del usuario en el navbar
 */
function updateNavbarUser() {
  try {
    // Obtener sesión desde localStorage (más confiable)
    const session = getSessionFromStorage();

    // Debug: mostrar qué hay en localStorage
    const sessionRaw = localStorage.getItem('fluxiSession');
    console.log('[Navbar] 🔍 localStorage.fluxiSession disponible:', !!sessionRaw);

    if (session && session.user) {
      const usernameEl = document.getElementById('navUsername');
      const avatarEl = document.getElementById('navUserAvatar');

      // Obtener nombre: username > email > "Usuario"
      const username = session.user.username || session.user.email || 'Usuario';

      console.log('[Navbar] 🔍 Sesión encontrada, usuario:', username);
      console.log('[Navbar] 🔍 Usuario completo:', session.user);

      if (usernameEl) {
        usernameEl.textContent = username;
        console.log('[Navbar] ✅ Nombre actualizado en navbar:', username);
      } else {
        console.log('[Navbar] ⚠️ Elemento #navUsername no encontrado');
        console.log('[Navbar] 🔍 Elementos disponibles:', document.getElementById('navUsername'));
      }

      // También actualizar elementos con data-user-name (compatibilidad)
      const dataUserElements = document.querySelectorAll('[data-user-name]');
      console.log('[Navbar] 🔍 Elementos con data-user-name:', dataUserElements.length);
      dataUserElements.forEach(el => {
        el.textContent = username;
      });

      // Actualizar avatar - usar mascota de FLUXI por defecto
      if (avatarEl) {
        // Siempre usar la mascota de FLUXI (no hay avatares personalizados)
        avatarEl.src = './assets/mascota.jpeg';
        avatarEl.alt = 'Avatar FLUXI';
        console.log('[Navbar] 🖼️ Avatar actualizado (mascota FLUXI)');
      }
    } else {
      console.log('[Navbar] ⚠️ Sin sesión disponible en localStorage');
      console.log('[Navbar] 🔍 Session object:', session);
      if (!session) {
        console.log('[Navbar] 🔍 localStorage.fluxiSession:', localStorage.getItem('fluxiSession'));
      }
    }
  } catch (error) {
    console.error('[Navbar] ❌ Error al actualizar usuario:', error);
    console.error('[Navbar] Stack:', error.stack);
  }
}

/**
 * Setup del toggle del menu dropdown del usuario
 */
function setupNavbarMenuToggle() {
  const navUserButton = document.getElementById('navUserButton');
  const navUserMenu = document.getElementById('navUserMenu');

  if (!navUserButton || !navUserMenu) return;

  // Click en el usuario abre/cierra el menu
  navUserButton.addEventListener('click', (e) => {
    e.stopPropagation();
    navUserButton.classList.toggle('active');
  });

  // Cerrar menu cuando hace click fuera
  document.addEventListener('click', (e) => {
    // Si el click no es en el botón o el menú, cerrar
    if (!navUserButton.contains(e.target) && !navUserMenu.contains(e.target)) {
      navUserButton.classList.remove('active');
    }
  });

  // Cerrar menu cuando hace click en un item
  const menuItems = navUserMenu.querySelectorAll('.fluxi-user-menu-item');
  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      setTimeout(() => {
        navUserButton.classList.remove('active');
      }, 100);
    });
  });
}

/**
 * Setup del icono de notificaciones
 */
function setupNotificationIcon() {
  const notifIcon = document.getElementById('navNotificationIcon');

  if (notifIcon) {
    notifIcon.addEventListener('click', (e) => {
      e.stopPropagation();
      // Delegar al notification widget si existe
      const bellElement = document.getElementById('notificationBell');
      if (bellElement) {
        // Simular click en el bell del widget
        bellElement.click();
      } else {
        console.log('[Navbar] Click en notificaciones');
      }
    });
  }
}

/**
 * Actualizar badge de notificaciones
 */
function updateNavbarNotifications(count = 0) {
  const badge = document.getElementById('navNotificationBadge');

  if (badge) {
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  }
}

/**
 * Verificar si hay pagos pendientes y mostrar notificación
 */
function checkAndShowPendingCount() {
  try {
    // Solo mostrar si es admin
    const session = getSessionFromStorage();
    if (session?.user?.role === 'fluxiAdmin') {
      // Aquí puede ir lógica para obtener cuenta de pendientes
      // Por ahora, deja el badge oculto
      updateNavbarNotifications(0);
    }
  } catch (error) {
    console.warn('[Navbar] Error al verificar notificaciones:', error);
  }
}

/**
 * Navegar a Mi Perfil
 */
function navigateToProfile() {
  window.location.href = './myaccount.html';
}

/**
 * Navegar a Configuración
 */
function navigateToSettings() {
  // Puedes redirigir a una página de configuración
  // Por ahora solo mostramos alerta
  showNotification('info', 'Configuración', 'La página de configuración estará disponible pronto');
}

/**
 * 🚪 Logout - Cerrar sesión (DESTRUCTIVA)
 * Usar confirm() simple y funcional
 */
async function logout() {
  console.log('[Navbar] 🚪 Logout iniciado');

  if (confirm('¿Cerrar sesión? Tendrás que iniciar sesión de nuevo.')) {
    try {
      console.log('[Navbar] ✅ Usuario confirmó logout');
      const { clearSession } = await import('./auth/session.js');
      clearSession();
    } catch (err) {
      console.error('[Navbar] ❌ Error en logout:', err);
      localStorage.clear();
      sessionStorage.clear();
      window.location.replace('./login.html');
    }
  }
}

/**
 * Función auxiliar: mostrar notificaciones
 */
function showNotification(type = 'info', title = '', message = '') {
  // Aquí puedes usar tu sistema de notificaciones existente
  // Por ahora solo usa alert
  alert(message || title);
}

/**
 * Actualizar el título de la página en el navbar
 */
function updateNavbarPageTitle(title) {
  const titleEl = document.getElementById('navbarPageTitle');
  if (titleEl) {
    titleEl.textContent = title;
  }
}

/**
 * Sincronizar notificaciones en tiempo real (opcional)
 * Llamar periódicamente o cuando haya cambios
 */
function syncNavbarNotifications() {
  try {
    const session = getSessionFromStorage();

    if (session?.user?.role === 'fluxiAdmin') {
      // Obtener cuenta de pagos pendientes
      // fetch(`${API_BASE}/admin/stats`)
      //   .then(res => res.json())
      //   .then(data => {
      //     updateNavbarNotifications(data.pendingPayments || 0);
      //   })
      //   .catch(err => console.warn('[Navbar] Error sincronizando notificaciones:', err));
    }
  } catch (error) {
    console.warn('[Navbar] Error en sincronización:', error);
  }
}

// Sincronizar notificaciones cada 30 segundos
setInterval(syncNavbarNotifications, 30000);

// Hacer logout accesible globalmente para onclick="logout()"
window.logout = logout;

/**
 * Manejo de "Ver todas las notificaciones"
 * Redirige a la página correcta según el contexto
 */
function handleViewAllNotifications() {
  try {
    const session = getSession();

    // Si es admin, ir al panel admin
    if (session?.user?.role === 'fluxiAdmin') {
      window.location.href = './admin-panel.html';
    } else {
      // Para usuarios normales, mostrar mensaje
      showNotification('info', 'Notificaciones', 'Todas tus notificaciones se muestran aquí arriba');
    }
  } catch (error) {
    console.warn('[Navbar] Error en handleViewAllNotifications:', error);
  }
}
