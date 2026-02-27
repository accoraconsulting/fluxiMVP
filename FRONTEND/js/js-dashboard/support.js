//traer el user de bd y ponerlo en pantalla para llamarlo con data-user-name en la etiqueta de cuenta en el html
import { getSession } from '../auth/session.js';

document.addEventListener('DOMContentLoaded', () => {
  const session = getSession();
  if (!session) return;

  const { user } = session;

  const username =
    user.username ||
    user.email ||
    'Cuenta';

  document
    .querySelectorAll('[data-user-name]')
    .forEach(el => {
      el.textContent = username;
    });
});
