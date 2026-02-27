/**
 * ENROLLED RECIPIENTS - GESTIÓN SIMPLIFICADA
 * Toda la lógica de envío está en send.html
 */

import { getSession } from '../auth/session.js';
import { guardPage, startSessionMonitor } from '../auth/session-guard.js';
import { API_CONFIG } from '../config/api.config.js';

const API_BASE = API_CONFIG.API_ENDPOINT;

let enrolledRecipients = [];
let currentEditId = null;
let currentViewWalletsId = null;

// ===================================
// INICIALIZACIÓN
// ===================================
document.addEventListener('DOMContentLoaded', async () => {
  // 🛡️ Proteger página contra sesiones inválidas
  if (!guardPage()) {
    return;
  }

  // 👁️ Iniciar monitor de sesión
  startSessionMonitor();

  const session = getSession();

  console.log('[Enrolled] ✅ Usuario autenticado:', session.user.email);

  // Pintar username
  paintUsername(session.user);

  // Cargar destinatarios
  await loadEnrolledRecipients();

  // Setup event listeners
  setupEventListeners();

  // Ajustar layout
  adjustLayoutForSidebar();
});

// ===================================
// PINTAR USERNAME
// ===================================
function paintUsername(user) {
  const username = user.username || user.email || 'Usuario';
  document.querySelectorAll('[data-user-name]').forEach(el => {
    el.textContent = username;
  });
}

