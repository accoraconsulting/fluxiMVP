import { submitIdentityStep } from "../api/kyc.api.js";
import { API_CONFIG } from "../config/api.config.js";

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🟡 KYC PROCESSING INIT");

  try {
    // ✅ 1. Leer estado de sessionStorage
    const rawState = sessionStorage.getItem("kyc-state");
    if (!rawState) {
      throw new Error("KYC_STATE_MISSING");
    }

    const kycState = JSON.parse(rawState);
    const identity = kycState.identity;

    // ✅ 2. Validar que existan las imágenes
    if (
      !identity?.documentFront ||
      !identity?.documentBack ||
      !identity?.selfie
    ) {
      throw new Error("IDENTITY_INCOMPLETE");
    }

    console.log("📤 Subiendo identidad al backend...");

    // ✅ 3. SUBIR IMÁGENES (ID_FRONT, ID_BACK, SELFIE) a Drive
    await submitIdentityStep({
      documentFront: identity.documentFront,
      documentBack: identity.documentBack,
      selfie: identity.selfie,
      consentData: identity.consentData || true,
      consentIdentity: identity.consentIdentity || true
    });

    console.log("✅ Imágenes subidas correctamente");

    // ✅ 4. SUBMIT FINAL del KYC
    const token = localStorage.getItem("auth_token");
    
    const submitRes = await fetch(`${API_CONFIG.API_ENDPOINT}/kyc/submit`, {
      method: "POST",
      credentials: "include",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    if (!submitRes.ok) {
      const error = await submitRes.json().catch(() => ({}));
      throw new Error(error.error || "KYC_SUBMIT_FAILED");
    }

    const submitData = await submitRes.json();
    console.log("✅ KYC enviado a revisión:", submitData);

    // ✅ 5. Limpiar sessionStorage
    sessionStorage.removeItem("kyc-pending");
    sessionStorage.removeItem("kyc-state");

    // ✅ 6. Esperar un segundo para que el usuario vea el mensaje de éxito
    await new Promise(resolve => setTimeout(resolve, 1500));

    // ✅ 7. Redirigir a review
    console.log("✅ Redirigiendo a review...");
    window.location.replace("./kyc-review.html");

  } catch (err) {
    console.error("❌ KYC PROCESSING ERROR:", err.message);

    // Mostrar error en la UI
    const container = document.querySelector(".processing-container");
    if (container) {
      container.innerHTML = `
        <img src="./assets/PAYO LOGO_page-0001.png" class="logo" />
        <h2 style="color: #e74c3c;">Error procesando verificación</h2>
        <p>${err.message}</p>
        <button onclick="window.location.href='./registerkyc.html'" 
                style="margin-top: 20px; padding: 12px 24px; background: #3498db; color: white; border: none; border-radius: 8px; cursor: pointer;">
          Volver al formulario
        </button>
      `;
    }
  }
});