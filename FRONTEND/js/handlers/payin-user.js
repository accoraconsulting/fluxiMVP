/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PAYIN USER HANDLER - Gestión de Links de Pago para Usuarios
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Descripción:
 * Manejador completo para la página de links de pago del usuario.
 * Permite a los usuarios ver sus links generados, copiarlos y ver estados.
 *
 * Funcionalidades Principales:
 * 1. Carga lista de payins generados (status != pending)
 * 2. Renderiza tarjetas con información del link
 * 3. Permite copiar el link de pago
 * 4. Muestra estado del pago (pendiente, completado, expirado)
 * 5. Actualiza estadísticas en tiempo real
 * 6. Maneja errores y notificaciones
 *
 * Autor: FLUXI Team
 * Fecha: 2026-02-23
 * Versión: 1.0.0
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ═════════════════════════════════════════════════════════════════════════════
// ESTADO GLOBAL
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Objeto de estado global para mantener datos de la página
 * @type {Object}
 */
const appState = {
  payinsUser: [],
  usuarioActual: null,
  cargando: false,
  ultimaActualizacion: null,
};

// ═════════════════════════════════════════════════════════════════════════════
// FUNCIONES DE INICIALIZACIÓN
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Inicializa la página cargando datos y configurando event listeners
 * Se ejecuta cuando el DOM está completamente cargado
 *
 * @async
 */
async function inicializarPagina() {
  console.log('🚀 Inicializando página de mis links de pago...');

  try {
    // Obtener datos del usuario actual
    obtenerUsuarioActual();

    // 🔌 Configurar real-time updates PRIMERO
    try {
      const realtimeHandler = await import('../handlers/payin-realtime-handler.js');
      realtimeHandler.configurarRealtimeUser();
      console.log('✅ Real-time activado para usuario');
    } catch (error) {
      console.warn('⚠️ Real-time no disponible:', error.message);
    }

    // Cargar datos iniciales
    await cargarMisPayins();

    // Configurar event listeners
    configurarEventListeners();

    // Actualizar estadísticas
    actualizarEstadisticas();

    // Actualizar cada 30 segundos (fallback si real-time no funciona)
    setInterval(async () => {
      console.log('🔄 Actualizando mis links (polling)...');
      await cargarMisPayins();
      actualizarEstadisticas();
    }, 30000);

    console.log('✅ Página de mis links inicializada correctamente');
  } catch (error) {
    console.error('❌ Error inicializando página:', error);
    mostrarNotificacion('Error al inicializar la página', 'error');
  }
}

/**
 * Obtiene los datos del usuario actual de localStorage
 */
function obtenerUsuarioActual() {
  try {
    const authUser = localStorage.getItem('auth_user');
    if (!authUser) {
      console.warn('⚠️ No hay usuario en sesión');
      return;
    }

    appState.usuarioActual = JSON.parse(authUser);
    console.log('👤 Usuario actual:', appState.usuarioActual.username);
  } catch (error) {
    console.error('❌ Error obteniendo usuario:', error);
  }
}

/**
 * Configura todos los event listeners de la página
 */
function configurarEventListeners() {
  // Botón de actualizar
  const btnRefresh = document.getElementById('btnRefreshLinks');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      btnRefresh.disabled = true;
      btnRefresh.innerHTML = '<i class="bx bx-loader-alt" style="animation: spin 1s linear infinite;"></i>Actualizando...';
      await cargarMisPayins();
      actualizarEstadisticas();
      btnRefresh.disabled = false;
      btnRefresh.innerHTML = '<i class="bx bx-refresh"></i>Actualizar';
    });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// FUNCIONES DE CARGA DE DATOS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Carga la lista de payins del usuario actual
 * Solo muestra payins que ya fueron aprobados (no pendientes)
 *
 * @async
 * @returns {Promise<void>}
 */
