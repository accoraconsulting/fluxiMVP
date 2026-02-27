import express from "express";
import multer from "multer";
import { authRequired } from "../middlewares/auth.middleware.js";
import {
  createPersonalKyc,
  createCompanyKyc,
  setKycStatus,
  getKycStatus,
  submitKyc,
  KYC_STATUS, 
  KYC_STEP
} from "../services/kyc.service.js";
import { uploadKycDocument } from "../services/kyc.documents.service.js";
import { saveKycIdentity } from "../services/kyc.identity.service.js";
import { execute } from "../config/crate.js";


const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const router = express.Router();
router.use(authRequired);



/* ===========================
   OBTENER ESTADO KYC
=========================== */
router.get("/status", async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "INVALID_SESSION" });
    }

    try {
      const status = await getKycStatus(userId);
      res.json(status);
    } catch (dbError) {
      console.warn("[KYC] DB error, using default status:", dbError.message);
      res.json({ status: "not_started", current_step: "personal" });
    }

  } catch (err) {
    console.error("KYC STATUS ERROR:", err);
    res.status(500).json({ error: "KYC_STATUS_FAILED" });
  }
});


/* ======================================================
   PERSONAL KYC
====================================================== */
router.post("/personal", async (req, res) => {
  try {
    const userId = req.user.id;
    const data = req.body;

    if (!userId) {
      return res.status(401).json({ error: "INVALID_SESSION" });
    }

    const result = await createPersonalKyc(userId, data);






    res.json(result);
  } catch (err) {
    console.error("PERSONAL KYC ERROR:", err);
    res.status(500).json({ error: "PERSONAL_KYC_FAILED", detail: err.message });
  }
});


/* ======================================================
   COMPANY KYC
====================================================== */
router.post("/company", async (req, res) => {
  try {
    const userId = req.user.id;
    const data = req.body;

    if (!userId) {
      return res.status(401).json({ error: "INVALID_SESSION" });
    }

    const result = await createCompanyKyc(userId, data);

    

    res.json(result);
  } catch (err) {
    console.error("COMPANY KYC ERROR:", err);
    res.status(500).json({ error: "COMPANY_KYC_FAILED", detail: err.message });
  }

 

});
/* =========================================
   OBTENER DOCUMENTOS SUBIDOS DEL USUARIO
========================================= */
router.get("/documents", authRequired, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "INVALID_SESSION" });
    }

    // ✅ JOIN con kyc_document_type para traer el código
    const { rows } = await execute(
      `
      SELECT
        d.id,
        d.document_type_id,
        dt.code AS document_type_code,
        dt.name AS document_type_name,
        d.file_name,
        d.file_url,
        d.status,
        d.created_at
      FROM doc.kyc_uploaded_document d
      LEFT JOIN doc.kyc_document_type dt ON d.document_type_id = dt.id
      WHERE d.user_id = $1
      ORDER BY d.created_at DESC
      `,
      [userId]
    );

    console.log("[GET /documents] Documentos encontrados:", rows.length);
    console.log("[GET /documents] Datos:", rows);

    return res.json({
      documents: rows
    });

  } catch (err) {
    console.error("GET DOCUMENTS ERROR:", err);
    console.error("Error stack:", err.stack);
    return res.status(500).json({
      error: "DOCUMENTS_FETCH_FAILED",
      detail: err.message
    });
  }
});
/* =========================================
   SUBIR DOCUMENTO KYC (BINARIO)
========================================= */
router.post(
  "/documents",
  authRequired,  // ✅ Asegurar que esté aquí también
  upload.single("file"),
  async (req, res) => {
    try {
      const userId = req.user?.id;
      const { document_type_id } = req.body;

      console.log("DOCUMENT BODY:", req.body);
      console.log("DOCUMENT FILE:", req.file);

      // -------------------------
      // Validaciones básicas
      // -------------------------
      if (!userId) {
        return res.status(401).json({ error: "NO_AUTH_USER" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "FILE_REQUIRED" });
      }

      if (!document_type_id) {
        return res.status(400).json({ error: "DOCUMENT_TYPE_REQUIRED" });
      }

      // -------------------------
      // Resolver document type desde BD
      // -------------------------
      const { rows } = await execute(
        `
        SELECT id, code, name
        FROM doc.kyc_document_type
        WHERE code = $1
        LIMIT 1
        `,
        [document_type_id]
      );

      if (rows.length === 0) {
        return res.status(400).json({ error: "INVALID_DOCUMENT_TYPE" });
      }

      const documentType = rows[0];

      console.log("RESOLVED DOCUMENT TYPE:", documentType);

      // -------------------------
      // Subir documento
      // -------------------------
      const result = await uploadKycDocument({
        userId,
        documentType,
        file: req.file
      });

      // -------------------------
      // Persistir paso KYC
      // -------------------------
      await setKycStatus(userId, "in_progress", "documents");

      // -------------------------
      // Respuesta OK
      // -------------------------
      return res.json(result);

    } catch (err) {
      console.error("KYC DOCUMENT ERROR:", err);
      return res.status(500).json({
        error: err.message || "DOCUMENT_UPLOAD_FAILED"
      });
    }
  }
);

