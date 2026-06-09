import express from 'express';
import { authMiddleware } from '../../shared/globals/helpers/auth-middleware.js';
import { paymentController } from './payment.controller.js';
import { paymentRateLimit } from '../../shared/globals/helpers/rate-limit.helper.js';

const router = express.Router();
router.post('/webhook', paymentController.handleWebhook);
router.use(authMiddleware.protect);
router.post('/checkout', paymentRateLimit, paymentController.createCheckout);
router.post('/improvement-checkout', paymentRateLimit, paymentController.createImprovementCheckout);
router.get('/verify', paymentController.verifySession);
router.get('/verify-and-unlock', paymentController.verifyAndUnlock);
router.post('/verify-and-unlock', paymentController.verifyAndUnlock); 
router.get('/history', paymentController.getHistory);
router.get('/admin/all', authMiddleware.authorize('ADMIN'), paymentController.getAllPayments);
router.post('/admin/manual-process', authMiddleware.authorize('ADMIN'), paymentController.manualProcess);
if (process.env.NODE_ENV === 'development') {
  router.post('/dev-unlock', paymentController.devUnlock);
}

export const paymentRoutes = router;