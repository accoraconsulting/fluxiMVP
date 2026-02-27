import nodemailer from 'nodemailer';

// ⚠️ LAZY INITIALIZATION - Las variables se leen cuando se necesitan,
// NO al importar el módulo (porque dotenv aún no ha cargado en ES Modules)
let _transporter = null;

function getConfig() {
  return {
    host: process.env.BREVO_SMTP_HOST || 'smtp-relay.sendinblue.com',
    port: parseInt(process.env.BREVO_SMTP_PORT || '587'),
    user: process.env.BREVO_SMTP_USER,
    password: process.env.BREVO_SMTP_PASSWORD,
    from: process.env.BREVO_SMTP_FROM || 'contacto@accoraconsulting.com',
    adminEmail: process.env.ADMIN_EMAIL || 'contacto@accoraconsulting.com',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5500/FRONTEND'
  };
}

function getTransporter() {
  if (!_transporter) {
    const config = getConfig();
    console.log('[EmailService] 🔧 Inicializando transporter SMTP:', config.host, ':', config.port);
    _transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: false,
      auth: {
        user: config.user,
        pass: config.password
      }
    });
  }
  return _transporter;
}

/* =====================================================
   ENVIAR EMAIL DE CAMBIO DE CONTRASEÑA
===================================================== */
export async function sendPasswordResetEmail(email, token, expiresInMinutes) {
  const config = getConfig();
  const resetUrl = `${config.frontendUrl}/reset-password.html?token=${token}`;

  console.log('[EmailService] 📧 Preparando email para:', email);
  console.log('[EmailService] 🔗 URL de reset:', resetUrl);

  try {
    const mailOptions = {
      from: `Fluxi Security <${config.from}>`,
      to: email,
      subject: '🔐 Cambio de contraseña - Fluxi',
      html: generatePasswordResetEmailHTML(resetUrl, expiresInMinutes)
    };

    const info = await getTransporter().sendMail(mailOptions);

    console.log('[EmailService] ✅ Email enviado correctamente');
    console.log('[EmailService] 📨 ID:', info.messageId);

    return {
      success: true,
      messageId: info.messageId
    };

  } catch (err) {
    console.error('[EmailService] ❌ Exception:', err);
    throw new Error('EMAIL_SERVICE_ERROR');
  }
}

