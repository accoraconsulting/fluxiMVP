import { google } from "googleapis";
import stream from "stream";

/* ======================================================
   BUSCAR CARPETA EN DRIVE POR NOMBRE + PARENT
====================================================== */
async function searchDriveFolder({ name, parentId }) {
  try {
    const query = `
      name = '${name}'
      and mimeType = 'application/vnd.google-apps.folder'
      and '${parentId}' in parents
      and trashed = false
    `;

    const res = await getDriveClient().files.list({
      q: query,
      fields: "files(id, name)",
      spaces: "drive"
    });

    if (res.data.files.length > 0) {
      return res.data.files[0];
    }

    return null;

  } catch (err) {
    console.error("DRIVE SEARCH ERROR:", err.message);
    throw err;
  }
}

/* ======================================================
   CREAR O REUTILIZAR CARPETA
====================================================== */
export async function findOrCreateFolder(folderName, parentId) {

  const existing = await searchDriveFolder({
    name: folderName,
    parentId
  });

  if (existing) {
    console.log("📁 Reutilizando carpeta:", folderName, existing.id);
    return existing.id;   // ✅ aquí sí es objeto
  }

  console.log("📁 Creando carpeta:", folderName);

  // ⚠️ createDriveFolder YA devuelve el ID (string)
  const folderId = await createDriveFolder(folderName, parentId);

  return folderId;        // ✅ NO folderId.id
}




/* ======================================================
   GOOGLE OAUTH CLIENT (MY DRIVE) - LAZY INITIALIZATION
   Se inicializa en la primera llamada para garantizar
   que las variables de entorno ya estén cargadas.
====================================================== */

let oAuth2Client = null;
let drive = null;

function getDriveClient() {
  if (drive) return drive;

  console.log("🔧 Inicializando Google Drive client...");

  oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oAuth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
  });

  drive = google.drive({
    version: "v3",
    auth: oAuth2Client
  });

  console.log("✅ Google Drive client inicializado");
  return drive;
}

/* ======================================================
   HELPERS
====================================================== */

/**
 * Sanitiza email para nombre de carpeta
 */
function sanitizeEmail(email) {
  return email
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9@._-]/g, "");
}

/**
 * Buscar carpeta por nombre dentro de un parent
 */
async function findFolderByName(name, parentId) {
  const q = [
    `name='${name}'`,
    `mimeType='application/vnd.google-apps.folder'`,
    parentId ? `'${parentId}' in parents` : null,
    "trashed=false"
  ]
    .filter(Boolean)
    .join(" and ");

  const res = await getDriveClient().files.list({
    q,
    fields: "files(id, name)",
    spaces: "drive"
  });

  return res.data.files?.[0] || null;
}

/* ======================================================
   CREAR CARPETA EN GOOGLE DRIVE (GENÉRICA)
====================================================== */
export async function createDriveFolder(name, parentId = null) {
  try {
    // Evitar duplicados
    const existing = await findFolderByName(name, parentId);
    if (existing) return existing.id;

    const res = await getDriveClient().files.create({
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: parentId ? [parentId] : []
      },
      fields: "id"
    });

    return res.data.id;
  } catch (err) {
    console.error("DRIVE CREATE FOLDER ERROR:", err.response?.data || err.message);
    throw new Error("DRIVE_CREATE_FOLDER_FAILED");
  }
}



/* ======================================================
   VERIFICAR SI UNA CARPETA EXISTE
====================================================== */
export async function driveFolderExists(folderId) {
  try {
    await getDriveClient().files.get({
      fileId: folderId,
      fields: "id"
    });
    return true;
  } catch (err) {
    console.error("⚠️ driveFolderExists FAILED for:", folderId, "→", err.message);
    if (err.response) {
      console.error("   Status:", err.response.status, "Data:", JSON.stringify(err.response.data));
    }
    return false;
  }
}

/* ======================================================
   SUBIR ARCHIVO A GOOGLE DRIVE
====================================================== */
export async function uploadToDrive({
  buffer,
  fileName,
  mimeType,
  folderId
}) {
  try {
    if (!buffer || !fileName || !mimeType || !folderId) {
      throw new Error("MISSING_UPLOAD_DATA");
    }

    console.log("🚀 Subiendo archivo a Drive:", {
      fileName,
      mimeType,
      folderId,
      size: buffer.length
    });

    const mediaStream = stream.Readable.from(buffer);

    const response = await getDriveClient().files.create({
      requestBody: {
        name: fileName,
        parents: [folderId]
      },
      media: {
        mimeType,
        body: mediaStream
      },
      fields: "id, name, size"
    });

    console.log("✅ Drive upload response:", response.data);

    const fileId = response.data.id;

    if (!fileId) {
      throw new Error("DRIVE_UPLOAD_NO_FILE_ID");
    }

    // Permiso público (lectura)
    await getDriveClient().permissions.create({
      fileId,
      requestBody: {
        role: "reader",
        type: "anyone"
      }
    });

    return {
      fileId,
      url: `https://drive.google.com/file/d/${fileId}/view`
    };

  } catch (err) {
    console.error("🔥 DRIVE UPLOAD ERROR:", err.response?.data || err);
    throw new Error("DRIVE_UPLOAD_FAILED");
  }
}




/* ======================================================
   CREAR / OBTENER CARPETA KYC POR USUARIO (EMAIL)
====================================================== */

export async function createKycUserFolder(email) {
  try {
    if (!email) {
      throw new Error("USER_EMAIL_REQUIRED");
    }

    if (!process.env.KYC_ROOT_FOLDER) {
      throw new Error("KYC_ROOT_FOLDER_NOT_DEFINED");
    }

    const rootExists = await driveFolderExists(process.env.KYC_ROOT_FOLDER);
    if (!rootExists) {
      throw new Error("KYC_ROOT_FOLDER_NOT_ACCESSIBLE");
    }

    const folderName = sanitizeEmail(email);

    return await findOrCreateFolder(
      folderName,
      process.env.KYC_ROOT_FOLDER
    );

  } catch (err) {
    console.error("KYC FOLDER ERROR:", err.message);
    throw err;
  }
}

/* ======================================================
   WRAPPER ESTÁNDAR PARA KYC / SERVICES
====================================================== */
export async function uploadFile({
  buffer,
  filename,
  mimeType,
  folder,
  email
}) {
  if (!folder || !email) {
    throw new Error("FOLDER_AND_EMAIL_REQUIRED");
  }

  const userFolderId = await createKycUserFolder(email);

  const normalizedFolder = folder.trim().toLowerCase();

    const stepFolderId = await findOrCreateFolder(
      normalizedFolder,
      userFolderId
    );

  return await uploadToDrive({
    buffer,
    fileName: filename,
    mimeType,
    folderId: stepFolderId
  });
}