// ===================================
// CARGAR DESTINATARIOS
// ===================================
async function loadEnrolledRecipients() {
  try {
    const session = getSession();

    const response = await fetch(`${API_BASE}/enrolled`, {
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Error cargando destinatarios');
    }

    const data = await response.json();
    enrolledRecipients = data.data;

    console.log('[Enrolled] Destinatarios cargados:', enrolledRecipients.length);

    paintEnrolledTable(enrolledRecipients);

  } catch (error) {
    console.error('[Enrolled] Error cargando destinatarios:', error);
    showError('Error cargando destinatarios');
  }
}

// ===================================
// PINTAR TABLA
// ===================================
function paintEnrolledTable(recipients) {
  const tbody = document.getElementById('enrolledTableBody');
  const countBadge = document.getElementById('countBadge');

  const activeCount = recipients.filter(r => r.isActive).length;
  countBadge.textContent = `${activeCount} activo${activeCount !== 1 ? 's' : ''} de ${recipients.length}`;

  if (recipients.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px;">
          <i class="bx bx-user-plus" style="font-size: 48px; color: #cbd5e1; display: block; margin-bottom: 12px;"></i>
          <p style="color: #64748b;">No tienes destinatarios inscritos</p>
          <button class="btn-primary" style="margin-top: 16px;" onclick="document.getElementById('btnNewEnrolled').click()">
            <i class="bx bx-plus"></i>
            Inscribir primer destinatario
          </button>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = recipients.map(r => `
    <tr data-recipient-id="${r.id}" ${!r.isActive ? 'style="opacity: 0.5;"' : ''}>
      <td>
        <div class="recipient-cell">
          <div class="recipient-avatar">
            ${getInitials(r.alias)}
          </div>
          <div>
            <strong>${r.alias}</strong>
            <small>${r.isActive ? 'Activo' : '⚠️ Inactivo'}</small>
          </div>
        </div>
      </td>
      <td>${r.recipientEmail}</td>
      <td>${r.recipientUsername || 'N/A'}</td>
      <td>
        ${r.isActive ? `
          <button class="btn-link" onclick="viewWallets('${r.id}')">
            <i class="bx bx-wallet"></i>
            Ver wallets
          </button>
        ` : `
          <span style="color: #94a3b8; font-size: 13px;">No disponible</span>
        `}
      </td>
      <td>${formatDate(r.createdAt)}</td>
      <td>
        <div class="action-buttons">
          ${r.isActive ? `
            <button class="btn-action btn-send" onclick="sendMoney('${r.id}')" title="Enviar dinero">
              <i class="bx bx-send"></i>
            </button>
            <button class="btn-action btn-edit" onclick="editAlias('${r.id}')" title="Editar alias">
              <i class="bx bx-edit"></i>
            </button>
            <button class="btn-action btn-delete" onclick="deleteRecipient('${r.id}')" title="Desactivar">
              <i class="bx bx-trash"></i>
            </button>
          ` : `
            <button class="btn-action" style="background: #22c55e;" onclick="reactivateRecipient('${r.id}')" title="Reactivar">
              <i class="bx bx-refresh"></i>
            </button>
          `}
        </div>
      </td>
    </tr>
  `).join('');
}

// ===================================
// ENVIAR DINERO - REDIRIGE A SEND.HTML
// ===================================
window.sendMoney = function(enrolledId) {
  console.log('[Enrolled] Redirigiendo a send.html con destinatario:', enrolledId);
  window.location.href = `./send.html?recipient=${enrolledId}`;
};

// ===================================
// VER WALLETS DEL DESTINATARIO
// ===================================
window.viewWallets = async function(enrolledId) {
  try {
    currentViewWalletsId = enrolledId;
    const recipient = enrolledRecipients.find(r => r.id === enrolledId);

    if (!recipient) {
      showError('Destinatario no encontrado');
      return;
    }

    // Abrir modal
    document.getElementById('walletsModal').classList.remove('hidden');

    // Llenar datos del destinatario
    document.getElementById('walletsRecipientInitials').textContent = getInitials(recipient.alias);
    document.getElementById('walletsRecipientAlias').textContent = recipient.alias;
    document.getElementById('walletsRecipientEmail').textContent = recipient.recipientEmail;

    // Cargar wallets
    const session = getSession();

    const response = await fetch(`${API_BASE}/enrolled/${enrolledId}`, {
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Error cargando wallets');
    }

    const data = await response.json();
    const wallets = data.data.wallets || [];

    // Pintar wallets (SIN MOSTRAR BALANCE)
    const walletsList = document.getElementById('walletsList');

    if (wallets.length === 0) {
      walletsList.innerHTML = `
        <p style="text-align: center; color: #64748b; padding: 20px;">
          Este destinatario no tiene wallets disponibles
        </p>
      `;
      return;
    }

    walletsList.innerHTML = wallets.map(w => `
      <div class="wallet-item">
        <div class="wallet-icon">
          <i class="bx bx-wallet"></i>
        </div>
        <div class="wallet-info">
          <strong>${w.symbol}</strong>
          <span>${w.name}</span>
        </div>
        <div class="wallet-status">
          <span class="status-badge ${w.isActive ? 'active' : 'inactive'}">
            ${w.isActive ? 'Disponible' : 'Inactiva'}
          </span>
        </div>
      </div>
    `).join('');

  } catch (error) {
    console.error('[Enrolled] Error cargando wallets:', error);
    showError('Error cargando wallets del destinatario');
  }
};

// ===================================
// EDITAR ALIAS
// ===================================
window.editAlias = function(enrolledId) {
  currentEditId = enrolledId;
  const recipient = enrolledRecipients.find(r => r.id === enrolledId);

  if (!recipient) {
    showError('Destinatario no encontrado');
    return;
  }

  document.getElementById('editAlias').value = recipient.alias;
  document.getElementById('editModal').classList.remove('hidden');
};

// ===================================
// CONFIRMAR EDICIÓN
// ===================================
async function confirmEdit() {
  try {
    const newAlias = document.getElementById('editAlias').value.trim();

    if (!newAlias) {
      showError('El alias es obligatorio');
      return;
    }

    const session = getSession();

    const response = await fetch(`${API_BASE}/enrolled/${currentEditId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ alias: newAlias })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Error actualizando alias');
    }

    console.log('[Enrolled] Alias actualizado correctamente');

    // Cerrar modal
    document.getElementById('editModal').classList.add('hidden');

    // Recargar lista
    await loadEnrolledRecipients();

    showSuccess('Alias actualizado correctamente');

  } catch (error) {
    console.error('[Enrolled] Error actualizando alias:', error);
    showError(error.message);
  }
}

// ===================================
// ELIMINAR DESTINATARIO
// ===================================
window.deleteRecipient = async function(enrolledId) {
  const recipient = enrolledRecipients.find(r => r.id === enrolledId);

  if (!recipient) {
    showError('Destinatario no encontrado');
    return;
  }

  if (!confirm(`¿Estás seguro de eliminar a ${recipient.alias}?`)) {
    return;
  }

  try {
    const session = getSession();

    const response = await fetch(`${API_BASE}/enrolled/${enrolledId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Error eliminando destinatario');
    }

    console.log('[Enrolled] Destinatario eliminado correctamente');

    // Recargar lista
    await loadEnrolledRecipients();

    showSuccess('Destinatario eliminado correctamente');

  } catch (error) {
    console.error('[Enrolled] Error eliminando destinatario:', error);
    showError(error.message);
  }
};

// ===================================
// INSCRIBIR NUEVO DESTINATARIO
// ===================================
let validateTimeout = null;

async function validateRecipientEmail() {
  const email = document.getElementById('recipientEmail').value.trim();
  const validation = document.getElementById('emailValidation');
  const preview = document.getElementById('userPreview');

  if (!email) {
    validation.textContent = '';
    validation.className = 'validation-message';
    preview.classList.add('hidden');
    return;
  }

  // Debounce
  clearTimeout(validateTimeout);
  validateTimeout = setTimeout(async () => {
    try {
      validation.textContent = 'Validando...';
      validation.className = 'validation-message info';

      const session = getSession();

      const response = await fetch(`${API_BASE}/enrolled/validate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (data.exists) {
        validation.textContent = '✓ Usuario encontrado';
        validation.className = 'validation-message success';

        document.getElementById('previewUsername').textContent = data.user.username || 'Sin nombre';
        document.getElementById('previewEmail').textContent = data.user.email;
        preview.classList.remove('hidden');
      } else {
        validation.textContent = '✗ Usuario no registrado en la plataforma';
        validation.className = 'validation-message error';
        preview.classList.add('hidden');
      }

    } catch (error) {
      validation.textContent = '✗ Error validando email';
      validation.className = 'validation-message error';
      preview.classList.add('hidden');
    }
  }, 500);
}

async function confirmEnroll() {
  try {
    const email = document.getElementById('recipientEmail').value.trim();
    const alias = document.getElementById('recipientAlias').value.trim();

    if (!email || !alias) {
      showError('Email y alias son obligatorios');
      return;
    }

    const session = getSession();

    const response = await fetch(`${API_BASE}/enrolled`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipientEmail: email,
        alias: alias
      })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Error inscribiendo destinatario');
    }

    const data = await response.json();

    console.log('[Enrolled] Destinatario inscrito/reactivado correctamente');

    // Cerrar modal
    document.getElementById('enrollModal').classList.add('hidden');

    // Limpiar form
    document.getElementById('recipientEmail').value = '';
    document.getElementById('recipientAlias').value = '';
    document.getElementById('emailValidation').textContent = '';
    document.getElementById('userPreview').classList.add('hidden');

    // Recargar lista
    await loadEnrolledRecipients();

    // Mensaje personalizado
    if (data.data.reactivated) {
      showSuccess('Destinatario reactivado correctamente');
    } else {
      showSuccess('Destinatario inscrito correctamente');
    }

  } catch (error) {
    console.error('[Enrolled] Error inscribiendo destinatario:', error);
    showError(error.message);
  }
}


// ===================================
// EVENT LISTENERS
// ===================================
function setupEventListeners() {
  // Botón nuevo inscrito
  document.getElementById('btnNewEnrolled')?.addEventListener('click', () => {
    document.getElementById('enrollModal').classList.remove('hidden');
  });

  // Cerrar modales
  document.getElementById('closeEnrollModal')?.addEventListener('click', () => {
    document.getElementById('enrollModal').classList.add('hidden');
  });

  document.getElementById('cancelEnroll')?.addEventListener('click', () => {
    document.getElementById('enrollModal').classList.add('hidden');
  });

  document.getElementById('closeEditModal')?.addEventListener('click', () => {
    document.getElementById('editModal').classList.add('hidden');
  });

  document.getElementById('cancelEdit')?.addEventListener('click', () => {
    document.getElementById('editModal').classList.add('hidden');
  });

  document.getElementById('closeWalletsModal')?.addEventListener('click', () => {
    document.getElementById('walletsModal').classList.add('hidden');
  });

  document.getElementById('closeWallets')?.addEventListener('click', () => {
    document.getElementById('walletsModal').classList.add('hidden');
  });

  // Validar email
  document.getElementById('recipientEmail')?.addEventListener('input', validateRecipientEmail);

  // Confirmar inscripción
  document.getElementById('confirmEnroll')?.addEventListener('click', confirmEnroll);

  // Confirmar edición
  document.getElementById('confirmEdit')?.addEventListener('click', confirmEdit);

  // Botón enviar desde modal wallets
  document.getElementById('sendFromWallets')?.addEventListener('click', () => {
    if (currentViewWalletsId) {
      sendMoney(currentViewWalletsId);
    }
  });

  // Búsqueda
  document.getElementById('searchInput')?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    if (term === '') {
      paintEnrolledTable(enrolledRecipients);
      return;
    }

    const filtered = enrolledRecipients.filter(r =>
      r.alias.toLowerCase().includes(term) ||
      r.recipientEmail.toLowerCase().includes(term) ||
      (r.recipientUsername || '').toLowerCase().includes(term)
    );

    paintEnrolledTable(filtered);
  });
}

// ===================================
// UTILIDADES
// ===================================
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function showError(message) {
  console.error('[Enrolled]', message);
  alert(message);
}

function showSuccess(message) {
  console.log('[Enrolled]', message);
  alert(message);
}

function adjustLayoutForSidebar() {
  const mainContent = document.querySelector('.main-content');
  const sidebarContainer = document.getElementById('sidebar-container');

  if (!mainContent) return;

  const updateLayout = () => {
    const sidebar = sidebarContainer?.querySelector('.sidebar');
    if (!sidebar) {
      mainContent.classList.remove('has-sidebar', 'has-sidebar-collapsed');
      return;
    }

    if (sidebar.classList.contains('collapsed')) {
      mainContent.classList.remove('has-sidebar');
      mainContent.classList.add('has-sidebar-collapsed');
    } else {
      mainContent.classList.remove('has-sidebar-collapsed');
      mainContent.classList.add('has-sidebar');
    }
  };

  document.addEventListener('sidebar:loaded', updateLayout);

  if (sidebarContainer) {
    const observer = new MutationObserver(updateLayout);
    observer.observe(sidebarContainer, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  setTimeout(updateLayout, 100);
}



// ===================================
// REACTIVAR DESTINATARIO
// ===================================
// ===================================
// REACTIVAR DESTINATARIO
// ===================================
window.reactivateRecipient = async function(enrolledId) {
  const recipient = enrolledRecipients.find(r => r.id === enrolledId);

  if (!recipient) {
    showError('Destinatario no encontrado');
    return;
  }

  if (!confirm(`¿Reactivar a ${recipient.alias}?`)) {
    return;
  }

  try {
    console.log('[Enrolled] 🔄 Reactivando destinatario:', enrolledId);

    const session = getSession();

    const response = await fetch(`${API_BASE}/enrolled/${enrolledId}/reactivate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Error reactivando destinatario');
    }

    console.log('[Enrolled] ✅ Destinatario reactivado correctamente');

    // Recargar lista
    await loadEnrolledRecipients();

    showSuccess('Destinatario reactivado correctamente');

  } catch (error) {
    console.error('[Enrolled] Error reactivando:', error);
    showError(error.message || 'Error reactivando destinatario');
  }
};