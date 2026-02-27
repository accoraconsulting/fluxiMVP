import { getSession } from '../js/auth/session.js';

export function loadUserContext() {
  const session = getSession();
  if (!session) return;

  const { user } = session;

  // 1. Username obligatorio
  if (!user.username) {
    window.location.href = './set-username.html';
    return;
  }

  // 2. Pintar username
  document
    .querySelectorAll('[data-user-name]')
    .forEach(el => {
      el.textContent = user.username || 'Cuenta';
    });

  // 3. Email (opcional)
  document
    .querySelectorAll('[data-user-email]')
    .forEach(el => {
      el.textContent = user.email;
    });

  // 4. KYC
  document
    .querySelectorAll('[data-kyc-status]')
    .forEach(el => {
      el.textContent = formatKycStatus(user.kyc_status);
    });
}

function formatKycStatus(status) {
  switch (status) {
    case 'approved': return 'Verificado';
    case 'pending': return 'En revisión';
    case 'not_started': return 'No verificado';
    case 'rejected': return 'Rechazado';
    default: return 'Desconocido';
  }
}
