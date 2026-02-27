import { getSession } from './session.js';

const session = getSession();

if (!session) {
  // 🚫 Usar replace() para BLOQUEAR back button
  window.location.replace('./login.html');
}
