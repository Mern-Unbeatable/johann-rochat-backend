import express from 'express';
import { authMiddleware } from '../../shared/globals/helpers/auth-middleware.js';
import { creditController } from './credit.controller.js';

const router = express.Router();

router.use(authMiddleware.protect);
router.post('/admin/add', authMiddleware.authorize('ADMIN'), creditController.adminAddCredits);
router.get('/admin/all', authMiddleware.authorize('ADMIN'), creditController.getAllTransactions);
router.get('/admin/stats', authMiddleware.authorize('ADMIN'), creditController.getCreditStats);

router.get('/balance', creditController.getBalance);
router.get('/history', creditController.getHistory);

export const creditRoutes = router;