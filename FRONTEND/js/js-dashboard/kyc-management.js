import { getSession } from '../auth/session.js';
import { guardPage, startSessionMonitor } from '../auth/session-guard.js';
import { API_CONFIG } from '../config/api.config.js';

const API_BASE = `${API_CONFIG.API_ENDPOINT}/kyc-management`;

let currentPage = 1;
let currentLimit = 50;
let currentStatus = "all";
let currentSearch = "";
let totalUsers = 0;

document.addEventListener('DOMContentLoaded', async () => {
  // 🛡️ Proteger página contra sesiones inválidas
  if (!guardPage()) {
    return;
  }

  const session = getSession();

  // ✅ Verificar que el usuario tenga rol fluxiDocs
  if (session.user.role !== 'fluxiDocs') {
    alert('No tienes permisos para acceder a esta sección');
    window.location.href = './dashboard.html';
    return;
  }

  // 👁️ Iniciar monitor de sesión
  startSessionMonitor();

  // Mostrar nombre del usuario
  document.querySelectorAll('[data-user-name]').forEach(el => {
    el.textContent = session.user.username || 'Inspector';
  });

  // Cargar datos iniciales
  await loadStats();
  await loadUsers();

  // Eventos
  bindEvents();
});

/* =========================================
   CARGAR ESTADÍSTICAS
========================================= */
async function loadStats() {
  try {
    const stats = await fetchStats();

    const pendingEl = document.querySelector('[data-stat-pending]');
    const approvedEl = document.querySelector('[data-stat-approved]');
    const rejectedEl = document.querySelector('[data-stat-rejected]');
    const inProgressEl = document.querySelector('[data-stat-in-progress]');

    if (pendingEl) pendingEl.textContent = stats.pending || 0;
    if (approvedEl) approvedEl.textContent = stats.approved || 0;
    if (rejectedEl) rejectedEl.textContent = stats.rejected || 0;
    if (inProgressEl) inProgressEl.textContent = stats.in_progress || 0;

    console.log(`📊 KYC Stats: ${stats.pending} pending, ${stats.approved} approved, ${stats.rejected} rejected, ${stats.in_progress} in progress`);

  } catch (err) {
    console.error('❌ Error cargando estadísticas:', err);
  }
}

async function fetchStats() {
  // Obtener conteo de cada estado
  const [pending, approved, rejected, inProgress] = await Promise.all([
    fetchUsers({ status: 'pending', limit: 1 }),
    fetchUsers({ status: 'approved', limit: 1 }),
    fetchUsers({ status: 'rejected', limit: 1 }),
    fetchUsers({ status: 'in_progress', limit: 1 })
  ]);
  
  return {
    pending: pending.total,
    approved: approved.total,
    rejected: rejected.total,
    in_progress: inProgress.total
  };
}

