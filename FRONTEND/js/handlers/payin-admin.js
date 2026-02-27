/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PAYIN ADMIN - Lógica de Generación de Links de Pago
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Descripción:
 * Maneja toda la lógica para que administradores creen links de pago (payins)
 * en Vitawallet de forma segura y con validaciones completas.
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
 * Estado global de la aplicación
 * @type {Object}
 */
const appState = {
  usuarioSeleccionado: null,  // Usuario que recibe el dinero
  usuariosDisponibles: [],    // Lista de usuarios para buscar
  metodosPorPais: {},         // Métodos de pago cacheados
  payinsCreados: [],          // Lista de payins creados
  cargando: false,            // Indicador de loading
};

// ═════════════════════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Inicializa toda la página cuando carga el DOM
 * Se ejecuta automáticamente al cargar la página
 */
document.addEventListener('DOMContentLoaded', async function() {
  console.log('✅ Inicializando página de Payins Admin...');

  try {
    // Cargar usuarios para la búsqueda
    await cargarUsuariosDisponibles();

    // Cargar métodos de pago de todos los países
    await cargarTodosLosMetodos();

    // Cargar lista de payins creados
    await cargarListaPayins();

    // Configurar event listeners
    configurarEventListeners();

    // Cargar estadísticas
    actualizarEstadisticas();

    console.log('✅ Página inicializada correctamente');
  } catch (error) {
    console.error('❌ Error al inicializar:', error);
    mostrarError('Error al cargar la página. Por favor recarga.');
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BÚSQUEDA Y SELECCIÓN DE USUARIOS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Carga la lista de usuarios disponibles desde el backend
 * Se usa para la búsqueda y selección de quien recibe el dinero
 *
 * @async
 * @throws {Error} Si hay error al cargar usuarios
 */
async function cargarUsuariosDisponibles() {
  try {
    const response = await fetch('http://127.0.0.1:3000/api/user/list', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
      },
    });

    if (!response.ok) throw new Error('Error al cargar usuarios');

    const data = await response.json();
    appState.usuariosDisponibles = data.users || [];

    console.log(`✅ ${appState.usuariosDisponibles.length} usuarios cargados`);
  } catch (error) {
    console.error('❌ Error cargando usuarios:', error);
    appState.usuariosDisponibles = [];
  }
}

/**
 * Configura el event listener para búsqueda en tiempo real de usuarios
 * Filtra la lista mientras el admin escribe
 */
function configurarBusquedaUsuarios() {
  const inputBusqueda = document.getElementById('inputUserSearch');
  const listaUsuarios = document.getElementById('usuariosList');

  if (!inputBusqueda) return;

  inputBusqueda.addEventListener('input', function(e) {
    const termino = e.target.value.toLowerCase().trim();

    // Si el termino está vacío, ocultamos la lista
    if (!termino) {
      listaUsuarios.classList.remove('active');
      listaUsuarios.innerHTML = '';
      return;
    }

    // Filtrar usuarios que coincidan
    const usuariosFiltrados = appState.usuariosDisponibles.filter(usuario => {
      const nombre = (usuario.username || '').toLowerCase();
      const email = (usuario.email || '').toLowerCase();
      const documento = (usuario.documento || '').toLowerCase();

      return nombre.includes(termino) ||
             email.includes(termino) ||
             documento.includes(termino);
    });

    // Mostrar resultados
    if (usuariosFiltrados.length > 0) {
      listaUsuarios.classList.add('active');
      listaUsuarios.innerHTML = usuariosFiltrados
        .map(usuario => `
          <div class="user-item" onclick="seleccionarUsuario('${usuario.id}', '${usuario.username}')">
            <div class="user-item-avatar">
              ${(usuario.username || 'U')[0].toUpperCase()}
            </div>
            <div class="user-item-info">
              <p class="user-item-name">${usuario.username || 'Sin nombre'}</p>
              <p class="user-item-email">${usuario.email || 'Sin email'}</p>
            </div>
          </div>
        `)
        .join('');
    } else {
      listaUsuarios.classList.add('active');
      listaUsuarios.innerHTML = `
        <div style="padding: 1rem; text-align: center; color: #94a3b8;">
          <i class="bx bx-search-alt" style="font-size: 2rem; opacity: 0.5;"></i>
          <p>No se encontraron usuarios</p>
        </div>
      `;
    }
  });
}

/**
 * Selecciona un usuario como receptor del pago
 * Actualiza el estado y la UI
 *
 * @param {string} usuarioId - ID del usuario
 * @param {string} usuarioNombre - Nombre del usuario
 */
function seleccionarUsuario(usuarioId, usuarioNombre) {
  appState.usuarioSeleccionado = { id: usuarioId, nombre: usuarioNombre };

  // Actualizar UI
  document.getElementById('inputSelectedUserId').value = usuarioId;
  document.getElementById('inputUserSearch').value = '';
  document.getElementById('usuariosList').classList.remove('active');
  document.getElementById('usuariosList').innerHTML = '';

  // Mostrar usuario seleccionado
  const userSelected = document.getElementById('userSelected');
  document.getElementById('userSelectedName').textContent = usuarioNombre;
  userSelected.style.display = 'flex';

  console.log(`✅ Usuario seleccionado: ${usuarioNombre}`);
}

/**
 * Limpia la selección del usuario
 */
function limpiarUsuarioSeleccionado() {
  appState.usuarioSeleccionado = null;
  document.getElementById('inputSelectedUserId').value = '';
  document.getElementById('userSelected').style.display = 'none';
  document.getElementById('inputUserSearch').value = '';
  console.log('🔄 Selección de usuario limpiada');
}

// ═════════════════════════════════════════════════════════════════════════════
// MÉTODOS DE PAGO
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Carga todos los métodos de pago para cada país
 * Los cachea para evitar llamadas repetidas
 *
 * @async
 */
async function cargarTodosLosMetodos() {
  const paises = ['CO', 'AR', 'CL', 'BR', 'MX'];

  try {
    for (const pais of paises) {
      const response = await fetch(`http://127.0.0.1:3000/api/payment-links/methods/${pais}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          appState.metodosPorPais[pais] = data.methods || [];
          console.log(`✅ Métodos cargados para ${pais}`);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error cargando métodos:', error);
  }
}

/**
 * Carga y muestra los métodos de pago para el país seleccionado
 * Se ejecuta cuando el admin cambia el país en el formulario
 */
function cargarMetodosDePago() {
  const paisSelect = document.getElementById('selectPais');
  const metodoSelect = document.getElementById('selectMetodo');
  const pais = paisSelect.value;

  if (!pais) {
    metodoSelect.innerHTML = '<option value="">Selecciona método...</option>';
    document.getElementById('methodDescription').style.display = 'none';
    return;
  }

  const metodos = appState.metodosPorPais[pais] || [];

  if (metodos.length === 0) {
    metodoSelect.innerHTML = '<option value="">No hay métodos disponibles</option>';
    return;
  }

  metodoSelect.innerHTML = [
    '<option value="">Selecciona método...</option>',
    ...metodos.map(metodo => `
      <option value="${metodo.name}" data-id="${metodo.id}">
        ${metodo.name} - ${metodo.description || ''}
      </option>
    `)
  ].join('');

  console.log(`✅ ${metodos.length} métodos cargados para ${pais}`);
}

/**
 * Muestra la descripción del método seleccionado
 * Se ejecuta cuando el admin elige un método
 */
function mostrarDescripcionMetodo() {
  const metodoSelect = document.getElementById('selectMetodo');
  const metodo = metodoSelect.value;

  const metodosOptions = metodoSelect.querySelectorAll('option');
  const metodosArray = Array.from(metodosOptions);
  const metodoSeleccionado = metodosArray.find(opt => opt.value === metodo);

  if (metodo && metodoSeleccionado) {
    const descriptionDiv = document.getElementById('methodDescription');
    const descriptionText = document.getElementById('methodDescriptionText');

    descriptionText.textContent = metodoSeleccionado.textContent;
    descriptionDiv.style.display = 'block';
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// VALIDACIONES DEL FORMULARIO
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Valida que todos los campos obligatorios estén completados
 * Muestra errores inline en los campos
 *
 * @returns {boolean} True si el formulario es válido
 */
function validarFormulario() {
  let esValido = true;

  // Validar usuario seleccionado
  if (!appState.usuarioSeleccionado) {
    mostrarErrorCampo('Usuario no seleccionado', document.getElementById('inputUserSearch'));
    esValido = false;
  }

  // Validar monto
  const monto = parseFloat(document.getElementById('inputMonto').value);
  if (!monto || monto <= 0) {
    mostrarErrorCampo('El monto debe ser mayor a 0', document.getElementById('inputMonto'));
    esValido = false;
  }

  // Validar moneda
  const moneda = document.getElementById('selectMoneda').value;
  if (!moneda) {
    mostrarErrorCampo('Selecciona una moneda', document.getElementById('selectMoneda'));
    esValido = false;
  }

  // Validar país
  const pais = document.getElementById('selectPais').value;
  if (!pais) {
    mostrarErrorCampo('Selecciona un país', document.getElementById('selectPais'));
    esValido = false;
  }

  // Validar método de pago
  const metodo = document.getElementById('selectMetodo').value;
  if (!metodo) {
    mostrarErrorCampo('Selecciona un método de pago', document.getElementById('selectMetodo'));
    esValido = false;
  }

  return esValido;
}

/**
 * Muestra un mensaje de error en un campo específico
 *
 * @param {string} mensaje - Mensaje de error
 * @param {HTMLElement} elemento - Campo donde mostrar el error
 */
function mostrarErrorCampo(mensaje, elemento) {
  if (!elemento) return;

  // Encontrar el contenedor del error
  const grupo = elemento.closest('.form-group');
  if (!grupo) return;

  const errorDiv = grupo.querySelector('.form-error');
  if (errorDiv) {
    errorDiv.textContent = mensaje;
  }

  // Destacar el campo
  elemento.style.borderColor = '#f5576c';
}

/**
 * Limpia los errores de validación de todos los campos
 */
function limpiarErrores() {
  document.querySelectorAll('.form-error').forEach(error => {
    error.textContent = '';
  });

  document.querySelectorAll('.form-control').forEach(input => {
    input.style.borderColor = '';
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// ENVÍO DEL FORMULARIO
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Maneja el envío del formulario
 * Valida y muestra el modal de confirmación
 *
 * @param {Event} e - Evento del formulario
 */
function handleSubmitFormulario(e) {
  e.preventDefault();

  // Limpiar errores previos
  limpiarErrores();

  // Validar formulario
  if (!validarFormulario()) {
    mostrarError('Por favor completa todos los campos requeridos');
    return;
  }

  // Mostrar modal de confirmación
  mostrarModalConfirmacion();
}

/**
 * Muestra el modal de confirmación antes de crear el payin
 */
function mostrarModalConfirmacion() {
  const form = document.getElementById('formCrearPayin');
  const usuario = appState.usuarioSeleccionado.nombre;
  const monto = document.getElementById('inputMonto').value;
  const moneda = document.getElementById('selectMoneda').value;
  const pais = document.getElementById('selectPais').value;
  const metodo = document.getElementById('selectMetodo').value;

  // Llenar los datos en el modal
  document.getElementById('confirmUserName').textContent = usuario;
  document.getElementById('confirmMonto').textContent = `$${parseFloat(monto).toFixed(2)}`;
  document.getElementById('confirmMoneda').textContent = moneda;
  document.getElementById('confirmPais').textContent = pais;
  document.getElementById('confirmMetodo').textContent = metodo;

  // Mostrar modal
  abrirModal('modalConfirmarPayin');
}

/**
 * Maneja la confirmación final para crear el payin
 */
async function handleConfirmarCrearPayin() {
  const btnConfirmar = document.getElementById('btnConfirmarCrear');
  const btnCrear = document.getElementById('btnCrearPayin');

  try {
    // Deshabilitar botones durante el proceso
    btnConfirmar.disabled = true;
    btnCrear.disabled = true;

    appState.cargando = true;
    mostrarNotificacion('Creando link de pago...', 'info');

    // Preparar datos
    const datosPayin = {
      user_id: appState.usuarioSeleccionado.id,
      amount: parseFloat(document.getElementById('inputMonto').value),
      currency: document.getElementById('selectMoneda').value,
      country: document.getElementById('selectPais').value,
      payment_method: document.getElementById('selectMetodo').value,
      description: document.getElementById('inputDescripcion').value || 'Pago generado desde admin',
    };

    console.log('📤 Enviando datos:', datosPayin);

    // Verificar token y hacer test antes de crear payin
    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('auth_user');

    console.log('🔍 Debug - Token:', token ? `Present (${token.substring(0, 20)}...)` : 'MISSING');
    console.log('🔍 Debug - User:', user ? JSON.parse(user) : 'MISSING');
    console.log('🔍 Debug - Token length:', token?.length);

    if (!token) {
      throw new Error('No hay token de autenticación. Por favor, inicia sesión nuevamente.');
    }

    // Test del endpoint de autenticación ANTES de crear payin
    console.log('🧪 Haciendo test de autenticación...');
    const testResponse = await fetch('http://127.0.0.1:3000/api/payin-test', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const testData = await testResponse.json();
    console.log('🧪 Test response:', testData);

    if (!testResponse.ok) {
      console.error('❌ Test falló. El token no es válido.');
      console.error('Response:', testData);
      throw new Error(`Autenticación falló: ${testData.error || testResponse.status}`);
    }

    console.log('✅ Autenticación verificada correctamente');

    const response = await fetch('http://127.0.0.1:3000/api/payment-links/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(datosPayin),
    });

    console.log('📡 Response status:', response.status);

    const result = await response.json();

    if (!response.ok) {
      // Manejo específico de errores
      if (response.status === 402) {
        const errorMsg = `❌ Saldo Insuficiente\n\nEl usuario no tiene saldo suficiente.\n\nRequerido: ${result.required_amount} ${result.currency}\nDisponible: ${result.available_balance} ${result.currency}`;
        throw new Error(errorMsg);
      } else if (response.status === 400) {
        throw new Error(`❌ Datos inválidos: ${result.error}`);
      } else if (response.status === 401) {
        throw new Error(`❌ No autenticado: ${result.error}`);
      }
      throw new Error(result.error || `Error ${response.status}: ${response.statusText}`);
    }

    // Éxito
    console.log('✅ Payin creado:', result);
    mostrarNotificacion('¡Link de pago creado exitosamente!', 'success');

    // Cerrar modal y limpiar formulario
    cerrarModal('modalConfirmarPayin');
    document.getElementById('formCrearPayin').reset();
    limpiarUsuarioSeleccionado();

    // Recargar lista de payins
    await cargarListaPayins();
    actualizarEstadisticas();

  } catch (error) {
    console.error('❌ Error:', error);
    mostrarError(`Error: ${error.message}`);
  } finally {
    appState.cargando = false;
    btnConfirmar.disabled = false;
    btnCrear.disabled = false;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// LISTA DE PAYINS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Carga la lista de payins creados desde el backend
 *
 * @async
 */
async function cargarListaPayins() {
  try {
    const loading = document.getElementById('loadingPayins');
    const container = document.getElementById('payinsTableContainer');
    const empty = document.getElementById('emptyPayins');

    // Mostrar loading
    loading.style.display = 'block';
    container.style.display = 'none';
    empty.style.display = 'none';

    const response = await fetch('http://127.0.0.1:3000/api/payin-requests', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
      },
    });

    if (!response.ok) throw new Error('Error al cargar payins');

    const data = await response.json();
    appState.payinsCreados = data.payins || [];

    if (appState.payinsCreados.length === 0) {
      empty.style.display = 'flex';
      loading.style.display = 'none';
      return;
    }

    // Renderizar tabla
    renderizarTablaPayins(appState.payinsCreados);

    container.style.display = 'block';
    loading.style.display = 'none';

    console.log(`✅ ${appState.payinsCreados.length} payins cargados`);
  } catch (error) {
    console.error('❌ Error cargando payins:', error);
    document.getElementById('loadingPayins').style.display = 'none';
    document.getElementById('emptyPayins').style.display = 'flex';
  }
}

/**
 * Renderiza la tabla de payins con todos los datos
 *
 * @param {Array} payins - Array de payins a mostrar
 */
function renderizarTablaPayins(payins) {
  const tbody = document.getElementById('payinsTableBody');

  tbody.innerHTML = payins
    .map(payin => `
      <tr>
        <td>${payin.usuario_nombre || 'N/A'}</td>
        <td>$${parseFloat(payin.monto).toFixed(2)}</td>
        <td>${payin.pais}</td>
        <td>${payin.metodo_pago}</td>
        <td>
          <span class="status-badge status-${payin.status}">
            ${obtenerEtiquetaEstado(payin.status)}
          </span>
        </td>
        <td>${formatearFecha(payin.created_at)}</td>
        <td>
          <div class="table-actions">
            <button class="action-btn" onclick="abrirPayinDetail('${payin.id}')" title="Ver detalles">
              <i class="bx bx-show"></i>
            </button>
            ${payin.status === 'pending' ? `
              <button class="action-btn" onclick="aprobarPayin('${payin.id}')" title="Aprobar">
                <i class="bx bx-check" style="color: #10b981;"></i>
              </button>
              <button class="action-btn" onclick="rechazarPayin('${payin.id}')" title="Rechazar">
                <i class="bx bx-x" style="color: #f5576c;"></i>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `)
    .join('');
}

/**
 * Obtiene la etiqueta legible del estado
 *
 * @param {string} estado - Estado del payin
 * @returns {string} Etiqueta formateada
 */
function obtenerEtiquetaEstado(estado) {
  const etiquetas = {
    'pending': '⏳ Pendiente',
    'approved': '✅ Aprobado',
    'rejected': '❌ Rechazado',
    'completed': '💰 Completado',
    'expired': '⏰ Expirado',
  };
  return etiquetas[estado] || estado;
}

/**
 * Formatea una fecha al formato legible
 *
 * @param {string} fecha - Fecha en ISO format
 * @returns {string} Fecha formateada
 */
function formatearFecha(fecha) {
  const date = new Date(fecha);
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// ACCIONES EN LA TABLA
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Abre el modal con detalles del payin
 *
 * @param {string} payinId - ID del payin
 */
function abrirPayinDetail(payinId) {
  const payin = appState.payinsCreados.find(p => p.id === payinId);
  if (!payin) return;

  const contenido = `
    <div class="payin-detail">
      <div class="detail-section">
        <h4>Información General</h4>
        <p><strong>ID Payin:</strong> ${payin.id}</p>
        <p><strong>Usuario:</strong> ${payin.usuario_nombre}</p>
        <p><strong>Estado:</strong> ${obtenerEtiquetaEstado(payin.status)}</p>
      </div>

      <div class="detail-section">
        <h4>Monto</h4>
        <p><strong>Cantidad:</strong> $${parseFloat(payin.monto).toFixed(2)}</p>
        <p><strong>Moneda:</strong> ${payin.currency}</p>
      </div>

      <div class="detail-section">
        <h4>Ubicación</h4>
        <p><strong>País:</strong> ${payin.pais}</p>
        <p><strong>Método:</strong> ${payin.metodo_pago}</p>
      </div>

      <div class="detail-section">
        <h4>Fechas</h4>
        <p><strong>Creado:</strong> ${formatearFecha(payin.created_at)}</p>
        ${payin.approved_at ? `<p><strong>Aprobado:</strong> ${formatearFecha(payin.approved_at)}</p>` : ''}
      </div>

      ${payin.descripcion ? `
        <div class="detail-section">
          <h4>Descripción</h4>
          <p>${payin.descripcion}</p>
        </div>
      ` : ''}
    </div>
  `;

  document.getElementById('payinDetailContent').innerHTML = contenido;
  abrirModal('modalPayinDetail');
}

/**
 * Aprueba un payin pendiente
 * Genera el link en Vitawallet
 *
 * @async
 * @param {string} payinId - ID del payin a aprobar
 */
async function aprobarPayin(payinId) {
  if (!confirm('¿Estás seguro de que deseas aprobar este payin?')) return;

  try {
    const response = await fetch(`/api/payin-requests/${payinId}/approve`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
      },
    });

    const result = await response.json();

    if (!response.ok) throw new Error(result.error || 'Error al aprobar');

    mostrarNotificacion('✅ Payin aprobado correctamente', 'success');
    await cargarListaPayins();
    actualizarEstadisticas();

  } catch (error) {
    console.error('❌ Error:', error);
    mostrarError(`Error: ${error.message}`);
  }
}

/**
 * Rechaza un payin pendiente
 *
 * @async
 * @param {string} payinId - ID del payin a rechazar
 */
async function rechazarPayin(payinId) {
  const razon = prompt('¿Razón del rechazo? (Opcional)');
  if (razon === null) return; // Usuario canceló

  try {
    const response = await fetch(`/api/payin-requests/${payinId}/reject`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
      },
      body: JSON.stringify({ razon: razon || '' }),
    });

    const result = await response.json();

    if (!response.ok) throw new Error(result.error || 'Error al rechazar');

    mostrarNotificacion('❌ Payin rechazado', 'info');
    await cargarListaPayins();
    actualizarEstadisticas();

  } catch (error) {
    console.error('❌ Error:', error);
    mostrarError(`Error: ${error.message}`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// ESTADÍSTICAS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Actualiza las tarjetas de estadísticas
 * Se ejecuta cuando cambia la lista de payins
 */
function actualizarEstadisticas() {
  const payins = appState.payinsCreados;

  // Links activos (aprobados o pendientes)
  const activos = payins.filter(p => ['pending', 'approved'].includes(p.status)).length;
  document.getElementById('statsActiveLinks').textContent = activos;

  // Completados hoy
  const hoy = new Date().toDateString();
  const completadosHoy = payins.filter(p =>
    p.status === 'completed' &&
    new Date(p.completed_at).toDateString() === hoy
  ).length;
  document.getElementById('statsCompletedToday').textContent = completadosHoy;

  // Monto total recibido hoy
  const montoTotal = payins
    .filter(p => p.status === 'completed' && new Date(p.completed_at).toDateString() === hoy)
    .reduce((sum, p) => sum + parseFloat(p.monto), 0);
  document.getElementById('statsTotalAmount').textContent = `$${montoTotal.toFixed(2)}`;

  // Pendientes de aprobación
  const pendientes = payins.filter(p => p.status === 'pending').length;
  document.getElementById('statsPending').textContent = pendientes;
}

// ═════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE EVENT LISTENERS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Configura todos los event listeners de la página
 */
function configurarEventListeners() {
  // Búsqueda de usuarios
  configurarBusquedaUsuarios();

  // Formulario
  const form = document.getElementById('formCrearPayin');
  if (form) {
    form.addEventListener('submit', handleSubmitFormulario);
  }

  // Selects
  document.getElementById('selectPais').addEventListener('change', cargarMetodosDePago);
  document.getElementById('selectMetodo').addEventListener('change', mostrarDescripcionMetodo);

  // Modal de confirmación
  document.getElementById('btnConfirmarCrear').addEventListener('click', handleConfirmarCrearPayin);

  // Búsqueda en tabla
  const searchPayins = document.getElementById('searchPayins');
  if (searchPayins) {
    searchPayins.addEventListener('input', function(e) {
      const termino = e.target.value.toLowerCase();
      const payinsFiltrados = appState.payinsCreados.filter(p =>
        p.usuario_nombre.toLowerCase().includes(termino) ||
        p.monto.toString().includes(termino)
      );
      renderizarTablaPayins(payinsFiltrados);
    });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// UTILIDADES - MODALES Y NOTIFICACIONES
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Abre un modal por su ID
 *
 * @param {string} modalId - ID del modal a abrir
 */
function abrirModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    console.log(`📗 Modal abierto: ${modalId}`);
  }
}

/**
 * Cierra un modal por su ID
 *
 * @param {string} modalId - ID del modal a cerrar
 */
function cerrarModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    console.log(`📕 Modal cerrado: ${modalId}`);
  }
}

/**
 * Muestra una notificación de éxito/error/info
 *
 * @param {string} mensaje - Mensaje a mostrar
 * @param {string} tipo - Tipo: 'success' | 'error' | 'info' | 'warning'
 */
function mostrarNotificacion(mensaje, tipo = 'info') {
  console.log(`📢 [${tipo.toUpperCase()}] ${mensaje}`);

  // Aquí se integraría con el sistema de notificaciones global
  // Por ahora solo logueamos
}

/**
 * Muestra un mensaje de error
 *
 * @param {string} mensaje - Mensaje de error
 */
function mostrarError(mensaje) {
  console.error(`❌ ${mensaje}`);
  alert(`❌ Error: ${mensaje}`);
}

/**
 * Navega a la página de perfil del usuario
 */
function navigateToProfile() {
  window.location.href = './myaccount.html';
}

/**
 * Navega a la página de configuración
 */
function navigateToSettings() {
  window.location.href = './settings.html';
}

/**
 * Cierra la sesión del usuario
 */
function logout() {
  localStorage.clear();
  window.location.href = './login.html';
}

console.log('✅ Script payin-admin.js cargado correctamente');
