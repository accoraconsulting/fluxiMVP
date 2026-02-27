import multer from 'multer';

import {
  createCompanyKyc,
  createPersonalKyc
} from '../services/kyc.service.js';

import {
  uploadKycDocument,
  getUserKycDocuments
} from '../services/kyc.documents.service.js';

import { execute } from '../config/crate.js';

/* ======================================================
   MULTER (MEMORY STORAGE - OBLIGATORIO PARA DRIVE)
====================================================== */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

/* ======================================================
   KYC PERSONAL (NO TOCAR)
====================================================== */
export async function submitPersonal(req, res) {
  try {
    const userId = req.user.userId;
    const result = await createPersonalKyc(userId, req.body);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
}

/* ======================================================
   KYC EMPRESA (NO TOCAR)
====================================================== */
export async function submitCompanyKyc(req, res) {
  try {
    const userId = req.user.userId;
    const data = req.body;

    const result = await createCompanyKyc(userId, data);
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

/* ======================================================
   SUBIDA DE DOCUMENTOS KYC (ID / SELFIE / EMPRESA)
====================================================== */
export const uploadKycFile = [
  upload.single('file'),

  async (req, res) => {
    try {
      const userId = req.user.userId;
      const { document_type_id } = req.body;

      if (!document_type_id) {
        return res.status(400).json({ message: 'document_type_id requerido' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'Archivo no recibido' });
      }

      /* ---------------------------------------------
         VALIDAR TIPO DE DOCUMENTO EN CRATEDB
      --------------------------------------------- */
     const { rows } = await execute(
            `
            SELECT *
            FROM doc.kyc_document_type
            WHERE code = ?
            `,
            [document_type_id]
          );

      if (rows.length === 0) {
        return res.status(400).json({
          message: 'Tipo de documento no registrado'
        });
      }

      const documentType = rows[0];

      /* ---------------------------------------------
         SUBIDA A DRIVE + REGISTRO BD
      --------------------------------------------- */
      const result = await uploadKycDocument({
        userId,
        documentType,
        file: req.file
      });

      res.json(result);

    } catch (err) {
      console.error('KYC UPLOAD ERROR:', err);
      res.status(500).json({
        message: 'Error subiendo documento',
        error: err.message
      });
    }
  }
];

/* ======================================================
   LISTAR DOCUMENTOS DEL USUARIO
====================================================== */
export async function listMyKycDocuments(req, res) {
  try {
    const userId = req.user.userId;
    const docs = await getUserKycDocuments(userId);
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}


/* ======================================================
   FINALIZAR KYC → PASAR A REVISIÓN
====================================================== */
export async function submitKycForReview(req, res) {
  try {
    const userId = req.user.userId;

    /* ---------------------------------------------
       VALIDACIONES MÍNIMAS (opcional pero recomendado)
    --------------------------------------------- */

    // 1. ¿Tiene documentos?
    const { rows: docs } = await execute(`
      SELECT 1
      FROM doc.kyc_uploaded_document
      WHERE user_id = $1
      LIMIT 1
    `, [userId]);

    if (docs.length === 0) {
      return res.status(400).json({
        message: "KYC incompleto: documentos faltantes"
      });
    }

    /* ---------------------------------------------
       CAMBIAR ESTADO DEL USUARIO
    --------------------------------------------- */
    await execute(`
      UPDATE users
      SET 
        kyc_status = 'pending',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [userId]);

    res.json({
      status: "pending",
      message: "KYC enviado a revisión"
    });

  } catch (err) {
    console.error("KYC SUBMIT ERROR:", err);
    res.status(500).json({
      message: "No se pudo enviar el KYC"
    });
  }
}
