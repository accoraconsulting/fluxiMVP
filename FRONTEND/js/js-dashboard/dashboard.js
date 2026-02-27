import { getSession } from '../auth/session.js';
import { guardPage, startSessionMonitor } from '../auth/session-guard.js';
import { loadUserContext } from '../user.context.js';
import { API_CONFIG } from '../config/api.config.js';
import {
  convertCurrency,
  getExchangeRate,
  getCurrencySymbol,
  formatCurrencyAmount,
  refreshExchangeRates
} from '../services/exchangeRates.service.js';

const API_BASE = API_CONFIG.API_ENDPOINT;

// Estado global
let wallets = [];
let movements = [];
let stats = null;

// Variable global para conversión
let currentConversionData = null;

/* ============================
   INICIALIZACIÓN
============================ */

document.addEventListener('DOMContentLoaded', () => {
  // 🛡️ Proteger página contra sesiones inválidas
  if (!guardPage()) {
    return;
  }

  // 👁️ Iniciar monitor de sesión (sincroniza entre pestañas)
  startSessionMonitor();

  const session = getSession();

  console.info('[Dashboard] ✅ Sesión validada', {
    username: session.user.username,
    email: session.user.email
  });

  // Esperar que sidebar cargue
  document.addEventListener(
    'sidebar:loaded',
    async () => {
      console.log('[Dashboard] Sidebar cargado, iniciando...');
      
      // Cargar contexto de usuario
      loadUserContext();
      
      // Pintar nombre de usuario
      paintUsername(session.user);

      // Cargar datos del dashboard
      await loadDashboardData();

      // Setup conversor
      setupConverter();

      // Botón actualizar tasas
      setupRefreshButton();
    },
    { once: true }
  );
});

/* ============================
   CARGAR DATOS
============================ */

async function loadDashboardData() {
  try {
    const session = getSession();

    console.log('[Dashboard] Cargando datos...');

    // Cargar wallets
    await loadWallets(session);

    // Cargar movimientos recientes
    await loadRecentMovements(session);

    // Cargar estadísticas
    await loadStats(session);

    console.log('[Dashboard] Datos cargados exitosamente');

  } catch (error) {
    console.error('[Dashboard] Error cargando datos:', error);
  }
}

async function loadWallets(session) {
  try {
    const userStr = localStorage.getItem('auth_user');
    const user = userStr ? JSON.parse(userStr) : {};
    const isAdmin = user.role === 'fluxiAdmin';

    console.log(`[Dashboard] Cargando wallets para usuario: ${user.username} (${user.role})`);

    if (isAdmin) {
      // 🏦 ADMIN: Traer datos de VITA WALLET (saldo real)
      console.log('[Dashboard] 📊 Admin detectado - Cargando balances de VITA...');
      await loadVitaBalancesForAdmin(session);
    } else {
      // 👤 USUARIO NORMAL: Traer datos de BD (como antes)
      console.log('[Dashboard] 👤 Usuario normal - Cargando wallets de BD...');
      await loadBDWallets(session);
    }

    paintBalances();

  } catch (error) {
    console.error('[Dashboard] Error cargando wallets:', error);
  }
}

/**
 * ADMIN: Carga balances de Vita Wallet
 */
async function loadVitaBalancesForAdmin(session) {
  try {
    const response = await fetch(`${API_BASE}/vitawallet/balance`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) throw new Error('Error cargando balance de Vita');

    const data = await response.json();
    const vitaBalances = data.data?.balances || {};

    console.log('[Dashboard] 🏦 Balance de Vita obtenido:', vitaBalances);

    // Convertir formato de Vita a formato de wallets
    wallets = Object.entries(vitaBalances).map(([symbol, balance]) => ({
      symbol: symbol.toUpperCase(),
      balance: parseFloat(balance) || 0,
      isActive: true,
      source: 'vita' // Marcar que viene de Vita
    }));

    // Ordenar: USD, EUR, COP
    const order = { 'USD': 1, 'EUR': 2, 'COP': 3 };
    wallets.sort((a, b) => (order[a.symbol] || 999) - (order[b.symbol] || 999));

    console.log(`[Dashboard] ✅ ${wallets.length} monedas desde Vita cargadas`);
    wallets.forEach(w => {
      console.log(`[Dashboard] 🏦 ${w.symbol}: ${w.balance} (Vita)`);
    });

  } catch (error) {
    console.error('[Dashboard] Error cargando balance de Vita:', error);
    // Fallback a BD si falla Vita
    console.warn('[Dashboard] ⚠️ Fallback a BD...');
    await loadBDWallets(session);
  }
}

