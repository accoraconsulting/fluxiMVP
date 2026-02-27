import { execute } from "../config/crate.js";
import { randomUUID } from "crypto";




/* =====================================================
   CONSTANTES DE ESTADO KYC
===================================================== */

export const KYC_STATUS = {
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected"
};

export const KYC_STEP = {
  PERSONAL: "personal",
  COMPANY: "company",
  DOCUMENTS: "documents",
  SELFIE: "identity",
  REVIEW: "review"
};



/* =====================================================
   KYC STATUS (ESTADO GLOBAL)
===================================================== */



/* =====================================================
   PERSONAL KYC (UPSERT REAL PARA CRATEDB)
===================================================== */
export async function upsertPersonalKyc(userId, data) {

  // ✅ 0️⃣ ASEGURAR QUE EXISTE REGISTRO EN kyc_status
  const { status, current_step } = await getKycStatus(userId);
  
  // Si es not_started, inicializar el registro
  if (status === KYC_STATUS.NOT_STARTED) {
    await setKycStatus(userId, KYC_STATUS.IN_PROGRESS, KYC_STEP.PERSONAL);
  }

  // 1️⃣ Validaciones de bloqueo
  if (status === KYC_STATUS.PENDING || status === KYC_STATUS.APPROVED) {
    throw new Error("El KYC no se puede modificar en este estado.");
  }

  if (
    current_step !== KYC_STEP.PERSONAL &&
    current_step !== KYC_STEP.COMPANY
  ) {
    throw new Error("Paso KYC inválido.");
  }

  // 2️⃣ Verificar si ya existe KYC personal
  const { rows } = await execute(
    `
    SELECT id
    FROM doc.kyc_personal_data
    WHERE user_id = $1
    LIMIT 1
    `,
    [userId]
  );

  /* =====================================================
     UPDATE
  ===================================================== */
  if (rows.length > 0) {
    const existingId = rows[0].id;

    await execute(
      `
      UPDATE doc.kyc_personal_data SET
        first_name = $2,
        last_name = $3,
        date_of_birth = $4,
        nationality = $5,
        country = $6,
        document_type = $7,
        document_number = $8,
        document_expiration_date = $9,
        email = $10,
        phone = $11,
        country_code = $12,
        role_in_company = $13,
        position_in_company = $14,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [
        existingId,
        data.first_name,
        data.last_name,
        data.date_of_birth,
        data.nationality,
        data.country,
        data.document_type,
        data.document_number,
        data.document_expiration_date || null,
        data.email,
        data.phone,
        data.country_code,
        data.role_in_company,
        data.position_in_company
      ]
    );

    // ✅ AVANZAR PASO
    await setKycStatus(
      userId,
      KYC_STATUS.IN_PROGRESS,
      KYC_STEP.COMPANY
    );

    console.log(`✅ [PERSONAL UPDATE] Estado avanzado a: company`);

    return { success: true, mode: "updated" };
  }

  /* =====================================================
     INSERT
  ===================================================== */
  const id = randomUUID();

  await execute(
    `
    INSERT INTO doc.kyc_personal_data (
      id,
      user_id,
      first_name,
      last_name,
      date_of_birth,
      nationality,
      country,
      document_type,
      document_number,
      document_expiration_date,
      email,
      phone,
      country_code,
      role_in_company,
      position_in_company,
      created_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,CURRENT_TIMESTAMP
    )
    `,
    [
      id,
      userId,
      data.first_name,
      data.last_name,
      data.date_of_birth,
      data.nationality,
      data.country,
      data.document_type,
      data.document_number,
      data.document_expiration_date || null,
      data.email,
      data.phone,
      data.country_code,
      data.role_in_company,
      data.position_in_company
    ]
  );

  // ✅ AVANZAR PASO
  await setKycStatus(
    userId,
    KYC_STATUS.IN_PROGRESS,
    KYC_STEP.COMPANY
  );

  console.log(`✅ [PERSONAL INSERT] Estado avanzado a: company`);

  return { success: true, mode: "created", id };
}
/**
 * Wrapper de compatibilidad.
 * NO rompe lógica existente.
 */
export async function createPersonalKyc(userId, data) {
  return upsertPersonalKyc(userId, data);
}

/* =====================================================
   COMPANY KYC
   (UPSERT real – idempotente)
===================================================== */
export async function upsertCompanyKyc(userId, data) {

  // 1️⃣ Leer estado actual
  const { status, current_step } = await getKycStatus(userId);

  // 2️⃣ Bloqueo por estado
  if (status === KYC_STATUS.PENDING || status === KYC_STATUS.APPROVED) {
    throw new Error("El KYC no se puede modificar en este estado.");
  }

  // 3️⃣ Validación de paso
  if (
  current_step !== KYC_STEP.PERSONAL &&
  current_step !== KYC_STEP.COMPANY
) {
  throw new Error("Paso KYC inválido.");
}


  // 4️⃣ Verificar existencia
  const { rows } = await execute(
    `
    SELECT id
    FROM doc.kyc_company_profile
    WHERE user_id = $1
    LIMIT 1
    `,
    [userId]
  );

  // 5️⃣ UPDATE
  if (rows.length > 0) {
    const existingId = rows[0].id;

    await execute(
      `
      UPDATE doc.kyc_company_profile SET
        legal_name = $2,
        trade_name = $3,
        incorporation_country = $4,
        incorporation_date = $5,
        tax_id = $6,
        tax_id_type = $7,
        tax_country = $8,
        commercial_registry = $9,
        economic_activity = $10,
        industry_code = $11,
        business_address = $12,
        city = $13,
        country = $14,
        country_code = $15,
        postal_code = $16,
        corporate_email = $17,
        corporate_phone = $18,
        operating_currency = $19,
        monthly_tx_volume = $20,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [
        existingId,
        data.legal_name,
        data.trade_name,
        data.incorporation_country,
        data.incorporation_date,
        data.tax_id,
        data.tax_id_type,
        data.tax_country,
        data.commercial_registry,
        data.economic_activity,
        data.industry_code,
        data.business_address,
        data.city,
        data.country,
        data.country_code,
        data.postal_code,
        data.corporate_email,
        data.corporate_phone,
        data.operating_currency,
        data.monthly_tx_volume
      ]
    );
  } else {
    // 6️⃣ INSERT
    await execute(
      `
      INSERT INTO doc.kyc_company_profile (
        id,
        user_id,
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
        created_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,NOW()
      )
      `,
      [
        randomUUID(),
        userId,
        data.legal_name,
        data.trade_name,
        data.incorporation_country,
        data.incorporation_date,
        data.tax_id,
        data.tax_id_type,
        data.tax_country,
        data.commercial_registry,
        data.economic_activity,
        data.industry_code,
        data.business_address,
        data.city,
        data.country,
        data.country_code,
        data.postal_code,
        data.corporate_email,
        data.corporate_phone,
        data.operating_currency,
        data.monthly_tx_volume
      ]
    );
  }

  // 7️⃣ Avanzar paso
  await setKycStatus(
    userId,
    KYC_STATUS.IN_PROGRESS,
    KYC_STEP.DOCUMENTS
  );

  return { success: true };
}

