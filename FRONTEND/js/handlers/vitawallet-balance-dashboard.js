/**
 * VITAWALLET BALANCE DASHBOARD
 * Componente que trae el balance de Vita y lo muestra en el dashboard
 *
 * Funciones:
 * - loadVitaBalance() - Carga el balance desde el backend
 * - displayVitaBalance(balances) - Muestra el balance en la UI
 * - formatCurrency(amount, currency) - Formatea moneda
 */

console.log('[VitaWalletDashboard] 🚀 Script cargando...');

const VITAWALLET_API = '/api/vitawallet/balance';
const HEALTH_CHECK_API = '/api/vitawallet/health';
const REFRESH_INTERVAL = 30000; // 30 segundos

class VitaWalletDashboard {
  constructor() {
    this.container = null;
    this.balances = {};
    this.lastUpdate = null;
    this.isConnected = false;
    this.authToken = null;
  }

  /**
   * Obtiene el rol del usuario desde localStorage
   */
  getUserRole() {
    try {
      const userStr = localStorage.getItem('auth_user');
      if (!userStr) {
        console.log('[VitaWalletDashboard] ⚠️ No hay usuario en localStorage');
        return null;
      }
      const user = JSON.parse(userStr);
      return user.role || null;
    } catch (error) {
      console.error('[VitaWalletDashboard] Error obteniendo rol:', error.message);
      return null;
    }
  }

  /**
   * Obtiene el token de autenticación
   */
  getAuthToken() {
    return localStorage.getItem('auth_token');
  }

  /**
   * Verifica si el usuario es fluxiAdmin
   */
  isAdmin() {
    const role = this.getUserRole();
    return role === 'fluxiAdmin';
  }

  /**
   * Inicializa el componente
   * Crea el HTML y carga los datos
   * SOLO PARA FLUXIADMIN
   */
  async init() {
    console.log('[VitaWalletDashboard] Inicializando...');

    // Verificar si es admin
    if (!this.isAdmin()) {
      console.log('[VitaWalletDashboard] ⚠️ Usuario no es fluxiAdmin, ocultando Vita Wallet');
      return;
    }

    // Obtener token de autenticación
    this.authToken = this.getAuthToken();
    if (!this.authToken) {
      console.warn('[VitaWalletDashboard] ⚠️ No hay token de autenticación');
      return;
    }

    // Crear contenedor si no existe
    if (!this.container) {
      this.createContainer();
    }

    // Cargar balance inicial
    await this.loadVitaBalance();

    // Auto-refresh cada 30 segundos
    setInterval(() => this.loadVitaBalance(), REFRESH_INTERVAL);

    console.log('[VitaWalletDashboard] ✅ Inicializado (fluxiAdmin)');
  }

  /**
   * Crea el HTML del componente
   */
  createContainer() {
    const dashboardContent = document.querySelector('.dashboard-content') ||
                            document.querySelector('main') ||
                            document.querySelector('.main-content');

    if (!dashboardContent) {
      console.warn('[VitaWalletDashboard] ⚠️ No se encontró contenedor de dashboard');
      return;
    }

    // Crear tarjeta de Vita Wallet
    const vitaCard = document.createElement('div');
    vitaCard.id = 'vitawallet-balance-card';
    vitaCard.className = 'vitawallet-balance-card';
    vitaCard.innerHTML = `
      <div class="vitawallet-card-header">
        <div class="vitawallet-title-section">
          <h3 class="vitawallet-title">🏦 Vita Wallet - Saldo Madre</h3>
          <span class="vitawallet-status-badge" id="vitaStatus">Conectando...</span>
        </div>
        <button class="vitawallet-refresh-btn" id="vitaRefreshBtn" title="Actualizar balance">🔄</button>
      </div>

      <div class="vitawallet-content">
        <div id="vitaBalanceContainer" class="vitabalance-container">
          <div class="vitabalance-loading">
            <p>Cargando balance de Vita...</p>
          </div>
        </div>

        <div class="vitawallet-last-update">
          <small id="vitaLastUpdate">Cargando...</small>
        </div>
      </div>
    `;

    // Insertar al inicio del dashboard
    dashboardContent.insertBefore(vitaCard, dashboardContent.firstChild);
    this.container = vitaCard;

    // Agregar event listeners
    document.getElementById('vitaRefreshBtn')?.addEventListener('click', () => this.loadVitaBalance());
  }

  /**
   * Carga el balance desde el backend
   */
  async loadVitaBalance() {
    try {
      console.log('[VitaWalletDashboard] Cargando balance...');

      const response = await fetch(VITAWALLET_API, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        }
      });
      const data = await response.json();

