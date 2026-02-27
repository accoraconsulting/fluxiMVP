/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DASHBOARD PAYINS - Integración de Estadísticas de Payins en el Dashboard
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Descripción:
 * Módulo que agrega una sección de estadísticas de payins al dashboard.
 * Se carga después del dashboard principal y agrega widgets dinámicamente.
 *
 * Para Admin (fluxiAdmin):
 *   - Payins pendientes de aprobación
 *   - Total de links generados
 *   - Monto total procesado
 *   - Acceso rápido a Crear Payin y Ver Pendientes
 *
 * Para Usuarios (fluxiUser con KYC):
 *   - Mis links activos
 *   - Pagos completados
 *   - Acceso rápido a Mis Links
 *
 * Autor: FLUXI Team
 * Fecha: 2026-02-23
 * Versión: 1.0.0
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ═════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═════════════════════════════════════════════════════════════════════════════

const API_BASE = 'http://127.0.0.1:3000/api';

/**
 * Obtiene token y datos del usuario
 * @returns {Object|null} Sesión del usuario
 */
function getPayinSession() {
  try {
    const token = localStorage.getItem('auth_token');
    const authUser = localStorage.getItem('auth_user');
    if (!token || !authUser) return null;
    return { token, user: JSON.parse(authUser) };
  } catch (e) {
    return null;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Inicializa el módulo de payins en el dashboard
 * Espera a que el sidebar esté cargado para ejecutar
 */
function initDashboardPayins() {
  const session = getPayinSession();
  if (!session) return;

  const { role, kyc_status } = session.user;

  console.log(`[DashboardPayins] Inicializando - Rol: ${role}, KYC: ${kyc_status}`);

  // DESHABILITADO: Secciones de payins ocultadas por configuración
  // Solo mostrar para admin o users con KYC aprobado
  /*
  if (role === 'fluxiAdmin') {
    inyectarSeccionAdmin(session);
  } else if (role === 'fluxiUser' && kyc_status === 'approved') {
    inyectarSeccionUser(session);
  } else {
    console.log('[DashboardPayins] Usuario sin acceso a payins, omitiendo sección');
  }
  */

  console.log('[DashboardPayins] Secciones de payins deshabilitadas');
}

// ═════════════════════════════════════════════════════════════════════════════
// SECCIÓN ADMIN
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Inyecta la sección de payins para admins en el dashboard
 * Se coloca después de las quick-actions
 *
 * @param {Object} session - Sesión del usuario
 */
async function inyectarSeccionAdmin(session) {
  console.log('[DashboardPayins] Inyectando sección admin...');

  // Buscar punto de inserción (después de quick-actions)
  const quickActions = document.querySelector('.quick-actions');
  const insertPoint = quickActions || document.querySelector('.balances');

  if (!insertPoint) {
    console.warn('[DashboardPayins] No se encontró punto de inserción');
    return;
  }

  // Crear sección HTML
  const section = document.createElement('section');
  section.className = 'dashboard-payins-section';
  section.id = 'dashboard-payins';
  section.innerHTML = `
    <div class="section-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <h2 style="color: #1e293b; font-size: 1.1rem; font-weight: 600; display: flex; align-items: center; gap: 8px;">
        <i class='bx bx-credit-card' style="color: #667eea; font-size: 1.3rem;"></i>
        Sistema de Payins
      </h2>
      <a href="./payins-admin.html" style="color: #667eea; text-decoration: none; font-size: 0.85rem; font-weight: 500;">
        Ver todo →
      </a>
    </div>

    <div class="payins-dashboard-grid">
      <div class="payins-dash-card payins-dash-pending" onclick="window.location.href='./payins-pending.html'">
        <div class="payins-dash-icon" style="background: linear-gradient(135deg, #ffa751, #ffe259);">
          <i class='bx bx-time-five'></i>
        </div>
        <div class="payins-dash-info">
          <span class="payins-dash-label">Pendientes</span>
          <span class="payins-dash-value" id="dashPayinsPending">-</span>
        </div>
      </div>

      <div class="payins-dash-card payins-dash-approved" onclick="window.location.href='./payins-admin.html'">
        <div class="payins-dash-icon" style="background: linear-gradient(135deg, #667eea, #764ba2);">
          <i class='bx bx-link-external'></i>
        </div>
        <div class="payins-dash-info">
          <span class="payins-dash-label">Links Generados</span>
          <span class="payins-dash-value" id="dashPayinsApproved">-</span>
        </div>
      </div>

      <div class="payins-dash-card payins-dash-completed">
        <div class="payins-dash-icon" style="background: linear-gradient(135deg, #43e97b, #38f9d7);">
          <i class='bx bx-check-circle'></i>
        </div>
        <div class="payins-dash-info">
          <span class="payins-dash-label">Completados</span>
          <span class="payins-dash-value" id="dashPayinsCompleted">-</span>
        </div>
      </div>

      <div class="payins-dash-card payins-dash-amount">
        <div class="payins-dash-icon" style="background: linear-gradient(135deg, #4facfe, #00f2fe);">
          <i class='bx bx-dollar-circle'></i>
        </div>
        <div class="payins-dash-info">
          <span class="payins-dash-label">Monto Total</span>
          <span class="payins-dash-value" id="dashPayinsAmount">-</span>
        </div>
      </div>
    </div>
  `;

  // Insertar después del punto de referencia
  insertPoint.after(section);

  // Cargar datos
  await cargarEstadisticasAdmin(session);
}

/**
 * Carga las estadísticas de payins para el admin
 *
 * @param {Object} session - Sesión del usuario
 */
async function cargarEstadisticasAdmin(session) {
  try {
    // Cargar todos los payins
    const response = await fetch(`${API_BASE}/payin-requests?limit=200`, {
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn('[DashboardPayins] Error cargando stats:', response.status);
      return;
    }

    const data = await response.json();

    if (!data.success || !data.payins) return;

    const payins = data.payins;

    // Calcular estadísticas
    const pending = payins.filter(p => p.status === 'pending').length;
    const approved = payins.filter(p => p.status === 'approved').length;
    const completed = payins.filter(p => p.status === 'completed').length;
    const totalAmount = payins
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    // Actualizar DOM
    const elPending = document.getElementById('dashPayinsPending');
    const elApproved = document.getElementById('dashPayinsApproved');
    const elCompleted = document.getElementById('dashPayinsCompleted');
    const elAmount = document.getElementById('dashPayinsAmount');

    if (elPending) elPending.textContent = pending;
    if (elApproved) elApproved.textContent = approved;
    if (elCompleted) elCompleted.textContent = completed;
    if (elAmount) elAmount.textContent = `$${totalAmount.toLocaleString('es-CO')}`;

    console.log(`[DashboardPayins] ✅ Stats admin: ${pending} pending, ${approved} approved, ${completed} completed`);

  } catch (error) {
    console.error('[DashboardPayins] Error cargando estadísticas admin:', error);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// SECCIÓN USER
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Inyecta la sección de payins para usuarios normales
 * Muestra links activos y pagados
 *
 * @param {Object} session - Sesión del usuario
 */
async function inyectarSeccionUser(session) {
  console.log('[DashboardPayins] Inyectando sección usuario...');

  // Buscar punto de inserción
  const quickActions = document.querySelector('.quick-actions');
  const insertPoint = quickActions || document.querySelector('.balances');

  if (!insertPoint) {
    console.warn('[DashboardPayins] No se encontró punto de inserción');
    return;
  }

  // Crear sección HTML
  const section = document.createElement('section');
  section.className = 'dashboard-payins-section';
  section.id = 'dashboard-payins';
  section.innerHTML = `
    <div class="section-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <h2 style="color: #1e293b; font-size: 1.1rem; font-weight: 600; display: flex; align-items: center; gap: 8px;">
        <i class='bx bx-link-alt' style="color: #667eea; font-size: 1.3rem;"></i>
        Mis Links de Pago
      </h2>
      <a href="./payins-user.html" style="color: #667eea; text-decoration: none; font-size: 0.85rem; font-weight: 500;">
        Ver todos →
      </a>
    </div>

    <div class="payins-dashboard-grid payins-dashboard-grid-user">
      <div class="payins-dash-card" onclick="window.location.href='./payins-user.html'">
        <div class="payins-dash-icon" style="background: linear-gradient(135deg, #667eea, #764ba2);">
          <i class='bx bx-link-external'></i>
        </div>
        <div class="payins-dash-info">
          <span class="payins-dash-label">Links Activos</span>
          <span class="payins-dash-value" id="dashUserActiveLinks">-</span>
        </div>
      </div>

      <div class="payins-dash-card" onclick="window.location.href='./payins-user.html'">
        <div class="payins-dash-icon" style="background: linear-gradient(135deg, #43e97b, #38f9d7);">
          <i class='bx bx-check-circle'></i>
        </div>
        <div class="payins-dash-info">
          <span class="payins-dash-label">Pagos Recibidos</span>
          <span class="payins-dash-value" id="dashUserPaid">-</span>
        </div>
      </div>

      <div class="payins-dash-card">
        <div class="payins-dash-icon" style="background: linear-gradient(135deg, #4facfe, #00f2fe);">
          <i class='bx bx-dollar-circle'></i>
        </div>
        <div class="payins-dash-info">
          <span class="payins-dash-label">Monto Recibido</span>
          <span class="payins-dash-value" id="dashUserAmount">-</span>
        </div>
      </div>
    </div>
  `;

  // Insertar después del punto de referencia
  insertPoint.after(section);

  // Cargar datos
  await cargarEstadisticasUser(session);
}

/**
 * Carga las estadísticas de payins para el usuario
 *
 * @param {Object} session - Sesión del usuario
 */
async function cargarEstadisticasUser(session) {
  try {
    const response = await fetch(`${API_BASE}/payin-requests?limit=100`, {
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) return;

    const data = await response.json();
    if (!data.success || !data.payins) return;

    const payins = data.payins;

    const activeLinks = payins.filter(p => p.status === 'approved').length;
    const paidLinks = payins.filter(p => p.status === 'completed').length;
    const totalAmount = payins
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    const elActive = document.getElementById('dashUserActiveLinks');
    const elPaid = document.getElementById('dashUserPaid');
    const elAmount = document.getElementById('dashUserAmount');

    if (elActive) elActive.textContent = activeLinks;
    if (elPaid) elPaid.textContent = paidLinks;
    if (elAmount) elAmount.textContent = `$${totalAmount.toLocaleString('es-CO')}`;

    console.log(`[DashboardPayins] ✅ Stats user: ${activeLinks} active, ${paidLinks} paid`);

  } catch (error) {
    console.error('[DashboardPayins] Error cargando estadísticas user:', error);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// ESTILOS DINÁMICOS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Inyecta los estilos CSS para la sección de payins en el dashboard
 */
function inyectarEstilos() {
  if (document.getElementById('dashboard-payins-styles')) return;

  const style = document.createElement('style');
  style.id = 'dashboard-payins-styles';
  style.textContent = `
    .dashboard-payins-section {
      padding: 0 24px;
      margin-top: 24px;
      animation: fadeInPayins 0.5s ease-in;
    }

    @keyframes fadeInPayins {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .payins-dashboard-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }

    .payins-dashboard-grid-user {
      grid-template-columns: repeat(3, 1fr);
    }

    .payins-dash-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px 20px;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .payins-dash-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 24px rgba(102, 126, 234, 0.15);
      border-color: #667eea;
    }

    .payins-dash-icon {
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
      color: white;
      font-size: 1.4rem;
      flex-shrink: 0;
    }

    .payins-dash-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .payins-dash-label {
      color: #64748b;
      font-size: 0.8rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .payins-dash-value {
      color: #1e293b;
      font-size: 1.3rem;
      font-weight: 700;
    }

    @media (max-width: 768px) {
      .payins-dashboard-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      .payins-dashboard-grid-user {
        grid-template-columns: 1fr;
      }
      .dashboard-payins-section {
        padding: 0 16px;
      }
    }

    @media (max-width: 480px) {
      .payins-dashboard-grid {
        grid-template-columns: 1fr;
      }
    }
  `;

  document.head.appendChild(style);
}

// ═════════════════════════════════════════════════════════════════════════════
// AUTO-INICIALIZACIÓN
// ═════════════════════════════════════════════════════════════════════════════

// Inyectar estilos inmediatamente
inyectarEstilos();

// Esperar a que el sidebar esté cargado (señal de que el dashboard está listo)
document.addEventListener('sidebar:loaded', () => {
  // Pequeño delay para que el dashboard principal renderice primero
  setTimeout(() => {
    initDashboardPayins();
  }, 800);
});

// Fallback si sidebar:loaded no se emitió
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (!document.getElementById('dashboard-payins')) {
      initDashboardPayins();
    }
  }, 2000);
});

console.log('✅ dashboard-payins.js cargado correctamente');
