import { kycState } from "./state.js";
import { API_CONFIG } from "./config/api.config.js";


/* ============================================
   ESTADOS FINALES KYC (FRONTEND)
============================================ */

const FINAL_KYC_STATUS = ["approved", "pending", "rejected"];

let KYC_LOCKED = false;

/* ============================================
   MAPEO FRONTEND ↔ BACKEND
============================================ */

const BACKEND_TO_FRONT_STEP = {
  personal: "personal",
  company: "company",
  documents: "company_docs",
  identity: "selfie"
  // 🚫 review NO VA AQUÍ (no es parte del wizard)
};



const FRONT_TO_BACKEND_STEP = {
  personal: "personal",
  company: "company",
  company_docs: "documents",
  selfie: "identity"
};



import {
  renderPersonalStep,
  savePersonalStep,
  validatePersonalStep
} from "./steps/step-personal.js";

import {
  renderCompanyStep,
  validateCompany,
  saveCompanyStep
} from "./steps/step-company.js";

import {
  renderCompanyDocsStep,
  validateCompanyDocs,
  saveCompanyDocsStep
} from "./steps/step-company-docs.js";

import {
  renderSelfieStep,
  validateSelfieStep,
  saveSelfieStep  // ✅ AGREGAR ESTO
} from "./steps/step-selfie.js";

/* ============================================
   DEFINICIÓN DE PASOS DEL WIZARD KYC
============================================ */

const steps = [
  {
    id: "personal",
    render: renderPersonalStep,
    save: savePersonalStep,
    validate: validatePersonalStep
  },
  {
    id: "company",
    render: renderCompanyStep,
    save: saveCompanyStep,           
    validate: validateCompany
  },
  {
    id: "company_docs",
    render: renderCompanyDocsStep,
    save: saveCompanyDocsStep,           
    validate: validateCompanyDocs
  },
{
  id: "selfie",
  render: renderSelfieStep,
  validate: validateSelfieStep,
  save: async () => {
    // ✅ 1. GUARDAR estado en sessionStorage (para que processing.js lo use)
    sessionStorage.setItem("kyc-state", JSON.stringify(kycState));
    sessionStorage.setItem("kyc-pending", "identity"); // Flag para processing.js
    
    // ✅ 2. NAVEGAR INMEDIATAMENTE (sin esperar subida)
    window.location.href = "./kyc-processing.html";
    
    // ⛔ NO ejecutar nada más aquí - la navegación corta el script
    return "REDIRECTED";
  }
}
];



async function submitFinalKyc() {
  const res = await fetch(`${API_CONFIG.API_ENDPOINT}/kyc/submit`, {
    method: "POST",
    credentials: "include",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
      "Content-Type": "application/json"
    }
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    console.error("[KYC SUBMIT ERROR]", error);
    throw new Error(error.error || "KYC_SUBMIT_FAILED");
  }

  const data = await res.json();
  console.log("[KYC FINAL SUBMIT OK]", data);
  
  return data; // ✅ Retorna confirmación
}


/* ============================================
   DOM
============================================ */

const container = document.getElementById("step-container");
const nextBtn = document.getElementById("nextBtn");
const prevBtn = document.getElementById("prevBtn");
const dashBtn = document.getElementById("dashBtn")


/* ============================================
   BARRA DE PROGRESO (WIZARD)
============================================ */

function updateWizardUI() {
  const stepsUI = document.querySelectorAll(".progress-step");

  stepsUI.forEach((el, index) => {
    el.classList.toggle("active", index === kycState.currentStep);
    el.classList.toggle("completed", index < kycState.currentStep);
  });
}


/* ============================================
   RENDER DEL PASO ACTUAL
============================================ */

function render() {
  container.innerHTML = "";

  const step = steps[kycState.currentStep];
  step.render(container);

  updateWizardUI();

  prevBtn.classList.toggle("hidden", kycState.currentStep === 0);

  // cambiar texto del botón al final
  if (kycState.currentStep === steps.length - 1) {
    nextBtn.textContent = "Enviar KYC";
  } else {
    nextBtn.textContent = "Continuar";
  }
  
  // ✅ GUARDAR ESTADO ACTUAL EN SESSIONSTORAGE
  sessionStorage.setItem("kyc-state", JSON.stringify(kycState));
}


/* ============================================
   EVENTOS
============================================ */