/* =========================================
   CARGAR USUARIOS
========================================= */
async function loadUsers() {
  const tbody = document.getElementById('usersTableBody');
  
  // Mostrar loader
  tbody.innerHTML = `
    <tr class="kyc-loading-row">
      <td colspan="7" style="text-align: center; padding: 40px;">
        <div class="kyc-loader"></div>
        <p style="margin-top: 16px; color: #7f8c8d;">Cargando usuarios...</p>
      </td>
    </tr>
  `;
  
  try {
    const offset = (currentPage - 1) * currentLimit;
    const data = await fetchUsers({
      status: currentStatus,
      search: currentSearch,
      limit: currentLimit,
      offset: offset
    });
    
    totalUsers = data.total;
    
    if (data.users.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 40px; color: #7f8c8d;">
            <i class='bx bx-inbox' style="font-size: 48px; display: block; margin-bottom: 12px;"></i>
            No se encontraron usuarios
          </td>
        </tr>
      `;
      updatePagination();
      return;
    }
    
    tbody.innerHTML = data.users.map(user => renderUserRow(user)).join('');
    updatePagination();
    
    // Bind eventos de botones
    bindActionButtons();
    
  } catch (err) {
    console.error('Error cargando usuarios:', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px; color: #e74c3c;">
          <i class='bx bx-error' style="font-size: 48px; display: block; margin-bottom: 12px;"></i>
          Error cargando usuarios. Por favor intenta nuevamente.
        </td>
      </tr>
    `;
  }
}

async function fetchUsers(params = {}) {
  const session = getSession();

  const queryParams = new URLSearchParams({
    status: params.status || 'all',
    limit: params.limit || currentLimit,
    offset: params.offset || 0
  });

  if (params.search) {
    queryParams.append('search', params.search);
  }

  try {
    const res = await fetch(`${API_BASE}/users?${queryParams}`, {
      headers: {
        Authorization: `Bearer ${session.token}`
      }
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.detail || errorData.error || 'FETCH_USERS_FAILED');
    }

    const data = await res.json();
    console.log(`✅ Fetched ${data.users?.length || 0} users (status: ${params.status})`);
    return data;
  } catch (err) {
    console.error(`❌ fetchUsers error:`, err);
    throw err;
  }
}

/* =========================================
   RENDERIZAR FILA DE USUARIO
========================================= */
function renderUserRow(user) {
  const fullName = user.first_name && user.last_name 
    ? `${user.first_name} ${user.last_name}` 
    : 'Sin nombre';
  
  const companyName = user.legal_name || user.trade_name || 'Sin empresa';
  const taxId = user.tax_id || '-';
  
  const docCount = user.total_documents || 0;
  const pendingDocs = user.pending_documents || 0;
  const docClass = pendingDocs > 0 ? 'kyc-has-pending' : '';
  
  const statusBadge = getStatusBadge(user.kyc_status);
  const stepBadge = user.current_step || '-';
  
  const createdDate = formatDate(user.created_at);
  
  const canApprove = user.kyc_status === 'pending';
  const canReject = ['pending', 'in_progress'].includes(user.kyc_status);
  
  return `
    <tr data-user-id="${user.id}">
      <td>
        <div class="kyc-user-info">
          <span class="kyc-user-name">${fullName}</span>
          <span class="kyc-user-email">${user.email}</span>
        </div>
      </td>
      <td>
        <div class="kyc-company-info">
          <span class="kyc-company-name">${companyName}</span>
          <span class="kyc-company-tax">${taxId}</span>
        </div>
      </td>
      <td>
        <div class="kyc-doc-count ${docClass}">
          <i class='bx bx-file'></i>
          <span>${docCount} (${pendingDocs} pendientes)</span>
        </div>
      </td>
      <td>
        <span class="kyc-status-badge kyc-status-${user.kyc_status}">${statusBadge}</span>
      </td>
      <td>
        <span class="kyc-step-badge">${stepBadge}</span>
      </td>
      <td>
        <span class="kyc-date-text">${createdDate}</span>
      </td>
      <td>
        <div class="kyc-action-buttons">
          <button class="kyc-btn-action kyc-btn-view" data-action="view" data-user-id="${user.id}">
            <i class='bx bx-show'></i> Ver
          </button>
          ${canApprove ? `
            <button class="kyc-btn-action kyc-btn-approve" data-action="approve" data-user-id="${user.id}">
              <i class='bx bx-check'></i> Aprobar
            </button>
          ` : ''}
          ${canReject ? `
            <button class="kyc-btn-action kyc-btn-reject" data-action="reject" data-user-id="${user.id}">
              <i class='bx bx-x'></i> Rechazar
            </button>
          ` : ''}
        </div>
      </td>
    </tr>
  `;
}

function getStatusBadge(status) {
  const statusMap = {
    'pending': 'Pendiente',
    'approved': 'Aprobado',
    'rejected': 'Rechazado',
    'in_progress': 'En proceso',
    'not_started': 'Sin iniciar'
  };
  
  return statusMap[status] || status;
}

function formatDate(timestamp) {
  if (!timestamp) return '-';
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/* =========================================
   PAGINACIÓN
========================================= */
function updatePagination() {
  const totalPages = Math.ceil(totalUsers / currentLimit);
  
  document.getElementById('pageInfo').textContent = 
    `Página ${currentPage} de ${totalPages}`;
  
  document.getElementById('prevBtn').disabled = currentPage === 1;
  document.getElementById('nextBtn').disabled = currentPage >= totalPages;
}

/* =========================================
   EVENTOS
========================================= */
function bindEvents() {
  // Búsqueda
  const searchInput = document.getElementById('searchInput');
  let searchTimeout;
  
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentSearch = e.target.value.trim();
      currentPage = 1;
      loadUsers();
    }, 500);
  });
  
  // Filtro de estado
  document.getElementById('statusFilter').addEventListener('change', (e) => {
    currentStatus = e.target.value;
    currentPage = 1;
    loadUsers();
    loadStats();
  });
  
  // Refresh
  document.getElementById('refreshBtn').addEventListener('click', () => {
    loadStats();
    loadUsers();
  });
  
  // Paginación
  document.getElementById('prevBtn').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      loadUsers();
    }
  });
  
  document.getElementById('nextBtn').addEventListener('click', () => {
    const totalPages = Math.ceil(totalUsers / currentLimit);
    if (currentPage < totalPages) {
      currentPage++;
      loadUsers();
    }
  });
  
  // Cerrar modal
  document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('userDetailModal').classList.add('kyc-hidden');
  });
  
  // Cerrar modal al hacer click fuera
  document.getElementById('userDetailModal').addEventListener('click', (e) => {
    if (e.target.id === 'userDetailModal') {
      document.getElementById('userDetailModal').classList.add('kyc-hidden');
    }
  });
}

