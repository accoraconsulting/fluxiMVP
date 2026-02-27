/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PAYIN REALTIME HANDLER - Manejo de eventos en tiempo real
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Descripción:
 * Conecta el servicio de real-time con las vistas (pending y user).
 * Escucha eventos de cambios y actualiza la UI automáticamente.
 *
 * Funcionalidades:
 * 1. Recarga datos cuando hay cambios
 * 2. Notifica al usuario de cambios en tiempo real
 * 3. Actualiza estadísticas
 * 4. Anima elementos que cambian
 *
 * Autor: FLUXI Team
 * Fecha: 2026-02-23
 * Versión: 1.0.0
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Configurar listeners de real-time para la página de payins pendientes
 * Se ejecuta desde payin-pending.js
 */
export function configurarRealtimePending() {
  console.log('🔌 Configurando real-time para página de pendientes...');

  // Escuchar cambios de estado
  document.addEventListener('payin:statusChanged', (event) => {
    const { payinId, statusNuevo } = event.detail;

    console.log(`🔄 Cambio detectado en payin ${payinId}: ${statusNuevo}`);

    // Mostrar notificación
    mostrarNotificacionRealtime(event.detail);

    // Recargar datos con pequeño delay para que el backend procese
    setTimeout(() => {
      if (window.cargarPayinsPendientes) {
        console.log('🔄 Recargando lista de pendientes...');
        window.cargarPayinsPendientes();
      }
    }, 500);
  });

  // Escuchar aprobaciones
  document.addEventListener('payin:approved', (event) => {
    const { payinId, mensaje } = event.detail;
    console.log(`✅ ${mensaje}: ${payinId}`);
    mostrarNotificacionRealtime(event.detail, 'success');
  });

  console.log('✅ Real-time configurado para pendientes');
}

/**
 * Configurar listeners de real-time para la página de usuario
 * Se ejecuta desde payin-user.js
 */
export function configurarRealtimeUser() {
  console.log('🔌 Configurando real-time para página de usuario...');

  // Escuchar pagos completados
  document.addEventListener('payin:completed', (event) => {
    const { payinId, mensaje } = event.detail;

    console.log(`✅ Pago completado: ${payinId}`);

    // Mostrar notificación celebratoria
    mostrarNotificacionRealtime(
      {
        payinId,
        mensaje: `🎉 ${mensaje} - ¡Tu pago ha sido recibido!`,
      },
      'success'
    );

    // Recargar datos
    setTimeout(() => {
      if (window.cargarMisPayins) {
        console.log('🔄 Recargando mis payins...');
        window.cargarMisPayins();
      }
    }, 500);
  });

  // Escuchar expiración
  document.addEventListener('payin:expired', (event) => {
    const { payinId, mensaje } = event.detail;

    console.log(`⏱️ Link expirado: ${payinId}`);

    mostrarNotificacionRealtime(
      {
        payinId,
        mensaje: `${mensaje} - Solicita un nuevo link a tu administrador`,
      },
      'warning'
    );

    // Recargar datos
    setTimeout(() => {
      if (window.cargarMisPayins) {
        window.cargarMisPayins();
      }
    }, 500);
  });

  // Escuchar cambios generales
  document.addEventListener('payin:statusChanged', (event) => {
    const { payinId, statusNuevo } = event.detail;
    console.log(`🔄 Estado actualizado: ${payinId} → ${statusNuevo}`);

    // Recargar datos
    setTimeout(() => {
      if (window.cargarMisPayins) {
        window.cargarMisPayins();
      }
    }, 500);
  });

  console.log('✅ Real-time configurado para usuario');
}

/**
 * Muestra una notificación de cambio en tiempo real
 * @param {Object} datos - Datos del evento
 * @param {string} tipo - Tipo de notificación ('info', 'success', 'warning', 'error')
 */
function mostrarNotificacionRealtime(datos, tipo = 'info') {
  const { payinId, mensaje } = datos;

  // Crear elemento de notificación
  const notificacion = document.createElement('div');
  notificacion.className = `notification notification-realtime notification-${tipo}`;
  notificacion.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    padding: 16px 24px;
    background: ${
      tipo === 'success'
        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
        : tipo === 'warning'
        ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
        : tipo === 'error'
        ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
        : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
    };
    color: white;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
    z-index: 9999;
    animation: slideInRight 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    font-size: 14px;
    font-weight: 500;
    border-left: 4px solid rgba(255, 255, 255, 0.3);
    max-width: 400px;
  `;

  const icono = tipo === 'success' ? '🎉' : tipo === 'warning' ? '⚠️' : tipo === 'error' ? '❌' : 'ℹ️';

  notificacion.innerHTML = `
    <div style="display: flex; align-items: flex-start; gap: 12px;">
      <span style="font-size: 18px; flex-shrink: 0;">${icono}</span>
      <div>
        <p style="margin: 0; font-weight: 600;">${mensaje}</p>
        <p style="margin: 4px 0 0 0; opacity: 0.9; font-size: 12px;">ID: ${payinId.substring(0, 8)}...</p>
      </div>
    </div>
  `;

  document.body.appendChild(notificacion);

  // Eliminar después de 6 segundos
  setTimeout(() => {
    notificacion.style.animation = 'slideOutRight 0.3s ease-out';
    setTimeout(() => notificacion.remove(), 300);
  }, 6000);
}

/**
 * Agregar estilos de animación si no existen
 */
function agregarEstilosAnimacion() {
  const styleId = 'payin-realtime-styles';

  // Evitar agregar estilos duplicados
  if (document.getElementById(styleId)) {
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @keyframes slideInRight {
      from {
        opacity: 0;
        transform: translateX(400px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @keyframes slideOutRight {
      from {
        opacity: 1;
        transform: translateX(0);
      }
      to {
        opacity: 0;
        transform: translateX(400px);
      }
    }

    @keyframes pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.7;
      }
    }

    .payin-card-updating {
      animation: pulse 1s ease-in-out 2;
      border-color: #667eea !important;
    }
  `;

  document.head.appendChild(style);
}

// Agregar estilos cuando se carga el módulo
agregarEstilosAnimacion();

console.log('✅ payin-realtime-handler.js cargado correctamente');
