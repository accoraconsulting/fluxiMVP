// state.loader.js
/**
 * ======================================================
 * KYC STATE LOADER
 * ======================================================
 * Responsabilidad ÚNICA:
 * - Hidratar el estado del KYC desde el backend
 * - Backend es la fuente de verdad
 * - NO renderiza
 * - NO guarda
 */

import { kycState } from "./state.js";

/**
 * Sincroniza estado backend → frontend
 * Debe ejecutarse UNA SOLA VEZ al iniciar el wizard
 */
export async function hydrateKycState() {
  const res = await fetch("/api/kyc/state", {
    method: "GET",
    credentials: "include"
  });

  if (!res.ok) {
    throw new Error("FAILED_TO_LOAD_KYC_STATE");
  }

  const data = await res.json();

  /* ===============================
     META GLOBAL
  =============================== */
  kycState.meta.status = data.status || "not_started";
  kycState.meta.kyc_id = data.kyc_id || null;

  /* ===============================
     CONTROL DEL WIZARD
  =============================== */
  kycState.currentStep = data.current_step || "personal";
  kycState.completedSteps = Array.isArray(data.completed_steps)
    ? data.completed_steps
    : [];

  /* ===============================
     DATOS PERSONALES
  =============================== */
  if (data.personal) {
    kycState.personal = {
      ...kycState.personal,
      ...data.personal
    };
  }

  /* ===============================
     DATOS DE EMPRESA
  =============================== */
  if (data.company) {
    kycState.company = {
      ...kycState.company,
      ...data.company
    };
  }

  /* ===============================
     DOCUMENTOS
  =============================== */
  if (Array.isArray(data.documents)) {
    kycState.documents = data.documents;
  }

  if (Array.isArray(data.companyDocuments)) {
    kycState.companyDocuments = data.companyDocuments;
  }
}
