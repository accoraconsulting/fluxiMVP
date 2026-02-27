/**
 * SUPPORT PAGE - Formulario de Contacto
 * Maneja envío de mensajes a administradores por correo
 */

import { guardPage, startSessionMonitor } from '../auth/session-guard.js';
import { API_CONFIG } from '../config/api.config.js';

const API_BASE = API_CONFIG.API_ENDPOINT;

// Inicializar cuando el DOM carga
document.addEventListener('DOMContentLoaded', () => {
  // 🛡️ Proteger página contra sesiones inválidas
  if (!guardPage()) {
    return;
  }

  // 👁️ Iniciar monitor de sesión
  startSessionMonitor();

  initializeSupport();
});

/**
 * Inicializar funcionalidades del soporte
 */
function initializeSupport() {
  setupFormHandlers();
  setupFAQHandlers();
}

/**
 * Setup de handlers del formulario
 */
function setupFormHandlers() {
  const form = document.getElementById('supportForm');

  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  }
}

/**
 * Manejar envío del formulario
 */
async function handleFormSubmit(e) {
  e.preventDefault();

  const form = e.target;
  const submitBtn = form.querySelector('.btn-submit');
  const successDiv = document.getElementById('formSuccess');

  // Validar datos
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const category = document.querySelector('input[name="category"]:checked')?.value;
  const subject = document.getElementById('subject').value.trim();
  const message = document.getElementById('message').value.trim();
  const terms = document.getElementById('terms').checked;

  // Validaciones básicas
  if (!name || name.length < 3) {
    showError('El nombre debe tener al menos 3 caracteres');
    return;
  }

  if (!email || !isValidEmail(email)) {
    showError('Ingresa un correo válido');
    return;
  }

  if (!category) {
    showError('Selecciona una categoría');
    return;
  }

  if (!subject || subject.length < 5) {
    showError('El asunto debe tener al menos 5 caracteres');
    return;
  }

  if (!message || message.length < 20) {
    showError('El mensaje debe tener al menos 20 caracteres');
    return;
  }

  if (!terms) {
    showError('Debes aceptar que tu mensaje será enviado a los administradores');
    return;
  }

  // Deshabilitar botón
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Enviando...';

  try {
    // Obtener sesión
    const session = getSession();
    if (!session) {
      showError('Debes iniciar sesión para enviar un mensaje');
      return;
    }

    // Enviar al backend
    const response = await fetch(`${API_BASE}/support/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.token}`
      },
      body: JSON.stringify({
        name,
        email,
        category,
        subject,
        message,
        userId: session.user.id
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error enviando mensaje');
    }

    // Éxito
    console.log('[Support] ✅ Mensaje enviado correctamente');

    // Mostrar mensaje de éxito
    form.style.display = 'none';
    successDiv.style.display = 'block';

    // Reset después de 5 segundos
    setTimeout(() => {
      resetSupportForm();
    }, 5000);

  } catch (error) {
    console.error('[Support] ❌ Error:', error);
    showError(error.message || 'Error al enviar el mensaje. Intenta de nuevo.');
  } finally {
    // Rehabilitar botón
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="bx bx-send"></i> Enviar Mensaje';
  }
}

/**
 * Setup de handlers del FAQ
 */
function setupFAQHandlers() {
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');

    if (question) {
      question.addEventListener('click', () => {
        // Toggle active
        item.classList.toggle('active');

        // Cerrar otros items
        faqItems.forEach(otherItem => {
          if (otherItem !== item) {
            otherItem.classList.remove('active');
          }
        });
      });
    }
  });
}

/**
 * Reset del formulario
 */
function resetSupportForm() {
  const form = document.getElementById('supportForm');
  const successDiv = document.getElementById('formSuccess');

  if (form && successDiv) {
    form.reset();
    form.style.display = 'block';
    successDiv.style.display = 'none';
  }
}

/**
 * Validar email
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Mostrar error
 */
function showError(message) {
  // Usar sistema de notificaciones existente si está disponible
  console.error('[Support] Error:', message);
  alert(message); // Fallback simple

  // O usar toast si está disponible
  // showNotification('error', 'Error', message);
}

/**
 * Mostrar notificación (fallback si existe en el sistema)
 */
function showNotification(type = 'info', title = '', message = '') {
  console.log(`[${type.toUpperCase()}] ${title}: ${message}`);
  // Implementar con tu sistema de notificaciones
}

/**
 * Obtener sesión
 */
function getSession() {
  try {
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('auth_user');

    if (!token || !userStr) return null;

    const user = JSON.parse(userStr);

    return {
      token,
      user
    };
  } catch (error) {
    console.warn('[Support] Error obteniendo sesión:', error);
    return null;
  }
}