function bindActionButtons() {
  document.querySelectorAll('.kyc-btn-action').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const action = btn.dataset.action;
      const userId = btn.dataset.userId;
      
      switch (action) {
        case 'view':
          await viewUserDetail(userId);
          break;
        case 'approve':
          await approveUser(userId);
          break;
        case 'reject':
          await rejectUser(userId);
          break;
      }
    });
  });
}

/* =========================================
   ACCIONES
========================================= */
async function viewUserDetail(userId) {
  const modal = document.getElementById('userDetailModal');
  const modalBody = document.getElementById('modalBody');
  
  modalBody.innerHTML = `
    <div style="text-align: center; padding: 40px;">
      <div class="kyc-loader"></div>
      <p style="margin-top: 16px; color: #7f8c8d;">Cargando información...</p>
    </div>
  `;
  
  modal.classList.remove('kyc-hidden');
  
  try {
    const session = getSession();
    const res = await fetch(`${API_BASE}/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${session.token}`
      }
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.detail || errorData.error || 'FETCH_USER_DETAIL_FAILED');
    }

    const data = await res.json();
    console.log(`✅ Loaded user detail for ${userId}`);
    modalBody.innerHTML = renderUserDetail(data);

    // Bind eventos de documentos
    bindDocumentActions();

  } catch (err) {
    console.error(`❌ Error cargando detalle de usuario ${userId}:`, err);
    modalBody.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #e74c3c;">
        <i class='bx bx-error' style="font-size: 48px; display: block; margin-bottom: 12px;"></i>
        Error cargando información del usuario: ${err.message}
      </div>
    `;
  }
}

function renderUserDetail(data) {
  const { user, personal, company, kycStatus, documents } = data;

  return `
    <div style="display: grid; gap: 24px;" data-user-id="${user.id}">
      
      <!-- INFORMACIÓN BÁSICA -->
      <div class="kyc-detail-section">
        <h4><i class='bx bx-user'></i> Información básica</h4>
        <div class="kyc-detail-grid">
          <div class="kyc-detail-field">
            <span class="kyc-detail-field-label">Email</span>
            <span class="kyc-detail-field-value">${user.email}</span>
          </div>
          <div class="kyc-detail-field">
            <span class="kyc-detail-field-label">Usuario</span>
            <span class="kyc-detail-field-value">${user.username || '-'}</span>
          </div>
          <div class="kyc-detail-field">
            <span class="kyc-detail-field-label">Estado KYC</span>
            <span class="kyc-status-badge kyc-status-${user.kyc_status}">${getStatusBadge(user.kyc_status)}</span>
          </div>
          <div class="kyc-detail-field">
            <span class="kyc-detail-field-label">Paso actual</span>
            <span class="kyc-detail-field-value">${kycStatus?.current_step || '-'}</span>
          </div>
        </div>
      </div>
      
      <!-- INFORMACIÓN PERSONAL -->
      ${personal ? `
        <div class="kyc-detail-section">
          <h4><i class='bx bx-id-card'></i> Datos personales</h4>
          <div class="kyc-detail-grid">
            <div class="kyc-detail-field">
              <span class="kyc-detail-field-label">Nombre completo</span>
              <span class="kyc-detail-field-value">${personal.first_name} ${personal.last_name}</span>
            </div>
            <div class="kyc-detail-field">
              <span class="kyc-detail-field-label">Documento</span>
              <span class="kyc-detail-field-value">${personal.document_type}: ${personal.document_number}</span>
            </div>
            <div class="kyc-detail-field">
              <span class="kyc-detail-field-label">Teléfono</span>
              <span class="kyc-detail-field-value">${personal.country_code} ${personal.phone}</span>
            </div>
            <div class="kyc-detail-field">
              <span class="kyc-detail-field-label">País</span>
              <span class="kyc-detail-field-value">${personal.country}</span>
            </div>
            <div class="kyc-detail-field">
              <span class="kyc-detail-field-label">Cargo</span>
              <span class="kyc-detail-field-value">${personal.role_in_company}</span>
            </div>
            <div class="kyc-detail-field">
              <span class="kyc-detail-field-label">Posición</span>
              <span class="kyc-detail-field-value">${personal.position_in_company}</span>
            </div>
          </div>
        </div>
      ` : '<p class="kyc-detail-empty">Sin datos personales registrados</p>'}
      
      <!-- INFORMACIÓN DE EMPRESA -->
      ${company ? `
        <div class="kyc-detail-section">
          <h4><i class='bx bx-buildings'></i> Datos de la empresa</h4>
          <div class="kyc-detail-grid">
            <div class="kyc-detail-field">
              <span class="kyc-detail-field-label">Razón social</span>
              <span class="kyc-detail-field-value">${company.legal_name}</span>
            </div>
            <div class="kyc-detail-field">
              <span class="kyc-detail-field-label">Nombre comercial</span>
              <span class="kyc-detail-field-value">${company.trade_name || '-'}</span>
            </div>
            <div class="kyc-detail-field">
              <span class="kyc-detail-field-label">NIT/RUT</span>
              <span class="kyc-detail-field-value">${company.tax_id_type}: ${company.tax_id}</span>
            </div>
            <div class="kyc-detail-field">
              <span class="kyc-detail-field-label">País</span>
              <span class="kyc-detail-field-value">${company.incorporation_country}</span>
            </div>
            <div class="kyc-detail-field">
              <span class="kyc-detail-field-label">Actividad económica</span>
              <span class="kyc-detail-field-value">${company.economic_activity}</span>
            </div>
            <div class="kyc-detail-field">
              <span class="kyc-detail-field-label">Email corporativo</span>
              <span class="kyc-detail-field-value">${company.corporate_email}</span>
            </div>
          </div>
        </div>
      ` : '<p class="kyc-detail-empty">Sin datos de empresa registrados</p>'}
      
      <!-- DOCUMENTOS -->
      <div class="kyc-detail-section">
        <h4><i class='bx bx-file'></i> Documentos subidos (${documents.length})</h4>
        ${documents.length > 0 ? `
          <div class="kyc-document-list">
            ${documents.map(doc => `
              <div class="kyc-document-item">
                <div class="kyc-document-info">
                  <span class="kyc-document-name">${doc.document_type_name}</span>
                  <div class="kyc-document-meta">
                    ${doc.file_name} • ${formatFileSize(doc.file_size)}
                  </div>
                  <span class="kyc-status-badge kyc-status-${doc.status}" style="margin-top: 8px; display: inline-block;">
                    ${getStatusBadge(doc.status)}
                  </span>
                  ${doc.rejection_reason ? `
                    <div class="kyc-document-rejection">
                      <strong>Razón de rechazo:</strong> ${doc.rejection_reason}
                    </div>
                  ` : ''}
                </div>
                <div class="kyc-document-actions">
                  <a href="${doc.file_url}" target="_blank" class="kyc-btn-link">
                    <i class='bx bx-link-external'></i> Ver
                  </a>
                  ${doc.status === 'pending' ? `
                    <button class="kyc-btn-action kyc-btn-approve" data-action="approve-doc" data-doc-id="${doc.id}">
                      <i class='bx bx-check'></i> Aprobar
                    </button>
                    <button class="kyc-btn-action kyc-btn-reject" data-action="reject-doc" data-doc-id="${doc.id}">
                      <i class='bx bx-x'></i> Rechazar
                    </button>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        ` : '<p class="kyc-detail-empty">No hay documentos subidos</p>'}
      </div>
      
      <!-- ACCIONES GLOBALES -->
      ${user.kyc_status === 'pending' ? `
        <div class="kyc-modal-footer">
          <button class="kyc-btn-action-large kyc-btn-approve" data-action="approve-kyc" data-user-id="${user.id}">
            <i class='bx bx-check-circle'></i> Aprobar KYC completo
          </button>
          <button class="kyc-btn-action-large kyc-btn-reject" data-action="reject-kyc" data-user-id="${user.id}">
            <i class='bx bx-x-circle'></i> Rechazar KYC
          </button>
        </div>
      ` : ''}
      
    </div>
  `;
}

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function bindDocumentActions() {
  document.querySelectorAll('[data-action^="approve-doc"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const docId = btn.dataset.docId;
      await approveDocument(docId);
    });
  });
  
  document.querySelectorAll('[data-action^="reject-doc"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const docId = btn.dataset.docId;
      await rejectDocument(docId);
    });
  });
  
  document.querySelectorAll('[data-action="approve-kyc"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const userId = btn.dataset.userId;
      await approveUser(userId);
    });
  });
  
  document.querySelectorAll('[data-action="reject-kyc"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const userId = btn.dataset.userId;
      await rejectUser(userId);
    });
  });
}

async function approveDocument(docId) {
  if (!confirm('¿Aprobar este documento?')) return;

  try {
    const session = getSession();
    const res = await fetch(`${API_BASE}/documents/${docId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`
      },
      body: JSON.stringify({ status: 'approved' })
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('❌ Document approve response not ok:', res.status, data);
      throw new Error(data?.detail || 'APPROVE_DOC_FAILED');
    }

    console.log('✅ Document approve response OK:', data);
    alert('✅ Documento aprobado');

    // Esperar antes de recargar
    await new Promise(resolve => setTimeout(resolve, 300));

    // Recargar modal - buscar userId desde el contenedor principal
    const modalBody = document.getElementById('modalBody');
    const userIdEl = modalBody?.querySelector('[data-user-id]');
    const userId = userIdEl?.getAttribute('data-user-id');

    if (userId) {
      console.log(`🔄 Recargando detalle de usuario ${userId}...`);
      await viewUserDetail(userId);
    } else {
      console.warn('⚠️ No se encontró userId, cerrando modal');
      document.getElementById('userDetailModal').classList.add('kyc-hidden');
      await loadUsers();
    }

  } catch (err) {
    console.error('❌ Error aprobando documento:', err);
    alert('❌ Error aprobando documento: ' + (err.message || 'Unknown error'));
  }
}

async function rejectDocument(docId) {
  const reason = prompt('Razón del rechazo:');
  if (!reason) return;

  try {
    const session = getSession();
    const res = await fetch(`${API_BASE}/documents/${docId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`
      },
      body: JSON.stringify({
        status: 'rejected',
        rejection_reason: reason
      })
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('❌ Document reject response not ok:', res.status, data);
      throw new Error(data?.detail || 'REJECT_DOC_FAILED');
    }

    console.log('✅ Document reject response OK:', data);
    alert('✅ Documento rechazado');

    // Esperar antes de recargar
    await new Promise(resolve => setTimeout(resolve, 300));

    // Recargar modal - buscar userId desde el contenedor principal
    const modalBody = document.getElementById('modalBody');
    const userIdEl = modalBody?.querySelector('[data-user-id]');
    const userId = userIdEl?.getAttribute('data-user-id');

    if (userId) {
      console.log(`🔄 Recargando detalle de usuario ${userId}...`);
      await viewUserDetail(userId);
    } else {
      console.warn('⚠️ No se encontró userId, cerrando modal');
      document.getElementById('userDetailModal').classList.add('kyc-hidden');
      await loadUsers();
    }

  } catch (err) {
    console.error('❌ Error rechazando documento:', err);
    alert('❌ Error rechazando documento: ' + (err.message || 'Unknown error'));
  }
}

async function approveUser(userId) {
  if (!confirm('¿Aprobar el KYC completo de este usuario?\n\nEsto activará su cuenta y aprobará todos sus documentos pendientes.')) {
    return;
  }

  try {
    const session = getSession();
    const res = await fetch(`${API_BASE}/users/${userId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`
      }
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('❌ Approve response not ok:', res.status, data);
      throw new Error(data?.detail || 'APPROVE_USER_FAILED');
    }

    console.log('✅ Approve response OK:', data);
    alert('✅ KYC aprobado correctamente');

    // Esperar un poco antes de recargar (CrateDB consistency)
    await new Promise(resolve => setTimeout(resolve, 500));

    // Cerrar modal y recargar tabla
    document.getElementById('userDetailModal').classList.add('kyc-hidden');
    await loadUsers();
    await loadStats();

  } catch (err) {
    console.error('❌ Error aprobando usuario:', err);
    alert('❌ Error aprobando KYC: ' + (err.message || 'Unknown error'));
  }
}

async function rejectUser(userId) {
  const reason = prompt('Razón del rechazo del KYC:');
  if (!reason) return;

  try {
    const session = getSession();
    const res = await fetch(`${API_BASE}/users/${userId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`
      },
      body: JSON.stringify({ reason })
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('❌ Reject response not ok:', res.status, data);
      throw new Error(data?.detail || 'REJECT_USER_FAILED');
    }

    console.log('✅ Reject response OK:', data);
    alert('✅ KYC rechazado');

    // Esperar un poco antes de recargar (CrateDB consistency)
    await new Promise(resolve => setTimeout(resolve, 500));

    // Cerrar modal y recargar tabla
    document.getElementById('userDetailModal').classList.add('kyc-hidden');
    await loadUsers();
    await loadStats();

  } catch (err) {
    console.error('❌ Error rechazando usuario:', err);
    alert('❌ Error rechazando KYC: ' + (err.message || 'Unknown error'));
  }
}