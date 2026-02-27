/**
 * ADMIN PANEL - CONTROL TOTAL DE LA PLATAFORMA
 * Solo accesible para fluxiAdmin
 */

import { getSession } from '../auth/session.js';
import { guardPage, startSessionMonitor } from '../auth/session-guard.js';
import { API_CONFIG } from '../config/api.config.js';
import sidebarBadge from '../sidebar-badge.js';

const API_BASE = API_CONFIG.API_ENDPOINT;

// Estado global
let allUsers = [];
let allTransactions = [];
let currentTab = 'users';
let allPaymentRequests = [];
let currentPaymentId = null;
// ===================================
// INICIALIZACIÓN
// ===================================
document.addEventListener('DOMContentLoaded', async () => {
  // 🛡️ Proteger página contra sesiones inválidas
  if (!guardPage()) {
    return;
  }

  const session = getSession();

  // 🔒 VERIFICAR QUE SEA ADMIN
  if (session.user.role !== 'fluxiAdmin') {
    console.error('[AdminPanel] ❌ Acceso denegado. Solo para administradores.');
    alert('Acceso denegado. Esta área es solo para administradores.');
    window.location.href = './dashboard.html';
    return;
  }

  // 👁️ Iniciar monitor de sesión
  startSessionMonitor();

  console.log('[AdminPanel] ✅ Admin verificado:', session.user.email);

  // Pintar nombre de usuario
  paintUsername(session.user);

  // Cargar datos iniciales
  await loadDashboardData();

  // Setup event listeners
  setupEventListeners();
  adjustLayoutForSidebar();
});


