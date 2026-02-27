/**
 * SIDEBAR BADGE - Sistema de notificación visual para pagos pendientes
 * 
 * INSTALACIÓN:
 * 1. Copiar este archivo a: FRONTEND/DASHBOARD/js/components/sidebar-badge.js
 * 2. Importar en sidebar.js: import './components/sidebar-badge.js';
 */

import { getSession } from './auth/session.js';
import { API_CONFIG } from './config/api.config.js';

const API_BASE = API_CONFIG.API_ENDPOINT;

class SidebarBadge {
  constructor() {
    this.pendingCount = 0;
    this.pollingInterval = null;
    this.initialized = false;
  }

  /**
   * Inicializar badge automáticamente
   */
  async init() {
    try {
      const session = getSession();
      if (!session) return;

      // Solo para admins
      if (session.user.role !== 'fluxiAdmin') return;

      console.log('[SidebarBadge] ✅ Inicializando para admin...');

      // Esperar a que el sidebar se cargue
      await this.waitForSidebar();

      // Crear badge
      this.createBadge();

      // Actualizar contador inicial
      await this.updatePendingCount();

      // Iniciar polling cada 15 segundos
      this.startPolling();

      this.initialized = true;
      console.log('[SidebarBadge] ✅ Inicializado correctamente');

    } catch (error) {
      console.error('[SidebarBadge] ❌ Error inicializando:', error);
    }
  }

  /**
   * Esperar a que el sidebar se cargue
   */
  async waitForSidebar() {
    return new Promise((resolve) => {
      const checkSidebar = () => {
        const adminPanelLink = document.querySelector('a[href="./admin-panel.html"]');
        if (adminPanelLink) {
          resolve();
        } else {
          setTimeout(checkSidebar, 100);
        }
      };
      checkSidebar();
    });
  }

  /**
   * Crear badge en el botón de Admin Panel
   */
  createBadge() {
    const adminPanelLink = document.querySelector('a[href="./admin-panel.html"]');
    if (!adminPanelLink) {
      console.warn('[SidebarBadge] No se encontró el botón de Admin Panel');
      return;
    }

    // Evitar crear múltiples badges
    if (adminPanelLink.querySelector('.sidebar-badge')) {
      return;
    }

    // Crear badge
    const badge = document.createElement('span');
    badge.className = 'sidebar-badge';
    badge.id = 'adminPanelBadge';
    badge.style.display = 'none';

    // Agregar al link
    adminPanelLink.style.position = 'relative';
    adminPanelLink.appendChild(badge);

    // Agregar estilos CSS si no existen
    this.injectStyles();

    console.log('[SidebarBadge] ✅ Badge creado');
  }

  /**
   * Inyectar estilos CSS
   */
  injectStyles() {
    if (document.getElementById('sidebar-badge-styles')) return;

    const style = document.createElement('style');
    style.id = 'sidebar-badge-styles';
    style.textContent = `
      .sidebar-badge {
        position: absolute;
        top: 8px;
        right: 12px;
        min-width: 20px;
        height: 20px;
        background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
        color: #1f2937;
        font-size: 11px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(251, 191, 36, 0.4);
        animation: sidebar-badge-pulse 2s infinite;
        z-index: 10;
      }

      @keyframes sidebar-badge-pulse {
        0%, 100% {
          transform: scale(1);
          box-shadow: 0 2px 8px rgba(251, 191, 36, 0.4);
        }
        50% {
          transform: scale(1.1);
          box-shadow: 0 4px 12px rgba(251, 191, 36, 0.6);
        }
      }

      /* Cuando el sidebar está colapsado */
      .sidebar.collapsed .sidebar-badge {
        top: 4px;
        right: 4px;
        min-width: 16px;
        height: 16px;
        font-size: 9px;
        padding: 2px 4px;
      }

      /* Glow effect en hover */
      .sidebar-link:hover .sidebar-badge {
        box-shadow: 0 4px 16px rgba(251, 191, 36, 0.8);
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Actualizar contador de pagos pendientes
   */
  async updatePendingCount() {
    try {
      const session = getSession();
      if (!session || session.user.role !== 'fluxiAdmin') return;

      const response = await fetch(`${API_BASE}/payment-requests/pending-count`, {
        headers: {
          'Authorization': `Bearer ${session.token}`
        }
      });

      if (!response.ok) {
        console.error('[SidebarBadge] Error obteniendo contador');
        return;
      }

      const data = await response.json();
      this.pendingCount = data.count || 0;

      this.updateBadgeDisplay();

    } catch (error) {
      console.error('[SidebarBadge] Error actualizando contador:', error);
    }
  }

  /**
   * Actualizar visualización del badge
   */
  updateBadgeDisplay() {
    const badge = document.getElementById('adminPanelBadge');
    if (!badge) return;

    if (this.pendingCount > 0) {
      badge.textContent = this.pendingCount > 99 ? '99+' : this.pendingCount;
      badge.style.display = 'flex';
      
      console.log(`[SidebarBadge] 🔔 ${this.pendingCount} pago(s) pendiente(s)`);
    } else {
      badge.style.display = 'none';
    }
  }

  /**
   * Iniciar polling automático
   */
  startPolling() {
    // Actualizar cada 15 segundos
    this.pollingInterval = setInterval(() => {
      this.updatePendingCount();
    }, 15000);
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
   * Forzar actualización (llamar después de aprobar/rechazar)
   */
  async refresh() {
    await this.updatePendingCount();
  }
}

// Crear instancia global
const sidebarBadge = new SidebarBadge();

// Auto-inicializar cuando el sidebar esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Esperar a que el sidebar se cargue
    setTimeout(() => {
      sidebarBadge.init();
    }, 500);
  });
} else {
  setTimeout(() => {
    sidebarBadge.init();
  }, 500);
}

// Escuchar evento personalizado de recarga del sidebar
document.addEventListener('sidebar:loaded', () => {
  if (!sidebarBadge.initialized) {
    sidebarBadge.init();
  }
});

// Exportar para uso manual
export default sidebarBadge;
