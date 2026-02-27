/**
 * WALLET USER - REFACTORIZADO CON BALANCE TOTAL
 * Arquitectura limpia para integración con VitaWallet
 */

import { getSession } from '../auth/session.js';
import { guardPage, startSessionMonitor } from '../auth/session-guard.js';
import { convertCurrency, getExchangeRate } from '../services/exchangeRates.service.js';
import { API_CONFIG } from '../config/api.config.js';

const API_BASE = API_CONFIG.API_ENDPOINT;

let userWallets = [];
let recentMovements = [];
let currentWalletForAction = null;

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

  console.log('[Wallet] ✅ Usuario autenticado:', session.user.email);

  // Pintar username
  paintUsername(session.user);

  // Cargar datos
  await loadWallets();
  await loadRecentMovements();

  // Setup event listeners
  setupEventListeners();

  // Ajustar layout
  adjustLayoutForSidebar();
});

// ===================================
// PINTAR USERNAME
// ===================================
function paintUsername(user) {
  const username = user.username || user.email || 'Usuario';
  document.querySelectorAll('[data-user-name]').forEach(el => {
    el.textContent = username;
  });
}

// ===================================
// CARGAR WALLETS
// ===================================
async function loadWallets() {
  try {
    const session = getSession();
    const userStr = localStorage.getItem('auth_user');
    const user = userStr ? JSON.parse(userStr) : {};
    const isAdmin = user.role === 'fluxiAdmin';

    console.log('[Wallet] 💳 Cargando wallets para usuario:', user.username, `(${user.role})`);

    if (isAdmin) {
      // 🏦 ADMIN: Traer datos de VITA WALLET
      console.log('[Wallet] 📊 Admin detectado - Cargando balances de VITA...');
      await loadVitaWalletsForAdmin(session);
    } else {
      // 👤 USUARIO NORMAL: Traer datos de BD (como antes)
      console.log('[Wallet] 👤 Usuario normal - Cargando wallets de BD...');
      await loadBDWallets(session);
    }

    paintWallets(userWallets);
    await updateTotalBalance(userWallets);

  } catch (error) {
    console.error('[Wallet] ❌ Error cargando wallets:', error);
    showError('Error cargando wallets');
  }
}

/**
 * ADMIN: Carga wallets desde Vita Wallet
 */
async function loadVitaWalletsForAdmin(session) {
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

    console.log('[Wallet] 🏦 Balance de Vita obtenido:', vitaBalances);

    // Convertir formato de Vita a formato de wallets
    const wallets = Object.entries(vitaBalances).map(([symbol, balance]) => ({
      id: symbol.toLowerCase(),
      symbol: symbol.toUpperCase(),
      name: getCurrencyName(symbol),
      balance: parseFloat(balance) || 0,
      isActive: true,
      source: 'vita'
    }));

    // Ordenar: USD, EUR, COP, y luego el resto
    const order = { 'USD': 1, 'EUR': 2, 'COP': 3 };
    wallets.sort((a, b) => (order[a.symbol] || 999) - (order[b.symbol] || 999));

    console.log(`[Wallet] ✅ ${wallets.length} monedas desde Vita cargadas`);
    wallets.forEach(w => {
      console.log(`[Wallet] 🏦 ${w.symbol}: ${w.balance} (Vita)`);
    });

    userWallets = wallets;

  } catch (error) {
    console.error('[Wallet] Error cargando balance de Vita:', error);
    console.warn('[Wallet] ⚠️ Fallback a BD...');
    // Fallback a BD si falla Vita
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

    if (!response.ok) {
      throw new Error('Error cargando wallets');
    }

    const data = await response.json();
    const allWallets = data.data || [];

    // 🔍 DEBUG DETALLADO: Ver qué trae el backend
    console.log('═══════════════════════════════════════════════════');
    console.log('[Wallet] 📦 RESPUESTA CRUDA DEL BACKEND:');
    console.log('[Wallet] Total de wallets:', allWallets.length);
    allWallets.forEach((w, idx) => {
      console.log(`  [${idx}] ${w.symbol}:`, {
        id: w.id,
        symbol: w.symbol,
        balance: w.balance,
        isActive: w.isActive,
        'type(isActive)': typeof w.isActive
      });
    });
    console.log('═══════════════════════════════════════════════════');

    // 🔒 FILTRAR SOLO WALLETS ACTIVAS
    userWallets = allWallets.filter(w => {
      const isActive = w.isActive;
      return isActive === true || isActive === 1 || isActive === 'true';
    });

    const blockedCount = allWallets.length - userWallets.length;
    console.log(`[Wallet] ✅ Después de filtro: ${userWallets.length} activas${blockedCount > 0 ? `, ${blockedCount} bloqueadas (ocultas)` : ''}`);

    // 🔍 Debug: Mostrar qué se muestra vs qué se oculta
    console.log('═══════════════════════════════════════════════════');
    console.log('[Wallet] 📊 RESULTADO DEL FILTRADO:');
    userWallets.forEach(w => {
      console.log(`  ✅ SE MUESTRA: ${w.symbol} (isActive=${w.isActive})`);
    });
    allWallets.filter(w => w.isActive !== true).forEach(w => {
      console.log(`  🔒 SE OCULTA: ${w.symbol} (isActive=${w.isActive})`);
    });
    console.log('═══════════════════════════════════════════════════');

  } catch (error) {
    console.error('[Wallet] ❌ Error cargando wallets de BD:', error);
    userWallets = [];
  }
}

