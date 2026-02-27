import { API_CONFIG } from '../config/api.config.js';

export async function login(email, password) {
  const response = await fetch(`${API_CONFIG.API_ENDPOINT}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Login fallido');
  }

  return data;
}
