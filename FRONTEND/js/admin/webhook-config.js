/**
 * WEBHOOK CONFIGURATION MODULE
 * Maneja la configuración de webhooks de Vita Wallet desde el admin panel
 */

import { getSession } from '../auth/session.js';

const API_BASE = 'http://localhost:3000/api';

// ============================================
// CARGAR CONFIGURACIÓN ACTUAL
// ============================================
export async function loadWebhookConfig() {
  try {
    const token = localStorage.getItem('auth_token');

    if (!token) {
      console.warn('[WebhookConfig] No hay token de autenticación');
      return null;
    }

    console.log('[WebhookConfig] Cargando configuración actual...');

    const response = await fetch(`${API_BASE}/webhooks/vitawallet/config`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 5000, // 5 segundos timeout
    });

    if (!response.ok) {
      if (response.status === 403) {
        console.warn('[WebhookConfig] Solo admins pueden ver configuración');
        return null;
      }
      if (response.status === 400 || response.status === 404) {
        console.warn('[WebhookConfig] Endpoint no disponible o no configurado aún');
        // Mostrar form vacío (primera vez)
        displayCurrentConfig({ webhook_url: null, configured_categories: [] });
        return null;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('[WebhookConfig] ✅ Configuración cargada:', data);

    // Mostrar configuración actual
    if (data.success) {
      displayCurrentConfig(data);
      return data;
    }

  } catch (error) {
    console.error('[WebhookConfig] ⚠️ Error cargando configuración (no crítico):', error.message);
    // No mostrar error al usuario si es la primera vez
    // Solo log en consola para debugging
  }
}

// ============================================
// GUARDAR CONFIGURACIÓN
// ============================================
export async function saveWebhookConfig() {
  try {
    const token = localStorage.getItem('auth_token');
    const webhookUrl = document.getElementById('webhookUrlInput')?.value?.trim();

    // Validar URL
    if (!webhookUrl) {
      showError('❌ Ingresa una URL de webhook válida');
      return;
    }

    if (!webhookUrl.startsWith('https://')) {
      showError('❌ La URL debe comenzar con HTTPS (requerido para producción)');
      return;
    }

    // Validar que sea URL válida
    try {
      new URL(webhookUrl);
    } catch {
      showError('❌ La URL no es válida. Ej: https://tu-ngrok-url.ngrok.io/api/webhooks/vitawallet');
      return;
    }

    // Obtener categorías seleccionadas
    const checkboxes = document.querySelectorAll('.webhook-category-checkbox:checked');
    const categories = Array.from(checkboxes).map(cb => cb.value);

    if (categories.length === 0) {
      showError('❌ Selecciona al menos una categoría');
      return;
    }

    console.log('[WebhookConfig] Guardando configuración...');
    console.log('  URL:', webhookUrl);
    console.log('  Categorías:', categories);

    // Mostrar loading
    const btn = document.getElementById('webhookSaveBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Guardando...';

    // Hacer request
    const response = await fetch(`${API_BASE}/webhooks/vitawallet/configure`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        webhook_url: webhookUrl,
        categories: categories,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    if (!data.success) {
      throw new Error(data.error || 'Error desconocido');
    }

    console.log('[WebhookConfig] ✅ Configuración guardada:', data);

    // Mostrar éxito
    showSuccess(
      '✅ Webhook configurado exitosamente',
      `Tu URL: ${webhookUrl}\nVita Wallet ahora enviará notificaciones a esta dirección.`
    );

    // Recargar configuración
    setTimeout(() => loadWebhookConfig(), 1000);

  } catch (error) {
    console.error('[WebhookConfig] ❌ Error guardando:', error);
    showError(`❌ Error: ${error.message}`);
  } finally {
    const btn = document.getElementById('webhookSaveBtn');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="bx bx-save"></i> Guardar Configuración';
    }
  }
}

// ============================================
// MOSTRAR CONFIGURACIÓN ACTUAL
// ============================================
function displayCurrentConfig(data) {
  const statusDiv = document.getElementById('webhookConfigStatus');
  const urlElement = document.getElementById('currentWebhookUrl');
  const categoriesElement = document.getElementById('currentWebhookCategories');

  if (data.webhook_url) {
    statusDiv.style.display = 'block';
    urlElement.textContent = data.webhook_url;
    categoriesElement.textContent = (data.configured_categories || []).join(', ') || 'Ninguna';

    // Actualizar input
    document.getElementById('webhookUrlInput').value = data.webhook_url;

    // Actualizar checkboxes
    document.querySelectorAll('.webhook-category-checkbox').forEach(cb => {
      cb.checked = (data.configured_categories || []).includes(cb.value);
    });
  } else {
    statusDiv.style.display = 'none';
  }
}

// ============================================
// MOSTRAR MENSAJES
// ============================================
function showSuccess(title, message) {
  // Usar modal existente o alert simple
  const modal = document.getElementById('successModal');
  if (modal) {
    document.getElementById('successTitle').textContent = title;
    document.getElementById('successMessage').textContent = message;
    modal.style.display = 'flex';
    setTimeout(() => {
      modal.style.display = 'none';
    }, 4000);
  } else {
    alert(title + '\n' + message);
  }
}

function showError(message, isModal = true) {
  // Solo mostrar error si es crítico (ej: al guardar)
  // No mostrar en carga inicial
  if (!isModal) {
    console.warn('[WebhookConfig] Error (silencioso):', message);
    return;
  }

  const modal = document.getElementById('errorModal');
  if (modal) {
    document.getElementById('errorMessage').textContent = message;
    modal.style.display = 'flex';
  } else {
    console.error('[WebhookConfig] Error:', message);
  }
}

// ============================================
// EXPORTAR COMO GLOBALES PARA ONCLICK
// ============================================
window.loadWebhookConfig = loadWebhookConfig;
window.saveWebhookConfig = saveWebhookConfig;

// ============================================
// CARGAR SOLO CUANDO SE ABRE TAB SISTEMA
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  // Cargar SOLO cuando se abre tab Sistema (no automáticamente)
  const systemTab = document.querySelector('[data-tab="system"]');
  if (systemTab) {
    systemTab.addEventListener('click', () => {
      console.log('[WebhookConfig] Abriendo tab SISTEMA, cargando configuración...');
      setTimeout(loadWebhookConfig, 100);
    });
  }

  // También cargar si se hace click en el contenido del tab directamente
  const systemTabContent = document.getElementById('tab-system');
  if (systemTabContent) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.target.style.display !== 'none' && !window.webhookConfigLoaded) {
          console.log('[WebhookConfig] Tab SISTEMA visible, cargando configuración...');
          loadWebhookConfig();
          window.webhookConfigLoaded = true;
        }
      });
    });
    observer.observe(systemTabContent, { attributes: true, attributeFilter: ['style'] });
  }
});