/**
 * Obtiene el nombre completo de una moneda
 */
function getCurrencyName(currency) {
  const names = {
    'USD': 'Dólar Americano',
    'COP': 'Peso Colombiano',
    'ARS': 'Peso Argentino',
    'CLP': 'Peso Chileno',
    'BRL': 'Real Brasileño',
    'MXN': 'Peso Mexicano',
    'EUR': 'Euro',
    'BTC': 'Bitcoin',
    'USDT': 'Tether',
    'USDC': 'USD Coin',
    'ETH': 'Ethereum',
  };
  return names[currency] || currency;
}

// ===================================
// ACTUALIZAR BALANCE TOTAL EN USD
// ===================================
async function updateTotalBalance(wallets) {
  try {
    // 🔥 BUSCAR ELEMENTO (AHORA INCLUYE ID)
    let totalBalanceElement = 
      document.getElementById('total-balance-amount') ||  // ✅ BUSCAR POR ID PRIMERO
      document.querySelector('#total-balance-amount') ||
      document.querySelector('.total-balance-amount') ||
      document.querySelector('.balance-amount') ||
      document.querySelector('.total-balance h2') ||
      document.querySelector('[data-total-balance]') ||
      document.querySelector('.balance-hero h2') ||
      document.querySelector('.balance-info h2');

    if (!totalBalanceElement) {
      console.warn('[Wallet] ❌ Elemento de balance total no encontrado');
      console.warn('[Wallet] 💡 Intenta agregar class="total-balance-amount" al h2 del balance total en wallet.html');
      
      // Mostrar qué elementos h2 existen
      const allH2 = Array.from(document.querySelectorAll('h2'));
      if (allH2.length > 0) {
        console.log('[Wallet] 📋 Elementos H2 encontrados:', allH2.map(el => ({
          id: el.id,
          class: el.className,
          text: el.textContent.substring(0, 20)
        })));
      }
      return;
    }

    console.log('[Wallet] ✅ Elemento encontrado:', totalBalanceElement.id || totalBalanceElement.className || totalBalanceElement.tagName);
    console.log('[Wallet] 💵 Calculando balance total en USD...');

    // Convertir todos los balances a USD
    let totalInUSD = 0;

    for (const wallet of wallets) {
      const balance = parseFloat(wallet.balance) || 0;
      
      if (wallet.symbol === 'USD') {
        totalInUSD += balance;
      } else {
        const convertedAmount = await convertCurrency(balance, wallet.symbol, 'USD');
        totalInUSD += convertedAmount;
        console.log(`[Wallet] 💱 ${balance} ${wallet.symbol} = ${convertedAmount.toFixed(2)} USD`);
      }
    }

    console.log(`[Wallet] ✅ Balance total: $${totalInUSD.toFixed(2)} USD`);

    // Formatear y mostrar
    const formatted = new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(totalInUSD);

    totalBalanceElement.textContent = `$${formatted}`;

    // Actualizar timestamp
    const lastUpdateElement = 
      document.querySelector('.last-update-text') ||
      document.querySelector('.last-update') ||
      document.querySelector('[data-last-update]') ||
      document.querySelector('.balance-info small span');

    if (lastUpdateElement) {
      const now = new Date();
      const timeString = now.toLocaleTimeString('es-CO', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      lastUpdateElement.textContent = `Actualizado ${timeString}`;
    }

  } catch (error) {
    console.error('[Wallet] ❌ Error calculando balance total:', error);
  }
}

// ===================================
// PINTAR WALLETS (ESTRUCTURA PREMIUM)
// ===================================
function paintWallets(wallets) {
  const container = document.getElementById('walletsContainer');

  if (!container) {
    console.error('[Wallet] Container #walletsContainer no encontrado');
    return;
  }

  // Si no hay wallets
  if (!wallets || wallets.length === 0) {
    container.innerHTML = `
      <div class="asset-card muted">
        <i class="bx bx-wallet"></i>
        <p>No tienes wallets disponibles</p>
      </div>
    `;
    return;
  }

  // 🔒 DOBLE VALIDACIÓN: FILTRAR UNA VEZ MÁS ANTES DE PINTAR
  // Esto asegura que NUNCA se pinte una wallet bloqueada
  const activesOnly = wallets.filter(w => w.isActive === true || w.isActive === 1 || w.isActive === 'true');

  if (activesOnly.length === 0) {
    console.warn('[Wallet] ⚠️ Todas las wallets están bloqueadas. No se pinta nada.');
    container.innerHTML = `
      <div class="asset-card muted">
        <i class="bx bx-wallet"></i>
        <p>No tienes wallets disponibles</p>
      </div>
    `;
    return;
  }

  console.log(`[Wallet] 🎯 PINTANDO: ${activesOnly.length} wallets activas (de ${wallets.length} recibidas)`);

  // Pintar cada wallet
  container.innerHTML = activesOnly.map(w => {
    // 🔒 TRIPLE VALIDACIÓN: CONFIRMAR QUE NO ESTÁ BLOQUEADA
    if (w.isActive === false || w.isActive === 0 || w.isActive === 'false') {
      console.warn(`[Wallet] ⚠️ INTENTO DE PINTAR WALLET BLOQUEADA: ${w.symbol}. Ignorando.`);
      return '';
    }

    const balance = parseFloat(w.balance) || 0;
    const formattedBalance = formatCurrency(balance, w.symbol);

    return `
      <div class="asset-card" data-wallet-id="${w.id}">
        
        <!-- HEADER: Icono + Nombre -->
        <div class="asset-card-header">
          <div class="asset-icon">
            ${getCurrencyIcon(w.symbol)}
          </div>
          <div class="asset-info">
            <strong>${w.symbol}</strong>
            <span>${w.name}</span>
          </div>
        </div>

        <!-- BALANCE -->
        <div class="asset-balance">
          <span class="label">Balance disponible</span>
          <div class="amount">${formattedBalance}</div>
        </div>

        <!-- ACCIONES: 3 botones con gradientes -->
        <div class="asset-actions">
          <button 
            class="asset-btn btn-send" 
            type="button"
            onclick="sendMoney('${w.id}', '${w.symbol}')"
            title="Enviar dinero">
            <i class="bx bx-send"></i>
            <span>Enviar</span>
          </button>

          <button
            class="asset-btn btn-topup"
            type="button"
            disabled
            title="Recargar - Próximamente disponible">
            <i class="bx bx-plus-circle"></i>
            <span>Recargar</span>
          </button>

          <button
            class="asset-btn btn-withdraw"
            type="button"
            disabled
            title="Retirar - Próximamente disponible">
            <i class="bx bx-minus-circle"></i>
            <span>Retirar</span>
          </button>
        </div>

      </div>
    `;
  }).join('');

  console.log('[Wallet] ✅ Wallets pintadas:', wallets.length);
}

// ===================================
// ENVIAR DINERO - REDIRIGE A SEND.HTML
// ===================================
window.sendMoney = function(walletId, symbol) {
  console.log('[Wallet] 📤 Redirigiendo a enviar con wallet:', symbol);
  
  // Redirigir a send.html con parámetro de wallet pre-seleccionada
  window.location.href = `./send.html?wallet=${walletId}&currency=${symbol}`;
};

// ===================================
// ABRIR MODAL RECARGAR
// ===================================
window.openTopupModal = function(walletId, symbol) {
  const wallet = userWallets.find(w => w.id === walletId);
  
  if (!wallet) {
    showError('Wallet no encontrada');
    return;
  }

  currentWalletForAction = wallet;

  // Llenar info de la wallet
  document.getElementById('topupWalletInfo').innerHTML = `
    <div class="wallet-info-badge">
      <div class="wallet-info-icon">${getCurrencyIcon(symbol)}</div>
      <div>
        <strong>${symbol}</strong>
        <span>${wallet.name}</span>
      </div>
    </div>
  `;

  // Limpiar y abrir modal
  document.getElementById('topupAmount').value = '';
  document.getElementById('topupMessage').textContent = '';
  
  const modal = document.getElementById('topupModal');
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
};

// ===================================
// CONFIRMAR RECARGA
// ===================================
async function confirmTopup() {
  try {
    const amount = parseFloat(document.getElementById('topupAmount').value);

    if (!amount || amount <= 0) {
      showModalError('topupMessage', 'Ingresa un monto válido');
      return;
    }

    console.log('[Wallet] 💰 Recargando:', { amount, wallet: currentWalletForAction.symbol });

    const session = getSession();

    const response = await fetch(`${API_BASE}/wallet/topup`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ amount })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Error procesando recarga');
    }

    console.log('[Wallet] ✅ Recarga exitosa');

    // Cerrar modal correctamente
    const modal = document.getElementById('topupModal');
    modal.classList.add('hidden');
    modal.style.display = 'none';

    // Recargar wallets
    await loadWallets();
    await loadRecentMovements();

    showSuccess(`Recarga de ${formatCurrency(amount, currentWalletForAction.symbol)} exitosa`);

  } catch (error) {
    console.error('[Wallet] Error en recarga:', error);
    showModalError('topupMessage', error.message);
  }
}

