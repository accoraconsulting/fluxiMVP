import { getSession, saveSession } from '../auth/session.js';
import { guardPage, startSessionMonitor } from '../auth/session-guard.js';
import { API_CONFIG } from '../config/api.config.js';

const API_BASE = API_CONFIG.API_ENDPOINT;

/* =====================================================
   INICIALIZACIÓN
===================================================== */
document.addEventListener('DOMContentLoaded', async () => {
  // 🛡️ Proteger página contra sesiones inválidas
  if (!guardPage()) {
    return;
  }

  // 👁️ Iniciar monitor de sesión
  startSessionMonitor();

  const session = getSession();

  console.log('[MyAccount] ✅ Usuario:', session.user.email);

  // Cargar datos del usuario
  await loadUserData(session);

  // Setup listeners
  setupEventListeners();
});

/* =====================================================
   CARGAR DATOS DEL USUARIO
===================================================== */
async function loadUserData(session) {
  try {
    console.log('[MyAccount] 📊 Cargando datos del usuario...');

    // 1️⃣ Username y email (desde sesión local)
    const username = session.user.username || session.user.email || 'Usuario';
    document.querySelectorAll('[data-user-name]').forEach(el => {
      el.textContent = username;
    });
    document.querySelectorAll('[data-username]').forEach(el => {
      el.textContent = username;
    });

    const emailEl = document.querySelector('[data-email]');
    if (emailEl) emailEl.textContent = session.user.email || '-';

    // 2️⃣ Fetch perfil completo desde el backend
    console.log('[MyAccount] 🔄 Obteniendo perfil completo del servidor...');
    const profileRes = await fetch(`${API_BASE}/user/profile`, {
      headers: {
        Authorization: `Bearer ${session.token}`
      }
    });

    if (!profileRes.ok) {
      console.warn('[MyAccount] ⚠️ No se pudo obtener perfil:', profileRes.status);
      updateVerificationStatus(session.user.kyc_status || 'not_started');
      return;
    }

    const profile = await profileRes.json();
    console.log('[MyAccount] ✅ Perfil obtenido:', profile);

    // 3️⃣ Renderizar información personal
    if (profile.personal) {
      const p = profile.personal;

      const fullNameEl = document.querySelector('[data-full-name]');
      if (fullNameEl) {
        const fullName = `${p.first_name || ''} ${p.last_name || ''}`.trim();
        fullNameEl.textContent = fullName || '-';
      }

      const phoneEl = document.querySelector('[data-phone]');
      if (phoneEl) phoneEl.textContent = p.phone || '-';

      const countryEl = document.querySelector('[data-country]');
      if (countryEl) countryEl.textContent = p.country || '-';

      const documentEl = document.querySelector('[data-document]');
      if (documentEl) {
        const docDisplay = p.document_number ? `${p.document_type || 'Doc'}: ${p.document_number}` : '-';
        documentEl.textContent = docDisplay;
      }

      console.log('[MyAccount] ✅ Datos personales renderizados');
    }

    // 4️⃣ Renderizar información de la empresa
    if (profile.company) {
      const c = profile.company;

      const legalNameEl = document.querySelector('[data-legal-name]');
      if (legalNameEl) legalNameEl.textContent = c.legal_name || '-';

      const tradeNameEl = document.querySelector('[data-trade-name]');
      if (tradeNameEl) tradeNameEl.textContent = c.trade_name || '-';

      const taxIdEl = document.querySelector('[data-tax-id]');
      if (taxIdEl) {
        const taxDisplay = c.tax_id ? `${c.tax_id_type || 'NIT'}: ${c.tax_id}` : '-';
        taxIdEl.textContent = taxDisplay;
      }

      const corpEmailEl = document.querySelector('[data-corporate-email]');
      if (corpEmailEl) corpEmailEl.textContent = c.corporate_email || '-';

      const corpPhoneEl = document.querySelector('[data-corporate-phone]');
      if (corpPhoneEl) corpPhoneEl.textContent = c.corporate_phone || '-';

      console.log('[MyAccount] ✅ Datos empresariales renderizados');
    }

    // 5️⃣ Estado de verificación
    updateVerificationStatus(profile.user?.kyc_status || session.user.kyc_status || 'not_started');

    console.log('[MyAccount] ✅ Todos los datos cargados correctamente');

  } catch (error) {
    console.error('[MyAccount] ❌ Error cargando datos:', error);
    updateVerificationStatus(session.user.kyc_status || 'not_started');
  }
}

