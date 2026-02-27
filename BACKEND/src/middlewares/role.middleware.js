/**
 * ROLE-BASED ACCESS CONTROL (RBAC) MIDDLEWARE
 */

// Definición de permisos por rol
const ROLE_PERMISSIONS = {
  // SUPER ADMIN - Acceso total
  'fluxiAdmin': {
    canAccessAdmin: true,
    canAccessDocs: true,
    canAccessDev: true,
    canAccessUser: true,
    canApprovePayments: true,
    canManageUsers: true,
    canViewCommissions: true,
    canManageWallets: true,
    canViewAllTransactions: true,
    canModifyRoles: true,
    canBlockUsers: true,
    canBlockWallets: true,
    canViewSystemWallets: true
  },

  // DESARROLLADORES - Acceso técnico
  'fluxiDev': {
    canAccessDev: true,
    canAccessUser: true,
    canViewCommissions: true,
    canViewAllTransactions: true,
    canAccessAdmin: false,
    canApprovePayments: false,
    canManageUsers: false,
    canBlockUsers: false,
    canBlockWallets: false
  },

  // INSPECTOR DE DOCS - Solo revisión KYC
  'fluxiDocs': {
    canAccessDocs: true,
    canAccessUser: true,
    canViewAllTransactions: false,
    canAccessAdmin: false,
    canApprovePayments: false,
    canManageUsers: false,
    canViewCommissions: false,
    canBlockUsers: false
  },

  // USUARIO FINAL - Solo sus datos
  'fluxiUser': {
    canAccessUser: true,
    canAccessAdmin: false,
    canAccessDocs: false,
    canAccessDev: false,
    canApprovePayments: false,
    canManageUsers: false,
    canViewCommissions: false,
    canViewAllTransactions: false,
    canBlockUsers: false
  }
};

/**
 * ✅ FUNCIÓN ORIGINAL (para kyc.management.routes.js)
 * Middleware para verificar múltiples roles permitidos
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const userRole = req.user?.role;

    if (!userRole) {
      return res.status(401).json({ 
        success: false,
        error: "UNAUTHORIZED",
        message: "Usuario no autenticado"
      });
    }

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        success: false,
        error: "FORBIDDEN",
        message: "No tienes permisos para acceder a este recurso",
        allowedRoles,
        yourRole: userRole
      });
    }

    next();
  };
}
/**
 * Middleware para verificar si es Admin
 */
export function requireAdmin(req, res, next) {
  console.log('[RoleMiddleware] 🔐 Verificando admin:', {
    userId: req.user?.id,
    role: req.user?.role,
    email: req.user?.email
  });

  if (req.user?.role !== 'fluxiAdmin') {
    console.error('[RoleMiddleware] ❌ Acceso denegado. Role actual:', req.user?.role);
    return res.status(403).json({
      success: false,
      error: 'Acceso denegado. Solo administradores.',
      yourRole: req.user?.role,
      requiredRole: 'fluxiAdmin'
    });
  }

  console.log('[RoleMiddleware] ✅ Admin verificado');
  next();
}
/**
 * Middleware para verificar permisos específicos
 */
export function requirePermission(permission) {
  return (req, res, next) => {
    const userRole = req.user?.role;

    if (!userRole) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado'
      });
    }

    const rolePermissions = ROLE_PERMISSIONS[userRole];

    if (!rolePermissions) {
      return res.status(403).json({
        success: false,
        error: 'Rol no reconocido'
      });
    }

    if (!rolePermissions[permission]) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para esta acción',
        requiredPermission: permission,
        yourRole: userRole
      });
    }

    next();
  };
}

/**
 * ✅ ALIAS de requireRole (para compatibilidad)
 * Middleware para verificar múltiples roles
 */
export function requireAnyRole(...allowedRoles) {
  return requireRole(...allowedRoles);
}

/**
 * Obtener permisos de un rol (para frontend)
 */
export function getRolePermissions(role) {
  return ROLE_PERMISSIONS[role] || {};
}