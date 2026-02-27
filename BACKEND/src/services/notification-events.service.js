/**
 * NOTIFICATION EVENTS SERVICE
 * Sistema de eventos para disparar notificaciones automáticamente
 */

import { createNotificationFromTemplate, createNotification } from './notification.service.js';
import { execute } from '../config/crate.js';

/**
 * EVENTO: Transferencia recibida
 */
export async function onTransferReceived({ toUserId, fromUserEmail, amount, currency }) {
  try {
    // Obtener rol del usuario
    const { rows } = await execute(
      `SELECT role FROM doc.users WHERE id = $1 LIMIT 1`,
      [toUserId]
    );

    if (rows.length === 0) return;

    const role = rows[0].role;

    await createNotificationFromTemplate({
      userId: toUserId,
      role,
      templateKey: 'TRANSFER_RECEIVED',
      variables: {
        amount,
        currency,
        from_user: fromUserEmail
      }
    });

    console.log(`[NotificationEvents] ✅ Transfer received notification sent to ${toUserId}`);

  } catch (error) {
    console.error('[NotificationEvents] ❌ Error en onTransferReceived:', error);
  }
}

/**
 * EVENTO: Recarga completada
 */
export async function onTopupCompleted({ userId, amount, currency }) {
  try {
    const { rows } = await execute(
      `SELECT role FROM doc.users WHERE id = $1 LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) return;

    const role = rows[0].role;

    await createNotificationFromTemplate({
      userId,
      role,
      templateKey: 'TOPUP_COMPLETED',
      variables: { amount, currency }
    });

    console.log(`[NotificationEvents] ✅ Topup notification sent to ${userId}`);

  } catch (error) {
    console.error('[NotificationEvents] ❌ Error en onTopupCompleted:', error);
  }
}

/**
 * EVENTO: KYC aprobado
 */
export async function onKycApproved({ userId }) {
  try {
    const { rows } = await execute(
      `SELECT role FROM doc.users WHERE id = $1 LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) return;

    const role = rows[0].role;

    await createNotificationFromTemplate({
      userId,
      role,
      templateKey: 'KYC_APPROVED',
      variables: {}
    });

    console.log(`[NotificationEvents] ✅ KYC approved notification sent to ${userId}`);

  } catch (error) {
    console.error('[NotificationEvents] ❌ Error en onKycApproved:', error);
  }
}

/**
 * EVENTO: KYC rechazado
 */