async function cargarMisPayins() {
  const loadingSpinner = document.getElementById('loadingLinks');
  const gridContainer = document.getElementById('payinsUserGrid');
  const emptyState = document.getElementById('emptyLinks');

  try {
    appState.cargando = true;

    // Mostrar loading
    if (loadingSpinner) loadingSpinner.style.display = 'flex';
    if (gridContainer) gridContainer.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';

    console.log('📥 Cargando mis payins...');

    // Llamar al API para obtener payins aprobados del usuario actual
    const respuesta = await PayinService.obtenerMisPayins({
      estado: 'approved', // Solo payins aprobados (links ya generados)
    });

    if (!respuesta.success || !respuesta.payins) {
      throw new Error('Error al cargar mis payins');
    }

    appState.payinsUser = respuesta.payins;
    appState.ultimaActualizacion = new Date();

    console.log(`✅ ${appState.payinsUser.length} payins cargados`);

    // Renderizar payins
    renderizarMisPayins();

  } catch (error) {
    console.error('❌ Error cargando mis payins:', error);
    mostrarNotificacion('Error al cargar tus links', 'error');

    // Mostrar estado vacío en caso de error
    if (emptyState) {
      emptyState.style.display = 'flex';
      emptyState.querySelector('h3').textContent = 'Error al cargar links';
      emptyState.querySelector('p').textContent = error.message;
    }
  } finally {
    appState.cargando = false;
    if (loadingSpinner) loadingSpinner.style.display = 'none';
  }
}

/**
 * Renderiza los payins del usuario en la grid
 * Crea tarjetas para cada payin con información y acciones
 */
function renderizarMisPayins() {
  const gridContainer = document.getElementById('payinsUserGrid');
  const emptyState = document.getElementById('emptyLinks');

  if (!gridContainer) return;

  // Si no hay payins, mostrar estado vacío
  if (appState.payinsUser.length === 0) {
    gridContainer.style.display = 'none';
    if (emptyState) emptyState.style.display = 'flex';
    return;
  }

  // Limpiar grid
  gridContainer.innerHTML = '';

  // Crear tarjeta para cada payin
  appState.payinsUser.forEach((payin) => {
    const tarjeta = crearTarjetaPayinUser(payin);
    gridContainer.appendChild(tarjeta);
  });

  // Mostrar grid
  gridContainer.style.display = 'grid';
  if (emptyState) emptyState.style.display = 'none';
}

/**
 * Crea una tarjeta HTML para un payin del usuario
 *
 * @param {Object} payin - Objeto payin con datos del pago
 * @param {string} payin.id - ID del payin
 * @param {string} payin.payin_link_id - ID del link en Vitawallet
 * @param {string} payin.payin_url - URL del link de pago
 * @param {number} payin.amount - Monto del pago
 * @param {string} payin.currency - Moneda (USD, COP, EUR)
 * @param {string} payin.country - País (CO, AR, etc)
 * @param {string} payin.payment_method - Método de pago (PSE, Nequi, etc)
 * @param {string} payin.status - Estado del payin (approved, completed, expired)
 * @param {string} payin.description - Descripción del pago
 * @param {string} payin.created_at - Fecha de creación
 * @returns {HTMLElement} Tarjeta HTML del payin
 */
function crearTarjetaPayinUser(payin) {
  const tarjeta = document.createElement('div');
  tarjeta.className = 'payin-user-card';
  tarjeta.dataset.payinId = payin.id;

  // Determinar badge de estado
  const estadoBadge = obtenerBadgeEstado(payin.status);

  // Mapeo de países
  const paisEmoji = {
    CO: '🇨🇴',
    AR: '🇦🇷',
    CL: '🇨🇱',
    BR: '🇧🇷',
    MX: '🇲🇽',
  };

  const html = `
    <div class="payin-user-card-header">
      <div class="payin-title">
        <h3>${payin.description || 'Link de Pago'}</h3>
        <span class="status-badge ${estadoBadge.clase}">${estadoBadge.texto}</span>
      </div>
      <div class="payin-monto">
        <span class="amount-value">${payin.amount.toLocaleString('es-CO', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}</span>
        <span class="amount-currency">${payin.currency}</span>
      </div>
    </div>

    <div class="payin-user-card-body">
      <div class="payin-info-row">
        <span class="info-label">País</span>
        <span class="info-value">${paisEmoji[payin.country] || payin.country} ${payin.country}</span>
      </div>
      <div class="payin-info-row">
        <span class="info-label">Método</span>
        <span class="info-value">${payin.payment_method}</span>
      </div>
      <div class="payin-info-row">
        <span class="info-label">Creado</span>
        <span class="info-value">${new Date(payin.created_at).toLocaleDateString('es-CO')}</span>
      </div>
      ${
        payin.commission || payin.final_amount
          ? `
          <div style="border-top: 1px solid #e0e0e0; padding-top: 12px; margin-top: 12px;">
            ${payin.commission ? `
              <div class="payin-info-row">
                <span class="info-label">Comisión</span>
                <span class="info-value" style="color: #ff6b6b;">${payin.commission}%</span>
              </div>
            ` : ''}
            ${payin.final_amount ? `
              <div class="payin-info-row">
                <span class="info-label">Monto Final</span>
                <span class="info-value" style="color: #51cf66; font-weight: bold;">${payin.final_amount.toLocaleString('es-CO', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} ${payin.currency}</span>
              </div>
            ` : ''}
          </div>
          `
          : ''
      }
    </div>

    <div class="payin-user-card-footer">
      <button type="button" class="btn btn-sm btn-outline" onclick="abrirDetallePayin('${payin.id}')">
        <i class="bx bx-info-circle"></i>
        Ver Detalles
      </button>
      ${
        payin.payin_url
          ? `
          <button type="button" class="btn btn-sm btn-primary" onclick="copiarLink('${payin.payin_url}')">
            <i class="bx bx-copy"></i>
            Copiar Link
          </button>
          <a href="${payin.payin_url}" target="_blank" class="btn btn-sm btn-success">
            <i class="bx bx-link-external"></i>
            Abrir Link
          </a>
          `
          : `
          <button type="button" class="btn btn-sm" disabled style="background: #666; cursor: not-allowed;">
            <i class="bx bx-lock"></i>
            Link no disponible
          </button>
          `
      }
    </div>
  `;

  tarjeta.innerHTML = html;
  return tarjeta;
}

