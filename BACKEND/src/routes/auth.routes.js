import { Router } from 'express';
import { login, register } from '../controllers/auth.controller.js';
import { 
  forgotPassword, 
  checkResetToken, 
  confirmPasswordReset 
} from '../controllers/password.controller.js';

const router = Router();

// Rutas de autenticación
router.post('/login', login);
router.post('/register', register);

// Rutas de password reset
router.post('/forgot-password', forgotPassword);
router.get('/check-reset-token', checkResetToken);
router.post('/reset-password', confirmPasswordReset);

export default router;