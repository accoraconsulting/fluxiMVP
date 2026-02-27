import express from "express";
import { authRequired } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { execute } from "../config/crate.js";
import crypto from "crypto";

const router = express.Router();

// ✅ fluxiDocs y fluxiAdmin pueden acceder a estas rutas
router.use(authRequired);
router.use(requireRole("fluxiDocs", "fluxiAdmin"));

/* =========================================
   LISTAR TODOS LOS USUARIOS KYC
========================================= */
router.get("/users", async (req, res) => {
  try {
    const { status, search, limit = 50, offset = 0 } = req.query;

    let whereClause = "WHERE 1=1";
    const params = [];
    let paramIndex = 1;

    // Filtro por estado KYC
    if (status && status !== "all") {
      whereClause += ` AND u.kyc_status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Búsqueda por email o username
    if (search) {
      whereClause += ` AND (u.email ILIKE $${paramIndex} OR u.username ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Query principal
    const { rows } = await execute(
      `
      SELECT 
        u.id,
        u.email,
        u.username,
        u.role,
        u.kyc_status,
        u.status,
        u.created_at,
        p.first_name,
        p.last_name,
        p.phone,
        p.country,
        c.legal_name,
        c.trade_name,
        c.tax_id,
        ks.current_step,
        (
          SELECT COUNT(*)
          FROM doc.kyc_uploaded_document d
          WHERE d.user_id = u.id
        ) as total_documents,
        (
          SELECT COUNT(*)
          FROM doc.kyc_uploaded_document d
          WHERE d.user_id = u.id AND d.status = 'pending'
        ) as pending_documents
      FROM doc.users u
      LEFT JOIN doc.kyc_personal_data p ON p.user_id = u.id
      LEFT JOIN doc.kyc_company_profile c ON c.user_id = u.id
      LEFT JOIN doc.kyc_status ks ON ks.user_id = u.id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      [...params, parseInt(limit), parseInt(offset)]
    );

    // Total count para paginación
    const { rows: countRows } = await execute(
      `
      SELECT COUNT(*) as total
      FROM doc.users u
      ${whereClause}
      `,
      params
    );

    return res.json({
      users: rows,
      total: countRows[0]?.total || 0,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (err) {
    const timestamp = new Date().toLocaleTimeString('es-ES');
    console.error(`❌ [${timestamp}] GET USERS ERROR:`, err);
    return res.status(500).json({
      error: "USERS_FETCH_FAILED",
      detail: err.message
    });
  }
});

/* =========================================
   OBTENER DETALLE COMPLETO DE UN USUARIO
========================================= */
router.get("/users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Datos del usuario
    const { rows: userRows } = await execute(
      `
      SELECT 
        u.id,
        u.email,
        u.username,
        u.role,
        u.kyc_status,
        u.status,
        u.created_at,
        u.updated_at
      FROM doc.users u
      WHERE u.id = $1
      `,
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ error: "USER_NOT_FOUND" });
    }

    const user = userRows[0];

    // Datos personales
    const { rows: personalRows } = await execute(
      `
      SELECT *
      FROM doc.kyc_personal_data
      WHERE user_id = $1
      `,
      [userId]
    );

    // Datos de empresa
    const { rows: companyRows } = await execute(
      `
      SELECT *
      FROM doc.kyc_company_profile
      WHERE user_id = $1
      `,
      [userId]
    );

    // Estado KYC
    const { rows: statusRows } = await execute(
      `
      SELECT *
      FROM doc.kyc_status
      WHERE user_id = $1
      `,
      [userId]
    );

    // Documentos subidos
    const { rows: docsRows } = await execute(
      `
      SELECT 
        d.id,
        d.document_type_id,
        dt.code as document_type_code,
        dt.name as document_type_name,
        d.file_url,
        d.file_name,
        d.mime_type,
        d.file_size,
        d.status,
        d.rejection_reason,
        d.uploaded_at,
        d.reviewed_at
      FROM doc.kyc_uploaded_document d
      LEFT JOIN doc.kyc_document_type dt ON d.document_type_id = dt.id
      WHERE d.user_id = $1
      ORDER BY d.uploaded_at DESC
      `,
      [userId]
    );

    // Historial de auditoría
    const { rows: auditRows } = await execute(
      `
      SELECT *
      FROM doc.kyc_audit_log
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
      `,
      [userId]
    );

    return res.json({
      user,
      personal: personalRows[0] || null,
      company: companyRows[0] || null,
      kycStatus: statusRows[0] || null,
      documents: docsRows,
      auditLog: auditRows
    });

  } catch (err) {
    const timestamp = new Date().toLocaleTimeString('es-ES');
    console.error(`❌ [${timestamp}] GET USER DETAIL ERROR (User: ${userId}):`, err);
    return res.status(500).json({
      error: "USER_DETAIL_FETCH_FAILED",
      detail: err.message
    });
  }
});

/* =========================================
   APROBAR KYC COMPLETO
========================================= */
router.post("/users/:userId/approve", async (req, res) => {
  try {
    const { userId } = req.params;
    const reviewerId = req.user.id;
    const timestamp = new Date().toLocaleTimeString('es-ES');

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`⏰ [${timestamp}] ✅ KYC APPROVAL INITIATED`);
    console.log(`👤 User ID: ${userId}`);
    console.log(`🔍 Reviewer ID: ${reviewerId}`);

    // 1️⃣ UPSERT estado KYC (INSERT IF NOT EXISTS, ELSE UPDATE)
    try {
      await execute(
        `
        INSERT INTO doc.kyc_status (user_id, status, current_step, last_updated)
        VALUES ($1, 'approved', 'review', CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) DO UPDATE
        SET
          status = 'approved',
          current_step = 'review',
          last_updated = CURRENT_TIMESTAMP
        `,
        [userId]
      );
      console.log(`  ✅ KYC status UPSERTED`);
    } catch (err) {
      console.error(`  ❌ KYC status UPSERT failed:`, err.message);
      throw err;
    }

    // 2️⃣ Actualizar usuario
    try {
      await execute(
        `
        UPDATE doc.users
        SET
          kyc_status = 'approved',
          status = 'active',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        `,
        [userId]
      );
      console.log(`  ✅ User status updated`);
    } catch (err) {
      console.error(`  ❌ User update failed:`, err.message);
      throw err;
    }

    // 3️⃣ Aprobar todos los documentos pendientes
    try {
      const { rowCount } = await execute(
        `
        UPDATE doc.kyc_uploaded_document
        SET
          status = 'approved',
          reviewed_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND status = 'pending'
        `,
        [userId]
      );
      console.log(`  ✅ ${rowCount} documents approved`);
    } catch (err) {
      console.error(`  ❌ Document approval failed:`, err.message);
      throw err;
    }

    // 4️⃣ Auditoría
    try {
      await execute(
        `
        INSERT INTO doc.kyc_audit_log (
          id, user_id, action, entity, metadata, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, CURRENT_TIMESTAMP
        )
        `,
        [
          crypto.randomUUID(),
          userId,
          "KYC_APPROVED",
          "kyc_management",
          JSON.stringify({ reviewer_id: reviewerId })
        ]
      );
      console.log(`  ✅ Audit log created`);
    } catch (err) {
      console.error(`  ⚠️ Audit log failed (non-critical):`, err.message);
      // No throw - audit failure shouldn't block approval
    }

    console.log(`✅ KYC APPROVAL COMPLETE\n`);

    return res.json({
      success: true,
      message: "KYC aprobado correctamente"
    });

  } catch (err) {
    const timestamp = new Date().toLocaleTimeString('es-ES');
    console.error(`\n❌ [${timestamp}] KYC APPROVAL ERROR:`, err.message);
    console.error(`   Stack:`, err.stack);
    return res.status(500).json({
      error: "KYC_APPROVE_FAILED",
      detail: err.message
    });
  }
});

/* =========================================
   RECHAZAR KYC COMPLETO
========================================= */
router.post("/users/:userId/reject", async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const reviewerId = req.user.id;
    const timestamp = new Date().toLocaleTimeString('es-ES');

    if (!reason) {
      return res.status(400).json({ error: "REJECTION_REASON_REQUIRED" });
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`⏰ [${timestamp}] ❌ KYC REJECTION INITIATED`);
    console.log(`👤 User ID: ${userId}`);
    console.log(`📝 Reason: ${reason}`);

    // 1️⃣ UPSERT estado KYC
    try {
      await execute(
        `
        INSERT INTO doc.kyc_status (user_id, status, current_step, last_updated)
        VALUES ($1, 'rejected', 'review', CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) DO UPDATE
        SET
          status = 'rejected',
          current_step = 'review',
          last_updated = CURRENT_TIMESTAMP
        `,
        [userId]
      );
      console.log(`  ✅ KYC status UPSERTED`);
    } catch (err) {
      console.error(`  ❌ KYC status UPSERT failed:`, err.message);
      throw err;
    }

    // 2️⃣ Actualizar usuario
    try {
      await execute(
        `
        UPDATE doc.users
        SET
          kyc_status = 'rejected',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        `,
        [userId]
      );
      console.log(`  ✅ User status updated`);
    } catch (err) {
      console.error(`  ❌ User update failed:`, err.message);
      throw err;
    }

    // 3️⃣ Auditoría
    try {
      await execute(
        `
        INSERT INTO doc.kyc_audit_log (
          id, user_id, action, entity, metadata, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, CURRENT_TIMESTAMP
        )
        `,
        [
          crypto.randomUUID(),
          userId,
          "KYC_REJECTED",
          "kyc_management",
          JSON.stringify({ reviewer_id: reviewerId, reason })
        ]
      );
      console.log(`  ✅ Audit log created`);
    } catch (err) {
      console.error(`  ⚠️ Audit log failed (non-critical):`, err.message);
      // No throw - audit failure shouldn't block rejection
    }

    console.log(`✅ KYC REJECTION COMPLETE\n`);

    return res.json({
      success: true,
      message: "KYC rechazado"
    });

  } catch (err) {
    const timestamp = new Date().toLocaleTimeString('es-ES');
    console.error(`\n❌ [${timestamp}] KYC REJECTION ERROR:`, err.message);
    console.error(`   Stack:`, err.stack);
    return res.status(500).json({
      error: "KYC_REJECT_FAILED",
      detail: err.message
    });
  }
});

/* =========================================
   APROBAR/RECHAZAR DOCUMENTO INDIVIDUAL
========================================= */
router.patch("/documents/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;
    const { status, rejection_reason } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "INVALID_STATUS" });
    }

    if (status === "rejected" && !rejection_reason) {
      return res.status(400).json({ error: "REJECTION_REASON_REQUIRED" });
    }

    await execute(
      `
      UPDATE doc.kyc_uploaded_document
      SET 
        status = $1,
        rejection_reason = $2,
        reviewed_at = CURRENT_TIMESTAMP
      WHERE id = $3
      `,
      [status, rejection_reason || null, documentId]
    );

    return res.json({
      success: true,
      message: `Documento ${status === "approved" ? "aprobado" : "rechazado"}`
    });

  } catch (err) {
    const timestamp = new Date().toLocaleTimeString('es-ES');
    console.error(`❌ [${timestamp}] UPDATE DOCUMENT ERROR (Doc: ${documentId}):`, err);
    return res.status(500).json({
      error: "DOCUMENT_UPDATE_FAILED",
      detail: err.message
    });
  }
});

export default router;