// ===================================
// ABRIR MODAL RETIRAR
// ===================================
window.openWithdrawModal = function(walletId, symbol) {
  const wallet = userWallets.find(w => w.id === walletId);
  
  if (!wallet) {
    showError('Wallet no encontrada');
    return;
  }

  currentWalletForAction = wallet;

  // Llenar info de la wallet
  document.getElementById('withdrawWalletInfo').innerHTML = `
    <div class="wallet-info-badge">
      <div class="wallet-info-icon">${getCurrencyIcon(symbol)}</div>
      <div>
        <strong>${symbol}</strong>
        <span>Balance: ${formatCurrency(wallet.balance, symbol)}</span>
      </div>
    </div>
  `;

  // Limpiar y abrir modal
  document.getElementById('withdrawAmount').value = '';
  document.getElementById('withdrawDescription').value = '';
  document.getElementById('withdrawMessage').textContent = '';
  
  const modal = document.getElementById('withdrawModal');
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
};

// ===================================
// CONFIRMAR RETIRO
// ===================================
async function confirmWithdraw() {
  try {
    const amount = parseFloat(document.getElementById('withdrawAmount').value);
    const description = document.getElementById('withdrawDescription').value.trim();

    if (!amount || amount <= 0) {
      showModalError('withdrawMessage', 'Ingresa un monto válido');
      return;
    }

    if (amount > parseFloat(currentWalletForAction.balance)) {
      showModalError('withdrawMessage', 'Saldo insuficiente');
      return;
    }

    console.log('[Wallet] 💸 Retirando:', { amount, wallet: currentWalletForAction.symbol });

    const session = getSession();

    const response = await fetch(`${API_BASE}/wallet/pay`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        amount,
        description: description || 'Retiro de fondos'
      })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Error procesando retiro');
    }

    console.log('[Wallet] ✅ Retiro exitoso');

    // Cerrar modal correctamente
    const modal = document.getElementById('withdrawModal');
    modal.classList.add('hidden');
    modal.style.display = 'none';

    // Recargar wallets
    await loadWallets();
    await loadRecentMovements();

    showSuccess(`Retiro de ${formatCurrency(amount, currentWalletForAction.symbol)} exitoso`);

  } catch (error) {
    console.error('[Wallet] Error en retiro:', error);
    showModalError('withdrawMessage', error.message);
  }
}