/**
 * Obtiene el badge de estado con clase CSS
 *
 * @param {string} status - Estado del payin
 * @returns {Object} Objeto con {clase, texto}
 */
function obtenerBadgeEstado(status) {
  const estados = {
    approved: { clase: 'status-approved', texto: '⏳ Pendiente Pago' },
    completed: { clase: 'status-completed', texto: '✅ Pagado' },
    expired: { clase: 'status-expired', texto: '⏱️ Expirado' },
    rejected: { clase: 'status-rejected', texto: '❌ Rechazado' },
    pending: { clase: 'status-pending', texto: '⌛ Pendiente Aprobación' },
  };

  return estados[status] || { clase: 'status-pending', texto: '❓ Estado Desconocido' };
}

/**
 * Abre el modal con los detalles completos de un payin
 *
 * @param {string} payinId - ID del payin a ver en detalle
 */
function abrirDetallePayin(payinId) {
  const payin = appState.payinsUser.find((p) => p.id === payinId);

  if (!payin) {
    mostrarNotificacion('Link no encontrado', 'error');
    return;
  }

  const detailContent = document.getElementById('payinDetailContent');
  if (!detailContent) return;

  const paisEmoji = {
    CO: '🇨🇴',
    AR: '🇦🇷',
    CL: '🇨🇱',
    BR: '🇧🇷',
    MX: '🇲🇽',
  };

  const estadoBadge = obtenerBadgeEstado(payin.status);

  const html = `
    <div class="detail-section">
      <h4>Información del Link</h4>
      <div class="detail-row">
        <span class="detail-label">ID del Link</span>
        <span class="detail-value">${payin.id}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Estado</span>
        <span class="detail-value"><span class="status-badge ${estadoBadge.clase}">${estadoBadge.texto}</span></span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Monto</span>
        <span class="detail-value">${payin.amount.toLocaleString('es-CO')} ${payin.currency}</span>
      </div>
    </div>

    <div class="detail-section">
      <h4>Detalles del Pago</h4>
      <div class="detail-row">
        <span class="detail-label">País</span>
        <span class="detail-value">${paisEmoji[payin.country] || payin.country} ${payin.country}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Método de Pago</span>
        <span class="detail-value">${payin.payment_method}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Descripción</span>
        <span class="detail-value">${payin.description || '(Sin descripción)'}</span>
      </div>
    </div>

    ${
      payin.payin_url
        ? `
        <div class="detail-section">
          <h4>Link de Pago</h4>
          <div class="link-copy-section">
            <div class="link-input-group">
              <input type="text" value="${payin.payin_url}" readonly class="link-input" id="copyLinkInput">
              <button type="button" class="btn btn-sm btn-primary" onclick="copiarLink('${payin.payin_url}')">
                <i class="bx bx-copy"></i>
                Copiar
              </button>
            </div>
            <a href="${payin.payin_url}" target="_blank" class="btn btn-sm btn-success" style="width: 100%; margin-top: 10px;">
              <i class="bx bx-link-external"></i>
              Abrir en Nueva Pestaña
            </a>
          </div>
        </div>
        `
        : `
        <div class="detail-section" style="background: rgba(245, 86, 108, 0.1); border-left: 3px solid #f5576c;">
          <i class="bx bx-lock"></i>
          <p>El link aún no está disponible. Espera a que tu administrador lo genere.</p>
        </div>
        `
    }

    <div class="detail-section">
      <h4>Fechas</h4>
      <div class="detail-row">
        <span class="detail-label">Creado</span>
        <span class="detail-value">${new Date(payin.created_at).toLocaleString('es-CO')}</span>
      </div>
      ${
        payin.updated_at
          ? `
        <div class="detail-row">
          <span class="detail-label">Actualizado</span>
          <span class="detail-value">${new Date(payin.updated_at).toLocaleString('es-CO')}</span>
        </div>
        `
          : ''
      }
    </div>
  `;

  detailContent.innerHTML = html;
  abrirModal('modalPayinDetail');
}

