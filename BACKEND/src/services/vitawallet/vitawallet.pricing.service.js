/**
 * VITAWALLET PRICING SERVICE
 * Obtiene y cachea precios en tiempo real de Vitawallet
 *
 * Endpoints:
 * - GET /api/businesses/payins_prices - Precios para payins
 * - GET /api/businesses/prices - Precios para retiros
 * - GET /api/businesses/crypto_prices - Precios cripto
 */

import client from './vitawallet.client.js';
import config from './vitawallet.config.js';

// Cache en memoria
const priceCache = {
  payins: null,
  withdrawal: null,
  crypto: null,
  lastUpdate: {},
};

/**
 * Obtiene precios de payins desde Vitawallet
 * Cachea hasta que expire valid_until
 * @param {string} currency_destiny - Moneda destino (COP, USD, ARS, etc) - opcional
 * @returns {Promise<Object>} Precios de payins
 */
export async function getPayinPrices(currency_destiny = null) {
  try {
    console.log(`[VitawalletPricing] Obteniendo precios de payins...`);

    // En modo local, devolver precios mock
    if (config.isLocal()) {
      return getMockPayinPrices();
    }

    // Verificar cache
    if (
      priceCache.payins &&
      priceCache.lastUpdate.payins &&
      new Date() < new Date(priceCache.lastUpdate.payins)
    ) {
      console.log(`[VitawalletPricing] ✅ Precios en cache, válidos hasta ${priceCache.lastUpdate.payins}`);
      return priceCache.payins;
    }

    // Construir URL con query param si aplica
    let endpoint = config.ENDPOINTS.PAYIN_PRICES;
    if (currency_destiny) {
      endpoint += `?currency_destiny=${currency_destiny}`;
    }

    console.log(`[VitawalletPricing] Llamando a ${endpoint}`);
    const response = await client.get(endpoint);

    if (!response.data) {
      throw new Error('Respuesta vacía de precios');
    }

    // Cachear hasta valid_until más cercano
    const validUntil = findEarliestValidUntil(response.data);
    priceCache.payins = response.data;
    priceCache.lastUpdate.payins = validUntil;

    console.log(`[VitawalletPricing] ✅ Precios obtenidos, válidos hasta ${validUntil}`);

    return response.data;

  } catch (error) {
    console.error(`[VitawalletPricing] Error obteniendo precios de payins:`, error.message);
    // Devolver cache aunque esté expirado
    if (priceCache.payins) {
      console.warn(`[VitawalletPricing] ⚠️ Usando cache expirado`);
      return priceCache.payins;
    }
    throw error;
  }
}

/**
 * Obtiene precios de retiros/transferencias
 * @returns {Promise<Object>} Precios de retiros
 */
export async function getWithdrawalPrices() {
  try {
    console.log(`[VitawalletPricing] Obteniendo precios de retiros...`);

    if (config.isLocal()) {
      return getMockWithdrawalPrices();
    }

    // Verificar cache
    if (
      priceCache.withdrawal &&
      priceCache.lastUpdate.withdrawal &&
      new Date() < new Date(priceCache.lastUpdate.withdrawal)
    ) {
      console.log(`[VitawalletPricing] ✅ Precios en cache`);
      return priceCache.withdrawal;
    }

    const response = await client.get(config.ENDPOINTS.PRICES);

    if (!response.data?.withdrawal) {
      throw new Error('Estructura de precios inválida');
    }

    const validUntil = findEarliestValidUntil(response.data.withdrawal);
    priceCache.withdrawal = response.data.withdrawal;
    priceCache.lastUpdate.withdrawal = validUntil;

    console.log(`[VitawalletPricing] ✅ Precios de retiros obtenidos`);

    return response.data.withdrawal;

  } catch (error) {
    console.error(`[VitawalletPricing] Error obteniendo precios de retiros:`, error.message);
    if (priceCache.withdrawal) {
      console.warn(`[VitawalletPricing] ⚠️ Usando cache expirado`);
      return priceCache.withdrawal;
    }
    throw error;
  }
}

/**
 * Calcula comisión y monto final para un payin
 * Fórmula: finalAmount = (amount * sell_price) - fixed_cost
 *
 * @param {number} amount - Monto original
 * @param {string} country - País origen (CO, AR, CL, BR, MX)
 * @param {string} payment_method - Método de pago (PSE, NEQUI, etc)
 * @param {string} destination_currency - Moneda destino (USD, COP, etc) - opcional
 * @returns {Promise<Object>} {finalAmount, spread, fixed_cost, sell_price, commission}
 */
