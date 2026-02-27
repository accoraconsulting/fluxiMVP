/**
 * EXCHANGE RATES SERVICE - TASAS DE CAMBIO EN TIEMPO REAL
 * Centraliza todas las conversiones de divisas de la plataforma
 */

const CACHE_KEY = 'fluxi_exchange_rates';
const CACHE_DURATION = 3600000; // 1 hora en milisegundos

// API gratuita de tasas de cambio (1500 requests/mes)
const EXCHANGE_API = 'https://api.exchangerate-api.com/v4/latest';

// Moneda base para conversiones
const BASE_CURRENCY = 'USD';

// Tasas de respaldo (fallback) si la API falla
const FALLBACK_RATES = {
  'USD': 1.0,
  'EUR': 0.92,
  'COP': 0.00025,
  'BTC': 43000,
  'ETH': 2200,
  'USDT': 1.0,
  'GBP': 0.79,
  'JPY': 149.50,
  'CAD': 1.35,
  'AUD': 1.52
};

/**
 * Obtener tasas de cambio (con cache)
 */
export async function getExchangeRates(forceRefresh = false) {
  try {
    // Verificar cache
    if (!forceRefresh) {
      const cached = getCachedRates();
      if (cached) {
        console.log('[ExchangeRates] ✅ Usando tasas en cache');
        return cached;
      }
    }

    console.log('[ExchangeRates] 🔄 Obteniendo tasas actualizadas...');

    // Llamar a la API
    const response = await fetch(`${EXCHANGE_API}/${BASE_CURRENCY}`);
    
    if (!response.ok) {
      throw new Error('Error en API de tasas de cambio');
    }

    const data = await response.json();
    
    // Validar respuesta
    if (!data.rates || typeof data.rates !== 'object') {
      throw new Error('Formato de respuesta inválido');
    }

    // Agregar criptomonedas (no incluidas en la API)
    const rates = {
      ...data.rates,
      'BTC': await getCryptoRate('bitcoin'),
      'ETH': await getCryptoRate('ethereum'),
      'USDT': 1.0 // Stablecoin siempre 1:1 con USD
    };

    // Guardar en cache
    saveRatesToCache(rates, data.time_last_updated);

    console.log('[ExchangeRates] ✅ Tasas actualizadas:', Object.keys(rates).length, 'monedas');

    return rates;

  } catch (error) {
    console.error('[ExchangeRates] ❌ Error obteniendo tasas:', error);
    console.warn('[ExchangeRates] ⚠️ Usando tasas de respaldo');
    
    // Retornar tasas de respaldo
    return FALLBACK_RATES;
  }
}

/**
 * Obtener tasa de criptomoneda (CoinGecko API gratuita)
 */
async function getCryptoRate(cryptoId) {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoId}&vs_currencies=usd`
    );

    if (!response.ok) throw new Error('Error en CoinGecko API');

    const data = await response.json();
    return data[cryptoId]?.usd || FALLBACK_RATES[cryptoId.toUpperCase()];

  } catch (error) {
    console.warn('[ExchangeRates] Error obteniendo crypto:', cryptoId, error);
    return FALLBACK_RATES[cryptoId.toUpperCase()];
  }
}

/**
 * Convertir monto entre dos monedas
 */
export async function convertCurrency(amount, fromCurrency, toCurrency) {
  try {
    if (fromCurrency === toCurrency) {
      return parseFloat(amount);
    }

    const rates = await getExchangeRates();

    // Convertir a USD primero (base)
    const amountInUSD = parseFloat(amount) / (rates[fromCurrency] || 1);

    // Convertir de USD a moneda destino
    const convertedAmount = amountInUSD * (rates[toCurrency] || 1);

    console.log(`[ExchangeRates] 💱 ${amount} ${fromCurrency} = ${convertedAmount.toFixed(6)} ${toCurrency}`);

    return convertedAmount;

  } catch (error) {
    console.error('[ExchangeRates] Error en conversión:', error);
    throw new Error('Error al convertir divisas');
  }
}

/**
 * Obtener tasa de cambio entre dos monedas
 */
export async function getExchangeRate(fromCurrency, toCurrency) {
  try {
    if (fromCurrency === toCurrency) {
      return 1.0;
    }

    const rates = await getExchangeRates();

    // Tasa: 1 FROM = X TO
    const rate = (rates[toCurrency] || 1) / (rates[fromCurrency] || 1);

    return rate;

  } catch (error) {
    console.error('[ExchangeRates] Error obteniendo tasa:', error);
    return 1.0;
  }
}

/**
 * Formatear monto con símbolo de moneda
 */
export function formatCurrencyAmount(amount, currency) {
  const symbols = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥',
    'COP': '$',
    'CAD': 'C$',
    'AUD': 'A$',
    'BTC': '₿',
    'ETH': 'Ξ',
    'USDT': '₮'
  };

  const symbol = symbols[currency] || currency;
  
  // Formato especial para criptos
  if (['BTC', 'ETH'].includes(currency)) {
    return `${symbol} ${parseFloat(amount).toFixed(8)}`;
  }

  // Formato normal
  const formatted = new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);

  return `${symbol} ${formatted}`;
}

/**
 * Obtener símbolo de moneda
 */
export function getCurrencySymbol(currency) {
  const symbols = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥',
    'COP': '$',
    'CAD': 'C$',
    'AUD': 'A$',
    'BTC': '₿',
    'ETH': 'Ξ',
    'USDT': '₮'
  };

  return symbols[currency] || currency;
}

/**
 * Obtener todas las monedas soportadas
 */
export async function getSupportedCurrencies() {
  const rates = await getExchangeRates();
  return Object.keys(rates).sort();
}

/* ============================
   FUNCIONES DE CACHE
============================ */

function getCachedRates() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const { rates, timestamp } = JSON.parse(cached);
    
    // Verificar si el cache expiró
    const now = Date.now();
    if (now - timestamp > CACHE_DURATION) {
      console.log('[ExchangeRates] ⏰ Cache expirado');
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return rates;

  } catch (error) {
    console.error('[ExchangeRates] Error leyendo cache:', error);
    return null;
  }
}

function saveRatesToCache(rates, apiTimestamp) {
  try {
    const cacheData = {
      rates,
      timestamp: Date.now(),
      apiTimestamp,
      source: 'exchangerate-api.com'
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    console.log('[ExchangeRates] 💾 Tasas guardadas en cache');

  } catch (error) {
    console.error('[ExchangeRates] Error guardando cache:', error);
  }
}

/**
 * Forzar actualización de tasas
 */
export async function refreshExchangeRates() {
  console.log('[ExchangeRates] 🔄 Forzando actualización...');
  localStorage.removeItem(CACHE_KEY);
  return await getExchangeRates(true);
}

/**
 * Obtener información de cache
 */
export function getCacheInfo() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const { timestamp, apiTimestamp, source } = JSON.parse(cached);
    
    return {
      lastUpdate: new Date(timestamp),
      apiLastUpdate: apiTimestamp ? new Date(apiTimestamp * 1000) : null,
      source,
      expiresIn: CACHE_DURATION - (Date.now() - timestamp)
    };

  } catch (error) {
    return null;
  }
}

/* ============================
   INICIALIZACIÓN AUTOMÁTICA
============================ */

// Pre-cargar tasas al importar el módulo
getExchangeRates().catch(err => {
  console.warn('[ExchangeRates] ⚠️ Error en pre-carga de tasas:', err);
});

// Exportar también las tasas de respaldo para casos extremos
export { FALLBACK_RATES };