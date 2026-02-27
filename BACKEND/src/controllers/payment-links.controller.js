/**
 * PAYMENT LINKS CONTROLLER
 * Maneja la creación y gestión de links de pago (Vita Wallet)
 */

import { payinService, paymentMethodsService, vitawalletQueries, vitawalletPricingService } from '../services/vitawallet/index.js';
import { randomUUID } from 'crypto';

/**
 * POST /api/payment-links/generate
 * Crea un nuevo link de pago en Vita Wallet
 */
export async function generatePaymentLink(req, res) {
  try {
    const userId = req.user?.id;
    const userEmail = req.user?.email;
    const { amount, currency, country, payment_method, description, metadata } = req.body;

    // Validación básica
    if (!userId || !userEmail) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado',
      });
    }

    if (!amount || !currency || !country || !payment_method) {
      return res.status(400).json({
        success: false,
        error: 'Campos requeridos: amount, currency, country, payment_method',
      });
    }

    console.log(`\n[PaymentLinksController] 🔗 Creando link de pago...`);
    console.log(`  Usuario: ${userId}`);
    console.log(`  Monto: ${amount} ${currency}`);
    console.log(`  País: ${country}`);
    console.log(`  Método: ${payment_method}`);

    // ═════════════════════════════════════════════════════════════
    // STEP 1: Crear payin en Vita Wallet
    // ═════════════════════════════════════════════════════════════

    const payinResult = await payinService.createPayin({
      user_id: userId,
      user_email: userEmail,
      amount: parseFloat(amount),
      currency: currency.toUpperCase(),
      country: country.toUpperCase(),
      description: description || `Payment link - ${amount} ${currency}`,
      client_id: 'FLUXI-USER',
      metadata: metadata || {},
    });

    if (!payinResult.success) {
      console.error(`[PaymentLinksController] ❌ Error creando payin:`, payinResult.error);
      return res.status(400).json({
        success: false,
        error: payinResult.error || 'Error creating payment link',
      });
    }

    const payin_id = payinResult.payin_id;
    const payment_order_id = payinResult.payment_order_id;
    const payment_url = payinResult.payment_url;

    console.log(`[PaymentLinksController] ✅ Payin creado: ${payin_id}`);

    // ═════════════════════════════════════════════════════════════
    // STEP 2: Calcular comisiones y monto final
    // ═════════════════════════════════════════════════════════════

    const pricingResult = await vitawalletPricingService.calculatePayinFinalAmount(
      amount,
      country,
      payment_method,
      currency
    );

    let commission = 0;
    let final_amount = amount;

    if (pricingResult.success) {
      commission = pricingResult.commission_percentage;
      final_amount = pricingResult.final_amount;
      console.log(`[PaymentLinksController] 💰 Comisión: ${commission}%`);
      console.log(`[PaymentLinksController] 💸 Monto Final: ${final_amount}`);
    } else {
      console.warn(`[PaymentLinksController] ⚠️ No se pudo calcular comisión:`, pricingResult.error);
    }

    // ═════════════════════════════════════════════════════════════
    // STEP 3: Guardar en BD
    // ═════════════════════════════════════════════════════════════

    await vitawalletQueries.insertPayin({
      payin_id,
      payment_order_id,
      public_code: payinResult.public_code,
      user_id: userId,
      user_email: userEmail,
      amount: parseFloat(amount),
      currency: currency.toUpperCase(),
      country: country.toUpperCase(),
      client_id: 'FLUXI-USER',
      description: description || `Payment link - ${amount} ${currency}`,
      metadata: {
        ...metadata,
        payment_method,
        commission,
        final_amount,
        source: payinResult.source,
      },
    });

    console.log(`[PaymentLinksController] ✅ Link guardado en BD`);

    // ═════════════════════════════════════════════════════════════
    // RESPONSE
    // ═════════════════════════════════════════════════════════════

    return res.status(201).json({
      success: true,
      payin_id,
      payment_order_id,
      payin_url: payment_url,
      amount: parseFloat(amount),
      currency: currency.toUpperCase(),
      country: country.toUpperCase(),
      payment_method,
      commission,
      final_amount,
      status: 'pending',
      created_at: new Date().toISOString(),
      message: 'Payment link created successfully',
    });
  } catch (error) {
    console.error(`[PaymentLinksController] ❌ Error:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error creating payment link',
    });
  }
}

/**
 * POST /api/payment-links/validate
 * Valida los datos antes de crear un payin
 */
export async function validatePaymentLink(req, res) {
  try {
    const { amount, currency, country, payment_method } = req.body;

    // Validación básica
    if (!amount || !currency || !country || !payment_method) {
      return res.status(400).json({
        success: false,
        error: 'Campos requeridos: amount, currency, country, payment_method',
      });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be a positive number',
      });
    }

    console.log(`[PaymentLinksController] 🔍 Validando payin...`);

    // Intentar calcular comisión (validación indirecta)
    const pricingResult = await vitawalletPricingService.calculatePayinFinalAmount(
      amount,
      country,
      payment_method,
      currency
    );

    if (!pricingResult.success) {
      return res.status(400).json({
        success: false,
        error: pricingResult.error || 'Invalid payment data',
      });
    }

    console.log(`[PaymentLinksController] ✅ Validación exitosa`);

    return res.json({
      success: true,
      valid: true,
      commission: pricingResult.commission_percentage,
      final_amount: pricingResult.final_amount,
      message: 'Payment data is valid',
    });
  } catch (error) {
    console.error(`[PaymentLinksController] ❌ Error validating:`, error.message);
    return res.status(400).json({
      success: false,
      valid: false,
      error: error.message,
    });
  }
}

/**
 * GET /api/payment-links/methods/:country
 * Obtiene métodos de pago disponibles para un país
 */
export async function getPaymentMethods(req, res) {
  try {
    const { country } = req.params;

    if (!country) {
      return res.status(400).json({
        success: false,
        error: 'Country code required',
      });
    }

    console.log(`[PaymentLinksController] 📋 Obteniendo métodos para ${country}...`);

    const result = await paymentMethodsService.getPaymentMethods(country);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error(`[PaymentLinksController] ❌ Error:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * GET /api/payment-links/prices/:country
 * Obtiene precios y comisiones para un país
 */
export async function getPaymentPrices(req, res) {
  try {
    const { country } = req.params;

    if (!country) {
      return res.status(400).json({
        success: false,
        error: 'Country code required',
      });
    }

    console.log(`[PaymentLinksController] 💰 Obteniendo precios para ${country}...`);

    const result = await payinService.getPayinPrices(country);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error(`[PaymentLinksController] ❌ Error:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

export default {
  generatePaymentLink,
  validatePaymentLink,
  getPaymentMethods,
  getPaymentPrices,
};
