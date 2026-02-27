/**
 * MOVIMIENTOS - Vista completa de transacciones
 * FIXED: Manejo seguro de datos y procesamiento correcto
 */

import { getSession } from '../auth/session.js';
import { guardPage, startSessionMonitor } from '../auth/session-guard.js';
import { API_CONFIG } from '../config/api.config.js';

const API_BASE = API_CONFIG.API_ENDPOINT;

// Estado global
let wallets = [];
let movements = [];
let filters = {
  type: 'all',
  currency: 'all'
};

// ===================================
// INICIALIZACIÓN
// ===================================
document.addEventListener('DOMContentLoaded', async () => {
  // 🛡️ Proteger página contra sesiones inválidas
  if (!guardPage()) {
    return;
  }

  // 👁️ Iniciar monitor de sesión
  startSessionMonitor();

  const session = getSession();

  console.log('[Movimientos] ✅ Inicializando...');

  // Pintar nombre de usuario
  paintUsername(session.user);

  // Cargar datos
  await loadWallets();
  await loadMovements();

  // Setup listeners
  setupEventListeners();
});

// ===================================
// CARGAR DATOS
// ===================================

async function loadWallets() {
  try {
    const session = getSession();
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
    console.log(`[Movimientos] ✅ Wallets cargadas: ${wallets.length} activas${blockedCount > 0 ? `, ${blockedCount} bloqueadas (ocultas)` : ''}`);

    // 🔍 Debug: Mostrar detalle de cada wallet
    allWallets.forEach(w => {
      const status = w.isActive === true ? '✅ ACTIVA' : '🔒 BLOQUEADA';
      console.log(`[Movimientos] ${w.symbol}: ${status} (isActive=${w.isActive})`);
    });

    paintWalletSummary();

  } catch (error) {
    console.error('[Movimientos] Error cargando wallets:', error);
  }
}