/**
 * USUARIO NORMAL: Carga wallets desde BD (comportamiento original)
 */
async function loadBDWallets(session) {
  try {
    const response = await fetch(`${API_BASE}/wallet/all`, {
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) throw new Error('Error cargando wallets');

    const data = await response.json();
    const allWallets = data.data || [];

    // 🔒 FILTRAR SOLO WALLETS ACTIVAS
    // Maneja true, 1, 'true' y asume true por defecto si no está definido
    wallets = allWallets.filter(w => {
      const isActive = w.isActive;
      // Solo mostrar si isActive es estrictamente true o 1
      return isActive === true || isActive === 1 || isActive === 'true';
    });

    const blockedCount = allWallets.length - wallets.length;
    console.log(`[Dashboard] ✅ Wallets cargadas: ${wallets.length} activas${blockedCount > 0 ? `, ${blockedCount} bloqueadas (ocultas)` : ''}`);

    // 🔍 Debug: Mostrar detalle de cada wallet
    allWallets.forEach(w => {
      const status = w.isActive === true ? '✅ ACTIVA' : '🔒 BLOQUEADA';
      console.log(`[Dashboard] ${w.symbol}: ${status} (isActive=${w.isActive})`);
    });

  } catch (error) {
    console.error('[Dashboard] Error cargando wallets de BD:', error);
  }
}

async function loadRecentMovements(session) {
  try {
    const response = await fetch(`${API_BASE}/wallet/movements?limit=5&type=all&currency=all`, {
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) throw new Error('Error cargando movimientos');

    const data = await response.json();
    movements = data.data;

    console.log('[Dashboard] Movimientos cargados:', movements.length);

    paintMovements();

  } catch (error) {
    console.error('[Dashboard] Error cargando movimientos:', error);
    const tbody = document.querySelector('.movements tbody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 40px;">
            <i class="bx bx-receipt" style="font-size: 48px; color: #d1d5db;"></i>
            <p style="color: #6b7280; margin-top: 16px;">No hay movimientos aún</p>
          </td>
        </tr>
      `;
    }
  }
}

async function loadStats(session) {
  try {
    const response = await fetch(`${API_BASE}/wallet`, {
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) throw new Error('Error cargando stats');

    const data = await response.json();
    stats = data.data.stats;

    console.log('[Dashboard] Stats cargadas:', stats);

  } catch (error) {
    console.error('[Dashboard] Error cargando stats:', error);
  }
}

/* ============================
   RENDERIZADO
============================ */

function paintUsername(user) {
  const profile = user.profile || user.user || user;

  const username =
    [profile.first_name, profile.last_name]
      .filter(v => typeof v === 'string' && v.trim() !== '')
      .join(' ')
      .trim()
    || user.username
    || user.email
    || 'Usuario';

  document.querySelectorAll('[data-user-name]').forEach(el => {
    el.textContent = username;
  });
}

function paintBalances() {
  const container = document.querySelector('.balances');
  if (!container) {
    console.warn('[Dashboard] No se encontró el contenedor .balances');
    return;
  }

  // 🔒 DOBLE VALIDACIÓN: FILTRAR SOLO ACTIVAS ANTES DE PINTAR
  const activeWallets = wallets.filter(w => w.isActive === true || w.isActive === 1 || w.isActive === 'true');

  if (activeWallets.length === 0) {
    container.innerHTML = `
      <div class="balance-card primary">
        <p>Sin wallets</p>
        <h2>$0.00</h2>
        <span>---</span>
      </div>
    `;
    return;
  }

  console.log(`[Dashboard] 🎯 PINTANDO: ${activeWallets.length} wallets activas (de ${wallets.length} cargadas)`);

  const sortedWallets = [...activeWallets].sort((a, b) => {
    const order = { 'USD': 1, 'EUR': 2, 'COP': 3 };
    return (order[a.symbol] || 999) - (order[b.symbol] || 999);
  });

  // 🏦 ADMIN: Mostrar TODAS las monedas de Vita (sin límite de 3)
  const displayWallets = sortedWallets;
  const changes = displayWallets.map(() => (Math.random() * 10 - 2).toFixed(3));

  // Colores cíclicos para las tarjetas
  const cardColors = ['primary', 'info', 'light'];

  container.innerHTML = displayWallets.map((wallet, idx) => {
    const change = parseFloat(changes[idx]);
    const changeClass = change >= 0 ? 'positive' : 'negative';
    const changeSign = change >= 0 ? '+' : '';
    const cardColor = cardColors[idx % cardColors.length];

    return `
      <div class="balance-card ${cardColor}">
        <p>Saldo ${wallet.symbol}</p>
        <h2>${formatBalance(wallet.balance, wallet.symbol)}</h2>
        <span class="${changeClass}">${changeSign}${change}%</span>
      </div>
    `;
  }).join('');
}

function paintMovements() {
  const tbody = document.querySelector('.movements tbody');
  if (!tbody) {
    console.warn('[Dashboard] No se encontró .movements tbody');
    return;
  }

  if (movements.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px;">
          <i class="bx bx-receipt" style="font-size: 48px; color: #d1d5db;"></i>
          <p style="color: #6b7280; margin-top: 16px;">No hay movimientos aún</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = movements.map(tx => {
    let recipientText = '-';
    if (tx.recipient) {
      recipientText = tx.recipient.username || tx.recipient.email || 'Usuario';
    } else if (tx.type === 'topup') {
      recipientText = 'Recarga';
    } else if (tx.type === 'payment') {
      recipientText = 'Pago';
    }

    return `
      <tr>
        <td>
          <div class="tx-date">
            <span>${formatDate(tx.createdAt)}</span>
          </div>
        </td>
        <td>
          <div class="tx-type">
            <i class="bx ${tx.icon} ${tx.colorClass}"></i>
            <span>${tx.label}</span>
          </div>
        </td>
        <td>${recipientText}</td>
        <td>
          <span class="currency-badge">${tx.currency}</span>
        </td>
        <td class="tx-amount ${tx.colorClass}">
          ${tx.isIncoming ? '+' : '-'}${getSymbolPrefix(tx.currency)}${formatBalance(tx.amount, tx.currency)}
        </td>
        <td>
          <a href="./moviments.html" style="color: #3b82f6; text-decoration: none;">Ver</a>
        </td>
      </tr>
    `;
  }).join('');
}

/* ============================
   CONVERSOR DINÁMICO
============================ */

function setupConverter() {
  const amountInput = document.getElementById('converterAmount');
  const fromSelect = document.getElementById('converterFrom');
  const toSelect = document.getElementById('converterTo');
  const resultInput = document.getElementById('converterResult');
  const swapBtn = document.querySelector('.converter-swap');
  const convertBtn = document.getElementById('btnConvert');
  const rateText = document.getElementById('converterRate');
  const fromBalanceText = document.getElementById('converterFromBalance');
  const toBalanceText = document.getElementById('converterToBalance');

  if (!amountInput || !fromSelect || !toSelect) {
    console.warn('[Dashboard] ❌ Elementos del conversor no encontrados');
    return;
  }

  console.log('[Dashboard] ✅ Inicializando conversor...');

  let isConverting = false;

  // Llenar selects
  function populateSelects() {
    if (wallets.length === 0) {
      fromSelect.innerHTML = '<option value="">Sin wallets</option>';
      toSelect.innerHTML = '<option value="">Sin wallets</option>';
      return;
    }

    const sortedWallets = [...wallets].sort((a, b) => {
      const order = { 'USD': 1, 'EUR': 2, 'COP': 3 };
      return (order[a.symbol] || 999) - (order[b.symbol] || 999);
    });

    fromSelect.innerHTML = sortedWallets.map(w => `
      <option value="${w.symbol}" data-balance="${w.balance}">
        ${w.symbol} - ${w.name}
      </option>
    `).join('');

    toSelect.innerHTML = sortedWallets.map(w => `
      <option value="${w.symbol}" data-balance="${w.balance}">
        ${w.symbol} - ${w.name}
      </option>
    `).join('');

    if (fromSelect.options.length > 0) fromSelect.selectedIndex = 0;
    if (toSelect.options.length > 1) toSelect.selectedIndex = 1;

    console.log('[Conversor] ✅ Selects poblados con', wallets.length, 'wallets');
  }

  // Actualizar balance
  function updateBalanceDisplay() {
    const fromCurrency = fromSelect.value;
    const toCurrency = toSelect.value;

    if (fromCurrency) {
      const fromWallet = wallets.find(w => w.symbol === fromCurrency);
      if (fromWallet) {
        fromBalanceText.textContent = `Disponible: ${formatBalance(fromWallet.balance, fromCurrency)} ${fromCurrency}`;
      }
    }

    if (toCurrency) {
      const toWallet = wallets.find(w => w.symbol === toCurrency);
      if (toWallet) {
        toBalanceText.textContent = `Balance actual: ${formatBalance(toWallet.balance, toCurrency)} ${toCurrency}`;
      }
    }
  }

  // Convertir
  const convert = async () => {
    if (isConverting) {
      console.log('[Conversor] ⏳ Conversión en proceso...');
      return;
    }
    
    try {
      isConverting = true;

      const amount = parseFloat(amountInput.value) || 0;
      const fromCurrency = fromSelect.value;
      const toCurrency = toSelect.value;

      console.log('[Conversor] 🔄 Calculando:', { amount, fromCurrency, toCurrency });

      if (!fromCurrency || !toCurrency) {
        resultInput.value = '0.00';
        rateText.textContent = 'Selecciona ambas monedas';
        currentConversionData = null;
        return;
      }

      if (fromCurrency === toCurrency) {
        resultInput.value = amount.toFixed(2);
        rateText.textContent = 'Misma moneda';
        currentConversionData = null;
        return;
      }

      if (amount <= 0) {
        resultInput.value = '0.00';
        rateText.textContent = 'Ingresa un monto válido';
        currentConversionData = null;
        return;
      }

      // Validar saldo
      const fromWallet = wallets.find(w => w.symbol === fromCurrency);
      const fee = amount * 0.005;
      const totalRequired = amount + fee;

      if (fromWallet && parseFloat(fromWallet.balance) < totalRequired) {
        resultInput.value = 'Sin saldo';
        rateText.textContent = `❌ Saldo insuficiente. Necesitas ${totalRequired.toFixed(2)} ${fromCurrency}`;
        rateText.style.color = '#ef4444';
        currentConversionData = null;
        return;
      }

      // Obtener tasa
      const rate = await getExchangeRate(fromCurrency, toCurrency);
      console.log(`[Conversor] 📊 Tasa: ${rate}`);

      const result = await convertCurrency(amount, fromCurrency, toCurrency);
      console.log(`[Conversor] 💰 Resultado: ${result}`);

      // Actualizar UI
      resultInput.value = result.toFixed(2);
      rateText.textContent = `1 ${fromCurrency} = ${rate.toFixed(6)} ${toCurrency} · Tasa en tiempo real`;
      rateText.style.color = '#10b981';

      // Guardar datos
      currentConversionData = {
        amountFrom: amount,
        fromCurrency,
        toCurrency,
        amountTo: result,
        rate,
        fee
      };

      console.log('[Conversor] ✅ Datos guardados:', currentConversionData);

    } catch (error) {
      console.error('[Conversor] ❌ Error:', error);
      resultInput.value = 'Error';
      rateText.textContent = '❌ Error obteniendo tasa';
      rateText.style.color = '#ef4444';
      currentConversionData = null;
    } finally {
      isConverting = false;
    }
  };

  // Eventos
  if (swapBtn) {
    swapBtn.addEventListener('click', () => {
      console.log('[Conversor] 🔄 Intercambiando monedas');
      const fromIndex = fromSelect.selectedIndex;
      const toIndex = toSelect.selectedIndex;
      
      fromSelect.selectedIndex = toIndex;
      toSelect.selectedIndex = fromIndex;

      updateBalanceDisplay();
      convert();
    });
  }

  if (fromSelect) {
    fromSelect.addEventListener('change', () => {
      updateBalanceDisplay();
      convert();
    });
  }

  if (toSelect) {
    toSelect.addEventListener('change', () => {
      updateBalanceDisplay();
      convert();
    });
  }

  if (convertBtn) {
    convertBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      console.log('[Conversor] 🖱️ Click en Convertir');

      await convert();

      if (!currentConversionData) {
        alert('⚠️ Completa todos los campos correctamente');
        return;
      }

      if (currentConversionData.amountFrom <= 0) {
        alert('⚠️ Ingresa un monto mayor a 0');
        return;
      }

      console.log('[Conversor] 📋 Abriendo modal con:', currentConversionData);
      showConversionModal(currentConversionData);
    });
  }

  let convertTimeout;
  if (amountInput) {
    amountInput.addEventListener('input', () => {
      clearTimeout(convertTimeout);
      convertTimeout = setTimeout(convert, 500);
    });
  }

  // Inicializar
  populateSelects();
  updateBalanceDisplay();
  setTimeout(convert, 500);

  console.log('[Conversor] ✅ Configurado');
}

/* ============================
   MODAL DE CONFIRMACIÓN
============================ */

function showConversionModal(data) {
  console.log('[Modal] 🔓 Abriendo modal con datos:', data);

  if (!data || !data.amountFrom || !data.fromCurrency || !data.toCurrency) {
    console.error('[Modal] ❌ Datos inválidos:', data);
    alert('Error: Datos de conversión inválidos');
    return;
  }

  try {
    document.getElementById('modalAmountFrom').textContent = formatMoney(data.amountFrom);
    document.getElementById('modalCurrencyFrom').textContent = data.fromCurrency;
    document.getElementById('modalAmountTo').textContent = formatMoney(data.amountTo);
    document.getElementById('modalCurrencyTo').textContent = data.toCurrency;
    document.getElementById('modalRate').textContent = data.rate.toFixed(6);
    
    const fromWallet = wallets.find(w => w.symbol === data.fromCurrency);
    if (fromWallet) {
      document.getElementById('modalBalanceFrom').textContent = 
        `Balance actual: ${formatBalance(fromWallet.balance, data.fromCurrency)} ${data.fromCurrency}`;
    }

    const toWallet = wallets.find(w => w.symbol === data.toCurrency);
    const newBalance = (toWallet ? parseFloat(toWallet.balance) : 0) + data.amountTo;
    document.getElementById('modalBalanceTo').textContent = 
      `Balance después: ${formatBalance(newBalance, data.toCurrency)} ${data.toCurrency}`;

    const fee = data.fee || (data.amountFrom * 0.005);
    document.getElementById('modalFee').textContent = 
      `${getCurrencySymbol(data.fromCurrency)} ${formatMoney(fee)}`;

    document.getElementById('conversionModal').classList.remove('hidden');

    console.log('[Modal] ✅ Modal abierto correctamente');

  } catch (error) {
    console.error('[Modal] ❌ Error mostrando modal:', error);
    alert('Error mostrando modal de confirmación');
  }
}

window.closeConversionModal = function() {
  console.log('[Modal] 🔒 Cerrando modal');
  document.getElementById('conversionModal').classList.add('hidden');
};

// Confirmar conversión
document.getElementById('btnConfirmConversion')?.addEventListener('click', async () => {
  if (!currentConversionData) {
    alert('❌ Error: No hay datos de conversión');
    return;
  }

  const btn = document.getElementById('btnConfirmConversion');
  const originalHTML = btn.innerHTML;

  try {
    btn.disabled = true;
    btn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Procesando...';

    console.log('[Modal] 🔄 Ejecutando conversión:', currentConversionData);

    const session = getSession();

    const response = await fetch(`${API_BASE}/wallet/convert`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fromCurrency: currentConversionData.fromCurrency,
        toCurrency: currentConversionData.toCurrency,
        amount: currentConversionData.amountFrom
      })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Error en la conversión');
    }

    const data = await response.json();
    console.log('[Modal] ✅ Conversión exitosa:', data);

    closeConversionModal();

    alert(`✅ Conversión exitosa!\n\n${formatMoney(currentConversionData.amountFrom)} ${currentConversionData.fromCurrency} → ${formatMoney(currentConversionData.amountTo)} ${currentConversionData.toCurrency}`);

    const sessionReload = getSession();
    await loadWallets(sessionReload);
    setupConverter();

  } catch (error) {
    console.error('[Modal] ❌ Error:', error);
    alert(`❌ ${error.message}`);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHTML;
  }
});

// Cerrar modal al hacer click fuera
document.querySelector('.conversion-modal-backdrop')?.addEventListener('click', closeConversionModal);

/* ============================
   BOTÓN ACTUALIZAR TASAS
============================ */

function setupRefreshButton() {
  const btn = document.getElementById('refreshRatesBtn');
  if (!btn) return;

  btn.addEventListener('click', async (e) => {
    const icon = btn.querySelector('i');
    
    icon.style.animation = 'spin 1s linear infinite';
    btn.disabled = true;
    btn.style.opacity = '0.6';

    try {
      await refreshExchangeRates();
      alert('✅ Tasas actualizadas correctamente');
      
      document.querySelector('.btn-primary')?.click();
      
    } catch (error) {
      alert('❌ Error actualizando tasas');
    } finally {
      icon.style.animation = '';
      btn.disabled = false;
      btn.style.opacity = '1';
    }
  });
}

/* ============================
   UTILIDADES
============================ */

function formatMoney(value) {
  return parseFloat(value).toLocaleString('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatBalance(amount, symbol) {
  if (symbol === 'BTC' || symbol === 'ETH') {
    return parseFloat(amount).toFixed(6);
  }
  return formatMoney(amount);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Hoy · ${date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;
  } else if (diffDays === 1) {
    return `Ayer · ${date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;
  } else {
    return date.toLocaleDateString('es-CO', { 
      day: 'numeric', 
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

function getSymbolPrefix(symbol) {
  const prefixes = {
    'USD': '$',
    'EUR': '€',
    'COP': '$'
  };
  return prefixes[symbol] || '';
}