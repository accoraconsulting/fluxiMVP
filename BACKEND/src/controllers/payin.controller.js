/**
 * PAYIN CONTROLLER
 * Endpoints REST para manejo de payins (pagos entrantes)
 */

import { payinService, paymentMethodsService } from '../services/vitawallet/index.js';
import { calculatePayinFinalAmount } from '../services/vitawallet/vitawallet.pricing.service.js';
import { getUserWallet, hasSufficientBalance } from '../services/wallet.balance.service.js';
import client from '../services/vitawallet/vitawallet.client.js';
import { execute } from '../config/crate.js';
import crypto from 'crypto';

/**
 * GET /api/payment-links/methods/:country
 * Obtener métodos de pago disponibles para un país
 */
export async function getPaymentMethods(req, res) {
  try {
    const { country } = req.params;

    if (!country) {
      return res.status(400).json({
        success: false,
        error: 'El parámetro "country" es requerido',
      });
    }

    console.log(`[PayinController] Obteniendo métodos para ${country}`);

    const result = await paymentMethodsService.getPaymentMethods(country);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        code: result.code,
      });
    }

    res.json({
      success: true,
      country: result.country,
      methods: result.methods.map(method => ({
        id: method.method_id || method.id,
        name: method.name,
        description: method.description,
        requiredFields: method.required_fields || [],
      })),
      count: result.methods.length,
    });
  } catch (error) {
    console.error('[PayinController] Error en getPaymentMethods:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo métodos de pago',
    });
  }
}

/**
 * POST /api/payment-links/generate
 * Generar un link de pago (payin)
 *
 * Body: {
 *   amount: number,
 *   currency: string (USD, COP, EUR),
 *   country: string (CO, AR, CL, BR, MX),
 *   description?: string,
 *   client_id?: string,
 *   user_id?: string (OPCIONAL: si es admin y quiere crear payin para otro usuario),
 *   metadata?: object
 * }
 */
