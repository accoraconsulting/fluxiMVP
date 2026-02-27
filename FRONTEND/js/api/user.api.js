import { getSession } from "../auth/session.js";
import { API_CONFIG } from "../config/api.config.js";

const API = `${API_CONFIG.API_ENDPOINT}/user`;

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
   OBTENER PERFIL COMPLETO
===================================================== */
export async function getUserProfile() {
  const res = await fetch(`${API}/profile`, {
    method: "GET",
    headers: {
      ...authHeaders()
    }
  });

  const result = await res.json();

  if (!res.ok) {
    console.error("GET PROFILE ERROR:", result);
    throw new Error(result.error || "PROFILE_FETCH_FAILED");
  }

  return result;
}

/* =====================================================
   ACTUALIZAR USERNAME
===================================================== */
export async function updateUsername(username) {
  const res = await fetch(`${API}/username`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders()
    },
    body: JSON.stringify({ username })
  });

  const result = await res.json();

  if (!res.ok) {
    console.error("UPDATE USERNAME ERROR:", result);
    throw new Error(result.error || "USERNAME_UPDATE_FAILED");
  }

  return result;
}