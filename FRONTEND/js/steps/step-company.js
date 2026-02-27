// js/steps/step-company.js
import { kycState } from "../state.js";
import { submitCompanyData } from "../api/kyc.api.js"; // ✅ Importar la función correcta

const locked = ["pending", "approved"].includes(kycState.meta.status);

export function renderCompanyStep(container) {
  container.innerHTML = `
    <div class="kyc-step">

      <h2 class="kyc-title">
        Información de la Empresa
      </h2>

      <!-- IDENTIDAD LEGAL -->
      <section class="kyc-section">
        <h3 class="kyc-section-title">Identidad Legal</h3>

        <div class="kyc-form-grid">
          ${input("Razón Social", "legal_name")}
          ${input("Nombre Comercial", "trade_name")}
          ${input("País de Constitución", "incorporation_country")}
          ${input("Fecha de Constitución", "incorporation_date", "date")}
        </div>
      </section>

      <!-- FISCAL -->
      <section class="kyc-section">
        <h3 class="kyc-section-title">Información Fiscal</h3>

        <div class="kyc-form-grid">
          ${input("Tipo de Identificación Tributaria", "tax_id_type")}
          ${input("Número de Identificación Tributaria", "tax_id")}
          ${input("País Fiscal", "tax_country")}
          ${input("Registro Mercantil", "commercial_registry")}
          ${input("Actividad Económica", "economic_activity")}
          ${input("Código de Industria", "industry_code")}
        </div>
      </section>

      <!-- OPERACIÓN -->
      <section class="kyc-section">
        <h3 class="kyc-section-title">Información Operativa</h3>

        <div class="kyc-form-grid">
          ${input("Dirección Comercial", "business_address")}
          ${input("Ciudad", "city")}
          ${input("País", "country")}
          ${input("Código País", "country_code")}
          ${input("Código Postal", "postal_code")}
          ${input("Correo Corporativo", "corporate_email", "email")}
          ${input("Teléfono Corporativo", "corporate_phone")}
          ${input("Moneda de Operación", "operating_currency")}
          ${select(
            "Volumen Mensual de Transacciones",
            "monthly_tx_volume",
            ["LOW", "MEDIUM", "HIGH"]
          )}
        </div>
      </section>

    </div>
  `;

  bindInputs();
}


export async function saveCompanyStep() {
  const payload = { ...kycState.company };

  const hasChanges =
    JSON.stringify(payload) !==
    JSON.stringify(kycState._lastCompanySnapshot);

  // Si ya fue completado y no hay cambios → NO POST
  if (
    kycState.completedSteps.includes("company") &&
    !hasChanges
  ) {
    console.log("[COMPANY] Sin cambios, omitiendo POST");
    return;
  }

  // ✅ LLAMAR AL ENDPOINT CORRECTO
  try {
    await submitCompanyData(payload);
    console.log("[COMPANY] Datos guardados correctamente");

    // Snapshot para detectar cambios futuros
    kycState._lastCompanySnapshot = { ...payload };

    if (!kycState.completedSteps.includes("company")) {
      kycState.completedSteps.push("company");
    }
  } catch (err) {
    console.error("[COMPANY] Error guardando:", err);
    throw err; // Propagar error para que el botón lo capture
  }
}

/* ===============================
   COMPONENTES VISUALES KYC
================================ */

function input(label, field, type = "text") {
  const value = kycState.company[field] || "";
  return `
    <div class="kyc-input">
      <label>${label}</label>
      <input
        type="${type}"
        data-field="${field}"
        value="${value}"
      />
    </div>
  `;
}

function select(label, field, options) {
  const current = kycState.company[field] || "";
  return `
    <div class="kyc-input">
      <label>${label}</label>
      <select data-field="${field}">
        <option value="">Seleccionar...</option>
        ${options
          .map(
            o =>
              `<option value="${o}" ${o === current ? "selected" : ""}>${o}</option>`
          )
          .join("")}
      </select>
    </div>
  `;
}

/* ===============================
   BINDING
================================ */

function bindInputs() {
  document.querySelectorAll("[data-field]").forEach(el => {
    el.addEventListener("input", e => {
      const field = e.target.dataset.field;
      kycState.company[field] = e.target.value;
    });
  });
}

/* ===============================
   VALIDACIÓN
================================ */

export function validateCompany() {
  if (kycState.completedSteps.includes("company")) {
    return true;
  }
  
  const required = [
    "legal_name",
    "incorporation_country",
    "incorporation_date",
    "tax_id_type",
    "tax_id",
    "tax_country",
    "economic_activity",
    "business_address",
    "city",
    "country",
    "country_code",
    "corporate_email",
    "corporate_phone",
    "operating_currency",
    "monthly_tx_volume"
  ];

  for (const field of required) {
    if (!kycState.company[field]) {
      alert(`El campo "${field}" es obligatorio`);
      return false;
    }
  }

  return true;
}