export async function calculatePayinFinalAmount(
  amount,
  country,
  payment_method,
  destination_currency = null
) {
  try {
    console.log(`[VitawalletPricing] Calculando monto final para:`, {
      amount,
      country,
      payment_method,
      destination_currency,
    });

    // Obtener precios
    const prices = await getPayinPrices(destination_currency);

    // DEBUG: Ver estructura de precios
    console.log(`[VitawalletPricing] Estructura de precios:`, Object.keys(prices).slice(0, 5));

    // Buscar el país en los precios (try multiple formats)
    const countryCode = country.toLowerCase();
    let countryPrices = prices[countryCode];

    // Si no encontró, intentar otros formatos
    if (!countryPrices) {
      // Buscar en 'co', 'CO', 'Co'
      const keys = Object.keys(prices);
      const matchingKey = keys.find(k => k.toLowerCase() === countryCode);
      if (matchingKey) {
        countryPrices = prices[matchingKey];
        console.log(`[VitawalletPricing] País encontrado con key: ${matchingKey}`);
      }
    }

    if (!countryPrices) {
      console.warn(`[VitawalletPricing] ⚠️ País no encontrado, usando precios mock`);
      // Retornar mock en lugar de fallar
      return {
        success: true,
        original_amount: amount,
        final_amount: amount,
        sell_price: 1.0,
        fixed_cost: 0,
        spread: 0,
        commission_percentage: 0,
        payment_method: payment_method,
        source: 'mock-pricing',
      };
    }

    // Si hay destinations, buscar por destination_currency
    let methodPricing = null;

    if (countryPrices.destinations) {
      // Estructura: { destinations: { USD: [...], COP: [...] } }
      const destCurrency = destination_currency || Object.keys(countryPrices.destinations)[0];
      const destMethods = countryPrices.destinations[destCurrency.toUpperCase()];

      if (!destMethods) {
        throw new Error(`Moneda destino no encontrada: ${destCurrency}`);
      }

      methodPricing = destMethods.find(
        m => m.payment_method.toUpperCase() === payment_method.toUpperCase()
      );
    }

    if (!methodPricing) {
      throw new Error(
        `Método de pago no encontrado: ${payment_method} para ${country}`
      );
    }

    // Calcular monto final
    const sellPrice = parseFloat(methodPricing.sell_price);
    const fixedCost = parseFloat(methodPricing.fixed_cost);
    const spread = parseFloat(methodPricing.spread);
    const spreadType = methodPricing.spread_type; // percentage

    const finalAmount = amount * sellPrice - fixedCost;
    const commission = spread; // En porcentaje

    console.log(`[VitawalletPricing] ✅ Cálculo realizado:`, {
      original_amount: amount,
      sell_price: sellPrice,
      fixed_cost: fixedCost,
      spread: `${spread}%`,
      final_amount: finalAmount,
    });

    return {
      success: true,
      original_amount: amount,
      final_amount: parseFloat(finalAmount.toFixed(2)),
      sell_price: sellPrice,
      fixed_cost: fixedCost,
      spread: spread,
      spread_type: spreadType,
      commission_percentage: commission,
      payment_method: payment_method,
      destination_currency: destination_currency || countryPrices.destination_currency,
    };

  } catch (error) {
    console.error(`[VitawalletPricing] Error calculando monto final:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Encuentra el valid_until más próximo en la estructura de precios
 * @param {Object} priceData - Datos de precios
 * @returns {string} Fecha ISO válida hasta
 */
function findEarliestValidUntil(priceData) {
  let earliest = new Date(Date.now() + 1000 * 60 * 60); // 1 hora por defecto

  function searchValidUntil(obj) {
    if (!obj || typeof obj !== 'object') return;

    if (obj.valid_until) {
      const date = new Date(obj.valid_until);
      if (date < earliest) {
        earliest = date;
      }
    }

    for (const key in obj) {
      searchValidUntil(obj[key]);
    }
  }

  searchValidUntil(priceData);
  return earliest.toISOString();
}

/**
 * Mock de precios para modo LOCAL
 */
function getMockPayinPrices() {
  return {
    co: {
      source_currency: 'cop',
      destinations: {
        USD: [
          {
            payment_method: 'PSE',
            sell_price: '0.00024',
            spread: '1.5',
            spread_type: 'percentage',
            fixed_cost: '0.5',
          },
          {
            payment_method: 'NEQUI',
            sell_price: '0.00023',
            spread: '2.0',
            spread_type: 'percentage',
            fixed_cost: '0.5',
          },
        ],
        COP: [
          {
            payment_method: 'PSE',
            sell_price: '1.0',
            spread: '1.5',
            spread_type: 'percentage',
            fixed_cost: '200',
          },
        ],
      },
    },
    ar: {
      source_currency: 'ars',
      destinations: {
        USD: [
          {
            payment_method: 'KHIPU',
            sell_price: '0.00095',
            spread: '2.0',
            spread_type: 'percentage',
            fixed_cost: '1.0',
          },
        ],
      },
    },
    cl: {
      source_currency: 'clp',
      destinations: {
        USD: [
          {
            payment_method: 'WEBPAY',
            sell_price: '0.001022',
            spread: '2.5',
            spread_type: 'percentage',
            fixed_cost: '3.0',
          },
        ],
      },
    },
    br: {
      source_currency: 'brl',
      destinations: {
        USD: [
          {
            payment_method: 'PIX',
            sell_price: '0.00095',
            spread: '1.5',
            spread_type: 'percentage',
            fixed_cost: '2.0',
          },
        ],
      },
    },
    mx: {
      source_currency: 'mxn',
      destinations: {
        USD: [
          {
            payment_method: 'BITSO',
            sell_price: '0.048',
            spread: '2.0',
            spread_type: 'percentage',
            fixed_cost: '5.0',
          },
        ],
      },
    },
  };
}

function getMockWithdrawalPrices() {
  return {
    prices: {
      attributes: {
        valid_until: new Date(Date.now() + 3600000).toISOString(),
      },
    },
  };
}

export default {
  getPayinPrices,
  getWithdrawalPrices,
  calculatePayinFinalAmount,
};
