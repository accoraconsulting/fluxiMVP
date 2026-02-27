import jwt from "jsonwebtoken";

export function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization;
    
    console.log('[AuthMiddleware] Headers:', {
      authorization: header ? 'Present' : 'Missing',
      path: req.path,
      method: req.method
    });

    if (!header) {
      console.error('[AuthMiddleware] ❌ No authorization header');
      return res.status(401).json({ 
        success: false,
        error: "NO_TOKEN",
        message: "Token de autenticación no proporcionado"
      });
    }

    const parts = header.split(" ");
    
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      console.error('[AuthMiddleware] ❌ Formato de token inválido:', header);
      return res.status(401).json({ 
        success: false,
        error: "INVALID_TOKEN_FORMAT",
        message: "El formato del token debe ser: Bearer <token>"
      });
    }

    const token = parts[1];

    if (!process.env.JWT_SECRET) {
      console.error('[AuthMiddleware] ❌ JWT_SECRET no está configurado');
      return res.status(500).json({ 
        success: false,
        error: "SERVER_CONFIG_ERROR",
        message: "Error de configuración del servidor"
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    console.log('[AuthMiddleware] ✅ Token decodificado:', {
      userId: decoded.userId,
      id: decoded.id,
      role: decoded.role,
      email: decoded.email
    });

    // 🔥 CRÍTICO: Soportar tanto 'userId' como 'id' en el token
    req.user = {
      id: decoded.userId || decoded.id,
      role: decoded.role,
      email: decoded.email
    };

    if (!req.user.id) {
      console.error('[AuthMiddleware] ❌ Token no contiene userId ni id:', decoded);
      return res.status(401).json({ 
        success: false,
        error: "INVALID_TOKEN_PAYLOAD",
        message: "El token no contiene un ID de usuario válido"
      });
    }

    console.log('[AuthMiddleware] ✅ req.user configurado:', req.user);

    next();

  } catch (err) {
    console.error('[AuthMiddleware] ❌ Error verificando token:', err.message);
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        error: "TOKEN_EXPIRED",
        message: "El token ha expirado"
      });
    }
    
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false,
        error: "INVALID_TOKEN",
        message: "Token inválido"
      });
    }

    return res.status(401).json({ 
      success: false,
      error: "AUTH_ERROR",
      message: "Error de autenticación"
    });
  }
}