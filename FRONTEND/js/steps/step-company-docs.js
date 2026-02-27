import { kycState } from "../state.js";
import { uploadDocument } from "../api/kyc.api.js";
import { API_CONFIG } from "../config/api.config.js";

const apiBase = API_CONFIG.API_ENDPOINT;

/* ======================================================
   CATÁLOGO OFICIAL DE DOCUMENTOS CORPORATIVOS
   (esto es lo que el backend y compliance esperan)
====================================================== */

const COMPANY_DOCUMENTS = [
  { id: "RUT", name: "Copia del RUT", description: "No mayor a 30 días (PN y PJ)", required: true },
  { id: "CAMARA_COMERCIO", name: "Certificado Cámara de Comercio", description: "No mayor a 30 días (PJ o PN cuando aplique)", required: true },
  { id: "REPRESENTANTE_ID", name: "Documento de Identidad del Representante Legal", description: "Aplica para Persona Jurídica", required: true },
  { id: "ESTADOS_FINANCIEROS", name: "Estados Financieros", description: "Corte a 31 de diciembre del año anterior", required: true },
  { id: "REF_COMERCIALES_1", name: "Referencia Comercial #1", description: "PN y PJ", required: true },
  { id: "REF_COMERCIALES_2", name: "Referencia Comercial #2", description: "PN y PJ", required: true },
  { id: "REF_BANCARIA_1", name: "Referencia Bancaria #1", description: "PN y PJ", required: true },
  { id: "REF_BANCARIA_2", name: "Referencia Bancaria #2", description: "PN y PJ", required: true },
  { id: "CERT_BANCARIA", name: "Certificación Bancaria", description: "No mayor a 30 días", required: true },
  { id: "SST", name: "Certificación Seguridad y Salud en el Trabajo", description: "Si aplica", required: false },
  { id: "CERT_COMPETENCIA", name: "Certificado de Competencia", description: "Si aplica", required: false },
  { id: "COMPOSICION_ACCIONARIA", name: "Certificación de Composición Accionaria", description: "Hasta beneficiario final", required: true },
  { id: "DIRECTORES_ACCIONISTAS", name: "Identificación de Accionistas y Directivos", description: "Directores y Junta Directiva", required: true }
];

/* ======================================================
   ✅ CARGAR DOCUMENTOS DESDE EL BACKEND
====================================================== */

