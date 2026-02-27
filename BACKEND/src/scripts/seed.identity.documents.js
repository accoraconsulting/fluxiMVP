import '../config/env.js';
import { randomUUID } from 'crypto';
import { execute } from '../config/crate.js';

const IDENTITY_DOCUMENTS = [
  {
    code: "ID_FRONT",
    name: "Documento de Identidad - Frente",
    category: "identity",
    requires_selfie: false
  },
  {
    code: "ID_BACK",
    name: "Documento de Identidad - Reverso",
    category: "identity",
    requires_selfie: false
  },
  {
    code: "SELFIE",
    name: "Selfie de Validación",
    category: "biometric",
    requires_selfie: true
  }
];

async function seed() {
  try {
    console.log("🧬 Insertando documentos de IDENTITY...");

    for (const doc of IDENTITY_DOCUMENTS) {
      const id = randomUUID();

      await execute(
        `
        INSERT INTO doc.kyc_document_type (
          id,
          code,
          name,
          subject_type,
          category,
          is_optional,
          requires_selfie
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          id,
          doc.code,
          doc.name,
          "person",
          doc.category,
          false,
          doc.requires_selfie
        ]
      );

      console.log("✅ Insertado:", doc.code);
    }

    console.log("🎉 Identity documents cargados correctamente");
    process.exit(0);

  } catch (err) {
    console.error("❌ Error cargando identity documents:", err);
    process.exit(1);
  }
}

seed();
