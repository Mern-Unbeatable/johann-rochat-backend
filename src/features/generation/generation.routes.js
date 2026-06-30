import express from 'express';
import { authMiddleware } from '../../shared/globals/helpers/auth-middleware.js';
import { generationController } from './generation.controller.js';

const router = express.Router();

router.use(authMiddleware.protect);


router.post('/generate', generationController.generateAd);
router.post('/feature', generationController.useAiFeature);
router.get('/listing/:listingId', generationController.getListingGenerations);
router.get('/:id', generationController.getGenerationById);
router.patch('/admin/:id/text',
  authMiddleware.authorize('ADMIN'),
  generationController.updateGenerationText
);

router.get('/admin/improvement/:improvementId',
  authMiddleware.authorize('ADMIN'),
  generationController.getGenerationByImprovement
);

export const generationRoutes = router;