async function loadMovements() {
  try {
    const session = getSession();
    const queryParams = new URLSearchParams({
      limit: 50,
      type: filters.type,
      currency: filters.currency
    });

    const response = await fetch(`${API_BASE}/wallet/movements?${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) throw new Error('Error cargando movimientos');

    const data = await response.json();
    movements = data.data || [];

    console.log('[Movimientos] Transacciones cargadas:', movements.length);
    if (movements.length > 0) {
      console.log('[Movimientos] Muestra de datos:', movements[0]);
    }

    paintTransactions();

  } catch (error) {
    console.error('[Movimientos] Error cargando movimientos:', error);
    showEmptyState();
  }
}

// ===================================
// RENDERIZADO
// ===================================

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

function paintWalletSummary() {
  const container = document.querySelector('.wallet-summary');
  if (!container) return;

  // 🔒 DOBLE VALIDACIÓN: FILTRAR SOLO ACTIVAS ANTES DE PINTAR
  const activeWallets = wallets.filter(w => w.isActive === true || w.isActive === 1 || w.isActive === 'true');

  console.log(`[Movimientos] 🎯 PINTANDO: ${activeWallets.length} wallets activas (de ${wallets.length} cargadas)`);

  // Calcular balance total en USD (solo wallets activas)
  const totalBalanceUSD = activeWallets.reduce((sum, w) => {
    return sum + (parseFloat(w.balance || 0) * getExchangeRate(w.symbol));
  }, 0);

  // Calcular cambio (simulado)
  const change = calculateChange();

  container.innerHTML = `
    <div class="wallet-card total">
      <span>Balance Total</span>
      <h2>$${formatMoney(totalBalanceUSD)}</h2>
      <small class="${change >= 0 ? 'positive' : 'negative'}">
        ${change >= 0 ? '+' : ''}${change.toFixed(2)}% últimas 24h
      </small>
    </div>

    ${activeWallets.map(wallet => `
      <div class="wallet-card">
        <span>${wallet.name || wallet.symbol}</span>
        <h3>${formatBalance(wallet.balance || 0, wallet.symbol)} ${wallet.symbol}</h3>
        <small>$${formatMoney((wallet.balance || 0) * getExchangeRate(wallet.symbol))}</small>
      </div>
    `).join('')}
  `;
}

// ===================================
// PROCESAR INFORMACIÓN DE TRANSACCIÓN
// ===================================
function getTransactionInfo(tx) {
  // Determinar el tipo basado en el amount (positivo/negativo) o campos específicos
  const amount = parseFloat(tx.amount || 0);
  const isIncoming = amount > 0;
  
  let type = tx.type || (isIncoming ? 'transfer_in' : 'transfer_out');
  let label = 'Transacción';
  let icon = 'bx-transfer';
  let colorClass = isIncoming ? 'incoming' : 'outgoing';

  // Mapear tipos conocidos
  if (type === 'transfer_in' || type === 'received' || type === 'credit') {
    label = 'Recibido';
    icon = 'bx-down-arrow-circle';
    colorClass = 'incoming';
  } else if (type === 'transfer_out' || type === 'sent' || type === 'debit') {
    label = 'Enviado';
    icon = 'bx-up-arrow-circle';
    colorClass = 'outgoing';
  } else if (type === 'topup' || type === 'deposit') {
    label = 'Recarga';
    icon = 'bx-plus-circle';
    colorClass = 'incoming';
  } else if (type === 'payment') {
    label = 'Pago';
    icon = 'bx-credit-card';
    colorClass = 'outgoing';
  } else if (type === 'commission') {
    label = 'Comisión';
    icon = 'bx-dollar-circle';
    colorClass = 'outgoing';
  }

  return {
    type,
    label,
    icon,
    colorClass,
    isIncoming
  };
}

function paintTransactions() {
  const tbody = document.querySelector('.transactions tbody');
  if (!tbody) return;

  if (movements.length === 0) {
    showEmptyState();
    return;
  }

  tbody.innerHTML = movements.map(tx => {
    // ✅ PROCESAR TIPO DE TRANSACCIÓN
    const txInfo = getTransactionInfo(tx);
    
    // ✅ Determinar destinatario/origen CON MANEJO SEGURO
    let recipientText = '-';
    let recipientEmail = '';
    
    if (tx.recipient) {
      const name = tx.recipient.name || tx.recipient.username || tx.recipient.email || 'Usuario';
      
      if (txInfo.type === 'transfer_out' || txInfo.type === 'sent') {
        recipientText = `Para: ${name}`;
      } else if (txInfo.type === 'transfer_in' || txInfo.type === 'received') {
        recipientText = `De: ${name}`;
      } else {
        recipientText = name;
      }
      
      if (tx.recipient.email && tx.recipient.email !== name) {
        recipientEmail = tx.recipient.email;
      }
    }

    // ✅ Mostrar info de conversión si aplica
    let conversionInfo = '';
    if (tx.exchangeRate && tx.fromCurrency && tx.toCurrency && tx.fromCurrency !== tx.toCurrency) {
      conversionInfo = `
        <br>
        <small style="color: #95a5a6;">
          ${tx.originalAmount || tx.amount || 0} ${tx.fromCurrency} → 
          ${tx.convertedAmount || tx.amount || 0} ${tx.toCurrency} 
          (${parseFloat(tx.exchangeRate).toFixed(4)})
        </small>
      `;
    }

    // ✅ Formatear fecha de forma segura
    const dateFormatted = formatDateSafe(tx.createdAt || tx.created_at);

    return `
      <tr>
        <td>
          <div class="tx-date">
            <span>${dateFormatted}</span>
          </div>
        </td>
        <td>
          <div class="tx-type">
            <i class="bx ${txInfo.icon} ${txInfo.colorClass}"></i>
            <span class="${txInfo.colorClass}">${txInfo.label}</span>
          </div>
        </td>
        <td>
          <div class="tx-recipient">
            <strong>${recipientText}</strong>
            ${recipientEmail ? `<br><small style="color: #95a5a6;">${recipientEmail}</small>` : ''}
            ${conversionInfo}
          </div>
        </td>
        <td>
          <div class="tx-currency">
            <span class="currency-badge">${tx.currency || tx.symbol || 'USD'}</span>
          </div>
        </td>
        <td class="tx-amount ${txInfo.colorClass}">
          ${txInfo.isIncoming ? '+' : '-'}${getSymbolPrefix(tx.currency || tx.symbol)}${formatBalance(Math.abs(tx.amount || 0), tx.currency || tx.symbol)}
        </td>
        <td>
          <span class="status ${tx.statusId || 'completed'}">${tx.status || 'Completado'}</span>
        </td>
        <td>
          <button class="btn-details" onclick="showTransactionDetails('${tx.id}')">
            <i class="bx bx-info-circle"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}


function getSymbolPrefix(symbol) {
  const prefixes = {
    'USD': '$',
    'EUR': '€',
    'COP': '$'
  };
  return prefixes[symbol] || '';
}

function showEmptyState() {
  const tbody = document.querySelector('.transactions tbody');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="7" style="text-align: center; padding: 40px;">
        <i class="bx bx-receipt" style="font-size: 48px; color: #d1d5db;"></i>
        <p style="color: #6b7280; margin-top: 16px;">No hay transacciones aún</p>
      </td>
    </tr>
  `;
}

// ===================================
// EVENT LISTENERS
// ===================================

function setupEventListeners() {
  // Filtro por tipo
  const typeFilter = document.getElementById('filter-type');
  if (typeFilter) {
    typeFilter.addEventListener('change', (e) => {
      filters.type = e.target.value;
      loadMovements();
    });
  }

  // Filtro por moneda
  const currencyFilter = document.getElementById('filter-currency');
  if (currencyFilter) {
    currencyFilter.addEventListener('change', (e) => {
      filters.currency = e.target.value;
      loadMovements();
    });
  }
}
// ===================================
// DETALLES DE TRANSACCIÓN
// ===================================

window.showTransactionDetails = (txId) => {
  const tx = movements.find(m => m.id === txId);
  if (!tx) return;

  const txInfo = getTransactionInfo(tx);

  // 🔹 Determinar destinatario/origen igual que en paintTransactions
  let recipientText = '-';

  if (tx.recipient) {
    const name =
      tx.recipient.name ||
      tx.recipient.username ||
      tx.recipient.email ||
      'Usuario';

    if (txInfo.type === 'transfer_out' || txInfo.type === 'sent') {
      recipientText = `Para: ${name}`;
    } else if (txInfo.type === 'transfer_in' || txInfo.type === 'received') {
      recipientText = `De: ${name}`;
    } else {
      recipientText = name;
    }
  }

  alert(`
Transacción: ${tx.txHash || tx.tx_hash || 'N/A'}
Tipo: ${txInfo.label}
Monto: ${txInfo.isIncoming ? '+' : '-'}${Math.abs(tx.amount || 0)} ${tx.currency || tx.symbol || 'USD'}
Estado: ${tx.status || 'Completado'}
Destinatario/Origen: ${recipientText}
Fecha: ${new Date(tx.createdAt || tx.created_at).toLocaleString('es-CO')}
Balance anterior: ${tx.balanceBefore || tx.balance_before || 'N/A'}
Balance después: ${tx.balanceAfter || tx.balance_after || 'N/A'}
  `);
};



// ===================================
// UTILIDADES
// ===================================

function formatMoney(value) {
  return parseFloat(value || 0).toLocaleString('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatBalance(amount, symbol) {
  if (symbol === 'BTC' || symbol === 'ETH') {
    return parseFloat(amount || 0).toFixed(6);
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
      month: 'short' 
    }) + ' · ' + date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }
}

// ✅ NUEVA FUNCIÓN: Formatear fecha de forma segura
function formatDateSafe(dateString) {
  if (!dateString) return 'Fecha no disponible';
  
  try {
    const date = new Date(dateString);
    
    // Verificar si es válida
    if (isNaN(date.getTime())) {
      return 'Fecha inválida';
    }
    
    return formatDate(dateString);
  } catch (error) {
    console.error('[formatDateSafe] Error:', error);
    return 'Fecha inválida';
  }
}

function getExchangeRate(symbol) {
  const rates = {
    'USD': 1,
    'EUR': 0.92,
    'COP': 0.00025,
    'BTC': 43000,
    'ETH': 2200,
    'USDT': 1
  };
  return rates[symbol] || 1;
}

function calculateChange() {
  // Simulación simple
  return Math.random() * 10 - 2; // Entre -2% y +8%
}


// ===================================
// MODAL DE TRANSFERENCIA
// ===================================

// ===================================
// MODAL DE CONVERSIÓN DE DIVISAS
// ===================================

window.showConvertModal = () => {
  const modal = document.getElementById('convertModal');
  modal.style.display = 'flex';
  loadConvertCurrencies();
  setupConvertListeners();
};

window.closeConvertModal = () => {
  const modal = document.getElementById('convertModal');
  modal.style.display = 'none';
  document.getElementById('convertForm')?.reset();
  document.getElementById('convertDetails').style.display = 'none';
};

// Cargar opciones de divisas en los select
function loadConvertCurrencies() {
  const currencies = [];
  wallets.forEach(w => {
    if (w.symbol && !currencies.includes(w.symbol)) {
      currencies.push(w.symbol);
    }
  });

  const fromSelect = document.getElementById('convertFromCurrency');
  const toSelect = document.getElementById('convertToCurrency');

  [fromSelect, toSelect].forEach(select => {
    const currentValue = select.value;
    select.innerHTML = '<option value="">Seleccionar moneda</option>';

    currencies.forEach(curr => {
      const option = document.createElement('option');
      option.value = curr;
      option.textContent = `${curr}`;
      select.appendChild(option);
    });

    if (currentValue) {
      select.value = currentValue;
    }
  });

  // Actualizar saldos disponibles
  updateConvertBalances();
}

// Actualizar saldos al cambiar divisas
function updateConvertBalances() {
  const fromCurrency = document.getElementById('convertFromCurrency').value;
  const toCurrency = document.getElementById('convertToCurrency').value;

  const fromWallet = wallets.find(w => w.symbol === fromCurrency);
  const toWallet = wallets.find(w => w.symbol === toCurrency);

  const fromBalance = fromWallet ? parseFloat(fromWallet.balance) : 0;
  const toBalance = toWallet ? parseFloat(toWallet.balance) : 0;

  document.getElementById('convertFromBalance').textContent = `Disponible: ${fromBalance.toFixed(2)} ${fromCurrency}`;
  document.getElementById('convertToBalance').textContent = `Saldo actual: ${toBalance.toFixed(2)} ${toCurrency}`;
}

// Intercambiar divisas
window.swapConvertCurrencies = () => {
  const fromCurr = document.getElementById('convertFromCurrency');
  const toCurr = document.getElementById('convertToCurrency');
  const fromAmt = document.getElementById('convertFromAmount');

  // Intercambiar valores
  const tempCurr = fromCurr.value;
  fromCurr.value = toCurr.value;
  toCurr.value = tempCurr;

  updateConvertBalances();
  calculateConversion();
};

// Calcular conversión en tiempo real (SIN EJECUTAR)
async function calculateConversion() {
  const fromAmount = parseFloat(document.getElementById('convertFromAmount').value) || 0;
  const fromCurrency = document.getElementById('convertFromCurrency').value;
  const toCurrency = document.getElementById('convertToCurrency').value;

  if (!fromAmount || !fromCurrency || !toCurrency || fromCurrency === toCurrency) {
    document.getElementById('convertDetails').style.display = 'none';
    document.getElementById('convertToAmount').value = '';
    return;
  }

  try {
    const session = getSession();

    console.log('[Convert] Calculando preview para:', { fromAmount, fromCurrency, toCurrency });

    // Usar /convert/preview para SOLO CALCULAR (sin ejecutar)
    const response = await fetch(`${API_BASE}/wallet/convert/preview`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: fromAmount,
        fromCurrency,
        toCurrency
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error calculando conversión');
    }

    const data = await response.json();
    const { convertedAmount, exchangeRate, commission, totalDebit } = data.data;

    // Guardar datos para usar en ejecutar
    window.convertPreview = {
      fromAmount,
      fromCurrency,
      toCurrency,
      convertedAmount,
      exchangeRate,
      commission,
      totalDebit
    };

    document.getElementById('convertToAmount').value = convertedAmount.toFixed(2);
    document.getElementById('convertRate').textContent = exchangeRate.toFixed(6);
    document.getElementById('convertFee').textContent = `$${commission.toFixed(2)}`;
    document.getElementById('convertTotal').textContent = `$${totalDebit.toFixed(2)}`;
    document.getElementById('convertDetails').style.display = 'flex';

    console.log('[Convert] ✅ Preview calculado:', { fromAmount, convertedAmount, exchangeRate, commission });

  } catch (error) {
    console.error('[Convert] Error calculando conversión:', error);
    alert(`⚠️ ${error.message}`);
    document.getElementById('convertDetails').style.display = 'none';
  }
}

// Setup de listeners para el formulario de conversión
function setupConvertListeners() {
  const form = document.getElementById('convertForm');
  const fromCurr = document.getElementById('convertFromCurrency');
  const toCurr = document.getElementById('convertToCurrency');

  // SOLO actualizar saldos cuando cambian las divisas (sin calcular)
  fromCurr?.addEventListener('change', () => {
    updateConvertBalances();
    // Limpiar preview anterior
    document.getElementById('convertDetails').style.display = 'none';
    document.getElementById('convertToAmount').value = '';
  });

  toCurr?.addEventListener('change', () => {
    updateConvertBalances();
    // Limpiar preview anterior
    document.getElementById('convertDetails').style.display = 'none';
    document.getElementById('convertToAmount').value = '';
  });

  // Envío del formulario - AQUÍ se calcula y ejecuta
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await executeConversion();
  });
}

// Ejecutar la conversión en DOS PASOS: 1) Calcular, 2) Ejecutar
async function executeConversion() {
  const fromAmount = parseFloat(document.getElementById('convertFromAmount').value) || 0;
  const fromCurrency = document.getElementById('convertFromCurrency').value;
  const toCurrency = document.getElementById('convertToCurrency').value;

  // ===================================
  // PASO 1: VALIDACIONES BÁSICAS
  // ===================================
  if (!fromAmount || !fromCurrency || !toCurrency) {
    alert('❌ Por favor completa todos los campos');
    return;
  }

  if (fromCurrency === toCurrency) {
    alert('❌ Debes seleccionar divisas diferentes');
    return;
  }

  try {
    const session = getSession();

    console.log('[Convert] 📊 PASO 1: Calculando preview...');

    // ===================================
    // PASO 1: CALCULAR EL PREVIEW (sin ejecutar)
    // ===================================
    const previewResponse = await fetch(`${API_BASE}/wallet/convert/preview`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: fromAmount,
        fromCurrency,
        toCurrency
      })
    });

    if (!previewResponse.ok) {
      const errorData = await previewResponse.json();
      throw new Error(errorData.error || 'Error calculando conversión');
    }

    const previewData = await previewResponse.json();
    const { convertedAmount, exchangeRate, commission, totalDebit } = previewData.data;

    console.log('[Convert] ✅ PASO 1 OK: Preview calculado');
    console.log('[Convert] 📊 Detalles:', { fromAmount, convertedAmount, exchangeRate, commission, totalDebit });

    // ===================================
    // PASO 2: CONFIRMACIÓN Y EJECUCIÓN
    // ===================================
    const confirmMessage = `
¿Confirmas la conversión?

📤 Envías: ${fromAmount.toFixed(2)} ${fromCurrency}
📥 Recibes: ${convertedAmount.toFixed(2)} ${toCurrency}
💱 Tasa: 1 ${fromCurrency} = ${exchangeRate.toFixed(6)} ${toCurrency}
💰 Comisión: $${commission.toFixed(2)}
💳 Total a debitar: $${totalDebit.toFixed(2)}
    `;

    if (!confirm(confirmMessage)) {
      console.log('[Convert] ❌ Usuario canceló la conversión');
      return;
    }

    console.log('[Convert] 🚀 PASO 2: Ejecutando conversión confirmada...');

    // AHORA SÍ: Ejecutar después de confirmar
    const executeResponse = await fetch(`${API_BASE}/wallet/convert`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: fromAmount,
        fromCurrency,
        toCurrency
      })
    });

    const executeData = await executeResponse.json();

    if (!executeResponse.ok) {
      throw new Error(executeData.error || 'Error ejecutando la conversión');
    }

    console.log('[Convert] ✅ PASO 2 OK: Conversión ejecutada!');

    alert(`✅ ¡Conversión exitosa!\n\n${fromAmount.toFixed(2)} ${fromCurrency} → ${convertedAmount.toFixed(2)} ${toCurrency}`);

    closeConvertModal();

    // Recargar datos
    await loadWallets();
    await loadMovements();

  } catch (error) {
    console.error('[Convert] ❌ Error:', error);
    alert(`❌ Error: ${error.message}`);
  }
}

// Cerrar modal al hacer click fuera
document.addEventListener('click', (event) => {
  const modal = document.getElementById('convertModal');
  if (event.target === document.querySelector('.convert-modal-overlay')) {
    closeConvertModal();
  }
});