/* =====================================================
   ACTUALIZAR ESTADO DE VERIFICACIÓN
===================================================== */
function updateVerificationStatus(status) {
  const statusEl = document.querySelector('[data-verification-status]');
  const hintEl = document.querySelector('[data-verification-hint]');
  const badgeEl = document.querySelector('[data-kyc-badge]');

  if (!statusEl) return;

  const statusConfig = {
    'approved': {
      icon: 'bx-check-shield',
      text: 'Cuenta Verificada',
      hint: 'Tu identidad ha sido verificada correctamente',
      class: 'verified',
      badge: 'Verificado'
    },
    'verified': {
      icon: 'bx-check-shield',
      text: 'Cuenta Verificada',
      hint: 'Tu identidad ha sido verificada correctamente',
      class: 'verified',
      badge: 'Verificado'
    },
    'pending': {
      icon: 'bx-time-five',
      text: 'Verificación Pendiente',
      hint: 'Estamos revisando tu información',
      class: 'pending',
      badge: 'Pendiente'
    },
    'in_progress': {
      icon: 'bx-loader-circle',
      text: 'En Proceso',
      hint: 'Tu verificación está siendo procesada',
      class: 'in-progress',
      badge: 'En proceso'
    },
    'in-progress': {
      icon: 'bx-loader-circle',
      text: 'En Proceso',
      hint: 'Tu verificación está siendo procesada',
      class: 'in-progress',
      badge: 'En proceso'
    },
    'rejected': {
      icon: 'bx-x-circle',
      text: 'Verificación Rechazada',
      hint: 'Por favor, revisa los documentos enviados',
      class: 'rejected',
      badge: 'Rechazado'
    },
    'not_started': {
      icon: 'bx-error-circle',
      text: 'No Verificado',
      hint: 'Completa el proceso de verificación KYC',
      class: 'not-started',
      badge: 'No verificado'
    }
  };

  const config = statusConfig[status] || statusConfig['not_started'];

  statusEl.className = `verification-status ${config.class}`;
  statusEl.innerHTML = `
    <i class="bx ${config.icon}"></i>
    <span>${config.text}</span>
  `;

  if (hintEl) hintEl.textContent = config.hint;
  if (badgeEl) {
    badgeEl.textContent = config.badge;
    badgeEl.className = config.class;
  }
}

/* =====================================================
   EVENT LISTENERS
===================================================== */
function setupEventListeners() {
  // Botón editar perfil (cambiar username)
  const editBtn = document.querySelector('.primary-btn');
  if (editBtn) {
    editBtn.addEventListener('click', openUsernameEditor);
  }

  // Botón cambiar contraseña
  document.getElementById('changePasswordBtn')?.addEventListener('click', openPasswordResetModal);

  // 🔄 LISTENER: Cuando cambia el estado KYC, recargar datos
  document.addEventListener('kyc_statusChanged', async () => {
    console.log('[MyAccount] 🔔 KYC status cambió, recargando datos...');
    const session = getSession();
    if (session) {
      await loadUserData(session);
    }
  });
}

/* =====================================================
   MODAL DE EDITAR USERNAME
===================================================== */
function openUsernameEditor() {
  console.log('[MyAccount] ✏️ Abriendo editor de username');

  const session = getSession();
  const currentUsername = session?.user?.username || '';

  // Crear modal
  const modal = document.createElement('div');
  modal.id = 'usernameEditorModal';
  modal.className = 'username-editor';
  modal.innerHTML = `
    <div class="editor-box">
      <h3>
        <i class="bx bx-edit-alt"></i>
        Cambiar nombre de usuario
      </h3>
      <p>Elige un nombre único para tu cuenta. Puedes cambiarlo cuando quieras.</p>

      <input 
        type="text" 
        id="newUsername" 
        placeholder="Ingresa tu nombre de usuario"
        value="${currentUsername}"
        maxlength="30"
        autocomplete="off"
      />

      <div id="usernameMessage" class="editor-message"></div>

      <div class="editor-actions">
        <button class="btn-cancel" onclick="closeUsernameEditor()">
          Cancelar
        </button>
        <button class="btn-save" id="saveUsernameBtn">
          <i class="bx bx-check"></i>
          Guardar
        </button>
      </div>

      <span class="editor-hint">
        Solo letras, números y guiones bajos. Mínimo 3 caracteres.
      </span>
    </div>
  `;

  document.body.appendChild(modal);

  // Animar entrada
  setTimeout(() => modal.classList.add('show'), 10);

  // Focus en input
  setTimeout(() => {
    document.getElementById('newUsername').focus();
    document.getElementById('newUsername').select();
  }, 100);

  // Setup listener para guardar
  document.getElementById('saveUsernameBtn').addEventListener('click', saveUsername);

  // Enter para guardar
  document.getElementById('newUsername').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveUsername();
    }
  });
}

window.closeUsernameEditor = function() {
  const modal = document.getElementById('usernameEditorModal');
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
  }
};

