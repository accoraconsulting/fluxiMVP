import { getSession } from '../auth/session.js';

document.addEventListener('DOMContentLoaded', () => {
  const session = getSession();
  if (!session) return;

  const { user } = session;

  const username = user.username || user.email || 'Usuario';

  document.querySelectorAll('[data-user-name]').forEach(el => {
    el.textContent = username;
  });

  document.querySelectorAll('[data-username]').forEach(el => {
    el.textContent = username;
  });
});
