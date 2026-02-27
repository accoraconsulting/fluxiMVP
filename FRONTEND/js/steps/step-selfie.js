import { kycState } from "../state.js";
import { submitIdentityStep } from "../api/kyc.api.js";

let currentStream = null;
let currentTarget = null;


/* ===============================
   RENDER
================================ */

export function renderSelfieStep(container) {
  const id = kycState.identity || {};

  container.innerHTML = `
    <div class="kyc-biometric">

      <h2 class="kyc-title">Verificación de Identidad</h2>
      <p class="kyc-subtitle">
        Capture ambas caras de su documento y una selfie en tiempo real.
      </p>

      <div class="kyc-biometric-grid">
        ${renderBox("documentFront", "Documento - Frente", id.documentFront)}
        ${renderBox("documentBack", "Documento - Reverso", id.documentBack)}
        ${renderBox("selfie", "Selfie", id.selfie)}
      </div>

      <div class="kyc-consents">
        <label class="kyc-check">
          <input type="checkbox" id="consentData" ${id.consentData ? "checked" : ""}>
          Autorizo el tratamiento de mis datos personales
        </label>

        <label class="kyc-check">
          <input type="checkbox" id="consentIdentity" ${id.consentIdentity ? "checked" : ""}>
          Autorizo la verificación de mi identidad
        </label>
      </div>

      <div class="kyc-camera hidden" id="cameraModal">
        <video id="video" autoplay playsinline muted></video>

        <div class="camera-actions">
          <button id="captureBtn">Capturar</button>
          <button id="cancelBtn">Cancelar</button>
        </div>
      </div>

    </div>
  `;

  bindUI();
  checkIdentityCompletion();
}

function renderBox(key, label, img) {
  return `
    <div class="kyc-upload-box ${img ? "uploaded" : ""}" data-target="${key}">
      <span>${label}</span>
      ${
        img
          ? `<img src="${img}" class="preview-img" />`
          : `<p class="hint">Click para abrir cámara</p>`
      }
    </div>
  `;
}

/* ===============================
   UI BINDING
================================ */

function bindUI() {
  document.querySelectorAll(".kyc-upload-box").forEach(box => {
    box.onclick = () => openCamera(box.dataset.target);
  });

  document.getElementById("captureBtn").onclick = capturePhoto;
  document.getElementById("cancelBtn").onclick = closeCamera;

  document.getElementById("consentData").onchange = e => {
    ensureIdentity();
    kycState.identity.consentData = e.target.checked;
    checkIdentityCompletion();
  };

  document.getElementById("consentIdentity").onchange = e => {
    ensureIdentity();
    kycState.identity.consentIdentity = e.target.checked;
    checkIdentityCompletion();
  };
}

/* ===============================
   CAMERA
================================ */

async function openCamera(target) {
  currentTarget = target;

  try {
    const constraints = {
      video: {
        facingMode: target === "selfie" ? "user" : { ideal: "environment" }
      },
      audio: false
    };

    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    document.getElementById("video").srcObject = currentStream;
    document.getElementById("cameraModal").classList.remove("hidden");
  } catch (e) {
    console.error(e);
    alert("No se pudo acceder a la cámara.");
  }
}

function closeCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
    currentStream = null;
  }
  document.getElementById("cameraModal").classList.add("hidden");
}

function capturePhoto() {
  const video = document.getElementById("video");

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0);

  const img = canvas.toDataURL("image/jpeg", 0.9);

  ensureIdentity();
  kycState.identity[currentTarget] = img;

  closeCamera();
  checkIdentityCompletion();
  renderSelfieStep(document.getElementById("step-container"));
}

/* ===============================
   VALIDATION
================================ */

export function validateSelfieStep() {
  if (kycState.completedSteps.includes("selfie")) {
    return true;
  }
  
  const id = kycState.identity || {};

  if (!id.documentFront || !id.documentBack || !id.selfie) {
    alert("Debe capturar ambas caras del documento y una selfie.");
    return false;
  }

  if (!id.consentData || !id.consentIdentity) {
    alert("Debe aceptar ambas autorizaciones legales.");
    return false;
  }

  return true;
}

/* ===============================
   ✅ SAVE - SUBIR AL BACKEND
================================ */

export async function saveSelfieStep() {
  const identity = kycState.identity;

  if (!identity) {
    alert("No hay información de identidad.");
    throw new Error("NO_IDENTITY_DATA");
  }

  // ✅ ENVIAR AL BACKEND
  try {
    console.log("[SELFIE] Enviando datos al backend...");

    const payload = {
      documentFront: identity.documentFront,
      documentBack: identity.documentBack,
      selfie: identity.selfie,
      consentData: identity.consentData,
      consentIdentity: identity.consentIdentity
    };

    await submitIdentityStep(payload);

    console.log("[SELFIE] Datos guardados correctamente");

    // Marcar como completado
    if (!kycState.completedSteps.includes("selfie")) {
      kycState.completedSteps.push("selfie");
    }

    // Guardar en sessionStorage
    sessionStorage.setItem("kyc-state", JSON.stringify(kycState));

    // Cerrar cámara si está abierta
    if (currentStream) {
      currentStream.getTracks().forEach(t => t.stop());
      currentStream = null;
    }

  } catch (err) {
    console.error("[SELFIE] Error guardando:", err);
    throw err; // Propagar error para que el botón lo capture
  }
}

/* ===============================
   HELPERS
================================ */

function ensureIdentity() {
  if (!kycState.identity) {
    kycState.identity = {};
  }
}

function checkIdentityCompletion() {
  const id = kycState.identity;

  if (
    id?.documentFront &&
    id?.documentBack &&
    id?.selfie &&
    id?.consentData &&
    id?.consentIdentity
  ) {
    if (!kycState.completedSteps.includes("selfie")) {
      kycState.completedSteps.push("selfie");
    }
  }
}