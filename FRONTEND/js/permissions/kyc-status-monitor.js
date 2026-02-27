/**
 * 📊 MONITOR DE ESTADO KYC
 * Verifica y actualiza el estado KYC del usuario en tiempo real
 */

/**
 * Obtener estado KYC actual del backend
 * @returns {Promise<string>} Estado del KYC (pending, approved, rejected)
 */
export async function getKYCStatusFromBackend() {
  try {
    const authToken = localStorage.getItem('auth_token');

    if (!authToken) {
      console.warn('⚠️ No hay token de autenticación');
      return 'pending';
    }

    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const apiBase = isDev ? 'http://localhost:3000/api' : `${window.location.origin}/api`;
    const response = await fetch(`${apiBase}/kyc/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('❌ Error obteniendo estado KYC:', response.status);
      return 'pending';
    }

    const data = await response.json();
    return data.status || 'pending';
  } catch (error) {
    console.error('❌ Error en getKYCStatusFromBackend:', error);
    return 'pending';
  }
}

/**
 * Actualizar estado KYC en localStorage
 * @param {string} newStatus - Nuevo estado del KYC
 */
export function updateKYCStatusInStorage(newStatus) {
  try {
    const authUser = localStorage.getItem('auth_user');

    if (!authUser) {
      console.warn('⚠️ No hay usuario en localStorage');
      return false;
    }

    const user = JSON.parse(authUser);
    const oldStatus = user.kyc_status;

    // Actualizar estado
    user.kyc_status = newStatus;
    localStorage.setItem('auth_user', JSON.stringify(user));

    console.log(`✅ Estado KYC actualizado: ${oldStatus} → ${newStatus}`);

    // Disparar evento personalizado para que otros scripts se entiren
    window.dispatchEvent(
      new CustomEvent('kyc_statusChanged', {
        detail: { oldStatus, newStatus }
      })
    );

    return true;
  } catch (error) {
    console.error('❌ Error actualizando KYC en storage:', error);
    return false;
  }
}

/**
 * Verificar y sincronizar estado KYC
 * @returns {Promise<boolean>} true si el estado cambió
 */
export async function syncKYCStatus() {
  try {
    const currentStatus = localStorage.getItem('auth_user')
      ? JSON.parse(localStorage.getItem('auth_user')).kyc_status
      : 'pending';

    const backendStatus = await getKYCStatusFromBackend();

    if (currentStatus !== backendStatus) {
      console.warn(
        `⚠️ Estado KYC desincronizado: ${currentStatus} ≠ ${backendStatus}`
      );
      updateKYCStatusInStorage(backendStatus);
      return true;
    }

    return false;
  } catch (error) {
    console.error('❌ Error sincronizando KYC:', error);
    return false;
  }
}

/**
 * Monitorear cambios de KYC cada X segundos
 * @param {number} intervalSeconds - Intervalo en segundos (default: 30)
 * @returns {number} ID del intervalo para poder detenerlo después
 */
export function startKYCMonitoring(intervalSeconds = 30) {
  console.log(`🔍 Iniciando monitoreo de KYC (cada ${intervalSeconds}s)...`);

  const intervalId = setInterval(async () => {
    const changed = await syncKYCStatus();

    if (changed) {
      console.warn('⚠️ Estado KYC cambió, recargando permisos...');

      // Disparar evento para actualizar navbar
      window.dispatchEvent(new Event('permissionsUpdated'));

      // Opcional: mostrar notificación
      showKYCUpdateNotification();
    }
  }, intervalSeconds * 1000);

  return intervalId;
}

/**
 * Detener monitoreo de KYC
 * @param {number} intervalId - ID del intervalo a detener
 */
export function stopKYCMonitoring(intervalId) {
  clearInterval(intervalId);
  console.log('⏹️ Monitoreo de KYC detenido');
}

/**
 * Mostrar notificación cuando KYC es aprobado
 */
function showKYCUpdateNotification() {
  const authUser = localStorage.getItem('auth_user');
  if (!authUser) return;

  const user = JSON.parse(authUser);

  if (user.kyc_status === 'approved') {
    showSuccessNotification(
      '🎉 ¡Verificación Completada!',
      'Tu identificación ha sido aprobada. Ahora tienes acceso completo a la plataforma.'
    );
  } else if (user.kyc_status === 'rejected') {
    showErrorNotification(
      '❌ Verificación Rechazada',
      'Tu identificación fue rechazada. Por favor, intenta de nuevo con documentos claros.'
    );
  }
}

/**
 * Mostrar notificación de éxito
 */
function showSuccessNotification(title, message) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #10b981;
    color: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10000;
    max-width: 400px;
    animation: slideIn 0.3s ease-out;
  `;

  notification.innerHTML = `
    <h3 style="margin: 0 0 5px 0;">${title}</h3>
    <p style="margin: 0; font-size: 14px;">${message}</p>
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}

/**
 * Mostrar notificación de error
 */
function showErrorNotification(title, message) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ef4444;
    color: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10000;
    max-width: 400px;
    animation: slideIn 0.3s ease-out;
  `;

  notification.innerHTML = `
    <h3 style="margin: 0 0 5px 0;">${title}</h3>
    <p style="margin: 0; font-size: 14px;">${message}</p>
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}

// Auto-iniciar si está habilitado en configuración
if (localStorage.getItem('kyc_monitoring') === 'true') {
  window.kycMonitoringId = startKYCMonitoring();
}
