/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PAYIN REALTIME SERVICE - Actualizaciones en Tiempo Real
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Descripción:
 * Servicio para escuchar eventos de payins en tiempo real.
 * Usa polling a /api/payin-events para detectar cambios en estados.
 * Emite eventos personalizados que las vistas pueden escuchar.
 *
 * Funcionalidades:
 * 1. Polling automático cada 5 segundos
 * 2. Detecta cambios en estado de payins
 * 3. Emite CustomEvents cuando hay cambios
 * 4. Notificaciones automáticas al usuario
 * 5. Actualiza vistas sin necesidad de refresh
 *
 * Eventos emitidos:
 * - 'payin:statusChanged' - Cuando cambia el estado de un payin
 * - 'payin:completed' - Cuando se completa un pago
 * - 'payin:expired' - Cuando expira un link
 * - 'payin:rejected' - Cuando se rechaza un payin
 *
 * Autor: FLUXI Team
 * Fecha: 2026-02-23
 * Versión: 1.0.0
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ═════════════════════════════════════════════════════════════════════════════
// ESTADO GLOBAL DEL SERVICIO
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Estado interno del servicio de real-time
 * @type {Object}
 */
const RealtimeState = {
  isRunning: false,
  pollingInterval: null,
  lastEventTimestamp: null,
  cachedEvents: new Map(), // Caché de eventos para detectar cambios
  pollingFrequency: 5000, // 5 segundos
};

// ═════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  pollingIntervalMs: 5000, // Polling cada 5 segundos
  maxRetries: 3,
  retryDelayMs: 1000,
};

// ═════════════════════════════════════════════════════════════════════════════
// OBTENER TOKEN JWT
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Obtiene el token JWT de localStorage
 * @returns {string} Token JWT o cadena vacía
 */
function obtenerToken() {
  return localStorage.getItem('auth_token') || '';
}

/**
 * Obtiene headers para las peticiones
 * @returns {Object} Headers configurados
 */
function obtenerHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${obtenerToken()}`,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// FUNCIONES DE POLLING
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Obtiene los últimos eventos de payins del API
 * @async
 * @returns {Promise<Array>} Array de eventos
 */
async function obtenerEventosPayins() {
  try {
    const response = await fetch('http://127.0.0.1:3000/api/payin-events?last=20', {
      method: 'GET',
      headers: obtenerHeaders(),
      timeout: 10000,
    });

    if (!response.ok) {
      console.warn(`⚠️ Error obteniendo eventos: ${response.status}`);
      return [];
    }

    const data = await response.json();

    if (!data.success || !data.events) {
      console.warn('⚠️ Respuesta vacía de eventos');
      return [];
    }

    return data.events;
  } catch (error) {
    console.error('❌ Error en polling de eventos:', error);
    return [];
  }
}

/**
 * Detecta cambios en los eventos comparándolos con el caché
 * @param {Array} eventos - Eventos actuales
 * @returns {Array} Array de eventos que cambiaron
 */
function detectarCambios(eventos) {
  const cambios = [];

  eventos.forEach((evento) => {
    const eventKey = `${evento.payin_id}_${evento.status}`;
    const eventoAnterior = RealtimeState.cachedEvents.get(evento.payin_id);

    // Si es un payin nuevo o cambió de estado
    if (!eventoAnterior || eventoAnterior.status !== evento.status) {
      cambios.push({
        ...evento,
        cambio: eventoAnterior ? 'statusChange' : 'new',
        statusAnterior: eventoAnterior?.status || null,
      });

      // Actualizar caché
      RealtimeState.cachedEvents.set(evento.payin_id, evento);
    }
  });

  return cambios;
}

/**
 * Emite un evento personalizado con los datos del payin
 * @param {string} nombreEvento - Nombre del evento a emitir
 * @param {Object} datos - Datos del evento
 */
function emitirEventoPayin(nombreEvento, datos) {
  const evento = new CustomEvent(nombreEvento, {
    detail: datos,
    bubbles: true,
  });

  document.dispatchEvent(evento);
  console.log(`📢 Evento emitido: ${nombreEvento}`, datos);
}

/**
 * Procesa un cambio de evento y emite los eventos correspondientes
 * @param {Object} cambio - Cambio detectado
 */
function procesarCambio(cambio) {
  const { payin_id, status, statusAnterior, cambio: tipoCambio } = cambio;

  console.log(`🔄 Cambio detectado: ${payin_id} - ${statusAnterior} → ${status}`);

  // Evento genérico de cambio
  emitirEventoPayin('payin:statusChanged', {
    payinId: payin_id,
    statusAnterior,
    statusNuevo: status,
    timestamp: new Date().toISOString(),
  });

  // Eventos específicos según el nuevo estado
  switch (status) {
    case 'completed':
      emitirEventoPayin('payin:completed', {
        payinId: payin_id,
        mensaje: '✅ Pago completado',
      });
      break;

    case 'expired':
      emitirEventoPayin('payin:expired', {
        payinId: payin_id,
        mensaje: '⏱️ Link expirado',
      });
      break;

    case 'rejected':
      emitirEventoPayin('payin:rejected', {
        payinId: payin_id,
        mensaje: '❌ Payin rechazado',
      });
      break;

    case 'approved':
      if (tipoCambio === 'statusChange') {
        emitirEventoPayin('payin:approved', {
          payinId: payin_id,
          mensaje: '✅ Payin aprobado - Link generado',
        });
      }
      break;
  }
}

/**
 * Ciclo de polling - Se ejecuta periódicamente
 * @async
 */
async function cicloPolling() {
  try {
    // Obtener eventos del API
    const eventos = await obtenerEventosPayins();

    if (eventos.length === 0) {
      return; // Sin eventos nuevos
    }

    // Detectar cambios
    const cambios = detectarCambios(eventos);

    // Procesar cada cambio
    cambios.forEach((cambio) => {
      procesarCambio(cambio);
    });

    // Actualizar timestamp
    RealtimeState.lastEventTimestamp = new Date();
  } catch (error) {
    console.error('❌ Error en ciclo de polling:', error);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// CONTROL DEL SERVICIO
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Inicia el servicio de real-time
 * Comienza el polling automático
 */
export function iniciarRealtimeService() {
  if (RealtimeState.isRunning) {
    console.warn('⚠️ Servicio de real-time ya está corriendo');
    return;
  }

  console.log('🚀 Iniciando servicio de real-time...');

  RealtimeState.isRunning = true;

  // Ejecutar polling inmediatamente
  cicloPolling();

  // Configurar polling periódico
  RealtimeState.pollingInterval = setInterval(() => {
    cicloPolling();
  }, CONFIG.pollingIntervalMs);

  console.log(`✅ Servicio de real-time iniciado (polling cada ${CONFIG.pollingIntervalMs}ms)`);
}

/**
 * Detiene el servicio de real-time
 */
export function detenerRealtimeService() {
  if (!RealtimeState.isRunning) {
    console.warn('⚠️ Servicio de real-time no está corriendo');
    return;
  }

  console.log('🛑 Deteniendo servicio de real-time...');

  if (RealtimeState.pollingInterval) {
    clearInterval(RealtimeState.pollingInterval);
    RealtimeState.pollingInterval = null;
  }

  RealtimeState.isRunning = false;
  console.log('✅ Servicio de real-time detenido');
}

/**
 * Reinicia el servicio
 */
export function reiniciarRealtimeService() {
  console.log('🔄 Reiniciando servicio de real-time...');
  detenerRealtimeService();
  setTimeout(() => {
    iniciarRealtimeService();
  }, 1000);
}

/**
 * Obtiene el estado actual del servicio
 * @returns {Object} Estado del servicio
 */
export function obtenerEstadoRealtimeService() {
  return {
    isRunning: RealtimeState.isRunning,
    lastEventTimestamp: RealtimeState.lastEventTimestamp,
    pollingFrequency: CONFIG.pollingIntervalMs,
    eventsCached: RealtimeState.cachedEvents.size,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// ESCUCHADORES DE EVENTOS - Helpers para las vistas
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Suscribe a cambios en un payin específico
 * @param {string} payinId - ID del payin a monitorear
 * @param {Function} callback - Función a ejecutar cuando hay cambios
 * @returns {Function} Función para desuscribirse
 */
export function suscribirPayinCambios(payinId, callback) {
  const handler = (event) => {
    if (event.detail.payinId === payinId) {
      callback(event.detail);
    }
  };

  document.addEventListener('payin:statusChanged', handler);

  // Retornar función para desuscribirse
  return () => {
    document.removeEventListener('payin:statusChanged', handler);
  };
}

/**
 * Suscribe a pagos completados
 * @param {Function} callback - Función a ejecutar
 * @returns {Function} Función para desuscribirse
 */
export function suscribirPagosCompletados(callback) {
  const handler = (event) => {
    callback(event.detail);
  };

  document.addEventListener('payin:completed', handler);

  return () => {
    document.removeEventListener('payin:completed', handler);
  };
}

/**
 * Suscribe a cualquier cambio de payin
 * @param {Function} callback - Función a ejecutar
 * @returns {Function} Función para desuscribirse
 */
export function suscribirTodosCambios(callback) {
  const eventNames = ['payin:statusChanged', 'payin:completed', 'payin:expired', 'payin:rejected', 'payin:approved'];
  const handlers = {};

  eventNames.forEach((eventName) => {
    handlers[eventName] = (event) => {
      callback({
        evento: eventName,
        datos: event.detail,
      });
    };
    document.addEventListener(eventName, handlers[eventName]);
  });

  return () => {
    eventNames.forEach((eventName) => {
      document.removeEventListener(eventName, handlers[eventName]);
    });
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// AUTO-INICIALIZACIÓN
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Auto-inicia el servicio cuando el documento está listo
 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Iniciar solo si hay autenticación
    const token = localStorage.getItem('auth_token');
    if (token) {
      iniciarRealtimeService();
    }
  });
} else {
  // Si el DOM ya está listo
  const token = localStorage.getItem('auth_token');
  if (token) {
    iniciarRealtimeService();
  }
}

// Reiniciar cuando cambia la sesión
document.addEventListener('sessionChanged', () => {
  const token = localStorage.getItem('auth_token');
  if (token && !RealtimeState.isRunning) {
    iniciarRealtimeService();
  } else if (!token && RealtimeState.isRunning) {
    detenerRealtimeService();
  }
});

console.log('✅ payin-realtime.service.js cargado correctamente');