/* =====================================================
   TEMPLATE HTML PROFESIONAL
===================================================== */
function generatePasswordResetEmailHTML(resetUrl, expiresInMinutes) {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cambio de contraseña - Fluxi</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">

          <!-- HEADER -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
                🔐 Cambio de Contraseña
              </h1>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding: 40px;">
              <p style="color: #2c3e50; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Hola,
              </p>
              <p style="color: #2c3e50; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Recibimos una solicitud para cambiar la contraseña de tu cuenta en <strong>Fluxi</strong>.
              </p>
              <p style="color: #2c3e50; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                Haz clic en el botón de abajo para continuar:
              </p>

              <!-- BUTTON -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
                      Cambiar mi contraseña
                    </a>
                  </td>
                </tr>
              </table>

              <!-- WARNING BOX -->
              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 30px 0; border-radius: 4px;">
                <p style="color: #856404; font-size: 14px; margin: 0; line-height: 1.6;">
                  <strong>⚠️ Importante:</strong><br>
                  Este enlace expira en <strong>${expiresInMinutes} minutos</strong>.<br>
                  Si no solicitaste este cambio, puedes ignorar este correo.
                </p>
              </div>

              <!-- ALTERNATIVE LINK -->
              <p style="color: #7f8c8d; font-size: 14px; line-height: 1.6; margin: 20px 0;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:
              </p>
              <p style="background-color: #f8f9fa; padding: 12px; border-radius: 4px; word-break: break-all; font-size: 13px; color: #667eea; margin: 0;">
                ${resetUrl}
              </p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #ecf0f1;">
              <p style="color: #95a5a6; font-size: 13px; margin: 0 0 10px 0;">
                Este es un correo automático, por favor no respondas.
              </p>
              <p style="color: #95a5a6; font-size: 13px; margin: 0;">
                © ${new Date().getFullYear()} Fluxi. Todos los derechos reservados.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/* =====================================================
   ENVIAR EMAIL DE CONFIRMACIÓN DE SOPORTE
===================================================== */
export async function sendSupportConfirmationEmail(email, name, subject, messageId) {
  const config = getConfig();
  console.log('[EmailService] 📧 Preparando email de confirmación de soporte para:', email);

  try {
    const mailOptions = {
      from: `Fluxi Support <${config.from}>`,
      to: email,
      subject: '✅ Tu mensaje ha sido recibido - FLUXI',
      html: generateSupportConfirmationHTML(name, subject, messageId)
    };

    const info = await getTransporter().sendMail(mailOptions);

    console.log('[EmailService] ✅ Email de confirmación enviado correctamente');
    console.log('[EmailService] 📨 ID:', info.messageId);

    return {
      success: true,
      messageId: info.messageId
    };

  } catch (err) {
    console.error('[EmailService] ❌ Exception:', err);
    throw new Error('EMAIL_SERVICE_ERROR');
  }
}

/* =====================================================
   ENVIAR NOTIFICACIÓN AL ADMIN
===================================================== */
export async function sendSupportNotificationToAdmin(name, email, category, subject, message, messageId) {
  const config = getConfig();
  console.log('[EmailService] 📧 Enviando notificación a admin:', config.adminEmail);
  console.log('[EmailService] FROM:', config.from);
  console.log('[EmailService] TO:', config.adminEmail);

  try {
    const mailOptions = {
      from: `Fluxi Support <${config.from}>`,
      to: config.adminEmail,
      subject: `📬 Nuevo mensaje de soporte: ${subject}`,
      html: generateAdminNotificationHTML(name, email, category, subject, message, messageId)
    };

    console.log('[EmailService] 🔍 Opciones de mail:', { from: mailOptions.from, to: mailOptions.to, subject: mailOptions.subject });

    const info = await getTransporter().sendMail(mailOptions);

    console.log('[EmailService] ✅ Notificación enviada al admin correctamente');
    console.log('[EmailService] 📨 ID del mensaje:', info.messageId);
    console.log('[EmailService] Response:', info.response);

    return {
      success: true,
      messageId: info.messageId
    };

  } catch (err) {
    console.error('[EmailService] ❌ Error enviando notificación:', err.message);
    console.error('[EmailService] ❌ Stack:', err.stack);
    throw new Error('EMAIL_SERVICE_ERROR: ' + err.message);
  }
}

/* =====================================================
   TEMPLATE: CONFIRMACIÓN DE SOPORTE AL USUARIO
===================================================== */
function generateSupportConfirmationHTML(name, subject, messageId) {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmación de Soporte - FLUXI</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">

          <!-- HEADER -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
                ✅ ¡Mensaje Recibido!
              </h1>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding: 40px;">
              <p style="color: #2c3e50; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Hola ${name},
              </p>
              <p style="color: #2c3e50; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Recibimos tu mensaje con asunto: <strong>"${subject}"</strong>
              </p>
              <p style="color: #2c3e50; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                Nuestro equipo de soporte lo revisará y te contactará en máximo 24 horas.
              </p>

              <!-- INFO BOX -->
              <div style="background-color: #f0f4ff; border-left: 4px solid #667eea; padding: 16px; margin: 30px 0; border-radius: 4px;">
                <p style="color: #667eea; font-size: 14px; margin: 0; line-height: 1.6;">
                  <strong>📌 ID de tu solicitud:</strong><br>
                  <code style="background: white; padding: 8px; border-radius: 4px; font-family: monospace; display: inline-block; margin-top: 8px;">${messageId}</code>
                </p>
              </div>

              <p style="color: #2c3e50; font-size: 14px; line-height: 1.6; margin: 20px 0;">
                Guarda este ID en caso de que necesites hacer seguimiento de tu solicitud.
              </p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #ecf0f1;">
              <p style="color: #95a5a6; font-size: 13px; margin: 0 0 10px 0;">
                Centro de Soporte FLUXI
              </p>
              <p style="color: #95a5a6; font-size: 13px; margin: 0;">
                © ${new Date().getFullYear()} FLUXI. Todos los derechos reservados.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/* =====================================================
   TEMPLATE: NOTIFICACIÓN AL ADMIN
===================================================== */
function generateAdminNotificationHTML(name, email, category, subject, message, messageId) {
  const categoryNames = {
    'kyc': 'Verificación (KYC)',
    'wallet': 'Mi Wallet',
    'transaction': 'Transacciones',
    'security': 'Seguridad',
    'technical': 'Problema Técnico',
    'other': 'Otro'
  };

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nuevo Mensaje de Soporte - FLUXI</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">

          <!-- HEADER -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
                📬 Nuevo Mensaje de Soporte
              </h1>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #667eea; margin: 0 0 20px 0;">${subject}</h2>

              <!-- DETALLES -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color: #7f8c8d; font-size: 13px; padding: 8px 0; width: 30%;"><strong>De:</strong></td>
                  <td style="color: #2c3e50; font-size: 14px; padding: 8px 0;">${name} (${email})</td>
                </tr>
                <tr>
                  <td style="color: #7f8c8d; font-size: 13px; padding: 8px 0;"><strong>Categoría:</strong></td>
                  <td style="color: #2c3e50; font-size: 14px; padding: 8px 0;">${categoryNames[category] || category}</td>
                </tr>
                <tr>
                  <td style="color: #7f8c8d; font-size: 13px; padding: 8px 0;"><strong>ID:</strong></td>
                  <td style="color: #667eea; font-size: 13px; padding: 8px 0; font-family: monospace;">${messageId}</td>
                </tr>
              </table>

              <!-- MENSAJE -->
              <div style="background-color: #f8f9fa; padding: 16px; margin: 20px 0; border-radius: 4px; border-left: 4px solid #667eea;">
                <p style="color: #2c3e50; font-size: 14px; line-height: 1.8; margin: 0; white-space: pre-wrap;">
                  ${message}
                </p>
              </div>

              <p style="color: #7f8c8d; font-size: 12px; margin: 20px 0;">
                <strong>Acción recomendada:</strong> Revisa este mensaje y responde al usuario lo antes posible.
              </p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #ecf0f1;">
              <p style="color: #95a5a6; font-size: 13px; margin: 0;">
                Sistema Automatizado de Soporte FLUXI
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/* =====================================================
   VERIFICAR CONFIGURACIÓN DE BREVO
===================================================== */
export async function checkEmailConfiguration() {
  const config = getConfig();
  console.log('[EmailService] 🔍 Verificando configuración de Brevo...');

  if (!config.user || !config.password) {
    console.warn('⚠️ Credenciales de Brevo no configuradas.');
    console.warn('⚠️ Agrega BREVO_SMTP_HOST, BREVO_SMTP_PORT, BREVO_SMTP_USER y BREVO_SMTP_PASSWORD a tu archivo .env');
    return false;
  }

  try {
    await getTransporter().verify();
    console.log('✅ Conexión a Brevo verificada correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error verificando conexión a Brevo:', error.message);
    return false;
  }
}
