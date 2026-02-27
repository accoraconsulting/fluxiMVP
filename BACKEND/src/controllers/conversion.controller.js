import { executeConversion, calculateConversionPreview } from '../services/conversion.service.js';

/**
 * POST /api/wallet/convert/preview
 * SOLO CALCULAR la conversión (sin ejecutar)
 * Retorna: tasa, comisión, monto convertido, total a debitar
 */
export async function previewConversion(req, res) {
  try {
    const userId = req.user.id;
    const { fromCurrency, toCurrency, amount } = req.body;

    console.log('[ConversionController] Preview:', { userId, fromCurrency, toCurrency, amount });

    if (!fromCurrency || !toCurrency || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Faltan parámetros requeridos'
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'El monto debe ser mayor a 0'
      });
    }

    if (fromCurrency === toCurrency) {
      return res.status(400).json({
        success: false,
        error: 'No puedes convertir a la misma moneda'
      });
    }

    // Calcular preview (SIN ejecutar)
    const preview = await calculateConversionPreview(userId, fromCurrency, toCurrency, amount);

    res.json({
      success: true,
      data: preview
    });

  } catch (error) {
    console.error('[ConversionController] Error en preview:', error);

    res.status(error.message.includes('Saldo insuficiente') ? 400 : 500).json({
      success: false,
      error: error.message || 'Error calculando conversión'
    });
  }
}

/**
 * POST /api/wallet/convert
 * Convertir entre dos wallets del usuario
 */
export async function convertCurrency(req, res) {
  try {
    const userId = req.user.id;
    const { fromCurrency, toCurrency, amount } = req.body;

    console.log('[ConversionController] Convertir:', { userId, fromCurrency, toCurrency, amount });

    // Validaciones
    if (!fromCurrency || !toCurrency || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Faltan parámetros requeridos'
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'El monto debe ser mayor a 0'
      });
    }

    if (fromCurrency === toCurrency) {
      return res.status(400).json({
        success: false,
        error: 'No puedes convertir a la misma moneda'
      });
    }

    // Ejecutar conversión
    const result = await executeConversion(userId, fromCurrency, toCurrency, amount);

    res.json({
      success: true,
      message: 'Conversión exitosa',
      data: result
    });

  } catch (error) {
    console.error('[ConversionController] Error:', error);
    
    res.status(error.message.includes('Saldo insuficiente') ? 400 : 500).json({
      success: false,
      error: error.message || 'Error en la conversión'
    });
  }
}