export async function generatePaymentLink(req, res) {
  try {
    console.log('[PayinController] generatePaymentLink - Iniciando...');
    console.log('[PayinController] req.user:', req.user);
    console.log('[PayinController] req.user?.id:', req.user?.id);
    console.log('[PayinController] req.user?.email:', req.user?.email);
    console.log('[PayinController] req.body:', req.body);

    const currentUserId = req.user?.id;
    const userRole = req.user?.role;
    const { amount, currency, country, description, client_id, metadata, user_id: targetUserId } = req.body;

    // Determinar el usuario para el que se crea el payin
    let userId = currentUserId;
    let userEmail = req.user?.email;

    // Si se especifica un user_id y el usuario es admin, usar ese
    if (targetUserId && (userRole === 'fluxiAdmin' || userRole === 'fluxiDev')) {
      console.log(`[PayinController] Admin creando payin para user: ${targetUserId}`);
      // Obtener datos del usuario target
      try {
        const { rows } = await execute('SELECT id, email FROM doc.users WHERE id = $1', [targetUserId]);
        if (rows.length === 0) {
          return res.status(400).json({
            success: false,
            error: `Usuario ${targetUserId} no encontrado`,
          });
        }
        userId = targetUserId;
        userEmail = rows[0].email;
      } catch (userError) {
        console.error('[PayinController] Error buscando usuario:', userError);
        return res.status(500).json({
          success: false,
          error: 'Error al buscar usuario',
        });
      }
    }

    // Validar datos requeridos
    if (!amount || !currency || !country) {
      console.warn('[PayinController] ⚠️ Datos requeridos faltantes');
      return res.status(400).json({
        success: false,
        error: 'Campos requeridos faltantes: amount, currency, country',
      });
    }

    if (!userId || !userEmail) {
      console.error('[PayinController] ❌ Usuario no autenticado - userId:', userId, 'userEmail:', userEmail);
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado',
        debug: { userId, userEmail, hasUser: !!req.user },
      });
    }

    // 📝 NOTA: No validar saldo en PAYIN (es pago entrante, usuario RECIBE dinero)
    // El usuario puede crear payins sin tener fondos

    console.log(`[PayinController] Generando link de pago...`);
    console.log(`  Usuario: ${userId}`);
    console.log(`  Monto: ${amount} ${currency}`);
    console.log(`  País: ${country}`);

    // Crear payin
    const result = await payinService.createPayin({
      user_id: userId,
      user_email: userEmail,
      amount: parseFloat(amount),
      currency: currency.toUpperCase(),
      country: country.toUpperCase(),
      description: description || `Payment for ${client_id || 'FLUXI'}`,
      client_id: client_id || 'FLUXI',
      metadata: metadata || {},
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        details: result.details,
      });
    }

    // 🔥 GUARDAR EN BASE DE DATOS
    console.log('[PayinController] Guardando payin en BD...');

    try {
      const { rows } = await execute(
        `INSERT INTO doc.payin_requests
         (id, user_id, amount, currency, country, payment_method, status, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         RETURNING *`,
        [
          result.payin_id,          // id
          userId,                   // user_id
          result.amount,            // amount
          result.currency,          // currency
          result.country,           // country
          'vitawallet',             // payment_method
          'pending',                // status
          userId,                   // created_by
        ]
      );

      console.log('[PayinController] ✅ Payin guardado en BD:', rows[0]?.id);

      // Calcular comisión real
    let commissionData = null;
    try {
      commissionData = await calculatePayinFinalAmount(
        amount,
        country,
        'general', // método general para esta etapa
        currency
      );
      console.log('[PayinController] Comisión calculada:', commissionData);
    } catch (commError) {
      console.warn('[PayinController] No se pudo calcular comisión:', commError.message);
    }

    res.json({
      success: true,
      payin_id: result.payin_id,
      payment_order_id: result.payment_order_id,
      public_code: result.public_code,
      amount: result.amount,
      currency: result.currency,
      country: result.country,
      status: result.status,
      created_at: result.created_at,
      payin_url: result.payment_url || `https://www.vitawallet.io/checkout?id=${result.payment_order_id}&public_code=${result.public_code}`,
      source: result.source,
      // Información de comisión
      commission: commissionData?.commission_percentage || 0,
      final_amount: commissionData?.final_amount || result.amount,
    });
    } catch (dbError) {
      console.error('[PayinController] ❌ Error guardando en BD:', dbError);
      return res.status(500).json({
        success: false,
        error: 'Error al guardar el payin en la base de datos',
        details: dbError.message,
      });
    }
  } catch (error) {
    console.error('[PayinController] Error en generatePaymentLink:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error generando link de pago',
    });
  }
}

/**
 * GET /api/payment-links/:payin_id
 * Obtener estado de un payin
 */
export async function getPayinStatus(req, res) {
  try {
    const { payin_id } = req.params;

    if (!payin_id) {
      return res.status(400).json({
        success: false,
        error: 'El parámetro "payin_id" es requerido',
      });
    }

    console.log(`[PayinController] Obteniendo estado de payin: ${payin_id}`);

    // En una fase futura, esto consultará la BD para obtener el payment_order_id
    // Por ahora, retornamos un estado simulado
    res.json({
      success: true,
      payin_id: payin_id,
      status: 'pending',
      message: 'Para obtener el estado real, integrar con BD en próxima fase',
    });
  } catch (error) {
    console.error('[PayinController] Error en getPayinStatus:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo estado del payin',
    });
  }
}

/**
 * POST /api/payment-links/validate
 * Validar datos de pago antes de procesarlos
 *
 * Body: {
 *   country: string,
 *   payment_method: string,
 *   payment_data: object
 * }
 */
export async function validatePaymentData(req, res) {
  try {
    const { country, payment_method, payment_data } = req.body;

    if (!country || !payment_method) {
      return res.status(400).json({
        success: false,
        error: 'Campos requeridos faltantes: country, payment_method',
      });
    }

    console.log(`[PayinController] Validando datos de pago...`);

    // Validar que el método sea válido
    const isValidMethod = paymentMethodsService.isValidPaymentMethod(
      country,
      payment_method
    );

    if (!isValidMethod) {
      return res.status(400).json({
        success: false,
        error: `Método ${payment_method} no disponible en ${country}`,
      });
    }

    // Obtener campos requeridos
    const fieldsResult = await paymentMethodsService.getRequiredFields(
      country,
      payment_method
    );

    res.json({
      success: true,
      country: country.toUpperCase(),
      payment_method: payment_method.toUpperCase(),
      is_valid: true,
      required_fields: fieldsResult.fields,
    });
  } catch (error) {
    console.error('[PayinController] Error en validatePaymentData:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error validando datos de pago',
    });
  }
}