export async function onKycRejected({ userId, reason }) {
  try {
    const { rows } = await execute(
      `SELECT role FROM doc.users WHERE id = $1 LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) return;

    const role = rows[0].role;

    await createNotificationFromTemplate({
      userId,
      role,
      templateKey: 'KYC_REJECTED',
      variables: { reason: reason || 'Documentos no válidos' }
    });

    console.log(`[NotificationEvents] ✅ KYC rejected notification sent to ${userId}`);

  } catch (error) {
    console.error('[NotificationEvents] ❌ Error en onKycRejected:', error);
  }
}

/**
 * EVENTO: Nuevo KYC para revisar (Para fluxiDocs)
 */
export async function onNewKycSubmission({ userId, userEmail }) {
  try {
    // Obtener todos los usuarios con rol fluxiDocs
    const { rows } = await execute(
      `SELECT id FROM doc.users WHERE role = 'fluxiDocs'`
    );

    if (rows.length === 0) {
      console.log('[NotificationEvents] ⚠️ No hay usuarios fluxiDocs para notificar');
      return;
    }

    // Enviar notificación a cada inspector
    for (const inspector of rows) {
      await createNotificationFromTemplate({
        userId: inspector.id,
        role: 'fluxiDocs',
        templateKey: 'NEW_KYC_SUBMISSION',
        variables: {
          user_email: userEmail,
          user_id: userId
        }
      });
    }

    console.log(`[NotificationEvents] ✅ New KYC notifications sent to ${rows.length} inspectors`);

  } catch (error) {
    console.error('[NotificationEvents] ❌ Error en onNewKycSubmission:', error);
  }
}

/**
 * EVENTO: Usuario nuevo registrado (Para fluxiAdmin)
 */
export async function onNewUserRegistered({ userId, userEmail }) {
  try {
    // Obtener todos los admins
    const { rows } = await execute(
      `SELECT id FROM doc.users WHERE role = 'fluxiAdmin'`
    );

    if (rows.length === 0) return;

    // Enviar notificación a cada admin
    for (const admin of rows) {
      await createNotificationFromTemplate({
        userId: admin.id,
        role: 'fluxiAdmin',
        templateKey: 'NEW_USER_REGISTERED',
        variables: {
          user_email: userEmail,
          user_id: userId
        }
      });
    }

    console.log(`[NotificationEvents] ✅ New user notifications sent to ${rows.length} admins`);

  } catch (error) {
    console.error('[NotificationEvents] ❌ Error en onNewUserRegistered:', error);
  }
}

/**
 * EVENTO: Transacción grande (Para fluxiAdmin)
 */
export async function onLargeTransaction({ amount, currency, fromEmail, toEmail, txHash }) {
  try {
    // Solo notificar si supera un umbral
    const threshold = {
      'USD': 10000,
      'EUR': 10000,
      'COP': 40000000
    };

    if (amount < threshold[currency]) return;

    // Obtener todos los admins
    const { rows } = await execute(
      `SELECT id FROM doc.users WHERE role = 'fluxiAdmin'`
    );

    if (rows.length === 0) return;

    // Enviar notificación a cada admin
    for (const admin of rows) {
      await createNotificationFromTemplate({
        userId: admin.id,
        role: 'fluxiAdmin',
        templateKey: 'LARGE_TRANSACTION',
        variables: {
          amount,
          currency,
          from: fromEmail,
          to: toEmail,
          tx_hash: txHash
        }
      });
    }

    console.log(`[NotificationEvents] ✅ Large transaction alert sent to admins`);

  } catch (error) {
    console.error('[NotificationEvents] ❌ Error en onLargeTransaction:', error);
  }
}

/**
 * EVENTO: Cambio de contraseña
 */
export async function onPasswordChanged({ userId }) {
  try {
    const { rows } = await execute(
      `SELECT role FROM doc.users WHERE id = $1 LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) return;

    const role = rows[0].role;

    await createNotificationFromTemplate({
      userId,
      role,
      templateKey: 'PASSWORD_CHANGED',
      variables: {}
    });

    console.log(`[NotificationEvents] ✅ Password changed notification sent to ${userId}`);

  } catch (error) {
    console.error('[NotificationEvents] ❌ Error en onPasswordChanged:', error);
  }
}

/**
 * EVENTO: Error del sistema (Para fluxiDev)
 */
export async function onSystemError({ errorMessage, stack, endpoint }) {
  try {
    // Obtener todos los developers
    const { rows } = await execute(
      `SELECT id FROM doc.users WHERE role = 'fluxiDev'`
    );

    if (rows.length === 0) return;

    // Enviar notificación a cada developer
    for (const dev of rows) {
      await createNotificationFromTemplate({
        userId: dev.id,
        role: 'fluxiDev',
        templateKey: 'API_ERROR',
        variables: {
          endpoint,
          count: 1,
          error_message: errorMessage
        }
      });
    }

    console.log(`[NotificationEvents] ✅ System error alert sent to developers`);

  } catch (error) {
    console.error('[NotificationEvents] ❌ Error en onSystemError:', error);
  }
}


/**
 * EVENTO: Payment creado (esperando aprobación)
 */
