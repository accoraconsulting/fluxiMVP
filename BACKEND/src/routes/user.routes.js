import express from "express";
import { authRequired } from "../middlewares/auth.middleware.js";
import { execute } from "../config/crate.js";
import { updateUsername } from "../controllers/user.controller.js";

const router = express.Router();

/* =========================================
   OBTENER PERFIL COMPLETO DEL USUARIO
========================================= */
router.get("/profile", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;

    if (!userId) {
      return res.status(401).json({ error: "INVALID_SESSION" });
    }

    // 1. Datos básicos del usuario
    const { rows: userRows } = await execute(
      `
      SELECT 
        id,
        email,
        username,
        role,
        kyc_status,
        status,
        created_at
      FROM doc.users
      WHERE id = $1
      `,
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ error: "USER_NOT_FOUND" });
    }

    const user = userRows[0];

    // 2. Datos personales KYC
    const { rows: personalRows } = await execute(
      `
      SELECT 
        first_name,
        last_name,
        date_of_birth,
        nationality,
        country,
        document_type,
        document_number,
        document_expiration_date,
        email AS personal_email,
        phone,
        country_code,
        role_in_company,
        position_in_company
      FROM doc.kyc_personal_data
      WHERE user_id = $1
      `,
      [userId]
    );

    const personal = personalRows.length > 0 ? personalRows[0] : null;

    // 3. Datos de la empresa KYC
    const { rows: companyRows } = await execute(
      `
      SELECT 
        legal_name,
        trade_name,
        incorporation_country,
        incorporation_date,
        tax_id,
        tax_id_type,
        tax_country,
        commercial_registry,
        economic_activity,
        industry_code,
        business_address,
        city,
        country,
        country_code,
        postal_code,
        corporate_email,
        corporate_phone,
        operating_currency,
        monthly_tx_volume,
        status AS company_status,
        risk_level
      FROM doc.kyc_company_profile
      WHERE user_id = $1
      `,
      [userId]
    );

    const company = companyRows.length > 0 ? companyRows[0] : null;

    // 4. Respuesta completa
    return res.json({
      user,
      personal,
      company
    });

  } catch (err) {
    console.error("GET PROFILE ERROR:", err);
    return res.status(500).json({
      error: "PROFILE_FETCH_FAILED",
      detail: err.message
    });
  }
});

/* =========================================
   ACTUALIZAR USERNAME
========================================= */
router.post("/username", authRequired, updateUsername);

/* =========================================
   LISTAR USUARIOS (Solo para admin)
   Usado por el formulario de crear payins
========================================= */
router.get("/list", authRequired, async (req, res) => {
  try {
    const userRole = req.user?.role;

    // Solo admins pueden listar usuarios
    if (userRole !== 'fluxiAdmin') {
      return res.status(403).json({
        success: false,
        error: 'Solo administradores pueden listar usuarios',
      });
    }

    console.log('[UserRoutes] Listando usuarios para admin...');

    const { rows } = await execute(
      `SELECT
        id,
        username,
        email,
        role,
        kyc_status,
        status,
        created_at
      FROM doc.users
      WHERE role = 'fluxiUser'
      ORDER BY username ASC
      LIMIT 200`
    );

    console.log(`[UserRoutes] ✅ ${rows.length} usuarios encontrados`);

    res.json({
      success: true,
      users: rows,
      count: rows.length,
    });

  } catch (error) {
    console.error('[UserRoutes] Error listando usuarios:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error listando usuarios',
    });
  }
});

export default router;