/**
 * GET /api/payment-links/prices/:country
 * Obtener información de precios/comisiones por país
 */
export async function getPayinPrices(req, res) {
  try {
    const { country } = req.params;

    if (!country) {
      return res.status(400).json({
        success: false,
        error: 'El parámetro "country" es requerido',
      });
    }

    console.log(`[PayinController] Obteniendo precios para ${country}`);

    const result = await payinService.getPayinPrices(country);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    res.json({
      success: true,
      country: country.toUpperCase(),
      prices: result.prices,
    });
  } catch (error) {
    console.error('[PayinController] Error en getPayinPrices:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo precios',
    });
  }
}

/**
 * GET /api/payment-links/test
 * Endpoint de debugging - Mostrar configuración de Vitawallet
 */
export async function testVitawalletConfig(req, res) {
  try {
    const env = client.getEnvironment();

    res.json({
      success: true,
      vitawallet_config: env,
      node_env: process.env.NODE_ENV || 'development',
      debug_enabled: process.env.VITAWALLET_DEBUG === 'true',
    });
  } catch (error) {
    console.error('[PayinController] Error en testVitawalletConfig:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo configuración',
    });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// PAYIN REQUESTS - CRUD para solicitudes de payins
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/payin-requests
 * Listar solicitudes de payins
 *
 * Query params:
 *   - status: Filtrar por estado (pending, approved, rejected, completed, expired)
 *   - limit: Límite de resultados (default 50)
 *   - page: Página (default 1)
 *
 * Si el usuario es fluxiAdmin: ve TODOS los payins
 * Si es usuario normal: solo ve los payins asignados a él
 */
export async function getPayinRequests(req, res) {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const { status, limit = 50, page = 1 } = req.query;

    console.log(`[PayinController] Listando payins - User: ${userId}, Role: ${userRole}, Status: ${status || 'todos'}`);

    // Construir query según rol
    let query = '';
    let params = [];
    let paramIndex = 1;

    if (userRole === 'fluxiAdmin') {
      // Admin ve todos los payins
      query = `
        SELECT
          pr.id,
          pr.user_id,
          pr.created_by,
          pr.amount,
          pr.currency,
          pr.country,
          pr.payment_method,
          pr.status,
          pr.description,
          pr.payin_link_id,
          pr.created_at,
          pr.updated_at,
          u.username AS user_name,
          u.email AS user_email
        FROM doc.payin_requests pr
        LEFT JOIN doc.users u ON pr.user_id = u.id
      `;
    } else {
      // Usuario normal solo ve sus payins
      query = `
        SELECT
          pr.id,
          pr.user_id,
          pr.created_by,
          pr.amount,
          pr.currency,
          pr.country,
          pr.payment_method,
          pr.status,
          pr.description,
          pr.payin_link_id,
          pr.created_at,
          pr.updated_at,
          pl.payin_url,
          pl.public_code
        FROM doc.payin_requests pr
        LEFT JOIN doc.payin_links pl ON pr.payin_link_id = pl.id
        WHERE pr.user_id = $${paramIndex} AND pr.payin_link_id IS NOT NULL
      `;
      params.push(userId);
      paramIndex++;
    }

    // Filtro por status
    if (status) {
      if (userRole === 'fluxiAdmin') {
        query += ` WHERE pr.status = $${paramIndex}`;
      } else {
        query += ` AND pr.status = $${paramIndex}`;
      }
      params.push(status);
      paramIndex++;
    }

    // Ordenar y limitar
    query += ` ORDER BY pr.created_at DESC`;
    query += ` LIMIT $${paramIndex}`;
    params.push(parseInt(limit));
    paramIndex++;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    if (offset > 0) {
      query += ` OFFSET $${paramIndex}`;
      params.push(offset);
    }

    const { rows } = await execute(query, params);

    console.log(`[PayinController] ✅ ${rows.length} payins encontrados`);

    res.json({
      success: true,
      payins: rows,
      count: rows.length,
      page: parseInt(page),
      limit: parseInt(limit),
    });

  } catch (error) {
    console.error('[PayinController] Error en getPayinRequests:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error listando payins',
    });
  }
}

