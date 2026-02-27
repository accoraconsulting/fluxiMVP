/**
 * ======================================================
 * KYC IDENTITY SERVICE
 * ======================================================
 * Responsabilidades:
 * - Procesar el paso IDENTITY del KYC
 * - Validar payload y consentimientos
 * - Subir documentos (selfie + ID) a Google Drive
 * - Persistir metadata de archivos en CrateDB
 * - Avanzar el estado del KYC al siguiente paso
 * - Registrar auditoría
 *
 * NOTA:
 * - Nunca se guardan archivos ni base64 en la DB
 * - Drive es la fuente del archivo, DB solo guarda metadata
 */

import crypto from "crypto";
import { execute } from "../config/crate.js";
import { uploadFile } from "./googleDrive.service.js";


/* ======================================================
   HELPERS
====================================================== */

/**
 * Convierte base64 (data:image/...) a Buffer
 */
function base64ToBuffer(base64) {
  const [, data] = base64.split(",");
  return Buffer.from(data, "base64");
}

/**
 * Extrae mimeType desde base64
 */
function extractMimeType(base64) {
  const match = base64.match(/^data:(.+);base64,/);
  return match ? match[1] : "image/jpeg";
}

/**
 * Genera ID único
 */
function uuid() {
  return crypto.randomUUID();
}

/**
 * Resuelve document_type_id a partir del code
 */
async function resolveDocumentTypeId(code) {
  const { rows } = await execute(
    `
    SELECT id
    FROM doc.kyc_document_type
    WHERE code = $1
    `,
    [code]
  );

  if (rows.length === 0) {
    throw new Error(`INVALID_DOCUMENT_TYPE: ${code}`);
  }

  return rows[0].id;
}

/* ======================================================
   MAIN SERVICE
====================================================== */

export async function saveKycIdentity(payload) {

  const {
    userId,
    documentFront,
    documentBack,
    selfie,
    consentData,
    consentIdentity
  } = payload;

  if (!userId) {
    throw new Error("INVALID_USER");
  }

  console.log("🧪 IDENTITY PAYLOAD:", payload);

  /* =========================================
     VALIDATION
  ========================================= */
  if (!documentFront || !documentBack || !selfie) {
    throw new Error("IDENTITY_IMAGES_REQUIRED");
  }

  if (!consentData || !consentIdentity) {
    throw new Error("IDENTITY_CONSENTS_REQUIRED");
  }

  /* =========================================
     FILE DEFINITIONS
  ========================================= */
  const timestamp = Date.now();
  const files = [
    { 
      code: "ID_FRONT", 
      base64: documentFront, 
      name: `ID_FRONT_${timestamp}.jpg` // ✅ Timestamp único
    },
    { 
      code: "ID_BACK", 
      base64: documentBack, 
      name: `ID_BACK_${timestamp}.jpg` // ✅ Timestamp único
    },
    { 
      code: "SELFIE", 
      base64: selfie, 
      name: `SELFIE_${timestamp}.jpg` // ✅ Timestamp único
    }
  ];

/* =========================================
     UPLOAD & PERSIST DOCUMENTS
  ========================================= */
  for (const file of files) {
    try {
      const buffer = base64ToBuffer(file.base64);
      const mimeType = extractMimeType(file.base64);

      console.log(`📤 Subiendo ${file.code} a Drive...`);

      // ✅ USAR LA MISMA CARPETA QUE DOCUMENTS
      const fileResult = await uploadFile({
        buffer,
        filename: file.name,
        mimeType,
        folder: "identity", // ✅ Misma carpeta que los otros documentos
        email: `user_${userId}_documents` // ✅ Mismo patrón
      });

      console.log(`✅ ${file.code} subido:`, fileResult.url);

      const documentTypeId = await resolveDocumentTypeId(file.code);

      await execute(
        `
        INSERT INTO doc.kyc_uploaded_document (
          id,
          user_id,
          document_type_id,
          file_url,
          file_name,
          mime_type,
          file_size,
          status,
          uploaded_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,'pending',CURRENT_TIMESTAMP
        )
        `,
        [
          uuid(),
          userId,
          documentTypeId,
          fileResult.url,
          file.name,
          mimeType,
          buffer.length
        ]
      );

      console.log(`💾 ${file.code} guardado en BD`);

    } catch (err) {
      console.error(`❌ Error subiendo ${file.code}:`, err);
      throw new Error(`UPLOAD_FAILED_${file.code}: ${err.message}`);
    }
  }

  /* =========================================
     UPDATE KYC STATUS
  ========================================= */
  await execute(
    `
    INSERT INTO doc.kyc_status (
      user_id,
      status,
      current_step,
      last_updated
    ) VALUES (
      $1,'in_progress','identity',CURRENT_TIMESTAMP
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
      status = 'in_progress',
      current_step = 'identity',
      last_updated = CURRENT_TIMESTAMP
    `,
    [userId]
  );

  /* =========================================
     AUDIT LOG
  ========================================= */
  await execute(
    `
    INSERT INTO doc.kyc_audit_log (
      id,
      user_id,
      action,
      entity,
      created_at
    ) VALUES (
      $1,$2,$3,$4,CURRENT_TIMESTAMP
    )
    `,
    [
      uuid(),
      userId,
      "IDENTITY_COMPLETED",
      "kyc_identity"
    ]
  );

  /* =========================================
     RESPONSE
  ========================================= */
  return {
    step: "identity",
    status: "completed",
    nextStep: "address"
  };
}
