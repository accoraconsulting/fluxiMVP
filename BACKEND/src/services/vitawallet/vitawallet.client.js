/**
 * VITAWALLET CLIENT
 * Cliente HTTP con autenticación HMAC-SHA256
 *
 * En modo LOCAL: no hace llamadas HTTP. Los servicios no deben llamar al client.
 * En modo SANDBOX/PRODUCTION: llamadas reales con autenticación HMAC.
 */

import https from 'https';
import crypto from 'crypto';
import config from './vitawallet.config.js';

class VitawalletClient {
  constructor() {
    this.env = config.ENVIRONMENT;
    this.mode = config.MODE;

    if (config.isLocal()) {
      console.log('[VITAWALLET] Modo LOCAL activo - HTTP deshabilitado, usando datos mock');
      return;
    }

    // Solo cargar credenciales si NO es modo local
    this.credentials = config[this.env];
    this.baseUrl = this.credentials.BASE_URL;
    this.login = (this.credentials.LOGIN || '').trim();
    this.transKey = (this.credentials.TRANS_KEY || '').trim();
    this.secretKey = (this.credentials.SECRET_KEY || '').trim();
    this.timeout = config.TIMEOUT_MS;

    console.log(`[VITAWALLET] Modo ${this.mode.toUpperCase()} - Conectando a ${this.baseUrl}`);
  }

  /**
   * sorted_request_body según documentación:
   * Keys ordenadas alfabéticamente, concatenadas sin separadores.
   * Arrays se unen con coma.
   */
  sortedBodyString(obj) {
    if (obj === null || obj === undefined) return '';
    if (typeof obj !== 'object') return String(obj);
    if (Array.isArray(obj)) {
      return obj.map(item => this.sortedBodyString(item)).join(',');
    }
    return Object.keys(obj).sort().map(key => {
      return key + this.sortedBodyString(obj[key]);
    }).join('');
  }

  /**
   * Genera firma HMAC-SHA256:
   * signature = hmac(secretKey, x_login + x_date + sorted_request_body).hexdigest()
   */
  generateSignature(xDate, body = null) {
    let message = this.login + xDate;
    if (body !== null && body !== undefined) {
      message += this.sortedBodyString(body);
    }
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(message)
      .digest('hex');
  }

  /**
   * Ejecuta request HTTP a Vitawallet API
   */
  async request(method, endpoint, body = null) {
    // Guard: en modo local, no se deben hacer llamadas HTTP
    if (config.isLocal()) {
      throw new Error(`[VITAWALLET] request() llamado en modo LOCAL. Los servicios deben usar mock data directamente.`);
    }

    return new Promise((resolve, reject) => {
      try {
        const xDate = new Date().toISOString();
        const signature = this.generateSignature(xDate, body);

        const headers = {
          'x-date': xDate,
          'x-login': this.login,
          'x-trans-key': this.transKey,
          'Content-Type': 'application/json',
          'Authorization': `V2-HMAC-SHA256, Signature: ${signature}`,
        };

        const url = new URL(this.baseUrl + endpoint);
        const options = {
          hostname: url.hostname,
          port: url.port || 443,
          path: url.pathname + url.search,
          method,
          headers,
          timeout: this.timeout,
        };

        if (config.DEBUG) {
          console.log(`[VITAWALLET] ${method} ${this.baseUrl}${endpoint}`);
        }

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const parsed = data ? JSON.parse(data) : {};
              if (config.DEBUG) {
                console.log(`[VITAWALLET] Response ${res.statusCode}:`, JSON.stringify(parsed).substring(0, 300));
              }
              if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve({ status: res.statusCode, data: parsed, headers: res.headers });
              } else {
                reject({ status: res.statusCode, error: parsed.error || parsed.message || 'Unknown error', data: parsed, endpoint });
              }
            } catch (parseErr) {
              reject({ status: res.statusCode, error: 'Parse error', rawData: data });
            }
          });
        });

        req.on('error', (err) => reject({ error: 'Network error', message: err.message, code: err.code }));
        req.on('timeout', () => { req.destroy(); reject({ error: 'Timeout', timeout: this.timeout }); });

        if (body) req.write(JSON.stringify(body));
        req.end();
      } catch (err) {
        reject({ error: 'Request preparation error', message: err.message });
      }
    });
  }

  async get(endpoint) { return this.request('GET', endpoint); }
  async post(endpoint, body) { return this.request('POST', endpoint, body); }
  async put(endpoint, body) { return this.request('PUT', endpoint, body); }
  async patch(endpoint, body) { return this.request('PATCH', endpoint, body); }
  async delete(endpoint) { return this.request('DELETE', endpoint); }
}

export default new VitawalletClient();
