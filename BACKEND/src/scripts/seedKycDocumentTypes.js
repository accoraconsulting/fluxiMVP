import './src/config/env.js';
import { randomUUID } from 'crypto';
import { execute } from './src/config/crate.js';

const COMPANY_DOCUMENTS = [
  { code: "ID_FRONT", name: "Documento de indentidad frente", category: "identity", required: true },
  { code: "ID_BACK", name: "Documento de indentidad atras", category: "identity", required: true },
  { code: "SELFIE", name: "Selfie de identidad", category: "identity", required: true }
];

async function seed() {
  try {
    console.log("Insertando tipos de documentos KYC...");

    for (const doc of COMPANY_DOCUMENTS) {
      const id = randomUUID();

      await execute(
        `
        INSERT INTO doc.kyc_document_type (
          id,
          code,
          name,
          subject_type,
          category,
          is_optional
        ) VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          id,
          doc.code,
          doc.name,
          "company",
          doc.category,
          !doc.required
        ]
      );

      console.log("Insertado:", doc.code);
    }

    console.log("Catálogo KYC cargado correctamente");
    process.exit(0);

  } catch (err) {
    console.error("Error cargando tipos de documentos:", err);
    process.exit(1);
  }
}

seed();
