import express from 'express';
import { authMiddleware } from '../../shared/globals/helpers/auth-middleware.js';
import { exportController } from './export.controller.js';

const router = express.Router();

router.use(authMiddleware.protect);
router.get('/admin/all', authMiddleware.authorize('ADMIN'), exportController.getAllExports);
router.post('/', exportController.createExport);
router.get('/my', exportController.getMyExports);

export const exportRoutes = router;