nextBtn.onclick = async () => {
  const step = steps[kycState.currentStep];

  if (!step.validate()) return;

  let result;
  try {
    result = await step.save();
  } catch (e) {
    console.error("Error guardando datos:", e);
    alert("Error guardando datos");
    return;
  }

  // ⛔ SI REDIRIGIÓ, NO SIGAS
  if (result === "REDIRECTED") {
    return;
  }

  if (kycState.currentStep < steps.length - 1) {
    kycState.currentStep++;
    
    // ✅ GUARDAR ESTADO INMEDIATAMENTE
    sessionStorage.setItem("kyc-state", JSON.stringify(kycState));
    
    render();

  }
};

prevBtn.onclick = () => {
  if (kycState.currentStep > 0) {
    kycState.currentStep--;
    render();
  }
};

dashBtn.onclick = () => {
  const confirmExit = confirm(
    "¿Seguro que deseas salir del proceso de verificación?\nPodrás continuarlo más tarde."
  );

  if (!confirmExit) return;

  window.location.href = "./dashboard.html";
};






/* ============================================
   INIT (BACKEND-DRIVEN)
============================================ */
async function initKyc() {
  try {
    const res = await fetch(`${API_CONFIG.API_ENDPOINT}/kyc/status`, {
      credentials: "include",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("auth_token")}`
      }
    });

    if (!res.ok) {
      throw new Error("KYC_STATUS_FETCH_FAILED");
    }

    const data = await res.json();

    console.log("[KYC STATUS BACKEND]", data);

    /* ============================
       1️⃣ ESTADOS FINALES → SALIDA INMEDIATA
       (pending / approved / rejected)
    ============================ */
    if (FINAL_KYC_STATUS.includes(data.status)) {
      console.log("🔒 KYC EN ESTADO FINAL:", data.status);

      // 🔒 bloquear wizard definitivamente
      KYC_LOCKED = true;

      // 🧹 limpiar cualquier rastro local
      sessionStorage.removeItem("kyc-state");
      sessionStorage.removeItem("kyc-pending");

      // 🚪 salir SIN renderizar wizard
      window.location.replace("./kyc-review.html");
      return;
    }

    /* ============================
       2️⃣ MAPEO BACKEND → FRONTEND
       (solo estados NO finales)
    ============================ */
    const backendStep = data.current_step;
    const frontendStep = BACKEND_TO_FRONT_STEP[backendStep];

    console.log("[INIT] Backend step:", backendStep);
    console.log("[INIT] Frontend step:", frontendStep);

    if (!frontendStep) {
      console.warn("⚠️ Paso backend no reconocido:", backendStep);
      
      // ✅ En vez de volver al inicio, mantener en el último paso conocido
      // o usar el paso guardado en sessionStorage si existe
      const savedState = sessionStorage.getItem("kyc-state");
      if (savedState) {
        try {
          const parsed = JSON.parse(savedState);
          kycState.currentStep = parsed.currentStep || 0;
          console.log("[INIT] Restaurado desde sessionStorage:", kycState.currentStep);
        } catch {
          kycState.currentStep = 0;
        }
      } else {
        kycState.currentStep = 0;
      }
    } else {
      const stepIndex = steps.findIndex(
        step => step.id === frontendStep
      );

      if (stepIndex < 0) {
        console.warn("⚠️ Paso frontend no encontrado:", frontendStep);
        kycState.currentStep = 0;
      } else {
        kycState.currentStep = stepIndex;
        console.log("[INIT] Paso restaurado correctamente:", stepIndex, frontendStep);
      }
    }

    // ✅ GUARDAR ESTADO EN SESSIONSTORAGE
    sessionStorage.setItem("kyc-state", JSON.stringify(kycState));

  } catch (err) {
    console.error("❌ KYC INIT ERROR:", err);

    // 🛡 fallback defensivo: intentar restaurar desde sessionStorage
    const savedState = sessionStorage.getItem("kyc-state");
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        kycState.currentStep = parsed.currentStep || 0;
        console.log("[INIT] Fallback desde sessionStorage:", kycState.currentStep);
      } catch {
        kycState.currentStep = 0;
      }
    } else {
      kycState.currentStep = 0;
    }
  }

  /* ============================
     3️⃣ RENDER CONTROLADO
     (solo si wizard NO está bloqueado)
  ============================ */
  if (!KYC_LOCKED) {
    render();
  }
}

initKyc();