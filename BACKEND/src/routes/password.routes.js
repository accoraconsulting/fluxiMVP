/**
 * RUTAS PARA PASSWORD RESET
 * Agregar estas rutas a tu auth.routes.js o crear password.routes.js
 */

import { Router } from 'express';
import { 
  forgotPassword, 
  checkResetToken, 
  confirmPasswordReset 
} from '../controllers/password.controller.js';

const router = Router();

/* =====================================================
   RUTAS DE PASSWORD RESET
===================================================== */

// POST /api/auth/forgot-password
// Body: { email: "user@example.com" }
router.post('/forgot-password', forgotPassword);

// GET /api/auth/check-reset-token?token=xxx
// Query: token
router.get('/check-reset-token', checkResetToken);

// POST /api/auth/reset-password
// Body: { token: "xxx", newPassword: "xxx" }
router.post('/reset-password', confirmPasswordReset);

export default router;

/* =====================================================
   CÓMO INTEGRAR EN TU SERVER.JS
===================================================== */

/*
// En tu server.js o app.js:

import passwordRoutes from './routes/password.routes.js';

// O si ya tienes auth.routes.js:
// app.use('/api/auth', authRoutes); // Ya existente
app.use('/api/auth', passwordRoutes); // Agregar esta línea

// O combinar todo en auth.routes.js:
// import * as passwordController from '../controllers/password.controller.js';
// router.post('/forgot-password', passwordController.forgotPassword);
// router.get('/check-reset-token', passwordController.checkResetToken);
// router.post('/reset-password', passwordController.confirmPasswordReset);
*/