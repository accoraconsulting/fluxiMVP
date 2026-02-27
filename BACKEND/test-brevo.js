#!/usr/bin/env node

/**
 * SCRIPT DE PRUEBA PARA BREVO SMTP
 * Verifica que la conexión SMTP funciona correctamente
 */

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const BREVO_SMTP_HOST = process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com';
const BREVO_SMTP_PORT = parseInt(process.env.BREVO_SMTP_PORT || '587');
const BREVO_SMTP_USER = process.env.BREVO_SMTP_USER;
const BREVO_SMTP_PASSWORD = process.env.BREVO_SMTP_PASSWORD;

console.log('🔍 VERIFICANDO CREDENCIALES DE BREVO...\n');
console.log('HOST:', BREVO_SMTP_HOST);
console.log('PORT:', BREVO_SMTP_PORT);
console.log('USER:', BREVO_SMTP_USER);
console.log('PASSWORD:', BREVO_SMTP_PASSWORD ? '***[OCULTA]***' : '❌ NO CONFIGURADA');

if (!BREVO_SMTP_USER || !BREVO_SMTP_PASSWORD) {
  console.error('\n❌ ERROR: Faltan credenciales en .env');
  process.exit(1);
}

// Crear transporter
const transporter = nodemailer.createTransport({
  host: BREVO_SMTP_HOST,
  port: BREVO_SMTP_PORT,
  secure: false, // TLS en 587
  auth: {
    user: BREVO_SMTP_USER,
    pass: BREVO_SMTP_PASSWORD
  }
});

console.log('\n⏳ Verificando conexión SMTP...\n');

// Intentar verificar conexión
transporter.verify(function(error, success) {
  if (error) {
    console.error('❌ ERROR DE CONEXIÓN:', error.message);
    console.error('Código:', error.code);
    process.exit(1);
  }

  if (success) {
    console.log('✅ CONEXIÓN SMTP EXITOSA!\n');
    console.log('Ahora enviando email de prueba...\n');

    // Enviar email de prueba
    const mailOptions = {
      from: `FLUXI Security <${BREVO_SMTP_USER}>`,
      to: BREVO_SMTP_USER, // Enviar a la misma dirección
      subject: '🧪 Email de prueba - FLUXI Brevo Integration',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
          <div style="background: white; padding: 30px; border-radius: 8px;">
            <h2>✅ ¡Email de prueba exitoso!</h2>
            <p>La integración de Brevo SMTP está funcionando correctamente.</p>
            <p><strong>Información:</strong></p>
            <ul>
              <li>📧 Desde: ${BREVO_SMTP_USER}</li>
              <li>🕐 Enviado: ${new Date().toLocaleString('es-CO')}</li>
              <li>🔧 Servidor: smtp-relay.brevo.com</li>
            </ul>
            <p style="margin-top: 30px; color: #888; font-size: 12px;">
              Este es un email de prueba. Puedes proceder a usar FLUXI normalmente.
            </p>
          </div>
        </div>
      `
    };

    transporter.sendMail(mailOptions, function(error, info) {
      if (error) {
        console.error('❌ ERROR AL ENVIAR EMAIL:', error.message);
        process.exit(1);
      }

      console.log('✅ EMAIL ENVIADO EXITOSAMENTE!');
      console.log('📨 ID del mensaje:', info.messageId);
      console.log('\n🎉 TODO ESTÁ LISTO! La integración de Brevo funciona correctamente.\n');
      process.exit(0);
    });
  }
});
