/* ============================================
   SIDEBAR KYC RULES (BACKEND-DRIVEN)
============================================ */

import { API_CONFIG } from '../config/api.config.js';

export async function applyKycRules() {
  const kycItem = document.querySelector("[data-kyc-item]");

  if (!kycItem) {
    console.warn("[KYC] data-kyc-item no encontrado");
    return;
  }

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

    const status = String(data.status || "")
      .toLowerCase()
      .trim();

    console.log("[KYC SIDEBAR] status:", status);

    const showFor = [
      "not_started",
      "in_progress",
      "pending",
      "rejected"
    ];

    kycItem.style.display = showFor.includes(status)
      ? "flex"
      : "none";

  } catch (err) {
    console.error("[KYC SIDEBAR ERROR]", err);
    kycItem.style.display = "none";
  }
}