/**
 * Wrapper de compatibilidad.
 */
export async function createCompanyKyc(userId, data) {
  return upsertCompanyKyc(userId, data);
}

/* =====================================================
   KYC STATUS (ESTADO GLOBAL)
===================================================== */

/**
 * Obtiene el estado actual y el paso del KYC del usuario.
 */
export async function getKycStatus(userId) {
  const { rows } = await execute(
    `
    SELECT status, current_step
    FROM doc.kyc_status
    WHERE user_id = $1
    `,
    [userId]
  );

  if (rows.length === 0) {
    return {
      status: KYC_STATUS.NOT_STARTED,
      current_step: KYC_STEP.PERSONAL
    };
  }

  return rows[0];
}

/**
 * Inserta o actualiza el estado del KYC (UPSERT manual CrateDB-safe)
 * - No permite retroceder pasos
 * - No permite modificar KYC en estados finales
 * - Normaliza valores inválidos
 */
export async function setKycStatus(userId, status, currentStep) {
  // ============================
  // 0️⃣ Normalización defensiva
  // ============================
  const VALID_STATUS = [
    "not_started",
    "in_progress",
    "pending",
    "approved",
    "rejected"
  ];
  
  const VALID_STEPS = [
    "personal",
    "company",
    "documents",
    "identity",
    "review"
  ];

  // Normalizar status inválido
  if (!VALID_STATUS.includes(status)) {
    console.warn("⚠️ Status inválido recibido:", status);
    status = "in_progress";
  }

  // Normalizar step inválido / null
  if (!VALID_STEPS.includes(currentStep)) {
    console.warn("⚠️ Step inválido recibido:", currentStep);
    currentStep = "review";
  }

  // ============================
  // 1️⃣ Leer estado actual
  // ============================
  const { rows } = await execute(
    `
    SELECT status, current_step
    FROM doc.kyc_status
    WHERE user_id = $1
    `,
    [userId]
  );

  if (rows.length > 0) {
    const current = rows[0];

    // ============================
    // 2️⃣ Bloquear estados finales
    // ============================
    if (
      current.status === "pending" ||
      current.status === "approved"
    ) {
      console.warn(`🔒 [setKycStatus] Estado bloqueado: ${current.status}`);
      throw new Error("KYC_STATE_LOCKED");
    }

    // ============================
    // 3️⃣ Evitar retroceso de pasos
    // ============================
    const stepOrder = [
      "personal",
      "company",
      "documents",
      "identity",
      "review"
    ];

    const currentStepIndex = stepOrder.indexOf(current.current_step);
    const newStepIndex = stepOrder.indexOf(currentStep);

    if (
      current.current_step &&
      newStepIndex < currentStepIndex // ✅ Corregido el operador
    ) {
      console.warn(
        `⚠️ [setKycStatus] Intento de retroceso: ${current.current_step} → ${currentStep}`
      );
      throw new Error("KYC_STEP_REGRESSION_NOT_ALLOWED");
    }
  }

  // ============================
  // 4️⃣ UPSERT REAL
  // ============================
  console.log(`📝 [setKycStatus] Guardando: userId=${userId}, status=${status}, step=${currentStep}`);

  await execute(
    `
    INSERT INTO doc.kyc_status (user_id, status, current_step)
    VALUES ($1, $2, $3)
    ON CONFLICT (user_id)
    DO UPDATE SET
      status = EXCLUDED.status,
      current_step = EXCLUDED.current_step
    `,
    [userId, status, currentStep]
  );

  console.log(`✅ [setKycStatus] Estado guardado correctamente`);
}
/* =====================================================
   VALIDACIÓN DE COMPLETITUD
===================================================== */
/**
 * Verifica que TODAS las piezas mínimas del KYC existan.
 * - No valida negocio
 * - Solo presencia REAL de datos válidos
 */