export async function onPaymentPending({ paymentId, fromUserId, fromUserEmail, toUserEmail, amount, currency }) {
  try {
    // 1. Notificar al EMISOR que está en espera
    const { rows: fromUserRows } = await execute(
      `SELECT role FROM doc.users WHERE id = $1 LIMIT 1`,
      [fromUserId]
    );

    if (fromUserRows.length > 0) {
      await createNotificationFromTemplate({
        userId: fromUserId,
        role: fromUserRows[0].role,
        templateKey: 'PAYMENT_PENDING',
        variables: {
          amount,
          currency,
          to_user: toUserEmail
        }
      });
    }

    // 2. Notificar a TODOS los ADMINS
    const { rows: adminRows } = await execute(
      `SELECT id FROM doc.users WHERE role = 'fluxiAdmin'`
    );

    for (const admin of adminRows) {
      await createNotificationFromTemplate({
        userId: admin.id,
        role: 'fluxiAdmin',
        templateKey: 'PAYMENT_REQUIRES_APPROVAL',
        variables: {
          from_user: fromUserEmail,
          to_user: toUserEmail,
          amount,
          currency,
          payment_id: paymentId
        }
      });
    }

    console.log(`[NotificationEvents] ✅ Payment pending notifications sent`);

  } catch (error) {
    console.error('[NotificationEvents] ❌ Error en onPaymentPending:', error);
  }
}

/**
 * EVENTO: Payment aprobado por admin
 */
export async function onPaymentApproved({ 
  paymentId, 
  fromUserId, 
  fromUserEmail, 
  toUserId, 
  toUserEmail, 
  amount, 
  currency,
  adminId 
}) {
  try {
    // 1. Notificar al EMISOR que fue aprobado
    const { rows: fromUserRows } = await execute(
      `SELECT role FROM doc.users WHERE id = $1 LIMIT 1`,
      [fromUserId]
    );

    if (fromUserRows.length > 0) {
      await createNotificationFromTemplate({
        userId: fromUserId,
        role: fromUserRows[0].role,
        templateKey: 'PAYMENT_APPROVED',
        variables: {
          amount,
          currency,
          to_user: toUserEmail
        }
      });
    }

    // 2. Notificar al RECEPTOR que recibió dinero
    const { rows: toUserRows } = await execute(
      `SELECT role FROM doc.users WHERE id = $1 LIMIT 1`,
      [toUserId]
    );

    if (toUserRows.length > 0) {
      await createNotificationFromTemplate({
        userId: toUserId,
        role: toUserRows[0].role,
        templateKey: 'PAYMENT_RECEIVED',
        variables: {
          amount,
          currency,
          from_user: fromUserEmail
        }
      });
    }

    // 3. Notificar al ADMIN que aprobó
    const { rows: adminRows } = await execute(
      `SELECT role FROM doc.users WHERE id = $1 LIMIT 1`,
      [adminId]
    );

    if (adminRows.length > 0) {
      await createNotificationFromTemplate({
        userId: adminId,
        role: adminRows[0].role,
        templateKey: 'PAYMENT_APPROVED_ADMIN',
        variables: {
          amount,
          currency,
          from_user: fromUserEmail,
          to_user: toUserEmail
        }
      });
    }

    console.log(`[NotificationEvents] ✅ Payment approved notifications sent to 3 users`);

  } catch (error) {
    console.error('[NotificationEvents] ❌ Error en onPaymentApproved:', error);
  }
}

/**
 * EVENTO: Payment rechazado por admin
 */
export async function onPaymentRejected({
  paymentId,
  fromUserId,
  fromUserEmail,
  toUserEmail,
  amount,
  currency,
  reason,
  adminId
}) {
  try {
    // 1. Notificar al EMISOR que fue rechazado
    const { rows: fromUserRows } = await execute(
      `SELECT role FROM doc.users WHERE id = $1 LIMIT 1`,
      [fromUserId]
    );

    if (fromUserRows.length > 0) {
      await createNotificationFromTemplate({
        userId: fromUserId,
        role: fromUserRows[0].role,
        templateKey: 'PAYMENT_REJECTED',
        variables: {
          amount,
          currency,
          reason: reason || 'No especificada'
        }
      });
    }

    // 2. Notificar al ADMIN que rechazó
    const { rows: adminRows } = await execute(
      `SELECT role FROM doc.users WHERE id = $1 LIMIT 1`,
      [adminId]
    );

    if (adminRows.length > 0) {
      await createNotificationFromTemplate({
        userId: adminId,
        role: adminRows[0].role,
        templateKey: 'PAYMENT_REJECTED_ADMIN',
        variables: {
          amount,
          currency,
          from_user: fromUserEmail,
          to_user: toUserEmail
        }
      });
    }

    console.log(`[NotificationEvents] ✅ Payment rejected notifications sent to 2 users`);

  } catch (error) {
    console.error('[NotificationEvents] ❌ Error en onPaymentRejected:', error);
  }
}