/**
 * PATCH /api/payin-requests/:id/approve
 * Aprobar un payin pendiente
 *
 * Al aprobar:
 * 1. Cambia status a 'approved'
 * 2. Genera link de pago en Vitawallet
 * 3. Guarda link en doc.payin_links
 * 4. Actualiza payin_request con el payin_link_id
 */
export async function approvePayinRequest(req, res) {
  try {
    const { id } = req.params;
    const adminId = req.user?.id;
    const adminRole = req.user?.role;

    // Solo admins pueden aprobar
    if (adminRole !== 'fluxiAdmin') {
      return res.status(403).json({
        success: false,
        error: 'Solo administradores pueden aprobar payins',
      });
    }

    console.log(`[PayinController] Aprobando payin ${id} por admin ${adminId}`);

    // 1. Obtener payin actual CON datos del usuario
    const { rows: payinRows } = await execute(
      `SELECT pr.*, u.email FROM doc.payin_requests pr
       LEFT JOIN doc.users u ON pr.user_id = u.id
       WHERE pr.id = $1`,
      [id]
    );

    if (payinRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Payin no encontrado',
      });
    }

    const payin = payinRows[0];

    if (payin.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `No se puede aprobar un payin con estado "${payin.status}"`,
      });
    }

    // 2. Intentar generar link en Vitawallet
    let vitawalletResult = null;
    let payinUrl = null;
    let publicCode = null;
    let vitawalletPayinId = null;

    try {
      vitawalletResult = await payinService.createPayin({
        user_id: payin.user_id,
        user_email: payin.email || payin.user_id, // email real del usuario
        amount: payin.amount,
        currency: payin.currency,
        country: payin.country,
        description: payin.description || 'Pago FLUXI',
        client_id: 'FLUXI',
        metadata: { payin_request_id: id },
      });

      if (vitawalletResult.success) {
        publicCode = vitawalletResult.public_code;
        vitawalletPayinId = vitawalletResult.payin_id || vitawalletResult.payment_order_id;
        payinUrl = vitawalletResult.payment_url || `https://www.vitawallet.io/checkout?id=${vitawalletResult.payment_order_id}&public_code=${publicCode}`;
        console.log(`[PayinController] ✅ Link Vitawallet generado: ${payinUrl}`);
      } else {
        console.warn(`[PayinController] ⚠️ Vitawallet falló, aprobando sin link:`, vitawalletResult.error);
      }
    } catch (vitaError) {
      console.warn(`[PayinController] ⚠️ Error Vitawallet (aprobando de todos modos):`, vitaError.message);
    }

    // 3. Actualizar estado a 'approved'
    await execute(
      `UPDATE doc.payin_requests SET status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );

    // 4. Si se generó link, guardar en payin_links
    let payinLinkId = null;
    if (vitawalletPayinId || publicCode) {
      payinLinkId = crypto.randomUUID();
      await execute(
        `INSERT INTO doc.payin_links (id, payin_request_id, user_id, vitawallet_payin_id, payin_url, public_code, amount, currency, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', CURRENT_TIMESTAMP)`,
        [payinLinkId, id, payin.user_id, vitawalletPayinId || '', payinUrl || '', publicCode || '', payin.amount, payin.currency]
      );

      // Actualizar payin_request con link ID
      await execute(
        `UPDATE doc.payin_requests SET payin_link_id = $1 WHERE id = $2`,
        [payinLinkId, id]
      );
    }

    // Forzar refresh en CrateDB
    try {
      await execute(`REFRESH TABLE doc.payin_requests`);
      await execute(`REFRESH TABLE doc.payin_links`);
    } catch (e) { /* ignorar si falla */ }

    console.log(`[PayinController] ✅ Payin ${id} aprobado correctamente`);

    res.json({
      success: true,
      message: 'Payin aprobado correctamente',
      payin_id: id,
      payin_link_id: payinLinkId,
      status: 'approved',
      amount: payin.amount,
      currency: payin.currency,
      country: payin.country,
      payment_method: payin.payment_method,
      user_id: payin.user_id,
      payin_url: payinUrl,
      public_code: publicCode,
    });

  } catch (error) {
    console.error('[PayinController] Error en approvePayinRequest:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error aprobando payin',
    });
  }
}

