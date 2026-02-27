

const form = document.getElementById('loginForm');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  // ✅ Validaciones básicas
  if (!email || !password) {
    alert("Por favor completa todos los campos");
    return;
  }

  // ✅ Guardar credenciales temporalmente en sessionStorage
  sessionStorage.setItem("login-credentials", JSON.stringify({ email, password }));

  // ✅ Redirigir INMEDIATAMENTE a pantalla de carga
  window.location.href = "./partials/login-loading.html";
});