/**
 * EVENTO UNIVERSAL: Cualquier transferencia de dinero
 * Se llama desde CUALQUIER endpoint que mueva dinero:
 * - Transferencias entre usuarios
 * - Top-ups
 * - Withdrawals
 * - Pagos procesados
 * - Etc.
 *
 * Notifica a TODOS los usuarios involucrados + ADMINS
 */
export async function onMoneyTransfer({
  fromUserId,
  toUserId,
  fromUserEmail,
  toUserEmail,
  amount,
  currency,
  description = 'Transferencia de dinero',
  transactionHash = null,
  transactionType = 'transfer' // transfer, topup, withdrawal, payment
}) {
  try {
    console.log(`[NotificationEvents] 💰 Transfiriendo ${amount} ${currency} de ${fromUserEmail} a ${toUserEmail}`);

    // Obtener roles de ambos usuarios
    const { rows: fromUserRows } = await execute(
      `SELECT role FROM doc.users WHERE id = $1 LIMIT 1`,
      [fromUserId]
    );

    const { rows: toUserRows } = await execute(
      `SELECT role FROM doc.users WHERE id = $1 LIMIT 1`,
      [toUserId]
    );

    // Obtener todos los admins
    const { rows: adminRows } = await execute(
      `SELECT id FROM doc.users WHERE role = 'fluxiAdmin'`
    );

    // 1. Notificar al EMISOR (si es usuario)
    if (fromUserRows.length > 0 && fromUserRows[0].role === 'fluxiUser') {
      await createNotification({
        userId: fromUserId,
        type: 'transfer_sent',
        category: 'wallet',
        title: '💸 Dinero enviado',
        message: `Enviaste ${amount} ${currency} a ${toUserEmail}. ${description}`,
        priority: 'normal',
        actionUrl: '/wallet',
        metadata: { toUserEmail, amount, currency, transactionHash, type: transactionType }
      });
    }

    // 2. Notificar al RECEPTOR (si es usuario)
    if (toUserRows.length > 0 && toUserRows[0].role === 'fluxiUser') {
      await createNotification({
        userId: toUserId,
        type: 'transfer_received',
        category: 'wallet',
        title: '💰 Dinero recibido',
        message: `Recibiste ${amount} ${currency} de ${fromUserEmail}. ${description}`,
        priority: 'high',
        actionUrl: '/wallet',
        metadata: { fromUserEmail, amount, currency, transactionHash, type: transactionType }
      });
    }

    // 3. Notificar a TODOS los ADMINS (para auditoría)
    for (const admin of adminRows) {
      await createNotification({
        userId: admin.id,
        type: 'large_transaction',
        category: 'wallet',
        title: '💰 Transferencia registrada',
        message: `${fromUserEmail} envió ${amount} ${currency} a ${toUserEmail}`,
        priority: 'normal',
        actionUrl: '/admin-panel?tab=transactions',
        metadata: { fromUserEmail, toUserEmail, amount, currency, transactionHash, type: transactionType }
      });
    }

    console.log(`[NotificationEvents] ✅ Transfer notifications sent to all involved users + admins`);

  } catch (error) {
    console.error('[NotificationEvents] ❌ Error en onMoneyTransfer:', error);
  }
}