// Nueva función para ajustar layout
function adjustLayoutForSidebar() {
  const mainContent = document.querySelector('.admin-main-content');
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

  // Actualizar cuando el sidebar se cargue
  document.addEventListener('sidebar:loaded', updateLayout);

  // Observar cambios en el sidebar
  if (sidebarContainer) {
    const observer = new MutationObserver(updateLayout);
    observer.observe(sidebarContainer, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  // Actualizar inmediatamente
  setTimeout(updateLayout, 100);
}

// ===================================
// PINTAR NOMBRE DE USUARIO
// ===================================
function paintUsername(user) {
  const profile = user.profile || user.user || user;

  const username =
    [profile.first_name, profile.last_name]
      .filter(v => typeof v === 'string' && v.trim() !== '')
      .join(' ')
      .trim()
    || user.username
    || user.email
    || 'Administrador';

  document.querySelectorAll('[data-user-name]').forEach(el => {
    el.textContent = username;
  });
}

// ===================================
// CARGAR DATOS DEL DASHBOARD
// ===================================
async function loadDashboardData() {
  try {
    console.log('[AdminPanel] 📊 Cargando estadísticas...');

    const session = getSession();

    // Cargar estadísticas globales
    const statsResponse = await fetch(`${API_BASE}/admin/stats`, {
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!statsResponse.ok) {
      throw new Error('Error cargando estadísticas');
    }

    const statsData = await statsResponse.json();
    console.log('[AdminPanel] Stats:', statsData.data);

    // Actualizar cards de estadísticas
    updateStatsCards(statsData.data);

    // Cargar usuarios
    await loadUsers();

    // Cargar comisiones
    await loadCommissions();

  } catch (error) {
    console.error('[AdminPanel] Error cargando datos:', error);
    showError('Error cargando datos del panel');
  }

  // Cargar solicitudes de pago
await loadPaymentRequests();
}

// ===================================
// ACTUALIZAR CARDS DE ESTADÍSTICAS
// ===================================
function updateStatsCards(stats) {
  // Total usuarios
  document.getElementById('totalUsers').textContent = stats.users.total.toLocaleString();

  // Total wallets
  document.getElementById('totalWallets').textContent = stats.wallets.total.toLocaleString();

  // Total transacciones
  document.getElementById('totalTransactions').textContent = stats.transactions.total.toLocaleString();

  // Comisiones (buscar USD)
  const usdVolume = stats.volume.find(v => v.currency === 'USD');
  const commissionsUSD = 0; // Por ahora, se actualizará con la API de comisiones
  document.getElementById('totalCommissions').textContent = `$${commissionsUSD.toLocaleString()}`;
}

// ===================================
// CARGAR USUARIOS
// ===================================
async function loadUsers(filters = {}) {
  try {
    const session = getSession();
    
    // Construir query string
    const queryParams = new URLSearchParams();
    if (filters.role) queryParams.append('role', filters.role);
    if (filters.kycStatus) queryParams.append('kycStatus', filters.kycStatus);
    if (filters.status) queryParams.append('status', filters.status);
    if (filters.search) queryParams.append('search', filters.search);

    const url = `${API_BASE}/admin/users${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Error cargando usuarios');
    }

    const data = await response.json();
    allUsers = data.data;

    console.log('[AdminPanel] Usuarios cargados:', allUsers.length);

    paintUsersTable(allUsers);

  } catch (error) {
    console.error('[AdminPanel] Error cargando usuarios:', error);
    showError('Error cargando usuarios');
  }
}

// ===================================
// PINTAR TABLA DE USUARIOS
// ===================================
function paintUsersTable(users) {
  const tbody = document.getElementById('usersTableBody');

  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px;">
          <i class="bx bx-user-x" style="font-size: 48px; color: #cbd5e1; display: block; margin-bottom: 12px;"></i>
          <p style="color: #64748b;">No se encontraron usuarios</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = users.map(user => `
    <tr>
      <td>
        <div class="admin-user-info">
          <span class="admin-user-name">${user.username || 'Sin nombre'}</span>
          <span class="admin-user-email">${user.email}</span>
        </div>
      </td>
      <td>
        <span class="admin-badge-pill admin-role-${getRoleClass(user.role)}">
          ${getRoleLabel(user.role)}
        </span>
      </td>
      <td>
        <span class="admin-badge-pill admin-kyc-${user.kyc_status || 'pending'}">
          ${getKYCLabel(user.kyc_status)}
        </span>
      </td>
      <td>
        <span class="admin-badge-pill admin-status-${user.status || 'active'}">
          ${getStatusLabel(user.status)}
        </span>
      </td>
      <td>
        <div class="admin-wallets-list">
          ${user.wallets.map(w => `
            <span class="admin-wallet-pill ${w.isActive ? 'active' : 'inactive'}">
              ${w.symbol}
              <i class="bx ${w.isActive ? 'bx-check-circle' : 'bx-x-circle'}"></i>
            </span>
          `).join('')}
        </div>
      </td>
      <td>${formatDate(user.created_at)}</td>
      <td>
        <div class="admin-action-buttons">
          <button class="admin-btn-action admin-btn-view" onclick="viewUserDetails('${user.id}')">
            <i class="bx bx-show"></i>
            Ver
          </button>
          ${user.status === 'active' ? `
            <button class="admin-btn-action admin-btn-block" onclick="toggleUserStatus('${user.id}', 'blocked')">
              <i class="bx bx-block"></i>
              Bloquear
            </button>
          ` : `
            <button class="admin-btn-action admin-btn-activate" onclick="toggleUserStatus('${user.id}', 'active')">
              <i class="bx bx-check-circle"></i>
              Activar
            </button>
          `}
        </div>
      </td>
    </tr>
  `).join('');
}

// ===================================
// VER DETALLES DE USUARIO
// ===================================
window.viewUserDetails = async function(userId) {
  try {
    const session = getSession();

    const response = await fetch(`${API_BASE}/admin/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Error obteniendo detalles');
    }

    const data = await response.json();
    const details = data.data;

    console.log('[AdminPanel] Detalles del usuario:', details);

    // Mostrar modal con detalles
    showUserDetailsModal(details);

  } catch (error) {
    console.error('[AdminPanel] Error obteniendo detalles:', error);
    alert('Error obteniendo detalles del usuario');
  }
};

// ===================================
// MOSTRAR MODAL DE DETALLES
// ===================================
function showUserDetailsModal(details) {
  const modal = document.getElementById('userDetailModal');
  const content = document.getElementById('userDetailContent');

  content.setAttribute('data-user-id', details.user.id);
  content.innerHTML = `
    <!-- Información del Usuario -->
    <div class="admin-detail-section">
      <h4>
        <i class="bx bx-user"></i>
        Información del Usuario
      </h4>
      <div class="admin-detail-grid">
        <div class="admin-detail-field">
          <span class="admin-detail-label">ID</span>
          <span class="admin-detail-value">${details.user.id}</span>
        </div>
        <div class="admin-detail-field">
          <span class="admin-detail-label">Email</span>
          <span class="admin-detail-value">${details.user.email}</span>
        </div>
        <div class="admin-detail-field">
          <span class="admin-detail-label">Username</span>
          <span class="admin-detail-value">${details.user.username || 'N/A'}</span>
        </div>
        <div class="admin-detail-field">
          <span class="admin-detail-label">Rol</span>
          <span class="admin-detail-value">${getRoleLabel(details.user.role)}</span>
        </div>
        <div class="admin-detail-field">
          <span class="admin-detail-label">KYC Status</span>
          <span class="admin-detail-value">${getKYCLabel(details.user.kyc_status)}</span>
        </div>
        <div class="admin-detail-field">
          <span class="admin-detail-label">Estado</span>
          <span class="admin-detail-value">${getStatusLabel(details.user.status)}</span>
        </div>
        <div class="admin-detail-field">
          <span class="admin-detail-label">Registro</span>
          <span class="admin-detail-value">${formatDate(details.user.created_at)}</span>
        </div>
      </div>
    </div>

    <!-- Wallets -->
    <div class="admin-detail-section">
      <h4>
        <i class="bx bx-wallet"></i>
        Wallets (${details.wallets.length})
      </h4>
      <div class="admin-wallets-container">
        ${details.wallets.map(w => `
          <div class="admin-wallet-card ${w.isActive ? 'active' : 'blocked'}">
            <div class="admin-wallet-info">
              <div class="admin-wallet-header">
                <span class="admin-wallet-symbol">${w.symbol}</span>
                <span class="admin-wallet-name">${w.name}</span>
              </div>
              <span class="admin-wallet-balance">${formatMoney(w.balance)} ${w.symbol}</span>
            </div>
            <div class="admin-wallet-status">
              <span class="admin-wallet-status-badge ${w.isActive ? 'active' : 'blocked'}">
                ${w.isActive ? '<i class="bx bx-check-circle"></i> Activa' : '<i class="bx bx-lock"></i> Bloqueada'}
              </span>
            </div>
            <div class="admin-wallet-id">
              <small style="font-family: monospace; font-size: 11px; color: #64748b; display: block; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(100, 116, 139, 0.2);">
                ID: ${w.id}
              </small>
            </div>
            <div class="admin-wallet-actions">
              ${w.isActive ? `
                <button class="admin-btn-wallet-action admin-btn-block" onclick="toggleWalletStatus('${w.id}', false)">
                  <i class="bx bx-lock"></i>
                  Bloquear
                </button>
              ` : `
                <button class="admin-btn-wallet-action admin-btn-activate" onclick="toggleWalletStatus('${w.id}', true)">
                  <i class="bx bx-check-circle"></i>
                  Activar
                </button>
              `}
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Últimas Transacciones -->
    <div class="admin-detail-section">
      <h4>
        <i class="bx bx-transfer"></i>
        Últimas Transacciones (${details.recentTransactions.length})
      </h4>
      ${details.recentTransactions.length > 0 ? `
        <table class="admin-table" style="margin-top: 12px;">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Monto</th>
              <th>Moneda</th>
              <th>Hash</th>
            </tr>
          </thead>
          <tbody>
            ${details.recentTransactions.map(tx => `
              <tr>
                <td>${formatDate(tx.createdAt)}</td>
                <td style="color: ${tx.amount >= 0 ? '#43e97b' : '#e74c3c'};">
                  ${tx.amount >= 0 ? '+' : ''}${formatMoney(tx.amount)}
                </td>
                <td>${tx.currency}</td>
                <td style="font-family: monospace; font-size: 11px;">
                  ${tx.txHash.substring(0, 20)}...
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p style="color: #64748b; text-align: center; padding: 20px;">Sin transacciones</p>'}
    </div>
  `;

  modal.classList.remove('admin-hidden');
}

// ===================================
// CAMBIAR ESTADO DE USUARIO
// ===================================
window.toggleUserStatus = async function(userId, newStatus) {
  // Abrir modal de confirmación en lugar de usar confirm()
  showBlockUserModal(userId, newStatus);
};

// ===================================
// CAMBIAR ESTADO DE WALLET
// ===================================
window.toggleWalletStatus = async function(walletId, isActive) {
  // 🎯 Usar modal diferente según la acción
  if (isActive) {
    // ✅ Activar wallet
    showActivateWalletModal(walletId);
  } else {
    // 🔒 Bloquear wallet
    showBlockWalletModal(walletId, false);
  }
};

// ===================================
// CARGAR TRANSACCIONES
// ===================================
async function loadTransactions(filters = {}) {
  try {
    const session = getSession();
    
    const queryParams = new URLSearchParams();
    if (filters.currency) queryParams.append('currency', filters.currency);
    if (filters.limit) queryParams.append('limit', filters.limit);

    const url = `${API_BASE}/admin/transactions${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Error cargando transacciones');
    }

    const data = await response.json();
    allTransactions = data.data;

    console.log('[AdminPanel] Transacciones cargadas:', allTransactions.length);

    paintTransactionsTable(allTransactions);

  } catch (error) {
    console.error('[AdminPanel] Error cargando transacciones:', error);
    showError('Error cargando transacciones');
  }
}

// ===================================
// PINTAR TABLA DE TRANSACCIONES
// ===================================
function paintTransactionsTable(transactions) {
  const tbody = document.getElementById('transactionsTableBody');

  if (!tbody) return;

  if (transactions.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px;">
          <i class="bx bx-transfer" style="font-size: 48px; color: #cbd5e1; display: block; margin-bottom: 12px;"></i>
          <p style="color: #64748b;">No se encontraron transacciones</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = transactions.map(tx => `
    <tr>
      <td style="font-family: monospace; font-size: 12px;">
        ${tx.txHash.substring(0, 25)}...
      </td>
      <td>
        <div class="admin-user-info">
          <span class="admin-user-name">${tx.username || 'N/A'}</span>
          <span class="admin-user-email">${tx.userEmail}</span>
        </div>
      </td>
      <td style="color: ${tx.amount >= 0 ? '#43e97b' : '#e74c3c'}; font-weight: 700;">
        ${tx.amount >= 0 ? '+' : ''}${formatMoney(tx.amount)}
      </td>
      <td>
        <span class="admin-wallet-pill">${tx.currency}</span>
      </td>
      <td>
        <span class="admin-badge-pill admin-status-active">${tx.status}</span>
      </td>
      <td>${formatDate(tx.createdAt)}</td>
    </tr>
  `).join('');
}

// ===================================
// CARGAR COMISIONES
// ===================================
async function loadCommissions() {
  try {
    const session = getSession();

    // Balances del sistema
    const balancesResponse = await fetch(`${API_BASE}/commission/balances`, {
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!balancesResponse.ok) {
      throw new Error('Error cargando balances');
    }

    const balancesData = await balancesResponse.json();
    console.log('[AdminPanel] Balances del sistema:', balancesData.data);

    paintCommissionsGrid(balancesData.data.balances);

    // Actualizar total de comisiones en el card
    document.getElementById('totalCommissions').textContent = `$${formatMoney(balancesData.data.totalUSD)}`;

    // Historial de comisiones
    const historyResponse = await fetch(`${API_BASE}/commission/history?limit=50`, {
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!historyResponse.ok) {
      throw new Error('Error cargando historial');
    }

    const historyData = await historyResponse.json();
    paintCommissionsHistory(historyData.data);

  } catch (error) {
    console.error('[AdminPanel] Error cargando comisiones:', error);
    showError('Error cargando comisiones');
  }
}

// ===================================
// PINTAR GRID DE COMISIONES
// ===================================
function paintCommissionsGrid(balances) {
  const grid = document.querySelector('.admin-commissions-grid');

  if (!grid) return;

  grid.innerHTML = balances.map(balance => `
    <div class="admin-commission-card ${balance.currency.toLowerCase()}">
      <h4>${balance.currencyName}</h4>
      <p class="amount">${formatMoney(balance.balance)} ${balance.currency}</p>
      <small style="color: #64748b;">Última actualización: ${formatDate(balance.lastUpdate)}</small>
    </div>
  `).join('');
}

// ===================================
// PINTAR HISTORIAL DE COMISIONES
// ===================================
function paintCommissionsHistory(history) {
  const tbody = document.getElementById('commissionsTableBody');

  if (!tbody) return;

  if (history.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px;">
          <p style="color: #64748b;">No hay comisiones registradas</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = history.map(comm => `
    <tr>
      <td>${formatDate(comm.timestamp)}</td>
      <td style="color: #43e97b; font-weight: 700;">+${formatMoney(comm.amount)}</td>
      <td><span class="admin-wallet-pill">${comm.currency}</span></td>
      <td>${comm.metadata.transaction_type || 'N/A'}</td>
      <td>${comm.metadata.from_user_id ? comm.metadata.from_user_id.substring(0, 8) + '...' : 'N/A'}</td>
      <td>${formatMoney(comm.balanceAfter)} ${comm.currency}</td>
    </tr>
  `).join('');
}

// ===================================
// CARGAR DATOS DEL SISTEMA
// ===================================
async function loadSystemData() {
  try {
    const session = getSession();

    const response = await fetch(`${API_BASE}/commission/balances`, {
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Error cargando datos del sistema');
    }

    const data = await response.json();
    
    // Actualizar valores del sistema
    const usd = data.data.balances.find(b => b.currency === 'USD');
    const eur = data.data.balances.find(b => b.currency === 'EUR');
    const cop = data.data.balances.find(b => b.currency === 'COP');

    document.getElementById('systemWalletUSD').textContent = usd ? `$${formatMoney(usd.balance)}` : '$0.00';
    document.getElementById('systemWalletEUR').textContent = eur ? `€${formatMoney(eur.balance)}` : '€0.00';
    document.getElementById('systemWalletCOP').textContent = cop ? `$${formatMoney(cop.balance)}` : '$0.00';

    // Total usuarios (ya está cargado)
    const totalUsers = document.getElementById('totalUsers').textContent;
    document.getElementById('systemTotalUsers').textContent = totalUsers;

  } catch (error) {
    console.error('[AdminPanel] Error cargando sistema:', error);
  }
}

// ===================================
// EVENT LISTENERS
// ===================================
function setupEventListeners() {
  // Tabs
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      switchTab(tabName);
    });
  });

  // Refresh buttons
  document.getElementById('btnRefreshUsers')?.addEventListener('click', () => {
    loadUsers(getCurrentFilters());
  });

  document.getElementById('btnRefreshTx')?.addEventListener('click', () => {
    loadTransactions(getCurrentFilters());
  });

  // Filters
  document.getElementById('filterRole')?.addEventListener('change', (e) => {
    loadUsers({ role: e.target.value });
  });

  document.getElementById('filterKYC')?.addEventListener('change', (e) => {
    loadUsers({ kycStatus: e.target.value });
  });

  document.getElementById('filterStatus')?.addEventListener('change', (e) => {
    loadUsers({ status: e.target.value });
  });

  document.getElementById('filterCurrency')?.addEventListener('change', (e) => {
    loadTransactions({ currency: e.target.value });
  });

  // Search
  document.getElementById('searchUsers')?.addEventListener('input', (e) => {
    const search = e.target.value.trim();
    if (search.length >= 2 || search.length === 0) {
      loadUsers({ search });
    }
  });

  // Close modal
  document.getElementById('closeUserModal')?.addEventListener('click', () => {
    document.getElementById('userDetailModal').classList.add('admin-hidden');
  });

  // Click outside modal to close
  document.getElementById('userDetailModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'userDetailModal') {
      e.target.classList.add('admin-hidden');
    }
  });

// Refresh payments
document.getElementById('btnRefreshPayments')?.addEventListener('click', () => {
  loadPaymentRequests();
});

// Filter payments by status
document.getElementById('filterPaymentStatus')?.addEventListener('change', (e) => {
  loadPaymentRequests({ status: e.target.value });
});

// Close payment detail modal
document.getElementById('closePaymentModal')?.addEventListener('click', closePaymentDetailModal);

// Close reject modal
document.getElementById('closeRejectModal')?.addEventListener('click', closeRejectModal);
document.getElementById('btnCancelReject')?.addEventListener('click', closeRejectModal);

// Confirm reject
document.getElementById('btnConfirmReject')?.addEventListener('click', confirmRejectPayment);

// Click outside modal to close
document.getElementById('paymentDetailModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'paymentDetailModal') {
    closePaymentDetailModal();
  }
});