      if (data.success) {
        this.balances = data.data.balances || {};
        this.lastUpdate = data.data.lastUpdate || new Date().toISOString();
        this.isConnected = true;
        console.log('[VitaWalletDashboard] ✅ Balance cargado:', this.balances);
        this.displayVitaBalance();
        this.updateStatus('Conectado', true);
      } else {
        console.warn('[VitaWalletDashboard] ⚠️ Error:', data.error);
        this.updateStatus('Error: ' + (data.error || 'Desconocido'), false);
        this.displayError(data.error);
      }
    } catch (error) {
      console.error('[VitaWalletDashboard] ❌ Error:', error.message);
      this.isConnected = false;
      this.updateStatus('Desconectado', false);
      this.displayError('Error conectando con Vita: ' + error.message);
    }
  }

  /**
   * Muestra el balance en la UI
   */
  displayVitaBalance() {
    const container = document.getElementById('vitaBalanceContainer');
    if (!container) return;

    // Si no hay balances, mostrar mensaje
    if (Object.keys(this.balances).length === 0) {
      container.innerHTML = `
        <div class="vitabalance-empty">
          <p>No hay saldo disponible en Vita Wallet</p>
        </div>
      `;
      return;
    }

    // Crear grid de monedas
    const balanceHTML = Object.entries(this.balances)
      .map(([currency, amount]) => this.createBalanceCard(currency, amount))
      .join('');

    container.innerHTML = `
      <div class="vitabalance-grid">
        ${balanceHTML}
      </div>
    `;
  }

  /**
   * Crea una tarjeta individual para cada moneda
   */
  createBalanceCard(currency, amount) {
    const icon = this.getCurrencyIcon(currency);
    const name = this.getCurrencyName(currency);
    const formatted = this.formatAmount(amount);

    return `
      <div class="vitabalance-item">
        <div class="vitabalance-icon">${icon}</div>
        <div class="vitabalance-info">
          <span class="vitabalance-currency">${currency}</span>
          <span class="vitabalance-name">${name}</span>
        </div>
        <div class="vitabalance-amount">
          <span class="vitabalance-value">${formatted}</span>
        </div>
      </div>
    `;
  }

  /**
   * Obtiene el icono para cada moneda
   */
  getCurrencyIcon(currency) {
    const icons = {
      'USD': '💵',
      'COP': '🇨🇴',
      'ARS': '🇦🇷',
      'CLP': '🇨🇱',
      'BRL': '🇧🇷',
      'MXN': '🇲🇽',
      'BTC': '₿',
      'USDT': '🪙',
      'USDC': '🪙',
      'ETH': '⟠',
    };
    return icons[currency] || '💰';
  }

  /**
   * Obtiene el nombre completo de la moneda
   */
  getCurrencyName(currency) {
    const names = {
      'USD': 'Dólar Americano',
      'COP': 'Peso Colombiano',
      'ARS': 'Peso Argentino',
      'CLP': 'Peso Chileno',
      'BRL': 'Real Brasileño',
      'MXN': 'Peso Mexicano',
      'BTC': 'Bitcoin',
      'USDT': 'Tether',
      'USDC': 'USD Coin',
      'ETH': 'Ethereum',
    };
    return names[currency] || currency;
  }

  /**
   * Formatea la cantidad según el tipo de moneda
   */
  formatAmount(amount) {
    if (!amount) return '0.00';

    amount = parseFloat(amount);

    // Criptomonedas: máximo 8 decimales
    if (amount < 1) {
      return amount.toFixed(8).replace(/\.?0+$/, '');
    }

    // Monedas fiat: máximo 2 decimales
    return amount.toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  /**
   * Muestra mensaje de error
   */
  displayError(error) {
    const container = document.getElementById('vitaBalanceContainer');
    if (!container) return;

    container.innerHTML = `
      <div class="vitabalance-error">
        <p>⚠️ Error cargando balance</p>
        <small>${error}</small>
        <p style="margin-top: 10px; font-size: 11px; color: #999;">
          Asegúrate que Vita Wallet esté habilitado en sandbox
        </p>
      </div>
    `;
  }

  /**
   * Actualiza el badge de estado
   */
  updateStatus(text, isConnected) {
    const badge = document.getElementById('vitaStatus');
    if (!badge) return;

    badge.textContent = text;
    badge.className = `vitawallet-status-badge ${isConnected ? 'connected' : 'disconnected'}`;
  }

  /**
   * Actualiza el timestamp
   */
  updateTimestamp() {
    const element = document.getElementById('vitaLastUpdate');
    if (!element || !this.lastUpdate) return;

    const date = new Date(this.lastUpdate);
    const time = date.toLocaleTimeString('es-ES');
    element.textContent = `Última actualización: ${time}`;
  }
}

// Instancia global
const vitaDashboard = new VitaWalletDashboard();

console.log('[VitaWalletDashboard] ✅ Clase instanciada');

// Auto-inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  console.log('[VitaWalletDashboard] ⏳ Esperando DOMContentLoaded...');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[VitaWalletDashboard] 📍 DOMContentLoaded disparado, inicializando...');
    vitaDashboard.init();
  });
} else {
  console.log('[VitaWalletDashboard] 🚀 DOM ya listo, inicializando ahora...');
  vitaDashboard.init();
}
