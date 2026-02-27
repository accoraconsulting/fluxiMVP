import express from 'express';
import { getAssets, getAssetBySymbol } from '../controllers/assets.controller.js';
import { authRequired } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Obtener todos los activos (sin autenticación requerida)
router.get('/', getAssets);

// Obtener activo por símbolo
router.get('/:symbol', getAssetBySymbol);

export default router;
