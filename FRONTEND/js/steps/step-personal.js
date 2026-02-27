import { kycState } from "../state.js";
import { submitPersonalData } from "../api/kyc.api.js"; // ✅ Usar la función correcta

const locked = ["approved", "pending"].includes(kycState.meta.status);

export function renderPersonalStep(container) {
  container.innerHTML = `
    <div class="kyc-step">
      <h2 class="kyc-title">
        Información del representante legal
      </h2>
      <div class="kyc-form-grid">
        ${input("Nombres completos", "first_name")}
        ${input("Apellidos completos", "last_name")}
        ${input("Fecha de nacimiento", "date_of_birth", "date")}
        ${input("Nacionalidad", "nationality")}
        <div class="kyc-input">
          <label>Tipo de documento</label>
          <select id="document_type">
            <option value="">Seleccionar...</option>
            <option value="DNI">DNI</option>
            <option value="Pasaporte">Pasaporte</option>
            <option value="Cédula">Cédula</option>
            <option value="Otro">Otro</option>
          </select>
        </div>
        ${input("Número de documento", "document_number")}
        ${input("País de emisión", "country")}
        ${input("Fecha de expiración (si aplica)", "document_expiration_date", "date")}
        ${input("Cargo en la empresa", "role")}
        ${input("Correo electrónico", "email", "email")}
        ${input("Teléfono", "phone")}
        ${input("Código de país", "country_code")}
      </div>
      <div class="kyc-declarations">
        ${checkbox("Declaro ser representante legal autorizado")}
        ${checkbox("Autorizo verificación de identidad y empresa")}
        ${checkbox("Declaro que la información es veraz")}
      </div>
    </div>
  `;
}

export async function savePersonalStep() {
  const payload = {
    first_name: value("first_name"),
    last_name: value("last_name"),
    date_of_birth: value("date_of_birth"),
    nationality: value("nationality"),
    country: value("country"),
    document_type: value("document_type"),
    document_number: value("document_number"),
    document_expiration_date: value("document_expiration_date") || null,
    email: value("email"),
    phone: value("phone"),
    country_code: value("country_code"),
    role_in_company: value("role"),
    position_in_company: value("role") // ✅ Agregar campo requerido por backend
  };

  // Detectar cambios reales
  const hasChanges =
    JSON.stringify(payload) !== JSON.stringify(kycState.personal);

  // Actualizar estado local
  kycState.personal = payload;

  // Si ya fue guardado y no hay cambios → NO POST
  if (
    kycState.completedSteps.includes("personal") &&
    !hasChanges
  ) {
    console.log("[PERSONAL] Sin cambios, omitiendo POST");
    return;
  }

  // ✅ LLAMAR AL ENDPOINT CORRECTO
  try {
    await submitPersonalData(payload);
    console.log("[PERSONAL] Datos guardados correctamente");

    // Marcar paso como completado
    if (!kycState.completedSteps.includes("personal")) {
      kycState.completedSteps.push("personal");
    }
  } catch (err) {
    console.error("[PERSONAL] Error guardando:", err);
    throw err; // Propagar error para que el botón lo capture
  }
}

export function validatePersonalStep() {
  if (kycState.completedSteps.includes("personal")) {
    return true;
  }

  const required = [
    "first_name",
    "last_name",
    "date_of_birth",
    "nationality",
    "country",
    "document_type",
    "document_number",
    "email"
  ];

  for (const field of required) {
    if (!value(field)) {
      alert(`El campo "${field}" es obligatorio`); // ✅ Corregir sintaxis
      return false;
    }
  }

  return true;
}

function input(label, id, type = "text") {
  const val = kycState.personal?.[id] || "";
  return `
    <div class="kyc-input">
      <label>${label}</label>
      <input type="${type}" id="${id}" value="${val}">
    </div>
  `;
}

function checkbox(text) {
  return `
    <label class="kyc-checkbox">
      <input type="checkbox">
      <span>${text}</span>
    </label>
  `;
}

const value = id => document.getElementById(id)?.value?.trim();
