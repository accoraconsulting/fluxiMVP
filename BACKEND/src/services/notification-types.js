/**
 * TIPOS DE NOTIFICACIONES POR ROL
 * Define qué notificaciones recibe cada rol
 */

export const NOTIFICATION_TYPES = {

  // ==========================================
  // NOTIFICACIONES PARA fluxiUser (CLIENTES)
  // ==========================================
  fluxiUser: {
    // KYC
    KYC_SUBMITTED: {
      type: 'kyc_submitted',
      category: 'kyc',
      priority: 'normal',
      title: '📄 Documentos enviados',
      message: 'Tus documentos KYC están siendo revisados. Te notificaremos cuando estén aprobados.',
      action: '/kyc.html'
    },
    KYC_APPROVED: {
      type: 'kyc_approved',
      category: 'kyc',
      priority: 'high',
      title: '✅ Cuenta verificada',
      message: '¡Felicidades! Tu cuenta ha sido verificada. Ya puedes realizar todas las operaciones.',
      action: '/dashboard.html'
    },
    KYC_REJECTED: {
      type: 'kyc_rejected',
      category: 'kyc',
      priority: 'high',
      title: '❌ Documentos rechazados',
      message: 'Tus documentos no pudieron ser verificados. Por favor, revisa y vuelve a enviarlos.',
      action: '/kyc.html'
    },
    KYC_REQUIRES_UPDATE: {
      type: 'kyc_requires_update',
      category: 'kyc',
      priority: 'high',
      title: '🔄 Actualización requerida',
      message: 'Necesitamos que actualices algunos documentos. Haz clic para ver los detalles.',
      action: '/kyc.html'
    },

    // WALLET
    TRANSFER_RECEIVED: {
      type: 'transfer_received',
      category: 'wallet',
      priority: 'high',
      title: '💰 Transferencia recibida',
      message: 'Recibiste {{amount}} {{currency}} de {{from_user}}',
      action: '/wallet.html'
    },
    TOPUP_COMPLETED: {
      type: 'topup_completed',
      category: 'wallet',
      priority: 'normal',
      title: '✅ Recarga exitosa',
      message: 'Tu recarga de {{amount}} {{currency}} fue procesada correctamente',
      action: '/deposit.html'
    },
    PAYMENT_COMPLETED: {
      type: 'payment_completed',
      category: 'wallet',
      priority: 'normal',
      title: '✅ Pago realizado',
      message: 'Tu pago de {{amount}} {{currency}} fue procesado exitosamente',
      action: '/moviments.html'
    },
    LOW_BALANCE: {
      type: 'low_balance',
      category: 'wallet',
      priority: 'normal',
      title: '⚠️ Saldo bajo',
      message: 'Tu saldo en {{currency}} está por debajo de {{threshold}}. Considera hacer una recarga.',
      action: '/deposit.html'
    },

    // SEGURIDAD
    PASSWORD_CHANGED: {
      type: 'password_changed',
      category: 'security',
      priority: 'high',
      title: '🔐 Contraseña actualizada',
      message: 'Tu contraseña fue cambiada exitosamente. Si no fuiste tú, contacta soporte inmediatamente.',
      action: '/myaccount.html'
    },
    LOGIN_NEW_DEVICE: {
      type: 'login_new_device',
      category: 'security',
      priority: 'high',
      title: '🔔 Inicio de sesión nuevo',
      message: 'Detectamos un inicio de sesión desde un nuevo dispositivo. Si no fuiste tú, asegura tu cuenta.',
      action: '/myaccount.html'
    },

    // SISTEMA
    MAINTENANCE_SCHEDULED: {
      type: 'maintenance_scheduled',
      category: 'system',
      priority: 'normal',
      title: '🛠️ Mantenimiento programado',
      message: 'Realizaremos mantenimiento el {{date}}. La plataforma no estará disponible temporalmente.',
      action: null
    },

      PAYMENT_PENDING: {
        type: 'payment_pending',
        category: 'wallet',
        priority: 'normal',
        title: '⏳ Pago en espera',
        message: 'Tu pago de {{amount}} {{currency}} a {{to_user}} está esperando aprobación del administrador.',
        action: '/send.html'
      },

      PAYMENT_APPROVED: {
        type: 'payment_approved',
        category: 'wallet',
        priority: 'high',
        title: '✅ Pago aprobado',
        message: 'Tu pago de {{amount}} {{currency}} a {{to_user}} fue aprobado. El dinero fue transferido.',
        action: '/moviments.html'
      },

      PAYMENT_REJECTED: {
        type: 'payment_rejected',
        category: 'wallet',
        priority: 'high',
        title: '❌ Pago rechazado',
        message: 'Tu pago de {{amount}} {{currency}} fue rechazado. Razón: {{reason}}',
        action: '/send.html'
      },

      PAYMENT_RECEIVED: {
        type: 'payment_received',
        category: 'wallet',
        priority: 'high',
        title: '💰 Pago recibido',
        message: 'Recibiste {{amount}} {{currency}} de {{from_user}}. Aprobado por administrador.',
        action: '/wallet.html'
      },

        },

  // ==========================================
  // NOTIFICACIONES PARA fluxiDocs (INSPECTORES)
  // ==========================================
  fluxiDocs: {
    NEW_KYC_SUBMISSION: {
      type: 'new_kyc_submission',
      category: 'kyc',
      priority: 'high',
      title: '📄 Nuevo KYC para revisar',
      message: 'Usuario {{user_email}} envió documentos para verificación',
      action: '/kyc-management.html'
    },
    KYC_REQUIRES_REVIEW: {
      type: 'kyc_requires_review',
      category: 'kyc',
      priority: 'urgent',
      title: '🔴 KYC requiere atención',
      message: 'Hay {{count}} documentos esperando revisión hace más de 24 horas',
      action: '/kyc-management.html'
    },
    DOCUMENT_UPDATED: {
      type: 'document_updated',
      category: 'kyc',
      priority: 'normal',
      title: '🔄 Documento actualizado',
      message: 'Usuario {{user_email}} actualizó sus documentos KYC',
      action: '/kyc-management.html'
    }
  },

  // ==========================================
  // NOTIFICACIONES PARA fluxiAdmin (ADMINS)
  // ==========================================
  fluxiAdmin: {
    NEW_USER_REGISTERED: {
      type: 'new_user_registered',
      category: 'system',
      priority: 'normal',
      title: '👤 Nuevo usuario registrado',
      message: '{{user_email}} se registró en la plataforma',
      action: '/admin-panel.html'
    },
    LARGE_TRANSACTION: {
      type: 'large_transaction',
      category: 'wallet',
      priority: 'high',
      title: '💰 Transacción grande detectada',
      message: 'Transacción de {{amount}} {{currency}} entre {{from}} y {{to}}',
      action: '/admin-panel.html?tab=transactions'
    },
    SUSPICIOUS_ACTIVITY: {
      type: 'suspicious_activity',
      category: 'security',
      priority: 'urgent',
      title: '🚨 Actividad sospechosa',
      message: 'Usuario {{user_email}}: {{description}}',
      action: '/admin-panel.html'
    },
    SYSTEM_ERROR: {
      type: 'system_error',
      category: 'system',
      priority: 'urgent',
      title: '🔴 Error del sistema',
      message: 'Error crítico detectado: {{error_message}}',
      action: '/admin-panel.html'
    },
    HIGH_COMMISSION_DAY: {
      type: 'high_commission_day',
      category: 'wallet',
      priority: 'normal',
      title: '💵 Comisiones del día',
      message: 'Se generaron {{amount}} {{currency}} en comisiones hoy',
      action: '/admin-panel.html?tab=commissions'
    },

    PAYMENT_REQUIRES_APPROVAL: {
      type: 'payment_requires_approval',
      category: 'wallet',
      priority: 'urgent',
      title: '🔔 Pago pendiente de aprobación',
      message: '{{from_user}} quiere enviar {{amount}} {{currency}} a {{to_user}}',
      action: '/admin-panel.html?tab=payments'
    },

    PAYMENT_APPROVED_ADMIN: {
      type: 'payment_approved_admin',
      category: 'wallet',
      priority: 'normal',
      title: '✅ Pago aprobado exitosamente',
      message: 'Aprobaste el pago de {{amount}} {{currency}} de {{from_user}} a {{to_user}}',
      action: '/admin-panel.html?tab=payments'
    },

    PAYMENT_REJECTED_ADMIN: {
      type: 'payment_rejected_admin',
      category: 'wallet',
      priority: 'normal',
      title: '❌ Pago rechazado',
      message: 'Rechazaste el pago de {{amount}} {{currency}} de {{from_user}} a {{to_user}}',
      action: '/admin-panel.html?tab=payments'
    }

  },

  // ==========================================
  // NOTIFICACIONES PARA fluxiDev (DEVELOPERS)
  // ==========================================
  fluxiDev: {
    API_ERROR: {
      type: 'api_error',
      category: 'system',
      priority: 'urgent',
      title: '🐛 Error de API',
      message: 'Endpoint {{endpoint}} falló {{count}} veces en la última hora',
      action: '/admin-panel.html'
    },
    DATABASE_SLOW_QUERY: {
      type: 'database_slow_query',
      category: 'system',
      priority: 'high',
      title: '⚠️ Query lenta detectada',
      message: 'Query en {{table}} tardó {{duration}}ms',
      action: '/admin-panel.html'
    },
    DEPLOY_COMPLETED: {
      type: 'deploy_completed',
      category: 'system',
      priority: 'normal',
      title: '🚀 Deploy completado',
      message: 'Nueva versión {{version}} desplegada exitosamente',
      action: '/admin-panel.html'
    },
    BACKUP_FAILED: {
      type: 'backup_failed',
      category: 'system',
      priority: 'urgent',
      title: '🔴 Backup falló',
      message: 'El backup automático de {{date}} falló. Revisar inmediatamente.',
      action: '/admin-panel.html'
    }
  }
};

/**
 * Obtener todas las notificaciones de un rol
 */
export function getNotificationTypesForRole(role) {
  return NOTIFICATION_TYPES[role] || {};
}

/**
 * Obtener configuración de un tipo específico
 */
export function getNotificationConfig(role, type) {
  const roleNotifications = NOTIFICATION_TYPES[role];
  if (!roleNotifications) return null;

  return Object.values(roleNotifications).find(n => n.type === type);
}
