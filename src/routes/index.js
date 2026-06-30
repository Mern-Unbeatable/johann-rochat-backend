import { aiFeatureRoutes } from '../features/ai-feature/ai-feature.route.js';
import { authRoutes } from '../features/auth/auth.routes.js';
import { creditRoutes } from '../features/credit/credit.route.js';
import { exportRoutes } from '../features/export/export.route.js';
import { generationRoutes } from '../features/generation/generation.routes.js';
import { improvementRoutes } from '../features/improvement/improvement.route.js';
import { listingRoutes } from '../features/listing/listing.routes.js';
import { metaRoutes } from '../features/meta/meta.route.js';
import { packageRoutes } from '../features/package/package.routes.js';
import { paymentRoutes } from '../features/payment/payment.routes.js';
import { promptTemplateRoutes } from '../features/prompt/prompt-template.route.js';
import { userRoutes } from '../features/user/user.routes.js';
import { healthRoutes } from './health.route.js';

const BASE_PATH = '/api/v1';

export default (app) => {

  app.use(healthRoutes);
  app.use(`${BASE_PATH}/auth`, authRoutes);
  app.use(`${BASE_PATH}/users`, userRoutes);
  app.use(`${BASE_PATH}/listings`, listingRoutes);
  app.use(`${BASE_PATH}/payments`, paymentRoutes);
  app.use(`${BASE_PATH}/generations`, generationRoutes);
  app.use(`${BASE_PATH}/ai-features`, aiFeatureRoutes);
  app.use(`${BASE_PATH}/exports`, exportRoutes);
  app.use(`${BASE_PATH}/improvements`, improvementRoutes);
  app.use(`${BASE_PATH}/prompt-templates`, promptTemplateRoutes);
  app.use(`${BASE_PATH}/credits`, creditRoutes);
  app.use(`${BASE_PATH}/packages`, packageRoutes);
  app.use(`${BASE_PATH}/meta`, metaRoutes);
};