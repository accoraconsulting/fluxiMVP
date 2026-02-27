const form = document.getElementById('signupForm');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const companyName = document.getElementById('company_name').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirm_password').value;

  if (password !== confirmPassword) {
    showErrorModal('Las contraseñas no coinciden');
    return;
  }

  if (password.length < 6) {
    showErrorModal('La contraseña debe tener al menos 6 caracteres');
    return;
  }

  // Deshabilitar botón mientras se procesa
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creando cuenta...';

  try {
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const apiBase = isDev ? 'http://localhost:3000/api' : `${window.location.origin}/api`;
    const res = await fetch(`${apiBase}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: companyName,
        email,
        password
      })
    });

    const data = await res.json();

    if (!res.ok) {
      showErrorModal(data.message || 'Error al crear la cuenta');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Crear cuenta';
      return;
    }

    // ✅ Mostrar modal de éxito
    showSuccessModal();

  } catch (err) {
    console.error(err);
    showErrorModal('Error de conexión con el servidor. Por favor intenta nuevamente.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Crear cuenta';
  }
});

/* =========================================
   MOSTRAR MODAL DE ÉXITO
========================================= */
function showSuccessModal() {
  const modal = document.getElementById('successModal');
  modal.classList.remove('hidden');

  // Auto-redirigir después de 3 segundos
  setTimeout(() => {
    // 🚫 Usar replace() para NO crear historial innecesario
    window.location.replace('./login.html');
  }, 3000);

  // Botón manual para redirigir
  document.getElementById('continueBtn').addEventListener('click', () => {
    // 🚫 Usar replace() para NO crear historial innecesario
    window.location.replace('./login.html');
  });
}

/* =========================================
   MOSTRAR MODAL DE ERROR
========================================= */
function showErrorModal(message) {
  const modal = document.getElementById('errorModal');
  const messageEl = document.getElementById('errorMessage');
  
  messageEl.textContent = message;
  modal.classList.remove('hidden');

  // Cerrar modal
  document.getElementById('closeErrorBtn').addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  // Cerrar al hacer click fuera
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hidden');
    }
  });
}