// ===================================
// CARGAR MOVIMIENTOS RECIENTES
// ===================================
async function loadRecentMovements() {
  try {
    const session = getSession();

    console.log('[Wallet] 📊 Cargando movimientos recientes...');

    const response = await fetch(`${API_BASE}/wallet/movements?limit=5&type=all&currency=all`, {
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Error cargando movimientos');
    }

    const data = await response.json();
    recentMovements = data.data || [];

    console.log('[Wallet] ✅ Movimientos cargados:', recentMovements.length);

    paintMovements(recentMovements);

  } catch (error) {
    console.error('[Wallet] ❌ Error cargando movimientos:', error);
    document.getElementById('movementsContainer').innerHTML = `
      <div class="empty-state">
        <i class="bx bx-error"></i>
        <p>Error cargando movimientos</p>
      </div>
    `;
  }
}

// ===================================
// PINTAR MOVIMIENTOS RECIENTES
// ===================================
function paintMovements(movements) {
  const container = document.getElementById('movementsContainer');

  if (!container) {
    console.error('[Wallet] Container #movementsContainer no encontrado');
    return;
  }

  // Si no hay movimientos
  if (!movements || movements.length === 0) {
    container.innerHTML = `
      <li class="empty-state">
        <i class="bx bx-receipt"></i>
        <p>No tienes movimientos recientes</p>
      </li>
    `;
    return;
  }

  // Limitar a 10 movimientos
  const limitedMovements = movements.slice(0, 10);

  container.innerHTML = limitedMovements.map(m => {
    const isPositive = m.type === 'topup' || m.type === 'transfer_in';
    const icon = getMovementIcon(m.type);
    const typeLabel = getMovementLabel(m.type);
    const formattedAmount = formatCurrency(Math.abs(m.amount), m.currency);
    const formattedDate = formatMovementDate(m.createdAt);
    const balanceAfter = formatCurrency(m.balanceAfter || 0, m.currency);

    return `
      <li class="movement-item">
        <!-- Icono -->
        <div class="movement-icon ${m.type}">
          <i class="bx ${icon}"></i>
        </div>

        <!-- Info principal -->
        <div class="movement-details">
          <div class="movement-header">
            <strong class="movement-type">${typeLabel}</strong>
            <span class="movement-amount ${isPositive ? 'positive' : 'negative'}">
              ${isPositive ? '+' : '-'}${formattedAmount}
            </span>
          </div>
          
          <div class="movement-meta">
            <span class="movement-date">
              <i class="bx bx-time-five"></i>
              ${formattedDate}
            </span>
            ${m.description ? `
              <span class="movement-description">
                ${m.description}
              </span>
            ` : ''}
          </div>

          <div class="movement-balance">
            <span class="label">Balance después:</span>
            <span class="value">${balanceAfter}</span>
          </div>
        </div>

        <!-- Status badge (opcional) -->
        <div class="movement-status">
          <span class="status-badge ${m.status || 'completed'}">
            ${m.status === 'pending' ? 'Pendiente' : 'Completado'}
          </span>
        </div>
      </li>
    `;
  }).join('');

  console.log('[Wallet] ✅ Movimientos pintados:', limitedMovements.length);
}

// ===================================
// EVENT LISTENERS
// ===================================
function setupEventListeners() {
  // Cerrar modales
  document.getElementById('closeTopupModal')?.addEventListener('click', () => {
    const modal = document.getElementById('topupModal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
  });

  document.getElementById('cancelTopup')?.addEventListener('click', () => {
    const modal = document.getElementById('topupModal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
  });

  document.getElementById('closeWithdrawModal')?.addEventListener('click', () => {
    const modal = document.getElementById('withdrawModal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
  });

  document.getElementById('cancelWithdraw')?.addEventListener('click', () => {
    const modal = document.getElementById('withdrawModal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
  });

  // Cerrar al hacer click en el backdrop
  document.querySelectorAll('.wallet-modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      const modal = e.target.closest('.wallet-modal-overlay');
      if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
      }
    });
  });

  // Confirmar acciones
  document.getElementById('confirmTopup')?.addEventListener('click', confirmTopup);
  document.getElementById('confirmWithdraw')?.addEventListener('click', confirmWithdraw);
}

// ===================================
// UTILIDADES
// ===================================
function getCurrencyIcon(symbol) {
  const icons = {
    'USD': '<i class="bx bx-dollar"></i>',
    'EUR': '<i class="bx bx-euro"></i>',
    'COP': '<i class="bx bx-money"></i>',
    'BTC': '<i class="bx bxl-bitcoin"></i>',
    'ETH': '<i class="bx bxl-bitcoin"></i>',
    'USDT': '<i class="bx bx-dollar-circle"></i>'
  };
  return icons[symbol] || '<i class="bx bx-wallet"></i>';
}

function formatCurrency(amount, symbol) {
  const formatted = new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);

  const symbols = {
    'USD': '$',
    'EUR': '€',
    'COP': '$',
    'BTC': '₿',
    'ETH': 'Ξ',
    'USDT': '$'
  };

  return `${symbols[symbol] || symbol} ${formatted}`;
}