/**
 * PATCH /api/payin-requests/:id/reject
 * Rechazar un payin pendiente
 *
 * Al rechazar:
 * 1. Cambia status a 'rejected'
 * 2. Guarda razón del rechazo (opcional)
 */
export async function rejectPayinRequest(req, res) {
  try {
    const { id } = req.params;
    const adminId = req.user?.id;
    const adminRole = req.user?.role;
    const { razon } = req.body;

    // Solo admins pueden rechazar
    if (adminRole !== 'fluxiAdmin') {
      return res.status(403).json({
        success: false,
        error: 'Solo administradores pueden rechazar payins',
      });
    }

    console.log(`[PayinController] Rechazando payin ${id} por admin ${adminId}`);

    // 1. Obtener payin actual
    const { rows: payinRows } = await execute(
      `SELECT * FROM doc.payin_requests WHERE id = $1`,
      [id]
    );

    if (payinRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Payin no encontrado',
      });
    }

    const payin = payinRows[0];

    if (payin.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `No se puede rechazar un payin con estado "${payin.status}"`,
      });
    }

    // 2. Actualizar estado a 'rejected'
    await execute(
      `UPDATE doc.payin_requests SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );

    // Forzar refresh en CrateDB
    try {
      await execute(`REFRESH TABLE doc.payin_requests`);
    } catch (e) { /* ignorar si falla */ }

    console.log(`[PayinController] ✅ Payin ${id} rechazado correctamente`);

    res.json({
      success: true,
      message: 'Payin rechazado correctamente',
      payin_id: id,
      status: 'rejected',
      razon: razon || null,
    });

  } catch (error) {
    console.error('[PayinController] Error en rejectPayinRequest:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error rechazando payin',
    });
  }
}

/**
 * GET /api/payin-events
 * Obtener últimos eventos/cambios de payins (para real-time)
 *
 * Query params:
 *   - last: Últimos N eventos (default 20)
 *
 * Retorna los payins más recientes con sus estados actuales
 * El frontend compara con caché local para detectar cambios
 */
export async function getPayinEvents(req, res) {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const { last = 20 } = req.query;

    // Obtener eventos recientes (payins con sus estados actuales)
    let query = '';
    let params = [];

    if (userRole === 'fluxiAdmin') {
      // Admin ve todos los eventos
      query = `
        SELECT
          pr.id AS payin_id,
          pr.user_id,
          pr.amount,
          pr.currency,
          pr.status,
          pr.updated_at,
          pr.created_at,
          u.username AS user_name
        FROM doc.payin_requests pr
        LEFT JOIN doc.users u ON pr.user_id = u.id
        ORDER BY pr.updated_at DESC
        LIMIT $1
      `;
      params = [parseInt(last)];
    } else {
      // Usuario solo ve sus eventos
      query = `
        SELECT
          pr.id AS payin_id,
          pr.user_id,
          pr.amount,
          pr.currency,
          pr.status,
          pr.updated_at,
          pr.created_at
        FROM doc.payin_requests pr
        WHERE pr.user_id = $1
        ORDER BY pr.updated_at DESC
        LIMIT $2
      `;
      params = [userId, parseInt(last)];
    }

    const { rows } = await execute(query, params);

    res.json({
      success: true,
      events: rows,
      count: rows.length,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[PayinController] Error en getPayinEvents:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error obteniendo eventos',
    });
  }
}
