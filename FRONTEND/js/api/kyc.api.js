import { getSession } from "../auth/session.js";
import { API_CONFIG } from "../config/api.config.js";

/* =====================================================
   CONFIG
===================================================== */

const API = `${API_CONFIG.API_ENDPOINT}/kyc`;

/* =====================================================
   AUTH HEADERS (ÚNICA FUENTE DE VERDAD)
===================================================== */

function authHeaders() {
  const session = getSession();

  if (!session || !session.token) {
    throw new Error("SESSION_NOT_FOUND");
  }

  return {
    Authorization: `Bearer ${session.token}`
  };
}

/* =====================================================
   PERSONAL KYC
===================================================== */

export async function submitPersonalData(data) {
  const res = await fetch(`${API}/personal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders()
    },
    body: JSON.stringify(data)
  });

  const result = await res.json();

  if (!res.ok) {
    console.error("PERSONAL KYC ERROR:", result);
    throw new Error(result.error || "PERSONAL_KYC_FAILED");
  }

  return result;
}

/* =====================================================
   COMPANY KYC
===================================================== */

export async function submitCompanyData(data) {
  const res = await fetch(`${API}/company`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders()
    },
    body: JSON.stringify(data)
  });

  const result = await res.json();

  if (!res.ok) {
    console.error("COMPANY KYC ERROR:", result);
    throw new Error(result.error || "COMPANY_KYC_FAILED");
  }

  return result;
}

/* =====================================================
   DOCUMENT UPLOAD
===================================================== */

export async function uploadDocument({ document_type_id, file }) {
  if (!document_type_id) {
    throw new Error("DOCUMENT_TYPE_ID_MISSING");
  }

  if (!file) {
    throw new Error("FILE_MISSING");
  }

  const token = localStorage.getItem("auth_token");

  if (!token) {
    throw new Error("NO_TOKEN");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("document_type_id", document_type_id);

  const res = await fetch(`${API_CONFIG.API_ENDPOINT}/kyc/documents`, {
    method: "POST",
    body: formData,
    credentials: "include",
    headers: {
      Authorization: `Bearer ${token}`
      // ⚠️ NO pongas Content-Type con FormData
    }
  });

  let result = null;

  try {
    result = await res.json();
  } catch {
    throw new Error("INVALID_SERVER_RESPONSE");
  }

  if (!res.ok) {
    console.error("DOCUMENT UPLOAD ERROR:", result);
    throw new Error(result.error || "DOCUMENT_UPLOAD_FAILED");
  }

  return result;
}



/* =====================================================
   STEP SYNC (WIZARD)
===================================================== */
export async function syncKycStep(step) {
  if (!step) {
    throw new Error("KYC_STEP_REQUIRED");
  }

  const res = await fetch(`${API}/step`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders()
    },
    body: JSON.stringify({ step })
  });

  // 🔒 evitar crash si backend devuelve HTML
  let result = null;
  try {
    result = await res.json();
  } catch {
    throw new Error("INVALID_BACKEND_RESPONSE");
  }

  if (!res.ok) {
    throw new Error(result?.error || "KYC_STEP_FAILED");
  }

  return result;
}

/* =====================================================
   IDENTITY STEP (SELFIE + DOCUMENTOS BASE64)
===================================================== */


export async function submitIdentityStep(payload) {
  if (!payload || typeof payload !== "object") {
    console.error("❌ Payload inválido en submitIdentityStep:", payload);
    throw new Error("INVALID_IDENTITY_PAYLOAD");
  }

  console.log("🌐 Enviando IDENTITY payload:", payload);

  const res = await fetch(`${API}/identity`, {
    method: "POST",
    credentials: "include", // ✅ MUY IMPORTANTE (cookies / sesión)
    headers: {
      "Content-Type": "application/json",
      ...authHeaders()
    },
    body: JSON.stringify(payload)
  });

  let result = null;

  try {
    result = await res.json();
  } catch (err) {
    console.error("❌ No se pudo parsear JSON de respuesta:", err);
    throw new Error("INVALID_BACKEND_RESPONSE");
  }

  if (!res.ok) {
    console.error("🚨 KYC IDENTITY ERROR:", result);
    throw new Error(result.error || "KYC_IDENTITY_FAILED");
  }

  console.log("✅ KYC IDENTITY OK:", result);

  return result;
}


/* =====================================================
   KYC STATUS (SOURCE OF TRUTH)
===================================================== */

export async function getKycStatus() {
  const res = await fetch(`${API}/status`, {
    headers: {
      ...authHeaders()
    }
  });

  const result = await res.json();

  if (!res.ok) {
    console.error("KYC STATUS ERROR:", result);
    throw new Error(result.error || "KYC_STATUS_FAILED");
  }

  return result;
}


/* =====================================================
   KYC PROGRESS SYNC
===================================================== */

export async function updateKycProgress(step) {
  if (!step) {
    throw new Error("KYC_STEP_REQUIRED");
  }

  const res = await fetch(`${API}/progress`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders()
    },
    body: JSON.stringify({ step })
  });

  const result = await res.json();

  if (!res.ok) {
    console.error("KYC PROGRESS ERROR:", result);
    throw new Error(result.error || "KYC_PROGRESS_FAILED");
  }

  return result;
}
