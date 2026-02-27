/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PAYIN PENDING HANDLER - Gestión de Payins Pendientes de Aprobación
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Descripción:
 * Manejador completo para la página de payins pendientes.
 * Permite a los admins ver, aprobar y rechazar payins antes de generar
 * los links de pago en Vitawallet.
 *
 * Funcionalidades Principales:
 * 1. Carga lista de payins con status = 'pending'
 * 2. Renderiza tarjetas con información del payin
 * 3. Muestra modales de confirmación para aprobar/rechazar
 * 4. Realiza llamadas API para actualizar estado
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
  payinsPendientes: [],
  payinActual: null,
  accionActual: null, // 'aprobar' o 'rechazar'
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
  console.log('🚀 Inicializando página de payins pendientes...');

  try {
    // 🔌 Configurar real-time updates PRIMERO
    try {
      const realtimeHandler = await import('../handlers/payin-realtime-handler.js');
      realtimeHandler.configurarRealtimePending();
      console.log('✅ Real-time activado para pendientes');
    } catch (error) {
      console.warn('⚠️ Real-time no disponible:', error.message);
    }

    // Cargar datos iniciales
    await cargarPayinsPendientes();

    // Configurar event listeners
    configurarEventListeners();

    // Actualizar estadísticas
    actualizarEstadisticas();

    // Actualizar cada 30 segundos (fallback si real-time no funciona)
    setInterval(async () => {
      console.log('🔄 Actualizando payins pendientes (polling)...');
      await cargarPayinsPendientes();
      actualizarEstadisticas();
    }, 30000);

    console.log('✅ Página de payins pendientes inicializada correctamente');
  } catch (error) {
    console.error('❌ Error inicializando página:', error);
    mostrarNotificacion('Error al inicializar la página', 'error');
  }
}

/**
 * Configura todos los event listeners de la página
 */
