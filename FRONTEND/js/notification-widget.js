/**
 * NOTIFICATION WIDGET
 * Widget modular de notificaciones estilo Flutter/React
 * 
 * Uso:
 * 1. Importar en cualquier página del dashboard
 * 2. Llamar NotificationWidget.init() al cargar la página
 * 3. El widget aparecerá automáticamente en el topbar
 */

import { getSession } from './auth/session.js';
import { API_CONFIG } from './config/api.config.js';

const API_BASE = API_CONFIG.API_ENDPOINT;

class NotificationWidget {
  constructor() {
    this.notifications = [];
    this.unreadCount = 0;
    this.isOpen = false;
    this.pollingInterval = null;
  }

  /**
   * Inicializar widget
   */
  async init() {
    try {
      const session = getSession();
      if (!session) {
        console.warn('[NotificationWidget] ⚠️ Sin sesión, no inicializando');
        return;
      }

      console.log('[NotificationWidget] 🔔 Inicializando para usuario:', session.user?.email, 'Rol:', session.user?.role);

      // Crear estructura HTML
      this.render();

      // Cargar notificaciones iniciales
      await this.loadNotifications();
      await this.updateUnreadCount();

      // Setup event listeners
      this.setupEventListeners();

      // Iniciar polling cada 30 segundos
      this.startPolling();

      console.log('[NotificationWidget] ✅ Inicializado correctamente para rol:', session.user?.role);

    } catch (error) {
      console.error('[NotificationWidget] ❌ Error inicializando:', error);
    }
  }

  /**
   * Renderizar estructura HTML
   */
  render() {
    // Buscar en navbar unificado primero, luego en topbar antiguo
    let topbarRight = document.querySelector('.fluxi-navbar-right');
    let isUnifiedNavbar = true;

    if (!topbarRight) {
      topbarRight = document.querySelector('.topbar-right');
      isUnifiedNavbar = false;
    }

    if (!topbarRight) return;

    // Crear contenedor del widget
    const widgetHTML = `
      <div class="notification-widget">
        <!-- Dropdown de notificaciones -->
        <div class="notification-dropdown" id="notificationDropdown">
          <!-- Header -->
          <div class="notification-header">
            <h3>Notificaciones</h3>
            <button class="mark-all-read" id="markAllRead" title="Marcar todas como leídas">
              <i class="bx bx-check-double"></i>
            </button>
          </div>

          <!-- Lista de notificaciones -->
          <div class="notification-list" id="notificationList">
            <div class="notification-loading">
              <i class="bx bx-loader-alt bx-spin"></i>
              <span>Cargando notificaciones...</span>
            </div>
          </div>

          <!-- Footer -->
          <div class="notification-footer">
            <button class="notification-footer-link" onclick="handleViewAllNotifications()">
              Ver todas las notificaciones
            </button>
          </div>
        </div>
      </div>
    `;

    // Para navbar unificado: reemplazar el notification-icon existente
    if (isUnifiedNavbar) {
      const notifIcon = topbarRight.querySelector('.fluxi-notification-icon');
      if (notifIcon) {
        notifIcon.id = 'notificationBell';
        notifIcon.insertAdjacentHTML('afterend', widgetHTML);
        return; // No crear bell nuevo, usar el existente
      }
    }

    // Para topbar antiguo: crear bell icon nuevo
    const widgetWithBellHTML = `
      <div class="notification-widget">
        <!-- Bell Icon con Badge -->
        <button class="notification-bell" id="notificationBell">
          <i class="bx bx-bell"></i>
          <span class="notification-badge" id="notificationBadge" style="display: none;">0</span>
        </button>

        <!-- Dropdown de notificaciones -->
        <div class="notification-dropdown" id="notificationDropdown">
          <!-- Header -->
          <div class="notification-header">
            <h3>Notificaciones</h3>
            <button class="mark-all-read" id="markAllRead" title="Marcar todas como leídas">
              <i class="bx bx-check-double"></i>
            </button>
          </div>

          <!-- Lista de notificaciones -->
          <div class="notification-list" id="notificationList">
            <div class="notification-loading">
              <i class="bx bx-loader-alt bx-spin"></i>
              <span>Cargando notificaciones...</span>
            </div>
          </div>

          <!-- Footer -->
          <div class="notification-footer">
            <a href="/notifications.html">Ver todas las notificaciones</a>
          </div>
        </div>
      </div>
    `;

    // Insertar antes del elemento .user
    const userElement = topbarRight.querySelector('.user') || topbarRight.querySelector('.fluxi-user');
    if (userElement) {
      userElement.insertAdjacentHTML('beforebegin', widgetWithBellHTML);
    } else {
      topbarRight.insertAdjacentHTML('beforeend', widgetWithBellHTML);
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    const bell = document.getElementById('notificationBell');
    const markAllBtn = document.getElementById('markAllRead');

    // Toggle dropdown
    bell?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDropdown();
    });

