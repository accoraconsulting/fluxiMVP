/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PAYIN SERVICE - Capa de Servicios para Payins
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Descripción:
 * Centraliza todas las llamadas HTTP al backend para operaciones de payins.
 * Maneja autenticación, errores y transformación de datos.
 *
 * Autor: FLUXI Team
 * Fecha: 2026-02-23
 * Versión: 1.0.0
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ═════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN BASE
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Configuración base para peticiones HTTP
 * @type {Object}
 */
const API_CONFIG = {
  baseURL: 'http://127.0.0.1:3000/api',
  timeout: 30000, // 30 segundos
};

/**
 * Obtiene el token JWT de la sesión actual
 *
 * @returns {string} Token JWT del usuario autenticado
 */
function obtenerToken() {
  return localStorage.getItem('auth_token') || '';
}

/**
 * Headers por defecto para todas las peticiones
 *
 * @returns {Object} Headers configurados
 */
function obtenerHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${obtenerToken()}`,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// MÉTODOS DE PAGO
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Obtiene los métodos de pago disponibles para un país específico
 *
 * Endpoint: GET /api/payment-links/methods/:country
 *
 * @async
 * @param {string} pais - Código ISO del país (CO, AR, CL, BR, MX)
 * @returns {Promise<Object>} Objeto con métodos disponibles
 * @throws {Error} Si hay error en la petición
 *
 * @example
 * const metodos = await obtenerMetodosPago('CO');
 * console.log(metodos.methods); // Array de métodos
 */
async function obtenerMetodosPago(pais) {
  try {
    console.log(`📥 Obteniendo métodos de pago para ${pais}...`);

    const response = await fetch(
      `${API_CONFIG.baseURL}/payment-links/methods/${pais}`,
      {
        method: 'GET',
        headers: obtenerHeaders(),
        timeout: API_CONFIG.timeout,
      }
    );

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'No se pudieron obtener los métodos');
    }

    console.log(`✅ ${data.methods?.length || 0} métodos obtenidos`);
    return data;

  } catch (error) {
    console.error('❌ Error obteniendo métodos:', error);
    throw error;
  }
}

/**
 * Obtiene los precios y comisiones para un país
 *
 * Endpoint: GET /api/payment-links/prices/:country
 *
 * @async
 * @param {string} pais - Código ISO del país
 * @returns {Promise<Object>} Información de precios
 */
async function obtenerPreciosPorPais(pais) {
  try {
    console.log(`📥 Obteniendo precios para ${pais}...`);

    const response = await fetch(
      `${API_CONFIG.baseURL}/payment-links/prices/${pais}`,
      {
        method: 'GET',
        headers: obtenerHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Error ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ Precios obtenidos`);
    return data;

  } catch (error) {
    console.error('❌ Error obteniendo precios:', error);
    throw error;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// CREACIÓN Y VALIDACIÓN DE PAYINS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Valida los datos de un payin antes de enviarlo
 *
 * Endpoint: POST /api/payment-links/validate
 *
 * @async
 * @param {Object} datos - Datos a validar
 * @param {number} datos.amount - Monto del pago
 * @param {string} datos.currency - Moneda (USD, COP, EUR)
 * @param {string} datos.country - País destino
 * @param {string} datos.payment_method - Método de pago
 * @returns {Promise<Object>} Resultado de la validación
 */
async function validarDatosPayin(datos) {
  try {
    console.log('🔍 Validando datos del payin...');

    const response = await fetch(
      `${API_CONFIG.baseURL}/payment-links/validate`,
      {
        method: 'POST',
        headers: obtenerHeaders(),
        body: JSON.stringify(datos),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Error en validación');
    }

    console.log('✅ Datos válidos');
    return result;

  } catch (error) {
    console.error('❌ Error validando:', error);
    throw error;
  }
}

/**
 * Crea un nuevo link de pago (payin) en Vitawallet
 *
 * Endpoint: POST /api/payment-links/generate
 *
 * Este endpoint:
 * 1. Crea un payin_request en la BD con estado 'pending'
 * 2. Requiere autenticación JWT
 * 3. Genera un UUID único para el payin
 * 4. Calcula comisiones según Vitawallet
 *
 * @async
 * @param {Object} datos - Datos del payin
 * @param {string} datos.user_id - ID del usuario que recibe
 * @param {number} datos.amount - Monto a recibir
 * @param {string} datos.currency - Moneda (USD, COP, EUR)
 * @param {string} datos.country - País (CO, AR, CL, BR, MX)
 * @param {string} datos.payment_method - Método (PSE, Nequi, TDC, etc)
 * @param {string} [datos.description] - Descripción opcional
 * @param {Object} [datos.metadata] - Metadata adicional
 * @returns {Promise<Object>} Objeto con detalles del payin creado
 * @throws {Error} Si hay error en la creación
 *
 * @example
 * const payin = await crearPayin({
 *   user_id: 'user-123',
 *   amount: 1000,
 *   currency: 'COP',
 *   country: 'CO',
 *   payment_method: 'PSE',
 *   description: 'Pago por servicios'
 * });
 */
async function crearPayin(datos) {
  try {
    console.log('📤 Creando payin con datos:', datos);

    // Validar datos primero
    await validarDatosPayin(datos);

    const response = await fetch(
      `${API_CONFIG.baseURL}/payment-links/generate`,
      {
        method: 'POST',
        headers: obtenerHeaders(),
        body: JSON.stringify(datos),
        timeout: API_CONFIG.timeout,
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Error ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Error creando payin');
    }

    console.log('✅ Payin creado:', result.payin_id);
    return result;

  } catch (error) {
    console.error('❌ Error creando payin:', error);
    throw error;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// CONSULTA DE PAYINS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Obtiene el estado actual de un payin específico
 *
 * Endpoint: GET /api/payment-links/:payin_id
 *
 * @async
 * @param {string} payinId - ID del payin a consultar
 * @returns {Promise<Object>} Detalles del payin
 * @throws {Error} Si el payin no existe o hay error
 */
async function obtenerEstadoPayin(payinId) {
  try {
    console.log(`📥 Obteniendo estado de payin: ${payinId}`);

    const response = await fetch(
      `${API_CONFIG.baseURL}/payment-links/${payinId}`,
      {
        method: 'GET',
        headers: obtenerHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Error ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Payin no encontrado');
    }

    console.log('✅ Estado obtenido');
    return data;

  } catch (error) {
    console.error('❌ Error obteniendo estado:', error);
    throw error;
  }
}

/**
 * Obtiene la lista de payins del usuario actual (admin)
 *
 * Endpoint: GET /api/payin-requests
 *
 * @async
 * @param {Object} [opciones] - Opciones de filtrado
 * @param {string} [opciones.estado] - Filtrar por estado (pending, approved, etc)
 * @param {number} [opciones.limite] - Cantidad máxima de resultados
 * @param {number} [opciones.pagina] - Número de página
 * @returns {Promise<Object>} Lista de payins del usuario
 */
async function obtenerMisPayins(opciones = {}) {
  try {
    console.log('📥 Obteniendo mis payins...');

    // Construir query string
    const params = new URLSearchParams();
    if (opciones.estado) params.append('status', opciones.estado);
    if (opciones.limite) params.append('limit', opciones.limite);
    if (opciones.pagina) params.append('page', opciones.pagina);

    const url = `${API_CONFIG.baseURL}/payin-requests${params.toString() ? '?' + params : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: obtenerHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Error cargando payins');
    }

    console.log(`✅ ${data.payins?.length || 0} payins cargados`);
    return data;

  } catch (error) {
    console.error('❌ Error cargando payins:', error);
    throw error;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// APROBACIÓN Y RECHAZO DE PAYINS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Aprueba un payin pendiente
 *
 * Endpoint: PATCH /api/payin-requests/:id/approve
 *
 * Cuando se aprueba:
 * 1. Se genera el link en Vitawallet
 * 2. El estado cambia a 'approved'
 * 3. Se notifica al usuario receptos
 * 4. Se bloquea el saldo si es necesario
 *
 * @async
 * @param {string} payinId - ID del payin a aprobar
 * @param {Object} [datos] - Datos adicionales (opcional)
 * @returns {Promise<Object>} Payin actualizado
 * @throws {Error} Si hay error en la aprobación
 */
async function aprobarPayin(payinId, datos = {}) {
  try {
    console.log(`✅ Aprobando payin: ${payinId}`);

    const response = await fetch(
      `${API_CONFIG.baseURL}/payin-requests/${payinId}/approve`,
      {
        method: 'PATCH',
        headers: obtenerHeaders(),
        body: JSON.stringify(datos),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al aprobar');
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'No se pudo aprobar');
    }

    console.log('✅ Payin aprobado correctamente');
    return result;

  } catch (error) {
    console.error('❌ Error aprobando payin:', error);
    throw error;
  }
}

/**
 * Rechaza un payin pendiente
 *
 * Endpoint: PATCH /api/payin-requests/:id/reject
 *
 * Cuando se rechaza:
 * 1. El estado cambia a 'rejected'
 * 2. Se notifica al usuario receptor
 * 3. Se guarda la razón del rechazo
 *
 * @async
 * @param {string} payinId - ID del payin a rechazar
 * @param {Object} datos - Datos del rechazo
 * @param {string} [datos.razon] - Razón del rechazo
 * @returns {Promise<Object>} Payin actualizado
 * @throws {Error} Si hay error en el rechazo
 */
async function rechazarPayin(payinId, datos = {}) {
  try {
    console.log(`❌ Rechazando payin: ${payinId}`);

    const response = await fetch(
      `${API_CONFIG.baseURL}/payin-requests/${payinId}/reject`,
      {
        method: 'PATCH',
        headers: obtenerHeaders(),
        body: JSON.stringify(datos),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al rechazar');
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'No se pudo rechazar');
    }

    console.log('✅ Payin rechazado correctamente');
    return result;

  } catch (error) {
    console.error('❌ Error rechazando payin:', error);
    throw error;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// USUARIOS (Para búsqueda)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Obtiene la lista de usuarios para seleccionar como receptores
 *
 * Endpoint: GET /api/user/list
 *
 * @async
 * @returns {Promise<Object>} Lista de usuarios
 */
async function obtenerListaUsuarios() {
  try {
    console.log('📥 Obteniendo lista de usuarios...');

    const response = await fetch(
      `${API_CONFIG.baseURL}/user/list`,
      {
        method: 'GET',
        headers: obtenerHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Error ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Error cargando usuarios');
    }

    console.log(`✅ ${data.users?.length || 0} usuarios cargados`);
    return data;

  } catch (error) {
    console.error('❌ Error cargando usuarios:', error);
    throw error;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// WEBHOOKS Y EVENTOS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Obtiene los eventos recientes de payins (para actualizaciones en tiempo real)
 *
 * Endpoint: GET /api/payin-events
 *
 * @async
 * @param {Object} [opciones] - Opciones
 * @param {number} [opciones.ultimos] - Últimos N eventos
 * @returns {Promise<Object>} Eventos de payins
 */
async function obtenerEventosPayins(opciones = {}) {
  try {
    const params = new URLSearchParams();
    if (opciones.ultimos) params.append('last', opciones.ultimos);

    const response = await fetch(
      `${API_CONFIG.baseURL}/payin-events${params.toString() ? '?' + params : ''}`,
      {
        method: 'GET',
        headers: obtenerHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Error ${response.status}`);
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error('❌ Error obteniendo eventos:', error);
    throw error;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// EXPORTAR SERVICIO
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Objeto exportado con todos los métodos del servicio
 * Facilita importación y uso consistente
 *
 * @example
 * import PayinService from './payin.service.js';
 * const metodos = await PayinService.obtenerMetodosPago('CO');
 */
const PayinService = {
  obtenerMetodosPago,
  obtenerPreciosPorPais,
  validarDatosPayin,
  crearPayin,
  obtenerEstadoPayin,
  obtenerMisPayins,
  aprobarPayin,
  rechazarPayin,
  obtenerListaUsuarios,
  obtenerEventosPayins,
};

console.log('✅ PayinService cargado correctamente');