function configurarEventListeners() {
  // Botón de actualizar
  const btnRefresh = document.getElementById('btnRefreshPending');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      btnRefresh.disabled = true;
      btnRefresh.innerHTML = '<i class="bx bx-loader-alt" style="animation: spin 1s linear infinite;"></i>Actualizando...';
      await cargarPayinsPendientes();
      actualizarEstadisticas();
      btnRefresh.disabled = false;
      btnRefresh.innerHTML = '<i class="bx bx-refresh"></i>Actualizar';
    });
  }

  // Botón de confirmar aprobación
  const btnConfirmarAprobar = document.getElementById('btnConfirmarAprobacion');
  if (btnConfirmarAprobar) {
    btnConfirmarAprobar.addEventListener('click', () => {
      handleConfirmarAprobacion();
    });
  }

  // Botón de confirmar rechazo
  const btnConfirmarRechazo = document.getElementById('btnConfirmarRechazo');
  if (btnConfirmarRechazo) {
    btnConfirmarRechazo.addEventListener('click', () => {
      handleConfirmarRechazo();
    });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// FUNCIONES DE CARGA DE DATOS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Carga la lista de payins pendientes desde el API
 *
 * @async
 * @returns {Promise<void>}
 */
async function cargarPayinsPendientes() {
  const loadingSpinner = document.getElementById('loadingPending');
  const gridContainer = document.getElementById('payinsPendingGrid');
  const emptyState = document.getElementById('emptyPending');

  try {
    appState.cargando = true;

    // Mostrar loading
    if (loadingSpinner) loadingSpinner.style.display = 'flex';
    if (gridContainer) gridContainer.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';

    console.log('📥 Cargando payins pendientes...');

    // Llamar al API para obtener payins con status = 'pending'
    const respuesta = await PayinService.obtenerMisPayins({ estado: 'pending' });

    if (!respuesta.success || !respuesta.payins) {
      throw new Error('Error al cargar payins pendientes');
    }

    appState.payinsPendientes = respuesta.payins;
    appState.ultimaActualizacion = new Date();

    console.log(`✅ ${appState.payinsPendientes.length} payins pendientes cargados`);

    // Renderizar payins
    renderizarPayinsPendientes();

  } catch (error) {
    console.error('❌ Error cargando payins pendientes:', error);
    mostrarNotificacion('Error al cargar payins pendientes', 'error');

    // Mostrar estado vacío en caso de error
    if (emptyState) {
      emptyState.style.display = 'flex';
      emptyState.querySelector('h3').textContent = 'Error al cargar payins';
      emptyState.querySelector('p').textContent = error.message;
    }
  } finally {
    appState.cargando = false;
    if (loadingSpinner) loadingSpinner.style.display = 'none';
  }
}

/**
 * Renderiza los payins pendientes en la grid
 * Crea tarjetas para cada payin con sus acciones
 */
function renderizarPayinsPendientes() {
  const gridContainer = document.getElementById('payinsPendingGrid');
  const emptyState = document.getElementById('emptyPending');

  if (!gridContainer) return;

  // Si no hay payins, mostrar estado vacío
  if (appState.payinsPendientes.length === 0) {
    gridContainer.style.display = 'none';
    if (emptyState) emptyState.style.display = 'flex';
    return;
  }

  // Limpiar grid
  gridContainer.innerHTML = '';

  // Crear tarjeta para cada payin
  appState.payinsPendientes.forEach((payin) => {
    const tarjeta = crearTarjetaPayin(payin);
    gridContainer.appendChild(tarjeta);
  });

  // Mostrar grid
  gridContainer.style.display = 'grid';
  if (emptyState) emptyState.style.display = 'none';
}

/**
 * Crea una tarjeta HTML para un payin específico
 *
 * @param {Object} payin - Objeto payin con datos del pago
 * @param {string} payin.id - ID del payin
 * @param {string} payin.user_id - ID del usuario
 * @param {string} payin.user_name - Nombre del usuario
 * @param {number} payin.amount - Monto del pago
 * @param {string} payin.currency - Moneda (USD, COP, EUR)
 * @param {string} payin.country - País (CO, AR, etc)
 * @param {string} payin.payment_method - Método de pago (PSE, Nequi, etc)
 * @param {string} payin.description - Descripción del pago
 * @param {string} payin.created_at - Fecha de creación
 * @returns {HTMLElement} Tarjeta HTML del payin
 */
function crearTarjetaPayin(payin) {
  const tarjeta = document.createElement('div');
  tarjeta.className = 'payin-pending-card';
  tarjeta.dataset.payinId = payin.id;

  // Calcular tiempo transcurrido
  const fechaCreacion = new Date(payin.created_at);
  const tiempoTranscurrido = calcularTiempoTranscurrido(fechaCreacion);

  // Mapeo de países
  const paisEmoji = {
    CO: '🇨🇴',
    AR: '🇦🇷',
    CL: '🇨🇱',
    BR: '🇧🇷',
    MX: '🇲🇽',
  };

  const html = `
    <div class="payin-pending-card-header">
      <div class="payin-info">
        <h3 class="payin-user">${payin.user_name || 'Usuario Desconocido'}</h3>
        <p class="payin-time">
          <i class="bx bx-time"></i>
          Pendiente hace ${tiempoTranscurrido}
        </p>
      </div>
      <div class="payin-amount">
        <span class="amount-value">${payin.amount.toLocaleString('es-CO', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}</span>
        <span class="amount-currency">${payin.currency}</span>
      </div>
    </div>

    <div class="payin-pending-card-body">
      <div class="payin-detail-grid">
        <div class="detail-item">
          <span class="detail-label">País</span>
          <span class="detail-value">${paisEmoji[payin.country] || payin.country} ${payin.country}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Método de Pago</span>
          <span class="detail-value">${payin.payment_method}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Descripción</span>
          <span class="detail-value">${payin.description || 'Sin descripción'}</span>
        </div>
      </div>
    </div>

    <div class="payin-pending-card-footer">
      <button type="button" class="btn btn-sm btn-outline" onclick="abrirDetallesPayin('${payin.id}')">
        <i class="bx bx-info-circle"></i>
        Detalles
      </button>
      <button type="button" class="btn btn-sm btn-danger" onclick="abrirModalRechazo('${payin.id}')">
        <i class="bx bx-x"></i>
        Rechazar
      </button>
      <button type="button" class="btn btn-sm btn-success" onclick="abrirModalAprobacion('${payin.id}')">
        <i class="bx bx-check"></i>
        Aprobar
      </button>
    </div>
  `;

  tarjeta.innerHTML = html;
  return tarjeta;
}

// ═════════════════════════════════════════════════════════════════════════════
// FUNCIONES DE MODALES
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Abre el modal de confirmación para aprobar un payin
 *
 * @param {string} payinId - ID del payin a aprobar
 */
function abrirModalAprobacion(payinId) {
  const payin = appState.payinsPendientes.find((p) => p.id === payinId);

  if (!payin) {
    mostrarNotificacion('Payin no encontrado', 'error');
    return;
  }

  appState.payinActual = payin;
  appState.accionActual = 'aprobar';

  // Llenar datos del modal
  document.getElementById('approveUserName').textContent = payin.user_name || 'Desconocido';
  document.getElementById('approveMonto').textContent = `${payin.amount.toLocaleString('es-CO')} ${payin.currency}`;
  document.getElementById('approveMoneda').textContent = payin.currency;
  document.getElementById('approvePais').textContent = payin.country;
  document.getElementById('approveMetodo').textContent = payin.payment_method;

  // Abrir modal
  abrirModal('modalConfirmarAprobacion');
}

/**
 * Abre el modal de confirmación para rechazar un payin
 *
 * @param {string} payinId - ID del payin a rechazar
 */
function abrirModalRechazo(payinId) {
  const payin = appState.payinsPendientes.find((p) => p.id === payinId);

  if (!payin) {
    mostrarNotificacion('Payin no encontrado', 'error');
    return;
  }

  appState.payinActual = payin;
  appState.accionActual = 'rechazar';

  // Llenar datos del modal
  document.getElementById('rejectUserName').textContent = payin.user_name || 'Desconocido';
  document.getElementById('rejectMonto').textContent = `${payin.amount.toLocaleString('es-CO')} ${payin.currency}`;

  // Limpiar textarea de razón
  document.getElementById('inputRazonRechazo').value = '';

  // Abrir modal
  abrirModal('modalConfirmarRechazo');
}

/**
 * Abre el modal con los detalles completos de un payin
 *
 * @param {string} payinId - ID del payin a ver en detalle
 */
function abrirDetallesPayin(payinId) {
  const payin = appState.payinsPendientes.find((p) => p.id === payinId);

  if (!payin) {
    mostrarNotificacion('Payin no encontrado', 'error');
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

  const html = `
    <div class="detail-section">
      <h4>Información del Usuario</h4>
      <div class="detail-row">
        <span class="detail-label">Nombre</span>
        <span class="detail-value">${payin.user_name || 'Desconocido'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">ID Usuario</span>
        <span class="detail-value">${payin.user_id}</span>
      </div>
    </div>

    <div class="detail-section">
      <h4>Datos del Payin</h4>
      <div class="detail-row">
        <span class="detail-label">ID Payin</span>
        <span class="detail-value">${payin.id}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Monto</span>
        <span class="detail-value">${payin.amount.toLocaleString('es-CO')} ${payin.currency}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">País</span>
        <span class="detail-value">${paisEmoji[payin.country] || payin.country} ${payin.country}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Método de Pago</span>
        <span class="detail-value">${payin.payment_method}</span>
      </div>
    </div>

    <div class="detail-section">
      <h4>Descripción</h4>
      <p>${payin.description || '(Sin descripción)'}</p>
    </div>

    <div class="detail-section">
      <h4>Timestamps</h4>
      <div class="detail-row">
        <span class="detail-label">Creado</span>
        <span class="detail-value">${new Date(payin.created_at).toLocaleString('es-CO')}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Modificado</span>
        <span class="detail-value">${payin.updated_at ? new Date(payin.updated_at).toLocaleString('es-CO') : 'N/A'}</span>
      </div>
    </div>
  `;

  detailContent.innerHTML = html;
  abrirModal('modalPayinPendingDetail');
}

// ═════════════════════════════════════════════════════════════════════════════
// FUNCIONES DE MANEJO DE ACCIONES
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Maneja la confirmación de aprobación de un payin
 * Realiza la llamada API para aprobar y actualiza la UI
 *
 * @async
 */
async function handleConfirmarAprobacion() {
  if (!appState.payinActual) return;

  const payinId = appState.payinActual.id;
  const btnConfirmar = document.getElementById('btnConfirmarAprobacion');

  try {
    // Deshabilitar botón
    btnConfirmar.disabled = true;
    btnConfirmar.innerHTML = '<i class="bx bx-loader-alt" style="animation: spin 1s linear infinite;"></i>Aprobando...';

    console.log(`✅ Aprobando payin: ${payinId}`);

    // Llamar API para aprobar
    const respuesta = await PayinService.aprobarPayin(payinId);

    if (!respuesta.success) {
      throw new Error(respuesta.error || 'Error al aprobar payin');
    }

    console.log('✅ Payin aprobado exitosamente');

    // Mostrar notificación
    mostrarNotificacion('Payin aprobado exitosamente', 'success');

    // Cerrar modal
    cerrarModal('modalConfirmarAprobacion');

    // Actualizar lista
    await cargarPayinsPendientes();
    actualizarEstadisticas();

  } catch (error) {
    console.error('❌ Error aprobando payin:', error);
    mostrarNotificacion(`Error: ${error.message}`, 'error');
  } finally {
    // Rehabilitar botón
    btnConfirmar.disabled = false;
    btnConfirmar.innerHTML = '<i class="bx bx-check"></i>Aprobar Payin';
  }
}

/**
 * Maneja la confirmación de rechazo de un payin
 * Realiza la llamada API para rechazar y actualiza la UI
 *
 * @async
 */
async function handleConfirmarRechazo() {
  if (!appState.payinActual) return;

  const payinId = appState.payinActual.id;
  const razon = document.getElementById('inputRazonRechazo').value.trim();
  const btnConfirmar = document.getElementById('btnConfirmarRechazo');

  try {
    // Deshabilitar botón
    btnConfirmar.disabled = true;
    btnConfirmar.innerHTML = '<i class="bx bx-loader-alt" style="animation: spin 1s linear infinite;"></i>Rechazando...';

    console.log(`❌ Rechazando payin: ${payinId}`);

    // Llamar API para rechazar
    const respuesta = await PayinService.rechazarPayin(payinId, {
      razon: razon || undefined,
    });

    if (!respuesta.success) {
      throw new Error(respuesta.error || 'Error al rechazar payin');
    }

    console.log('✅ Payin rechazado exitosamente');

    // Mostrar notificación
    mostrarNotificacion('Payin rechazado exitosamente', 'success');

    // Cerrar modal
    cerrarModal('modalConfirmarRechazo');

    // Actualizar lista
    await cargarPayinsPendientes();
    actualizarEstadisticas();

  } catch (error) {
    console.error('❌ Error rechazando payin:', error);
    mostrarNotificacion(`Error: ${error.message}`, 'error');
  } finally {
    // Rehabilitar botón
    btnConfirmar.disabled = false;
    btnConfirmar.innerHTML = '<i class="bx bx-x"></i>Rechazar';
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// FUNCIONES DE ESTADÍSTICAS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Actualiza las tarjetas de estadísticas con datos de los payins pendientes
 */
function actualizarEstadisticas() {
  // Total pendientes
  const pendingCount = appState.payinsPendientes.length;
  const statsPendingCount = document.getElementById('statsPendingCount');
  if (statsPendingCount) statsPendingCount.textContent = pendingCount;

  // Usuarios únicos
  const usuariosUnicos = new Set(appState.payinsPendientes.map((p) => p.user_id)).size;
  const statsUsersCount = document.getElementById('statsUsersCount');
  if (statsUsersCount) statsUsersCount.textContent = usuariosUnicos;

  // Monto total
  const montoTotal = appState.payinsPendientes.reduce((sum, p) => sum + (p.amount || 0), 0);
  const statsTotalAmount = document.getElementById('statsTotalAmount');
  if (statsTotalAmount) {
    statsTotalAmount.textContent = `$${montoTotal.toLocaleString('es-CO')}`;
  }

  // Tiempo promedio de espera
  if (appState.payinsPendientes.length > 0) {
    const tiempos = appState.payinsPendientes.map((p) => {
      const fecha = new Date(p.created_at);
      return Date.now() - fecha.getTime();
    });
    const promedio = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
    const horas = Math.floor(promedio / (1000 * 60 * 60));
    const minutos = Math.floor((promedio % (1000 * 60 * 60)) / (1000 * 60));

    const statsAverageTime = document.getElementById('statsAverageTime');
    if (statsAverageTime) {
      if (horas > 0) {
        statsAverageTime.textContent = `${horas}h ${minutos}m`;
      } else {
        statsAverageTime.textContent = `${minutos}m`;
      }
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// FUNCIONES UTILITARIAS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Calcula el tiempo transcurrido desde una fecha en formato legible
 *
 * @param {Date} fecha - Fecha de referencia
 * @returns {string} Tiempo transcurrido en formato legible (ej: "2h 30m")
 */
function calcularTiempoTranscurrido(fecha) {
  const ahora = new Date();
  const diferencia = ahora.getTime() - fecha.getTime();

  const segundos = Math.floor(diferencia / 1000);
  const minutos = Math.floor(segundos / 60);
  const horas = Math.floor(minutos / 60);
  const dias = Math.floor(horas / 24);

  if (dias > 0) return `${dias}d ${horas % 24}h`;
  if (horas > 0) return `${horas}h ${minutos % 60}m`;
  if (minutos > 0) return `${minutos}m`;
  return 'hace poco';
}

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
    cargarPayinsPendientes();
    actualizarEstadisticas();
  }
});

console.log('✅ payin-pending.js cargado correctamente');