/* =========================================
   COMPLETAR PASO DE DOCUMENTOS
========================================= */
router.post("/documents/complete", authRequired, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "INVALID_SESSION" });
    }

    // Validar que existan documentos
    const { rows } = await execute(
      `
      SELECT COUNT(*) as total
      FROM doc.kyc_uploaded_document
      WHERE user_id = $1
        AND status IN ('pending', 'approved')
      `,
      [userId]
    );

    if (rows[0].total === 0) {
      return res.status(400).json({
        error: "NO_DOCUMENTS_FOUND"
      });
    }

    // ✅ AVANZAR PASO A IDENTITY
    await setKycStatus(
      userId,
      KYC_STATUS.IN_PROGRESS,
      'identity'  // ✅ Avanzar a selfie/identity
    );

    console.log(`✅ [DOCUMENTS COMPLETE] Usuario ${userId} avanzó a identity`);

    return res.json({
      success: true,
      next_step: 'identity'
    });

  } catch (err) {
    console.error("DOCUMENTS COMPLETE ERROR:", err);
    return res.status(500).json({
      error: "DOCUMENTS_COMPLETE_FAILED",
      detail: err.message
    });
  }
});


/* =========================================
   KYC IDENTITY (SELFIE + DOCUMENTOS BASE64)
========================================= */
router.post("/identity", authRequired, async (req, res) => {
  try {
    console.log("📥 IDENTITY BODY RAW:", req.body);

    const userId = req.user?.id;
    const {
      documentFront,
      documentBack,
      selfie,
      consentData,
      consentIdentity
    } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "INVALID_SESSION" });
    }

    // Validación fuerte
    if (
      !documentFront ||
      !documentBack ||
      !selfie ||
      consentData !== true ||
      consentIdentity !== true
    ) {
      return res.status(400).json({
        error: "INVALID_IDENTITY_PAYLOAD"
      });
    }

    const result = await saveKycIdentity({
      userId,
      documentFront,
      documentBack,
      selfie,
      consentData,
      consentIdentity
    });

    // 🔥 AVANZAR PASO KYC (CRÍTICO)
   // ✅ Solo avanzar si NO está ya en un estado posterior
const currentStatus = await getKycStatus(userId);

// Solo actualizar si está en un paso anterior a identity
if (currentStatus.current_step !== 'identity' && 
    currentStatus.status === KYC_STATUS.IN_PROGRESS) {
  await setKycStatus(userId, KYC_STATUS.IN_PROGRESS, 'identity');
}

// NO tocar el estado si ya está en pending/approved

    res.json(result);

  } catch (err) {
    console.error("KYC IDENTITY ERROR:", err);
    res.status(500).json({
      error: "KYC_IDENTITY_FAILED",
      detail: err.message
    });
  }
});



/* =========================================
   FINALIZAR KYC → ENVIAR A REVISIÓN
========================================= */

router.post("/submit", async (req, res) => {
  try {
    const userId = req.user.id;

    if (!userId) {
      return res.status(401).json({ error: "INVALID_SESSION" });
    }

    /* -----------------------------------------
       ✅ IDEMPOTENCIA: Si ya está enviado, retornar OK
    ------------------------------------------ */
    const currentStatus = await getKycStatus(userId);
    
    if (currentStatus.status === KYC_STATUS.PENDING || currentStatus.status === KYC_STATUS.APPROVED) {
      return res.json({
        status: currentStatus.status,
        step: currentStatus.current_step,
        message: "KYC ya fue enviado previamente"
      });
    }

    /* -----------------------------------------
       VALIDAR QUE EXISTAN DOCUMENTOS
       (se mantiene tu lógica)
    ------------------------------------------ */
    const { rows: docs } = await execute(
      `
      SELECT 1
      FROM doc.kyc_uploaded_document
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId]
    );

    if (docs.length === 0) {
      return res.status(400).json({
        error: "KYC_INCOMPLETE",
        message: "No se encontraron documentos KYC"
      });
    }

    /* -----------------------------------------
       🔥 FINAL REAL DEL KYC (SIN ROMPER NADA)
    ------------------------------------------ */
    const result = await submitKyc(userId);

    res.json({
      status: result.status,
      step: result.current_step, // ✅ Usar current_step en vez de step
      message: "KYC enviado correctamente para revisión"
    });

  } catch (err) {
    console.error("KYC SUBMIT ERROR:", err.message);

    res.status(400).json({
      error: err.message
    });
  }
});

export default router;