async function loadUploadedDocuments() {
  try {
    const token = localStorage.getItem("auth_token");
    
    if (!token) {
      console.warn("[DOCS] No hay token, omitiendo carga");
      return;
    }

    const res = await fetch(`${apiBase}/kyc/documents`, {
      method: "GET",
      credentials: "include",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      console.warn("[DOCS] Error cargando documentos:", res.status);
      return;
    }

    const data = await res.json();
    
    console.log("[DOCS] Respuesta del backend:", data);

    // ✅ Mapear documentos del backend al estado local
    if (data.documents && Array.isArray(data.documents)) {
      kycState.companyDocuments = data.documents.map(doc => ({
        document_type_id: doc.document_type_code, // ✅ Usar el CODE, no el UUID
        name: doc.document_type_name,
        file: {
          name: doc.file_name,
          url: doc.file_url,
          status: doc.status
        }
      }));

      console.log("[DOCS] Estado actualizado:", kycState.companyDocuments);
    }

  } catch (err) {
    console.error("[DOCS] Error cargando documentos:", err);
  }
}
/* ======================================================
   RENDER DE UNA TARJETA DE DOCUMENTO
====================================================== */

function renderDocumentRow(doc) {
  const uploaded = kycState.companyDocuments.find(
    d => d.document_type_id === doc.id
  );

  const stateClass = uploaded
    ? "doc-uploaded"
    : doc.required
    ? "doc-required"
    : "doc-optional";

  return `
    <div class="doc-card ${stateClass}">
      <div class="doc-info">
        <div class="doc-title">
          ${doc.name}
          ${doc.required ? '<span class="doc-required-badge">Obligatorio</span>' : ''}
        </div>

        <div class="doc-desc">${doc.description}</div>

        ${
          uploaded
            ? `<div class="doc-file">✅ ${uploaded.file.name}</div>`
            : `<div class="doc-missing">❌ Archivo no cargado</div>`
        }
      </div>

      <div class="doc-action">
        <label class="doc-upload-btn">
          ${uploaded ? "Reemplazar" : "Subir"}
          <input type="file" data-doc="${doc.id}" hidden />
        </label>
      </div>
    </div>
  `;
}


/* ======================================================
   RENDER PRINCIPAL DEL PASO
====================================================== */

export async function renderCompanyDocsStep(container) {
  if (!container) return;

  // ✅ CARGAR DOCUMENTOS ANTES DE RENDERIZAR
  await loadUploadedDocuments();

  container.innerHTML = `
    <div class="docs-wrapper">
      <h2 class="docs-title">Documentos de la Empresa</h2>
      <p class="docs-subtitle">
        Cargue los documentos requeridos para validar su empresa.
      </p>

      <div class="docs-grid">
        ${COMPANY_DOCUMENTS.map(renderDocumentRow).join("")}
      </div>
    </div>
  `;

  bindUploads();
  checkCompanyDocsCompletion();
}


/* ======================================================
   MANEJO DE SUBIDA DE ARCHIVOS
====================================================== */

function bindUploads() {
  document.querySelectorAll("[data-doc]").forEach(input => {
    input.addEventListener("change", async e => {
      const file = e.target.files[0];
      if (!file) return;

      const docId = e.target.dataset.doc;
      const docMeta = COMPANY_DOCUMENTS.find(d => d.id === docId);

      try {
        const result = await uploadDocument({
          document_type_id: docId,
          file
        });

        console.log("[DOCS] Documento subido:", result);

        // eliminar versión previa
        kycState.companyDocuments = kycState.companyDocuments.filter(
          d => d.document_type_id !== docId
        );

        // guardar metadata REAL (lo que viene del backend)
        kycState.companyDocuments.push({
          document_type_id: docId,
          name: docMeta.name,
          file: {
            name: file.name,
            url: result.url,
            status: result.status
          }
        });
        
        checkCompanyDocsCompletion();

        // ✅ Re-renderizar para mostrar el documento subido
        renderCompanyDocsStep(document.getElementById("step-container"));

      } catch (err) {
        console.error("UPLOAD FAILED", err);
        alert("No se pudo subir el documento: " + err.message);
      }
    });
  });
}

/* ======================================================
   VALIDACIÓN FORMAL PARA EL WIZARD
====================================================== */

export function validateCompanyDocs() {
  if (kycState.completedSteps.includes("company_docs")) {
    return true;
  }

  const missingRequired = COMPANY_DOCUMENTS.filter(
    doc =>
      doc.required &&
      !kycState.companyDocuments.some(
        f => f.document_type_id === doc.id
      )
  );

  if (missingRequired.length > 0) {
    alert("Debe cargar todos los documentos obligatorios antes de continuar.");
    return false;
  }

  return true;
}

function checkCompanyDocsCompletion() {
  const allRequiredUploaded = COMPANY_DOCUMENTS
    .filter(d => d.required)
    .every(doc =>
      kycState.companyDocuments.some(
        f => f.document_type_id === doc.id
      )
    );

  if (allRequiredUploaded) {
    if (!kycState.completedSteps.includes("company_docs")) {
      kycState.completedSteps.push("company_docs");
    }
  }
}

/* ======================================================
   GUARDAR PASO (AVANZAR ESTADO EN BACKEND)
====================================================== */

export async function saveCompanyDocsStep() {
  // Validar que todos los requeridos estén
  const missingRequired = COMPANY_DOCUMENTS.filter(
    doc =>
      doc.required &&
      !kycState.companyDocuments.some(
        f => f.document_type_id === doc.id
      )
  );

  if (missingRequired.length > 0) {
    console.warn("[DOCS] Faltan documentos requeridos:", missingRequired);
    return; // No avanzar si faltan documentos
  }

  // ✅ AVANZAR PASO EN EL BACKEND
  try {
    const token = localStorage.getItem("auth_token");
    
    const res = await fetch(`${apiBase}/kyc/documents/complete`, {
      method: "POST",
      credentials: "include",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) {
      throw new Error("DOCUMENTS_COMPLETE_FAILED");
    }

    const data = await res.json();
    console.log("[DOCS] Paso completado:", data);

    // Marcar como completado
    if (!kycState.completedSteps.includes("company_docs")) {
      kycState.completedSteps.push("company_docs");
    }

  } catch (err) {
    console.error("[DOCS] Error completando paso:", err);
    throw err;
  }
}