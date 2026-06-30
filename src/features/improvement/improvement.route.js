import express from 'express';
import { authMiddleware } from '../../shared/globals/helpers/auth-middleware.js';
import { improvementController } from './improvement.controller.js';

const router = express.Router();

router.use(authMiddleware.protect);

router.get(
  '/admin/all',
  authMiddleware.authorize('ADMIN'),
  improvementController.getAllRequests
);

router.get(
  '/admin/stats',
  authMiddleware.authorize('ADMIN'),
  improvementController.getStats
);

router.patch(
  '/admin/:id/status',
  authMiddleware.authorize('ADMIN'),
  improvementController.updateStatus
);

router.post(
  '/admin/:id/suggestions',
  authMiddleware.authorize('ADMIN'),
  improvementController.addSuggestions
);

router.patch(
  '/admin/:id/complete',
  authMiddleware.authorize('ADMIN'),
  improvementController.completeRequest
);

router.get('/my',                        improvementController.getMyRequests);
router.post('/',                         improvementController.createRequest);
router.get('/:id',                       improvementController.getRequestById);
router.post('/:id/apply-suggestion',     improvementController.applyUserSuggestion);

export const improvementRoutes = router;