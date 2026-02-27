import { getSession, setSession } from './auth/session.js';

const form = document.getElementById('usernameForm');
const errorEl = document.getElementById('errorMessage');

const session = getSession();

/**
 * Guardia de acceso:
 * Si no hay sesión, no debería estar aquí
 */
if (!session || !session.user) {
  // 🚫 Usar replace() para BLOQUEAR back button
  window.location.replace('./login.html');
}

/**
 * Si el usuario ya tiene username, no debe pasar por onboarding
 */
if (session.user.username) {
  // 🚫 Usar replace() para evitar volver al onboarding
  window.location.replace('./dashboard.html');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  errorEl.textContent = '';

  const username = form.username.value.trim();

  if (username.length < 3) {
    errorEl.textContent = 'El nombre debe tener al menos 3 caracteres.';
    return;
  }

  try {
    const res = await fetch('/api/user/username', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ username })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al guardar el nombre');
    }

    const updatedUser = await res.json();

    /**
     * Actualizar sesión local
     */
    session.user.username = updatedUser.username;
    setSession(session);

    window.location.href = './dashboard.html';

  } catch (err) {
    errorEl.textContent = err.message;
  }
});