function getMovementIcon(type) {
  const icons = {
    'topup': 'bx-plus-circle',
    'payment': 'bx-minus-circle',
    'transfer_in': 'bx-arrow-from-left',
    'transfer_out': 'bx-arrow-from-right'
  };
  return icons[type] || 'bx-transfer';
}

function getMovementLabel(type) {
  const labels = {
    'topup': 'Recarga',
    'payment': 'Retiro',
    'transfer_in': 'Transferencia recibida',
    'transfer_out': 'Transferencia enviada'
  };
  return labels[type] || 'Movimiento';
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

function formatMovementDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  // Hace menos de 1 hora
  if (diffMins < 60) {
    return diffMins === 0 ? 'Ahora' : `Hace ${diffMins} min`;
  }

  // Hace menos de 24 horas
  if (diffHours < 24) {
    return `Hace ${diffHours}h`;
  }

  // Hace menos de 7 días
  if (diffDays < 7) {
    return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
  }

  // Más de 7 días: mostrar fecha completa
  return date.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

function showError(message) {
  console.error('[Wallet]', message);
  alert(message);
}

function showSuccess(message) {
  console.log('[Wallet]', message);
  alert(message);
}

function showModalError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = message;
    el.style.color = '#dc2626';
  }
}

function adjustLayoutForSidebar() {
  const mainContent = document.querySelector('.main-content');
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