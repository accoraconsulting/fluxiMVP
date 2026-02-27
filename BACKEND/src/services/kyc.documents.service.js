import crypto from "crypto";
import { uploadFile, createDriveFolder } from "./googleDrive.service.js";
import { execute } from "../config/crate.js";
import {
  getKycStatus,
  setKycStatus,
  KYC_STATUS,
  KYC_STEP
} from "./kyc.service.js";

/* ======================================================
   CARPETA RAÍZ KYC EN GOOGLE DRIVE
====================================================== */
const KYC_ROOT_FOLDER = "1Lr-fUXcmbvnwBw263tUJwKq31rNSCVLh";

/* ======================================================
   OBTENER O CREAR CARPETA DEL USUARIO
====================================================== */
export async function resolveUserDriveFolder(userId) {

  // 1. ¿Ya existe en BD?
  const { rows } = await execute(
    `
    SELECT drive_folder_id
    FROM doc.kyc_user_drive
    WHERE user_id = $1
    `,
    [userId]
  );

  if (rows.length > 0) {
    return rows[0].drive_folder_id;
  }

  // 2. Crear carpeta en Google Drive
  const folderId = await createDriveFolder(
    `user_${userId}`,
    KYC_ROOT_FOLDER
  );

  // 3. Guardar relación
  await execute(
    `
    INSERT INTO doc.kyc_user_drive (user_id, drive_folder_id)
    VALUES ($1,$2)
    `,
    [userId, folderId]
  );

  return folderId;
}

async function resolveDocumentTypeByCode(code) {
  const { rows } = await execute(
    `
    SELECT id, code, name
    FROM doc.kyc_document_type
    WHERE code = $1
    `,
    [code]
  );

  if (rows.length === 0) {
    throw new Error("INVALID_DOCUMENT_TYPE");
  }

  return rows[0];
}


/* ======================================================
   SUBIR DOCUMENTO KYC
====================================================== */
export async function uploadKycDocument({
  userId,
  documentType,
  file
}) {
  if (!file || !file.buffer) {
    throw new Error("INVALID_FILE");
  }

  /* --------------------------------------------------
     VALIDACIÓN DE ESTADO Y PASO KYC
  -------------------------------------------------- */
  let { status, current_step } = await getKycStatus(userId);

  if (
    status === KYC_STATUS.PENDING ||
    status === KYC_STATUS.APPROVED
  ) {
    throw new Error("El KYC no se puede modificar en este estado.");
  }

  // Si viene directo desde COMPANY, avanzar a DOCUMENTS
  if (current_step === KYC_STEP.COMPANY) {
    await setKycStatus(
      userId,
      KYC_STATUS.IN_PROGRESS,
      KYC_STEP.DOCUMENTS
    );
    current_step = KYC_STEP.DOCUMENTS;
  }

  if (current_step !== KYC_STEP.DOCUMENTS) {
    throw new Error("Paso KYC inválido para subir documentos.");
  }

  /* --------------------------------------------------
     HASH DEL ARCHIVO
  -------------------------------------------------- */
  const fileHash = crypto
    .createHash("sha256")
    .update(file.buffer)
    .digest("hex");
/* --------------------------------------------------
     SUBIR A GOOGLE DRIVE
  -------------------------------------------------- */
  /* --------------------------------------------------
     CARPETA DEL USUARIO
  -------------------------------------------------- */
 const fileResult = await uploadFile({
  buffer: file.buffer,
  filename: `${documentType.code}_${Date.now()}_${file.originalname}`,
  mimeType: file.mimetype,
  folder: "documents",
  email: `user_${userId}_documents`  // ✅ MISMO PATRÓN QUE resolveUserDriveFolder
});



  /* --------------------------------------------------
     GUARDAR EN CRATEDB
  -------------------------------------------------- */
  const documentId = crypto.randomUUID();

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
      file_hash,
      status,
      uploaded_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,'pending',CURRENT_TIMESTAMP
    )
    `,
    [
      documentId,
      userId,
      documentType.id,
      fileResult.url,
      file.originalname,
      file.mimetype,
      file.size,
      fileHash
    ]
  );

  return {
    id: documentId,
    url: fileResult.url,
    status: "pending"
  };
}

/* ======================================================
   LISTAR DOCUMENTOS DEL USUARIO
====================================================== */
export async function getUserKycDocuments(userId) {
  const { rows } = await execute(
    `
    SELECT 
      d.id,
      d.document_type_id,
      t.code,
      t.name,
      d.file_url,
      d.status,
      d.rejection_reason,
      d.uploaded_at,
      d.reviewed_at
    FROM doc.kyc_uploaded_document d
    JOIN doc.kyc_document_type t
      ON t.id = d.document_type_id
    WHERE d.user_id = $1
    ORDER BY d.uploaded_at DESC
    `,
    [userId]
  );

  return rows;
}

/* ======================================================
   COMPLIANCE: RECHAZAR DOCUMENTO
====================================================== */
export async function rejectKycDocument({ documentId, reason }) {
  await execute(
    `
    UPDATE doc.kyc_uploaded_document
    SET 
      status = 'rejected',
      rejection_reason = $1,
      reviewed_at = CURRENT_TIMESTAMP
    WHERE id = $2
    `,
    [reason, documentId]
  );
}

/* ======================================================
   COMPLIANCE: APROBAR DOCUMENTO
====================================================== */
export async function approveKycDocument(documentId) {
  await execute(
    `
    UPDATE doc.kyc_uploaded_document
    SET 
      status = 'approved',
      reviewed_at = CURRENT_TIMESTAMP
    WHERE id = $1
    `,
    [documentId]
  );
}
