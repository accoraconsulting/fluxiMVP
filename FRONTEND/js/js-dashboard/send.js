/**
 * SEND MONEY - SISTEMA COMPLETO DE ENVÍO CON APROBACIÓN
 * VERSIÓN REFACTORIZADA - CENTRALIZADA
 */

import { getSession } from '../auth/session.js';
import { guardPage, startSessionMonitor } from '../auth/session-guard.js';
import { API_CONFIG } from '../config/api.config.js';
import {
  convertCurrency,
  getExchangeRate,
  getCurrencySymbol,
  formatCurrencyAmount
} from '../services/exchangeRates.service.js';

const API_BASE = API_CONFIG.API_ENDPOINT;

// Estado global
let currentStep = 1;
let selectedRecipient = null;
let userWallets = [];
let recipientWallets = [];
let allRecipients = [];
let exchangeRatesCache = {};
let preSelectedRecipientId = null; // ← NUEVO


 // ===================================
// PINTAR NOMBRE DE USUARIO
// ===================================
function paintUsername(user) {
  const username = user.username || user.email || 'Usuario';

  document.querySelectorAll('[data-user-name]').forEach(el => {
    el.textContent = username;
  });
}


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

  console.log('[Send] ✅ Usuario autenticado:', session.user.email);

  // Pintar nombre de usuario
  paintUsername(session.user);

  // NUEVO: Verificar si viene un destinatario pre-seleccionado
  const urlParams = new URLSearchParams(window.location.search);
  preSelectedRecipientId = urlParams.get('recipient');
  const preSelectedWalletId = urlParams.get('wallet');
  const preSelectedCurrency = urlParams.get('currency');


  if (preSelectedRecipientId) {
    console.log('[Send] 🎯 Destinatario pre-seleccionado desde URL:', preSelectedRecipientId);
  }


if (preSelectedWalletId && preSelectedCurrency) {
  console.log('[Send] 💳 Wallet pre-seleccionada:', preSelectedCurrency);
}

  // Cargar datos iniciales
  await loadInitialData();

  // Setup event listeners
  setupEventListeners();

  // Ajustar layout para sidebar
  adjustLayoutForSidebar();

  // NUEVO: Si hay destinatario pre-seleccionado, seleccionarlo automáticamente
  
// NUEVO: Auto-seleccionar wallet en paso 2
      if (preSelectedWalletId && preSelectedCurrency) {
        setTimeout(() => {
          const currencyFrom = document.getElementById('currencyFrom');
          if (currencyFrom) {
            currencyFrom.value = preSelectedCurrency;
            currencyFrom.dispatchEvent(new Event('change'));
          }
        }, 1000);
      }
});

