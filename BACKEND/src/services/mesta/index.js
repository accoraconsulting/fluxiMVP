/**
 * MESTA SERVICES INDEX
 * Exporta todos los servicios relacionados con Mesta
 */

// Configuración
export { mestaConfig, validateMestaConfig, logMestaConfig } from '../../config/mesta.config.js';

// Cliente API
export { default as mestaClient, MestaClient } from './mesta.client.js';

// Servicios
export * as balanceLockService from './balance-lock.service.js';
export * as externalPaymentService from './external-payment.service.js';
export * as webhookService from './webhook.service.js';

// Estados
export { LOCK_STATUS } from './balance-lock.service.js';
export { EXTERNAL_PAYMENT_STATUS, PROVIDER_STATUS } from './external-payment.service.js';
export { WEBHOOK_STATUS, MESTA_EVENTS } from './webhook.service.js';

// Default export con todos los servicios
import mestaClient from './mesta.client.js';
import * as balanceLockService from './balance-lock.service.js';
import * as externalPaymentService from './external-payment.service.js';
import * as webhookService from './webhook.service.js';

export default {
  client: mestaClient,
  balanceLock: balanceLockService,
  externalPayment: externalPaymentService,
  webhook: webhookService,
};