/**
 * Copia el link de pago al portapapeles
 *
 * @param {string} link - Link a copiar
 */
function copiarLink(link) {
  navigator.clipboard.writeText(link).then(() => {
    mostrarNotificacion('✅ Link copiado al portapapeles', 'success');
  }).catch(err => {
    console.error('❌ Error copiando link:', err);
    mostrarNotificacion('Error al copiar link', 'error');
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// FUNCIONES DE ESTADÍSTICAS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Actualiza las tarjetas de estadísticas con datos de los payins del usuario
 */
function actualizarEstadisticas() {
  // Links activos (approved)
  const activeLinks = appState.payinsUser.filter((p) => p.status === 'approved').length;
  const statsActiveLinks = document.getElementById('statsActiveLinks');
  if (statsActiveLinks) statsActiveLinks.textContent = activeLinks;

  // Pagados (completed)
  const paidLinks = appState.payinsUser.filter((p) => p.status === 'completed').length;
  const statsPaid = document.getElementById('statsPaid');
  if (statsPaid) statsPaid.textContent = paidLinks;

  // Monto total recibido (completed)
  const montoRecibido = appState.payinsUser
    .filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const statsTotalAmount = document.getElementById('statsTotalAmount');
  if (statsTotalAmount) {
    statsTotalAmount.textContent = `$${montoRecibido.toLocaleString('es-CO')}`;
  }

  // Pendientes de pago (approved)
  const pending = appState.payinsUser.filter((p) => p.status === 'approved').length;
  const statsPending = document.getElementById('statsPending');
  if (statsPending) statsPending.textContent = pending;
}

// ═════════════════════════════════════════════════════════════════════════════
// FUNCIONES UTILITARIAS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Abre un modal por ID
 *
 * @param {string} modalId - ID del modal a abrir
 */
function abrirModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('modal-visible');
    console.log(`📂 Modal abierto: ${modalId}`);
  }
}

/**
 * Cierra un modal por ID
 *
 * @param {string} modalId - ID del modal a cerrar
 */
function cerrarModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('modal-visible');
    console.log(`📁 Modal cerrado: ${modalId}`);
  }
}

/**
 * Muestra una notificación al usuario
 *
 * @param {string} mensaje - Mensaje a mostrar
 * @param {string} tipo - Tipo de notificación ('success', 'error', 'warning', 'info')
 */
function mostrarNotificacion(mensaje, tipo = 'info') {
  // Crear elemento de notificación
  const notificacion = document.createElement('div');
  notificacion.className = `notification notification-${tipo}`;
  notificacion.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    background: ${
      tipo === 'success'
        ? '#10b981'
        : tipo === 'error'
        ? '#ef4444'
        : tipo === 'warning'
        ? '#f59e0b'
        : '#3b82f6'
    };
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 9999;
    animation: slideIn 0.3s ease-out;
    font-size: 14px;
  `;

  const icono =
    tipo === 'success'
      ? '✅'
      : tipo === 'error'
      ? '❌'
      : tipo === 'warning'
      ? '⚠️'
      : 'ℹ️';

  notificacion.innerHTML = `${icono} ${mensaje}`;
  document.body.appendChild(notificacion);

  // Eliminar después de 4 segundos
  setTimeout(() => {
    notificacion.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notificacion.remove(), 300);
  }, 4000);
}

// ═════════════════════════════════════════════════════════════════════════════
// INICIALIZACIÓN AL CARGAR DOM
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Espera a que el DOM esté completamente cargado antes de inicializar
 */
document.addEventListener('DOMContentLoaded', () => {
  // Pequeño delay para asegurar que PayinService está disponible
  setTimeout(() => {
    inicializarPagina();
  }, 500);
});

// Recargar datos cuando la pestaña regresa al foco
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    console.log('👁️ Página visible nuevamente, actualizando datos...');
    cargarMisPayins();
    actualizarEstadisticas();
  }
});

console.log('✅ payin-user.js cargado correctamente');