// ===================================
// AUTO-SELECCIONAR DESTINATARIO
// ===================================
async function autoSelectRecipient(recipientId) {
  try {
    console.log('[Send] 🔄 Auto-seleccionando destinatario:', recipientId);

    const recipient = allRecipients.find(r => r.id === recipientId);

    if (!recipient) {
      console.warn('[Send] ⚠️ Destinatario no encontrado en la lista');
      showError('Destinatario no encontrado. Por favor selecciónalo manualmente.');
      return;
    }

    // Simular click en el destinatario
    const item = document.querySelector(`[data-recipient-id="${recipientId}"]`);
    if (item) {
      item.click();
      
      // Scroll al destinatario seleccionado
      item.scrollIntoView({ behavior: 'smooth', block: 'center' });

      console.log('[Send] ✅ Destinatario auto-seleccionado');
    }

  } catch (error) {
    console.error('[Send] Error auto-seleccionando destinatario:', error);
  }
}
// ===================================
// CARGAR DATOS INICIALES
// ===================================
async function loadInitialData() {
  try {
    console.log('[Send] 📊 Cargando datos iniciales...');

    // Cargar wallets del usuario
    await loadUserWallets();

    // Cargar destinatarios inscritos
    await loadRecipients();

    // Cargar historial de solicitudes
    await loadRequestHistory();

  } catch (error) {
    console.error('[Send] Error cargando datos:', error);
    showError('Error cargando datos iniciales');
  }
}
// ===================================
// CARGAR WALLETS DEL USUARIO
// ===================================
async function loadUserWallets() {
  try {
    const session = getSession();

    console.log('═══════════════════════════════════════════════');
    console.log('[Send] 🔍 CARGANDO WALLETS DEL USUARIO');
    console.log('[Send] Email:', session.user.email);
    console.log('[Send] User ID:', session.user.id);
    console.log('═══════════════════════════════════════════════');

    const response = await fetch(`${API_BASE}/wallet/all`, {
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('[Send] 📡 Response status:', response.status);
    console.log('[Send] 📡 Response ok:', response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Send] ❌ Error response:', errorText);
      throw new Error('Error cargando wallets');
    }

    const data = await response.json();
    
    console.log('═══════════════════════════════════════════════');
    console.log('[Send] 📦 RESPONSE DATA COMPLETO:');
    console.log(JSON.stringify(data, null, 2));
    console.log('═══════════════════════════════════════════════');

    if (!data.data || !Array.isArray(data.data)) {
      console.error('[Send] ❌ data.data no es un array:', data.data);
      userWallets = [];
      return;
    }

    console.log('[Send] 📊 Total wallets en respuesta:', data.data.length);

    // Filtrar solo wallets activas
    userWallets = data.data.filter(w => {
      const isActive = w.isActive;
      console.log('[Send] 🔍 Evaluando wallet:', {
        symbol: w.symbol,
        isActive: isActive,
        'isActive === true': isActive === true,
        'isActive === 1': isActive === 1,
        balance: w.balance,
        id: w.id
      });
      // Solo mostrar si isActive es estrictamente true o 1
      return isActive === true || isActive === 1 || isActive === 'true';
    });

    console.log('═══════════════════════════════════════════════');
    console.log('[Send] 💰 WALLETS ACTIVAS CARGADAS:', userWallets.length);
    console.log('[Send] 💰 Detalle de wallets:');
    userWallets.forEach(w => {
      console.log(`  - ${w.symbol}: balance=${w.balance}, id=${w.id.substring(0, 8)}...`);
    });
    console.log('═══════════════════════════════════════════════');

  } catch (error) {
    console.error('═══════════════════════════════════════════════');
    console.error('[Send] ❌ ERROR CARGANDO WALLETS:');
    console.error(error);
    console.error('═══════════════════════════════════════════════');
    throw error;
  }
}

// ===================================
// CARGAR DESTINATARIOS INSCRITOS
// ===================================
// ===================================
// CARGAR DESTINATARIOS INSCRITOS
// ===================================
async function loadRecipients() {
  try {
    const session = getSession();

    console.log('═══════════════════════════════════════════════');
    console.log('[Send] 📡 CARGANDO DESTINATARIOS INSCRITOS');
    console.log('[Send] User ID:', session.user.id);
    console.log('═══════════════════════════════════════════════');

    const response = await fetch(`${API_BASE}/enrolled`, {
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('[Send] 📊 Response status:', response.status);
    console.log('[Send] 📊 Response ok:', response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Send] ❌ Error response:', errorText);
      throw new Error('Error cargando destinatarios');
    }

    const data = await response.json();
    
    console.log('═══════════════════════════════════════════════');
    console.log('[Send] 📦 RESPONSE DATA COMPLETO:');
    console.log(JSON.stringify(data, null, 2));
    console.log('═══════════════════════════════════════════════');

    if (!data.data) {
      console.error('[Send] ❌ data.data no existe:', data);
      allRecipients = [];
      paintRecipients([]);
      return;
    }

    if (!Array.isArray(data.data)) {
      console.error('[Send] ❌ data.data no es un array:', typeof data.data, data.data);
      allRecipients = [];
      paintRecipients([]);
      return;
    }

    allRecipients = data.data;

    console.log('═══════════════════════════════════════════════');
    console.log('[Send] 👥 DESTINATARIOS CARGADOS:', allRecipients.length);
    console.log('[Send] 📋 Lista de destinatarios:');
    allRecipients.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.alias} (${r.recipientEmail}) - ID: ${r.id}`);
    });
    console.log('═══════════════════════════════════════════════');

    paintRecipients(allRecipients);

  } catch (error) {
    console.error('═══════════════════════════════════════════════');
    console.error('[Send] ❌ ERROR CARGANDO DESTINATARIOS:');
    console.error(error);
    console.error('═══════════════════════════════════════════════');
    allRecipients = [];
    paintRecipients([]);
  }
}

// ===================================
// PINTAR LISTA DE DESTINATARIOS
// ===================================
// ===================================
// PINTAR LISTA DE DESTINATARIOS
// ===================================
function paintRecipients(recipients) {
  const container = document.getElementById('recipientsList');
  const noRecipientsMsg = document.getElementById('noRecipients');

  console.log('═══════════════════════════════════════════════');
  console.log('[Send] 🎨 PINTANDO DESTINATARIOS');
  console.log('[Send] Cantidad a pintar:', recipients.length);
  console.log('[Send] Container existe:', !!container);
  console.log('[Send] NoRecipients msg existe:', !!noRecipientsMsg);
  console.log('═══════════════════════════════════════════════');

  if (!container) {
    console.error('[Send] ❌ Container #recipientsList NO EXISTE en el DOM');
    return;
  }

  if (recipients.length === 0) {
    container.innerHTML = '';
    if (noRecipientsMsg) {
      noRecipientsMsg.style.display = 'block';
    }
    console.log('[Send] ℹ️ No hay destinatarios para mostrar');
    return;
  }

  if (noRecipientsMsg) {
    noRecipientsMsg.style.display = 'none';
  }

  console.log('[Send] 🔨 Generando HTML para', recipients.length, 'destinatarios');

  const html = recipients.map((r, index) => {
    console.log(`[Send] Generando HTML para destinatario ${index + 1}:`, {
      id: r.id,
      alias: r.alias,
      email: r.recipientEmail
    });

    return `
      <div class="send-recipient-item" data-recipient-id="${r.id}">
        <div class="send-recipient-avatar">
          ${getInitials(r.alias)}
        </div>
        <div class="send-recipient-info">
          <div class="send-recipient-alias">${r.alias}</div>
          <div class="send-recipient-email">${r.recipientEmail}</div>
        </div>
        <i class="bx bx-check-circle send-recipient-check"></i>
      </div>
    `;
  }).join('');

  console.log('[Send] 📝 HTML generado, longitud:', html.length);

  container.innerHTML = html;

  console.log('[Send] ✅ HTML insertado en el DOM');

  // Event listeners para seleccionar destinatario
  const items = container.querySelectorAll('.send-recipient-item');
  
  console.log('[Send] 🔗 Agregando event listeners a', items.length, 'items');

  items.forEach((item, index) => {
    item.addEventListener('click', () => {
      const recipientId = item.dataset.recipientId;
      console.log(`[Send] 🖱️ Click en destinatario ${index + 1}, ID:`, recipientId);
      selectRecipient(recipientId);
    });
  });

  console.log('[Send] ✅ Event listeners agregados');
  console.log('═══════════════════════════════════════════════');
}


// ===================================
// SELECCIONAR DESTINATARIO
// ===================================
async function selectRecipient(recipientId) {
  try {
    // Remover selección previa
    document.querySelectorAll('.send-recipient-item').forEach(item => {
      item.classList.remove('selected');
    });

    // Marcar como seleccionado
    const item = document.querySelector(`[data-recipient-id="${recipientId}"]`);
    if (item) {
      item.classList.add('selected');
    }

    // Guardar destinatario seleccionado
    selectedRecipient = allRecipients.find(r => r.id === recipientId);

    console.log('[Send] ✅ Destinatario seleccionado:', selectedRecipient);

    // Cargar wallets del destinatario
    await loadRecipientWallets(selectedRecipient.recipientEmail);

  } catch (error) {
    console.error('[Send] Error seleccionando destinatario:', error);
    showError('Error cargando wallets del destinatario');
  }
}

// ===================================
// CARGAR WALLETS DEL DESTINATARIO
// ===================================
// ===================================
// CARGAR WALLETS DEL DESTINATARIO
// ===================================
async function loadRecipientWallets(recipientEmail) {
  try {
    const session = getSession();

    console.log('[Send] 🔍 Cargando wallets del destinatario:', recipientEmail);

    // Usar endpoint de enrolled para obtener wallets
    const response = await fetch(`${API_BASE}/enrolled/${selectedRecipient.id}`, {
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Error cargando wallets del destinatario');
    }

    const data = await response.json();
    
    console.log('[Send] 📦 Data completa del destinatario:', data);

    // Mapear wallets con el formato correcto (SIN FILTRAR POR isActive aquí)
    if (data.data && data.data.wallets) {
      recipientWallets = data.data.wallets.map(w => ({
        id: w.walletId || w.id,
        walletId: w.walletId || w.id,
        symbol: w.symbol,
        name: w.name,
        decimals: w.decimals,
        balance: parseFloat(w.balance) || 0,
        isActive: w.isActive !== undefined ? w.isActive : true,
        createdAt: w.createdAt
      }));
    } else {
      recipientWallets = [];
    }

    console.log('[Send] 💳 Wallets del destinatario:', recipientWallets);
    console.log('[Send] 💳 Total wallets:', recipientWallets.length);

  } catch (error) {
    console.error('[Send] Error cargando wallets del destinatario:', error);
    throw error;
  }
}

// ===================================
// OBTENER INICIALES
// ===================================
function getInitials(name) {
  if (!name) return '?';
  
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

// ===================================
// BÚSQUEDA DE DESTINATARIOS
// ===================================
function setupRecipientSearch() {
  const searchInput = document.getElementById('recipientSearch');
  
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();

    if (searchTerm === '') {
      paintRecipients(allRecipients);
      return;
    }

    const filtered = allRecipients.filter(r => 
      r.alias.toLowerCase().includes(searchTerm) ||
      r.recipientEmail.toLowerCase().includes(searchTerm)
    );

    paintRecipients(filtered);
  });
}

// ===================================
// CONFIGURAR EVENT LISTENERS
// ===================================
function setupEventListeners() {
  // Búsqueda de destinatarios
  setupRecipientSearch();

  // Botón Siguiente
  document.getElementById('btnNext')?.addEventListener('click', handleNext);

  // Botón Atrás
  document.getElementById('btnBack')?.addEventListener('click', handleBack);

  // Botón Confirmar
  document.getElementById('btnConfirm')?.addEventListener('click', handleConfirm);

  // Botón cerrar modal de éxito
  document.getElementById('btnCloseSuccess')?.addEventListener('click', () => {
    document.getElementById('successModal').classList.add('send-hidden');
    resetForm();
  });

  // Cambios en montos y monedas
  document.getElementById('amountFrom')?.addEventListener('input', calculateConversion);
  document.getElementById('currencyFrom')?.addEventListener('change', handleCurrencyFromChange);
  document.getElementById('currencyTo')?.addEventListener('change', calculateConversion);
}

// ===================================
// MANEJO DE PASO SIGUIENTE
// ===================================
async function handleNext() {
  if (currentStep === 1) {
    // Validar que haya un destinatario seleccionado
    if (!selectedRecipient) {
      showError('Por favor selecciona un destinatario');
      return;
    }

    // Pasar al paso 2
    goToStep(2);
    await setupStep2();

  } else if (currentStep === 2) {
    // Validar datos del paso 2
    if (!validateStep2()) {
      return;
    }

    // Pasar al paso 3
    goToStep(3);
    setupStep3();
  }
}

// ===================================
// MANEJO DE PASO ATRÁS
// ===================================
function handleBack() {
  if (currentStep > 1) {
    goToStep(currentStep - 1);
  }
}

// ===================================
// IR A UN PASO ESPECÍFICO
// ===================================
function goToStep(step) {
  currentStep = step;

  // Ocultar todos los pasos
  document.querySelectorAll('.send-step').forEach(s => {
    s.style.display = 'none';
  });

  // Mostrar paso actual
  document.getElementById(`step${step}`).style.display = 'block';

  // Gestionar botones
  const btnBack = document.getElementById('btnBack');
  const btnNext = document.getElementById('btnNext');
  const btnConfirm = document.getElementById('btnConfirm');

  if (step === 1) {
    btnBack.style.display = 'none';
    btnNext.style.display = 'flex';
    btnConfirm.style.display = 'none';
  } else if (step === 2) {
    btnBack.style.display = 'flex';
    btnNext.style.display = 'flex';
    btnConfirm.style.display = 'none';
  } else if (step === 3) {
    btnBack.style.display = 'flex';
    btnNext.style.display = 'none';
    btnConfirm.style.display = 'flex';
  }
}

// ===================================
// CONFIGURAR PASO 2
// ===================================
// ===================================
// CONFIGURAR PASO 2
// ===================================
async function setupStep2() {
  console.log('[Send] 🎯 Configurando paso 2...');
  console.log('[Send] Wallets del usuario:', userWallets);
  console.log('[Send] Wallets del destinatario:', recipientWallets);

  // Llenar select de moneda origen
  const currencyFrom = document.getElementById('currencyFrom');
  
  if (userWallets.length === 0) {
    currencyFrom.innerHTML = '<option value="">No tienes wallets disponibles</option>';
    showError('No tienes wallets disponibles. Contacta al administrador.');
    return;
  }

  currencyFrom.innerHTML = '<option value="">Seleccionar</option>' +
    userWallets.map(w => `
      <option value="${w.symbol}" data-wallet-id="${w.id}" data-balance="${w.balance}">
        ${w.symbol} - ${w.name}
      </option>
    `).join('');

  // Llenar select de moneda destino
  const currencyTo = document.getElementById('currencyTo');
  
  if (recipientWallets.length === 0) {
    currencyTo.innerHTML = '<option value="">El destinatario no tiene wallets</option>';
    showError('El destinatario no tiene wallets disponibles. Contacta al administrador.');
    return;
  }

  console.log('[Send] 📝 Llenando select de moneda destino con', recipientWallets.length, 'wallets');

  currencyTo.innerHTML = '<option value="">Seleccionar</option>' +
    recipientWallets.map(w => {
      const walletId = w.walletId || w.id;
      const isActive = w.isActive !== undefined ? w.isActive : true;
      
      console.log('[Send] Agregando wallet destino:', {
        symbol: w.symbol,
        walletId: walletId,
        isActive: isActive,
        balance: w.balance
      });
      
      return `
        <option value="${w.symbol}" data-wallet-id="${walletId}">
          ${w.symbol} - ${w.name}
        </option>
      `;
    }).join('');

  // Mostrar nombre del destinatario
  document.getElementById('recipientName').textContent = selectedRecipient.alias;

  // Limpiar campos
  document.getElementById('amountFrom').value = '';
  document.getElementById('amountTo').value = '';
  document.getElementById('balanceFrom').textContent = 'Disponible: $0.00';
  document.getElementById('conversionDetails').style.display = 'none';

  console.log('[Send] ✅ Paso 2 configurado exitosamente');
}
// ===================================
// MANEJO DE CAMBIO DE MONEDA ORIGEN
// ===================================
function handleCurrencyFromChange() {
  const select = document.getElementById('currencyFrom');
  const option = select.options[select.selectedIndex];

  if (option.value) {
    const balance = parseFloat(option.dataset.balance);
    const symbol = option.value;
    document.getElementById('balanceFrom').textContent = `Disponible: ${formatMoney(balance)} ${symbol}`;
  } else {
    document.getElementById('balanceFrom').textContent = 'Disponible: $0.00';
  }

  calculateConversion();
}

// ===================================
// CALCULAR CONVERSIÓN
// ===================================
async function calculateConversion() {
  try {
    const amountFrom = parseFloat(document.getElementById('amountFrom').value);
    const currencyFrom = document.getElementById('currencyFrom').value;
    const currencyTo = document.getElementById('currencyTo').value;

    if (!amountFrom || !currencyFrom || !currencyTo || amountFrom <= 0) {
      document.getElementById('conversionDetails').style.display = 'none';
      return;
    }

    console.log(`[Send] 💱 Convirtiendo ${amountFrom} ${currencyFrom} → ${currencyTo}`);

    // Si es la misma moneda, no convertir
    if (currencyFrom === currencyTo) {
      document.getElementById('amountTo').value = amountFrom.toFixed(2);
      document.getElementById('exchangeRateDisplay').textContent = '1.00 (misma moneda)';
      document.getElementById('commissionDisplay').textContent = '$0.00';
      document.getElementById('totalDebitDisplay').textContent = formatCurrencyAmount(amountFrom, currencyFrom);
      document.getElementById('conversionDetails').style.display = 'block';
      return;
    }

    // Obtener tasa en tiempo real
    const rate = await getExchangeRate(currencyFrom, currencyTo);
    console.log(`[Send] 📊 Tasa obtenida: ${rate}`);

    // Convertir monto
    const convertedAmount = await convertCurrency(amountFrom, currencyFrom, currencyTo);
    console.log(`[Send] 💰 Monto convertido: ${convertedAmount}`);

    // Calcular comisión (0.5%)
    const commission = amountFrom * 0.005;
    const totalDebit = amountFrom + commission;

    // Actualizar UI
    document.getElementById('amountTo').value = convertedAmount.toFixed(2);
    document.getElementById('exchangeRateDisplay').textContent = `1 ${currencyFrom} = ${rate.toFixed(6)} ${currencyTo}`;
    document.getElementById('commissionDisplay').textContent = formatCurrencyAmount(commission, currencyFrom);
    document.getElementById('totalDebitDisplay').textContent = formatCurrencyAmount(totalDebit, currencyFrom);

    // Mostrar detalles
    document.getElementById('conversionDetails').style.display = 'block';

    console.log(`[Send] ✅ Conversión exitosa: ${convertedAmount.toFixed(2)} ${currencyTo} (tasa: ${rate.toFixed(6)})`);

  } catch (error) {
    console.error('[Send] ❌ Error en conversión:', error);
    showError('Error calculando conversión. Verifica tu conexión.');
  }
}

// ===================================
// TASAS FIAT A FIAT
// ===================================
async function getFiatToFiatRate(from, to) {
  try {
    console.log('[Send] Obteniendo tasa fiat:', from, 'a', to);

    // API primaria: ExchangeRate-API
    const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${from}`);
    
    if (response.ok) {
      const data = await response.json();
      if (data.rates && data.rates[to]) {
        console.log('[Send] Tasa obtenida de ExchangeRate-API:', data.rates[to]);
        return data.rates[to];
      }
    }

    // Fallback: Frankfurter
    const fallbackResponse = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`);
    
    if (fallbackResponse.ok) {
      const fallbackData = await fallbackResponse.json();
      if (fallbackData.rates && fallbackData.rates[to]) {
        console.log('[Send] Tasa obtenida de Frankfurter:', fallbackData.rates[to]);
        return fallbackData.rates[to];
      }
    }

    // Tasas de respaldo aproximadas
    const fallbackRates = {
      'USD_EUR': 0.92,
      'USD_COP': 4300,
      'USD_MXN': 17.5,
      'USD_ARS': 350,
      'USD_BRL': 5.1,
      'EUR_USD': 1.09,
      'EUR_COP': 4678,
      'EUR_MXN': 19.0,
      'EUR_ARS': 380,
      'EUR_BRL': 5.5,
      'COP_USD': 0.00023,
      'COP_EUR': 0.00021,
      'MXN_USD': 0.057,
      'ARS_USD': 0.0029,
      'BRL_USD': 0.20
    };

    const key = `${from}_${to}`;
    if (fallbackRates[key]) {
      console.log('[Send] Usando tasa de respaldo:', fallbackRates[key]);
      return fallbackRates[key];
    }

    throw new Error('No se pudo obtener tasa de cambio');

  } catch (error) {
    console.error('[Send] Error obteniendo tasa fiat:', error);
    throw error;
  }
}

// ===================================
// TASAS CRYPTO A FIAT
// ===================================
async function getCryptoFiatRate(from, to) {
  try {
    console.log('[Send] Obteniendo tasa crypto:', from, 'a', to);

    const cryptoMap = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'USDT': 'tether'
    };

    const fiatMap = {
      'USD': 'usd',
      'EUR': 'eur',
      'COP': 'cop',
      'MXN': 'mxn',
      'ARS': 'ars',
      'BRL': 'brl'
    };

    const cryptos = ['BTC', 'ETH', 'USDT'];
    const isCryptoFrom = cryptos.includes(from);

    let rate = 1;

    if (isCryptoFrom) {
      // Crypto a Fiat
      const cryptoId = cryptoMap[from];
      const fiatCurrency = fiatMap[to] || 'usd';

      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoId}&vs_currencies=${fiatCurrency}`
      );

      if (response.ok) {
        const data = await response.json();
        rate = data[cryptoId][fiatCurrency];
        console.log('[Send] Tasa crypto obtenida:', rate);
      } else {
        throw new Error('Error obteniendo tasa crypto');
      }
    } else {
      // Fiat a Crypto
      const cryptoId = cryptoMap[to];
      const fiatCurrency = fiatMap[from] || 'usd';

      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoId}&vs_currencies=${fiatCurrency}`
      );

      if (response.ok) {
        const data = await response.json();
        rate = 1 / data[cryptoId][fiatCurrency];
        console.log('[Send] Tasa crypto obtenida:', rate);
      } else {
        throw new Error('Error obteniendo tasa crypto');
      }
    }

    return rate;

  } catch (error) {
    console.error('[Send] Error obteniendo tasa crypto:', error);
    
    // Tasas de respaldo aproximadas
    const fallbackRates = {
      'BTC_USD': 43000,
      'ETH_USD': 2200,
      'USDT_USD': 1,
      'USD_BTC': 0.000023,
      'USD_ETH': 0.00045,
      'USD_USDT': 1
    };

    const key = `${from}_${to}`;
    if (fallbackRates[key]) {
      console.log('[Send] Usando tasa crypto de respaldo:', fallbackRates[key]);
      return fallbackRates[key];
    }

    throw error;
  }
}

// ===================================
// CALCULAR COMISIÓN
// ===================================
function calculateCommission(amount, currency) {
  // Comisión: 0.5% con mínimo según moneda
  const commissions = {
    'USD': Math.max(0.50, amount * 0.005),
    'EUR': Math.max(0.45, amount * 0.005),
    'COP': Math.max(2000, amount * 0.005),
    'MXN': Math.max(10, amount * 0.005),
    'ARS': Math.max(100, amount * 0.005),
    'BRL': Math.max(2.5, amount * 0.005),
    'BTC': Math.max(0.00001, amount * 0.01),
    'ETH': Math.max(0.0001, amount * 0.01),
    'USDT': Math.max(0.50, amount * 0.005)
  };

  const commission = commissions[currency] || (amount * 0.005);
  
  console.log('[Send] Comisión calculada:', {
    currency,
    amount,
    commission
  });

  return commission;
}

// ===================================
// VALIDAR PASO 2
// ===================================
function validateStep2() {
  const amountFrom = parseFloat(document.getElementById('amountFrom').value);
  const currencyFrom = document.getElementById('currencyFrom').value;
  const currencyTo = document.getElementById('currencyTo').value;

  if (!currencyFrom) {
    showError('Selecciona la moneda de origen');
    return false;
  }

  if (!currencyTo) {
    showError('Selecciona la moneda de destino');
    return false;
  }

  if (!amountFrom || amountFrom <= 0) {
    showError('Ingresa un monto válido mayor a 0');
    return false;
  }

  // Verificar saldo suficiente
  const selectFrom = document.getElementById('currencyFrom');
  const option = selectFrom.options[selectFrom.selectedIndex];
  const balance = parseFloat(option.dataset.balance);
  const commission = calculateCommission(amountFrom, currencyFrom);
  const totalRequired = amountFrom + commission;

  console.log('[Send] Validación de saldo:', {
    balance,
    amount: amountFrom,
    commission,
    totalRequired
  });

  if (balance < totalRequired) {
    showError(`Saldo insuficiente. Tienes ${formatMoney(balance)} ${currencyFrom}, necesitas ${formatMoney(totalRequired)} ${currencyFrom}`);
    return false;
  }

  return true;
}

// ===================================
// CONFIGURAR PASO 3 (CONFIRMACIÓN)
// ===================================
function setupStep3() {
  const amountFrom = parseFloat(document.getElementById('amountFrom').value);
  const amountTo = parseFloat(document.getElementById('amountTo').value);
  const currencyFrom = document.getElementById('currencyFrom').value;
  const currencyTo = document.getElementById('currencyTo').value;
  const commission = calculateCommission(amountFrom, currencyFrom);

  document.getElementById('confirmRecipient').textContent = 
    `${selectedRecipient.alias} (${selectedRecipient.recipientEmail})`;
  
  document.getElementById('confirmAmountFrom').textContent = 
    `${formatMoney(amountFrom)} ${currencyFrom}`;
  
  document.getElementById('confirmAmountTo').textContent = 
    `${formatMoney(amountTo)} ${currencyTo}`;
  
  document.getElementById('confirmCommission').textContent = 
    `${formatMoney(commission)} ${currencyFrom}`;
}

// ===================================
// CONFIRMAR Y ENVIAR SOLICITUD
// ===================================
async function handleConfirm() {
  try {
    const btnConfirm = document.getElementById('btnConfirm');
    btnConfirm.disabled = true;
    btnConfirm.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Enviando...';

    const session = getSession();

    // Obtener IDs de wallets
    const selectFrom = document.getElementById('currencyFrom');
    const optionFrom = selectFrom.options[selectFrom.selectedIndex];
    const fromWalletId = optionFrom.dataset.walletId;

    const selectTo = document.getElementById('currencyTo');
    const optionTo = selectTo.options[selectTo.selectedIndex];
    const toWalletId = optionTo.dataset.walletId;

    console.log('[Send] 🔍 Wallets seleccionadas:', {
      from: {
        walletId: fromWalletId,
        currency: selectFrom.value
      },
      to: {
        walletId: toWalletId,
        currency: selectTo.value
      }
    });

    // Verificar que tenemos los IDs
    if (!fromWalletId) {
      throw new Error('No se pudo obtener el ID de la wallet origen');
    }

    if (!toWalletId) {
      throw new Error('No se pudo obtener el ID de la wallet destino');
    }

    // Preparar datos
    const amountFrom = parseFloat(document.getElementById('amountFrom').value);
    const amountTo = parseFloat(document.getElementById('amountTo').value);
    const currencyFrom = selectFrom.value;
    const currencyTo = selectTo.value;
    const exchangeRate = await getExchangeRate(currencyFrom, currencyTo);
    const commission = calculateCommission(amountFrom, currencyFrom);
    const description = document.getElementById('description').value || 'Pago enviado';

    const requestData = {
      toUserEmail: selectedRecipient.recipientEmail,
      fromWalletId,
      toWalletId,
      amount: amountFrom,
      fromCurrency: currencyFrom,
      toCurrency: currencyTo,
      convertedAmount: amountTo,
      exchangeRate,
      commission,
      description
    };

    console.log('[Send] 📤 Enviando solicitud:', requestData);

    // Enviar solicitud
    const response = await fetch(`${API_BASE}/payment-requests`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });

    const data = await response.json();

    console.log('[Send] 📥 Respuesta del servidor:', {
      status: response.status,
      data
    });

    if (!response.ok) {
      throw new Error(data.error || 'Error enviando solicitud');
    }

    console.log('[Send] ✅ Solicitud enviada exitosamente');

    // Mostrar modal de éxito
    document.getElementById('successModal').classList.remove('send-hidden');

    // Recargar historial
    await loadRequestHistory();

  } catch (error) {
    console.error('[Send] ❌ Error enviando solicitud:', error);
    showError(error.message || 'Error enviando solicitud');

    const btnConfirm = document.getElementById('btnConfirm');
    btnConfirm.disabled = false;
    btnConfirm.innerHTML = '<i class="bx bx-check-circle"></i> Confirmar Envío';
  }
}

// ===================================
// CARGAR HISTORIAL DE SOLICITUDES
// ===================================
async function loadRequestHistory() {
  try {
    const session = getSession();

    const response = await fetch(`${API_BASE}/payment-requests/my-requests?limit=10`, {
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Error cargando historial');
    }

    const data = await response.json();
    paintRequestHistory(data.data);

  } catch (error) {
    console.error('[Send] Error cargando historial:', error);
    paintRequestHistory([]);
  }
}

// ===================================
// PINTAR HISTORIAL
// ===================================
function paintRequestHistory(requests) {
  const container = document.getElementById('historyList');

  if (!container) return;

  if (requests.length === 0) {
    container.innerHTML = `
      <p style="text-align: center; color: #64748b; padding: 40px;">
        No tienes solicitudes recientes
      </p>
    `;
    return;
  }

  container.innerHTML = requests.map(r => `
    <div class="send-history-item">
      <div class="send-history-info">
        <div class="send-history-recipient">
          ${r.toUser.username || r.toUser.email}
        </div>
        <div class="send-history-amount">
          ${formatMoney(r.amount)} ${r.fromCurrency} → ${formatMoney(r.convertedAmount)} ${r.toCurrency}
        </div>
        <div class="send-history-date">
          ${formatDate(r.createdAt)}
        </div>
      </div>
      <span class="send-history-status ${r.status}">
        ${getStatusLabel(r.status)}
      </span>
    </div>
  `).join('');
}

// ===================================
// RESETEAR FORMULARIO
// ===================================
function resetForm() {
  currentStep = 1;
  selectedRecipient = null;
  
  goToStep(1);
  
  document.getElementById('amountFrom').value = '';
  document.getElementById('amountTo').value = '';
  document.getElementById('description').value = '';
  
  document.querySelectorAll('.send-recipient-item').forEach(item => {
    item.classList.remove('selected');
  });

  loadRecipients();
}

// ===================================
// AJUSTAR LAYOUT PARA SIDEBAR
// ===================================
function adjustLayoutForSidebar() {
  const mainContent = document.querySelector('.send-main-content');
  const sidebarContainer = document.getElementById('sidebar-container');

  if (!mainContent) return;

  const updateLayout = () => {
    const sidebar = sidebarContainer?.querySelector('.sidebar');

    if (!sidebar) {
      mainContent.classList.remove('has-sidebar', 'has-sidebar-collapsed');
      return;
    }

    if (sidebar.classList.contains('collapsed')) {
      mainContent.classList.remove('has-sidebar');
      mainContent.classList.add('has-sidebar-collapsed');
    } else {
      mainContent.classList.remove('has-sidebar-collapsed');
      mainContent.classList.add('has-sidebar');
    }
  };

  document.addEventListener('sidebar:loaded', updateLayout);

  if (sidebarContainer) {
    const observer = new MutationObserver(updateLayout);
    observer.observe(sidebarContainer, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  setTimeout(updateLayout, 100);
}

// ===================================
// UTILIDADES
// ===================================

function formatMoney(value) {
  return parseFloat(value || 0).toLocaleString('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getStatusLabel(status) {
  const labels = {
    'pending': 'Pendiente',
    'approved': 'Aprobado',
    'rejected': 'Rechazado',
    'failed': 'Fallido'
  };
  return labels[status] || status;
}

function showError(message) {
  console.error('[Send] ❌', message);
  alert(message);
}

function showSuccess(message) {
  console.log('[Send] ✅', message);
  alert(message);
}