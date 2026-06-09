import express from 'express';
import { authMiddleware } from '../../shared/globals/helpers/auth-middleware.js';
import { aiFeatureController } from './ai-feature.controller.js';

const router = express.Router();

router.use(authMiddleware.protect);


router.get(
  '/admin/all',
  authMiddleware.authorize('ADMIN'),
  aiFeatureController.getAllUsages
);


router.post('/apply',        aiFeatureController.applyFeature);
router.get('/my-history',    aiFeatureController.getMyHistory);

export const aiFeatureRoutes = router;