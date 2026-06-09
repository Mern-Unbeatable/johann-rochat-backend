import express from 'express';
import { authMiddleware } from '../../shared/globals/helpers/auth-middleware.js';
import { userController } from './user.controller.js';

const router = express.Router();

router.use(authMiddleware.protect);

router.get('/me', userController.getMe);
router.patch('/me', userController.updateProfile);
router.delete('/me', userController.deleteMe);
router.get('/me/stats', userController.getMyStats);
router.get('/me/credits', userController.getMyCreditHistory);

router.get('/admin', authMiddleware.authorize('ADMIN'), userController.getAllUsers);

router.get('/admin/stats', authMiddleware.authorize('ADMIN'), userController.getAdminStats);

router.get('/admin/:id', authMiddleware.authorize('ADMIN'), userController.getUserById);

router.patch(
  '/admin/:id/verify',
  authMiddleware.authorize('ADMIN'),
  userController.setUserVerified,
);

router.patch('/admin/:id/credits', authMiddleware.authorize('ADMIN'), userController.adjustCredits);

router.delete('/admin/:id', authMiddleware.authorize('ADMIN'), userController.deleteUser);
router.get('/me/refresh-credits', userController.refreshUserCredits);
router.patch(
  '/admin/:id/assign-package',
  authMiddleware.authorize('ADMIN'),
  userController.assignPackage
);

router.patch(
  '/admin/:id/add-credits',
  authMiddleware.authorize('ADMIN'),
  userController.addCreditsOnly
);
export const userRoutes = router;