    // Marcar todas como leídas
    markAllBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      await this.markAllAsRead();
    });

    // Cerrar dropdown al hacer click fuera
    document.addEventListener('click', (e) => {
      const dropdown = document.getElementById('notificationDropdown');
      const bell = document.getElementById('notificationBell');

      if (dropdown && !dropdown.contains(e.target) && !bell.contains(e.target)) {
        this.closeDropdown();
      }
    });
  }

  /**
   * Cargar notificaciones
   */
  async loadNotifications() {
    try {
      const session = getSession();
      if (!session) return;

      const response = await fetch(`${API_BASE}/notifications?limit=10`, {
        headers: {
          'Authorization': `Bearer ${session.token}`
        }
      });

      if (!response.ok) throw new Error('Error cargando notificaciones');

      const data = await response.json();
      this.notifications = data.data || [];

      this.renderNotifications();

    } catch (error) {
      console.error('[NotificationWidget] Error cargando notificaciones:', error);
      this.renderError();
    }
  }

  /**
   * Actualizar contador de no leídas
   */
  async updateUnreadCount() {
    try {
      const session = getSession();
      if (!session) return;

      const response = await fetch(`${API_BASE}/notifications/unread-count`, {
        headers: {
          'Authorization': `Bearer ${session.token}`
        }
      });

      if (!response.ok) throw new Error('Error obteniendo contador');

      const data = await response.json();
      this.unreadCount = data.count || 0;

      this.updateBadge();

    } catch (error) {
      console.error('[NotificationWidget] Error obteniendo contador:', error);
    }
  }

  /**
   * Renderizar lista de notificaciones
   */
  renderNotifications() {
    const list = document.getElementById('notificationList');
    if (!list) return;

    if (this.notifications.length === 0) {
      list.innerHTML = `
        <div class="notification-empty">
          <i class="bx bx-bell-off"></i>
          <span>No tienes notificaciones</span>
        </div>
      `;
      return;
    }

    list.innerHTML = this.notifications.map(notif => this.renderNotificationItem(notif)).join('');

    // Setup listeners para cada notificación
    this.notifications.forEach(notif => {
      const item = document.querySelector(`[data-notification-id="${notif.id}"]`);
      if (item) {
        item.addEventListener('click', () => this.handleNotificationClick(notif));
      }
    });
  }

  /**
   * Renderizar item individual
   */
  renderNotificationItem(notif) {
    const priorityClass = `priority-${notif.priority}`;
    const unreadClass = notif.is_read ? '' : 'unread';
    const timeAgo = this.getTimeAgo(notif.created_at);

    return `
      <div class="notification-item ${priorityClass} ${unreadClass}" 
           data-notification-id="${notif.id}">
        <div class="notification-icon ${notif.category}">
          ${this.getIconForCategory(notif.category)}
        </div>
        <div class="notification-content">
          <div class="notification-title">${notif.title}</div>
          <div class="notification-message">${notif.message}</div>
          <div class="notification-time">${timeAgo}</div>
        </div>
        ${!notif.is_read ? '<div class="notification-dot"></div>' : ''}
      </div>
    `;
  }

  /**
   * Manejar click en notificación
   */
  async handleNotificationClick(notif) {
    try {
      // Marcar como leída
      if (!notif.is_read) {
        await this.markAsRead(notif.id);
      }

      // Redirigir si tiene acción
      if (notif.action_url) {
        let url = notif.action_url;

        // Si el URL no empieza con http, procesarlo
        if (!url.startsWith('http')) {
          // Si no empieza con /, agregarlo
          if (!url.startsWith('/')) {
            url = '/' + url;
          }

          // Si no tiene .html, agregarlo (excepto si tiene ?)
          if (!url.includes('.html') && !url.includes('?')) {
            url = url + '.html';
          } else if (!url.includes('.html') && url.includes('?')) {
            // Si tiene parámetros, insertar .html antes del ?
            const [path, query] = url.split('?');
            url = path + '.html?' + query;
          }

          // Agregar /FRONTEND/ al inicio si no está
          if (!url.includes('/FRONTEND/')) {
            url = '/FRONTEND' + url;
          }
        }

        console.log('[NotificationWidget] 🔗 Redirigiendo a:', url);
        window.location.href = url;
      }

      this.closeDropdown();

    } catch (error) {
      console.error('[NotificationWidget] Error manejando click:', error);
    }
  }

  /**
   * Marcar como leída
   */
  async markAsRead(notificationId) {
    try {
      const session = getSession();
      if (!session) return;

      await fetch(`${API_BASE}/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.token}`
        }
      });

      // Actualizar localmente
      const notif = this.notifications.find(n => n.id === notificationId);
      if (notif) {
        notif.is_read = true;
      }

      await this.updateUnreadCount();
      this.renderNotifications();

    } catch (error) {
      console.error('[NotificationWidget] Error marcando como leída:', error);
    }
  }

  /**
   * Marcar todas como leídas
   */
  async markAllAsRead() {
    try {
      const session = getSession();
      if (!session) return;

      await fetch(`${API_BASE}/notifications/read-all`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.token}`
        }
      });

      // Actualizar localmente
      this.notifications.forEach(n => n.is_read = true);

      await this.updateUnreadCount();
      this.renderNotifications();

      console.log('[NotificationWidget] ✅ Todas marcadas como leídas');

    } catch (error) {
      console.error('[NotificationWidget] Error marcando todas:', error);
    }
  }

  /**
   * Actualizar badge
   */
  updateBadge() {
    // Actualizar badge del widget tradicional
    const badge = document.getElementById('notificationBadge');
    if (badge) {
      if (this.unreadCount > 0) {
        badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }

    // Actualizar badge del navbar unificado
    const navBadge = document.getElementById('navNotificationBadge');
    if (navBadge) {
      if (this.unreadCount > 0) {
        navBadge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
        navBadge.style.display = 'block';
      } else {
        navBadge.style.display = 'none';
      }
    }
  }

  /**
   * Toggle dropdown
   */
  toggleDropdown() {
    this.isOpen = !this.isOpen;
    const dropdown = document.getElementById('notificationDropdown');
    const bell = document.getElementById('notificationBell');

    if (dropdown) {
      dropdown.classList.toggle('show', this.isOpen);

      // Posicionar dropdown en relación al bell icon
      if (this.isOpen && bell) {
        this.positionDropdown(bell, dropdown);
      }
    }

    if (this.isOpen) {
      this.loadNotifications();
    }
  }

  /**
   * Posicionar dropdown fixed cerca del bell icon
   */
  positionDropdown(bellElement, dropdownElement) {
    const bellRect = bellElement.getBoundingClientRect();

    // Posicionar a la derecha del bell, alineado arriba
    const dropdownWidth = 380;
    const gap = 10;

    // Calcular posición
    let top = bellRect.top + bellRect.height + gap;
    let right = window.innerWidth - bellRect.right;

    // Ajustar si se sale de la pantalla
    if (right < 10) {
      right = 10; // Margen mínimo desde la derecha
    }

    // Si está muy arriba, mover hacia abajo
    if (top < 60) {
      top = bellRect.bottom + gap;
    }

    // Si está muy abajo, mover hacia arriba
    if (top + 500 > window.innerHeight) {
      top = bellRect.top - 500 - gap;
    }

    dropdownElement.style.top = top + 'px';
    dropdownElement.style.right = right + 'px';
  }

  /**
   * Cerrar dropdown
   */
  closeDropdown() {
    this.isOpen = false;
    const dropdown = document.getElementById('notificationDropdown');
    if (dropdown) {
      dropdown.classList.remove('show');
    }
  }

  /**
   * Iniciar polling
   */
  startPolling() {
    // Actualizar cada 30 segundos
    this.pollingInterval = setInterval(async () => {
      await this.updateUnreadCount();
      
      // Si el dropdown está abierto, recargar notificaciones
      if (this.isOpen) {
        await this.loadNotifications();
      }
    }, 30000);
  }

  /**
   * Detener polling
   */
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Helpers
   */
  getIconForCategory(category) {
    const icons = {
      'kyc': '<i class="bx bx-file"></i>',
      'wallet': '<i class="bx bx-wallet"></i>',
      'security': '<i class="bx bx-shield"></i>',
      'system': '<i class="bx bx-info-circle"></i>'
    };
    return icons[category] || '<i class="bx bx-bell"></i>';
  }

  getTimeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = Math.floor((now - time) / 1000); // segundos

    if (diff < 60) return 'Ahora';
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
    if (diff < 604800) return `Hace ${Math.floor(diff / 86400)} d`;
    
    return time.toLocaleDateString();
  }

  renderError() {
    const list = document.getElementById('notificationList');
    if (!list) return;

    list.innerHTML = `
      <div class="notification-error">
        <i class="bx bx-error"></i>
        <span>Error cargando notificaciones</span>
      </div>
    `;
  }
}

// Crear instancia global
const notificationWidget = new NotificationWidget();

// Auto-inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    notificationWidget.init();
  });
} else {
  notificationWidget.init();
}

// Exportar para uso manual
export default notificationWidget;
