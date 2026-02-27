import express from 'express';
import { authRequired } from '../middlewares/auth.middleware.js';
import {
  enroll,
  list,
  update,
  remove,
  validate,
  getDetails,
  reactivate  // ← AGREGAR ESTO
} from '../controllers/enrolled.controller.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authRequired);

// Listar destinatarios
router.get('/', list);

// Inscribir destinatario
router.post('/', enroll);

// Validar que usuario existe
router.post('/validate', validate);

// Obtener detalles de un destinatario (DEBE IR ANTES DE /:id)
router.get('/:id', getDetails);

// Reactivar destinatario (DEBE IR ANTES DE /:id/otros)
router.post('/:id/reactivate', reactivate);  // ← AGREGAR ESTO

// Actualizar alias
router.patch('/:id', update);

// Eliminar destinatario
router.delete('/:id', remove);

export default router;