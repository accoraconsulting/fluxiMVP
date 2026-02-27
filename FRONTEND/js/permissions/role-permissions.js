/**
 * 🔐 SISTEMA DE PERMISOS POR ROL - FLUXI
 * Define qué puede acceder cada rol y bajo qué condiciones
 */

export const ROLE_PERMISSIONS = {
  fluxiUser: {
    name: 'Cliente',
    description: 'Usuario final',
    canAccess: {
      dashboard: true,
      wallet: true,
      send: true,
      withdraw: true,
      deposit: true,
      movements: true,
      myAccount: true,
      support: true,
      kyc: true,
      kycManagement: false,
      admin: false,
      enrolled: true,
      payinsUser: true
    },
    requiresKYC: {
      // Sin KYC aprobado: solo acceso limitado
      unapproved: ['dashboard', 'myAccount', 'support', 'kyc'],
      // Con KYC aprobado: acceso completo
      approved: [
        'dashboard',
        'wallet',
        'send',
        'withdraw',
        'deposit',
        'movements',
        'myAccount',
        'support',
        'kyc',
        'enrolled',
        'payinsUser'
      ]
    }
  },

  fluxiDocs: {
    name: 'Inspector',
    description: 'Revisor de documentación KYC',
    canAccess: {
      dashboard: true,
      kycManagement: true,
      kyc: true,
      wallet: true,
      send: true,
      withdraw: true,
      deposit: true,
      movements: true,
      myAccount: true,
      support: true,
      admin: false,
      enrolled: true
    }
  },

  fluxiDev: {
    name: 'Developer',
    description: 'Equipo de desarrollo',
    canAccess: {
      dashboard: true,
      wallet: true,
      send: true,
      withdraw: true,
      deposit: true,
      movements: true,
      myAccount: true,
      support: true,
      kyc: true,
      kycManagement: true,
      admin: false,
      enrolled: true
    }
  },

  fluxiAdmin: {
    name: 'Admin',
    description: 'Administrador',
    canAccess: {
      dashboard: true,
      wallet: true,
      send: true,
      withdraw: true,
      deposit: true,
      movements: true,
      myAccount: true,
      support: true,
      kyc: true,
      kycManagement: true,
      admin: true,
      enrolled: true,
      payinsAdmin: true,
      payinsPending: true
    }
  }
};

/**
 * Verificar si un usuario puede acceder a una vista
 * @param {string} role - Rol del usuario
 * @param {string} view - Vista a la cual quiere acceder
 * @param {string} kycStatus - Estado del KYC (unapproved, approved, rejected)
 * @returns {boolean}
 */
export function canAccessView(role, view, kycStatus = 'unapproved') {
  const rolePerms = ROLE_PERMISSIONS[role];

  if (!rolePerms) {
    console.warn(`❌ Rol desconocido: ${role}`);
    return false;
  }

  // Para fluxiUser, verificar si necesita KYC aprobado
  if (role === 'fluxiUser') {
    if (kycStatus === 'approved') {
      return rolePerms.requiresKYC.approved.includes(view);
    } else {
      return rolePerms.requiresKYC.unapproved.includes(view);
    }
  }

  // Para otros roles, solo verificar si tienen acceso
  return rolePerms.canAccess[view] || false;
}

/**
 * Obtener vistas permitidas para un usuario
 * @param {string} role - Rol del usuario
 * @param {string} kycStatus - Estado del KYC
 * @returns {array}
 */
export function getAllowedViews(role, kycStatus = 'unapproved') {
  const rolePerms = ROLE_PERMISSIONS[role];

  if (!rolePerms) {
    return [];
  }

  if (role === 'fluxiUser') {
    if (kycStatus === 'approved') {
      return rolePerms.requiresKYC.approved;
    } else {
      return rolePerms.requiresKYC.unapproved;
    }
  }

  return Object.keys(rolePerms.canAccess).filter(
    (view) => rolePerms.canAccess[view] === true
  );
}

/**
 * Obtener mensaje de bloqueo personalizado
 * @param {string} view - Vista bloqueada
 * @param {string} kycStatus - Estado del KYC
 * @returns {string}
 */
export function getBlockedMessage(view, kycStatus) {
  if (kycStatus !== 'approved') {
    return `⚠️ Esta sección está bloqueada hasta que completes y apruebes tu verificación de identidad (KYC).\n\nPor favor, dirígete a "Verificación" para completar tu perfil.`;
  }

  return `❌ No tienes permisos para acceder a esta sección.`;
}

/**
 * Verificar si usuario está bloqueado completamente
 * @param {string} role - Rol del usuario
 * @param {string} kycStatus - Estado del KYC
 * @returns {boolean}
 */
export function isUserBlocked(role, kycStatus) {
  if (role !== 'fluxiUser') {
    return false;
  }

  // Si es fluxiUser sin KYC aprobado, verificar si tiene ALGUNA vista disponible
  const allowedViews = getAllowedViews(role, kycStatus);
  return allowedViews.length === 0;
}

/**
 * Obtener información de rol formateada
 * @param {string} role - Rol del usuario
 * @returns {object}
 */
export function getRoleInfo(role) {
  return ROLE_PERMISSIONS[role] || null;
}