document.getElementById('rejectModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'rejectModal') {
    closeRejectModal();
  }
});

}

// ===================================
// CAMBIAR TAB
// ===================================
function switchTab(tabName) {
  currentTab = tabName;

  // Update tab buttons
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  // Update tab content
  document.querySelectorAll('.admin-tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabName}`);
  });

  // Load data for the tab
  switch (tabName) {
    case 'dashboard':
      loadPaymentRequests();
      break;
    case 'payments':
      loadPaymentRequests();
      break;
    case 'users':
      loadUsers();
      break;
    case 'transactions':
      loadTransactions();
      break;
    case 'commissions':
      loadCommissions();
      break;
    case 'system':
      loadSystemData();
      break;
  }
}

// ===================================
// OBTENER FILTROS ACTUALES
// ===================================
function getCurrentFilters() {
  return {
    role: document.getElementById('filterRole')?.value || '',
    kycStatus: document.getElementById('filterKYC')?.value || '',
    status: document.getElementById('filterStatus')?.value || '',
    search: document.getElementById('searchUsers')?.value || '',
    currency: document.getElementById('filterCurrency')?.value || ''
  };
}



// ===================================
// CARGAR SOLICITUDES DE PAGO
// ===================================
async function loadPaymentRequests(filters = {}) {
  try {
    const session = getSession();
    
    const queryParams = new URLSearchParams();
    if (filters.status) queryParams.append('status', filters.status);

    const url = `${API_BASE}/payment-requests${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Error cargando solicitudes');
    }

    const data = await response.json();
    allPaymentRequests = data.data || [];

    console.log('[AdminPanel] Solicitudes de pago cargadas:', allPaymentRequests.length);

    // Crear paginación
    window.paymentsPagination = new Pagination(allPaymentRequests, 20);
    
    // Renderizar con paginación
    renderPagination(window.paymentsPagination, 'payments-pagination', paintPaymentsTable);

    // Pintar tabla de pagos recientes (primeros 5)
    paintRecentPaymentsTable(allPaymentRequests.slice(0, 5));

    // Actualizar dashboard
    updateDashboardStats();

    // Actualizar badge de notificaciones
    updatePendingBadge();

  } catch (error) {
    console.error('[AdminPanel] Error cargando solicitudes:', error);
    showError('Error cargando solicitudes de pago');
  }
}

// ===================================
// ACTUALIZAR ESTADÍSTICAS DEL DASHBOARD
// ===================================
function updateDashboardStats() {
  const pending = allPaymentRequests.filter(p => p.status === 'pending');
  const approvedToday = allPaymentRequests.filter(p => 
    p.status === 'approved' && isToday(p.approvedAt)
  );
  const rejectedToday = allPaymentRequests.filter(p => 
    p.status === 'rejected' && isToday(p.rejectedAt)
  );

  // Calcular volumen procesado hoy
  let volumeToday = 0;
  approvedToday.forEach(p => {
    volumeToday += p.amount;
  });

  // Actualizar UI
  document.getElementById('dashPendingPayments').textContent = pending.length;
  document.getElementById('dashApprovedToday').textContent = approvedToday.length;
  document.getElementById('dashRejectedToday').textContent = rejectedToday.length;
  document.getElementById('dashVolumeToday').textContent = `$${formatMoney(volumeToday)}`;

  // Mostrar/ocultar alerta de pendientes
  const alert = document.getElementById('pendingPaymentsAlert');
  const count = document.getElementById('pendingPaymentsCount');
  
  if (pending.length > 0) {
    alert.style.display = 'flex';
    count.textContent = pending.length;
  } else {
    alert.style.display = 'none';
  }

  // Pintar tabla de recientes
  const recent = allPaymentRequests.slice(0, 5);
  paintRecentPaymentsTable(recent);
}

// ===================================
// ACTUALIZAR BADGE DE NOTIFICACIONES
// ===================================
function updatePendingBadge() {
  const pending = allPaymentRequests.filter(p => p.status === 'pending');
  const badge = document.getElementById('pendingPaymentsBadge');
  
  if (badge) {
    badge.textContent = pending.length;
    badge.style.display = pending.length > 0 ? 'inline-block' : 'none';
  }
}

// ===================================
// PINTAR TABLA DE PAGOS RECIENTES
// ===================================
function paintRecentPaymentsTable(payments) {
  const tbody = document.getElementById('recentPaymentsTableBody');

  if (!tbody) return;

  if (payments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px;">
          <p style="color: #64748b;">No hay solicitudes recientes</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = payments.map(p => `
    <tr>
      <td>
        <div class="admin-user-info">
          <span class="admin-user-name">${p.fromUser.username || 'N/A'}</span>
          <span class="admin-user-email">${p.fromUser.email}</span>
        </div>
      </td>
      <td>
        <div class="admin-user-info">
          <span class="admin-user-name">${p.toUser.username || 'N/A'}</span>
          <span class="admin-user-email">${p.toUser.email}</span>
        </div>
      </td>
      <td style="font-weight: 700; color: #667eea;">
        ${formatMoney(p.amount || 0)} ${p.fromCurrency || 'USD'}
      </td>
      <td>
        <span class="admin-badge-pill admin-payment-${p.status}">
          ${getPaymentStatusLabel(p.status)}
        </span>
      </td>
      <td>${formatDate(p.createdAt)}</td>
      <td>
        <div class="admin-action-buttons">
          <button class="admin-btn-action admin-btn-view" onclick="showPaymentDetailsModal('${p.id}')">
            <i class="bx bx-show"></i>
            Ver Detalles
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ===================================
// PINTAR TABLA COMPLETA DE PAGOS
// ===================================
function paintPaymentsTable(payments) {
  const tbody = document.getElementById('paymentsTableBody');
  if (!tbody) return;

  if (payments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 40px;">
          <i class="bx bx-receipt" style="font-size: 48px; color: #d1d5db;"></i>
          <p style="color: #6b7280; margin-top: 16px;">No hay solicitudes de pago</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = payments.map(p => `
    <tr>
      <td style="font-family: monospace; font-size: 11px;">${p.id.substring(0, 8)}...</td>
      <td>
        <div class="admin-user-info">
          <span class="admin-user-name">${p.fromUser?.username || 'N/A'}</span>
          <span class="admin-user-email">${p.fromUser?.email || 'N/A'}</span>
        </div>
      </td>
      <td>
        <div class="admin-user-info">
          <span class="admin-user-name">${p.toUser?.username || p.toUserEmail || 'N/A'}</span>
          <span class="admin-user-email">${p.toUser?.email || p.toUserEmail || 'N/A'}</span>
        </div>
      </td>
      <td style="font-weight: 700; color: #667eea;">
        ${formatMoney(p.amount || 0)} ${p.fromCurrency || 'USD'}
      </td>
      <td>
        ${formatMoney(p.convertedAmount || 0)} ${p.toCurrency || 'USD'}
        <br>
        <small style="color: #94a3b8;">Tasa: ${p.exchangeRate ? p.exchangeRate.toFixed(6) : 'N/A'}</small>
      </td>
      <td style="color: #f5576c;">
        ${formatMoney(p.commission || 0)} ${p.fromCurrency || 'USD'}
      </td>
      <td>
        <span class="admin-badge-pill admin-payment-${p.status}">
          ${getPaymentStatusLabel(p.status)}
        </span>
      </td>
      <td>${formatDate(p.createdAt)}</td>
      <td>
        <div class="admin-action-buttons">
          <button class="admin-btn-action admin-btn-view" onclick="viewPaymentDetails('${p.id}')">
            <i class="bx bx-show"></i>
          </button>
          ${p.status === 'pending' ? `
            <button class="admin-btn-action admin-btn-approve" onclick="showApprovalModal('${p.id}')">
              <i class="bx bx-check"></i>
            </button>
            <button class="admin-btn-action admin-btn-reject" onclick="showRejectionModal('${p.id}')">
              <i class="bx bx-x"></i>
            </button>
          ` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}


// ===================================
// VER DETALLE DE PAGO
// ===================================
window.viewPaymentDetails = function(paymentId) {
  window.switchTab = switchTab;
  const payment = allPaymentRequests.find(p => p.id === paymentId);

  if (!payment) {
    showError('Solicitud no encontrada');
    return;
  }

  const content = document.getElementById('paymentDetailContent');
  const footer = document.getElementById('paymentModalFooter');

  content.innerHTML = `
    <!-- Highlight -->
    <div class="admin-payment-detail-highlight">
      <div class="admin-payment-detail-row">
        <span class="admin-payment-detail-label">Monto a Enviar:</span>
        <span class="admin-payment-detail-value">${formatMoney(payment.amount || 0)} ${payment.fromCurrency || 'USD'}</span>
      </div>
      <div class="admin-payment-detail-row">
        <span class="admin-payment-detail-label">Monto a Recibir:</span>
        <span class="admin-payment-detail-value">${formatMoney(payment.convertedAmount || 0)} ${payment.toCurrency || 'USD'}</span>
      </div>
      <div class="admin-payment-detail-row">
        <span class="admin-payment-detail-label">Comisión:</span>
        <span class="admin-payment-detail-value">${formatMoney(payment.commission || 0)} ${payment.fromCurrency || 'USD'}</span>
      </div>
      <div class="admin-payment-detail-row">
        <span class="admin-payment-detail-label">Total a Debitar:</span>
        <span class="admin-payment-detail-value">${formatMoney((payment.amount || 0) + (payment.commission || 0))} ${payment.fromCurrency || 'USD'}</span>
      </div>
    </div>

    <!-- Grid -->
    <div class="admin-payment-detail-grid">
      <!-- Remitente -->
      <div class="admin-payment-detail-section">
        <h4>Remitente</h4>
        <div class="admin-payment-detail-row">
          <span class="admin-payment-detail-label">Email:</span>
          <span class="admin-payment-detail-value">${payment.fromUser.email}</span>
        </div>
        <div class="admin-payment-detail-row">
          <span class="admin-payment-detail-label">Usuario:</span>
          <span class="admin-payment-detail-value">${payment.fromUser.username || 'N/A'}</span>
        </div>
        <div class="admin-payment-detail-row">
          <span class="admin-payment-detail-label">Wallet ID:</span>
          <span class="admin-payment-detail-value" style="font-size: 11px; font-family: monospace;">${payment.fromWalletId ? payment.fromWalletId.substring(0, 16) + '...' : 'N/A'}</span>
        </div>
      </div>

      <!-- Destinatario -->
      <div class="admin-payment-detail-section">
        <h4>Destinatario</h4>
        <div class="admin-payment-detail-row">
          <span class="admin-payment-detail-label">Email:</span>
          <span class="admin-payment-detail-value">${payment.toUser.email}</span>
        </div>
        <div class="admin-payment-detail-row">
          <span class="admin-payment-detail-label">Usuario:</span>
          <span class="admin-payment-detail-value">${payment.toUser.username || 'N/A'}</span>
        </div>
        <div class="admin-payment-detail-row">
          <span class="admin-payment-detail-label">Wallet ID:</span>
          <span class="admin-payment-detail-value" style="font-size: 11px; font-family: monospace;">${payment.toWalletId ? payment.toWalletId.substring(0, 16) + '...' : 'N/A'}</span>
        </div>
      </div>
    </div>

    <!-- Detalles -->
    <div class="admin-detail-section">
      <h4>Detalles de la Transacción</h4>
      <div class="admin-detail-grid">
        <div class="admin-detail-field">
          <span class="admin-detail-label">ID de Solicitud</span>
          <span class="admin-detail-value" style="font-size: 12px; font-family: monospace;">${payment.id}</span>
        </div>
        <div class="admin-detail-field">
          <span class="admin-detail-label">Estado</span>
          <span class="admin-badge-pill admin-payment-${payment.status}">${getPaymentStatusLabel(payment.status)}</span>
        </div>
        <div class="admin-detail-field">
          <span class="admin-detail-label">Tasa de Cambio</span>
          <span class="admin-detail-value">1 ${payment.fromCurrency || 'USD'} = ${payment.exchangeRate ? payment.exchangeRate.toFixed(6) : 'N/A'} ${payment.toCurrency || 'USD'}</span>
        </div>
        <div class="admin-detail-field">
          <span class="admin-detail-label">Fecha de Creación</span>
          <span class="admin-detail-value">${formatDate(payment.createdAt)}</span>
        </div>
        ${payment.description ? `
          <div class="admin-detail-field" style="grid-column: 1 / -1;">
            <span class="admin-detail-label">Descripción</span>
            <span class="admin-detail-value">${payment.description}</span>
          </div>
        ` : ''}
        ${payment.approvedAt ? `
          <div class="admin-detail-field">
            <span class="admin-detail-label">Aprobado el</span>
            <span class="admin-detail-value">${formatDate(payment.approvedAt)}</span>
          </div>
        ` : ''}
        ${payment.rejectedAt ? `
          <div class="admin-detail-field">
            <span class="admin-detail-label">Rechazado el</span>
            <span class="admin-detail-value">${formatDate(payment.rejectedAt)}</span>
          </div>
        ` : ''}
        ${payment.rejectionReason ? `
          <div class="admin-detail-field" style="grid-column: 1 / -1;">
            <span class="admin-detail-label">Motivo del Rechazo</span>
            <span class="admin-detail-value">${payment.rejectionReason}</span>
          </div>
        ` : ''}
        ${payment.transactionHash ? `
          <div class="admin-detail-field" style="grid-column: 1 / -1;">
            <span class="admin-detail-label">Hash de Transacción</span>
            <span class="admin-detail-value" style="font-size: 12px; font-family: monospace;">${payment.transactionHash}</span>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  // Footer con botones de acción
  if (payment.status === 'pending') {
    footer.innerHTML = `
      <button class="admin-btn-secondary" onclick="closePaymentDetailModal()">
        Cerrar
      </button>
      <button class="admin-btn-action admin-btn-reject" onclick="closePaymentDetailModal(); openRejectModal('${payment.id}')">
        <i class="bx bx-x-circle"></i>
        Rechazar
      </button>
      <button class="admin-btn-action admin-btn-approve" onclick="approvePayment('${payment.id}')">
        <i class="bx bx-check-circle"></i>
        Aprobar
      </button>
    `;
  } else {
    footer.innerHTML = `
      <button class="admin-btn-secondary" onclick="closePaymentDetailModal()">
        Cerrar
      </button>
    `;
  }

  document.getElementById('paymentDetailModal').classList.remove('admin-hidden');
};

window.closePaymentDetailModal = function() {
  document.getElementById('paymentDetailModal').classList.add('admin-hidden');
};

// ===================================
// APROBAR PAGO
// ===================================
window.approvePayment = async function(paymentId) {
  if (!confirm('¿Estás seguro de aprobar esta solicitud de pago? Se ejecutará la transferencia inmediatamente.')) {
    return;
  }

  try {
    const session = getSession();

    const response = await fetch(`${API_BASE}/payment-requests/${paymentId}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error aprobando solicitud');
    }

    console.log('[AdminPanel] ✅ Solicitud aprobada:', data);

    
    

    showSuccess('Solicitud aprobada y pago procesado exitosamente');

    

    // Cerrar modal si está abierto
    closePaymentDetailModal();

    // Recargar solicitudes
    await loadPaymentRequests();
    // Actualizar badge del sidebar
    if (window.sidebarBadge) {
      await window.sidebarBadge.refresh();
    }


  } catch (error) {
    console.error('[AdminPanel] ❌ Error aprobando solicitud:', error);
    showError(error.message || 'Error aprobando solicitud');
  }
};

// ===================================
// ABRIR MODAL DE RECHAZO
// ===================================
window.openRejectModal = function(paymentId) {
  currentPaymentId = paymentId;
  document.getElementById('rejectionReason').value = '';
  document.getElementById('rejectModal').classList.remove('admin-hidden');
};

window.closeRejectModal = function() {
  currentPaymentId = null;
  document.getElementById('rejectModal').classList.add('admin-hidden');
};

// ===================================
// CONFIRMAR RECHAZO
// ===================================
window.confirmRejectPayment = async function() {
  if (!currentPaymentId) return;

  try {
    const reason = document.getElementById('rejectionReason').value.trim();
    const session = getSession();

    const response = await fetch(`${API_BASE}/payment-requests/${currentPaymentId}/reject`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error rechazando solicitud');
    }

    console.log('[AdminPanel] ✅ Solicitud rechazada:', data);
    

    showSuccess('Solicitud rechazada exitosamente');

    
    // Cerrar modales
    closeRejectModal();
    closePaymentDetailModal();

    // Recargar solicitudes
    await loadPaymentRequests();
    

    // Actualizar badge del sidebar
  if (window.sidebarBadge) {
    await window.sidebarBadge.refresh();
  }


  } catch (error) {
    console.error('[AdminPanel] ❌ Error rechazando solicitud:', error);
    showError(error.message || 'Error rechazando solicitud');
  }
};

// ===================================
// UTILIDADES ADICIONALES
// ===================================

function getPaymentStatusLabel(status) {
  const labels = {
    'pending': 'Pendiente',
    'approved': 'Aprobada',
    'rejected': 'Rechazada',
    'failed': 'Fallida'
  };
  return labels[status] || status;
}

function isToday(dateString) {
  if (!dateString) return false;
  
  const date = new Date(dateString);
  const today = new Date();
  
  return date.getDate() === today.getDate() &&
         date.getMonth() === today.getMonth() &&
         date.getFullYear() === today.getFullYear();
}



// ===================================
// UTILIDADES
// ===================================

function getRoleClass(role) {
  const map = {
    'fluxiAdmin': 'admin',
    'fluxiDev': 'dev',
    'fluxiDocs': 'docs',
    'fluxiUser': 'user'
  };
  return map[role] || 'user';
}

function getRoleLabel(role) {
  const map = {
    'fluxiAdmin': 'Admin',
    'fluxiDev': 'Developer',
    'fluxiDocs': 'Inspector',
    'fluxiUser': 'Usuario'
  };
  return map[role] || role;
}

function getKYCLabel(status) {
  const map = {
    'approved': 'Aprobado',
    'pending': 'Pendiente',
    'rejected': 'Rechazado',
    'in-progress': 'En proceso'
  };
  return map[status] || status;
}

function getStatusLabel(status) {
  const map = {
    'active': 'Activo',
    'blocked': 'Bloqueado',
    'suspended': 'Suspendido'
  };
  return map[status] || status;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatMoney(value) {
  return parseFloat(value || 0).toLocaleString('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function showSuccess(message) {
  // Puedes implementar un toast o notification system aquí
  console.log('✅ SUCCESS:', message);
  alert(message);
}

function showError(message) {
  console.error('❌ ERROR:', message);
  alert(message);
}


// ===================================
// AJUSTAR LAYOUT SEGÚN SIDEBAR
// ===================================
function adjustMainContentMargin() {
  const sidebar = document.querySelector('.sidebar');
  const mainContent = document.querySelector('.admin-main-content');

  if (!mainContent) return;

  if (!sidebar) {
    // No hay sidebar, ocupar todo el ancho
    mainContent.style.marginLeft = '0';
    return;
  }

  // Observar cambios en el sidebar
  const updateMargin = () => {
    if (sidebar.classList.contains('collapsed')) {
      mainContent.style.marginLeft = '80px';
    } else {
      mainContent.style.marginLeft = '280px';
    }
  };

  // Actualizar al cargar
  updateMargin();

  // Observar cambios en las clases del sidebar
  const observer = new MutationObserver(updateMargin);
  observer.observe(sidebar, {
    attributes: true,
    attributeFilter: ['class']
  });

  console.log('[AdminPanel] Layout ajustado según sidebar');
}

// Ejecutar cuando el sidebar esté cargado
document.addEventListener('sidebar:loaded', adjustMainContentMargin);

// Ejecutar también en DOMContentLoaded como fallback
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(adjustMainContentMargin, 100);
  });
} else {
  setTimeout(adjustMainContentMargin, 100);
}

/**
 * FUNCIONES MODERNAS PARA ADMIN PANEL
 * Sistema de modales, paginación y refresh
 * Agregar al admin-panel.js
 */

// ============================================
// SISTEMA DE PAGINACIÓN
// ============================================

class Pagination {
  constructor(items, itemsPerPage = 20) {
    this.allItems = items;
    this.itemsPerPage = itemsPerPage;
    this.currentPage = 1;
    this.totalPages = Math.ceil(items.length / itemsPerPage);
  }

  getCurrentItems() {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.allItems.slice(start, end);
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  goToPage(page) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  getPageInfo() {
    const start = (this.currentPage - 1) * this.itemsPerPage + 1;
    const end = Math.min(this.currentPage * this.itemsPerPage, this.allItems.length);
    
    return {
      currentPage: this.currentPage,
      totalPages: this.totalPages,
      totalItems: this.allItems.length,
      start,
      end
    };
  }
}

// Paginadores globales
let usersPagination = null;
let transactionsPagination = null;
let paymentsPagination = null;

// ============================================
// MODALES MODERNOS
// ============================================

// Estado del modal de aprobación
let currentApprovalPaymentId = null;

/**
 * Mostrar modal de confirmación de aprobación
 */
window.showApprovalModal = function(paymentId) {
  const payment = allPaymentRequests.find(p => p.id === paymentId);
  if (!payment) return;

  currentApprovalPaymentId = paymentId;

  // Llenar datos
  document.getElementById('approveAmount').textContent = 
    `$${formatMoney(payment.amount || 0)} ${payment.fromCurrency || 'USD'}`;
  document.getElementById('approveSender').textContent = 
    payment.fromUser?.email || 'N/A';
  document.getElementById('approveRecipient').textContent = 
    payment.toUser?.email || payment.toUserEmail || 'N/A';

  // Mostrar modal
  const modal = document.getElementById('confirmApproveModal');
  modal.classList.add('active');
};

/**
 * Cerrar modal de aprobación
 */
window.closeConfirmApproveModal = function() {
  currentApprovalPaymentId = null;
  const modal = document.getElementById('confirmApproveModal');
  modal.classList.remove('active');
};

/**
 * Ejecutar aprobación
 */
window.executeApproval = async function() {
  if (!currentApprovalPaymentId) return;

  const btn = document.getElementById('confirmApproveBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Procesando...';

  try {
    await approvePayment(currentApprovalPaymentId);
    closeConfirmApproveModal();
    showSuccessMessage('¡Pago aprobado!', 'La transferencia se ejecutó correctamente.');
    
    // Recargar datos
    await loadPaymentRequests();
    
  } catch (error) {
    console.error('[Modal] Error:', error);
    showErrorMessage('Error al aprobar', error.message || 'No se pudo aprobar el pago');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bx bx-check"></i> Aprobar Pago';
  }
};

// Estado del modal de rechazo
let currentRejectionPaymentId = null;

/**
 * Mostrar modal de confirmación de rechazo
 */
window.showRejectionModal = function(paymentId) {
  const payment = allPaymentRequests.find(p => p.id === paymentId);
  if (!payment) return;

  currentRejectionPaymentId = paymentId;

  // Llenar datos
  document.getElementById('rejectAmount').textContent = 
    `$${formatMoney(payment.amount || 0)} ${payment.fromCurrency || 'USD'}`;
  document.getElementById('rejectSender').textContent = 
    payment.fromUser?.email || 'N/A';
  document.getElementById('rejectRecipient').textContent = 
    payment.toUser?.email || payment.toUserEmail || 'N/A';
  
  // Limpiar textarea
  document.getElementById('rejectReasonInput').value = '';

  // Mostrar modal
  const modal = document.getElementById('confirmRejectModal');
  modal.classList.add('active');
};

/**
 * Cerrar modal de rechazo
 */
window.closeConfirmRejectModal = function() {
  currentRejectionPaymentId = null;
  const modal = document.getElementById('confirmRejectModal');
  modal.classList.remove('active');
};

/**
 * Ejecutar rechazo
 */
window.executeRejection = async function() {
  if (!currentRejectionPaymentId) return;

  const reason = document.getElementById('rejectReasonInput').value.trim();
  
  const btn = document.getElementById('confirmRejectBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Procesando...';

  try {
    const session = getSession();
    const response = await fetch(`${API_BASE}/payment-requests/${currentRejectionPaymentId}/reject`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error rechazando solicitud');
    }

    closeConfirmRejectModal();
    showSuccessMessage('Pago rechazado', 'La solicitud fue rechazada correctamente.');
    
    // Recargar datos
    await loadPaymentRequests();
    
    // Actualizar badge
    if (window.sidebarBadge) {
      await window.sidebarBadge.refresh();
    }

  } catch (error) {
    console.error('[Modal] Error:', error);
    showErrorMessage('Error al rechazar', error.message || 'No se pudo rechazar el pago');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bx bx-x"></i> Rechazar Pago';
  }
};

/**
 * Modal de bloqueo de usuario
 */
let currentBlockUserId = null;
let currentBlockUserStatus = null;

window.showBlockUserModal = function(userId, newStatus) {
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;

  currentBlockUserId = userId;
  currentBlockUserStatus = newStatus;

  document.getElementById('blockUserEmail').textContent = user.email || 'N/A';

  const modal = document.getElementById('confirmBlockUserModal');
  const title = modal.querySelector('h3');
  const btn = document.getElementById('confirmBlockUserBtn');

  if (newStatus === 'blocked') {
    title.textContent = '¿Bloquear este usuario?';
    btn.innerHTML = '<i class="bx bx-block"></i> Bloquear Usuario';
  } else {
    title.textContent = '¿Desbloquear este usuario?';
    btn.innerHTML = '<i class="bx bx-check"></i> Desbloquear Usuario';
  }

  modal.classList.add('active');
};

window.closeConfirmBlockUserModal = function() {
  currentBlockUserId = null;
  currentBlockUserStatus = null;
  const modal = document.getElementById('confirmBlockUserModal');
  modal.classList.remove('active');
};

window.executeBlockUser = async function() {
  if (!currentBlockUserId || !currentBlockUserStatus) return;

  const btn = document.getElementById('confirmBlockUserBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Procesando...';

  try {
    const session = getSession();
    const response = await fetch(`${API_BASE}/admin/users/${currentBlockUserId}/status`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: currentBlockUserStatus })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Error actualizando usuario');
    }

    closeConfirmBlockUserModal();
    showSuccessMessage(
      currentBlockUserStatus === 'blocked' ? 'Usuario bloqueado' : 'Usuario desbloqueado',
      'El estado del usuario se actualizó correctamente.'
    );

    // Recargar usuarios
    await loadUsers();

  } catch (error) {
    console.error('[Modal] Error:', error);
    showErrorMessage('Error', error.message || 'No se pudo actualizar el usuario');
  } finally {
    btn.disabled = false;
  }
};

// ===================================
// MODAL DE BLOQUEO DE WALLET
// ===================================
let currentBlockWalletId = null;
let currentBlockWalletStatus = null;
let isBlockWalletOperationInProgress = false;

window.showBlockWalletModal = function(walletId, isActive) {
  // 🛡️ No permitir abrir otra modal si hay operación en progreso
  if (isBlockWalletOperationInProgress) {
    console.warn('[WalletBlock] ⚠️ Operación en progreso, espera a que termine...');
    return;
  }

  const modal = document.querySelector('.modern-modal#confirmBlockWalletModal') || createBlockWalletModal();

  // ✅ Resetear estado antes de mostrar nuevo modal
  currentBlockWalletId = walletId;
  currentBlockWalletStatus = isActive;

  const title = modal.querySelector('h3');
  const btn = modal.querySelector('[id="confirmBlockWalletBtn"]');
  const icon = modal.querySelector('.modern-modal-icon');

  // ✅ Resetear estado visual del botón
  btn.disabled = false;
  btn.innerHTML = isActive ? '<i class="bx bx-check-circle"></i> Activar Wallet' : '<i class="bx bx-lock"></i> Bloquear Wallet';

  if (isActive) {
    title.textContent = '¿Activar esta wallet?';
    icon.classList.remove('danger', 'warning');
    icon.classList.add('success');
  } else {
    title.textContent = '¿Bloquear esta wallet?';
    icon.classList.remove('success', 'warning');
    icon.classList.add('danger');
  }

  console.log(`[WalletBlock] 📋 Modal abierto para wallet ${walletId} (isActive: ${isActive})`);
  modal.classList.add('active');
};

window.closeConfirmBlockWalletModal = function() {
  currentBlockWalletId = null;
  currentBlockWalletStatus = null;
  const modal = document.querySelector('.modern-modal#confirmBlockWalletModal');
  if (modal) modal.classList.remove('active');
};

window.executeBlockWallet = async function() {
  if (currentBlockWalletId === null || currentBlockWalletStatus === null) return;

  // 🛡️ PREVENIR MÚLTIPLES OPERACIONES CONCURRENTES
  if (isBlockWalletOperationInProgress) {
    console.warn('[WalletBlock] ⚠️ Ya hay una operación en progreso');
    return;
  }

  isBlockWalletOperationInProgress = true;

  // 🔒 GUARDAR VALORES ANTES DE LIMPIAR
  const walletId = currentBlockWalletId;
  const isActive = currentBlockWalletStatus;

  const modal = document.querySelector('.modern-modal#confirmBlockWalletModal');
  const btn = modal.querySelector('[id="confirmBlockWalletBtn"]');
  btn.disabled = true;
  btn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Procesando...';

  try {
    const session = getSession();
    const timestamp = new Date().toLocaleTimeString('es-ES');

    console.log(`[WalletBlock] 🔄 [${timestamp}] Iniciando bloqueo de wallet ${walletId}...`);

    const response = await fetch(`${API_BASE}/admin/wallets/${walletId}/status`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ isActive: isActive })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Error actualizando wallet');
    }

    console.log(`[WalletBlock] ✅ [${timestamp}] Wallet ${isActive ? 'activada' : 'bloqueada'} en backend`);

    // 🔄 PASO 1: Cerrar modal de confirmación
    closeConfirmBlockWalletModal();

    // 🔄 PASO 2: Guardar ID del usuario antes de refrescar
    const userDetailContent = document.getElementById('userDetailContent');
    const userIdFromContent = userDetailContent?.getAttribute('data-user-id');
    const userDetailModal = document.getElementById('userDetailModal');
    const wasModalOpen = userDetailModal && !userDetailModal.classList.contains('admin-hidden');

    // 🔄 PASO 3: Refrescar tabla de usuarios SIN cerrar modal
    console.log(`[WalletBlock] 🔄 Refrescando tabla de usuarios...`);
    await loadUsers();
    console.log(`[WalletBlock] ✅ Tabla de usuarios actualizada`);

    // 🔄 PASO 4: Si el modal estaba abierto, reabrir con datos actualizados
    if (wasModalOpen && userIdFromContent) {
      console.log(`[WalletBlock] 🔄 Reabriendo modal del usuario con datos actualizados...`);

      await new Promise(resolve => setTimeout(resolve, 150));

      const userDetailResponse = await fetch(`${API_BASE}/admin/users/${userIdFromContent}`, {
        headers: {
          'Authorization': `Bearer ${session.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (userDetailResponse.ok) {
        const updatedData = await userDetailResponse.json();
        showUserDetailsModal(updatedData.data);
        console.log(`[WalletBlock] ✅ Modal del usuario actualizado con datos frescos`);
      }
    }

    // ✅ USAR LOS VALORES GUARDADOS, NO LAS VARIABLES GLOBALES
    showSuccessMessage(
      isActive ? '✅ Wallet Activada' : '🔒 Wallet Bloqueada',
      'Los cambios se aplicaron al instante en todo el panel.'
    );

  } catch (error) {
    const timestamp = new Date().toLocaleTimeString('es-ES');
    console.error(`[WalletBlock] ❌ [${timestamp}] Error:`, error.message);
    showErrorMessage('Error', error.message || 'No se pudo actualizar la wallet');

    // Resetear el botón para permitir reintentos
    btn.disabled = false;
    btn.innerHTML = '<i class="bx bx-lock"></i> Bloquear Wallet';
  } finally {
    // ✅ PERMITIR NUEVA OPERACIÓN
    isBlockWalletOperationInProgress = false;
    console.log('[WalletBlock] ✅ Operación completada - listo para nueva operación');
  }
};

function createBlockWalletModal() {
  const modal = document.createElement('div');
  modal.className = 'modern-modal';
  modal.id = 'confirmBlockWalletModal';
  modal.innerHTML = `
    <div class="modern-modal-backdrop" onclick="closeConfirmBlockWalletModal()"></div>
    <div class="modern-modal-card">
      <div class="modern-modal-header">
        <div class="modern-modal-icon danger">
          <i class="bx bx-lock"></i>
        </div>
        <h3>¿Bloquear esta wallet?</h3>
        <button class="modern-modal-close" onclick="closeConfirmBlockWalletModal()">
          <i class="bx bx-x"></i>
        </button>
      </div>

      <div class="modern-modal-body">
        <p>Estás a punto de cambiar el estado de esta wallet.</p>
        <div class="modern-modal-highlight danger">
          <span class="modern-modal-detail">
            Esto afectará el acceso del usuario a esta moneda.
          </span>
        </div>
        <p class="modern-modal-warning">
          <i class="bx bx-info-circle"></i>
          El usuario seguirá siendo capaz de ver la wallet, pero no podrá usarla.
        </p>
      </div>

      <div class="modern-modal-footer">
        <button class="modern-btn secondary" onclick="closeConfirmBlockWalletModal()">
          Cancelar
        </button>
        <button class="modern-btn danger" id="confirmBlockWalletBtn" onclick="executeBlockWallet()">
          <i class="bx bx-lock"></i>
          Bloquear Wallet
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  return modal;
}

// ===================================
// MODAL DE ACTIVACIÓN DE WALLET (SEPARADO)
// ===================================
let currentActivateWalletId = null;
let isActivateWalletOperationInProgress = false;

window.showActivateWalletModal = function(walletId) {
  // 🛡️ No permitir abrir otra modal si hay operación en progreso
  if (isActivateWalletOperationInProgress) {
    console.warn('[WalletActivate] ⚠️ Operación en progreso, espera a que termine...');
    return;
  }

  const modal = document.querySelector('.modern-modal#confirmActivateWalletModal') || createActivateWalletModal();

  // ✅ Resetear estado antes de mostrar nuevo modal
  currentActivateWalletId = walletId;

  const btn = modal.querySelector('[id="confirmActivateWalletBtn"]');

  // ✅ Resetear estado visual del botón
  btn.disabled = false;
  btn.innerHTML = '<i class="bx bx-check-circle"></i> Activar Wallet';

  console.log(`[WalletActivate] 📋 Modal abierto para wallet ${walletId}`);
  modal.classList.add('active');
};

window.closeConfirmActivateWalletModal = function() {
  currentActivateWalletId = null;
  const modal = document.querySelector('.modern-modal#confirmActivateWalletModal');
  if (modal) modal.classList.remove('active');
};

window.executeActivateWallet = async function() {
  if (currentActivateWalletId === null) return;

  // 🛡️ PREVENIR MÚLTIPLES OPERACIONES CONCURRENTES
  if (isActivateWalletOperationInProgress) {
    console.warn('[WalletActivate] ⚠️ Ya hay una operación en progreso');
    return;
  }

  isActivateWalletOperationInProgress = true;

  // 🔒 GUARDAR VALOR ANTES DE LIMPIAR
  const walletId = currentActivateWalletId;

  const modal = document.querySelector('.modern-modal#confirmActivateWalletModal');
  const btn = modal.querySelector('[id="confirmActivateWalletBtn"]');
  btn.disabled = true;
  btn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Procesando...';

  try {
    const session = getSession();
    const timestamp = new Date().toLocaleTimeString('es-ES');

    console.log(`[WalletActivate] 🔄 [${timestamp}] Iniciando activación de wallet ${walletId}...`);

    const response = await fetch(`${API_BASE}/admin/wallets/${walletId}/status`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ isActive: true })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Error actualizando wallet');
    }

    console.log(`[WalletActivate] ✅ [${timestamp}] Wallet activada en backend`);

    // 🔄 PASO 1: Cerrar modal de confirmación
    closeConfirmActivateWalletModal();

    // 🔄 PASO 2: Guardar ID del usuario antes de refrescar
    const userDetailContent = document.getElementById('userDetailContent');
    const userIdFromContent = userDetailContent?.getAttribute('data-user-id');
    const userDetailModal = document.getElementById('userDetailModal');
    const wasModalOpen = userDetailModal && !userDetailModal.classList.contains('admin-hidden');

    // 🔄 PASO 3: Refrescar tabla de usuarios SIN cerrar modal
    console.log(`[WalletActivate] 🔄 Refrescando tabla de usuarios...`);
    await loadUsers();
    console.log(`[WalletActivate] ✅ Tabla de usuarios actualizada`);

    // 🔄 PASO 4: Si el modal estaba abierto, reabrir con datos actualizados
    if (wasModalOpen && userIdFromContent) {
      console.log(`[WalletActivate] 🔄 Reabriendo modal del usuario con datos actualizados...`);

      await new Promise(resolve => setTimeout(resolve, 150));

      const userDetailResponse = await fetch(`${API_BASE}/admin/users/${userIdFromContent}`, {
        headers: {
          'Authorization': `Bearer ${session.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (userDetailResponse.ok) {
        const updatedData = await userDetailResponse.json();
        showUserDetailsModal(updatedData.data);
        console.log(`[WalletActivate] ✅ Modal del usuario actualizado con datos frescos`);
      }
    }

    // ✅ MOSTRAR MENSAJE DE ÉXITO
    showSuccessMessage(
      '✅ Wallet Activada',
      'La wallet ha sido activada correctamente para el usuario.'
    );

  } catch (error) {
    const timestamp = new Date().toLocaleTimeString('es-ES');
    console.error(`[WalletActivate] ❌ [${timestamp}] Error:`, error.message);
    showErrorMessage('Error', error.message || 'No se pudo activar la wallet');

    // Resetear el botón para permitir reintentos
    btn.disabled = false;
    btn.innerHTML = '<i class="bx bx-check-circle"></i> Activar Wallet';
  } finally {
    // ✅ PERMITIR NUEVA OPERACIÓN
    isActivateWalletOperationInProgress = false;
    console.log('[WalletActivate] ✅ Operación completada - listo para nueva operación');
  }
};

function createActivateWalletModal() {
  const modal = document.createElement('div');
  modal.className = 'modern-modal';
  modal.id = 'confirmActivateWalletModal';
  modal.innerHTML = `
    <div class="modern-modal-backdrop" onclick="closeConfirmActivateWalletModal()"></div>
    <div class="modern-modal-card">
      <div class="modern-modal-header">
        <div class="modern-modal-icon success">
          <i class="bx bx-check-circle"></i>
        </div>
        <h3>¿Activar esta wallet?</h3>
        <button class="modern-modal-close" onclick="closeConfirmActivateWalletModal()">
          <i class="bx bx-x"></i>
        </button>
      </div>

      <div class="modern-modal-body">
        <p>Estás a punto de activar el acceso a esta wallet para el usuario.</p>
        <div class="modern-modal-highlight success">
          <span class="modern-modal-detail">
            El usuario volverá a tener acceso a esta moneda.
          </span>
        </div>
        <p class="modern-modal-warning">
          <i class="bx bx-info-circle"></i>
          Una vez activada, el usuario podrá usar esta wallet normalmente.
        </p>
      </div>

      <div class="modern-modal-footer">
        <button class="modern-btn secondary" onclick="closeConfirmActivateWalletModal()">
          Cancelar
        </button>
        <button class="modern-btn success" id="confirmActivateWalletBtn" onclick="executeActivateWallet()">
          <i class="bx bx-check-circle"></i>
          Activar Wallet
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  return modal;
}

/**
 * Modal de éxito
 */
window.showSuccessMessage = function(title, message) {
  document.getElementById('successTitle').textContent = title;
  document.getElementById('successMessage').textContent = message;

  const modal = document.getElementById('successModal');
  modal.classList.add('active');

  // Auto-cerrar después de 3 segundos
  setTimeout(() => {
    closeSuccessModal();
  }, 3000);

  // ✅ Resetear botón de BLOQUEO después de mostrar éxito
  const confirmBlockBtn = document.querySelector('.modern-modal#confirmBlockWalletModal [id="confirmBlockWalletBtn"]');
  if (confirmBlockBtn) {
    confirmBlockBtn.disabled = false;
    confirmBlockBtn.innerHTML = '<i class="bx bx-lock"></i> Bloquear Wallet';
  }

  // ✅ Resetear botón de ACTIVACIÓN después de mostrar éxito
  const confirmActivateBtn = document.querySelector('.modern-modal#confirmActivateWalletModal [id="confirmActivateWalletBtn"]');
  if (confirmActivateBtn) {
    confirmActivateBtn.disabled = false;
    confirmActivateBtn.innerHTML = '<i class="bx bx-check-circle"></i> Activar Wallet';
  }
};

window.closeSuccessModal = function() {
  const modal = document.getElementById('successModal');
  modal.classList.remove('active');
};

/**
 * Modal de error
 */
window.showErrorMessage = function(title, message) {
  document.getElementById('errorMessage').textContent = message;
  
  const modal = document.getElementById('errorModal');
  modal.classList.add('active');
};

window.closeErrorModal = function() {
  const modal = document.getElementById('errorModal');
  modal.classList.remove('active');

  // ✅ Permitir nueva operación si se cierra el modal de error
  isBlockWalletOperationInProgress = false;
};

/**
 * Modal de loading
 */
window.showLoadingModal = function(message = 'Procesando...') {
  document.getElementById('loadingMessage').textContent = message;
  const modal = document.getElementById('loadingModal');
  modal.classList.add('active');
};

window.closeLoadingModal = function() {
  const modal = document.getElementById('loadingModal');
  modal.classList.remove('active');
};

// ============================================
// FUNCIONES DE REFRESH
// ============================================

/**
 * Refresh general del dashboard
 */
window.refreshDashboard = async function() {
  const btn = document.querySelector('[data-refresh="dashboard"]');
  if (!btn) return;

  btn.classList.add('loading');
  btn.disabled = true;

  try {
    await loadDashboardData();
    showSuccessMessage('Dashboard actualizado', 'Los datos se actualizaron correctamente.');
  } catch (error) {
    console.error('[Refresh] Error:', error);
    showErrorMessage('Error', 'No se pudo actualizar el dashboard');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
};

/**
 * Refresh de usuarios
 */
window.refreshUsers = async function() {
  const btn = document.querySelector('[data-refresh="users"]');
  if (!btn) return;

  btn.classList.add('loading');
  btn.disabled = true;

  try {
    await loadUsers();
    showSuccessMessage('Usuarios actualizados', 'La lista de usuarios se actualizó correctamente.');
  } catch (error) {
    console.error('[Refresh] Error:', error);
    showErrorMessage('Error', 'No se pudo actualizar los usuarios');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
};

/**
 * Refresh de transacciones
 */
window.refreshTransactions = async function() {
  const btn = document.querySelector('[data-refresh="transactions"]');
  if (!btn) return;

  btn.classList.add('loading');
  btn.disabled = true;

  try {
    await loadTransactions();
    showSuccessMessage('Transacciones actualizadas', 'La lista de transacciones se actualizó correctamente.');
  } catch (error) {
    console.error('[Refresh] Error:', error);
    showErrorMessage('Error', 'No se pudo actualizar las transacciones');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
};

/**
 * Refresh de solicitudes de pago
 */
window.refreshPayments = async function() {
  const btn = document.querySelector('[data-refresh="payments"]');
  if (!btn) return;

  btn.classList.add('loading');
  btn.disabled = true;

  try {
    await loadPaymentRequests();
    showSuccessMessage('Pagos actualizados', 'Las solicitudes se actualizaron correctamente.');
  } catch (error) {
    console.error('[Refresh] Error:', error);
    showErrorMessage('Error', 'No se pudo actualizar los pagos');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
};

// ============================================
// FUNCIONES DE PAGINACIÓN
// ============================================

/**
 * Renderizar controles de paginación
 */
function renderPagination(pagination, containerId, renderFunction) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const info = pagination.getPageInfo();
  
  let html = '<div class="modern-pagination">';
  
  // Botón anterior
  html += `
    <button 
      class="modern-pagination-btn" 
      ${info.currentPage === 1 ? 'disabled' : ''}
      onclick="changePage('${containerId}', ${info.currentPage - 1})"
    >
      <i class="bx bx-chevron-left"></i>
    </button>
  `;

  // Páginas
  const maxButtons = 5;
  let startPage = Math.max(1, info.currentPage - Math.floor(maxButtons / 2));
  let endPage = Math.min(info.totalPages, startPage + maxButtons - 1);

  if (endPage - startPage + 1 < maxButtons) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  if (startPage > 1) {
    html += `
      <button class="modern-pagination-btn" onclick="changePage('${containerId}', 1)">
        1
      </button>
    `;
    if (startPage > 2) {
      html += '<span class="modern-pagination-info">...</span>';
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `
      <button 
        class="modern-pagination-btn ${i === info.currentPage ? 'active' : ''}"
        onclick="changePage('${containerId}', ${i})"
      >
        ${i}
      </button>
    `;
  }

  if (endPage < info.totalPages) {
    if (endPage < info.totalPages - 1) {
      html += '<span class="modern-pagination-info">...</span>';
    }
    html += `
      <button class="modern-pagination-btn" onclick="changePage('${containerId}', ${info.totalPages})">
        ${info.totalPages}
      </button>
    `;
  }

  // Botón siguiente
  html += `
    <button 
      class="modern-pagination-btn"
      ${info.currentPage === info.totalPages ? 'disabled' : ''}
      onclick="changePage('${containerId}', ${info.currentPage + 1})"
    >
      <i class="bx bx-chevron-right"></i>
    </button>
  `;

  // Info
  html += `
    <span class="modern-pagination-info">
      ${info.start}-${info.end} de ${info.totalItems}
    </span>
  `;

  html += '</div>';

  container.innerHTML = html;

  // Renderizar items de la página actual
  renderFunction(pagination.getCurrentItems());
}

/**
 * Cambiar página
 */
window.changePage = function(paginationType, page) {
  if (paginationType === 'users-pagination') {
    if (usersPagination) {
      usersPagination.goToPage(page);
      renderPagination(usersPagination, 'users-pagination', paintUsersTable);
    }
  } else if (paginationType === 'transactions-pagination') {
    if (transactionsPagination) {
      transactionsPagination.goToPage(page);
      renderPagination(transactionsPagination, 'transactions-pagination', paintTransactionsTable);
    }
  } else if (paginationType === 'payments-pagination') {
    if (paymentsPagination) {
      paymentsPagination.goToPage(page);
      renderPagination(paymentsPagination, 'payments-pagination', paintPaymentsTable);
    }
  }
};

// ============================================
// INTEGRACIÓN CON FUNCIONES EXISTENTES
// ============================================

/**
 * Modificar función approvePayment para usar modal
 */
async function approvePayment(paymentId) {
  const session = getSession();

  const response = await fetch(`${API_BASE}/payment-requests/${paymentId}/approve`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.token}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Error aprobando solicitud');
  }

  // Actualizar badge del sidebar
  if (window.sidebarBadge) {
    await window.sidebarBadge.refresh();
  }

  return data;
}

// Exportar para uso global
window.Pagination = Pagination;
window.usersPagination = usersPagination;
window.transactionsPagination = transactionsPagination;
window.paymentsPagination = paymentsPagination;

// ===================================
// MODAL DE DETALLES DE TRANSFERENCIA
// ===================================
window.showPaymentDetailsModal = function(paymentId) {
  console.log('[AdminPanel] 🔔 showPaymentDetailsModal llamado con:', paymentId);

  (async () => {
    try {
      // 1. Buscar en cache primero
      let payment = allPaymentRequests.find(p => p.id === paymentId);
      console.log('[AdminPanel] 📦 Payment del cache:', payment ? 'ENCONTRADO' : 'NO ENCONTRADO');

      // 2. Si no está en cache o no tiene estructura completa, obtener del servidor
      if (!payment || !payment.fromUser) {
        console.log('[AdminPanel] 🌐 Obteniendo detalles del servidor...');
        const session = getSession();
        const response = await fetch(`${API_BASE}/payment-requests/${paymentId}`, {
          headers: {
            'Authorization': `Bearer ${session.token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Error cargando detalles');
        }

        const data = await response.json();
        payment = data.data;
        console.log('[AdminPanel] ✅ Detalles de pago obtenidos:', payment);
      }

      if (!payment) {
        showError('Solicitud no encontrada');
        return;
      }

      // Validar que tenga los datos necesarios
      if (!payment.fromUser || !payment.toUser) {
        console.warn('[AdminPanel] ⚠️ Estructura incompleta, usando valores por defecto');
        payment.fromUser = payment.fromUser || { email: 'N/A', username: 'N/A' };
        payment.toUser = payment.toUser || { email: 'N/A', username: 'N/A' };
      }

      // Obtener IDs de wallet de múltiples ubicaciones posibles
      const getWalletId = (payment, user) => {
        if (!payment && !user) return 'N/A';

        // Buscar en payment
        const fromPayment = payment?.fromWalletId ||
                          payment?.fromWallet?.id ||
                          payment?.walletFromId ||
                          payment?.from_wallet_id;

        if (fromPayment) return fromPayment;

        // Buscar en user (wallet por defecto)
        if (user?.wallets && Array.isArray(user.wallets) && user.wallets.length > 0) {
          return user.wallets[0].id || 'N/A';
        }

        return 'N/A';
      };

      const getToWalletId = (payment, user) => {
        if (!payment && !user) return 'N/A';

        // Buscar en payment
        const toPayment = payment?.toWalletId ||
                         payment?.toWallet?.id ||
                         payment?.walletToId ||
                         payment?.to_wallet_id;

        if (toPayment) return toPayment;

        // Buscar en user (wallet por defecto)
        if (user?.wallets && Array.isArray(user.wallets) && user.wallets.length > 0) {
          return user.wallets[0].id || 'N/A';
        }

        return 'N/A';
      };

      const fromWalletId = getWalletId(payment, payment.fromUser);
      const toWalletId = getToWalletId(payment, payment.toUser);

      console.log('[AdminPanel] 💼 Wallet IDs encontrados:', { fromWalletId, toWalletId });

      // Crear modal HTML
  const modalHTML = `
    <div class="admin-payment-modal-overlay" id="paymentDetailsOverlay" onclick="if(event.target.id === 'paymentDetailsOverlay') closePaymentDetailsModal()">
      <div class="admin-payment-modal">
        <!-- Header -->
        <div class="admin-payment-modal-header">
          <h2>Detalles de la Transferencia</h2>
          <button class="admin-modal-close" onclick="closePaymentDetailsModal()">
            <i class="bx bx-x"></i>
          </button>
        </div>

        <!-- Body -->
        <div class="admin-payment-modal-body">
          <!-- Monto destacado -->
          <div class="admin-payment-highlight">
            <div class="admin-payment-amount">
              <span class="admin-payment-amount-label">Monto</span>
              <span class="admin-payment-amount-value">${formatMoney(payment.amount || 0)} ${payment.fromCurrency || 'USD'}</span>
            </div>
            <div class="admin-payment-status">
              <span class="admin-badge-pill admin-payment-${payment.status}">
                ${getPaymentStatusLabel(payment.status)}
              </span>
            </div>
          </div>

          <!-- From - To -->
          <div class="admin-payment-transfer">
            <div class="admin-payment-user">
              <h4>De (Emisor)</h4>
              <p class="admin-payment-email">${payment.fromUser.email}</p>
              <p class="admin-payment-username">${payment.fromUser.username || 'N/A'}</p>
              <p class="admin-payment-wallet-id">Wallet: ${fromWalletId !== 'N/A' ? fromWalletId.substring(0, 16) + '...' : 'N/A'}</p>
            </div>

            <div class="admin-payment-arrow">
              <i class="bx bx-right-arrow-alt"></i>
            </div>

            <div class="admin-payment-user">
              <h4>Para (Receptor)</h4>
              <p class="admin-payment-email">${payment.toUser.email}</p>
              <p class="admin-payment-username">${payment.toUser.username || 'N/A'}</p>
              <p class="admin-payment-wallet-id">Wallet: ${toWalletId !== 'N/A' ? toWalletId.substring(0, 16) + '...' : 'N/A'}</p>
            </div>
          </div>

          <!-- Desglose -->
          <div class="admin-payment-breakdown">
            <h4>Desglose de Monto</h4>
            <div class="admin-payment-breakdown-row">
              <span>Monto Principal:</span>
              <span>${formatMoney(payment.amount || 0)} ${payment.fromCurrency || 'USD'}</span>
            </div>
            <div class="admin-payment-breakdown-row">
              <span>Comisión:</span>
              <span>${formatMoney(payment.commission || 0)} ${payment.fromCurrency || 'USD'}</span>
            </div>
            <div class="admin-payment-breakdown-row admin-payment-breakdown-total">
              <span>Total a Debitar:</span>
              <span>${formatMoney((payment.amount || 0) + (payment.commission || 0))} ${payment.fromCurrency || 'USD'}</span>
            </div>
          </div>

          <!-- Conversión si aplica -->
          ${payment.convertedAmount && payment.convertedAmount !== payment.amount ? `
            <div class="admin-payment-conversion">
              <h4>Conversión de Moneda</h4>
              <div class="admin-payment-conversion-row">
                <span>Tipo de Cambio:</span>
                <span>1 ${payment.fromCurrency} = ${(payment.exchangeRate || 1).toFixed(4)} ${payment.toCurrency}</span>
              </div>
              <div class="admin-payment-conversion-row">
                <span>Monto a Recibir:</span>
                <span>${formatMoney(payment.convertedAmount)} ${payment.toCurrency}</span>
              </div>
            </div>
          ` : ''}

          <!-- Info de transacción -->
          <div class="admin-payment-info">
            <h4>Información de la Transacción</h4>
            <div class="admin-payment-info-row">
              <span class="admin-payment-info-label">ID:</span>
              <span class="admin-payment-info-value">${payment.id}</span>
            </div>
            <div class="admin-payment-info-row">
              <span class="admin-payment-info-label">Descripción:</span>
              <span class="admin-payment-info-value">${payment.description || 'N/A'}</span>
            </div>
            <div class="admin-payment-info-row">
              <span class="admin-payment-info-label">Creada:</span>
              <span class="admin-payment-info-value">${formatDate(payment.createdAt)}</span>
            </div>
            ${payment.approvedAt ? `
              <div class="admin-payment-info-row">
                <span class="admin-payment-info-label">Aprobada:</span>
                <span class="admin-payment-info-value">${formatDate(payment.approvedAt)}</span>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Footer -->
        <div class="admin-payment-modal-footer">
          <button class="admin-btn admin-btn-secondary" onclick="closePaymentDetailsModal()">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  `;

  // Insertar modal en el DOM
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // Agregar estilos si no existen
  if (!document.getElementById('paymentDetailsModalStyles')) {
    const style = document.createElement('style');
    style.id = 'paymentDetailsModalStyles';
    style.textContent = `
      .admin-payment-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        animation: fadeIn 0.3s ease-out;
      }

      .admin-payment-modal {
        background: white;
        border-radius: 16px;
        width: 90%;
        max-width: 600px;
        max-height: 85vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.3s ease-out;
      }

      .admin-payment-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 24px;
        border-bottom: 1px solid #ecf0f1;
      }

      .admin-payment-modal-header h2 {
        margin: 0;
        font-size: 20px;
        color: #2c3e50;
      }

      .admin-modal-close {
        background: none;
        border: none;
        font-size: 24px;
        color: #6b7280;
        cursor: pointer;
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        transition: all 0.2s;
      }

      .admin-modal-close:hover {
        background: #f3f4f6;
        color: #2c3e50;
      }

      .admin-payment-modal-body {
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      .admin-payment-highlight {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 20px;
        border-radius: 12px;
        color: white;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .admin-payment-amount-label {
        display: block;
        font-size: 12px;
        opacity: 0.9;
        margin-bottom: 8px;
      }

      .admin-payment-amount-value {
        display: block;
        font-size: 28px;
        font-weight: 700;
      }

      .admin-payment-transfer {
        display: flex;
        align-items: center;
        gap: 16px;
        justify-content: space-between;
      }

      .admin-payment-user {
        flex: 1;
        background: #f8f9fa;
        padding: 16px;
        border-radius: 12px;
        text-align: center;
      }

      .admin-payment-user h4 {
        margin: 0 0 12px 0;
        font-size: 14px;
        color: #6b7280;
        text-transform: uppercase;
        font-weight: 600;
      }

      .admin-payment-email {
        margin: 0 0 4px 0;
        font-size: 14px;
        font-weight: 600;
        color: #2c3e50;
      }

      .admin-payment-username {
        margin: 0 0 8px 0;
        font-size: 13px;
        color: #6b7280;
      }

      .admin-payment-wallet-id {
        margin: 0;
        font-size: 11px;
        color: #95a5a6;
        font-family: monospace;
        word-break: break-all;
      }

      .admin-payment-arrow {
        color: #667eea;
        font-size: 24px;
      }

      .admin-payment-breakdown {
        background: #f8f9fa;
        padding: 16px;
        border-radius: 12px;
      }

      .admin-payment-breakdown h4 {
        margin: 0 0 12px 0;
        font-size: 14px;
        color: #2c3e50;
        font-weight: 600;
      }

      .admin-payment-breakdown-row {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid #ecf0f1;
        font-size: 14px;
      }

      .admin-payment-breakdown-row:last-child {
        border-bottom: none;
      }

      .admin-payment-breakdown-total {
        font-weight: 600;
        color: #667eea;
        padding-top: 12px;
        margin-top: 12px;
        border-top: 2px solid #ecf0f1;
      }

      .admin-payment-conversion {
        background: #e8f5e9;
        padding: 16px;
        border-radius: 12px;
        border-left: 4px solid #4caf50;
      }

      .admin-payment-conversion h4 {
        margin: 0 0 12px 0;
        font-size: 14px;
        color: #2e7d32;
        font-weight: 600;
      }

      .admin-payment-conversion-row {
        display: flex;
        justify-content: space-between;
        padding: 6px 0;
        font-size: 13px;
        color: #1b5e20;
      }

      .admin-payment-info {
        background: #f5f5f5;
        padding: 16px;
        border-radius: 12px;
      }

      .admin-payment-info h4 {
        margin: 0 0 12px 0;
        font-size: 14px;
        color: #2c3e50;
        font-weight: 600;
      }

      .admin-payment-info-row {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid #ecf0f1;
        font-size: 13px;
      }

      .admin-payment-info-row:last-child {
        border-bottom: none;
      }

      .admin-payment-info-label {
        color: #6b7280;
        font-weight: 500;
      }

      .admin-payment-info-value {
        color: #2c3e50;
        word-break: break-all;
        text-align: right;
        max-width: 300px;
      }

      .admin-payment-modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding: 16px 24px;
        border-top: 1px solid #ecf0f1;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes slideUp {
        from { transform: translateY(30px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

    } catch (error) {
      console.error('[AdminPanel] ❌ Error en showPaymentDetailsModal:', error);
      showError('Error cargando detalles de la transferencia');
    }
  })();
};

window.closePaymentDetailsModal = function() {
  const overlay = document.getElementById('paymentDetailsOverlay');
  if (overlay) {
    overlay.style.animation = 'fadeOut 0.2s ease-out';
    setTimeout(() => overlay.remove(), 200);
  }
};

// Hacer sidebarBadge accesible globalmente
window.sidebarBadge = sidebarBadge;