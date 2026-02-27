import { login } from './api/auth.api.js';
import { saveSession } from './auth/session.js';

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🔐 LOGIN LOADING INIT");

  try {
    // ✅ 1. Leer credenciales de sessionStorage
    const credentials = sessionStorage.getItem("login-credentials");
    
    if (!credentials) {
      throw new Error("CREDENTIALS_MISSING");
    }

    const { email, password } = JSON.parse(credentials);

    // ✅ 2. Actualizar mensaje
    updateStatus("Verificando credenciales...");

    // ✅ 3. Hacer login real
    const { token, user } = await login(email, password);

    // ✅ 4. Guardar sesión
    saveSession(token, user);

    // ✅ 5. Actualizar mensaje
    updateStatus("Cargando dashboard...");

    // ✅ 6. Limpiar credenciales temporales
    sessionStorage.removeItem("login-credentials");

    // ✅ 7. Pequeña pausa para UX
    await new Promise(resolve => setTimeout(resolve, 800));

    // ✅ 8. Redirigir al dashboard
    console.log("✅ Login exitoso, redirigiendo...");
    window.location.replace("/FRONTEND/dashboard.html");

  } catch (err) {
    console.error("❌ LOGIN ERROR:", err.message);

    // Mostrar error en la UI
    const container = document.querySelector(".loading-container");
    if (container) {
      container.innerHTML = `
        <img src="/FRONTEND/assets/fluxi2.png" class="logo" alt="Payoh" />
        <h2 style="color: #e74c3c;">Error al iniciar sesión</h2>
        <p class="error-message">${getErrorMessage(err.message)}</p>
        <button class="retry-button" onclick="window.location.replace('/FRONTEND/login.html')">
          Volver a intentar
        </button>
      `;
    }
  }
});



function updateStatus(message) {
  const statusEl = document.getElementById("status-message");
  if (statusEl) {
    statusEl.textContent = message;
  }
}

function getErrorMessage(error) {
  const messages = {
    "CREDENTIALS_MISSING": "No se recibieron las credenciales",
    "INVALID_CREDENTIALS": "Correo o contraseña incorrectos",
    "USER_NOT_FOUND": "Usuario no encontrado",
    "INVALID_PASSWORD": "Contraseña incorrecta",
    "NETWORK_ERROR": "Error de conexión. Verifica tu internet.",
    "SERVER_ERROR": "Error del servidor. Intenta más tarde."
  };

  return messages[error] || error || "Error desconocido";
}