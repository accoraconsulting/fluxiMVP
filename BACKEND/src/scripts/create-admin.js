/* =====================================================
   ENV
===================================================== */
import dotenv from "dotenv";
dotenv.config();

/* =====================================================
   DEPENDENCIAS
===================================================== */
import bcrypt from "bcrypt";
import crypto from "crypto";
import { execute } from "../config/crate.js";

/* =====================================================
   CONFIG ADMIN
===================================================== */
const ADMIN_EMAIL = "admin@fluxi.com";
const ADMIN_USERNAME = "fluxiAdmin";
const ADMIN_PASSWORD = "Fluxiadmin*2024";
const ADMIN_ROLE = "fluxiAdmin";

/* =====================================================
   UTILIDADES
===================================================== */
function uuid() {
  return crypto.randomUUID();
}

function generateWalletAddress(symbol) {
  // address válida DEV
  return `${symbol}_${uuid()}`;
}

/* =====================================================
   SCRIPT PRINCIPAL
===================================================== */
async function createAdmin() {
  try {
    console.log("🚀 Iniciando creación de usuario admin...");
    console.log("📧 Email:", ADMIN_EMAIL);
    console.log("👤 Username:", ADMIN_USERNAME);
    console.log("🔑 Password:", ADMIN_PASSWORD);

    /* ===============================
       1️⃣ HASH PASSWORD
    =============================== */
    console.log("\n🔐 Generando hash de contraseña...");
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    console.log("✅ Hash generado");

    /* ===============================
       2️⃣ ELIMINAR ADMIN ANTERIOR
    =============================== */
    console.log("\n🧹 Eliminando admin anterior (si existe)...");

    const { rows: oldUsers } = await execute(
      `SELECT id FROM doc.users WHERE email = $1`,
      [ADMIN_EMAIL]
    );

    if (oldUsers.length > 0) {
      const oldUserId = oldUsers[0].id;

      await execute(
        `DELETE FROM doc.wallets WHERE user_id = $1`,
        [oldUserId]
      );
      console.log("  - Wallets eliminadas");

      await execute(
        `DELETE FROM doc.users WHERE id = $1`,
        [oldUserId]
      );
      console.log("  - Usuario eliminado");
    } else {
      console.log("  - No existía admin previo");
    }

    /* ===============================
       3️⃣ CREAR USUARIO ADMIN
    =============================== */
    console.log("\n👤 Creando usuario admin...");

    const userId = uuid();

    await execute(
      `
      INSERT INTO doc.users (
        id,
        email,
        username,
        password,
        role,
        status,
        kyc_status,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        'active', 'approved',
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      `,
      [
        userId,
        ADMIN_EMAIL,
        ADMIN_USERNAME,
        passwordHash,
        ADMIN_ROLE
      ]
    );

    console.log("✅ Usuario admin creado");

    /* ===============================
       4️⃣ OBTENER ASSETS (CORRECTO)
    =============================== */
    console.log("\n💰 Obteniendo assets disponibles...");

    const { rows: assets } = await execute(
      `SELECT id, symbol FROM doc.assets WHERE is_active = true`
    );

    if (assets.length === 0) {
      throw new Error("NO_ACTIVE_ASSETS");
    }

    console.log(
      `  - Encontrados ${assets.length} assets:`,
      assets.map(a => a.symbol).join(", ")
    );

    /* ===============================
       5️⃣ CREAR WALLETS
    =============================== */
    console.log("\n🏦 Creando wallets...");

    for (const asset of assets) {
      const walletId = uuid();
      const address = generateWalletAddress(asset.symbol);
      const balance = 0; // 🔥 mejor práctica: iniciar en 0

      console.log(`  📝 Insertando wallet ${asset.symbol}...`);
      console.log(`     - Wallet ID: ${walletId}`);
      console.log(`     - User ID: ${userId}`);
      console.log(`     - Asset ID: ${asset.id}`);
      console.log(`     - Address: ${address}`);

      await execute(
        `
        INSERT INTO doc.wallets (
          id,
          user_id,
          asset_id,
          address,
          balance,
          is_active,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          true,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        `,
        [
          walletId,
          userId,
          asset.id,
          address,
          balance
        ]
      );
    }

    console.log("\n🎉 ADMIN CREADO CORRECTAMENTE");
    console.log("══════════════════════════════");

  } catch (err) {
    console.error("\n═══════════════════════════════");
    console.error("❌ ERROR CREANDO ADMIN");
    console.error("═══════════════════════════════\n");
    console.error(err);
    process.exit(1);
  }
}

/* =====================================================
   EJECUCIÓN
===================================================== */
createAdmin();
