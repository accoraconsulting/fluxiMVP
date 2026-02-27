/**
 * WALLET ROUTES
 */

import express from 'express';
import { authRequired } from '../middlewares/auth.middleware.js';
import {
  getWallet,
  getWallets,
  topUp,
  pay,
  getTransactions,
  transfer,
  getMovements,
  transferMulti,
  cleanupDuplicateWallets
} from '../controllers/wallet.controller.js';

import { convertCurrency, previewConversion } from '../controllers/conversion.controller.js';

const router = express.Router();

router.use(authRequired);


// Wallet principal (USD)
router.get('/', authRequired, getWallet);

// TODAS las wallets (USD, EUR, COP)
router.get('/all', authRequired, getWallets);

// Recargar saldo
router.post('/topup', authRequired, topUp);

// Pagar
router.post('/pay', authRequired, pay);

// Historial
router.get('/transactions', authRequired, getTransactions);

// Transferir a otro usuario
router.post('/transfer', authRequired, transfer);

router.post('/transfer-multi', transferMulti);

// Endpoints de conversión
router.post('/convert/preview', previewConversion);  // SOLO CALCULAR (sin ejecutar)
router.post('/convert', convertCurrency);            // EJECUTAR la conversión  

// Obtener movimientos detallados
router.get('/movements', authRequired, getMovements);

// 🧹 LIMPIAR DUPLICADOS (Solo Admin)
router.post('/cleanup-duplicates', authRequired, cleanupDuplicateWallets);

export default router;
