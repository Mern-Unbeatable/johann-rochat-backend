import express from 'express';
import metaController from './meta.controller.js';
import { authMiddleware } from '../../shared/globals/helpers/auth-middleware.js';

const router = express.Router();
router.use(authMiddleware.protect);
router.use(authMiddleware.authorize('ADMIN'));
router.get('/dashboard', metaController.getDashboardStats);
router.get('/simple', metaController.getSimpleStats);

export const metaRoutes = router;