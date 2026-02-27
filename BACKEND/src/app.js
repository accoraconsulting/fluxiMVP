import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import adminRoutes from './routes/admin.routes.js';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import kycRoutes from './routes/kyc.routes.js';
import userRoutes from "./routes/user.routes.js";
import kycManagementRoutes from "./routes/kyc.management.routes.js";
import passwordRoutes from "./routes/password.routes.js";
import walletRoutes from './routes/wallet.routes.js';
import enrolledRoutes from './routes/enrolled.routes.js';
import commissionRoutes from './routes/commission.routes.js';
import paymentRequestRoutes from './routes/payment-request.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import supportRoutes from './routes/support.routes.js';
import assetsRoutes from './routes/assets.routes.js';

// ═══════════════════════════════════════════════════════════════
// VITAWALLET INTEGRATION (Payins) - DESHABILITADO PARA MVP
// ═══════════════════════════════════════════════════════════════
// import payinRoutes from './routes/payin.routes.js';
// import vitawalletTestingRoutes from './routes/vitawallet-testing.routes.js';
// import paymentLinksRoutes from './routes/payment-links.routes.js';
// import vitawalletWalletRoutes from './routes/vitawallet-wallet.routes.js';

// ═══════════════════════════════════════════════════════════════
// MESTA INTEGRATION (External Payments) - DESHABILITADO PARA MVP
// ═══════════════════════════════════════════════════════════════
// import externalPaymentRoutes from './routes/external-payment.routes.js';
// import webhookRoutes from './routes/webhook.routes.js';

// ═══════════════════════════════════════════════════════════════
// STATIC FILES SETUP (Para servir FRONTEND desde el backend)
// ═══════════════════════════════════════════════════════════════
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.resolve(__dirname, '../../FRONTEND');

const app = express();

/* =====================================================
   CORS (BACKEND SIRVE FRONTEND + FUTURO DEPLOY A RENDER)
===================================================== */
// En Render, el backend sirve el frontend, así que:
// - Localhost: permite localhost:5500
// - Render: permite el mismo origin (backend = frontend)
const allowedOrigins = [
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
];

// Agregar el origin actual si está en producción
const currentOrigin = process.env.FRONTEND_URL || process.env.RENDER_EXTERNAL_URL;
if (currentOrigin && !allowedOrigins.includes(currentOrigin)) {
  allowedOrigins.push(currentOrigin);
}

app.use(cors({
  origin: function (origin, callback) {
    // Permitir requests sin origin (Mobile apps, Postman, etc)
    if (!origin) return callback(null, true);

    // En localhost, permitir cualquier localhost
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }

    // En producción, permitir el origin configurado
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Por defecto, permitir (importante para Render donde backend = frontend)
    return callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

/* =====================================================
   BODY PARSERS
===================================================== */
app.use(express.raw({ type: 'application/json', limit: '10mb' }), (req, res, next) => {
  if (Buffer.isBuffer(req.body)) {
    req.rawBody = req.body.toString('utf8');
    req.body = JSON.parse(req.rawBody);
  }
  next();
});

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

/* =====================================================
   STATIC FILES MIDDLEWARE (Servir FRONTEND desde backend)
===================================================== */
app.use(express.static(frontendPath));
console.log(`✅ [APP] Sirviendo archivos estáticos desde: ${frontendPath}`);

/* =====================================================
   REQUEST LOGGING MIDDLEWARE
===================================================== */
app.use((req, res, next) => {
  const timestamp = new Date().toLocaleTimeString('es-ES');
  console.log(`\n📡 [${timestamp}] ${req.method.toUpperCase()} ${req.path}`);
  next();
});

/* =====================================================
   ROUTES
===================================================== */
app.use('/api/admin', adminRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/kyc', kycRoutes);
app.use("/api/user", userRoutes);
app.use("/api/kyc-management", kycManagementRoutes);
app.use("/api/auth", passwordRoutes); // ✅ CAMBIO AQUÍ: /api/password → /api/auth
app.use('/api/wallet', walletRoutes);
app.use('/api/enrolled', enrolledRoutes);
app.use('/api/commission', commissionRoutes);
app.use('/api/payment-requests', paymentRequestRoutes);
app.use("/api/notifications", notificationRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/assets', assetsRoutes);

// ═══════════════════════════════════════════════════════════════
// VITAWALLET INTEGRATION (Payins) - DESHABILITADO PARA MVP
// ═══════════════════════════════════════════════════════════════
// app.use('/api', payinRoutes);
// console.log('✅ [APP] Payin routes registradas');
// app.use('/api', vitawalletTestingRoutes);
// console.log('✅ [APP] VitaWallet testing routes registradas');
// app.use('/api', paymentLinksRoutes);
// console.log('✅ [APP] Payment links routes registradas');
// app.use('/api', vitawalletWalletRoutes);
// console.log('✅ [APP] VitaWallet wallet routes registradas');

// ═══════════════════════════════════════════════════════════════
// MESTA INTEGRATION (External Payments) - DESHABILITADO PARA MVP
// ═══════════════════════════════════════════════════════════════
// app.use('/api/external-payments', externalPaymentRoutes);
// app.use('/api/webhooks', webhookRoutes);

/* =====================================================
   FALLBACK 404 API
===================================================== */
app.use("/api", (req, res) => {
  res.status(404).json({
    error: "API_NOT_FOUND",
    path: req.originalUrl
  });
});

export default app;