export async function isKycComplete(userId) {
  const { rows } = await execute(
    `
    SELECT
      EXISTS (
        SELECT 1
        FROM doc.kyc_personal_data
        WHERE user_id = $1
      ) AS personal,

      EXISTS (
        SELECT 1
        FROM doc.kyc_company_profile
        WHERE user_id = $1
      ) AS company,

      EXISTS (
        SELECT 1
        FROM doc.kyc_uploaded_document
        WHERE user_id = $1
          AND status IN ('pending','approved')
      ) AS documents
    `,
    [userId]
  );

  const row = rows[0];

  return (
    row.personal === true &&
    row.company === true &&
    row.documents === true
  );
}
/* =====================================================
   SUBMIT FORMAL DEL KYC
   (PUNTO CRÍTICO DEL SISTEMA)
===================================================== */

export async function submitKyc(userId) {
  if (!userId) {
    throw new Error("INVALID_USER");
  }

  const current = await getKycStatus(userId);

  if (current.status !== KYC_STATUS.IN_PROGRESS) {
    throw new Error("KYC_NOT_IN_PROGRESS");
  }

  const complete = await isKycComplete(userId);
  if (!complete) {
    throw new Error("KYC_INCOMPLETE");
  }

  const { rows } = await execute(
    `
    SELECT 1
    FROM doc.kyc_uploaded_document
    WHERE user_id = $1
      AND status IN ('pending','approved')
    LIMIT 1
    `,
    [userId]
  );

  if (rows.length === 0) {
    throw new Error("KYC_DOCUMENTS_REQUIRED");
  }

  // 🔥 CAMBIO FINAL REAL
  await setKycStatus(
    userId,
    KYC_STATUS.PENDING,
    KYC_STEP.REVIEW
  );

  // legacy (sidebar / dashboard)
  await execute(
    `
    UPDATE doc.users
    SET kyc_status = $2
    WHERE id = $1
    `,
    [userId, KYC_STATUS.PENDING]
  );

  // auditoría (AHORA SÍ SE EJECUTA)
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
      randomUUID(),
      userId,
      "KYC_SUBMITTED",
      "kyc"
    ]
  );

  return {
    status: KYC_STATUS.PENDING,
    current_step: KYC_STEP.REVIEW
  };


  /* =========================================
     AUDITORÍA
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
      crypto.randomUUID(),
      userId,
      "KYC_SUBMITTED",
      "kyc"
    ]
  );

  /* =========================================
     RESPONSE
  ========================================= */
  return {
    success: true,
    status: KYC_STATUS.PENDING,
    step: KYC_STEP.REVIEW
  };
}