async function saveUsername() {
  const input = document.getElementById('newUsername');
  const btn = document.getElementById('saveUsernameBtn');
  const messageEl = document.getElementById('usernameMessage');
  const newUsername = input.value.trim();

  // Validación
  if (newUsername.length < 3) {
    showEditorMessage('El nombre debe tener al menos 3 caracteres', 'error');
    return;
  }

  if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
    showEditorMessage('Solo se permiten letras, números y guiones bajos', 'error');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Guardando...';

  try {
    console.log('[MyAccount] 💾 Guardando username:', newUsername);

    const session = getSession();

    const response = await fetch(`${API_BASE}/user/username`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username: newUsername })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Error guardando nombre');
    }

    const data = await response.json();
    console.log('[MyAccount] ✅ Username guardado:', data);

    // Actualizar sesión
    session.user.username = data.username;
    saveSession(session.token, session.user);

    // Actualizar UI
    document.querySelectorAll('[data-user-name]').forEach(el => {
      el.textContent = data.username;
    });

    showEditorMessage('✅ Nombre guardado correctamente', 'success');

    setTimeout(() => {
      closeUsernameEditor();
    }, 1500);

  } catch (error) {
    console.error('[MyAccount] ❌ Error:', error);
    showEditorMessage(error.message, 'error');
    btn.disabled = false;
    btn.innerHTML = '<i class="bx bx-check"></i> Guardar';
  }
}

function showEditorMessage(text, type) {
  const messageEl = document.getElementById('usernameMessage');
  if (!messageEl) return;

  messageEl.className = `editor-message ${type}`;
  messageEl.innerHTML = `
    <i class="bx ${type === 'success' ? 'bx-check-circle' : 'bx-x-circle'}"></i>
    <span>${text}</span>
  `;
}

/* =====================================================
   MODAL DE CAMBIO DE CONTRASEÑA
===================================================== */
function openPasswordResetModal() {
  console.log('[MyAccount] 🔐 Abriendo modal de cambio de contraseña');

  const session = getSession();
  const email = session?.user?.email;

  if (!email) {
    alert('Error: No se pudo obtener el email del usuario');
    return;
  }

  // Crear modal
  const modal = document.createElement('div');
  modal.id = 'passwordResetModal';
  modal.className = 'password-reset-modal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h3>
          <i class="bx bx-lock-alt"></i>
          Cambiar Contraseña
        </h3>
        <button class="modal-close" onclick="closePasswordResetModal()">
          <i class="bx bx-x"></i>
        </button>
      </div>

      <div class="modal-body">
        <p>Te enviaremos un enlace seguro a tu correo electrónico para que puedas cambiar tu contraseña.</p>
        
        <div class="email-display">
          <i class="bx bx-envelope"></i>
          <strong>${email}</strong>
        </div>

        <div id="modalMessage" class="modal-message"></div>
      </div>

      <div class="modal-footer">
        <button class="btn-cancel" onclick="closePasswordResetModal()">
          Cancelar
        </button>
        <button class="btn-send" id="sendResetEmailBtn">
          <i class="bx bx-send"></i>
          Enviar Enlace
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Animar entrada
  setTimeout(() => modal.classList.add('show'), 10);

  // Setup listener para enviar email
  document.getElementById('sendResetEmailBtn').addEventListener('click', sendPasswordResetEmail);
}

window.closePasswordResetModal = function() {
  const modal = document.getElementById('passwordResetModal');
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
  }
};

/* =====================================================
   ENVIAR EMAIL DE RESET
===================================================== */
async function sendPasswordResetEmail() {
  const session = getSession();
  const email = session?.user?.email;
  const btn = document.getElementById('sendResetEmailBtn');
  const messageEl = document.getElementById('modalMessage');

  if (!email) return;

  btn.disabled = true;
  btn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Enviando...';

  try {
    console.log('[MyAccount] 📧 Enviando email de reset a:', email);

    const response = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[MyAccount] ❌ Error del servidor:', data);
      throw new Error(data.error || data.message || 'Error enviando email');
    }

    console.log('[MyAccount] ✅ Email enviado correctamente');

    messageEl.className = 'modal-message success';
    messageEl.innerHTML = `
      <i class="bx bx-check-circle"></i>
      <span>Email enviado correctamente. Revisa tu bandeja de entrada.</span>
    `;

    btn.innerHTML = '<i class="bx bx-check"></i> Email Enviado';

    setTimeout(() => {
      closePasswordResetModal();
    }, 3000);

  } catch (error) {
    console.error('[MyAccount] ❌ Error completo:', error);

    messageEl.className = 'modal-message error';
    messageEl.innerHTML = `
      <i class="bx bx-x-circle"></i>
      <span>${error.message}</span>
    `;

    btn.disabled = false;
    btn.innerHTML = '<i class="bx bx-send"></i> Enviar Enlace';
  }
}